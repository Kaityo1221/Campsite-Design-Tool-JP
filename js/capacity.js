async function analyzePlacementCapacity() {
  const file = document.getElementById("capacityFile")?.files?.[0];
  const result = document.getElementById("capacityResult");

  if (!result) return;

  if (!file) {
    result.innerHTML = `<div class="distance-warning">KMZ / KMLファイルを選択してください。</div>`;
    return;
  }

  result.innerHTML = `<div class="distance-warning">解析中...</div>`;

  try {
    const kmlText = await getCapacityKmlText(file);

    if (!kmlText) {
      result.innerHTML = `<div class="distance-warning">KMLデータを読み込めませんでした。</div>`;
      return;
    }

    const xml = new DOMParser().parseFromString(kmlText, "application/xml");

    const polygon = extractFirstCapacityPolygon(xml);
    const poi = extractCapacityPoiPoints(xml);

    if (!polygon.length) {
      result.innerHTML = `
        <div class="distance-warning">
          範囲ポリゴンが見つかりませんでした。<br>
          Google My Mapsで活動範囲をポリゴンとして作成してください。
        </div>
      `;
      return;
    }

    const existingPoints = poi.filter(p => p.type === "existing");
    const addPoints = poi.filter(p => p.type === "add");
    const blockingPoints = existingPoints.concat(addPoints);

    const estimate = estimateCapacityByGrid(polygon, blockingPoints, 40);
    const remaining = Math.max(0, estimate.count - addPoints.length);

    result.innerHTML = `
      <div class="distance-warning">
        <strong style="font-size:20px; color:#a78bfa;">
          配置余地チェック結果
        </strong><br><br>

        範囲ポリゴン：あり<br>
        既存POI：${existingPoints.length}件<br>
        追加POI：${addPoints.length}件<br><br>

        <strong>理論上の配置可能数：約${estimate.count}件</strong><br>
        現在の追加POI数：${addPoints.length}件<br>
        残り配置余地の目安：約${remaining}件<br><br>

        <span class="note">
          ※40m間隔をもとにした概算です。<br>
          ※ぎゅうぎゅう詰めにするための機能ではありません。<br>
          ※現地の導線・安全性・遊びやすさを優先してください。
        </span>
      </div>
    `;
  } catch (error) {
    console.error(error);
    result.innerHTML = `<div class="distance-warning">解析に失敗しました。</div>`;
  }
}

async function getCapacityKmlText(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith(".kml")) {
    return await file.text();
  }

  if (name.endsWith(".kmz") || name.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file);

    for (const path in zip.files) {
      if (path.toLowerCase().endsWith(".kml")) {
        return await zip.files[path].async("text");
      }
    }
  }

  return null;
}

function extractFirstCapacityPolygon(xml) {
  const polygons = Array.from(xml.getElementsByTagName("Polygon"));
  if (!polygons.length) return [];

  const coordinates =
    polygons[0].getElementsByTagName("coordinates")[0]?.textContent;

  if (!coordinates) return [];

  return coordinates
    .trim()
    .split(/\s+/)
    .map(pair => {
      const [lng, lat] = pair.split(",").map(Number);
      return { lat, lng };
    })
    .filter(p => !isNaN(p.lat) && !isNaN(p.lng));
}

function extractCapacityPoiPoints(xml) {
  const placemarks = Array.from(xml.getElementsByTagName("Placemark"));

  return placemarks.map(pm => {
    const point = pm.getElementsByTagName("Point")[0];
    if (!point) return null;

    const coord = point.getElementsByTagName("coordinates")[0]?.textContent;
    if (!coord) return null;

    const [lng, lat] = coord.trim().split(",").map(Number);
    if (isNaN(lat) || isNaN(lng)) return null;

    const name = pm.getElementsByTagName("name")[0]?.textContent || "POI";

    let layerName = "";
    let parent = pm.parentElement;

    while (parent) {
      if (parent.tagName === "Folder") {
        layerName = parent.getElementsByTagName("name")[0]?.textContent || "";
        break;
      }

      parent = parent.parentElement;
    }

    const isCircle =
      layerName.includes("円") ||
      layerName.includes("30m") ||
      layerName.includes("40m") ||
      name.includes("円") ||
      name.includes("30m") ||
      name.includes("40m");

    if (isCircle) return null;

    const isAdd =
      layerName.includes("追加") ||
      layerName.includes("追加希望") ||
      name.includes("追加") ||
      name.includes("追加希望");

    return {
      lat,
      lng,
      name,
      layer: layerName,
      type: isAdd ? "add" : "existing"
    };
  }).filter(Boolean);
}

function estimateCapacityByGrid(polygon, blockingPoints, minDistance) {
  const meanLat =
    polygon.reduce((sum, p) => sum + p.lat, 0) / polygon.length;

  const metersPerLat = 111320;
  const metersPerLng =
    111320 * Math.cos(meanLat * Math.PI / 180);

  const projectedPolygon = polygon.map(p => ({
    x: p.lng * metersPerLng,
    y: p.lat * metersPerLat
  }));

  const projectedBlocking = blockingPoints.map(p => ({
    x: p.lng * metersPerLng,
    y: p.lat * metersPerLat
  }));

  const xs = projectedPolygon.map(p => p.x);
  const ys = projectedPolygon.map(p => p.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const accepted = [];
  const spacing = minDistance;

  for (let y = minY; y <= maxY; y += spacing) {
    for (let x = minX; x <= maxX; x += spacing) {
      const candidate = { x, y };

      if (!isCapacityPointInPolygon(candidate, projectedPolygon)) continue;

      const nearBlocking = projectedBlocking.some(p =>
        getCapacityDistance(candidate, p) < minDistance
      );

      if (nearBlocking) continue;

      const nearAccepted = accepted.some(p =>
        getCapacityDistance(candidate, p) < minDistance
      );

      if (nearAccepted) continue;

      accepted.push(candidate);
    }
  }

  return {
    count: accepted.length,
    points: accepted
  };
}

function getCapacityDistance(a, b) {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
    Math.pow(a.y - b.y, 2)
  );
}

function isCapacityPointInPolygon(point, polygon) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      ((yi > point.y) !== (yj > point.y)) &&
      (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}