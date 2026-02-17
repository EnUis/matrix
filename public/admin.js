/* Matrix Admin (fresh rebuild) */
const $ = (id) => document.getElementById(id);

const els = {
  loginView: $("loginView"),
  appView: $("appView"),
  password: $("password"),
  loginBtn: $("loginBtn"),
  loginStatus: $("loginStatus"),
  logoutBtn: $("logoutBtn"),

  addInput: $("addInput"),
  addBtn: $("addBtn"),
  list: $("list"),
  appStatus: $("appStatus")
};

async function api(path, opts = {}) {
  const r = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...opts
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data?.error || "Request failed"), { data, status: r.status });
  return data;
}

function setView(loggedIn) {
  els.loginView.style.display = loggedIn ? "none" : "";
  els.appView.style.display = loggedIn ? "" : "none";
  els.logoutBtn.style.display = loggedIn ? "" : "none";
}

function rowHtml(p) {
  const nick = String(p.nickname || "Unknown");
  const avatar = String(p.avatar || "");
  const lvl = p.level ?? "—";
  const elo = p.elo ?? "—";

  return `
    <div class="item">
      <div class="pwrap">
        <img class="avatar" src="${avatar}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"/>
        <div class="nick" title="${nick}">${nick}</div>
      </div>
      <div class="right"><span class="badge badge--lvl">LVL ${lvl}</span></div>
      <div class="right elo">${elo}</div>
      <div class="right">
        <button class="smallbtn smallbtn--danger" data-remove="${p.id}">Remove</button>
      </div>
    </div>
  `;
}

async function loadList() {
  els.appStatus.textContent = "Loading…";
  try {
    const list = await api("/admin/list");
    els.list.innerHTML = list.map(rowHtml).join("") || `<div class="empty">No players yet.</div>`;
    els.appStatus.textContent = "";
  } catch (e) {
    els.appStatus.textContent = e.data?.error || "Failed to load.";
  }
}

async function login() {
  els.loginStatus.textContent = " ";
  const password = (els.password.value || "").trim();
  if (!password) {
    els.loginStatus.textContent = "Enter a password.";
    return;
  }
  els.loginBtn.disabled = true;
  try {
    await api("/admin/login", { method: "POST", body: JSON.stringify({ password }) });
    setView(true);
    await loadList();
  } catch (e) {
    els.loginStatus.textContent = "Login failed.";
  } finally {
    els.loginBtn.disabled = false;
  }
}

async function logout() {
  try { await api("/admin/logout", { method: "POST", body: "{}" }); } catch {}
  setView(false);
}

async function addPlayer() {
  els.appStatus.textContent = " ";
  const input = (els.addInput.value || "").trim();
  if (!input) return;
  els.addBtn.disabled = true;
  try {
    await api("/admin/add", { method: "POST", body: JSON.stringify({ input }) });
    els.addInput.value = "";
    await loadList();
    els.appStatus.textContent = "Added.";
    setTimeout(() => (els.appStatus.textContent = ""), 1500);
  } catch (e) {
    els.appStatus.textContent = e.data?.error || "Failed to add.";
  } finally {
    els.addBtn.disabled = false;
  }
}

els.loginBtn.addEventListener("click", login);
els.password.addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });

els.logoutBtn.addEventListener("click", logout);

els.addBtn.addEventListener("click", addPlayer);
els.addInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addPlayer(); });

els.list.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-remove]");
  if (!btn) return;
  const id = btn.getAttribute("data-remove");
  if (!id) return;
  if (!confirm("Remove this player?")) return;
  btn.disabled = true;
  try {
    await api(`/admin/remove/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadList();
  } catch (err) {
    els.appStatus.textContent = "Failed to remove.";
  }
});

// Boot
(async function init(){
  try {
    const me = await api("/admin/me");
    setView(!!me.loggedIn);
    if (me.loggedIn) await loadList();
  } catch {
    setView(false);
  }
})();
