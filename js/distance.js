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

function getPoiTypeFromLayerName(layerName) {
  const name = String(layerName || "").toLowerCase();

  if (
    name.includes("パワースポット") ||
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
    name.includes("ポケストップ") ||
    name.includes("pokestop") ||
    name.includes("poke stop")
  ) {
    return "pokestop";
  }

  return null;
}

function countPoiTypesFromLayers(pointsByLayer) {
  const counts = {
    pokestop: 0,
    gym: 0,
    power: 0
  };

  Object.entries(pointsByLayer || {}).forEach(([layerName, points]) => {
    if (!Array.isArray(points)) return;

    const type = getPoiTypeFromLayerName(layerName);

    if (!type) return;

    counts[type] += points.length;
  });

  return counts;
}

function renderPoiCountHtml(counts) {
  return `
    <div class="poi-count-box">
      <h3>POI内訳</h3>
      ${renderPoiCountRow("ポケストップ", counts.pokestop, POI_LIMITS.pokestop)}
      ${renderPoiCountRow("ジム", counts.gym, POI_LIMITS.gym)}
      ${renderPoiCountRow("パワースポット", counts.power, POI_LIMITS.power)}
    </div>
  `;
}

function renderPoiCountRow(label, current, limit) {
  const isOver = current > limit;

  return `
    <div class="poi-count-row ${isOver ? "poi-count-over" : ""}">
      ${label}：${current} / ${limit}${isOver ? " ⚠" : ""}
    </div>
  `;
}
function isDistanceTargetLayer(layerName) {
  return (
    layerName.includes("既存") ||
    layerName.includes("追加") ||
    layerName.includes("追加希望")
  );
}

async function loadDistanceFile() {
  const fileInput = document.getElementById("distanceFile");
  const container = document.getElementById("distanceLayerList");

  if (!fileInput.files.length) return;

  const file = fileInput.files[0];
  const fileName = file.name.toLowerCase();

  window._layerPoints = {};

  if (fileName.endsWith(".csv")) {
    const text = await file.text();
    const points = parseCSV(text);
    window._layerPoints["CSV_POI"] = points;
    renderLayerSelector(["CSV_POI"], container);
    return;
  }

  const result = await extractLayersFromKML(file);
  window._layerPoints = result.pointsByLayer;
  renderLayerSelector(result.layers, container);
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
    return { layers: [], pointsByLayer: {} };
  }

  const xml = new DOMParser().parseFromString(kmlText, "application/xml");
  const pointsByLayer = extractPointsByLayer(xml);
  const layers = Object.keys(pointsByLayer);

  return {
    layers,
    pointsByLayer
  };
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
        name: pm.getElementsByTagName("name")[0]?.textContent || "POI",
        layer: layerName
      };
    }).filter(Boolean);
  });

  return result;
}

