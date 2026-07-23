let capacityState = null;
let capacityMapInstance = null;
let capacityPreviewMapInstance = null;
let capacityPreviewCandidateLayer = null;
let capacityPreviewState = null;
let capacityMode = "manual";
const CAPACITY_LIMITS = {
  pokestop: 12,
  gym: 8,
  power: 5
};

const CAPACITY_LABELS = {
  pokestop: "ポケストップ",
  gym: "ジム",
  power: "パワースポット"
};

async function analyzePlacementCapacity() {
  const file = document.getElementById("capacityFile")?.files?.[0];
  const result = document.getElementById("capacityResult");
  const placementResult = document.getElementById("placementResult");

  if (!file) {
  result.innerHTML = `<div class="distance-warning">KMZ / KMLファイルを選択してください。</div>`;

  if (placementResult) {
    placementResult.innerHTML = `KMZ / KMLファイルを選択してください。`;
  }

  return;
}

  capacityPreviewState = null;

  if (capacityPreviewCandidateLayer) {
    capacityPreviewCandidateLayer.remove();
    capacityPreviewCandidateLayer = null;
  }

  const mapCompare = document.getElementById("capacityMapCompare");

  if (mapCompare) {
    mapCompare.style.display = "none";
  }

  result.innerHTML = `<div class="distance-warning">解析中...</div>`;
  if (placementResult) {
  placementResult.innerHTML = `配置余地を解析中...`;
}
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

    const addCounts = {
      pokestop: poi.filter(p => p.type === "add" && p.kind === "pokestop").length,
      gym: poi.filter(p => p.type === "add" && p.kind === "gym").length,
      power: poi.filter(p => p.type === "add" && p.kind === "power").length
    };

    const remaining = {
      pokestop: Math.max(0, CAPACITY_LIMITS.pokestop - addCounts.pokestop),
      gym: Math.max(0, CAPACITY_LIMITS.gym - addCounts.gym),
      power: Math.max(0, CAPACITY_LIMITS.power - addCounts.power)
    };

    const estimate = estimateCapacityRandom(polygon, poi, 40, 30000);

    capacityState = {
      polygon,
      poi,
      estimate,
      remaining
    };
    renderPlacementSummaryCard({
  polygon,
  poi,
  addCounts,
  remaining,
  estimate
});

    result.innerHTML = `
      <div class="distance-warning">
        <strong style="font-size:20px; color:#a78bfa;">
          配置余地チェック結果
        </strong><br><br>

        範囲ポリゴン：あり<br>
        読み込みPOI：${poi.length}件<br><br>

        <strong>現在の追加POI</strong><br>
        ポケストップ：${addCounts.pokestop} / ${CAPACITY_LIMITS.pokestop}<br>
        ジム：${addCounts.gym} / ${CAPACITY_LIMITS.gym}<br>
        パワースポット：${addCounts.power} / ${CAPACITY_LIMITS.power}<br><br>

       <strong>残容量</strong><br>
ポケストップ：${capacityText(addCounts.pokestop, CAPACITY_LIMITS.pokestop)}<br>
ジム：${capacityText(addCounts.gym, CAPACITY_LIMITS.gym)}<br>
パワースポット：${capacityText(addCounts.power, CAPACITY_LIMITS.power)}<br><br>
       <strong>
推定配置余地：約${estimate.points.length}地点
（目安：${Math.max(0, estimate.points.length - 1)}～${estimate.points.length + 1}地点程度）
</strong><br><br>

<span class="note">
  ※ランダムサンプリングによる概算です。<br>
  ※実行ごとに結果が多少変動します。<br>
  ※詰め込み注意！<br>
  ※実際に現地検証を進め、導線・安全性・遊びやすさを優先してください。
</span>

      <div class="distance-warning">
  <div class="capacity-section-title">
    2. 候補POIの生成設定
  </div>

  ${renderCapacityModeSelector()}

  <div class="capacity-manual-settings">
    <strong>マニュアル設定</strong>
    <span class="note">（残容量の範囲内で指定）</span>
    <br><br>

    ${renderCapacitySelect("pokestop", remaining.pokestop)}
    ${renderCapacitySelect("gym", remaining.gym)}
    ${renderCapacitySelect("power", remaining.power)}
  </div>

  <br>

<button
  class="generate"
  onclick="previewCandidatePoiPlacement()"
>
  候補配置をプレビュー
</button>

<button
  id="generateCandidatePoiButton"
  class="generate"
  onclick="generateCandidatePoiKMZ()"
  style="display:none; margin-top:10px;"
>
  候補POI KMZを生成
</button>

<div id="candidatePreviewResult"></div>
<div id="candidateKmlResult"></div>
    <div id="capacitySupabaseStatus" class="note" style="margin-top:14px;">
    ⚪ Supabase接続確認中...
  </div>
   
</div>
</div>
      `;


    if (mapCompare) {
      mapCompare.style.display = "grid";
    }

    pingCapacitySupabase();
    renderCapacityMap(polygon, poi);
    renderCapacityPreviewBaseMap(polygon, poi);
  } catch (error) {
    console.error(error);
    result.innerHTML = `<div class="distance-warning">解析に失敗しました。</div>`;
  }
}
function capacityText(current, limit) {
  const remain = limit - current;

  if (remain < 0) {
    return `<span style="color:#ef4444;">超過中（+${Math.abs(remain)}）</span>`;
  }

  return `${remain}件`;
}
function renderCapacityModeSelector() {
  return `
    <div class="capacity-mode-section">
      <strong>配置モードを選択</strong>

      <div class="capacity-mode-grid">

        <button
          type="button"
          id="capacityModeManual"
          class="capacity-mode-card active"
          onclick="setCapacityMode('manual')"
        >
          <span class="capacity-mode-radio">●</span>

          <span class="capacity-mode-card-text">
            <strong>マニュアルモード</strong>
            <small>
              残容量の範囲内で、種類ごとに候補数を指定して生成します。
            </small>
          </span>
        </button>

        <button
          type="button"
          id="capacityModeBalanced"
          class="capacity-mode-card preparing"
          onclick="setCapacityMode('balanced')"
        >
          <span class="capacity-mode-radio">○</span>

          <span class="capacity-mode-card-text">
            <strong>均等配置モード</strong>
            <small>
              全体に均等に広がるよう、候補を自動調整します。
            </small>

            <em>準備中</em>
          </span>
        </button>

      </div>

      <div id="capacityModeMessage" class="capacity-mode-message">
        種類ごとの生成数を選択してください。
      </div>
    </div>
  `;
}

