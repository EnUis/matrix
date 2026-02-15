const express = require("express");
const axios = require("axios");
const players = require("./players");
const path = require("path");

const app = express();

// Serve frontend files
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// FACEIT API
const FACEIT_API = "https://open.faceit.com/data/v4";
const API_KEY = process.env.FACEIT_API_KEY; // IMPORTANT: set in Render env variables

if (!API_KEY) {
  console.error("❌ FACEIT_API_KEY is not set in environment variables");
  process.exit(1);
}

// Leaderboard route
app.get("/leaderboard", async (req, res) => {
  try {
    const requests = players.map((playerId) =>
      axios.get(`${FACEIT_API}/players/${playerId}`, {
        headers: { Authorization: `Bearer ${API_KEY}` }
      }).catch(err => {
        console.warn("Skipping:", playerId);
        return null;
      })
    );

    const responses = await Promise.all(requests);

    const results = responses
      .filter(r => r && r.data)
      .map(r => {
        const p = r.data;
        const cs2 = p.games?.cs2;

        if (!cs2) return null;

        return {
          nickname: p.nickname, // always latest name
          avatar: p.avatar || "https://via.placeholder.com/36",
          elo: cs2.faceit_elo,
          level: cs2.skill_level
        };
      })
      .filter(Boolean);

    results.sort((a, b) => b.elo - a.elo);

    res.json(results);

  } catch (error) {
    console.error("Leaderboard error:", error.message);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

// Port for Render / Railway
const PORT = process.env.PORT || 3000;

app.listen(PORT, () =>
  console.log(`✅ Backend running on port ${PORT}`)
);
