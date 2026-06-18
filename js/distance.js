function classifyDistanceRisk(distance) {
  if (distance < 20) return "密集";
  if (distance < 30) return "滞留";
  if (distance < 40) return "軽微";
  return null;
}
/* POI上限・内訳表示 */
const POI_LIMITS = {
  pokestop: 12,
  gym: 8,
  power: 5
};
let distanceLeafletMap = null;
let distanceLeafletLayerGroup = null;
function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function getDistanceMeters(a, b) {

  const R = 6371000;

  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;

  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;

  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
    Math.cos(lat2) *
    Math.sin(dLng / 2) ** 2;

  const c =
    2 * Math.atan2(
      Math.sqrt(aa),
      Math.sqrt(1 - aa)
    );

  return R * c;
}

function getPrecheckDuplicatePois() {
  const points = [];

  Object.entries(window._layerPoints || {}).forEach(([layerName, layerPoints]) => {
    const isCsvLayer = layerName === "CSV_POI";

    if (!isCsvLayer && !isDistanceTargetLayer(layerName)) {
      return;
    }

    (layerPoints || []).forEach(p => {
      points.push({
        ...p,
        layer: cleanLayerName(layerName),
        originalLayer: layerName
      });
    });
  });

  const duplicates = [];

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i];
      const b = points[j];
      const distance = getDistanceMeters(a, b);

      if (distance < 1) {
        duplicates.push({
          a,
          b,
          distance
        });
      }
    }
  }

  return duplicates;
}

function renderPrecheckDuplicatePoiHtml() {
  const duplicates = getPrecheckDuplicatePois();

  if (duplicates.length === 0) {
    return `
      <div style="
        margin:12px 0 0;
        padding:12px 14px;
        border-radius:12px;
        background:rgba(34,197,94,0.12);
        border:1px solid rgba(34,197,94,0.42);
        color:#dcfce7;
        line-height:1.7;
      ">
        <strong>✅ 重複POI候補はありません。</strong>
      </div>
    `;
  }

  return `
    <div style="
      margin:12px 0 0;
      padding:12px 14px;
      border-radius:12px;
      background:rgba(239,68,68,0.14);
      border:1px solid rgba(239,68,68,0.55);
      color:#fecaca;
      line-height:1.7;
    ">
      <strong style="color:#f87171;">
        ⚠ 重複POI候補：${duplicates.length}件
      </strong><br>
      距離チェックへ進む前に、同じ場所へ複数のPOIが入っていないか確認してください。<br><br>

      ${duplicates.map(item => `
        <div style="
          margin-top:8px;
          padding:10px;
          border-radius:10px;
          background:rgba(15,23,42,0.55);
        ">
          <strong>${item.distance.toFixed(1)}m</strong><br>
          ${escapeHtml(item.a.layer)}：${escapeHtml(item.a.name)}<br>
          × ${escapeHtml(item.b.layer)}：${escapeHtml(item.b.name)}
        </div>
      `).join("")}
    </div>
  `;
}
function getUserId() {
  let userId = localStorage.getItem("campsiteUserId");

  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("campsiteUserId", userId);
  }

  return userId;
}
function getJstIsoString(date = new Date()) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);

  return jst
    .toISOString()
    .replace("Z", "+09:00");
}
async function sendAnalytics(data) {
  fetch(
    "https://script.google.com/macros/s/AKfycbxldgzcVeez7AEQk0MXbd569zRIQ_4Z8hHBKrO3lBA9bePX8C3Z5HTqjo9YnbBVTZpl/exec",
    {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    }
  ).catch(() => {});
}
function sendDistanceCheckAnalytics(points, poiVolumeCounts, poiCounts, expansionRate, displayCounts, campsite) {
  const parkName = guessParkNameFromPoints(points);

  sendAnalytics({
    timestamp: getJstIsoString(),
    userId: getUserId(),

    toolVersion: window.APP_VERSION,
    action: "distance_check",

    parkName: parkName,
    parkNameSource: parkName ? "poi_name" : "",

    hasPolygon: window._hasPolygon === true,
    inputType: window._inputType || "unknown",
    deviceType: window.innerWidth <= 720 ? "mobile" : "desktop",

    totalPoiCount: points.length,
    existingPoiCount: poiVolumeCounts.existing,
    addedPoiCount: poiVolumeCounts.added,
    expansionRate: expansionRate,

    pokestopCount: poiCounts.pokestop,
    gymCount: poiCounts.gym,
    powerspotCount: poiCounts.power,

    denseCount: displayCounts.dense,
    stayCount: displayCounts.stay,
    lightCount: displayCounts.light,

    trafficOk: campsite.trafficOk,

    hasOpenSpace:
      document.getElementById("hasOpenSpace")?.checked,

    hasLoopRoute:
      document.getElementById("hasLoopRoute")?.checked,

    hasWaitingSpace:
      document.getElementById("hasWaitingSpace")?.checked,

    score: campsite.score,
    rank: campsite.rank,
    summary: campsite.summary
  });
}
function getPoiTypeFromLayerName(layerName) {
  const name = String(layerName || "")
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s =>
      String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    );

  if (
    name.includes("パワースポット") ||
    name.includes("パワスポ") ||
    name.includes("powerspot") ||
    name.includes("power")
  ) {
    return "power";
  }

  if (
    name.includes("ジム") ||
    name.includes("gym")
  ) {
    return "gym";
  }

  if (
    name.includes("ポケスト") ||
    name.includes("pokestop") ||
    name.includes("poke stop")
  ) {
    return "pokestop";
  }

  return null;
}
function normalizeLayerNameText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s =>
      String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    );
}

