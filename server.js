const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const session = require("express-session");

const app = express();
app.use(express.json());

// ================= CONFIG =================

const FACEIT_API = "https://open.faceit.com/data/v4";
const API_KEY = process.env.FACEIT_API_KEY;
const ADMIN_PASSWORD = "MatrixAdmin123"; // change this

// ================= SESSION =================

app.use(
  session({
    secret: "matrix_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // true only if using https
  })
);

// ================= STATIC =================

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// ================= AUTH CHECK =================

function requireAuth(req, res, next) {
  if (!req.session.admin) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ================= LOGIN =================

app.post("/admin/login", (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    req.session.admin = true;
    return res.json({ success: true });
  }

  res.status(401).json({ error: "Wrong password" });
});

// ================= LOGOUT =================

app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// ================= LEADERBOARD =================

app.get("/leaderboard", async (req, res) => {
  const players = require("./players");
  const results = [];

  for (const playerId of players) {
    try {
      const response = await axios.get(
        `${FACEIT_API}/players/${playerId}`,
        { headers: { Authorization: `Bearer ${API_KEY}` } }
      );

      const p = response.data;
      const cs2 = p.games?.cs2;
      if (!cs2) continue;

      results.push({
        id: playerId,
        nickname: p.nickname,
        avatar: p.avatar,
        elo: cs2.faceit_elo,
        level: cs2.skill_level
      });
    } catch {}
  }

  results.sort((a, b) => b.elo - a.elo);
  res.json(results);
});

// ================= ADMIN ROUTES =================

app.get("/admin/list", requireAuth, async (req, res) => {
  const players = require("./players");
  const list = [];

  for (const playerId of players) {
    try {
      const response = await axios.get(
        `${FACEIT_API}/players/${playerId}`,
        { headers: { Authorization: `Bearer ${API_KEY}` } }
      );

      const p = response.data;
      const cs2 = p.games?.cs2;

      list.push({
        id: playerId,
        nickname: p.nickname,
        elo: cs2?.faceit_elo,
        level: cs2?.skill_level
      });
    } catch {}
  }

  res.json(list);
});

app.post("/admin/add", requireAuth, async (req, res) => {
  const { nickname } = req.body;
  if (!nickname) return res.status(400).json({ error: "Nickname required" });

  try {
    const response = await axios.get(
      `${FACEIT_API}/players?nickname=${encodeURIComponent(nickname)}`,
      { headers: { Authorization: `Bearer ${API_KEY}` } }
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
    res.status(400).json({ error: "Player not found" });
  }
});

app.delete("/admin/remove/:id", requireAuth, (req, res) => {
  const playerId = req.params.id;
  const players = require("./players");

  const updated = players.filter(id => id !== playerId);

  fs.writeFileSync(
    "./players.js",
    "module.exports = " + JSON.stringify(updated, null, 2)
  );

  res.json({ success: true });
});

// ================= START =================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🔥 Matrix Server running on port ${PORT}`)
);