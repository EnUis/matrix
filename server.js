const express = require("express");
const axios = require("axios");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");

const app = express();
app.use(express.json());

// ============================
// CONFIG
// ============================
const FACEIT_API = "https://open.faceit.com/data/v4";
const API_KEY = process.env.FACEIT_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "MatrixAdmin123";
const SESSION_SECRET = process.env.SESSION_SECRET || "change_this_session_secret";

// ============================
// DB MODEL
// ============================
const playerSchema = new mongoose.Schema(
  { playerId: { type: String, required: true, unique: true, index: true } },
  { timestamps: true }
);
const Player = mongoose.model("Player", playerSchema);

function ensureEnv(res) {
  if (!API_KEY) {
    res.status(500).json({
      error: "FACEIT_API_KEY missing",
      hint: "Set FACEIT_API_KEY in env vars and restart."
    });
    return false;
  }
  if (!MONGODB_URI) {
    res.status(500).json({
      error: "MONGODB_URI missing",
      hint: "Set MONGODB_URI in env vars and restart."
    });
    return false;
  }
  return true;
}

function requireAuth(req, res, next) {
  if (!req.session?.admin) return res.status(401).json({ error: "Unauthorized" });
  next();
}

async function start() {
  if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI missing");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  // ============================
  // SESSION STORED IN MONGO
  // ============================
  app.use(
    session({
      name: "matrix_admin",
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: MONGODB_URI }),
      cookie: {
        httpOnly: true,
        secure: false, // set true only if HTTPS and trust proxy
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 12
      }
    })
  );

  // ============================
  // STATIC
  // ============================
  app.use(express.static(path.join(__dirname, "public")));
  app.get("/", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "index.html"))
  );

  // ============================
  // AUTH ROUTES (for your admin.html)
  // ============================
  app.get("/admin/me", (req, res) => res.json({ loggedIn: !!req.session?.admin }));

  app.post("/admin/login", (req, res) => {
    const password = String(req.body?.password || "");
    if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Wrong password" });

    req.session.admin = true;
    res.json({ success: true });
  });

  app.post("/admin/logout", (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
  });

  // ============================
  // LEADERBOARD (READ IDs FROM DB)
  // ============================
  app.get("/leaderboard", async (req, res) => {
    if (!ensureEnv(res)) return;

    const ids = await Player.find({}, { playerId: 1, _id: 0 }).lean();
    const results = [];

    for (const row of ids) {
      const playerId = row.playerId;
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
      } catch {
        // skip
      }
    }

    results.sort((a, b) => b.elo - a.elo);
    res.json(results);
  });

  // ============================
  // ADMIN LIST (for your admin.html)
  // ============================
  app.get("/admin/list", requireAuth, async (req, res) => {
    if (!ensureEnv(res)) return;

    const ids = await Player.find({}, { playerId: 1, _id: 0 }).lean();
    const list = [];

    for (const row of ids) {
      const playerId = row.playerId;
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
      } catch {
        list.push({ id: playerId, nickname: "(failed to load)", avatar: "", elo: null, level: null });
      }
    }

    list.sort((a, b) => (b.elo ?? -1) - (a.elo ?? -1));
    res.json(list);
  });

  // ============================
  // ADMIN LOOKUP PREVIEW
  // ============================
  app.get("/admin/lookup", requireAuth, async (req, res) => {
    if (!ensureEnv(res)) return;

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
  // ADMIN ADD (stores into DB)
  // ============================
  app.post("/admin/add", requireAuth, async (req, res) => {
    if (!ensureEnv(res)) return;

    const nickname = String(req.body?.nickname || "").trim();
    if (!nickname) return res.status(400).json({ error: "Nickname required" });

    try {
      const r = await axios.get(
        `${FACEIT_API}/players?nickname=${encodeURIComponent(nickname)}`,
        { headers: { Authorization: `Bearer ${API_KEY}` } }
      );

      const playerId = r.data.player_id;

      await Player.updateOne(
        { playerId },
        { $setOnInsert: { playerId } },
        { upsert: true }
      );

      res.json({ success: true, playerId });
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.errors?.[0]?.message || err.message;
      res.status(400).json({ error: "FACEIT request failed", details: { status, msg } });
    }
  });

  // ============================
  // ADMIN REMOVE (deletes from DB)
  // ============================
  app.delete("/admin/remove/:id", requireAuth, async (req, res) => {
    const playerId = String(req.params.id || "").trim();
    if (!playerId) return res.status(400).json({ error: "Missing id" });

    await Player.deleteOne({ playerId });
    res.json({ success: true });
  });

  // ============================
  // START SERVER
  // ============================
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
}

start().catch((e) => {
  console.error("❌ Failed to start:", e);
  process.exit(1);
});