function isAddedLayerName(layerName) {
  const name = normalizeLayerNameText(layerName);

  return (
    name.includes("追加") ||
    name.includes("新規") ||
    name.includes("希望") ||
    name.includes("proposed") ||
    name.includes("new") ||
    name.includes("add")
  );
}
function extractParkNameFromText(text) {
  const value = String(text || "");

  const match = value.match(/([^\s　、,「」（）()]+公園)/);

  if (match) {
    return match[1];
  }

  const parkMatch = value.match(/([A-Za-z0-9\s'-]+Park)/i);

  if (parkMatch) {
    return parkMatch[1].trim();
  }

  return "";
}

function guessParkNameFromPoints(points = []) {
  const parkCounts = {};

  points.forEach(p => {
    const name = p.name || "";
    const layer = p.layer || "";

    const parkName =
      extractParkNameFromText(name) ||
      extractParkNameFromText(layer);

    if (!parkName) return;

    parkCounts[parkName] = (parkCounts[parkName] || 0) + 1;
  });

  const entries = Object.entries(parkCounts)
    .sort((a, b) => b[1] - a[1]);

  return entries[0]?.[0] || "";
}
function countPoiTypesFromLayers(pointsByLayer) {
  const counts = {
    pokestop: 0,
    gym: 0,
    power: 0
  };

  Object.entries(pointsByLayer || {}).forEach(([layerName, points]) => {
    if (!Array.isArray(points)) return;

    const isAddLayer =
      layerName.includes("追加") ||
      layerName.includes("新規") ||
      layerName.includes("CA ");

    if (!isAddLayer) return;

    const type = getPoiTypeFromLayerName(layerName);

    if (!type) return;

    counts[type] += points.length;
  });

  return counts;
}
function countExistingAndAddedPoi(pointsByLayer) {
  const counts = {
    existing: 0,
    added: 0
  };

  Object.entries(pointsByLayer || {}).forEach(([layerName, points]) => {
    if (!Array.isArray(points)) return;

    if (isAuxiliaryLayer(layerName)) {
  return;
}

    const isExisting = layerName.includes("既存");

    const isAdded =
      layerName.includes("追加") ||
      layerName.includes("新規") ||
      layerName.includes("CA ");

    if (isExisting) {
      counts.existing += points.length;
    } else if (isAdded) {
      counts.added += points.length;
    }
  });

  return counts;
}
function renderPoiCountRow(label, current, limit, icon, type) {
  const isOver = current > limit;
  const percent = Math.min(100, Math.round((current / limit) * 100));

  return `
  <div class="poi-count-card ${type} ${isOver ? "poi-count-over" : ""}">
      <div class="poi-count-head">
        <span class="poi-count-icon">${icon}</span>
        <span class="poi-count-label">${label}</span>
        <span class="poi-count-value">${current} / ${limit}${isOver ? " ⚠" : ""}</span>
      </div>

      <div class="poi-count-meter">
        <div class="poi-count-meter-fill" style="width:${percent}%;"></div>
      </div>
    </div>
  `;
}

function renderPoiCountHtml(counts) {
  return `
    <div class="poi-count-box">
      <h3>追加POI内訳</h3>
      ${renderPoiCountRow("ポケストップ", counts.pokestop, POI_LIMITS.pokestop, "🔵", "pokestop")}
      ${renderPoiCountRow("ジム", counts.gym, POI_LIMITS.gym, "🟡", "gym")}
      ${renderPoiCountRow("パワースポット", counts.power, POI_LIMITS.power, "🟣", "power")}
    </div>
    <div style="
      margin:10px 0 0;
      padding:10px 12px;
      border-radius:10px;
      background:rgba(245,158,11,0.10);
      border:1px solid rgba(245,158,11,0.30);
      color:#fde68a;
      font-size:13px;
      line-height:1.7;
    ">
      ※追加POIは最大25件です。<br>
      必ず25件追加されるわけではありません。<br>
      実際の追加件数は、キャンプサイトの広さや既存POIの密度などにより調整されます。
    </div>
  `;
}
function renderDistancePrecheckFooterHtml() {
  return `
    ${renderPrecheckDuplicatePoiHtml()}

    <div style="
      margin:18px 0 8px;
      padding:16px;
      border:1px solid rgba(56,189,248,0.55);
      border-radius:14px;
      background:rgba(14,165,233,0.10);
      color:#e5e7eb;
      line-height:1.7;
    ">
      <strong style="
        display:block;
        margin-bottom:6px;
        color:#7dd3fc;
        font-size:17px;
      ">
        ✅ STEP 1：事前チェック完了
      </strong>

      読み込み内容と追加POI内訳を確認しました。<br>
      続いて、下の「距離チェック」へ進んでください。

      <button
        type="button"
        onclick="scrollToDistanceCheckStep()"
        style="
          width:100%;
          margin-top:14px;
          padding:14px 16px;
          border:none;
          border-radius:12px;
          background:linear-gradient(135deg, #2563eb, #7c3aed);
          color:white;
          font-weight:800;
          font-size:16px;
          cursor:pointer;
        "
      >
        ↓ STEP 2：距離チェックへ進む
      </button>
    </div>
  `;
}
function scrollToDistanceCheckStep() {
  const target = document.getElementById("distanceCheckStep");

  if (!target) return;

  target.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}
function getPoiLimitWarningHtml(counts) {
  const warnings = [];

  if (counts.pokestop > POI_LIMITS.pokestop) {
    warnings.push(
      `ポケストップ：${counts.pokestop}件 / 上限${POI_LIMITS.pokestop}件`
    );
  }

  if (counts.gym > POI_LIMITS.gym) {
    warnings.push(
      `ジム：${counts.gym}件 / 上限${POI_LIMITS.gym}件`
    );
  }

  if (counts.power > POI_LIMITS.power) {
    warnings.push(
      `パワースポット：${counts.power}件 / 上限${POI_LIMITS.power}件`
    );
  }

  const total =
    counts.pokestop +
    counts.gym +
    counts.power;

  if (total > 25) {
    warnings.push(
      `追加POI合計：${total}件 / 上限25件`
    );
  }

  if (warnings.length === 0) {
    return "";
  }

  return `
    <div style="
      margin:12px 0;
      padding:12px 14px;
      border:1px solid rgba(239,68,68,0.75);
      border-radius:10px;
      background:rgba(239,68,68,0.14);
      color:#fecaca;
      line-height:1.7;
    ">
      <strong style="color:#f87171;">
        ⚠ 追加POIの上限を超えています
      </strong><br>
      ${warnings.map(w => `・${w}`).join("<br>")}
      <br>
      <span style="color:#e5e7eb;">
        内訳を調整してから提出してください。
      </span>
    </div>
  `;
}

function isAuxiliaryLayer(layerName) {
  const name = String(layerName || "")
    .toLowerCase()
    .replace(/\s+/g, "");

  return (
    name.includes("円") ||
    name.includes("30m") ||
    name.includes("40m") ||
    name.includes("buffer") ||
    name.includes("100ft") ||
    name.includes("100feet") ||
    name.includes("100フィート") ||
    name.includes("ダミー")
  );
}

function isDistanceTargetLayer(layerName) {
  const originalName = String(layerName || "");
  const name = originalName.toLowerCase();

  if (isAuxiliaryLayer(originalName)) {
    return false;
  }

  return (
    originalName.includes("既存") ||
    originalName.includes("追加") ||
    originalName.includes("追加希望") ||
    name.includes("current") ||
    name.includes("existing") ||
    name.includes("addition") ||
    name.includes("additions") ||
    name.includes("proposed") ||
    name.includes("new") ||
    name.includes("ebene")
  );
}
function renderDistanceLoadErrorHtml(title, message = "") {
  return `
    <div class="distance-warning" style="
      margin-top:12px;
      padding:14px;
      border:1px solid rgba(239,68,68,0.65);
      border-radius:12px;
      background:rgba(239,68,68,0.14);
      color:#fecaca;
      line-height:1.7;
    ">
      <strong style="color:#f87171;">
        ⚠ ${escapeHtml(title)}
      </strong>

      ${message ? `
        <div style="
          margin-top:8px;
          color:#e5e7eb;
          font-size:13px;
        ">
          ${message}
        </div>
      ` : ""}
    </div>
  `;
}
  async function loadDistanceFile() {
  const fileInput = document.getElementById("distanceFile");
  const container = document.getElementById("distanceLayerList");
  const summary = document.getElementById("distancePoiSummary");
  const distanceResult = document.getElementById("distanceResult");

  if (!fileInput.files.length) {
    return;
  }

  const file = fileInput.files[0];
  const fileName = file.name.toLowerCase();

  window._layerPoints = {};
  window._hasPolygon = false;
  window._activityPolygons = [];

  if (container) {
    container.innerHTML = "";
  }

  if (summary) {
    summary.innerHTML = "";
  }

  if (distanceResult) {
    distanceResult.innerHTML = "";
  }

  const isKmz = fileName.endsWith(".kmz");
  const isIphoneKmzZip =
    fileName.endsWith(".kmz.zip");

  if (isIphoneKmzZip) {
    if (summary) {
      summary.innerHTML = renderDistanceLoadErrorHtml(
        "末尾の .zip を削除してください",
        `
          iPhoneでは、KMZファイルが <strong>.kmz.zip</strong> として保存される場合があります。<br>
          「ファイル」アプリで対象ファイルを長押しし、<br>
          「名称変更」から末尾の <strong>.zip</strong> だけを削除してください。<br><br>

          例：<strong>campsite_2026612.kmz.zip</strong><br>
          ↓<br>
          <strong>campsite_2026612.kmz</strong>
        `
      );
    }

    return;
  }

  if (!isKmz) {
    if (summary) {
      summary.innerHTML = renderDistanceLoadErrorHtml(
        "完成KMZを選択してください",
        `
          距離チェックでは、Google My Mapsから書き出した<br>
          <strong>.kmz</strong> 形式の完成ファイルを読み込みます。<br>
          選択されたファイル：${escapeHtml(file.name)}
        `
      );
    }

    return;
  }

  window._inputType = "kmz";

  try {
    const result =
      await extractLayersFromKML(file);

    if (result.errorCode === "KML_NOT_FOUND") {
      if (summary) {
        summary.innerHTML = renderDistanceLoadErrorHtml(
          "KMZ内にKMLファイルが見つかりません",
          `
            Google My Mapsから書き出した完成KMZか確認してください。<br>
            KMZ内にKMLファイルが見つからないため、読み込めません。
          `
        );
      }

      return;
    }

    const layerNames =
      Object.keys(result.pointsByLayer || {});

    if (layerNames.length === 0) {
      if (summary) {
        summary.innerHTML = renderDistanceLoadErrorHtml(
          "KMZ内にPOIレイヤーが見つかりません",
          `
            Google My Mapsから書き出した完成KMZか確認してください。<br>
            KML内にPOIレイヤーがない場合や、POIが登録されていない場合は読み込めません。
          `
        );
      }

      return;
    }

    window._layerPoints =
  result.pointsByLayer;

window._activityPolygons =
  result.polygons || [];

window._hasPolygon =
  window._activityPolygons.length > 0;

    const debugInfo =
      getTargetLayerDebugInfo();

    if (
      debugInfo.targetLayerCount === 0 ||
      debugInfo.targetPointCount === 0
    ) {
      if (summary) {
        summary.innerHTML = renderDistanceLoadErrorHtml(
          "判定対象となるPOIが見つかりません",
          `
            「既存」「追加」「追加希望」などのPOIレイヤーが含まれているか確認してください。<br>
            円・Buffers・活動範囲ポリゴンなどの補助レイヤーだけでは距離判定できません。
          `
        );
      }

      return;
    }

    if (container) {
      renderLayerSelector(
        result.layers,
        container
      );
    }

    if (summary) {
      const counts =
        countPoiTypesFromLayers(
          window._layerPoints
        );

      summary.innerHTML =
        renderDistanceUploadSummary() +
        renderPoiCountHtml(counts) +
        renderDistancePrecheckFooterHtml();
    }

  } catch (error) {
    console.error(
      "距離チェック用ファイルの読込に失敗しました",
      error
    );

    if (summary) {
      summary.innerHTML = renderDistanceLoadErrorHtml(
        "ファイルを開けませんでした",
        `
          ファイルが破損しているか、正しい形式で保存されていない可能性があります。<br>
          Google My Mapsから完成KMZを書き出し直して、もう一度お試しください。
        `
      );
    }
  }
}
function extractPolygonsFromXml(xml) {
  const polygons = [];

  const polygonNodes =
    Array.from(
      xml.getElementsByTagName("Polygon")
    );

  polygonNodes.forEach(polygonNode => {
    let parent =
      polygonNode.parentElement;

    let folderName = "";

    while (parent) {
      if (
        parent.localName === "Folder" ||
        parent.tagName === "Folder"
      ) {
        const folderNameNode =
          Array.from(parent.children)
            .find(child => {
              return (
                child.localName === "name" ||
                child.tagName === "name"
              );
            });

        folderName =
          folderNameNode?.textContent || "";

        break;
      }

      parent =
        parent.parentElement;
    }

    /*
      30m円・40m円・Buffersなどは、
      活動範囲ポリゴンとして表示しない。
    */
    if (
      folderName &&
      isAuxiliaryLayer(folderName)
    ) {
      return;
    }

    const coordinatesNode =
      polygonNode
        .getElementsByTagName("coordinates")[0];

    if (!coordinatesNode) {
      return;
    }

    const latLngs =
      coordinatesNode
        .textContent
        .trim()
        .split(/\s+/)
        .map(coordText => {
          const [
            lng,
            lat
          ] =
            coordText
              .split(",")
              .map(Number);

          if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lng)
          ) {
            return null;
          }

          return [
            lat,
            lng
          ];
        })
        .filter(Boolean);

    if (latLngs.length < 3) {
      return;
    }

    polygons.push(
      latLngs
    );
  });

  return polygons;
}
async function extractLayersFromKML(file) {
  let kmlText = null;
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".kml")) {
    kmlText = await file.text();
  } else if (fileName.endsWith(".kmz") || fileName.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file);

    for (const name in zip.files) {
      if (name.toLowerCase().endsWith(".kml")) {
        kmlText = await zip.files[name].async("text");
        break;
      }

      if (name.toLowerCase().endsWith(".kmz")) {
        const kmzBlob = await zip.files[name].async("blob");
        const kmzZip = await JSZip.loadAsync(kmzBlob);

        for (const innerName in kmzZip.files) {
          if (innerName.toLowerCase().endsWith(".kml")) {
            kmlText = await kmzZip.files[innerName].async("text");
            break;
          }
        }
      }
    }
  }

  if (!kmlText) {
  return {
  layers: [],
  pointsByLayer: {},
  polygons: [],
  errorCode: "KML_NOT_FOUND"
};
}

