
function createCircle(lat, lon, radius, points = 72) {
  const earthRadius = 6378137;
  const coords = [];

  for (let i = 0; i < points; i++) {
    const angle = (i * 360 / points) * Math.PI / 180;
    const dLat = (radius * Math.sin(angle)) / earthRadius;
    const dLon = (radius * Math.cos(angle)) / (earthRadius * Math.cos(lat * Math.PI / 180));
    const newLat = lat + dLat * 180 / Math.PI;
    const newLon = lon + dLon * 180 / Math.PI;
    coords.push(`${newLon},${newLat},0`);
  }

  coords.push(coords[0]);
  return coords.join(" ");
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function normalizeHeader(text) {
  return (text || "").trim().toLowerCase();
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(normalizeHeader);

  const latIndex = headers.findIndex(h => h === "lat" || h.includes("latitude"));
  const lngIndex = headers.findIndex(h => h === "lng" || h === "lon" || h.includes("longitude"));
 const typeIndex = headers.findIndex(h =>
  h.includes("gameentity") ||
  h.includes("game_entity") ||
  h.includes("entity") ||
  h.includes("type") ||
  h.includes("category")
);
  const guidIndex = headers.findIndex(h => h.includes("guid"));
  const nameIndex = headers.findIndex(h => h === "title" || h === "name");

  if (latIndex === -1 || lngIndex === -1) {
    alert("CSVに lat / lng が見つかりません");
    return [];
  }

  const points = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const lat = Number(cols[latIndex]);
    const lng = Number(cols[lngIndex]);

    if (isNaN(lat) || isNaN(lng)) continue;

    points.push({
      lat,
      lng,
      type: typeIndex !== -1 ? (cols[typeIndex] || "").toLowerCase() : "",
      guid: guidIndex !== -1 ? (cols[guidIndex] || "").trim() : "",
      name: nameIndex !== -1 && cols[nameIndex] ? cols[nameIndex] : `POI_${i}`
    });
  }

  return points;
}

async function getPointsFromKmlOrKmz(file) {
  let kmlText = null;

  if (file.name.toLowerCase().endsWith(".kml")) {
    kmlText = await file.text();
  } else if (
    file.name.toLowerCase().endsWith(".kmz") ||
    file.name.toLowerCase().endsWith(".zip")
  ) {
    const zip = await JSZip.loadAsync(file);
    for (const name in zip.files) {
      if (name.toLowerCase().endsWith(".kml")) {
        kmlText = await zip.files[name].async("text");
        break;
      }
    }
  }

  if (!kmlText) return [];

  const xml = new DOMParser().parseFromString(kmlText, "application/xml");

  const folders = Array.from(xml.getElementsByTagName("Folder"));

  const result = [];

  folders.forEach(folder => {
    const layerName =
      folder.getElementsByTagName("name")[0]?.textContent || "無名レイヤー";

    const placemarks = Array.from(folder.getElementsByTagName("Placemark"));

    placemarks.forEach((pm, index) => {
      const point = pm.getElementsByTagName("Point")[0];
      if (!point) return;

      const coordText = point
        .getElementsByTagName("coordinates")[0]
        ?.textContent.trim();

      if (!coordText) return;

      const [lng, lat] = coordText.split(",").map(Number);

      if (isNaN(lat) || isNaN(lng)) return;

      const name =
        pm.getElementsByTagName("name")[0]?.textContent ||
        `POI_${index + 1}`;

      result.push({
        lat,
        lng,
        name,
        layer: layerName
      });
    });
  });

  return result;
}

function removeDuplicate(points) {
  const map = new Map();
  let duplicateCount = 0;

  points.forEach(p => {
    const key = p.guid
      ? `guid:${p.guid}`
      : `coord:${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

    if (map.has(key)) {
      duplicateCount++;
    } else {
      map.set(key, p);
    }
  });

  return {
    uniquePoints: Array.from(map.values()),
    duplicateCount
  };
}

function createFolder(xml, doc, name) {
  const folder = xml.createElement("Folder");
  const folderName = xml.createElement("name");
  folderName.textContent = name;
  folder.appendChild(folderName);
  doc.appendChild(folder);
  return folder;
}

function createPointPlacemark(xml, p) {
  const pm = xml.createElement("Placemark");

  const name = xml.createElement("name");
  name.textContent = p.name;

  const point = xml.createElement("Point");
  const coordinates = xml.createElement("coordinates");
  coordinates.textContent = `${p.lng},${p.lat},0`;

  point.appendChild(coordinates);
  pm.appendChild(name);
  pm.appendChild(point);

  return pm;
}

function createCirclePlacemark(xml, p, radius) {
  const pm = xml.createElement("Placemark");

  const name = xml.createElement("name");
  name.textContent = `${p.name}_${radius}m`;

  const polygon = xml.createElement("Polygon");
  const outer = xml.createElement("outerBoundaryIs");
  const ring = xml.createElement("LinearRing");
  const coordinates = xml.createElement("coordinates");

  coordinates.textContent = createCircle(p.lat, p.lng, radius);

  ring.appendChild(coordinates);
  outer.appendChild(ring);
  polygon.appendChild(outer);

  pm.appendChild(name);
  pm.appendChild(polygon);

  return pm;
}

function addDummyPlacemark(xml, folder, name) {
  if (!folder) return;

  const pm = xml.createElement("Placemark");

  const n = xml.createElement("name");
  n.textContent = name;

  const styleUrl = xml.createElement("styleUrl");
  styleUrl.textContent = "#hiddenStyle";

  const point = xml.createElement("Point");
  const coord = xml.createElement("coordinates");

  // 海上ダミー
  coord.textContent = "0,0,0";

  point.appendChild(coord);

  pm.appendChild(n);
  pm.appendChild(styleUrl);
  pm.appendChild(point);

  folder.appendChild(pm);
}
function classifyType(typeText = "", name = "", layerName = "") {
  const text = `${typeText} ${name} ${layerName}`.toLowerCase();

  if (
    text.includes("power") ||
    text.includes("powerspot") ||
    text.includes("power spot") ||
    text.includes("パワ") ||
    text.includes("パワースポット") ||
    text.includes("パワスポ")
  ) {
    return "power";
  }

  if (
    text.includes("gym") ||
    text.includes("ジム")
  ) {
    return "gym";
  }

  if (
    text.includes("pokestop") ||
    text.includes("poke stop") ||
    text.includes("ポケスト") ||
    text.includes("ポケストップ")
  ) {
    return "pokestop";
  }

  return "pokestop";
}

function isDummyPoint(p) {
  const name = p.name || "";

  if (Number(p.lat) === 0 && Number(p.lng) === 0) return true;
  if (name.includes("ここに追加")) return true;
  if (name.includes("レイヤー保持用")) return true;

  return false;
}


  function isIgnoredLayerForExistingOnly(p) {
  const layerName = p.layer || "";
  const name = p.name || "";

  if (typeof isDummyPoint === "function" && isDummyPoint(p)) return true;

  if (
    layerName.includes("円") ||
    layerName.includes("30m") ||
    layerName.includes("40m")
  ) {
    return true;
  }

  if (
    layerName.includes("追加希望") ||
    layerName.includes("追加") ||
    name.includes("ここに追加") ||
    name.includes("レイヤー保持用")
  ) {
    return true;
  }

  return false;