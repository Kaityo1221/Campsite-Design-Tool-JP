
/* =========================
   Common safe helpers
========================= */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isJSZipAvailable(context = "KMZ処理") {
  if (typeof JSZip !== "undefined") {
    return true;
  }

  alert(`${context}に必要なライブラリを読み込めませんでした。通信環境を確認して、ページを再読み込みしてください。`);
  return false;
}

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
  const q4 = document.querySelector('input[name="q4"]:checked')?.value;
  const q5 = document.querySelector('input[name="q5"]:checked')?.value;

  if (!q1 || !q2 || !q3 || !q4 || !q5) {
    alert("すべて選択してください");
    return;
  }

  if (
    q1 === "a" &&
    q2 === "tap" &&
    q3 === "none" &&
    q4 === "25" &&
    q5 === "safe"
  ) {
    localStorage.setItem("quizPassed", window.QUIZ_VERSION);
    document.getElementById("quizModal").style.display = "none";
    alert("✔ 利用準備OK！ツールを使えます");
  } else {
    alert("もう一度確認してください\nヒント：このツールはPOIを増やすためではなく、安全で快適な設計のために使います");
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
  const rows = parseCSVRows(text);

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map(h => String(h || "").trim());
  const dataRows = rows.slice(1);

  return dataRows
    .map(row => {
      const obj = {};

      headers.forEach((header, index) => {
        obj[header] = row[index] ?? "";
      });

      const name =
  pickValue(obj, [
    "title",
    "Title",
    "name",
    "Name",
    "wayspotTitle",
    "Wayspot Title",
    "タイトル",
    "名前"
  ]) || row[0] || "";

      const lat =
        pickValue(obj, [
          "lat",
          "Lat",
          "latitude",
          "Latitude",
          "緯度"
        ]);

      const lng =
        pickValue(obj, [
          "lng",
          "Lng",
          "lon",
          "Lon",
          "longitude",
          "Longitude",
          "経度"
        ]);

      const type =
  pickValue(obj, [
    "gameEntity",
    "GameEntity",
    "game_entity",
    "Game Entity",
    "type",
    "Type",
    "category",
    "Category",
    "種類"
  ]) || "";

      const guid =
        pickValue(obj, [
          "guid",
          "GUID",
          "id",
          "ID",
          "wayspotId",
          "Wayspot ID"
        ]) || "";

      const nLat = Number(lat);
      const nLng = Number(lng);

      if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
        return null;
      }

     const gameStatus =
  pickValue(obj, [
    "gameStatus",
    "GameStatus",
    "game_status",
    "Game Status",
    "status",
    "Status"
  ]) || "";

return {
  name: String(name || ""),
  lat: nLat,
  lng: nLng,
  type: String(type || ""),
  gameStatus: String(gameStatus || ""),
  guid: String(guid || ""),
  layer: "CSV"
};
    })
    .filter(Boolean);
}

function parseCSVRows(text) {
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

      if (row.some(cell => String(cell).trim() !== "")) {
        rows.push(row);
      }

      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);

  if (row.some(cell => String(cell).trim() !== "")) {
    rows.push(row);
  }

  return rows;
}

function pickValue(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== "") {
      return obj[key];
    }
  }

  return "";
}

/* =========================
   Duplicate Remover
========================= */

function removeDuplicate(points) {
  if (!Array.isArray(points)) {
    return {
      uniquePoints: [],
      duplicateCount: 0
    };
  }

  const seen = new Set();
  const uniquePoints = [];
  let duplicateCount = 0;

  points.forEach(point => {
    if (!point) return;

    let key = "";

    if (point.guid) {
      key = `guid:${String(point.guid).trim()}`;
    } else if (point.id) {
      key = `id:${String(point.id).trim()}`;
    } else if (point.lat !== undefined && point.lng !== undefined) {
      const lat = Number(point.lat).toFixed(7);
      const lng = Number(point.lng).toFixed(7);
      key = `coord:${lat},${lng}`;
    } else {
      key = JSON.stringify(point);
    }

    if (seen.has(key)) {
      duplicateCount++;
      return;
    }

    seen.add(key);
    uniquePoints.push(point);
  });

  return {
    uniquePoints,
    duplicateCount
  };
}

