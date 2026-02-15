const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// ============================
// ⚙ CONFIG
// ============================

const FACEIT_API = "https://open.faceit.com/data/v4";
const API_KEY = process.env.FACEIT_API_KEY; // set this in Render
const ADMIN_PASSWORD = "MatrixAdmin123"; // change this

// ============================
// 📂 STATIC FILES
// ============================

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// ============================
// 🔐 ADMIN AUTH MIDDLEWARE
// ============================

app.use("/admin", (req, res, next) => {
  const password = req.headers["x-admin-password"];

  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  next();
});

// ============================
// 🏆 LEADERBOARD (ID BASED)
// ============================

app.get("/leaderboard", async (req, res) => {
  const players = require("./players");
  const results = [];

  for (const playerId of players) {
    try {
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
        nickname: p.nickname,
        avatar: p.avatar || "https://via.placeholder.com/36",
        elo: cs2.faceit_elo,
        level: cs2.skill_level
      });
    } catch (err) {
      console.log("Error loading:", playerId);
    }
  }

  results.sort((a, b) => b.elo - a.elo);
  res.json(results);
});

// ============================
// ➕ ADD PLAYER
// ============================

app.post("/admin/add-player", async (req, res) => {
  const { nickname } = req.body;

  if (!nickname)
    return res.status(400).json({ error: "Nickname required" });

  try {
    const response = await axios.get(
      `${FACEIT_API}/players?nickname=${encodeURIComponent(nickname)}`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` }
      }
    );

    const playerId = response.data.player_id;
    const players = require("./players");

    if (!players.includes(playerId)) {
      players.push(playerId);

      fs.writeFileSync(
        "./players.js",
        "module.exports = " + JSON.stringify(players, null, 2)
      );
    }

    res.json({ success: true });
  } catch {
    res.status(400).json({ error: "Player not found on Faceit" });
  }
});

// ============================
// ❌ REMOVE PLAYER
// ============================

app.delete("/admin/remove-player/:id", (req, res) => {
  const playerId = req.params.id;
  const players = require("./players");

  const updated = players.filter(id => id !== playerId);

  fs.writeFileSync(
    "./players.js",
    "module.exports = " + JSON.stringify(updated, null, 2)
  );

  res.json({ success: true });
});

// ============================
// 📋 LIST PLAYERS
// ============================

app.get("/admin/list-players", async (req, res) => {
  const players = require("./players");
  const list = [];

  for (const playerId of players) {
    try {
      const response = await axios.get(
        `${FACEIT_API}/players/${playerId}`,
        {
          headers: { Authorization: `Bearer ${API_KEY}` }
        }
      );

      list.push({
        id: playerId,
        nickname: response.data.nickname
      });
    } catch {}
  }

  res.json(list);
});

// ============================
// 🚀 START SERVER
// ============================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);