const xml =
  new DOMParser()
    .parseFromString(
      kmlText,
      "application/xml"
    );

const polygons =
  extractPolygonsFromXml(
    xml
  );

window._hasPolygon =
  polygons.length > 0;

const pointsByLayer =
  extractPointsByLayer(
    xml
  );

const layers =
  Object.keys(
    pointsByLayer
  );

return {
  layers,
  pointsByLayer,
  polygons
};
}
function getExtendedDataValue(pm, keyName) {
  const dataNodes = Array.from(pm.getElementsByTagName("Data"));

  for (const dataNode of dataNodes) {
    const nameAttr = dataNode.getAttribute("name");

    if (nameAttr === keyName) {
      return dataNode.getElementsByTagName("value")[0]?.textContent || "";
    }
  }

  return "";
}

function getPlacemarkPoiName(pm) {
  const extendedName =
    getExtendedDataValue(pm, "名前") ||
    getExtendedDataValue(pm, "name") ||
    getExtendedDataValue(pm, "title");

  if (extendedName.trim()) {
    return extendedName.trim();
  }

  const placemarkName =
    pm.getElementsByTagName("name")[0]?.textContent || "";

  if (
    placemarkName.trim() &&
    placemarkName.trim() !== "無題"
  ) {
    return placemarkName.trim();
  }

  return "無題";
}
function extractPointsByLayer(xml) {
  const result = {};

  const folders = Array.from(xml.getElementsByTagName("Folder"));

  folders.forEach(folder => {
    const layerName =
      folder.getElementsByTagName("name")[0]?.textContent || "無名レイヤー";

    const placemarks = Array.from(folder.getElementsByTagName("Placemark"));

    result[layerName] = placemarks.map(pm => {
      const point = pm.getElementsByTagName("Point")[0];
      if (!point) return null;

      const coord = point.getElementsByTagName("coordinates")[0]?.textContent;
      if (!coord) return null;

      const [lng, lat] = coord.trim().split(",").map(Number);
      if (isNaN(lat) || isNaN(lng)) return null;

      return {
  lat,
  lng,
  name: getPlacemarkPoiName(pm),
  layer: layerName
};
    }).filter(Boolean);
  });

  return result;
}