/* =========================
   KML / KMZ Reader
========================= */

async function getPointsFromKmlOrKmz(file) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".kmz") || fileName.endsWith(".zip")) {
    if (!isJSZipAvailable("KML / KMZ読み込み")) {
      return [];
    }

    const zip = await JSZip.loadAsync(file);
    const kmlFileName = Object.keys(zip.files).find(name =>
      name.toLowerCase().endsWith(".kml")
    );

    if (!kmlFileName) {
      return [];
    }

    const kmlText = await zip.files[kmlFileName].async("text");
    return parseKmlPoints(kmlText);
  }

  const text = await file.text();
  return parseKmlPoints(text);
}
function getExtendedDataValue(placemark, keyName) {
  const dataNodes = Array.from(placemark.getElementsByTagName("Data"));

  for (const dataNode of dataNodes) {
    const nameAttr = dataNode.getAttribute("name");

    if (nameAttr === keyName) {
      return dataNode.getElementsByTagName("value")[0]?.textContent?.trim() || "";
    }
  }

  return "";
}

function getBestPlacemarkName(placemark) {
  const extendedName =
    getExtendedDataValue(placemark, "名前") ||
    getExtendedDataValue(placemark, "name") ||
    getExtendedDataValue(placemark, "Name") ||
    getExtendedDataValue(placemark, "title") ||
    getExtendedDataValue(placemark, "Title");

  if (extendedName) {
    return extendedName;
  }

  const placemarkName =
    placemark.getElementsByTagName("name")[0]?.textContent?.trim() || "";

  return placemarkName || "";
}
function parseKmlPoints(kmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(kmlText, "application/xml");
  const placemarks = Array.from(xml.getElementsByTagName("Placemark"));

  return placemarks
    .map(placemark => {
      const name = getBestPlacemarkName(placemark);

      const description =
        placemark.getElementsByTagName("description")[0]?.textContent?.trim() ||
        "";

      const coordinatesText =
        placemark.getElementsByTagName("coordinates")[0]?.textContent?.trim();

      if (!coordinatesText) {
        return null;
      }

      const firstCoordinate = coordinatesText.split(/\s+/)[0];
      const parts = firstCoordinate.split(",");

      const lng = Number(parts[0]);
      const lat = Number(parts[1]);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      const layer = getParentFolderName(placemark);

      return {
        name,
        description,
        lat,
        lng,
        layer,
        type: classifyType(description, name, layer)
      };
    })
    .filter(Boolean);
}

function getParentFolderName(element) {
  let current = element.parentElement;

  while (current) {
    if (current.tagName === "Folder") {
      const name = current.getElementsByTagName("name")[0]?.textContent?.trim();
      return name || "";
    }

    current = current.parentElement;
  }

  return "";
}

/* =========================
   KML Element Builders
========================= */

function createFolder(outputXml, doc, name) {
  const folder = outputXml.createElement("Folder");

  const nameNode = outputXml.createElement("name");
  nameNode.textContent = name || "無題レイヤー";

  folder.appendChild(nameNode);
  doc.appendChild(folder);

  return folder;
}

function createPointPlacemark(outputXml, point) {
  const placemark = outputXml.createElement("Placemark");

  const name = outputXml.createElement("name");
  name.textContent = point.name || "";
  placemark.appendChild(name);

  const description = outputXml.createElement("description");
  description.textContent =
    point.description ||
    point.type ||
    point.layer ||
    "";
  placemark.appendChild(description);

  const pointNode = outputXml.createElement("Point");
  const coordinates = outputXml.createElement("coordinates");
  coordinates.textContent = `${point.lng},${point.lat},0`;

  pointNode.appendChild(coordinates);
  placemark.appendChild(pointNode);

  return placemark;
}