function setCapacityMode(mode) {
  if (mode === "balanced") {
    const message = document.getElementById("capacityModeMessage");

    if (message) {
      message.innerHTML = `
        🧪 均等配置モードは現在開発中です。<br>
        今はマニュアルモードをご利用ください。
      `;
    }

    return;
  }

  capacityMode = "manual";

  const manual = document.getElementById("capacityModeManual");
  const balanced = document.getElementById("capacityModeBalanced");
  const message = document.getElementById("capacityModeMessage");

  manual?.classList.add("active");
  balanced?.classList.remove("active");

  if (message) {
    message.textContent = "種類ごとの生成数を選択してください。";
  }
}
function renderCapacitySelect(kind, max) {
  let options = "";

  for (let i = 0; i <= max; i++) {
    options += `<option value="${i}">${i}</option>`;
  }

  return `
    <label>
      ${CAPACITY_LABELS[kind]}：
      <select id="capacitySelect_${kind}" style="
        padding:8px 10px;
        border-radius:8px;
        background:#1e293b;
        color:white;
        border:1px solid #475569;
        margin:6px 0 10px;
      ">
        ${options}
      </select>
    </label><br>
  `;
}

async function generateCandidatePoiKMZ() {
  const output = document.getElementById("candidateKmlResult");

  if (!capacityState) {
    alert("先に配置余地を確認してください。");
    return;
  }

  if (!capacityPreviewState) {
    alert("先に候補配置をプレビューしてください。");
    return;
  }

  const currentCounts = {
    pokestop: Number(
      document.getElementById("capacitySelect_pokestop")?.value || 0
    ),
    gym: Number(
      document.getElementById("capacitySelect_gym")?.value || 0
    ),
    power: Number(
      document.getElementById("capacitySelect_power")?.value || 0
    )
  };

  const previewCounts = capacityPreviewState.counts;

  const selectionChanged =
    currentCounts.pokestop !== previewCounts.pokestop ||
    currentCounts.gym !== previewCounts.gym ||
    currentCounts.power !== previewCounts.power;

  if (selectionChanged) {
    alert(
      "候補数がプレビュー後に変更されています。\n" +
      "もう一度「候補配置をプレビュー」を押してください。"
    );
    return;
  }

  const grouped = capacityPreviewState.grouped;

  const kml = buildCandidatePoiKml(grouped);

  if (!isJSZipAvailable("候補POI KMZ生成")) {
    return;
  }

  const zip = new JSZip();
  zip.file("doc.kml", kml);

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE"
  });

  downloadCapacityBlob(blob, "候補POI.kmz");

  if (output) {
    output.innerHTML = `
      <div class="distance-warning" style="margin-top:14px;">
        <strong>候補POI KMZを生成しました。</strong><br><br>

        ポケストップ候補：${previewCounts.pokestop}件<br>
        ジム候補：${previewCounts.gym}件<br>
        パワースポット候補：${previewCounts.power}件<br><br>

        右側のプレビューで確認した候補地点を、そのままKMZへ書き出しました。<br>
        Google My Mapsへインポートして、現地状況を確認してください。
      </div>
    `;
  }
}