function renderLayerSelector(layers, container) {
  container.innerHTML = "";

  const targetLayers = layers.filter(name => {
    const points = window._layerPoints[name] || [];

    if (!points.length) {
      return false;
    }

    return isDistanceTargetLayer(name);
  });

  const polygonCount =
    window._activityPolygons?.length || 0;

  if (targetLayers.length === 0 && polygonCount === 0) {
    container.innerHTML = "判定できるPOIレイヤーがありません。";
    return;
  }

  container.innerHTML = `
    ${targetLayers.map(name => `
      <div class="layer-row">
        <strong>${escapeHtml(cleanLayerName(name))}</strong>
        <span class="note">（${window._layerPoints[name]?.length || 0}件）</span>
      </div>
    `).join("")}

    <div class="layer-row">
      <strong>活動範囲ポリゴン</strong>
      <span class="note">（${polygonCount}件）</span>
    </div>
  `;
}

function getTargetLayerDebugInfo() {
  const layerPoints = window._layerPoints || {};
  const allLayerNames = Object.keys(layerPoints);

  const targetLayerNames = allLayerNames.filter(layerName => {
    if (layerName === "CSV_POI") return true;

    return isDistanceTargetLayer(layerName);
  });

  let allPointCount = 0;
  let targetPointCount = 0;

  allLayerNames.forEach(layerName => {
    allPointCount += layerPoints[layerName]?.length || 0;
  });

  targetLayerNames.forEach(layerName => {
    targetPointCount += layerPoints[layerName]?.length || 0;
  });

  return {
    allLayerCount: allLayerNames.length,
    targetLayerCount: targetLayerNames.length,
    allPointCount,
    targetPointCount,
    targetLayerNames
  };
}
function renderDistanceUploadSummary() {
  const info = getTargetLayerDebugInfo();

  return `
    <div class="distance-warning" style="
      margin-top:12px;
      border:1px solid rgba(56,189,248,0.45);
      background:rgba(14,165,233,0.10);
    ">
      <strong>読み込み内容の確認</strong><br><br>
      全レイヤー数：${info.allLayerCount}件<br>
      判定対象レイヤー数：${info.targetLayerCount}件<br>
      全POI数：${info.allPointCount}件<br>
      判定対象POI数：${info.targetPointCount}件<br>
活動範囲ポリゴン：${window._hasPolygon ? `あり（${window._activityPolygons?.length || 0}件）` : "なし"}<br>

${window._hasPolygon ? "" : `
  <div style="
    margin-top:10px;
    padding:10px 12px;
    border-radius:10px;
    background:rgba(245,158,11,0.14);
    border:1px solid rgba(245,158,11,0.35);
    color:#fde68a;
    line-height:1.7;
  ">
    ⚠ 活動範囲ポリゴンが見つかりません。<br>
    Google My Mapsで、実際に歩く範囲や活動エリアをポリゴンで囲んだレイヤーを作成してください。
  </div>
`}
<br>
<strong>判定対象レイヤー</strong><br>
${info.targetLayerNames.map(name => escapeHtml(name)).join("<br>") || "なし"}
    </div>
  `;
}
function cleanLayerName(name) {
  return name
    .replace("既存の", "")
    .replace("既存", "")
    .trim();
}

function getStars(score) {
  if (score >= 85) return "⭐⭐⭐⭐⭐";
  if (score >= 70) return "⭐⭐⭐⭐☆";
  if (score >= 50) return "⭐⭐⭐☆☆";
  return "⭐⭐☆☆☆";
}
function getRankColor(rank) {
  if (rank === "S") return "#a855f7";
  if (rank === "A") return "#3b82f6";
  if (rank === "B") return "#22c55e";
  return "#ef4444";
}

function getScoreBar(score, color) {
  return `
  <div style="margin-top:6px;">
    <div style="
      width:100%;
      height:10px;
      background:#1e293b;
      border-radius:6px;
      overflow:hidden;
    ">
      <div style="
        width:${score}%;
        height:100%;
        background:${color};
      "></div>
    </div>
  </div>
  `;
}
function getPoiRiskSummary(warnings) {
  const riskMap = new Map();

  const priority = {
    "密集": 4,
    "滞留": 3,
    "通行": 2,
    "軽微": 1
  };

  warnings.forEach(w => {
    [w.a, w.b].forEach(p => {
      const key = `${p.layer}:${p.name}`;

      if (!riskMap.has(key)) {
        riskMap.set(key, {
          name: p.name,
          layer: p.layer,
          maxType: "軽微",
          counts: { 密集: 0, 滞留: 0, 通行: 0, 軽微: 0 }
        });
      }

      const item = riskMap.get(key);
      item.counts[w.type || "軽微"]++;

      if (priority[w.type || "軽微"] > priority[item.maxType]) {
        item.maxType = w.type || "軽微";
      }
    });
  });

  return Array.from(riskMap.values()).sort((a, b) => {
    return priority[b.maxType] - priority[a.maxType];
  });
}

