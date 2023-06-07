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

app.listen(port, () => {
  console.log(`This Scuola server is running on port ${5000}`);
});
