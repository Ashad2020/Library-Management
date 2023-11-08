const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();
const port = process.env.PORT || 5000;

// middlewares

const corsOptions = {
  // origin: '*',
  origin: ["https://library-management-a18d4.web.app", "http://localhost:5173"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

// app.use(
//   cors({
//     origin: ["https://library-management-a18d4.web.app/"],
//     credentials: true,
//   })
// );
// app.use(
//   cors({
//     origin: "https://library-management-a18d4.web.app/",
//     credentials: true,
//   })
// );
// app.use({
//   origin: "http://localhost:5173",
//   credentials: true,
// });
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
      // console.log(token);
      if (!token) {
        return res.status(401).send("You are unauthorized");
      }

      jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
        if (err) {
          return res.status(401).send("You are unauthorized");
        }
        // console.log(decoded);
        req.user = decoded;
        next();
      });
    };

    const checkUserRole = (req, res, next) => {
      if (req.user && req.user.role === "librarian") {
        next();
      } else {
        res.status(403).send("Access denied. You need the required role.");
      }
    };

    app.get("/api/v1/categories", async (req, res) => {
      const cursor = CategoriesCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/api/v1/allbooks", gateman, checkUserRole, async (req, res) => {
      const query = {};
      const quantity = req.query.quantity;
      if (quantity) {
        query.quantity = { $gt: 0 };
      }
      const cursor = BooksCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/api/v1/borrowedbooks/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const cursor = BorrowCollection.find(query);
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

    app.post("/api/v1/addbook", gateman, checkUserRole, async (req, res) => {
      const newBook = req.body;
      const result = await BooksCollection.insertOne(newBook);
      res.send(result);
    });
    app.post("/api/v1/borrowbook", async (req, res) => {
      const borrowBook = req.body;
      // console.log(borrowBook);
      const { email } = borrowBook;
      // console.log(email);
      // const user = req.user;

      const queryForBorrow = {
        id: borrowBook.id,
      };
      const cursor = BorrowCollection.find(queryForBorrow);
      const borrowedQueryBook = await cursor.toArray();
      // console.log(borrowedQueryBook);
      const query = {
        _id: new ObjectId(borrowBook.id),
      };
      const queryBook = await BooksCollection.findOne(query);
      // console.log("Book from BooksCollection", queryBook);
      const { photoUrl, bookName, authorName, category, description, rating } =
        queryBook;
      let quantity = Number(queryBook.quantity);

      const queryBookId = queryBook?._id.toString();
      let count = 0;
      borrowedQueryBook?.map((book) => {
        if (email === book.email) {
          count++;
        }
      });
      // console.log(count);
      // console.log(borrowBook.id === queryBookId);

      if (count > 0 && borrowBook.id === queryBookId) {
        return res.send({ msg: "You can not add this book" });
      }
      if (quantity > 0 && borrowedQueryBook.length === 0) {
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

        const result = await BorrowCollection.insertOne(mergedObject);
        return res.send(result);
      }
      if (quantity > 0 && email !== borrowedQueryBook?.email) {
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

        const result = await BorrowCollection.insertOne(mergedObject);
        return res.send(result);
      }
    });
    app.patch("/api/v1/updatebook/:id", gateman, async (req, res) => {
      const updateBookData = req.body;
      const {
        photoUrl,
        bookName,
        authorName,
        category,
        description,
        rating,
        quantity,
      } = updateBookData;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          photoUrl,
          bookName,
          authorName,
          category,
          description,
          rating,
          quantity,
        },
      };
      const updatedBook = await BooksCollection.updateOne(
        filter,
        updateDoc,
        options
      );

      res.send(updatedBook);
    });

    app.post("/api/v1/auth/access-token", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET);
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
      // console.log(token);
      // res.send(token);
      // res
      //   .cookie(
      //     "token",
      //     token,
      //     {
      //       httpOnly: true,
      //       secure: false,
      //       // secure: true,
      //       // sameSite: "none",
      //     },
      //     { expiresIn: 60 * 60 }
      //   )
      //   .send({ success: true });
    });
    app.delete(`/api/v1/deletebook/:id`, async (req, res) => {
      const idFromParams = req.params.id;
      // console.log(idFromParams);
      const queryForReturn = { _id: new ObjectId(idFromParams) };
      const borrowedQueryBook = await BorrowCollection.findOne(queryForReturn);
      // console.log(borrowedQueryBook);
      const { id } = borrowedQueryBook;
      const queryForIncreaseQuantity = { _id: new ObjectId(id) };
      const BookForIncreaseQuantity = await BooksCollection.findOne(
        queryForIncreaseQuantity
      );
      // console.log(BookForIncreaseQuantity);
      if (BookForIncreaseQuantity) {
        // const query = { id: BookForIncreaseQuantity._id };
        const result = await BorrowCollection.deleteOne(queryForReturn);
        // console.log(result);
      }
      if (BookForIncreaseQuantity) {
        let { quantity } = BookForIncreaseQuantity;
        quantity = quantity + 1;
        const filter = { _id: BookForIncreaseQuantity._id };
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

        res.send({ msg: "Return Success" });
      }
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
