const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.abv0rui.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const database = client.db("Library");
    const CategoriesCollection = database.collection("Categories");
    const BooksCollection = database.collection("AllBooks");
    const BorrowCollection = database.collection("BorrowBooks");

    const gateman = (req, res, next) => {
      const { token } = req.cookies;
      console.log(token);
      if (!token) {
        return res.status(401).send("You are unauthorized");
      }

      jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
        if (err) {
          return res.status(401).send("You are unauthorized");
        }

        req.user = decoded;
        next();
      });
    };

    app.get("/api/v1/categories", async (req, res) => {
      const cursor = CategoriesCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/api/v1/allbooks", async (req, res) => {
      const cursor = BooksCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/api/v1/allbooks/:id", async (req, res) => {
      const id = req.params;
      const queryCategory = { _id: new ObjectId(id) };
      const category = await CategoriesCollection.findOne(queryCategory);
      const query = { category: category.name };
      const cursor = BooksCollection.find(query);
      const books = await cursor.toArray();
      res.send(books);
    });
    app.get("/api/v1/book/:id", async (req, res) => {
      const id = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await BooksCollection.findOne(query);
      // console.log(result);
      res.send(result);
    });
    // app.get("/api/v1/categories", gateman, async (req, res) => {
    //   const userEmail = req.query.email;
    //   const tokenEmail = req.user.email;

    //   if (userEmail !== tokenEmail) {
    //     // const result = await cursor.toArray();
    //     res.status(403).send("Forbidden");
    //   }
    //   const query = {};
    //   if (userEmail) {
    //     query.email = userEmail;
    //   }
    //   const result = await CategoriesCollection.find(query).toArray();
    //   res.send(result);
    // });

    app.post("/api/v1/addbook", gateman, async (req, res) => {
      const newBook = req.body;
      const result = await BooksCollection.insertOne(newBook);
      res.send(result);
    });
    app.post("/api/v1/borrowbook", gateman, async (req, res) => {
      const borrowBook = req.body;
      // console.log(borrowBook);
      const queryForBorrow = {
        id: borrowBook.id,
      };
      const borrowedQueryBook = await BorrowCollection.findOne(queryForBorrow);
      console.log(borrowedQueryBook);
      const query = {
        _id: new ObjectId(borrowBook.id),
      };
      const queryBook = await BooksCollection.findOne(query);
      const { photoUrl, bookName, authorName, category, description, rating } =
        queryBook;
      let quantity = Number(queryBook.quantity);
      if (borrowedQueryBook?.id == queryBook?._id) {
        return res.send({ msg: "You can not add this book" });
      }
      if (quantity > 0) {
        const mergedObject = {
          ...borrowBook,
          photoUrl,
          bookName,
          authorName,
          category,
          description,
          rating,
        };
        quantity = quantity - 1;
        const filter = { _id: queryBook._id };
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            quantity: quantity,
          },
        };
        const updatedQueryBook = await BooksCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        // console.log(updatedQueryBook);
        const result = await BorrowCollection.insertOne(mergedObject);
        res.send(result);
      }
      // res.send(result);
    });

    app.post("/api/v1/auth/access-token", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET);
      // console.log(token);
      // res.send(token);
      res
        .cookie(
          "token",
          token,
          {
            httpOnly: true,
            secure: true,
            sameSite: "none",
          },
          { expiresIn: 60 * 60 }
        )
        .send({ success: true });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("I am live");
});

app.listen(port, () => {
  console.log("I am listening on port", port);
});