function getRiskStyle(type) {
  if (type === "密集") return { icon: "🔴", color: "#ef4444" };
  if (type === "滞留") return { icon: "🟠", color: "#f97316" };
  if (type === "通行") return { icon: "🔵", color: "#3b82f6" };
  return { icon: "⚪", color: "#94a3b8" };
}
function getRiskAccordionHtml(warnings) {
  const groups = {
    "密集": {
      target: [],
      reference: []
    },
    "滞留": {
      target: [],
      reference: []
    },
    "軽微": {
      target: [],
      reference: []
    }
  };

  warnings.forEach(w => {
    const type = w.type || "軽微";

    const isExistingA = (w.a.originalLayer || "").includes("既存");
    const isExistingB = (w.b.originalLayer || "").includes("既存");
    const isReference = isExistingA && isExistingB;

    if (!groups[type]) return;

    if (isReference) {
      groups[type].reference.push(w);
    } else {
      groups[type].target.push(w);
    }
  });

  const settings = {
    "密集": {
      icon: "🔴",
      color: "#ef4444",
      open: false,
      label: "密集（20m未満）"
    },
    "滞留": {
      icon: "🟠",
      color: "#f97316",
      open: false,
      label: "滞留（20m以上30m未満）"
    },
    "軽微": {
      icon: "⚪",
      color: "#94a3b8",
      open: false,
      label: "軽微（30m以上40m未満）"
    }
  };

  function renderWarningCard(w, isReference) {
  const isLight = w.type === "軽微";

  let cardColor = "#ef4444";
  let label = "⚠ 調整対象";
  let message = "30m未満です。再確認をお願いします。";

  if (isLight) {
    cardColor = "#94a3b8";
    label = "△ 調整可能距離";
    message = "30m以上40m未満です。40m基本には届きませんが、30m調整圏内として確認します。";
  }

  if (isReference) {
    cardColor = "#94a3b8";
    label = "ℹ 参考";
    message = "既存POI同士の近接です。追加POIの調整対象には含めません。";
  }

  return `
    <div style="
      margin:10px 0;
      padding:10px;
      border-radius:10px;
      background:rgba(15,23,42,0.65);
      border:1px solid rgba(148,163,184,0.25);
    ">
      <strong style="color:${cardColor};">
        ${label}（${w.distance.toFixed(1)}m）
      </strong><br>
      ${escapeHtml(w.a.layer)}：${escapeHtml(w.a.name)}<br>
× ${escapeHtml(w.b.layer)}：${escapeHtml(w.b.name)}<br>
      → ${message}
    </div>
  `;
}

  return `
    <div class="distance-warning">
      <strong>分類別チェック</strong><br><br>

      ${Object.keys(groups).map(type => {
        const s = settings[type];
        const targetList = groups[type].target;
        const referenceList = groups[type].reference;
        const totalCount = targetList.length + referenceList.length;

        return `
          <details ${s.open ? "open" : ""} style="
            margin-bottom:16px;
            padding:14px 14px 12px 16px;
            border-radius:14px;
            background:rgba(15,23,42,0.45);
            border:1px solid rgba(148,163,184,0.22);
            border-left:6px solid ${s.color};
          ">
            <summary style="
              cursor:pointer;
              font-weight:bold;
              color:${s.color};
              font-size:16px;
              line-height:1.7;
            ">
              ${s.icon} ${s.label}（${totalCount}件）
            </summary>

            <div style="
              margin-top:10px;
              padding:8px 0 0 2px;
              border-top:1px solid rgba(148,163,184,0.18);
            ">
              <div style="
                margin-bottom:10px;
                font-size:13px;
                color:#cbd5e1;
              ">
                ${type === "軽微" ? "調整可能距離" : "調整対象"}：${targetList.length}件 / 参考：${referenceList.length}件
              </div>

              <details style="
                margin-bottom:10px;
                padding:10px 12px;
                border-radius:12px;
                background:rgba(239,68,68,0.08);
                border:1px solid rgba(239,68,68,0.22);
              ">
              <summary style="
  cursor:pointer;
  font-weight:bold;
  color:${type === "軽微" ? "#cbd5e1" : "#fca5a5"};
">
  ${type === "軽微" ? "△ 調整可能距離" : "⚠ 調整対象"}（${targetList.length}件）
</summary>
                <div style="margin-top:8px;">
                  ${targetList.length === 0 ? `
                    <div style="opacity:0.7;">該当なし</div>
                  ` : targetList.map(w => renderWarningCard(w, false)).join("")}
                </div>
              </details>

              <details style="
                margin-bottom:4px;
                padding:10px 12px;
                border-radius:12px;
                background:rgba(148,163,184,0.08);
                border:1px solid rgba(148,163,184,0.18);
              ">
                <summary style="
                  cursor:pointer;
                  font-weight:bold;
                  color:#cbd5e1;
                ">
                  ℹ 参考：既存POI同士（${referenceList.length}件）
                </summary>

                <div style="margin-top:8px;">
                  ${referenceList.length === 0 ? `
                    <div style="opacity:0.7;">該当なし</div>
                  ` : referenceList.map(w => renderWarningCard(w, true)).join("")}
                </div>
              </details>
            </div>
          </details>
        `;
      }).join("")}
    </div><br>
  `;
}
function calculateCampsiteScore(points, warnings) {
  let score = 100;

  let under20 = 0;
  let under30 = 0;
  let under40 = 0;
  let distancePenalty = 0;

  warnings.forEach(w => {
  const d = w.distance;

  if (d < 20) {
  distancePenalty += 4;
  under20++;
} else if (d < 30) {
  distancePenalty += 2;
  under30++;
} else if (d < 40) {
  distancePenalty += 0.5;
  under40++;
}
});

distancePenalty = Math.min(distancePenalty, 25);
  score -= distancePenalty;

  let stayPenalty = 0;

  warnings.forEach(w => {
    const d = w.distance;
    const a = (w.a.layer || "").toLowerCase();
    const b = (w.b.layer || "").toLowerCase();

    const aPower = a.includes("power") || a.includes("パワ");
    const bPower = b.includes("power") || b.includes("パワ");
    const aGym = a.includes("gym") || a.includes("ジム");
    const bGym = b.includes("gym") || b.includes("ジム");

    if (aPower && bPower) {
      if (d < 20) stayPenalty += 4;
      else if (d < 30) stayPenalty += 2;
    }

    if (aGym && bGym) {
      if (d < 20) stayPenalty += 2;
      else if (d < 30) stayPenalty += 1;
    }

    if ((aGym && bPower) || (aPower && bGym)) {
      if (d < 30) stayPenalty += 3;
    }
  });

  stayPenalty = Math.min(stayPenalty, 20);
  score -= stayPenalty;

  const trafficOk = document.getElementById("trafficOk")?.checked;
  score += trafficOk ? 3 : -5;

  let env = 0;
  if (document.getElementById("hasOpenSpace")?.checked) env += 6;
  if (document.getElementById("hasLoopRoute")?.checked) env += 5;
  if (document.getElementById("hasWaitingSpace")?.checked) env += 4;

  env = Math.min(env, 15);
  score += env;

  score = Math.round(Math.max(0, Math.min(100, score)));

  let rank = "C";
  let label = "調整あり";

  if (score >= 85) {
  rank = "S";
  label = "理想";
} else if (score >= 70) {
  rank = "A";
  label = "かなり良い";
} else if (score >= 60) {
  rank = "B";
  label = "良好";
} else {
  rank = "C";
  label = "調整推奨";
}

  let type = "バランス型";
  if (under20 > 0 || under30 >= 5) {
    type = "密集注意型";
  } else if (!trafficOk) {
    type = "通行注意型";
  } else if (trafficOk && env >= 10) {
    type = "回遊・滞留向き";
  }

  const comments = [];
if (under20 > 0) comments.push("密集あり");
if (under30 > 0) comments.push("滞留あり");
if (!trafficOk) comments.push("通行注意");
if (env >= 10) comments.push("環境良好");

// 👇ここに追加
let summary = "バランスの取れた拠点です";

if (under20 > 0) {
  summary = "密集があり、配置調整が必要です";
} else if (under30 > 3) {
  summary = "やや滞留が発生しやすい配置です";
} else if (!trafficOk) {
  summary = "通行面に注意が必要な拠点です";
} else if (env >= 10) {
  summary = "非常に遊びやすい理想的な拠点です";
}
  return {
    score,
    rank,
    type,
    label,
    under20,
    under30,
    under40,
    trafficOk,
    comments,
    summary
  };
}
async function runDistanceCheck() {
  setWorkflowStep("distance");
  const result = document.getElementById("distanceResult");

  const points = [];

  Object.entries(window._layerPoints || {}).forEach(([layerName, layerPoints]) => {
  const isCsvLayer = layerName === "CSV_POI";

  if (!isCsvLayer && !isDistanceTargetLayer(layerName)) {
    return;
  }

  layerPoints.forEach(p => {
      points.push({
        ...p,
        layer: cleanLayerName(layerName),
        originalLayer: layerName
      });
    });
  });

  if (points.length < 2) {
    result.innerHTML = "POIが2件以上必要です。";
    return;
  }

  const warnings = [];
const duplicatePois = [];

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
const a = points[i];
const b = points[j];
const isCsvA = (a.originalLayer || a.layer || "") === "CSV_POI";
const isCsvB = (b.originalLayer || b.layer || "") === "CSV_POI";

if (
  !isCsvA &&
  !isDistanceTargetLayer(a.originalLayer || "")
) {
  continue;
}

if (
  !isCsvB &&
  !isDistanceTargetLayer(b.originalLayer || "")
) {
  continue;
}
      const distance = getDistanceMeters(a, b);
if (distance < 1) {
  duplicatePois.push({
    a,
    b,
    distance
  });
}
      if (distance < 40) {
        warnings.push({
          a,
          b,
          distance,
          type: classifyDistanceRisk(distance)
        });
      }
    }
  }

  warnings.sort((a, b) => a.distance - b.distance);
