const express = require("express");
const axios = require("axios");
const players = require("./players");
const path = require("path");

const app = express();

// Serve frontend files from "public" folder
app.use(express.static(path.join(__dirname, "public")));

// Serve index.html at root
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// Faceit API setup
const FACEIT_API = "https://open.faceit.com/data/v4";
const API_KEY = "a68f9584-e988-4c48-a164-5fe3a2796bc2"; // your real key here

// Leaderboard API route
app.get("/leaderboard", async (req, res) => {
  const results = [];

  for (const name of players) {
    try {
      const encoded = encodeURIComponent(name);
      const response = await axios.get(`${FACEIT_API}/players?nickname=${encoded}`, {
        headers: { Authorization: `Bearer ${API_KEY}` }
      });

      const p = response.data;
      const cs2 = p.games?.cs2;
      if (!cs2) continue;

      results.push({
        nickname: p.nickname,
        avatar: p.avatar || "https://via.placeholder.com/36",
        elo: cs2.faceit_elo,
        level: cs2.skill_level
      });
    } catch (err) {
      console.warn("Skipping:", name, "-", err.message);
    }
  }

  // Sort by ELO descending
  results.sort((a, b) => b.elo - a.elo);
  res.json(results);
});

// Dynamic port for Render or fallback to 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
