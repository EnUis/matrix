/* Matrix Admin UI v2 */

let allPlayers = [];

const $ = (id) => document.getElementById(id);

function toast(title, body = "") {
  const t = $("toast");
  if (!t) return;
  $("toastTitle").textContent = title;
  $("toastBody").textContent = body;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

async function api(url, opts = {}) {
  const res = await fetch(url, { credentials: "same-origin", ...opts });
  let data = null;
  try { data = await res.json(); } catch {}
  return { res, data };
}

async function loadHealth() {
  const pill = $("healthPill");
  if (!pill) return;

  const { res, data } = await api("/health");
  if (!res.ok) {
    pill.textContent = "Server: error";
    pill.classList.add("bad");
    return;
  }

  const apiState = data?.hasApiKey ? "API OK" : "API missing";
  pill.textContent = `DB: ${data?.playerCount ?? "?"} players • ${apiState}`;
  pill.classList.toggle("bad", !data?.hasApiKey);
  pill.classList.toggle("good", !!data?.hasApiKey);
}

async function checkSession() {
  const { data } = await api("/admin/me");
  const loggedIn = !!data?.loggedIn;

  $("loginView").style.display = loggedIn ? "none" : "block";
  $("panelView").style.display = loggedIn ? "block" : "none";
  $("logoutBtn").style.display = loggedIn ? "inline-flex" : "none";

  if (loggedIn) load();
}

async function login() {
  $("loginMsg").textContent = "";
  const password = $("pass").value;

  const { res, data } = await api("/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });

  if (!res.ok) {
    $("loginMsg").textContent = data?.error || "Login failed";
    return;
  }

  $("pass").value = "";
  toast("Logged in", "Welcome to the admin panel.");
  await checkSession();
}

async function logout() {
  await api("/admin/logout", { method: "POST" });
  location.reload();
}

function setPreview(p) {
  $("prevAv").src = p?.avatar || "";
  $("prevName").textContent = p?.nickname || "Not found";
  $("prevElo").textContent = "ELO: " + (p?.elo ?? "-");
  $("prevLvl").textContent = "LVL: " + (p?.level ?? "-");
  $("prevId").textContent = "ID: " + (p?.playerId ?? "-");
}

async function lookup() {
  $("addMsg").textContent = "";
  $("addOk").textContent = "";
  const nickname = $("nick").value.trim();
  if (!nickname) {
    $("addMsg").textContent = "Type a nickname first.";
    return;
  }

  const { res, data } = await api("/admin/lookup?nickname=" + encodeURIComponent(nickname));
  if (!res.ok) {
    setPreview(null);
    $("addMsg").textContent = (data?.error || "Lookup failed");
    return;
  }
  setPreview(data);
  toast("Preview loaded", data?.nickname ? `Found ${data.nickname}` : "");
}

async function add() {
  $("addMsg").textContent = "";
  $("addOk").textContent = "";

  const nickname = $("nick").value.trim();
  if (!nickname) {
    $("addMsg").textContent = "Type a nickname first.";
    return;
  }

  const { res, data } = await api("/admin/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: nickname })
  });

  if (!res.ok) {
    $("addMsg").textContent = (data?.error || "Add failed");
    return;
  }

  $("addOk").textContent = "✅ Added! Player ID: " + data.playerId;
  toast("Player added", data.playerId);
  $("nick").value = "";
  setPreview(null);
  await load();
}

async function removePlayer(id) {
  if (!confirm("Remove this player from leaderboard?")) return;
  const { res, data } = await api("/admin/remove/" + encodeURIComponent(id), { method: "DELETE" });

  if (!res.ok) {
    toast("Remove failed", data?.error || "Unknown error");
    return;
  }
  toast("Removed", id);
  await load();
}

async function load() {
  const { res, data } = await api("/admin/list");
  if (res.status === 401) return location.reload();

  allPlayers = Array.isArray(data) ? data : [];
  renderFiltered();
}

function copyText(t) {
  navigator.clipboard?.writeText(t).then(() => toast("Copied", t)).catch(() => {});
}

function renderFiltered() {
  const q = $("filter").value.trim().toLowerCase();
  const filtered = allPlayers.filter(p =>
    (p.nickname || "").toLowerCase().includes(q) ||
    (p.id || "").toLowerCase().includes(q)
  );

  $("countText").textContent = `${filtered.length} / ${allPlayers.length} players`;

  const list = $("list");
  list.innerHTML = "";

  filtered.forEach(p => {
    const div = document.createElement("div");
    div.className = "player";

    div.innerHTML = `
      <div class="p-left">
        <img class="avatar" src="${p.avatar || ""}" alt="" />
        <div style="min-width:0;">
          <div class="p-name" title="${p.nickname || ""}">${p.nickname || "(unknown)"}</div>
          <div class="p-meta">
            <span class="pill">ELO: ${p.elo ?? "-"}</span>
            <span class="pill">LVL: ${p.level ?? "-"}</span>
            <button class="btn ghost small" type="button" data-copy="${p.id}">Copy ID</button>
          </div>
        </div>
      </div>
      <button class="btn danger" type="button" data-remove="${p.id}">REMOVE</button>
    `;

    list.appendChild(div);
  });

  // delegate button events
  list.querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", () => removePlayer(btn.getAttribute("data-remove")));
  });
  list.querySelectorAll("[data-copy]").forEach(btn => {
    btn.addEventListener("click", () => copyText(btn.getAttribute("data-copy")));
  });
}

function wireAdminEvents() {
  $("pass")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });

  $("nick")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") lookup();
  });

  $("filter")?.addEventListener("input", renderFiltered);

  $("loginBtn")?.addEventListener("click", login);
  $("logoutBtn")?.addEventListener("click", logout);
  $("lookupBtn")?.addEventListener("click", lookup);
  $("addBtn")?.addEventListener("click", add);
  $("refreshBtn")?.addEventListener("click", load);
}

loadHealth();
wireAdminEvents();
checkSession();