function pickBalancedCandidatePoints(points, count) {
  const pool = [...points];
  const picked = [];

  const preferredEdgeDistance = 30;
  const randomTopCount = 6;

  while (picked.length < count && pool.length) {
    const scoredCandidates = pool
      .map((point, index) => {
        const edgeDistance =
          Number.isFinite(point.edgeDistance)
            ? point.edgeDistance
            : 0;

        const spreadScore =
          picked.length === 0
            ? edgeDistance
            : Math.min(
                ...picked.map(existing =>
                  getCapacityDistance(point, existing)
                )
              );

        const edgePenalty =
          Math.max(
            0,
            preferredEdgeDistance - edgeDistance
          ) * 3;

        const interiorBonus =
          Math.min(edgeDistance, 50) * 0.5;

        return {
          index,
          score:
            spreadScore +
            interiorBonus -
            edgePenalty
        };
      })
      .sort((a, b) => b.score - a.score);

    const topCandidates =
      scoredCandidates.slice(
        0,
        Math.min(
          randomTopCount,
          scoredCandidates.length
        )
      );

    const selected =
      topCandidates[
        Math.floor(
          Math.random() * topCandidates.length
        )
      ];

    picked.push(
      pool.splice(selected.index, 1)[0]
    );
  }

  return picked;
}
function buildCandidatePoiKml(grouped) {
  const folderDefinitions = [
    {
      folderName: "追加希望ポケスト",
      label: "候補ポケストップ",
      prefix: "候補ポケストップ",
      points: grouped.pokestop || []
    },
    {
      folderName: "追加希望ジム",
      label: "候補ジム",
      prefix: "候補ジム",
      points: grouped.gym || []
    },
    {
      folderName: "追加希望パワスポ",
      label: "候補パワースポット",
      prefix: "候補パワースポット",
      points: grouped.power || []
    }
  ];

  const buildFolder = definition => {
    const placemarks = definition.points.map((point, index) => `
      <Placemark>
        <name>${definition.prefix}${index + 1}</name>
        <description>${definition.label}</description>
        <Point>
          <coordinates>${point.lng},${point.lat},0</coordinates>
        </Point>
      </Placemark>
    `).join("");

    return `
  <Folder>
    <name>${definition.folderName}</name>
    ${placemarks}
  </Folder>`;
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>候補POI</name>
  ${folderDefinitions.map(buildFolder).join("")}
</Document>
</kml>`;
}

async function getCapacityKmlText(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith(".kml")) {
    return await file.text();
  }

  if (name.endsWith(".kmz") || name.endsWith(".zip")) {
    if (!isJSZipAvailable("候補POIファイル読み込み")) {
      return null;
    }

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
  const placemarks = Array.from(xml.getElementsByTagName("Placemark"));

  for (const pm of placemarks) {
    const polygon = pm.getElementsByTagName("Polygon")[0];
    if (!polygon) continue;

    const placemarkName =
      pm.getElementsByTagName("name")[0]?.textContent || "";

    const layerName = getCapacityParentFolderName(pm);

    const text = `${placemarkName} ${layerName}`.toLowerCase();

    const isCircle =
      text.includes("円") ||
      text.includes("30m") ||
      text.includes("40m") ||
      text.includes("radius") ||
      text.includes("circle");

    if (isCircle) continue;

    const isArea =
      text.includes("活動範囲") ||
      text.includes("範囲") ||
      text.includes("エリア") ||
      text.includes("area") ||
      text.includes("zone") ||
      text.includes("polygon");

    if (!isArea) continue;

    const coordText =
      polygon.getElementsByTagName("coordinates")[0]?.textContent || "";

    const points = coordText
      .trim()
      .split(/\s+/)
      .map(coord => {
        const [lng, lat] = coord.split(",").map(Number);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return null;
        }

        return { lat, lng };
      })
      .filter(Boolean);

    if (points.length >= 3) {
      return points;
    }
  }

  return [];
}
function getCapacityParentFolderName(element) {
  let parent = element.parentElement;

  while (parent) {
    if (parent.tagName === "Folder") {
      return parent.getElementsByTagName("name")[0]?.textContent || "";
    }

    parent = parent.parentElement;
  }

  return "";
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
      layerName.includes("40m");

    if (isCircle) return null;

    const isDummy =
      layerName.includes("ダミー") ||
      name.includes("ダミー") ||
      name.toLowerCase().includes("dummy");

    if (isDummy) return null;

    const normalizedLayerName = String(layerName || "")
  .toLowerCase()
  .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s =>
    String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
  );

const isAdd =
  normalizedLayerName.includes("追加") ||
  normalizedLayerName.includes("新規") ||
  normalizedLayerName.includes("add") ||
  normalizedLayerName.includes("new") ||
  normalizedLayerName.includes("proposed");
  
    return {
      lat,
      lng,
      name,
      layer: layerName,
      type: isAdd ? "add" : "existing",
      kind: detectCapacityKind(layerName, name)
    };
  }).filter(Boolean);
}

function detectCapacityKind(layerName, name) {
  const text = `${layerName} ${name}`.toLowerCase();

  if (
    text.includes("gym") ||
    text.includes("ジム")
  ) {
    return "gym";
  }

  if (
    text.includes("power") ||
    text.includes("パワ")
  ) {
    return "power";
  }

  return "pokestop";
}

function estimateCapacityRandom(
  polygon,
  blockingPoints,
  minDistance,
  trialCount = 30000
) {
  const meanLat =
    polygon.reduce((sum, p) => sum + p.lat, 0) / polygon.length;

  const metersPerLat = 111320;
  const metersPerLng =
    111320 * Math.cos(meanLat * Math.PI / 180);

  const projectedPolygon = polygon.map(p => ({
    x: p.lng * metersPerLng,
    y: p.lat * metersPerLat,
    lat: p.lat,
    lng: p.lng
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
  const safetyMargin = 0;
  const boundaryMargin = 15;

  for (let i = 0; i < trialCount; i++) {
    const x = minX + Math.random() * (maxX - minX);
    const y = minY + Math.random() * (maxY - minY);

    const candidate = { x, y };

    if (!isCapacityPointInPolygon(candidate, projectedPolygon)) {
      continue;
    }

    const edgeDistance =
      getCapacityDistanceToPolygonEdge(
        candidate,
        projectedPolygon
      );

    if (edgeDistance < boundaryMargin) {
      continue;
    }

    const nearBlocking = projectedBlocking.some(p =>
      getCapacityDistance(candidate, p) <
      minDistance + safetyMargin
    );

    if (nearBlocking) {
      continue;
    }

    const nearAccepted = accepted.some(p =>
      getCapacityDistance(candidate, p) < minDistance
    );

    if (nearAccepted) {
      continue;
    }

    accepted.push({
      x,
      y,
      lat: y / metersPerLat,
      lng: x / metersPerLng,
      edgeDistance
    });
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

function downloadCapacityBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

async function pingCapacitySupabase() {
  const status = document.getElementById("capacitySupabaseStatus");

  if (!status) return;

  if (
    !CAMPSITE_SUPABASE_URL ||
    !CAMPSITE_SUPABASE_PUBLISHABLE_KEY ||
    CAMPSITE_SUPABASE_PUBLISHABLE_KEY.includes("ここに")
  ) {
    status.innerHTML = "⚪ Supabase未設定";
    return;
  }

  try {
    const response = await fetch(
      `${CAMPSITE_SUPABASE_URL}/rest/v1/rpc/ping_campsite_lab`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": CAMPSITE_SUPABASE_PUBLISHABLE_KEY
        },
        body: "{}"
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase ping failed: ${response.status}`);
    }

    const data = await response.json();

    if (Array.isArray(data) && data[0]?.ok === true) {
      status.innerHTML = "🟢 Supabase接続OK";
      return;
    }

    throw new Error("Unexpected response");
  } catch (error) {
    console.warn("Supabase ping error:", error);
    status.innerHTML = "⚪ Supabase未接続";
  }
}

