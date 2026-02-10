const express = require("express");
const axios = require("axios");
const cors = require("cors");
const players = require("./players");

const app = express();
app.use(cors());

const FACEIT_API = "https://open.faceit.com/data/v4";
const API_KEY = "a68f9584-e988-4c48-a164-5fe3a2796bc2";

async function getPlayer(nickname) {
  const encoded = encodeURIComponent(nickname);

  const res = await axios.get(
    `${FACEIT_API}/players?nickname=${encoded}`,
    {
      headers: { Authorization: `Bearer ${API_KEY}` }
    }
  );

  const p = res.data;
  const cs2 = p.games?.cs2;

  if (!cs2) {
    throw new Error(`${nickname} does not have CS2`);
  }

  return {
    nickname: p.nickname,
    avatar: p.avatar || "https://via.placeholder.com/36",
    elo: cs2.faceit_elo,
    level: cs2.skill_level
  };
}

app.get("/leaderboard", async (req, res) => {
  const results = [];

  for (const name of players) {
    try {
      const player = await getPlayer(name);
      results.push(player);
    } catch (err) {
      console.warn("Skipping:", name, "-", err.message);
    }
  }

  results.sort((a, b) => b.elo - a.elo);
  res.json(results);
});

app.listen(3000, () =>
  console.log("✅ Backend running on http://localhost:3000")
);
