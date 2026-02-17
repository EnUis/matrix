/* Matrix Leaderboard (fresh rebuild) */
const $ = (id) => document.getElementById(id);

const els = {
  top3: $("top3"),
  rows: $("rows"),
  status: $("status"),
  search: $("search"),
  count: $("count"),
  updated: $("updated"),
  refreshBtn: $("refreshBtn"),
};

let allPlayers = [];
let lastUpdatedAt = null;
let loading = false;

function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function safeText(s) {
  return String(s ?? "").replace(/[\u0000-\u001F\u007F]/g, "");
}

function asNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function render(players) {
  const q = els.search ? (els.search.value || "").trim().toLowerCase() : "";

  const filtered = q
    ? players.filter((p) => (p.nickname || "").toLowerCase().includes(q))
    : players;

  if (els.count) els.count.textContent = `${filtered.length} player${filtered.length === 1 ? "" : "s"}`;
  if (els.updated) els.updated.textContent = `Updated ${fmtTime(lastUpdatedAt)}`;

  // Top 3 strip
  const top = filtered.slice(0, 3);
  if (els.top3) {
    els.top3.innerHTML = top.map((p, i) => {
      const rank = i + 1;
      const nick = safeText(p.nickname || "Unknown");
      const avatar = safeText(p.avatar || "");
      const lvl = p.level ?? "—";
      const elo = p.elo ?? "—";

      return `
        <div class="top3card" data-rank="${rank}">
          <div class="top3left">
            <div class="top3rank">#${rank}</div>
            ${avatar ? `<img class="top3avatar" src="${avatar}" alt="" loading="lazy" onerror="this.style.display='none'"/>` : ``}
            <div class="top3meta">
              <div class="top3name" title="${nick}">${nick}</div>
              <div class="top3sub">LVL ${lvl}</div>
            </div>
          </div>
          <div class="top3elo">
            <div class="num">${elo}</div>
            <div class="lab">ELO</div>
          </div>
        </div>
      `;
    }).join("");
  }

  if (!filtered.length) {
    els.rows.innerHTML = `<div class="empty">No players found.</div>`;
    return;
  }

  // Table rows start from #4 (since top 3 are separated)
  const rest = filtered.slice(3);

  const html = rest
    .map((p, idx) => {
      const rank = idx + 4;
      const nick = safeText(p.nickname || "Unknown");
      const avatar = safeText(p.avatar || "");
      const lvl = p.level ?? "—";
      const elo = p.elo ?? "—";

      return `
        <div class="row" role="row">
          <div class="rank" role="cell">${rank}</div>
          <div class="player" role="cell">
            ${avatar ? `<img class="avatar" src="${avatar}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"/>` : ``}
            <div class="nick" title="${nick}">${nick}</div>
          </div>
          <div class="right" role="cell">
            <span class="badge badge--lvl">LVL ${lvl}</span>
          </div>
          <div class="right elo" role="cell">${elo}</div>
        </div>
      `;
    })
    .join("");

  // If there are only 3 players, show a nice empty state below the top3
  els.rows.innerHTML = html || `<div class="empty">Only top 3 players in the list.</div>`;
}

async function load() {
  if (loading) return;
  loading = true;

  if (els.status) els.status.textContent = "Loading…";
  if (els.refreshBtn) els.refreshBtn.disabled = true;

  try {
    const r = await fetch("/leaderboard", { cache: "no-store" });
    const data = await r.json();

    const players = Array.isArray(data) ? data : (data.players || []);
    lastUpdatedAt = data.updatedAt || new Date().toISOString();

    allPlayers = players
      .map((p) => ({
        nickname: p.nickname,
        avatar: p.avatar,
        level: asNum(p.level),
        elo: asNum(p.elo),
      }))
      .sort((a, b) => b.elo - a.elo);

    render(allPlayers);
    if (els.status) els.status.textContent = "";
  } catch (e) {
    if (els.status) els.status.textContent = "Failed to load leaderboard. Try Refresh.";
  } finally {
    if (els.refreshBtn) els.refreshBtn.disabled = false;
    loading = false;
  }
}

if (els.search) els.search.addEventListener("input", () => render(allPlayers));
if (els.refreshBtn) els.refreshBtn.addEventListener("click", load);

load();
setInterval(load, 30_000);
