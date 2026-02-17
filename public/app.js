/* Matrix Leaderboard UI */

const els = {
  status: document.getElementById("status"),
  updatedAt: document.getElementById("updatedAt"),
  countPill: document.getElementById("countPill"),
  board: document.getElementById("board"),
  podiumWrap: document.getElementById("podiumWrap"),
  podium: document.getElementById("podium"),
  search: document.getElementById("search"),
  sort: document.getElementById("sort"),
  level: document.getElementById("level"),
  refreshBtn: document.getElementById("refreshBtn")
};

const state = {
  players: [],
  updatedAt: null,
  loading: false,
  lastError: null
};

// Persist UI preferences
const STORAGE_KEY = "matrix_lb_prefs_v2";
function loadPrefs(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {}; }catch{ return {}; }
}
function savePrefs(partial){
  const cur = loadPrefs();
  const next = { ...cur, ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function applyPrefs(){
  const p = loadPrefs();
  if (els.search && typeof p.q === "string") els.search.value = p.q;
  if (els.sort && typeof p.sort === "string") els.sort.value = p.sort;
  if (els.level && typeof p.level === "string") els.level.value = p.level;
}

function safeText(s) {
  return String(s ?? "");
}

function formatUpdatedAt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `Last update: ${d.toLocaleString()}`;
}

function computeEloRanks(players) {
  const byElo = [...players].sort((a, b) => (b.elo ?? -1) - (a.elo ?? -1));
  const rankById = new Map();
  byElo.forEach((p, i) => rankById.set(p.id, i + 1));
  return players.map((p) => ({ ...p, eloRank: rankById.get(p.id) || null }));
}

function compare(a, b, mode) {
  const an = (a.nickname || "").toLowerCase();
  const bn = (b.nickname || "").toLowerCase();

  switch (mode) {
    case "elo_asc":
      return (a.elo ?? -1) - (b.elo ?? -1);
    case "name_asc":
      return an.localeCompare(bn);
    case "name_desc":
      return bn.localeCompare(an);
    case "level_desc":
      return (b.level ?? -1) - (a.level ?? -1);
    case "level_asc":
      return (a.level ?? -1) - (b.level ?? -1);
    case "elo_desc":
    default:
      return (b.elo ?? -1) - (a.elo ?? -1);
  }
}

function filteredAndSortedPlayers() {
  const q = (els.search?.value || "").trim().toLowerCase();
  const lvl = els.level?.value || "all";
  const sortMode = els.sort?.value || "elo_desc";

  let out = state.players;

  if (lvl !== "all") {
    const want = Number(lvl);
    out = out.filter((p) => Number(p.level) === want);
  }

  if (q) {
    out = out.filter((p) => {
      const name = (p.nickname || "").toLowerCase();
      const id = (p.id || "").toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }

  out = [...out].sort((a, b) => compare(a, b, sortMode));
  return { q, lvl, sortMode, out };
}

function medalLabel(rank) {
  if (rank === 1) return "CHAMP";
  if (rank === 2) return "2ND";
  if (rank === 3) return "3RD";
  return `#${rank}`;
}

function podiumCard(player) {
  const rank = player.eloRank || 0;

  const card = document.createElement("div");
  card.className = `pod-card ${rank === 1 ? "champ" : ""}`;

  card.innerHTML = `
    <div class="pod-top">
      <div class="badge">${medalLabel(rank)}</div>
      <div class="pill small">LVL ${safeText(player.level)}</div>
    </div>

    <div class="pod-player">
      <img src="${safeText(player.avatar)}" alt="" loading="lazy" />
      <div class="pod-meta">
        <div class="pname" title="${safeText(player.nickname)}">${safeText(player.nickname)}</div>
        <div class="muted small">ELO ${safeText(player.elo)}</div>
      </div>
    </div>
  `;

  return card;
}

function tableRow(player) {
  const tr = document.createElement("tr");

  const rank = player.eloRank ?? "-";

  tr.innerHTML = `
    <td class="col-rank"><span class="rank">${safeText(rank)}</span></td>
    <td>
      <div class="playerCell">
        <img src="${safeText(player.avatar)}" alt="" loading="lazy" />
        <div class="pwrap">
          <div class="pname" title="${safeText(player.nickname)}">${safeText(player.nickname)}</div>
          <div class="muted small mono" title="${safeText(player.id)}">${safeText(player.id)}</div>
        </div>
      </div>
    </td>
    <td class="right"><span class="pill small">LVL ${safeText(player.level)}</span></td>
    <td class="right"><span class="elo">${safeText(player.elo)}</span></td>
  `;

  return tr;
}

function renderSkeleton(rows = 10) {
  if (!els.board) return;
  els.board.innerHTML = "";
  for (let i = 0; i < rows; i++) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-rank"><div class="skel" style="height:14px; width:32px;"></div></td>
      <td>
        <div class="playerCell">
          <div class="skel" style="height:44px; width:44px;"></div>
          <div style="flex:1; min-width:0;">
            <div class="skel" style="height:14px; width:48%; margin-bottom:8px;"></div>
            <div class="skel" style="height:12px; width:72%;"></div>
          </div>
        </div>
      </td>
      <td class="right"><div class="skel" style="height:14px; width:70px; margin-left:auto;"></div></td>
      <td class="right"><div class="skel" style="height:14px; width:70px; margin-left:auto;"></div></td>
    `;
    els.board.appendChild(tr);
  }
}
function render() {
  if (!els.board) return;

  // meta
  const { q, lvl, sortMode, out } = filteredAndSortedPlayers();

  const total = state.players.length;
  const filtered = out.length;
  els.countPill.textContent = q || (lvl !== "all") ? `${filtered} / ${total} players` : `${total} players`;
  els.countPill.classList.toggle("bad", !!state.lastError);
  els.countPill.classList.toggle("good", !state.lastError);
  els.updatedAt.textContent = formatUpdatedAt(state.updatedAt);

  // podium only when "normal view"
  const showPodium = !q && lvl === "all" && sortMode === "elo_desc" && out.length >= 3;
  els.podiumWrap.style.display = showPodium ? "block" : "none";

  if (showPodium) {
    els.podium.innerHTML = "";
    const top3 = out.slice(0, 3);
    top3.forEach((p) => els.podium.appendChild(podiumCard(p)));
  }

  // table
  const list = showPodium ? out.slice(3) : out;

  els.board.innerHTML = "";
  const frag = document.createDocumentFragment();

  if (!list.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="empty">No players found.</td>`;
    frag.appendChild(tr);
  } else {
    list.forEach((p) => frag.appendChild(tableRow(p)));
  }

  els.board.appendChild(frag);
}

async function loadLeaderboard({ silent = false } = {}) {
  if (state.loading) return;
  state.loading = true;

  if (els.refreshBtn) {
    els.refreshBtn.disabled = true;
    els.refreshBtn.textContent = "Refreshing…";
  }

  if (!silent) {
    els.status.textContent = "Loading…";
    els.status.classList.remove("error");
    renderSkeleton(10);
  }

  try {
    const res = await fetch("/leaderboard", { cache: "no-store" });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = data?.error || "Failed to load leaderboard.";
      throw new Error(msg);
    }

    const rawPlayers = Array.isArray(data?.players) ? data.players : [];
    state.players = computeEloRanks(rawPlayers);
    state.updatedAt = data?.updatedAt || null;
    state.lastError = null;

    els.status.textContent = rawPlayers.length ? "" : "No players found (add players in Admin).";
    els.status.classList.remove("error");
    render();
  } catch (err) {
    state.lastError = err;
    els.status.textContent = `Error: ${err.message}`;
    els.status.classList.add("error");
    // keep previous render if any
  } finally {
    state.loading = false;
    if (els.refreshBtn) {
      els.refreshBtn.disabled = false;
      els.refreshBtn.textContent = "Refresh";
    }
  }
}

function wireEvents() {
  if (els.search) els.search.addEventListener("input", () => { savePrefs({ q: els.search.value }); render(); });
  if (els.sort) els.sort.addEventListener("change", () => { savePrefs({ sort: els.sort.value }); render(); });
  if (els.level) els.level.addEventListener("change", () => { savePrefs({ level: els.level.value }); render(); });

  if (els.refreshBtn) {
    els.refreshBtn.addEventListener("click", () => loadLeaderboard({ silent: false }));
  }

  // refresh when tab refocuses (nice on TV screens)
  window.addEventListener("focus", () => loadLeaderboard({ silent: true }));
}

applyPrefs();
wireEvents();
loadLeaderboard({ silent: false });

// Auto-refresh every 30 seconds
setInterval(() => loadLeaderboard({ silent: true }), 30_000);
