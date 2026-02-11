const board = document.getElementById("board");
const status = document.getElementById("status");

function medalClass(i) {
  if (i === 0) return "gold";
  if (i === 1) return "silver";
  if (i === 2) return "bronze";
  return "";
}

function loadLeaderboard() {
  status.textContent = "Loading leaderboard...";

  var xhr = new XMLHttpRequest();
  xhr.open("GET", "/leaderboard", true);

  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        var data = JSON.parse(xhr.responseText);

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
      } else {
        status.textContent = "Failed to load leaderboard.";
      }
    }
  };

  xhr.send();
}

// Load initially and every 30 seconds
loadLeaderboard();
setInterval(loadLeaderboard, 30000);
