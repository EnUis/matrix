const board = document.getElementById("board");
const status = document.getElementById("status");
const topThree = document.getElementById("topThree");

function medalClass(i) {
  if (i === 0) return "gold";
  if (i === 1) return "silver";
  if (i === 2) return "bronze";
  return "";
}

function createTopCard(player, rank) {
  const div = document.createElement("div");
  div.className = "top-card";
  div.innerHTML = `
    <div class="rank">#${rank}</div>
    <div class="player"><img src="${player.avatar}" class="avatar"> ${player.nickname}</div>
    <div class="meta"><span class="level">LVL ${player.level}</span> <span class="elo">${player.elo}</span></div>
  `;
  return div;
}

function loadLeaderboard() {
  if (!board || !status || !topThree) return;

  status.textContent = "Loading leaderboard...";

  const xhr = new XMLHttpRequest();
  xhr.open("GET", "/leaderboard", true);

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);

        board.innerHTML = "";
        topThree.innerHTML = "";

        if (!data.length) {
          status.textContent = "No players found.";
          return;
        }

        status.textContent = "";

        data.forEach((p, i) => {
          // First 3 players go to topThree cards
          if (i < 3) {
            topThree.appendChild(createTopCard(p, i + 1));
          } else {
            // Remaining players go to table
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
          }
        });
      } else {
        status.textContent = "Failed to load leaderboard.";
      }
    }
  };

  xhr.onerror = function () {
    status.textContent = "Network error. Could not load leaderboard.";
  };

  xhr.send();
}

// Initial load and auto-refresh every 30 seconds
window.onload = loadLeaderboard;
setInterval(loadLeaderboard, 30000);
