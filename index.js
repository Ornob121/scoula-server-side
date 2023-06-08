const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const port = process.env.PORT || 5000;
const app = express();

// ! Middleware

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("The Scuola server is running");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cpumijq.mongodb.net/?retryWrites=true&w=majority`;

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
    await client.connect();

    const courseCollection = client.db("scuolaDB").collection("courses");
    const instructorCollection = client
      .db("scuolaDB")
      .collection("instructors");

    // ! Courses APIs
    app.get("/popularCourses", async (req, res) => {
      const result = await courseCollection
        .find()
        .sort({ totalStudents: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/courses", async (req, res) => {
      const result = await courseCollection.find().toArray();
      res.send(result);
    });

    // ! Instructor APIs

    app.get("/instructors", async (req, res) => {
      const result = await instructorCollection.find().toArray();
      res.send(result);
    });

    app.get("/instructors/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const result = await instructorCollection.findOne(filter);
      const emailFilter = { instructorEmail: result.instructorEmail };
      const classesResult = await courseCollection.find(emailFilter).toArray();
      console.log(classesResult);
      res.send({ result, classesResult });
    });

    app.get("/instructors/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const filter = { instructorEmail: email };
      const result = await courseCollection.find(filter).toArray();
      res.send(result);
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

app.listen(port, () => {
  console.log(`This Scuola server is running on port ${5000}`);
});
