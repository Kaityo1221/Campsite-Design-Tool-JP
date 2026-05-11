function sleep(ms) {
return new Promise(resolve => setTimeout(resolve, ms));
}
function waitForRender() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}
window.showQuiz = function () {
  document.getElementById("quizModal").style.display = "flex";
}

window.checkQuiz = function () {
  const q1 = document.querySelector('input[name="q1"]:checked')?.value;
  const q2 = document.querySelector('input[name="q2"]:checked')?.value;
  const q3 = document.querySelector('input[name="q3"]:checked')?.value;

  if (!q1 || !q2 || !q3) {
    alert("すべて選択してください");
    return;
  }

  if (q1 === "40" && q2 === "hard" && q3 === "25") {
    localStorage.setItem("quizPassed", window.QUIZ_VERSION);
    document.getElementById("quizModal").style.display = "none";
    alert("✔ 利用準備OK！ツールを使えます");
  } else {
    alert("もう一度確認してください\nヒント：基本距離は40mです");
  }
}
function showLoading(text = "読み込み中…") {

  const overlay =
    document.getElementById("loadingOverlay");

  const loadingText =
    document.getElementById("loadingText");

  if (overlay) {
    overlay.style.display = "flex";
  }

  if (loadingText) {
    loadingText.textContent = text;
  }
}

function hideLoading() {

  const overlay =
    document.getElementById("loadingOverlay");

  if (overlay) {
    overlay.style.display = "none";
  }
}
function setLoadingText(text) {

  const loadingText =
    document.getElementById("loadingText");

  if (loadingText) {
    loadingText.textContent = text;
  }
}
function getDistanceMeters(a, b) {
  const R = 6378137;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}
/* =========================
   CSV Parser
========================= */

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      value += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }

      row.push(value);

      if (row.some(cell => cell.trim() !== "")) {
        rows.push(row);
      }

      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);

  if (row.some(cell => cell.trim() !== "")) {
    rows.push(row);
  }

  return rows;
}
