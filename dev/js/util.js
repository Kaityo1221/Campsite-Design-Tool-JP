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
/* =========================
   Duplicate Remover
========================= */

function removeDuplicate(points) {
  if (!Array.isArray(points)) {
    return [];
  }

  const seen = new Set();
  const result = [];

  points.forEach(point => {
    if (!point) return;

    let key = "";

    // Wayfarer CSV由来のGUIDがある場合は最優先
    if (point.guid) {
      key = `guid:${String(point.guid).trim()}`;
    }

    // id がある場合
    else if (point.id) {
      key = `id:${String(point.id).trim()}`;
    }

    // lat / lng がある場合
    else if (point.lat !== undefined && point.lng !== undefined) {
      const lat = Number(point.lat).toFixed(7);
      const lng = Number(point.lng).toFixed(7);
      const name = point.name ? String(point.name).trim() : "";
      key = `pos:${lat},${lng},${name}`;
    }

    // それ以外は中身を文字列化
    else {
      key = JSON.stringify(point);
    }

    if (seen.has(key)) return;

    seen.add(key);
    result.push(point);
  });

  return result;
}
/* =========================
   KML Folder Builder
========================= */

function createFolder(name, content) {
  const safeName = escapeKmlText(name);

  return `
<Folder>
  <name>${safeName}</name>
  ${content || ""}
</Folder>`;
}

function escapeKmlText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
/* =========================
   Dummy Placemark Builder
========================= */

function addDummyPlacemark(layerName) {
  const safeName = escapeKmlText(layerName || "ダミーポイント");

  return `
<Placemark>
  <name>${safeName}_レイヤー保持用</name>
  <description>このポイントはレイヤー保持用のダミーポイントです。My Maps上で必要に応じて削除してください。</description>
  <Style>
    <IconStyle>
      <scale>0.1</scale>
    </IconStyle>
  </Style>
  <Point>
    <coordinates>139.000000,35.000000,0</coordinates>
  </Point>
</Placemark>`;
}
