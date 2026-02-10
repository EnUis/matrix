const board = document.getElementById("board");
const status = document.getElementById("status");

function medalClass(i) {
  if (i === 0) return "gold";
  if (i === 1) return "silver";
  if (i === 2) return "bronze";
  return "";
}

async function load() {
  try {
    status.textContent = "Loading leaderboard...";
    const res = await fetch("http://127.0.0.1:3000/leaderboard");
    const data = await res.json();

    board.innerHTML = "";

    if (!data.length) {
      status.textContent = "No players found.";
      return;
    }

    status.textContent = "";

    data.forEach((p, i) => {
      board.innerHTML += `
        <tr>
          <td class="rank ${medalClass(i)}">${i + 1}</td>
          <td>
            <div class="player">
              <img src="${p.avatar}" class="avatar">
              ${p.nickname}
            </div>
          </td>
          <td>
            <div class="level">LVL ${p.level}</div>
          </td>
          <td class="elo">${p.elo}</td>
        </tr>
      `;
    });
  } catch (e) {
    status.textContent = "Failed to load leaderboard.";
  }
}

load();
setInterval(load, 30000);
