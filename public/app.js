/* Matrix Leaderboard (fresh rebuild) */
const $ = (id) => document.getElementById(id);

const els = {
  rows: $("rows"),
  status: $("status"),
  search: $("search"),
  count: $("count"),
  updated: $("updated"),
  refreshBtn: $("refreshBtn")
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

function render(players) {
  const q = (els.search.value || "").trim().toLowerCase();
  const filtered = q
    ? players.filter((p) => (p.nickname || "").toLowerCase().includes(q))
    : players;

  els.count.textContent = `${filtered.length} player${filtered.length === 1 ? "" : "s"}`;
  els.updated.textContent = `Updated ${fmtTime(lastUpdatedAt)}`;

  if (!filtered.length) {
    els.rows.innerHTML = `<div class="empty">No players found.</div>`;
    return;
  }

  const html = filtered
    .map((p, idx) => {
      const rank = idx + 1;
      const nick = safeText(p.nickname || "Unknown");
      const avatar = safeText(p.avatar || "");
      const lvl = p.level ?? "—";
      const elo = p.elo ?? "—";

      return `
        <div class="row" role="row">
          <div class="rank" role="cell">${rank}</div>
          <div class="player" role="cell">
            <img class="avatar" src="${avatar}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"/>
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

  els.rows.innerHTML = html;
}

async function load() {
  if (loading) return;
  loading = true;

  els.status.textContent = "Loading…";
  els.refreshBtn.disabled = true;

  try {
    const r = await fetch("/leaderboard", { cache: "no-store" });
    const data = await r.json();

    const players = Array.isArray(data) ? data : (data.players || []);
    lastUpdatedAt = data.updatedAt || new Date().toISOString();

    allPlayers = players.map((p) => ({
      nickname: p.nickname,
      avatar: p.avatar,
      level: p.level,
      elo: p.elo
    }));

    render(allPlayers);
    els.status.textContent = "";
  } catch (e) {
    els.status.textContent = "Failed to load leaderboard. Try Refresh.";
  } finally {
    els.refreshBtn.disabled = false;
    loading = false;
  }
}

els.search.addEventListener("input", () => render(allPlayers));
els.refreshBtn.addEventListener("click", load);

load();
setInterval(load, 30_000);