function renderLayerSelector(layers, container) {
  container.innerHTML = "";

  const targetLayers = layers.filter(name =>
    !name.includes("円") &&
    !name.includes("30m") &&
    !name.includes("40m")
  );

  if (targetLayers.length === 0) {
    container.innerHTML = "判定できるPOIレイヤーがありません。";
    return;
  }

  container.innerHTML = targetLayers.map(name => `
    <div class="layer-row">
      <strong>${cleanLayerName(name)}</strong>
      <span class="note">（${window._layerPoints[name]?.length || 0}件）</span>
    </div>
  `).join("");
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
      ${w.a.layer}：${w.a.name}<br>
      × ${w.b.layer}：${w.b.name}<br>
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
  const result = document.getElementById("distanceResult");

  const points = [];

  Object.entries(window._layerPoints || {}).forEach(([layerName, layerPoints]) => {
    if (
      layerName.includes("円") ||
      layerName.includes("30m") ||
      layerName.includes("40m")
    ) return;

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

  const campsite = calculateCampsiteScore(points, warnings);
  const riskAccordionHtml = getRiskAccordionHtml(warnings);

  const stars = getStars(campsite.score);
  const color = getRankColor(campsite.rank);
  const bar = getScoreBar(campsite.score, color);
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

  if (targetWarningCount > 0) {
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
          ${nearestWarning.a.layer}：${nearestWarning.a.name}<br>
          × ${nearestWarning.b.layer}：${nearestWarning.b.name}<br>
        ` : `
          <strong>最短距離ペア</strong><br>
          40m未満の組み合わせはありません。<br>
        `
      }
    </div>
  `;
const simpleMapGuideHtml = `
  <div class="distance-warning">
    ※簡易マップはPC版で表示されます。
  </div><br>
`;
  if (warnings.length === 0) {
  result.innerHTML =
    sectionTitleHtml("拠点充実度", "距離・通行・広場・回遊性などをもとにした総合評価です。") +
    scoreHtml +
    sectionTitleHtml("判定結果", "20m未満／20〜30m／30〜40mの近接件数を確認します。") +
    resultHeaderHtml +
    `✅ 問題なし（${points.length}件）<br><br>` +
    sectionTitleHtml("PC版簡易マップ", "読み込んだPOIの分布を点で確認できます。") +
    simpleMapGuideHtml;

  renderSimpleDistanceMap(points);

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
        ${w.a.layer}：${w.a.name}<br>
        × ${w.b.layer}：${w.b.name}<br>
        → ${message}
      </div>
    `;
  }).join("");

  result.innerHTML =
  sectionTitleHtml("拠点充実度", "距離・通行・広場・回遊性などをもとにした総合評価です。") +
  scoreHtml +
  sectionTitleHtml("判定結果", "20m未満／20〜30m／30〜40mの近接件数を確認します。") +
  resultHeaderHtml +
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
  sectionTitleHtml("PC版簡易マップ", "読み込んだPOIの分布を点で確認できます。") +
  simpleMapGuideHtml;

  renderSimpleDistanceMap(points);
}

function renderSimpleDistanceMap(points = []) {
  const map = document.getElementById("distanceMap");
  if (!map) return;

  map.innerHTML = "";

  // スマホでは描画しない
  if (window.innerWidth <= 720) {
    return;
  }
  const legend = document.createElement("div");
  legend.className = "distance-map-legend";
  legend.innerHTML = `
    <div class="distance-map-legend-row">
      <span class="distance-map-legend-dot existing"></span>
      既存POI
    </div>
    <div class="distance-map-legend-row">
      <span class="distance-map-legend-dot add"></span>
      追加希望POI
    </div>
  `;
  map.appendChild(legend);
function pickNumber(p, keys) {
  for (const key of keys) {
    if (p[key] !== undefined && p[key] !== null && p[key] !== "") {
      const value = Number(String(p[key]).trim());
      if (!isNaN(value)) return value;
    }
  }
  return NaN;
}
const validPoints = points
  .map(p => ({
    ...p,

    lat: pickNumber(p, [
      "lat",
      "latitude",
      "Latitude",
      "LAT",
      "緯度"
    ]),

    lng: pickNumber(p, [
      "lng",
      "lon",
      "longitude",
      "Longitude",
      "LON",
      "経度"
    ])
  }))
  .filter(p =>
    !isNaN(p.lat) &&
    !isNaN(p.lng)
  );

if (!validPoints.length) {
    map.innerHTML = `
      <div class="distance-map-empty">
        表示できるPOIがありません。
      </div>
    `;
    return;
  }

  const padding = 42;
  const width = map.clientWidth;
  const height = map.clientHeight;

  const meanLat =
    validPoints.reduce((sum, p) => sum + p.lat, 0) / validPoints.length;

  const metersPerLat = 111320;
  const metersPerLng =
    111320 * Math.cos(meanLat * Math.PI / 180);

  const projected = validPoints.map(p => ({
    ...p,
    mx: p.lng * metersPerLng,
    my: p.lat * metersPerLat
  }));

const xs = projected.map(p => p.mx);
const ys = projected.map(p => p.my);

// 全POIが画面内に入るように範囲を取る
let minX = Math.min(...xs);
let maxX = Math.max(...xs);
let minY = Math.min(...ys);
let maxY = Math.max(...ys);

// 端のPOIが枠に貼り付かないよう、少し余白を足す
const marginRate = 0.08;

const marginX = (maxX - minX || 1) * marginRate;
const marginY = (maxY - minY || 1) * marginRate;

minX -= marginX;
maxX += marginX;
minY -= marginY;
maxY += marginY;

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const scale = Math.min(
    (width - padding * 2) / rangeX,
    (height - padding * 2) / rangeY
  );

  const mapContentWidth = rangeX * scale;
  const mapContentHeight = rangeY * scale;

  const offsetX = (width - mapContentWidth) / 2;
  const offsetY = (height - mapContentHeight) / 2;
const tooltip = document.createElement("div");
tooltip.className = "distance-map-tooltip";
map.appendChild(tooltip);

projected.forEach(p => {
    const rawX =
  offsetX +
  (p.mx - minX) * scale;

const rawY =
  offsetY +
  mapContentHeight -
  (p.my - minY) * scale;

const edgePadding = 14;

const x = Math.max(edgePadding, Math.min(width - edgePadding, rawX));
const y = Math.max(edgePadding, Math.min(height - edgePadding, rawY));

    const dot = document.createElement("div");

    const isAdd =
      (p.originalLayer || p.layer || "").includes("追加");

    dot.className =
      `distance-map-point ${isAdd ? "add" : "existing"}`;

    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;

    dot.addEventListener("mouseenter", () => {
  tooltip.innerHTML = `
    <strong>${p.layer || "POI"}</strong><br>
    ${p.name || "名称なし"}
  `;

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
  tooltip.classList.add("show");
});

dot.addEventListener("mouseleave", () => {
  tooltip.classList.remove("show");
});

map.appendChild(dot);
  });
}
