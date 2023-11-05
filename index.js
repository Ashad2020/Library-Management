const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());

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

    app.get("/api/v1/categories", async (req, res) => {
      const cursor = CategoriesCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/api/v1/addbook", async (req, res) => {
      console.log(req.body);
      const newBook = req.body;
      const result = await BooksCollection.insertOne(newBook);

      res.send(result);
    });

    app.delete("");
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