const duplicatePoiHtml =
  duplicatePois.length === 0
    ? `
      <div class="distance-warning" style="
        border:1px solid rgba(34,197,94,0.45);
        background:rgba(34,197,94,0.12);
      ">
        ✅ 重複POI候補はありません。
      </div>
    `
    : duplicatePois.map(item => `
      <div class="distance-warning" style="
        border:1px solid rgba(239,68,68,0.55);
        background:rgba(239,68,68,0.14);
      ">
        <strong style="color:#f87171;">
          ⚠ 重複POI候補（${item.distance.toFixed(1)}m）
        </strong><br>
        ${escapeHtml(item.a.layer)}：${escapeHtml(item.a.name)}<br>
        × ${escapeHtml(item.b.layer)}：${escapeHtml(item.b.name)}<br>
        <span style="font-size:12px; opacity:0.85;">
          同じ場所に複数のPOIが配置されている可能性があります。
        </span>
      </div>
    `).join("");
  const campsite = calculateCampsiteScore(points, warnings);
  const riskAccordionHtml = getRiskAccordionHtml(warnings);

  const stars = getStars(campsite.score);
  const color = getRankColor(campsite.rank);
  const bar = getScoreBar(campsite.score, color);
  const poiCounts = countPoiTypesFromLayers(window._layerPoints);
  const poiVolumeCounts = countExistingAndAddedPoi(window._layerPoints);

const expansionRate =
  points.length > 0
    ? Math.round((poiVolumeCounts.added / points.length) * 1000) / 10
    : 0;
const poiCountHtml = renderPoiCountHtml(poiCounts);
const poiLimitWarningHtml = getPoiLimitWarningHtml(poiCounts);

const poiLimitExceeded =
  poiCounts.pokestop > POI_LIMITS.pokestop ||
  poiCounts.gym > POI_LIMITS.gym ||
  poiCounts.power > POI_LIMITS.power ||
  poiCounts.pokestop + poiCounts.gym + poiCounts.power > 25;
const sectionTitleHtml = (title, sub = "") => `
  <div style="
    margin:22px 0 10px;
    padding:10px 14px;
    border-left:5px solid #38bdf8;
    border-radius:10px;
    background:rgba(15,23,42,0.58);
    color:#e5e7eb;
    font-weight:800;
    letter-spacing:0.02em;
  ">
    ${title}
    ${sub ? `<div style="
      margin-top:4px;
      font-size:12px;
      font-weight:500;
      color:#94a3b8;
      line-height:1.5;
    ">${sub}</div>` : ""}
  </div>
`;
  const scoreHtml = `
    <div class="distance-warning">

      <strong style="color:${color}; font-size:20px;">
        拠点充実度：${campsite.rank} ${stars}
      </strong><br>

      <span style="opacity:0.85;">${campsite.label}</span>

      ${bar}

      <div style="margin-top:6px; font-size:13px; opacity:0.8;">
        スコア：${campsite.score}点
      </div>
${poiCountHtml}
      <br>
     <strong>総評</strong><br>
