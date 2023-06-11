const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

const app = express();

// ! Middleware

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  // console.log(authorization);
  if (!authorization) {
    // console.log("authorization error");
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized Access" });
  }
  const token = authorization.split(" ")[1];
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
      if (error) {
        // console.log(error, "This is error");
        return res
          .status(403)
          .send({ error: true, message: "Unauthorized Access" });
      }
      req.decoded = decoded;
      next();
    });
  }
};

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

    const userCollection = client.db("scuolaDB").collection("users");
    const paymentCollection = client.db("scuolaDB").collection("payments");
    const selectedClassCollection = client
      .db("scuolaDB")
      .collection("selectedClasses");

    // ! JWT Token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1hr",
      });
      res.send({ token });
    });

    // ! Verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const filter = { email: email };
      const user = await userCollection.findOne(filter);
      if (user?.role !== "admin") {
        return res
          .status(401)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    // ! Courses APIs
    app.get("/popularCourses", async (req, res) => {
      const filter = { status: "approved" };
      const result = await courseCollection
        .find(filter)
        .sort({ totalStudents: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/courses", async (req, res) => {
      const filter = { status: "approved" };
      const result = await courseCollection.find(filter).toArray();
      res.send(result);
    });

    app.get("/allCourses/admin", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await courseCollection
        .find()
        .sort({ status: -1 })
        .toArray();
      res.send(result);
    });

    app.post("/courses/instructors", verifyJWT, async (req, res) => {
      const course = req.body;
      // console.log(course);
      const result = await courseCollection.insertOne(course);
      res.send(result);
    });

    app.get("/courses/instructors", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (req.decoded.email !== email) {
        res.status(401).send({ error: true, message: "unauthorized" });
      }
      const filter = { instructorEmail: email };
      const result = await courseCollection.find(filter).toArray();
      res.send(result);
    });

    app.get("/courses/instructors/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await courseCollection.findOne(filter);
      res.send(result);
    });

    app.patch("/courses/instructors/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedCourse = req.body;
      const update = {
        $set: {
          courseName: updatedCourse.courseName,
          image: updatedCourse.image,
          instructorName: updatedCourse.instructorName,
          instructorEmail: updatedCourse.instructorEmail,
          status: updatedCourse.status,
          availableSeats: updatedCourse.availableSeats,
          coursePrice: updatedCourse.coursePrice,
        },
      };
      const result = await courseCollection.updateMany(filter, update);
      res.send(result);
    });

    // ! Approve Class
    app.patch(
      "/courses/admin/approve/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const update = {
          $set: {
            status: "approved",
          },
        };
        const result = await courseCollection.updateOne(filter, update);
        res.send(result);
      }
    );

    // ! Deny Class
    app.patch(
      "/courses/admin/deny/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const update = {
          $set: {
            status: "denied",
          },
        };
        const result = await courseCollection.updateOne(filter, update);
        res.send(result);
      }
    );
    app.put(
      "/courses/admin/feedback/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const feedback = req.body;
        const filter = { _id: new ObjectId(id) };
        const update = {
          $set: {
            feedback: feedback.feedback,
          },
        };
        const options = { upsert: true };
        const result = await courseCollection.updateOne(
          filter,
          update,
          options
        );
        res.send(result);
      }
    );

    app.delete("/courses/instructors/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await courseCollection.deleteOne(filter);
      res.send(result);
    });

    // ! Instructor APIs

    app.get("/instructors", async (req, res) => {
      const filter = { role: "teacher" };
      const result = await userCollection.find(filter).toArray();
      res.send(result);
    });

    app.get("/popularInstructors", async (req, res) => {
      const filter = { role: "teacher" };
      const result = await userCollection
        .find(filter)
        .sort({ totalStudents: -1 })
        .limit(6)
        .toArray();

      res.send(result);
    });

    app.get("/instructors/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const result = await userCollection.findOne(filter);
      const emailFilter = { instructorEmail: result.email };
      const classesResult = await courseCollection.find(emailFilter).toArray();
      // console.log(classesResult);
      res.send({ result, classesResult });
    });

    app.get("/instructors/:email", async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      const filter = { instructorEmail: email };
      const result = await courseCollection.find(filter).toArray();
      res.send(result);
    });

    // ! User APIs

    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const isOldUser = await userCollection.findOne({ email: newUser.email });
      if (!isOldUser) {
        const result = await userCollection.insertOne(newUser);
        res.send(result);
      }
    });

    app.get("/users/admin", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }
      const filter = { email: email };
      const user = await userCollection.findOne(filter);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const update = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, update);
      res.send(result);
    });

    app.patch(
      "/users/admin/instructor/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const update = {
          $set: {
            role: "teacher",
          },
        };
        const result = await userCollection.updateOne(filter, update);
        res.send(result);
      }
    );

    app.delete("/users/admin/delete/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(filter);
      res.send(result);
    });

    // ! Selected Class APIs

    app.post("/selectedClasses", async (req, res) => {
      const selectedClass = req.body;
      const result = await selectedClassCollection.insertOne(selectedClass);
      res.send(result);
    });

    app.get("/selectedClasses", verifyJWT, async (req, res) => {
      const email = req.query.email;
      // console.log(email);

      if (!email) {
        // console.log("Email not found");
        res.send([]);
      }

      if (req.decoded.email !== email) {
        // console.log("error 405");
        return res.status(401).send({ error: true, message: "Unauthorized" });
      }
      const filter = { email: email };
      const result = await selectedClassCollection.find(filter).toArray();
      res.send(result);
    });

    app.delete("/selectedClasses/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.deleteOne(filter);
      res.send(result);
    });

    // ! Payment APIs

    app.post("/create_payment_intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      console.log(amount, price);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);
      const filter = {
        _id: { $in: payment.selectedCourseId.map((id) => new ObjectId(id)) },
      };

      const courseId = payment.courseId.map((item) => item);
      const query = { _id: { $in: courseId.map((id) => new ObjectId(id)) } };

      const update = {
        $inc: {
          availableSeats: -1,
          totalStudents: 1,
        },
      };
      const enrolledCourse = await courseCollection.updateMany(query, update);

      const deleteCourse = await selectedClassCollection.deleteMany(filter);
      res.send({ insertResult, deleteCourse });
    });

    app.get("/payments/classes", verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (email !== req.decoded.email) {
        res.send([]);
      }
      const filter = { buyerEmail: email };

      const paymentItems = await paymentCollection.find(filter).toArray();

      const items = paymentItems.map((item) => item.courseId);
      const ids = items.flat();
      console.log(ids);

      const query = { _id: { $in: ids.map((id) => new ObjectId(id)) } };
      const result = await courseCollection.find(query).toArray();
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
