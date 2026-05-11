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
/* =========================
   KMZ / KML Utility Pack
   kmz.js 補助関数まとめ
========================= */

function normalizePoint(point) {
  if (!point) return null;

  const lat =
    point.lat ??
    point.latitude ??
    point.Latitude ??
    point["lat"] ??
    point["Latitude"];

  const lng =
    point.lng ??
    point.lon ??
    point.longitude ??
    point.Longitude ??
    point["lng"] ??
    point["lon"] ??
    point["Longitude"];

  const name =
    point.name ??
    point.title ??
    point.Name ??
    point["name"] ??
    point["Name"] ??
    "名称未設定";

  const type =
    point.type ??
    point.category ??
    point.kind ??
    point["type"] ??
    "";

  const guid =
    point.guid ??
    point.id ??
    point["guid"] ??
    point["id"] ??
    "";

  const nLat = Number(lat);
  const nLng = Number(lng);

  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
    return null;
  }

  return {
    ...point,
    lat: nLat,
    lng: nLng,
    name: String(name || "名称未設定"),
    type: String(type || ""),
    guid: String(guid || "")
  };
}

function normalizePoints(points) {
  if (!Array.isArray(points)) return [];

  return points
    .map(normalizePoint)
    .filter(Boolean);
}

function getSelectedRadii() {
  return Array.from(
    document.querySelectorAll('input[name="radius"]:checked')
  ).map(input => Number(input.value))
   .filter(value => Number.isFinite(value));
}

function getSelectedCircleOnlyRadii() {
  return Array.from(
    document.querySelectorAll('input[name="circleOnlyRadius"]:checked')
  ).map(input => Number(input.value))
   .filter(value => Number.isFinite(value));
}

function createPlacemark(point, options = {}) {
  const p = normalizePoint(point);
  if (!p) return "";

  const name = escapeKmlText(options.name || p.name || "名称未設定");
  const description = escapeKmlText(
    options.description ||
    p.description ||
    p.type ||
    ""
  );

  const styleUrl = options.styleUrl
    ? `<styleUrl>${escapeKmlText(options.styleUrl)}</styleUrl>`
    : "";

  return `
<Placemark>
  <name>${name}</name>
  ${description ? `<description>${description}</description>` : ""}
  ${styleUrl}
  <Point>
    <coordinates>${p.lng},${p.lat},0</coordinates>
  </Point>
</Placemark>`;
}

function createPointPlacemark(point, options = {}) {
  return createPlacemark(point, options);
}

function createCircleCoordinates(lat, lng, radiusMeters, steps = 72) {
  const coordinates = [];
  const earthRadius = 6378137;

  const centerLat = Number(lat) * Math.PI / 180;
  const centerLng = Number(lng) * Math.PI / 180;
  const radius = Number(radiusMeters);

  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng) || !Number.isFinite(radius)) {
    return "";
  }

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;

    const pointLat = Math.asin(
      Math.sin(centerLat) * Math.cos(radius / earthRadius) +
      Math.cos(centerLat) * Math.sin(radius / earthRadius) * Math.cos(angle)
    );

    const pointLng =
      centerLng +
      Math.atan2(
        Math.sin(angle) * Math.sin(radius / earthRadius) * Math.cos(centerLat),
        Math.cos(radius / earthRadius) - Math.sin(centerLat) * Math.sin(pointLat)
      );

    coordinates.push(
      `${pointLng * 180 / Math.PI},${pointLat * 180 / Math.PI},0`
    );
  }

  return coordinates.join(" ");
}

function createCirclePlacemark(point, radiusMeters, options = {}) {
  const p = normalizePoint(point);
  if (!p) return "";

  const radius = Number(radiusMeters);
  if (!Number.isFinite(radius)) return "";

  const name = escapeKmlText(
    options.name ||
    `${p.name || "名称未設定"}_${radius}m円`
  );

  const coordinates = createCircleCoordinates(p.lat, p.lng, radius);

  if (!coordinates) return "";

  const styleUrl = options.styleUrl
    ? `<styleUrl>${escapeKmlText(options.styleUrl)}</styleUrl>`
    : "";

  return `
<Placemark>
  <name>${name}</name>
  ${styleUrl}
  <Polygon>
    <outerBoundaryIs>
      <LinearRing>
        <coordinates>
          ${coordinates}
        </coordinates>
      </LinearRing>
    </outerBoundaryIs>
  </Polygon>
</Placemark>`;
}

function createKmlDocument(content) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
${content || ""}
</Document>
</kml>`;
}

function createKmlStyle(id, color = "7dff0000", width = 2, fill = "1") {
  const safeId = escapeKmlText(id || "defaultStyle");

  return `
<Style id="${safeId}">
  <LineStyle>
    <color>${color}</color>
    <width>${width}</width>
  </LineStyle>
  <PolyStyle>
    <color>${color}</color>
    <fill>${fill}</fill>
    <outline>1</outline>
  </PolyStyle>
</Style>`;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeForEach(value, callback) {
  if (!Array.isArray(value)) return;

  value.forEach(callback);
}

function textToBlob(text, type = "application/vnd.google-earth.kml+xml") {
  return new Blob([text], { type });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename || "download.kmz";

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function guessPoiType(point) {
  const p = point || {};
  const text = [
    p.name,
    p.type,
    p.category,
    p.kind,
    p.description,
    p.layerName
  ].filter(Boolean).join(" ").toLowerCase();

  if (
    text.includes("gym") ||
    text.includes("ジム")
  ) {
    return "gym";
  }

  if (
    text.includes("power") ||
    text.includes("パワ") ||
    text.includes("powerspot") ||
    text.includes("power spot")
  ) {
    return "power";
  }

  return "pokestop";
}

function splitPoiByType(points) {
  const result = {
    pokestop: [],
    gym: [],
    power: []
  };

  safeArray(points).forEach(point => {
    const type = guessPoiType(point);

    if (type === "gym") {
      result.gym.push(point);
    } else if (type === "power") {
      result.power.push(point);
    } else {
      result.pokestop.push(point);
    }
  });

  return result;
}

/* グローバル明示 */
window.normalizePoint = normalizePoint;
window.normalizePoints = normalizePoints;
window.getSelectedRadii = getSelectedRadii;
window.getSelectedCircleOnlyRadii = getSelectedCircleOnlyRadii;
window.createPlacemark = createPlacemark;
window.createPointPlacemark = createPointPlacemark;
window.createCircleCoordinates = createCircleCoordinates;
window.createCirclePlacemark = createCirclePlacemark;
window.createKmlDocument = createKmlDocument;
window.createKmlStyle = createKmlStyle;
window.safeArray = safeArray;
window.safeForEach = safeForEach;
window.textToBlob = textToBlob;
window.downloadBlob = downloadBlob;
window.guessPoiType = guessPoiType;
window.splitPoiByType = splitPoiByType;