function renderCapacityMap(polygon, poi) {
  const mapElement = document.getElementById("capacityMap");

  if (!mapElement) return;

  if (typeof L === "undefined") {
    mapElement.innerHTML = `
      <div class="distance-warning">
        地図ライブラリを読み込めませんでした。
      </div>
    `;
    return;
  }

  if (capacityMapInstance) {
    capacityMapInstance.remove();
    capacityMapInstance = null;
  }

  capacityMapInstance = L.map("capacityMap", {
    zoomControl: true
  });

      const photoLayer = L.tileLayer(
    "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    {
      attribution:
        '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>',
      maxZoom: 18
    }
  );

  const osmLayer = L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19
    }
  );

  osmLayer.addTo(capacityMapInstance);

     const polygonLatLngs = polygon.map(point => [
    point.lat,
    point.lng
  ]);

  const areaLayer = L.polygon(polygonLatLngs, {
    weight: 2,
    opacity: 0.75,
    fillOpacity: 0.03
  }).addTo(capacityMapInstance);

  const existingPoiLayer = L.layerGroup()
    .addTo(capacityMapInstance);

  const addPoiLayer = L.layerGroup()
    .addTo(capacityMapInstance);

  poi.forEach(point => {
    const isAdd = point.type === "add";

    const label =
      isAdd
        ? `追加希望：${point.name}`
        : `既存：${point.name}`;

    const markerColor =
      isAdd
        ? "#f59e0b"
        : "#3b82f6";

    const marker = L.circleMarker([point.lat, point.lng], {
      radius: isAdd ? 6 : 4,
      color: markerColor,
      fillColor: markerColor,
      weight: 1.5,
      fillOpacity: 0.85
    })
      .bindPopup(`
        <strong>${escapeCapacityHtml(label)}</strong><br>
        種別：${escapeCapacityHtml(CAPACITY_LABELS[point.kind] || point.kind)}<br>
        レイヤー：${escapeCapacityHtml(point.layer || "未設定")}
      `);

    marker.addTo(
      isAdd
        ? addPoiLayer
        : existingPoiLayer
    );
  });

  L.control.layers(
    {
      "OpenStreetMap": osmLayer,
      "航空写真": photoLayer
    },
    {
      "活動範囲": areaLayer,
      "既存POI": existingPoiLayer,
      "追加希望POI": addPoiLayer
    },
    {
      position: "topright",
      collapsed: true
    }
  ).addTo(capacityMapInstance);

  capacityMapInstance.fitBounds(
    areaLayer.getBounds(),
    {
      padding: [18, 18]
    }
  );

  setTimeout(() => {
    capacityMapInstance?.invalidateSize();
  }, 100);
}

function escapeCapacityHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function renderCapacityPreviewBaseMap(polygon, poi) {
  const mapElement = document.getElementById("capacityPreviewMap");

  if (!mapElement) return;

  if (typeof L === "undefined") {
    mapElement.innerHTML = `
      <div class="distance-warning">
        地図ライブラリを読み込めませんでした。
      </div>
    `;
    return;
  }

  if (capacityPreviewMapInstance) {
    capacityPreviewMapInstance.remove();
    capacityPreviewMapInstance = null;
  }

  capacityPreviewMapInstance = L.map("capacityPreviewMap", {
    zoomControl: true
  });

  const photoLayer = L.tileLayer(
    "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    {
      attribution:
        '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>',
      maxZoom: 18
    }
  );

  const osmLayer = L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19
    }
  );

  osmLayer.addTo(capacityPreviewMapInstance);

  const polygonLatLngs = polygon.map(point => [
    point.lat,
    point.lng
  ]);

  const areaLayer = L.polygon(polygonLatLngs, {
    weight: 2,
    opacity: 0.75,
    fillOpacity: 0.03
  }).addTo(capacityPreviewMapInstance);

  const existingPoiLayer = L.layerGroup()
    .addTo(capacityPreviewMapInstance);

  const addPoiLayer = L.layerGroup()
    .addTo(capacityPreviewMapInstance);

  poi.forEach(point => {
    const isAdd = point.type === "add";

    const label =
      isAdd
        ? `追加希望：${point.name}`
        : `既存：${point.name}`;

    const markerColor =
      isAdd
        ? "#f59e0b"
        : "#3b82f6";

    const marker = L.circleMarker([point.lat, point.lng], {
      radius: isAdd ? 6 : 4,
      color: markerColor,
      fillColor: markerColor,
      weight: 1.5,
      fillOpacity: 0.85
    })
      .bindPopup(`
        <strong>${escapeCapacityHtml(label)}</strong><br>
        種別：${escapeCapacityHtml(CAPACITY_LABELS[point.kind] || point.kind)}<br>
        レイヤー：${escapeCapacityHtml(point.layer || "未設定")}
      `);

    marker.addTo(
      isAdd
        ? addPoiLayer
        : existingPoiLayer
    );
  });

  L.control.layers(
    {
      "OpenStreetMap": osmLayer,
      "航空写真": photoLayer
    },
    {
      "活動範囲": areaLayer,
      "既存POI": existingPoiLayer,
      "追加希望POI": addPoiLayer
    },
    {
      position: "topright",
      collapsed: true
    }
  ).addTo(capacityPreviewMapInstance);

  capacityPreviewMapInstance.fitBounds(
    areaLayer.getBounds(),
    {
      padding: [18, 18]
    }
  );

  setTimeout(() => {
    capacityPreviewMapInstance?.invalidateSize();
  }, 100);
}
function previewCandidatePoiPlacement() {
  const output = document.getElementById("candidatePreviewResult");
  const generateButton =
    document.getElementById("generateCandidatePoiButton");

  if (!capacityState) {
    alert("先に配置余地を確認してください。");
    return;
  }

  if (!capacityPreviewMapInstance) {
    alert("プレビューマップを読み込めませんでした。");
    return;
  }

  const counts = {
    pokestop: Number(
      document.getElementById("capacitySelect_pokestop")?.value || 0
    ),
    gym: Number(
      document.getElementById("capacitySelect_gym")?.value || 0
    ),
    power: Number(
      document.getElementById("capacitySelect_power")?.value || 0
    )
  };

  const total =
    counts.pokestop +
    counts.gym +
    counts.power;

  if (total <= 0) {
    alert("プレビューする候補数を1件以上選択してください。");
    return;
  }

  if (capacityState.estimate.points.length < total) {
    alert("選択数に対して配置余地が不足しています。");
    return;
  }

  const selectedPoints = pickBalancedCandidatePoints(
    capacityState.estimate.points,
    total
  );

  let index = 0;

  const grouped = {
    pokestop: [],
    gym: [],
    power: []
  };

  ["pokestop", "gym", "power"].forEach(kind => {
    for (let i = 0; i < counts[kind]; i++) {
      grouped[kind].push(selectedPoints[index]);
      index++;
    }
  });

  if (capacityPreviewCandidateLayer) {
    capacityPreviewCandidateLayer.remove();
  }

  capacityPreviewCandidateLayer = L.layerGroup()
    .addTo(capacityPreviewMapInstance);

  const candidatePoints = [
    ...grouped.pokestop.map((point, i) => ({
      ...point,
      kind: "pokestop",
      name: `候補ポケストップ${i + 1}`
    })),

    ...grouped.gym.map((point, i) => ({
      ...point,
      kind: "gym",
      name: `候補ジム${i + 1}`
    })),

    ...grouped.power.map((point, i) => ({
      ...point,
      kind: "power",
      name: `候補パワースポット${i + 1}`
    }))
  ];

  candidatePoints.forEach(point => {
    L.circleMarker([point.lat, point.lng], {
      radius: 7,
      color: "#a855f7",
      fillColor: "#a855f7",
      weight: 2,
      fillOpacity: 0.92
    })
      .bindPopup(`
        <strong>${escapeCapacityHtml(point.name)}</strong><br>
        種別：${escapeCapacityHtml(
          CAPACITY_LABELS[point.kind] || point.kind
        )}<br>
        状態：今回生成する候補
      `)
      .addTo(capacityPreviewCandidateLayer);
  });

  capacityPreviewState = {
    counts,
    grouped
  };

  if (generateButton) {
    generateButton.style.display = "block";
  }

  if (output) {
    output.innerHTML = `
      <div class="distance-warning" style="margin-top:14px;">
        <strong>候補POIをプレビューしました。</strong><br><br>
        ポケストップ候補：${counts.pokestop}件<br>
        ジム候補：${counts.gym}件<br>
        パワースポット候補：${counts.power}件<br><br>
        右側の地図で配置を確認してください。<br>
        再度プレビューボタンを押すと、別の配置案を表示できます。
      </div>
    `;
  }
}
function getCapacityDistanceToPolygonEdge(point, polygon) {
  let minDistance = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const start = polygon[i];
    const end = polygon[(i + 1) % polygon.length];

    const distance = getCapacityDistanceToSegment(
      point,
      start,
      end
    );

    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return minDistance;
}

function getCapacityDistanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return getCapacityDistance(point, start);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      (
        (point.x - start.x) * dx +
        (point.y - start.y) * dy
      ) /
      (
        dx * dx +
        dy * dy
      )
    )
  );

  const nearest = {
    x: start.x + t * dx,
    y: start.y + t * dy
  };

  return getCapacityDistance(point, nearest);
}
function renderPlacementSummaryCard(data) {
  const container = document.getElementById("placementResult");
  if (!container) return;

  const scoreData = calculatePlacementScore(data);

  container.className = "";
  container.innerHTML = `
    <div class="placement-card">
      <div class="placement-head">
        <div>
          <div class="placement-title">🌿 配置余地</div>
          <div class="placement-stars">${scoreData.stars}</div>
        </div>
          </div>

      <div class="placement-rank">${scoreData.rank}</div>

      <div class="placement-comment">
        ${scoreData.comment}
      </div>

      <button
        class="placement-detail-button"
        type="button"
        onclick="togglePlacementDetail()"
      >
        詳細を見る
      </button>

      <div id="placementDetail" class="placement-detail">
        <div class="placement-detail-row">
  <strong>活動範囲</strong>
  <span>${scoreData.areaLabel}・POI数${scoreData.poiVolumeLabel}</span>
</div>

        <div class="placement-detail-row">
          <strong>既存POI密度</strong>
          <span>${scoreData.densityLabel} / 既存 ${scoreData.existingCount}件 / ${scoreData.densityValueLabel}</span>
        </div>

        <div class="placement-detail-row">
  <strong>有効配置余地</strong>
  <span>
    ${scoreData.addRoomLabel} /
    約${scoreData.effectiveAreaLabel}
    （活動範囲の${scoreData.effectiveRateLabel}・既存POI40m円除外後）
  </span>
</div>

<div class="placement-detail-row">
  <strong>推定配置地点</strong>
  <span>40m条件後 約${data.estimate.points.length}地点</span>
</div>

        <div class="placement-detail-row">
          <strong>残容量</strong>
          <span>
            ポケストップ ${data.remaining.pokestop}件 /
            ジム ${data.remaining.gym}件 /
            パワースポット ${data.remaining.power}件
          </span>
        </div>
      </div>
    </div>
  `;
}

