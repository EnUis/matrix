const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const session = require("express-session");

const app = express();
app.use(express.json());

// ============================
// CONFIG
// ============================
const FACEIT_API = "https://open.faceit.com/data/v4";

// ✅ Put your key in env:
// Render: Environment -> FACEIT_API_KEY
// Local (PowerShell): setx FACEIT_API_KEY "YOURKEY"
const API_KEY = process.env.FACEIT_API_KEY;

// ✅ Change this password
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "MatrixAdmin123";

// ============================
// SESSION (PRO AUTH)
// ============================
app.use(
  session({
    name: "matrix_admin",
    secret: process.env.SESSION_SECRET || "matrix_super_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,      // set true ONLY if you use HTTPS + trust proxy
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 12 // 12 hours
    }
  })
);

// If hosting behind proxy (Render), you can enable these when you switch secure true:
// app.set("trust proxy", 1);

function requireAuth(req, res, next) {
  if (!req.session?.admin) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function ensureApiKey(res) {
  if (!API_KEY) {
    res.status(500).json({
      error: "FACEIT_API_KEY missing",
      hint: "Set FACEIT_API_KEY in environment variables and restart the server."
    });
    return false;
  }
  return true;
}

// ============================
// PLAYERS FILE HELPERS
// ============================
function loadPlayersFresh() {
  const filePath = path.join(__dirname, "players.js");
  delete require.cache[require.resolve(filePath)];
  const arr = require(filePath);
  return Array.isArray(arr) ? arr : [];
}

function savePlayers(arr) {
  const clean = Array.from(new Set(arr.map(String)));
  fs.writeFileSync(
    path.join(__dirname, "players.js"),
    "module.exports = " + JSON.stringify(clean, null, 2) + ";\n",
    "utf8"
  );
}

// ============================
// STATIC
// ============================
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// ============================
// AUTH ROUTES
// ============================
app.post("/admin/login", (req, res) => {
  const password = String(req.body?.password || "");
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Wrong password" });

  req.session.admin = true;
  res.json({ success: true });
});

app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get("/admin/me", (req, res) => {
  res.json({ loggedIn: !!req.session?.admin });
});

// ============================
// LEADERBOARD (ID-BASED)
// ============================
app.get("/leaderboard", async (req, res) => {
  if (!ensureApiKey(res)) return;

  const players = loadPlayersFresh();
  const results = [];

  for (const playerId of players) {
    try {
      const r = await axios.get(`${FACEIT_API}/players/${playerId}`, {
        headers: { Authorization: `Bearer ${API_KEY}` }
      });

      const p = r.data;
      const cs2 = p.games?.cs2;
      if (!cs2) continue;

      results.push({
        id: playerId,
        nickname: p.nickname,
        avatar: p.avatar || "https://via.placeholder.com/36",
        elo: cs2.faceit_elo,
        level: cs2.skill_level
      });
    } catch (err) {
      // skip silently
    }
  }

  results.sort((a, b) => b.elo - a.elo);
  res.json(results);
});

// ============================
// ADMIN: LIST PLAYERS
// ============================
app.get("/admin/list", requireAuth, async (req, res) => {
  if (!ensureApiKey(res)) return;

  const players = loadPlayersFresh();
  const list = [];

  for (const playerId of players) {
    try {
      const r = await axios.get(`${FACEIT_API}/players/${playerId}`, {
        headers: { Authorization: `Bearer ${API_KEY}` }
      });

      const p = r.data;
      const cs2 = p.games?.cs2;

      list.push({
        id: playerId,
        nickname: p.nickname,
        avatar: p.avatar || "",
        elo: cs2?.faceit_elo ?? null,
        level: cs2?.skill_level ?? null
      });
    } catch (err) {
      list.push({ id: playerId, nickname: "(failed to load)", avatar: "", elo: null, level: null });
    }
  }

  // sort by elo desc if available
  list.sort((a, b) => (b.elo ?? -1) - (a.elo ?? -1));
  res.json(list);
});

// ============================
// ADMIN: LOOKUP (PREVIEW) BY NICKNAME
// ============================
app.get("/admin/lookup", requireAuth, async (req, res) => {
  if (!ensureApiKey(res)) return;

  const nickname = String(req.query.nickname || "").trim();
  if (!nickname) return res.status(400).json({ error: "Nickname required" });

  try {
    const r = await axios.get(
      `${FACEIT_API}/players?nickname=${encodeURIComponent(nickname)}`,
      { headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    const p = r.data;
    const cs2 = p.games?.cs2;

    res.json({
      playerId: p.player_id,
      nickname: p.nickname,
      avatar: p.avatar || "",
      elo: cs2?.faceit_elo ?? null,
      level: cs2?.skill_level ?? null
    });
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.errors?.[0]?.message || err.message;
    res.status(400).json({ error: "Player not found", details: { status, msg } });
  }
});

// ============================
// ADMIN: ADD PLAYER (nickname -> ID)
// ============================
app.post("/admin/add", requireAuth, async (req, res) => {
  if (!ensureApiKey(res)) return;

  const nickname = String(req.body?.nickname || "").trim();
  if (!nickname) return res.status(400).json({ error: "Nickname required" });

  try {
    const r = await axios.get(
      `${FACEIT_API}/players?nickname=${encodeURIComponent(nickname)}`,
      { headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    const playerId = r.data.player_id;

    const players = loadPlayersFresh();
    if (!players.includes(playerId)) {
      players.push(playerId);
      savePlayers(players);
    }

    res.json({ success: true, playerId });
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.errors?.[0]?.message || err.message;
    res.status(400).json({ error: "FACEIT request failed", details: { status, msg } });
  }
});

// ============================
// ADMIN: REMOVE PLAYER
// ============================
app.delete("/admin/remove/:id", requireAuth, (req, res) => {
  const playerId = String(req.params.id);
  const players = loadPlayersFresh();

  const updated = players.filter((id) => id !== playerId);
  savePlayers(updated);

  res.json({ success: true });
});

// ============================
// START
// ============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));