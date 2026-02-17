require("dotenv").config();

// Fix for some networks/DNS providers that block SRV lookups used by mongodb+srv://
// You can override with DNS_SERVERS="x.x.x.x,y.y.y.y" in .env if needed.
const dns = require("dns");
try {
  const dnsServers = (process.env.DNS_SERVERS || "1.1.1.1,8.8.8.8")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (dnsServers.length) dns.setServers(dnsServers);
} catch (e) {
  // ignore
}


const express = require("express");
const axios = require("axios");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================
// CONFIG
// ============================
const FACEIT_API = "https://open.faceit.com/data/v4";
const API_KEY = process.env.FACEIT_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS || "MatrixAdmin123").trim();
const SESSION_SECRET = process.env.SESSION_SECRET || "change_this_session_secret";

// caching / perf
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 25_000); // player profile cache TTL
const CONCURRENCY = Math.max(1, Math.min(10, Number(process.env.FACEIT_CONCURRENCY || 5)));

// ============================
// DB MODEL
// ============================
const playerSchema = new mongoose.Schema(
  {
    playerId: { type: String, required: true, unique: true, index: true },
    addedNickname: { type: String, default: null }
  },
  { timestamps: true }
);
const Player = mongoose.model("Player", playerSchema);

function requireApiKey(res) {
  if (!API_KEY) {
    res.status(500).json({
      error: "FACEIT_API_KEY missing",
      hint: "Create an API key on FACEIT and set FACEIT_API_KEY in your .env / environment variables."
    });
    return false;
  }
  return true;
}

function requireAuth(req, res, next) {
  if (!req.session?.admin) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function isUuidLike(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// ============================
// FACEIT CACHE + CONCURRENCY
// ============================
const playerCache = new Map(); // playerId -> { ts, payload }

async function fetchFaceitPlayerById(playerId) {
  const now = Date.now();
  const cached = playerCache.get(playerId);
  if (cached && now - cached.ts < CACHE_TTL_MS) return cached.payload;

  const r = await axios.get(`${FACEIT_API}/players/${playerId}`, {
    headers: { Authorization: `Bearer ${API_KEY}` }
  });

  playerCache.set(playerId, { ts: now, payload: r.data });
  return r.data;
}

async function fetchFaceitPlayerByNickname(nickname) {
  const r = await axios.get(
    `${FACEIT_API}/players?nickname=${encodeURIComponent(nickname)}`,
    { headers: { Authorization: `Bearer ${API_KEY}` } }
  );
  return r.data;
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runOne() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      try {
        results[i] = await worker(items[i], i);
      } catch (e) {
        results[i] = { __error: true, error: e };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, runOne);
  await Promise.all(workers);
  return results;
}

function normalizeLeaderboardEntry(playerId, p) {
  const cs2 = p.games?.cs2;
  if (!cs2) return null;

  return {
    id: playerId,
    nickname: p.nickname,
    avatar: p.avatar || "https://via.placeholder.com/64",
    elo: cs2.faceit_elo,
    level: cs2.skill_level
  };
}

// ============================
// STARTUP
// ============================
async function start() {
  if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI missing");
    console.error("   Tip: Use MongoDB Atlas (free) or local MongoDB and set MONGODB_URI in env vars.");
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
  app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
  app.get("/admin", (req, res) => res.redirect("/admin.html"));

  // ============================
  // HEALTH
  // ============================
  app.get("/health", async (_req, res) => {
    const count = await Player.countDocuments();
    res.json({
      ok: true,
      db: "mongo",
      playerCount: count,
      cacheTtlMs: CACHE_TTL_MS,
      concurrency: CONCURRENCY,
      hasApiKey: !!API_KEY
    });
  });

  // ============================
  // ADMIN CONFIG (no secrets)
  // ============================
  app.get("/admin/config", (_req, res) => {
    res.json({
      hasAdminPassword: !!process.env.ADMIN_PASSWORD || !!process.env.ADMIN_PASS,
      sessionCookie: "matrix_admin",
      sessionMaxAgeHours: 12
    });
  });

  // ============================
  // AUTH ROUTES (admin.html)
  // ============================
  app.get("/admin/me", (req, res) => res.json({ loggedIn: !!req.session?.admin }));

  app.post("/admin/login", (req, res) => {
    const password = String(req.body?.password || "").trim();
    if (!password || password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Login failed" });

    req.session.admin = true;
    res.json({ success: true });
  });

  app.post("/admin/logout", (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
  });

  // ============================
  // LEADERBOARD (READ IDs FROM DB)
  // returns: { updatedAt, players: [...] }
  // ============================
  app.get("/leaderboard", async (req, res) => {
    if (!requireApiKey(res)) return;

    const rows = await Player.find({}, { playerId: 1, _id: 0 }).lean();
    const ids = [...new Set(rows.map((r) => r.playerId).filter(Boolean))];

    const fetched = await mapWithConcurrency(ids, CONCURRENCY, async (playerId) => {
      const p = await fetchFaceitPlayerById(playerId);
      return normalizeLeaderboardEntry(playerId, p);
    });

    const players = fetched.filter((x) => x && !x.__error);
    players.sort((a, b) => (b.elo ?? -1) - (a.elo ?? -1));

    res.json({ updatedAt: new Date().toISOString(), players });
  });

  // ============================
  // ADMIN LIST
  // ============================
  app.get("/admin/list", requireAuth, async (req, res) => {
    if (!requireApiKey(res)) return;

    const rows = await Player.find({}, { playerId: 1, _id: 0 }).lean();
    const ids = [...new Set(rows.map((r) => r.playerId).filter(Boolean))];

    const fetched = await mapWithConcurrency(ids, CONCURRENCY, async (playerId) => {
      const p = await fetchFaceitPlayerById(playerId);
      const cs2 = p.games?.cs2;

      return {
        id: playerId,
        nickname: p.nickname,
        avatar: p.avatar || "",
        elo: cs2?.faceit_elo ?? null,
        level: cs2?.skill_level ?? null
      };
    });

    const list = fetched.filter((x) => x && !x.__error);
    list.sort((a, b) => (b.elo ?? -1) - (a.elo ?? -1));
    res.json(list);
  });

  // ============================
  // ADMIN LOOKUP PREVIEW (nickname -> basic info)
  // ============================
  app.get("/admin/lookup", requireAuth, async (req, res) => {
    if (!requireApiKey(res)) return;

    const nickname = String(req.query.nickname || "").trim();
    if (!nickname) return res.status(400).json({ error: "Nickname required" });

    try {
      const p = await fetchFaceitPlayerByNickname(nickname);
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
  // ADMIN ADD
  // Accepts:
  //  - { input: "nickname" } OR { nickname: "..." }
  //  - { input: "<playerId-uuid>" } OR { playerId: "..." }
  // ============================
  app.post("/admin/add", requireAuth, async (req, res) => {
    if (!requireApiKey(res)) return;

    const input = String(req.body?.input || req.body?.nickname || req.body?.playerId || "").trim();
    if (!input) return res.status(400).json({ error: "Nickname or playerId required" });

    try {
      let playerId = null;
      let addedNickname = null;

      if (isUuidLike(input)) {
        playerId = input;
        const p = await fetchFaceitPlayerById(playerId); // validate + cache
        addedNickname = p.nickname || null;
      } else {
        const p = await fetchFaceitPlayerByNickname(input);
        playerId = p.player_id;
        addedNickname = input;
      }

      await Player.updateOne(
        { playerId },
        { $setOnInsert: { playerId, addedNickname } },
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
  // ADMIN REMOVE
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