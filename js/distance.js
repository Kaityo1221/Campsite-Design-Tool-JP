function classifyDistanceRisk(distance) {
  if (distance < 20) return "密集";
  if (distance < 30) return "滞留";
  if (distance < 40) return "軽微";
  return null;
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
    const cardColor = isReference ? "#94a3b8" : "#ef4444";
    const label = isReference ? "ℹ 参考" : "⚠ 調整対象";
    const message = isReference
      ? "既存POI同士の近接です。追加POIの調整対象には含めません。"
      : "追加・変更対象の近接です。配置調整を確認してください。";

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
                調整対象：${targetList.length}件 / 参考：${referenceList.length}件
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
                  color:#fca5a5;
                ">
                  ⚠ 調整対象（${targetList.length}件）
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
  } else if (score >= 50) {
    rank = "B";
    label = "良好";
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

  const campsite = calculateCampsiteScore(points, warnings);

  warnings.sort((a, b) => a.distance - b.distance);
const riskAccordionHtml = getRiskAccordionHtml(warnings);

const stars = getStars(campsite.score);
const color = getRankColor(campsite.rank);
const bar = getScoreBar(campsite.score, color);

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
  danger: 0,
  caution: 0,
  reference: 0
};

warnings.forEach(w => {
  const isExistingA = (w.a.originalLayer || "").includes("既存");
  const isExistingB = (w.b.originalLayer || "").includes("既存");

  if (isExistingA && isExistingB) {
    displayCounts.reference++;
  } else if (w.distance < 30) {
    displayCounts.danger++;
  } else {
    displayCounts.caution++;
  }
});

  if (warnings.length === 0) {
    result.innerHTML = scoreHtml + `✅ 問題なし（${points.length}件）`;
    return;
  }

    const targetWarnings = warnings.filter(w => {
  const isExistingA = (w.a.originalLayer || "").includes("既存");
  const isExistingB = (w.b.originalLayer || "").includes("既存");

  return !(isExistingA && isExistingB);
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
    message = "30m未満です。配置調整を推奨します。";
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
  result.innerHTML = scoreHtml + riskAccordionHtml + `
    ⚠ 40m未満があります<br><br>
    ⚠ 要注意：${displayCounts.danger}件 / 
△ 40m未満：${displayCounts.caution}件 / 
ℹ 参考：${displayCounts.reference}件
    <br><br>
    ${targetWarningListHtml}
  `;
}
