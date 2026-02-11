const express = require("express");
const axios = require("axios");
const cors = require("cors");
const players = require("./players");

const app = express();
app.use(cors());
app.use(express.static("frontend")); // serve frontend files

const FACEIT_API = "https://open.faceit.com/data/v4";
const API_KEY = "a68f9584-e988-4c48-a164-5fe3a2796bc2";

// API logic here...
app.get("/leaderboard", async (req, res) => {
  // fetch and return leaderboard
});

// Serve index.html at root
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/frontend/index.html");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Backend running on port ${PORT}`)
);
