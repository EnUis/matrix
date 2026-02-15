const express = require("express");
const axios = require("axios");
const players = require("./players");
const path = require("path");
const fs = require("fs");

const app = express();

// ✅ VERY IMPORTANT (needed for POST requests)
app.use(express.json());

// Serve frontend files from "public" folder
app.use(express.static(path.join(__dirname, "public")));

// Serve index.html at root
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// Faceit API setup
const FACEIT_API = "https://open.faceit.com/data/v4";
const API_KEY = "a68f9584-e988-4c48-a164-5fe3a2796bc2";

// ============================
// 🏆 LEADERBOARD (ID BASED)
// ============================
app.get("/leaderboard", async (req, res) => {
  const results = [];

  for (const playerId of players) {
    try {
      // ✅ NOW USING PLAYER ID INSTEAD OF NICKNAME
      const response = await axios.get(
        `${FACEIT_API}/players/${playerId}`,
        {
          headers: { Authorization: `Bearer ${API_KEY}` }
        }
      );

      const p = response.data;
      const cs2 = p.games?.cs2;
      if (!cs2) continue;

      results.push({
        nickname: p.nickname, // nickname auto-updates if changed
        avatar: p.avatar || "https://via.placeholder.com/36",
        elo: cs2.faceit_elo,
        level: cs2.skill_level
      });
    } catch (err) {
      console.warn("Skipping:", playerId, "-", err.message);
    }
  }

  // Sort by ELO descending
  results.sort((a, b) => b.elo - a.elo);
  res.json(results);
});

// ============================
// 🔐 ADMIN ADD PLAYER
// ============================
app.post("/admin/add-player", async (req, res) => {
  const { nickname } = req.body;

  if (!nickname) {
    return res.status(400).json({ error: "Nickname is required" });
  }

  try {
    // 1️⃣ Get player data by nickname
    const response = await axios.get(
      `${FACEIT_API}/players?nickname=${encodeURIComponent(nickname)}`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` }
      }
    );

    const playerId = response.data.player_id;

    // 2️⃣ Load current players list
    const currentPlayers = require("./players");

    // 3️⃣ Prevent duplicates
    if (!currentPlayers.includes(playerId)) {
      currentPlayers.push(playerId);

      // 4️⃣ Rewrite players.js with IDs
      fs.writeFileSync(
        "./players.js",
        "module.exports = " + JSON.stringify(currentPlayers, null, 2)
      );
    }

    res.json({ success: true, playerId });
  } catch (err) {
    res.status(400).json({ error: "Player not found on Faceit" });
  }
});

// Dynamic port for Render or fallback to 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Backend running on port ${PORT}`)
);