function calculatePlacementScore(data) {
  const polygon = data.polygon || [];
const poi = data.poi || [];
const estimateCount = data.estimate?.points?.length || 0;

const existingPoi = poi.filter(p => p.type !== "add");
const addPoi = poi.filter(p => p.type === "add");

const existingCount = existingPoi.length;
const addCount = addPoi.length;
let poiVolumeLabel = "標準";

if (existingCount >= 120) {
  poiVolumeLabel = "かなり多め";
} else if (existingCount >= 80) {
  poiVolumeLabel = "多め";
} else if (existingCount >= 40) {
  poiVolumeLabel = "やや多め";
} else if (existingCount <= 10) {
  poiVolumeLabel = "少なめ";
}

const area = calculateCapacityPolygonArea(polygon);

const effectiveFree = estimateEffectiveFreeAreaGrid(
  polygon,
  existingPoi,
  40,
  10
);

const effectiveArea = effectiveFree.effectiveArea;
const effectiveRate = effectiveFree.freeRatio;

  let areaScore = 0;
  let areaLabel = "未計算";

  if (area >= 750000) {
  areaScore = 40;
  areaLabel = "非常に広い";
} else if (area >= 400000) {
  areaScore = 37;
  areaLabel = "かなり広い";
} else if (area >= 200000) {
  areaScore = 34;
  areaLabel = "広い";
} else if (area >= 80000) {
  areaScore = 28;
  areaLabel = "標準";
} else if (area >= 30000) {
  areaScore = 22;
  areaLabel = "小さめ";
} else if (area >= 10000) {
  areaScore = 15;
  areaLabel = "狭い";
} else {
  areaScore = 8;
  areaLabel = "非常に狭い";
}

  const hectare = area > 0 ? area / 10000 : 1;
const density = existingCount / hectare;

let densityScore = 0;
let densityLabel = "標準";
let densityRiskLevel = "normal";
let densityCap = 100;

/*
  既存POI密度補正
  上野公園のような「広いけど既存POIが多すぎる場所」が満点にならないようにする
*/
if (density <= 1.5) {
  densityScore = 25;
  densityLabel = "低め";
} else if (density <= 3.5) {
  densityScore = 22;
  densityLabel = "適正";
} else if (density <= 5.5) {
  densityScore = 14;
  densityLabel = "やや高い";
  densityRiskLevel = "caution";
  densityCap = 79;
} else if (density <= 8) {
  densityScore = 7;
  densityLabel = "高い";
  densityRiskLevel = "high";
  densityCap = 69;
} else {
  densityScore = 2;
  densityLabel = "かなり高い";
  densityRiskLevel = "critical";
  densityCap = 59;
}

/*
  総数補正
  面積が広くても、既存POI数が多すぎる場合は評価上限を下げる
*/
if (existingCount >= 250 && density >= 5.5) {
  densityRiskLevel = "critical";
  densityLabel = "かなり高い";
  densityCap = 59;
} else if (existingCount >= 200 && density >= 5) {
  densityRiskLevel = "high";
  densityLabel = "高い";
  densityCap = 64;
} else if (existingCount >= 120 && density >= 4.5) {
  densityRiskLevel = "caution";
  densityLabel = "やや高い";
  densityCap = Math.min(densityCap, 74);
}

  let addRoomScore = 0;
let addRoomLabel = "少ない";

if (effectiveRate >= 0.65 && estimateCount >= 12) {
  addRoomScore = 25;
  addRoomLabel = "十分";
} else if (effectiveRate >= 0.45 && estimateCount >= 7) {
  addRoomScore = 20;
  addRoomLabel = "標準以上";
} else if (effectiveRate >= 0.25 && estimateCount >= 4) {
  addRoomScore = 15;
  addRoomLabel = "標準";
} else if (effectiveRate >= 0.10 && estimateCount >= 1) {
  addRoomScore = 8;
  addRoomLabel = "少なめ";
} else {
  addRoomScore = 2;
  addRoomLabel = "ほぼなし";
}

  let walkScore = 5;

  if (polygon.length >= 3 && area >= 20000) {
    walkScore += 2;
  }

  if (estimateCount >= 8) {
    walkScore += 3;
  } else if (estimateCount >= 4) {
    walkScore += 2;
  } else if (estimateCount >= 1) {
    walkScore += 1;
  }

  walkScore = Math.min(10, walkScore);

  const rawScore = Math.round(
  areaScore + densityScore + addRoomScore + walkScore
);

const score = Math.max(
  0,
  Math.min(
    densityCap,
    rawScore
  )
);

  let stars = "★☆☆☆☆";
  let rank = "別候補地も検討";
  let comment = "活動範囲内の余白が少なく、追加POIの配置自由度は低めです。別候補地や活動範囲の見直しも検討してください。";

  if (score >= 85) {
  stars = "★★★★★";
  rank = "かなり余地あり";
  comment = "この候補地は、既存POIの40m圏を除外しても有効配置余地が大きく、イベント時の分散歩行にも向いています。";
} else if (score >= 75) {
  stars = "★★★★★";
  rank = "良好";
  comment = "この候補地は、既存POIの40m圏を除外しても一定の有効配置余地があり、イベント時の分散歩行にも向いています。";
} else if (score >= 60) {
  stars = "★★★★☆";
  rank = "余地あり";
  comment = "この候補地は、40m条件後も配置余地があります。配置を工夫すれば、バランスの良いキャンプサイトにできます。";
} else if (score >= 40) {
  stars = "★★★☆☆";
  rank = "工夫が必要";
  comment = "40m条件後の配置余地は限られます。既存POI密度や追加位置の選定に注意が必要です。";
} else if (score >= 20) {
  stars = "★★☆☆☆";
  rank = "配置余地は少なめ";
  comment = "活動範囲内の有効配置余地は少なめです。別候補地や活動範囲の見直しも検討してください。";
}
if (densityRiskLevel === "critical") {
  if (score >= 40) {
    stars = "★★★☆☆";
    rank = "密度リスク高";
    comment =
      "この候補地は活動範囲が広く、40m条件後の配置余地はあります。ただし既存POI密度が非常に高いため、追加POIは密集エリアを避け、歩行分散に使える場所へ限定する必要があります。";
  } else if (score >= 20) {
    stars = "★★☆☆☆";
    rank = "密度リスク高・配置余地少なめ";
    comment =
      "既存POI密度が非常に高く、40m条件後の配置余地も限られます。追加POIの配置はかなり慎重に確認してください。";
  } else {
    stars = "★☆☆☆☆";
    rank = "別候補地も検討";
    comment =
      "既存POI密度が非常に高く、有効配置余地も少ないため、別候補地や活動範囲の見直しを検討してください。";
  }
} else if (densityRiskLevel === "high") {
  if (score >= 60) {
    stars = "★★★★☆";
    rank = "注意";
    comment =
      "この候補地は配置余地がありますが、既存POI密度が高めです。追加POIは既存POIが少ない外周部や、歩行分散につながる場所を優先してください。";
  } else if (score >= 40) {
    stars = "★★★☆☆";
    rank = "工夫が必要";
    comment =
      "既存POI密度が高めで、配置余地にも注意が必要です。追加位置は密集エリアを避けて慎重に選定してください。";
  } else if (score >= 20) {
    stars = "★★☆☆☆";
    rank = "配置余地は少なめ";
    comment =
      "既存POI密度が高めで、40m条件後の配置余地も少なめです。追加POIの配置は慎重に確認してください。";
  } else {
    stars = "★☆☆☆☆";
    rank = "別候補地も検討";
    comment =
      "既存POI密度が高く、有効配置余地も少ないため、別候補地や活動範囲の見直しを検討してください。";
  }
} else if (densityRiskLevel === "caution") {
  if (score >= 75) {
    stars = "★★★★☆";
    rank = "やや注意";
    comment =
      "この候補地は配置余地がありますが、既存POI密度がやや高めです。追加POIは既存POIが少ない場所や、歩行分散につながる位置を優先してください。";
  }
}

  return {
  score,
  stars,
  rank,
  comment,
  areaLabel: `${areaLabel} / ${formatCapacityArea(area)}`,
  densityLabel,
  densityValueLabel: `${density.toFixed(1)}件/ha`,
  addRoomLabel,
  effectiveAreaLabel: formatCapacityArea(effectiveArea),
  effectiveRateLabel: formatCapacityPercent(effectiveRate),
  poiVolumeLabel,
  existingCount,
  addCount
};
}