${poiLimitWarningHtml}
${campsite.summary}<br><br>

      密集：${campsite.under20}件<br>
      滞留：${campsite.under30}件<br>
      軽微：${campsite.under40}件<br>
      通行：${campsite.trafficOk ? "良好" : "注意"}<br><br>

      <strong>CA所感</strong><br>
      ・通行：${document.getElementById("trafficOk")?.checked ? "スムーズに通れる" : "注意が必要"}<br>
      ・広場：${document.getElementById("hasOpenSpace")?.checked ? "あり" : "なし"}<br>
      ・回遊：${document.getElementById("hasLoopRoute")?.checked ? "できる" : "弱い"}<br>
      ・待機場所：${document.getElementById("hasWaitingSpace")?.checked ? "あり" : "なし"}<br><br>

      <strong>判定コメント</strong><br>
      ${campsite.comments.map(c => "・" + c).join("<br>")}
    </div><br>
  `;

 const displayCounts = {
  dense: 0,      // 20m未満
  stay: 0,       // 20〜30m
  light: 0,      // 30〜40m
  reference: 0   // 既存POI同士
};

warnings.forEach(w => {
  const isExistingA = (w.a.originalLayer || "").includes("既存");
  const isExistingB = (w.b.originalLayer || "").includes("既存");

  if (isExistingA && isExistingB) {
    displayCounts.reference++;
    return;
  }

  if (w.distance < 20) {
    displayCounts.dense++;
  } else if (w.distance < 30) {
    displayCounts.stay++;
  } else {
    displayCounts.light++;
  }
});

const targetWarningCount = displayCounts.dense + displayCounts.stay;
const adjustableCount = displayCounts.light;

  const nearestWarning =
    warnings.length > 0 ? warnings[0] : null;

  let resultStatus = "問題なし";
  let resultStatusColor = "#22c55e";
  let resultStatusIcon = "✅";

  if (
  targetWarningCount > 0 ||
  poiLimitExceeded ||
  duplicatePois.length > 0
) {
  resultStatus = "調整あり";
  resultStatusColor = "#ef4444";
  resultStatusIcon = "⚠";
} else if (adjustableCount > 0) {
  resultStatus = "調整可能距離あり";
  resultStatusColor = "#94a3b8";
  resultStatusIcon = "△";
} else if (displayCounts.reference > 0) {
  resultStatus = "参考近接あり";
  resultStatusColor = "#94a3b8";
  resultStatusIcon = "ℹ";
}
const debugInfo = getTargetLayerDebugInfo();

const debugHtml = `
  <div class="distance-warning" style="
    margin-bottom:16px;
    border:1px solid rgba(56,189,248,0.45);
    background:rgba(14,165,233,0.10);
  ">
    <strong>読み込み状況</strong><br><br>
    全レイヤー数：${debugInfo.allLayerCount}件<br>
    判定対象レイヤー数：${debugInfo.targetLayerCount}件<br>
    全POI数：${debugInfo.allPointCount}件<br>
    判定対象POI数：${debugInfo.targetPointCount}件<br>
活動範囲ポリゴン：${window._hasPolygon ? `あり（${window._activityPolygons?.length || 0}件）` : "なし"}<br><br>
    <strong>判定対象レイヤー</strong><br>
    ${debugInfo.targetLayerNames.map(name => escapeHtml(name)).join("<br>") || "なし"}
  </div>
`;
  const resultHeaderHtml = `
    <div class="distance-warning" style="
      margin-bottom:16px;
      border:1px solid ${resultStatusColor};
      background:rgba(15,23,42,0.72);
    ">
      <strong style="color:${resultStatusColor}; font-size:20px;">
        ${resultStatusIcon} 判定結果：${resultStatus}
      </strong><br><br>

      20m未満（密集）：${displayCounts.dense}件<br>
20〜30m（滞留）：${displayCounts.stay}件<br>
30〜40m（軽微）：${displayCounts.light}件<br>
参考：${displayCounts.reference}件<br>
40m未満合計：${warnings.length}件<br><br>
      ${
        nearestWarning ? `
          <strong>最短距離ペア</strong><br>
          ${nearestWarning.distance.toFixed(1)}m<br>
          ${escapeHtml(nearestWarning.a.layer)}：${escapeHtml(nearestWarning.a.name)}<br>
× ${escapeHtml(nearestWarning.b.layer)}：${escapeHtml(nearestWarning.b.name)}<br>
        ` : `
          <strong>最短距離ペア</strong><br>
          40m未満の組み合わせはありません。<br>
        `
      }
    </div>
  `;
const simpleMapGuideHtml = `
  <div class="distance-warning">
    ※地図はOSM / 航空写真を切り替えて確認できます。<br>
    既存POI・追加POI・活動範囲ポリゴン・近接ラインを表示します。
  </div><br>
`;
  if (warnings.length === 0) {
  result.innerHTML =
    sectionTitleHtml("拠点充実度", "距離・通行・広場・回遊性などをもとにした総合評価です。") +
    scoreHtml +
    sectionTitleHtml("判定結果", "20m未満／20〜30m／30〜40mの近接件数を確認します。") +
debugHtml +
resultHeaderHtml +
sectionTitleHtml("重複POIチェック", "同じ場所に複数のPOIが入っていないか確認します。") +
duplicatePoiHtml +
    `✅ 問題なし（${points.length}件）<br><br>` +
    sectionTitleHtml("距離チェックマップ", "OSM / 航空写真でPOI・活動範囲・近接ラインを確認できます。") +
    simpleMapGuideHtml;

  renderSimpleDistanceMap(points, warnings);

sendDistanceCheckAnalytics(
  points,
  poiVolumeCounts,
  poiCounts,
  expansionRate,
  displayCounts,
  campsite
);

return;
}
  const targetWarnings = warnings.filter(w => {
  const isExistingA = (w.a.originalLayer || "").includes("既存");
  const isExistingB = (w.b.originalLayer || "").includes("既存");

  return !(isExistingA && isExistingB) && w.distance < 30;
});

  const targetWarningListHtml = targetWarnings.length === 0 ? `
    <div class="distance-warning" style="
      border:1px solid rgba(34,197,94,0.45);
      background:rgba(34,197,94,0.12);
    ">
      ✅ 追加・変更対象の近接はありません。<br>
      既存POI同士の参考近接は、上の分類別チェック内で確認できます。
    </div>
  ` : targetWarnings.map(w => {
    let label = "";
    let message = "";
    let cardColor = "";
    let cardBg = "";

    if (w.distance < 30) {
      label = "⚠ 要注意";
      message = "30m未満です。再確認をお願いします。";
      cardColor = "#ef4444";
      cardBg = "rgba(239, 68, 68, 0.14)";
    } else {
      label = "△ 40m未満";
      message = "40m未満です。調整される場合があります。";
      cardColor = "#f97316";
      cardBg = "rgba(249, 115, 22, 0.14)";
    }

    return `
      <div class="distance-warning" style="
        border:1px solid ${cardColor};
        background:${cardBg};
      ">
        <strong style="color:${cardColor};">
          ${label}（${w.distance.toFixed(1)}m）
        </strong><br>
        ${escapeHtml(w.a.layer)}：${escapeHtml(w.a.name)}<br>
