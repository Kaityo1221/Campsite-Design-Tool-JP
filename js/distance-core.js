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
let distancePolygonLayerGroup = null;
let distanceWarningLineLayers = new Map();
let latestDistanceWarnings = [];

function escapeDistanceHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function getDistanceCheckMeters(a, b) {

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
      const distance = getDistanceCheckMeters(a, b);

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
          ${escapeDistanceHtml(item.a.layer)}：${escapeDistanceHtml(item.a.name)}<br>
          × ${escapeDistanceHtml(item.b.layer)}：${escapeDistanceHtml(item.b.name)}
        </div>
      `).join("")}
    </div>
  `;
}