function createCirclePlacemark(outputXml, point, radius) {
  const placemark = outputXml.createElement("Placemark");

  const name = outputXml.createElement("name");
  name.textContent = point.name
  ? `${point.name}_${radius}m円`
  : "";
  placemark.appendChild(name);

  const polygon = outputXml.createElement("Polygon");
  const outer = outputXml.createElement("outerBoundaryIs");
  const ring = outputXml.createElement("LinearRing");
  const coordinates = outputXml.createElement("coordinates");

  coordinates.textContent = createCircleCoordinates(
    point.lat,
    point.lng,
    radius
  );

  ring.appendChild(coordinates);
  outer.appendChild(ring);
  polygon.appendChild(outer);
  placemark.appendChild(polygon);

  return placemark;
}

function createCircleCoordinates(lat, lng, radiusMeters, steps = 72) {
  const coordinates = [];
  const earthRadius = 6378137;

  const centerLat = Number(lat) * Math.PI / 180;
  const centerLng = Number(lng) * Math.PI / 180;
  const radius = Number(radiusMeters);

  if (
    !Number.isFinite(centerLat) ||
    !Number.isFinite(centerLng) ||
    !Number.isFinite(radius)
  ) {
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

function addDummyPlacemark(outputXml, folder, label) {
  const placemark = outputXml.createElement("Placemark");

  const name = outputXml.createElement("name");
  name.textContent = label || "レイヤー保持用";
  placemark.appendChild(name);

  const styleUrl = outputXml.createElement("styleUrl");
  styleUrl.textContent = "#hiddenStyle";
  placemark.appendChild(styleUrl);

  const description = outputXml.createElement("description");
  description.textContent = "このポイントはレイヤー保持用のダミーポイントです。";
  placemark.appendChild(description);

  const point = outputXml.createElement("Point");
  const coordinates = outputXml.createElement("coordinates");
  coordinates.textContent = "139.000000,35.000000,0";

  point.appendChild(coordinates);
  placemark.appendChild(point);

  folder.appendChild(placemark);

  return placemark;
}

/* =========================
   Type / Layer Helpers
========================= */

function classifyType(type = "", name = "", layer = "") {
  const typeText = String(type || "").toUpperCase();

  // CSVの gameEntity を最優先
  if (
  typeText === "GYM" ||
  typeText === "ジム"
) {
  return "gym";
}

if (
  typeText === "POWERSPOT" ||
  typeText === "POWER_SPOT" ||
  typeText === "POWER" ||
  typeText === "パワースポット" ||
  typeText === "パワスポ"
) {
  return "power";
}

if (
  typeText === "POKESTOP" ||
  typeText === "POKE_STOP" ||
  typeText === "ポケストップ" ||
  typeText === "ポケスト"
) {
  return "pokestop";
}

  // KML / KMZなど、typeが取れない場合だけ名前・レイヤーで補助判定
  const text = `${name} ${layer}`.toLowerCase();

  if (
    text.includes("gym") ||
    text.includes("ジム")
  ) {
    return "gym";
  }

  if (
    text.includes("power") ||
    text.includes("powerspot") ||
    text.includes("power spot") ||
    text.includes("パワー") ||
    text.includes("パワスポ")
  ) {
    return "power";
  }

  return "pokestop";
}

function isDummyPoint(point) {
  const text = `${point?.name || ""} ${point?.description || ""} ${point?.layer || ""}`;

  return (
    text.includes("ダミー") ||
    text.includes("レイヤー保持用") ||
    text.includes("ここに追加")
  );
}

function isIgnoredLayerForExistingOnly(point) {
  if (isDummyPoint(point)) return true;

  const layer = point?.layer || "";

  return (
    layer.includes("円") ||
    layer.includes("30m") ||
    layer.includes("40m") ||
    layer.includes("追加希望")
  );
}