× ${escapeHtml(w.b.layer)}：${escapeHtml(w.b.name)}<br>
        → ${message}
      </div>
    `;
  }).join("");

result.innerHTML =
  sectionTitleHtml("拠点充実度", "距離・通行・広場・回遊性などをもとにした総合評価です。") +
  scoreHtml +
  sectionTitleHtml("判定結果", "20m未満／20〜30m／30〜40mの近接件数を確認します。") +
  debugHtml +
  resultHeaderHtml +
  sectionTitleHtml("重複POIチェック", "同じ場所に複数のPOIが入っていないか確認します。") +
  duplicatePoiHtml +
  sectionTitleHtml("分類別チェック", "近接内容を密集・滞留・軽微に分けて確認します。") +
  riskAccordionHtml + `
    40m未満の組み合わせがあります。<br><br>
    🔴 20m未満：${displayCounts.dense}件 / 
    🟠 20〜30m：${displayCounts.stay}件 / 
    ⚪ 30〜40m：${displayCounts.light}件 / 
    ℹ 参考：${displayCounts.reference}件
    <br><br>
  ` +
  sectionTitleHtml("追加・変更対象の近接", "既存POI同士ではなく、追加・変更対象に関係する近接を確認します。") +
  targetWarningListHtml +
  sectionTitleHtml("距離チェックマップ", "OSM / 航空写真でPOI・活動範囲・近接ラインを確認できます。") +
  simpleMapGuideHtml;

  renderSimpleDistanceMap(points, warnings);
sendDistanceCheckAnalytics(
  points,
  poiVolumeCounts,
  poiCounts,
  expansionRate,
  displayCounts,
  campsite
);
}
function addDistanceMapLegend() {
  if (!distanceLeafletMap || typeof L === "undefined") {
    return;
  }

  const legend = L.control({
    position: "bottomright"
  });

  legend.onAdd = function () {
    const div = L.DomUtil.create(
      "div",
      "distance-leaflet-legend"
    );

    div.innerHTML = `
      <strong>凡例</strong>

      <div>
        <span class="distance-legend-dot existing"></span>
        既存POI
      </div>

      <div>
        <span class="distance-legend-dot add"></span>
        追加POI
      </div>

      <div>
        <span class="distance-legend-line area"></span>
        活動範囲
      </div>

      <div>
        <span class="distance-legend-line dense"></span>
        20m未満
      </div>

      <div>
        <span class="distance-legend-line stay"></span>
        20〜30m
      </div>

      <div>
        <span class="distance-legend-line light"></span>
        30〜40m
      </div>

      <div>
        <span class="distance-legend-line reference"></span>
        既存同士参考
      </div>
    `;

    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    return div;
  };

  legend.addTo(distanceLeafletMap);
}
function renderSimpleDistanceMap(points = [], warnings = []) {
  const mapElement = document.getElementById("distanceMap");

  if (!mapElement) {
    return;
  }

  mapElement.innerHTML = "";
  mapElement.style.display = "block";

  if (typeof L === "undefined") {
    mapElement.innerHTML = `
      <div class="distance-map-empty">
        地図ライブラリを読み込めませんでした。
      </div>
    `;
    return;
  }

  function pickNumber(p, keys) {
    for (const key of keys) {
      if (p[key] !== undefined && p[key] !== null && p[key] !== "") {
        const value = Number(String(p[key]).trim());
        if (!isNaN(value)) return value;
      }
    }

    return NaN;
  }

  function getPointLatLng(p) {
    const lat = pickNumber(p, [
      "lat",
      "latitude",
      "Latitude",
      "LAT",
      "緯度"
    ]);

    const lng = pickNumber(p, [
      "lng",
      "lon",
      "longitude",
      "Longitude",
      "LON",
      "経度"
    ]);

    if (isNaN(lat) || isNaN(lng)) {
      return null;
    }

    return [lat, lng];
  }

  const validPoints = points
    .map(p => {
      const latLng = getPointLatLng(p);

      if (!latLng) {
        return null;
      }

      return {
        ...p,
        lat: latLng[0],
        lng: latLng[1]
      };
    })
    .filter(Boolean);

  if (!validPoints.length) {
    mapElement.innerHTML = `
      <div class="distance-map-empty">
        表示できるPOIがありません。
      </div>
    `;
    return;
  }

  if (distanceLeafletMap) {
    distanceLeafletMap.remove();
    distanceLeafletMap = null;
    distanceLeafletLayerGroup = null;
  }

  distanceLeafletMap = L.map("distanceMap", {
    zoomControl: true
  });

  const osmLayer = L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }
  );

  const aerialLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri"
    }
  );

  osmLayer.addTo(distanceLeafletMap);

  L.control.layers(
    {
      "OSM": osmLayer,
      "航空写真": aerialLayer
    },
    null,
    {
      collapsed: false
    }
  ).addTo(distanceLeafletMap);
  addDistanceMapLegend();

  distanceLeafletLayerGroup =
    L.layerGroup().addTo(distanceLeafletMap);

  const bounds = [];

  /*
    活動範囲ポリゴン
  */
  (window._activityPolygons || []).forEach((polygon, index) => {
    if (!Array.isArray(polygon) || polygon.length < 3) {
      return;
    }

    L.polygon(polygon, {
      color: "#a855f7",
      fillColor: "#a855f7",
      fillOpacity: 0.18,
      weight: 2
    })
      .bindPopup(`活動範囲ポリゴン ${index + 1}`)
      .addTo(distanceLeafletLayerGroup);

    polygon.forEach(latLng => bounds.push(latLng));
  });

  /*
    POI
  */
  validPoints.forEach(p => {
    const latLng = [p.lat, p.lng];

    const layerName =
      p.originalLayer ||
      p.layer ||
      "";

    const isAdd =
      isAddedLayerName(layerName);

    const color =
      isAdd ? "#22c55e" : "#38bdf8";

    const label =
      isAdd ? "追加POI" : "既存POI";

    L.circleMarker(latLng, {
      radius: isAdd ? 8 : 6,
      color,
      fillColor: color,
      fillOpacity: 0.92,
      weight: 2
    })
      .bindPopup(`
        <strong>${escapeHtml(p.name || "名称なし")}</strong><br>
        ${escapeHtml(label)}<br>
        レイヤー：${escapeHtml(layerName || "-")}
      `)
      .addTo(distanceLeafletLayerGroup);

    bounds.push(latLng);
  });

  /*
    近接ライン
  */
  (warnings || []).forEach(w => {
    const aLatLng = getPointLatLng(w.a);
    const bLatLng = getPointLatLng(w.b);

    if (!aLatLng || !bLatLng) {
      return;
    }

    const isExistingA =
      String(w.a.originalLayer || "").includes("既存");

    const isExistingB =
      String(w.b.originalLayer || "").includes("既存");

    const isReference =
      isExistingA && isExistingB;

    let color = "#facc15";
    let label = "軽微";

    if (w.distance < 20) {
      color = "#ef4444";
      label = "密集";
    } else if (w.distance < 30) {
      color = "#f97316";
      label = "滞留";
    }

    if (isReference) {
      color = "#94a3b8";
      label = "参考";
    }

    L.polyline([aLatLng, bLatLng], {
      color,
      weight: isReference ? 2 : 3,
      opacity: isReference ? 0.55 : 0.85,
      dashArray: isReference || w.distance >= 30 ? "6,6" : null
    })
      .bindPopup(`
        <strong>${escapeHtml(label)}：${w.distance.toFixed(1)}m</strong><br>
        ${escapeHtml(w.a.layer || "-")}：${escapeHtml(w.a.name || "名称なし")}<br>
        × ${escapeHtml(w.b.layer || "-")}：${escapeHtml(w.b.name || "名称なし")}
      `)
      .addTo(distanceLeafletLayerGroup);

    bounds.push(aLatLng);
    bounds.push(bLatLng);
  });

  if (bounds.length) {
    distanceLeafletMap.fitBounds(bounds, {
      padding: [28, 28]
    });
  }

  setTimeout(() => {
    distanceLeafletMap?.invalidateSize();
  }, 160);
}