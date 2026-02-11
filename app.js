const board = document.getElementById("board");
const status = document.getElementById("status");

function medalClass(i) {
  if (i === 0) return "gold";
  if (i === 1) return "silver";
  if (i === 2) return "bronze";
  return "";
}

<script>
function loadLeaderboard() {
  var status = document.getElementById("status");
  var board = document.getElementById("leaderboard");

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

        var table = "<table border='1'><tr><th>Avatar</th><th>Nickname</th><th>ELO</th><th>Level</th></tr>";
        data.forEach(player => {
          table += `<tr>
            <td><img src="${player.avatar}" width="36"></td>
            <td>${player.nickname}</td>
            <td>${player.elo}</td>
            <td>${player.level}</td>
          </tr>`;
        });
        table += "</table>";

        board.innerHTML = table;
      } else {
        status.textContent = "Failed to load leaderboard.";
      }
    }
  };

  xhr.send();
}

window.onload = loadLeaderboard;
</script>

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



