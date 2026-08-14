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
const distanceTargetMeters = window.CampsitePoiSpacingPolicy?.targetMeters || 50;

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
      const distance = getDistanceCheckMeters(a, b);
if (distance < 1) {
  duplicatePois.push({
    a,
    b,
    distance
  });
}
      if (distance < distanceTargetMeters) {
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
  warnings.forEach((warning, index) => {
  warning.warningIndex = index;
});
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
        ${escapeDistanceHtml(item.a.layer)}：${escapeDistanceHtml(item.a.name)}<br>
        × ${escapeDistanceHtml(item.b.layer)}：${escapeDistanceHtml(item.b.name)}<br>
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
const uploadDistanceCheckFile = () => {
  const sourceFile = window._distanceSourceFile;

  if (
    !(sourceFile instanceof File) ||
    typeof window.uploadCampsiteFile !== "function"
  ) {
    return;
  }

  const parkName =
    typeof guessParkNameFromPoints === "function"
      ? guessParkNameFromPoints(points)
      : "公園名不明";

  window.uploadCampsiteFile({
    file: sourceFile,
    fileName: sourceFile.name,
    actionType: "distance_check",
    parkName,
    metadata: {
      poiCount: points.length,
      existingPoiCount: poiVolumeCounts.existing,
      addedPoiCount: poiVolumeCounts.added,
      warningCount: warnings.length,
      campsiteScore: campsite.score,
      campsiteRank: campsite.rank
    },
    errorTarget: result
  }).catch(error => {
    console.warn(
      "距離チェックファイル自動送信エラー:",
      error
    );
  });
};
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
      <br>
     <strong>総評</strong><br>
${poiLimitWarningHtml}
${campsite.summary}<br><br>

      密集：${campsite.under20}件<br>
滞留：${campsite.under30}件<br>
30〜50m参考：${campsite.under40}件<br>
既存POI同士の50m未満近接：${campsite.referenceUnder40 || 0}件<br>
通行：${campsite.trafficOk ? "良好" : "注意"}<br><br>

      <strong>現地環境チェック</strong><br>
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
  light: 0,      // 30〜50m（参考距離）
  reference: 0   // 既存POI同士
};

warnings.forEach(w => {
  if (isExistingPoiPair(w)) {
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
  resultStatus = "参考距離あり";
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
    ${debugInfo.targetLayerNames.map(name => escapeDistanceHtml(name)).join("<br>") || "なし"}
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
30〜50m（参考距離）：${displayCounts.light}件<br>
参考：${displayCounts.reference}件<br>
50m未満合計：${warnings.length}件<br><br>
      ${
        nearestWarning ? `
          <strong>最短距離ペア</strong><br>
          ${nearestWarning.distance.toFixed(1)}m<br>
          ${escapeDistanceHtml(nearestWarning.a.layer)}：${escapeDistanceHtml(nearestWarning.a.name)}<br>
× ${escapeDistanceHtml(nearestWarning.b.layer)}：${escapeDistanceHtml(nearestWarning.b.name)}<br>
        ` : `
          <strong>最短距離ペア</strong><br>
          50m未満の組み合わせはありません。<br>
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
    sectionTitleHtml("判定結果", "50m未満の近接件数を確認します。30m・40mは参考距離です。") +
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

uploadDistanceCheckFile();

return;
}
  const targetWarnings = warnings.filter(w => {
  return !isExistingPoiPair(w) && w.distance < 30;
});

  const targetWarningListHtml = targetWarnings.length === 0 ? `
    <div class="distance-warning" style="
      border:1px solid rgba(34,197,94,0.45);
      background:rgba(34,197,94,0.12);
    ">
      ✅ 追加・変更対象の要注意近接はありません。<br>
      30m以上50m未満は参考距離として、上の分類別チェックで確認できます。
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
      label = "△ 50m未満";
      message = "50m未満です。30m・40mは参考距離として確認してください。";
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
        ${escapeDistanceHtml(w.a.layer)}：${escapeDistanceHtml(w.a.name)}<br>
× ${escapeDistanceHtml(w.b.layer)}：${escapeDistanceHtml(w.b.name)}<br>
        → ${message}
        <br>
<button
  type="button"
  onclick="focusDistanceWarning(${w.warningIndex})"
  style="
    margin-top:10px;
    padding:8px 12px;
    border:none;
    border-radius:999px;
    background:#2563eb;
    color:white;
    font-weight:bold;
    cursor:pointer;
  "
>
  🗺️ 地図で見る
</button>
      </div>
    `;
  }).join("");

result.innerHTML =
  sectionTitleHtml("拠点充実度", "距離・通行・広場・回遊性などをもとにした総合評価です。") +
  scoreHtml +
  sectionTitleHtml("判定結果", "50m未満の近接件数を確認します。30m・40mは参考距離です。") +
  resultHeaderHtml +
  sectionTitleHtml("重複POIチェック", "同じ場所に複数のPOIが入っていないか確認します。") +
  duplicatePoiHtml +
  sectionTitleHtml("分類別チェック", "近接内容を密集・滞留・参考距離に分けて確認します。") +
  riskAccordionHtml + `
    50m未満の組み合わせがあります。<br><br>
    🔴 20m未満：${displayCounts.dense}件 / 
    🟠 20〜30m：${displayCounts.stay}件 / 
    ⚪ 30〜50m参考：${displayCounts.light}件 / 
    ℹ 参考：${displayCounts.reference}件
    <br><br>
  ` +
  sectionTitleHtml("追加・変更対象の近接", "30m未満は要注意、30m以上50m未満は参考距離として確認します。") +
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

uploadDistanceCheckFile();
}