function calculateCapacityPolygonArea(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;

  const R = 6378137;
  let area = 0;

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];

    const lon1 = p1.lng * Math.PI / 180;
    const lon2 = p2.lng * Math.PI / 180;
    const lat1 = p1.lat * Math.PI / 180;
    const lat2 = p2.lat * Math.PI / 180;

    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  return Math.abs(area * R * R / 2);
}

function formatCapacityArea(area) {
  if (!area) return "未計算";
  if (area >= 10000) return `${(area / 10000).toFixed(1)}ha`;
  return `${Math.round(area).toLocaleString()}㎡`;
}
function estimateEffectiveFreeAreaGrid(
  polygon,
  existingPoi,
  radiusMeters = 40,
  gridMeters = 10
) {
  if (!Array.isArray(polygon) || polygon.length < 3) {
    return {
      effectiveArea: 0,
      blockedArea: 0,
      freeRatio: 0,
      sampleCount: 0,
      freeCount: 0,
      blockedCount: 0
    };
  }

  const polygonArea = calculateCapacityPolygonArea(polygon);

  if (!polygonArea) {
    return {
      effectiveArea: 0,
      blockedArea: 0,
      freeRatio: 0,
      sampleCount: 0,
      freeCount: 0,
      blockedCount: 0
    };
  }

  const meanLat =
    polygon.reduce((sum, p) => sum + p.lat, 0) / polygon.length;

  const metersPerLat = 111320;
  const metersPerLng =
    111320 * Math.cos(meanLat * Math.PI / 180);

  const projectedPolygon = polygon.map(p => ({
    x: p.lng * metersPerLng,
    y: p.lat * metersPerLat
  }));

  const projectedExisting = existingPoi.map(p => ({
    x: p.lng * metersPerLng,
    y: p.lat * metersPerLat
  }));

  const xs = projectedPolygon.map(p => p.x);
  const ys = projectedPolygon.map(p => p.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  let sampleCount = 0;
  let freeCount = 0;
  let blockedCount = 0;

  for (let x = minX; x <= maxX; x += gridMeters) {
    for (let y = minY; y <= maxY; y += gridMeters) {
      const sample = {
        x: x + gridMeters / 2,
        y: y + gridMeters / 2
      };

      if (!isCapacityPointInPolygon(sample, projectedPolygon)) {
        continue;
      }

      sampleCount++;

      const blocked = projectedExisting.some(p =>
        getCapacityDistance(sample, p) < radiusMeters
      );

      if (blocked) {
        blockedCount++;
      } else {
        freeCount++;
      }
    }
  }

  const freeRatio =
    sampleCount > 0
      ? freeCount / sampleCount
      : 0;

  const effectiveArea = polygonArea * freeRatio;
  const blockedArea = polygonArea - effectiveArea;

  return {
    effectiveArea,
    blockedArea,
    freeRatio,
    sampleCount,
    freeCount,
    blockedCount
  };
}

function formatCapacityPercent(value) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}
function togglePlacementDetail() {
  const detail = document.getElementById("placementDetail");
  if (!detail) return;

  detail.classList.toggle("show");
}