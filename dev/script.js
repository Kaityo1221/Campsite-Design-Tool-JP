const ENABLE_QUIZ = true;
const QUIZ_VERSION = "beta1";
window._layerPoints = {};
  let distanceData = {
  existing: [],
  add: []
};
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


function classifyDistanceRisk(distance) {
  if (distance < 20) return "密集";
  if (distance < 30) return "滞留";
  if (distance < 40) return "軽微";
  return null;
}
function getNearbyCount(center, points, radius = 80) {
  return points.filter(p => getDistanceMeters(center, p) <= radius).length;
}

function classifyDistanceRiskWithDensity(distance, nearbyCount) {
  if (distance < 20) return "密集";

  if (distance < 30) {
    if (nearbyCount >= 8) return "密集";
    return "滞留";
  }

  if (distance < 40) {
    if (nearbyCount >= 10) return "滞留";
    if (nearbyCount >= 6) return "軽微";
    return "軽微";
  }

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
function showQuiz() {
  document.getElementById("quizModal").style.display = "flex";
}

function checkQuiz() {
  const q1 = document.querySelector('input[name="q1"]:checked')?.value;
  const q2 = document.querySelector('input[name="q2"]:checked')?.value;
  const q3 = document.querySelector('input[name="q3"]:checked')?.value;

  if (!q1 || !q2 || !q3) {
    alert("すべて選択してください");
    return;
  }

  if (q1 === "40" && q2 === "hard" && q3 === "25") {
    localStorage.setItem("quizPassed", QUIZ_VERSION);
    document.getElementById("quizModal").style.display = "none";
    alert("✔ 利用準備OK！ツールを使えます");
  } else {
    alert("もう一度確認してください\nヒント：基本距離は40mです");
  }
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
周辺密度：半径80m以内 ${w.nearbyCount || "-"}件<br>
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

  let rank = "B";
let label = "良好";

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

// POI数が少ない場合だけ、C評価にする
if (points.length < 8) {
  rank = "C";
  label = "発展余地あり";
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
  const nearbyA = getNearbyCount(a, points, 80);
  const nearbyB = getNearbyCount(b, points, 80);
  const nearbyCount = Math.max(nearbyA, nearbyB);

  warnings.push({
    a,
    b,
    distance,
    nearbyCount,
    type: classifyDistanceRiskWithDensity(distance, nearbyCount)
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
function toggleUpdateLog(event) {
  if (event) {
    event.stopPropagation();
  }

  const log = document.getElementById("updateLog");

  if (!log) {
    alert("更新履歴が見つかりません");
    return;
  }

  log.style.display = log.style.display === "block" ? "none" : "block";
}
  function toggleRenameGuide() {
  const guide = document.getElementById("renameGuide");
  guide.style.display = guide.style.display === "block" ? "none" : "block";
}
  function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function checkPassword() {
  const input = document.getElementById("passwordInput");
  const error = document.getElementById("loginError");
  const loginScreen = document.getElementById("loginScreen");
  const splashScreen = document.getElementById("splashScreen");

  if (input.value.trim() === "CA2026") {
    error.textContent = "";
    input.blur();

    // ログイン画面をすぐ消す
    loginScreen.remove();

    // すぐアイコン演出開始
    splashScreen.classList.add("show");

// 🔊 ログイン音
const loginSound = document.getElementById("loginSound");
loginSound.currentTime = 0;
loginSound.volume = 0.08;

setTimeout(() => {
  loginSound.play().catch(() => {});
}, 80);

setTimeout(function () {
  splashScreen.remove();
}, 1400);

  } else {
    error.textContent = "パスコードが違います";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const passwordInput = document.getElementById("passwordInput");

  if (passwordInput) {
    passwordInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        checkPassword();
      }
    });
  }

  const adminPasswordInput = document.getElementById("adminPasswordInput");

  if (adminPasswordInput) {
    adminPasswordInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        checkAdminPassword();
      }
    });
  }

  const distanceInput = document.getElementById("distanceFile");

  if (distanceInput) {
    distanceInput.addEventListener("change", loadDistanceFile);
  }
});

document.addEventListener("click", function (event) {
  const log = document.getElementById("updateLog");
  const badge = document.querySelector(".version-badge");

  if (!log || log.style.display !== "block") return;

  const clickedInsideLog = log.contains(event.target);
  const clickedBadge = badge && badge.contains(event.target);

  if (!clickedInsideLog && !clickedBadge) {
    log.style.display = "none";
  }
});

function openTab(tabId, button) {
  document.querySelectorAll(".tab-content").forEach(tab => {
    tab.classList.remove("active");
  });

  document.querySelectorAll(".tab-button").forEach(btn => {
    btn.classList.remove("active");
  });

  const targetTab = document.getElementById(tabId);
  if (targetTab) {
    targetTab.classList.add("active");
  }

  if (button && button.classList) {
    button.classList.add("active");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

const ADMIN_PASSWORD = "she1ep";

function openAdminLogin() {
  const modal = document.getElementById("adminLoginModal");
  const input = document.getElementById("adminPasswordInput");
  const error = document.getElementById("adminLoginError");

  if (!modal) {
    alert("管理者ログイン画面が見つかりません");
    return;
  }

  if (error) error.textContent = "";
  if (input) input.value = "";

  modal.style.display = "flex";

  setTimeout(() => {
    if (input) input.focus();
  }, 100);
}

function closeAdminLogin() {
  const modal = document.getElementById("adminLoginModal");
  if (modal) {
    modal.style.display = "none";
  }
}

function checkAdminPassword() {
  const input = document.getElementById("adminPasswordInput");
  const error = document.getElementById("adminLoginError");

  if (!input) return;

  if (input.value.trim() === ADMIN_PASSWORD) {
    if (error) error.textContent = "";
    closeAdminLogin();

    openTab("admin", null);

    document.querySelectorAll(".tab-button").forEach(btn => {
      btn.classList.remove("active");
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  } else {
    if (error) error.textContent = "管理者パスコードが違います";
  }
}
function escapeAdminHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getAdminLayerInfo(layerName) {
  const name = layerName || "";
  const lower = name.toLowerCase();

  const isCircle =
    name.includes("円") ||
    name.includes("30m") ||
    name.includes("40m");

  const isAdd =
    name.includes("追加希望") ||
    name.includes("追加") ||
    name.includes("新規") ||
    name.includes("CA Pokestop") ||
    name.includes("CA Pokéstop") ||
    lower.includes("add");

  const isPokestop =
    name.includes("ポケスト") ||
    name.includes("ポケストップ") ||
    lower.includes("pokestop") ||
    lower.includes("poke stop");

  const isGym =
    name.includes("ジム") ||
    lower.includes("gym");

  const isPower =
    name.includes("パワ") ||
    name.includes("パワースポット") ||
    name.includes("パワスポ") ||
    lower.includes("power");

  const isExisting =
    !isCircle &&
    !isAdd &&
    (
      name.includes("既存") ||
      isPokestop ||
      isGym ||
      isPower
    );

  return {
    isCircle,
    isAdd,
    isExisting,
    isPokestop,
    isGym,
    isPower
  };
}

async function runAdminFileCheck() {
  const input = document.getElementById("adminCheckFile");
  const result = document.getElementById("adminCheckResult");

  if (!input || !input.files.length) {
    alert("KML / KMZ ファイルを選択してください");
    return;
  }

  const file = input.files[0];
  const fileName = file.name.toLowerCase();

  result.innerHTML = `
    <div class="distance-warning" style="
      background:rgba(59,130,246,0.12);
      border:1px solid rgba(96,165,250,0.35);
    ">
      <span class="loading">
        <span class="spinner"></span>
        内容チェック中…
      </span>
    </div>
  `;

  try {
    let layers = [];
    let pointsByLayer = {};

    if (fileName.endsWith(".csv")) {
      const text = await file.text();
      const points = parseCSV(text);
      layers = ["CSV_POI"];
      pointsByLayer["CSV_POI"] = points.map(p => ({
        ...p,
        layer: "CSV_POI"
      }));
    } else if (
      fileName.endsWith(".kml") ||
      fileName.endsWith(".kmz") ||
      fileName.endsWith(".zip")
    ) {
      const extracted = await extractLayersFromKML(file);
      layers = extracted.layers;
      pointsByLayer = extracted.pointsByLayer;
    } else {
      result.innerHTML = `
        <div class="distance-warning">
          対応していないファイル形式です。KML / KMZ を選択してください。
        </div>
      `;
      return;
    }

    const allPoints = [];
    let dummyCount = 0;

    const layerSummary = layers.map(layerName => {
      const points = pointsByLayer[layerName] || [];
      const info = getAdminLayerInfo(layerName);

      points.forEach(p => {
        const point = {
          ...p,
          layer: layerName
        };

        if (isDummyPoint(point)) {
          dummyCount++;
        }

        allPoints.push(point);
      });

      return {
        name: layerName,
        count: points.length,
        ...info
      };
    });

    const circleLayers = layerSummary.filter(l => l.isCircle);
    const addLayers = layerSummary.filter(l => l.isAdd);
    const existingLayers = layerSummary.filter(l => l.isExisting);

    const usablePoints = allPoints.filter(p => !isDummyPoint(p));

const existingPoints = usablePoints.filter(p => {
  const info = getAdminLayerInfo(p.layer);
  return info.isExisting;
});

const counts = {
  pokestop: 0,
  gym: 0,
  power: 0
};

existingPoints.forEach(p => {
  const kind = classifyType(p.type, p.name, p.layer);

  if (kind === "gym") {
    counts.gym++;
  } else if (kind === "power") {
    counts.power++;
  } else {
    counts.pokestop++;
  }
});

    const layerListHtml = layerSummary.length === 0 ? `
      <div style="opacity:0.75;">レイヤー情報が見つかりませんでした。</div>
    ` : layerSummary.map(layer => {
      let badge = "通常";

      if (layer.isCircle) badge = "円";
      else if (layer.isAdd) badge = "追加希望";
      else if (layer.isExisting) badge = "既存POI";

      return `
        <div style="
          margin:8px 0;
          padding:10px;
          border-radius:10px;
          background:rgba(15,23,42,0.65);
          border:1px solid rgba(148,163,184,0.22);
        ">
          <strong>${escapeAdminHtml(layer.name)}</strong><br>
          件数：${layer.count}件 / 種別：${badge}
        </div>
      `;
    }).join("");

    const cautionMessages = [];

    if (circleLayers.length > 0) {
      cautionMessages.push("円レイヤーあり：再生成時は古い円レイヤーの扱いに注意");
    }

    if (addLayers.length === 0) {
  cautionMessages.push("追加希望レイヤーなし：既存POI確認用データの可能性あり");
}

    if (dummyCount > 0) {
      cautionMessages.push(`ダミーポイントあり：${dummyCount}件`);
    }

    const cautionHtml = cautionMessages.length === 0 ? `
      <div style="
        margin-top:12px;
        padding:12px;
        border-radius:12px;
        background:rgba(34,197,94,0.12);
        border:1px solid rgba(34,197,94,0.35);
        color:#bbf7d0;
      ">
        ✅ 大きな注意点は見つかりませんでした。
      </div>
    ` : `
      <div style="
        margin-top:12px;
        padding:12px;
        border-radius:12px;
        background:rgba(249,115,22,0.12);
        border:1px solid rgba(249,115,22,0.35);
        color:#fed7aa;
      ">
        <strong>確認ポイント</strong><br>
        ${cautionMessages.map(m => "・" + escapeAdminHtml(m)).join("<br>")}
      </div>
    `;

    result.innerHTML = `
      <div class="distance-warning" style="
        background:rgba(59,130,246,0.10);
        border:1px solid rgba(96,165,250,0.35);
      ">
        <strong>KMZ内容チェック結果</strong><br><br>

        ファイル名：${escapeAdminHtml(file.name)}<br>
        レイヤー数：${layers.length}件<br>
        全ポイント数：${allPoints.length}件<br>
有効POI数：${usablePoints.length}件<br>
既存POI判定数：${existingPoints.length}件<br>
ダミーポイント：${dummyCount}件<br><br>

        <strong>推定分類</strong><br>
        既存ポケストップ相当：${counts.pokestop}件<br>
        既存ジム相当：${counts.gym}件<br>
        既存パワースポット相当：${counts.power}件<br><br>

        <strong>レイヤー構成</strong><br>
        既存POI系レイヤー：${existingLayers.length}件<br>
        追加希望系レイヤー：${addLayers.length}件<br>
        円レイヤー：${circleLayers.length}件<br>

        ${cautionHtml}

        <br>
        <details>
          <summary style="cursor:pointer; font-weight:bold;">
            レイヤー一覧を開く
          </summary>
          <div style="margin-top:10px;">
            ${layerListHtml}
          </div>
        </details>
      </div>
    `;

  } catch (error) {
    console.error(error);
    result.innerHTML = `
      <div class="distance-warning">
        内容チェック中にエラーが発生しました。<br>
        ファイル形式またはKMZ内のKML構成を確認してください。
      </div>
    `;
  }
}

function isIgnoredForDensityCheck(p) {
  const info = getAdminLayerInfo(p.layer || "");
  const layerName = p.layer || "";

  // ダミーポイントは除外
  if (isDummyPoint(p)) return true;

  // 円レイヤーは除外
  if (info.isCircle) return true;

  if (
    layerName.includes("円") ||
    layerName.includes("30m") ||
    layerName.includes("40m")
  ) {
    return true;
  }

  // 追加希望レイヤーは除外しない
  // 密集チェックでは、既存POIと追加希望POIをまたいで判定する

  return false;
}

function getDensityRank(count) {

  if (count >= 10) {
    return {
      label: "高密度",
      icon: "🔴",
      color: "#ef4444",
      message: "POIが集中しています。集合・滞留に注意してください。"
    };
  }

  return null;
}
function analyzeDensityArea(area, allPoints, layerTypeCounts) {

  const count = area.count;

  const lats = area.nearby.map(p => p.lat);
  const lngs = area.nearby.map(p => p.lng);

  const latRange = Math.max(...lats) - Math.min(...lats);
  const lngRange = Math.max(...lngs) - Math.min(...lngs);

  const latMeters = latRange * 111320;
  const lngMeters = lngRange * 111320 * Math.cos(area.center.lat * Math.PI / 180);

  const longSide = Math.max(latMeters, lngMeters);
  const shortSide = Math.max(1, Math.min(latMeters, lngMeters));

  const shapeRatio = longSide / shortSide;

  const lineDense = shapeRatio >= 2.2;

  // 超高密度
  if (count >= 14) {
    return {
      type: "superHigh",
      display: {
        icon: "🚨",
        label: "超高密度",
        color: "#dc2626",
        message: "POIが非常に集中しています。長時間滞留・通信混雑・通行干渉に注意してください。"
      }
    };
  }

  // 追加偏重
  if (layerTypeCounts.add >= 6) {
    return {
      type: "addHeavy",
      display: {
        icon: "⚠",
        label: "追加偏重",
        color: "#f97316",
        message: "追加希望POIが密集しています。調整される可能性があります。"
      }
    };
  }

  // 導線型
  if (lineDense && count >= 6) {
    return {
      type: "line",
      display: {
        icon: "🟣",
        label: "導線密集",
        color: "#a855f7",
        message: "一本道・園路・駅導線のように、細長い範囲でPOIが集中しています。移動中の滞留に注意してください。"
      }
    };
  }

  // 広場型
  if (!lineDense && count >= 10) {
    return {
      type: "plaza",
      display: {
        icon: "🔵",
        label: "広場集中",
        color: "#3b82f6",
        message: "広場・中心エリアにPOIが集まっています。集合地点として優秀です。"
      }
    };
  }

  // 回遊型
  if (!lineDense && count >= 6) {
    return {
      type: "loop",
      display: {
        icon: "🟢",
        label: "回遊型",
        color: "#22c55e",
        message: "周回しながら遊びやすい配置です。大人数でも分散しやすい構造です。"
      }
    };
  }

  return {
    type: "none",
    display: null
  };
}


function isLineDense(center, points) {
  const nearby = points.filter(p => {
    return getDistanceMeters(center, p) <= 80;
  });

  if (nearby.length < 6) return false;

  const lats = nearby.map(p => p.lat);
  const lngs = nearby.map(p => p.lng);

  const latRange = Math.max(...lats) - Math.min(...lats);
  const lngRange = Math.max(...lngs) - Math.min(...lngs);

  const latMeters = latRange * 111320;
  const lngMeters = lngRange * 111320 * Math.cos(center.lat * Math.PI / 180);

  const longSide = Math.max(latMeters, lngMeters);
  const shortSide = Math.min(latMeters, lngMeters);

  if (shortSide === 0) return false;

  const shapeRatio = longSide / shortSide;

  return shapeRatio >= 2.2;
}
async function runAdminDensityCheck() {
  const input = document.getElementById("adminDensityFile");
  const result = document.getElementById("adminDensityResult");
  const radius = 80;

  if (!input || !input.files.length) {
    alert("KML / KMZ ファイルを選択してください");
    return;
  }

  const file = input.files[0];
  const fileName = file.name.toLowerCase();

  if (
    !fileName.endsWith(".kml") &&
    !fileName.endsWith(".kmz") &&
    !fileName.endsWith(".zip")
  ) {
    alert("KML / KMZ ファイルを選択してください");
    return;
  }

  result.innerHTML = `
    <div class="distance-warning" style="
      background:rgba(59,130,246,0.12);
      border:1px solid rgba(96,165,250,0.35);
    ">
      <span class="loading">
        <span class="spinner"></span>
        密集エリアをチェック中…
      </span>
    </div>
  `;

  try {
    const extracted = await extractLayersFromKML(file);
    const layers = extracted.layers;
    const pointsByLayer = extracted.pointsByLayer;

    let allPoints = [];

    layers.forEach(layerName => {
      const points = pointsByLayer[layerName] || [];

      points.forEach(p => {
        allPoints.push({
          ...p,
          layer: layerName
        });
      });
    });

    const usablePoints = allPoints.filter(p => !isIgnoredForDensityCheck(p));

    if (usablePoints.length < 2) {
      result.innerHTML = `
        <div class="distance-warning">
          密集チェックには有効POIが2件以上必要です。<br>
          円レイヤー、追加希望レイヤー、ダミーポイントを除外した結果、判定対象が不足しています。
        </div>
      `;
      return;
    }

    const densityList = usablePoints.map(center => {
      const nearby = usablePoints.filter(p => {
        return getDistanceMeters(center, p) <= radius;
      });

      return {
        center,
        count: nearby.length,
        nearby
      };
    });

    densityList.sort((a, b) => b.count - a.count);

    const pickedAreas = [];

    densityList.forEach(item => {
      if (item.count < 3) return;

      const tooClose = pickedAreas.some(area => {
  return getDistanceMeters(area.center, item.center) <= radius * 0.45;
});

      if (!tooClose) {
        pickedAreas.push(item);
      }
    });

    const topAreas = pickedAreas.slice(0, 10);

    if (topAreas.length === 0) {
      result.innerHTML = `
        <div class="distance-warning" style="
          background:rgba(34,197,94,0.12);
          border:1px solid rgba(34,197,94,0.35);
          color:#bbf7d0;
        ">
          ✅ 目立つ密集エリアは見つかりませんでした。<br><br>
          判定対象POI：${usablePoints.length}件<br>
          判定範囲：${radius}m
        </div>
      `;
      return;
    }

    const areaHtml = topAreas.map((area, index) => {
  
  const layerTypeCounts = {
  existing: 0,
  add: 0,
  other: 0
};

area.nearby.forEach(p => {
  const info = getAdminLayerInfo(p.layer || "");

  if (info.isAdd) {
    layerTypeCounts.add++;
  } else if (info.isExisting) {
    layerTypeCounts.existing++;
  } else {
    layerTypeCounts.other++;
  }
});

const analysis = analyzeDensityArea(
  area,
  usablePoints,
  layerTypeCounts
);

const display = analysis.display;

if (!display) {
  return "";
}

  const nearbyNames = area.nearby
    .slice(0, 8)
    .map(p => `・${escapeAdminHtml(p.name)} <span style="opacity:0.7;">(${escapeAdminHtml(p.layer)})</span>`)
    .join("<br>");

  const moreCount = area.nearby.length > 8
    ? `<br><span style="opacity:0.75;">ほか ${area.nearby.length - 8}件</span>`
    : "";

  return `
    <div style="
      margin:12px 0;
      padding:14px;
      border-radius:14px;
      background:rgba(15,23,42,0.65);
      border:1px solid rgba(148,163,184,0.25);
      border-left:6px solid ${display.color};
    ">
      <strong style="color:${display.color}; font-size:16px;">
        ${display.icon} エリア${index + 1}：${display.label}
      </strong><br>

      中心候補：${escapeAdminHtml(area.center.name)}<br>
      半径${radius}m以内：${area.count}件<br>
      中心レイヤー：${escapeAdminHtml(area.center.layer)}<br>
      内訳：既存 ${layerTypeCounts.existing}件 / 追加希望 ${layerTypeCounts.add}件 / その他 ${layerTypeCounts.other}件<br><br>

      <span style="color:#cbd5e1;">${display.message}</span>

      <details style="margin-top:10px;">
        <summary style="cursor:pointer; font-weight:bold;">
          周辺POIを見る
        </summary>
        <div style="margin-top:8px; line-height:1.7;">
          ${nearbyNames}
          ${moreCount}
        </div>
      </details>
    </div>
  `;
}).join("");
    result.innerHTML = `
      <div class="distance-warning" style="
        background:rgba(59,130,246,0.10);
        border:1px solid rgba(96,165,250,0.35);
      ">
        <strong>密集エリアチェック結果</strong><br><br>

        ファイル名：${escapeAdminHtml(file.name)}<br>
        レイヤー数：${layers.length}件<br>
        全ポイント数：${allPoints.length}件<br>
        判定対象POI：${usablePoints.length}件<br>
        判定半径：${radius}m<br>
        密集エリア候補：${topAreas.length}件<br><br>

        ${areaHtml}
      </div>
    `;

  } catch (error) {
    console.error(error);
    result.innerHTML = `
      <div class="distance-warning">
        密集エリアチェック中にエラーが発生しました。<br>
        ファイル形式またはKMZ内のKML構成を確認してください。
      </div>
    `;
  }
}
async function generateDensityZoneKMZ() {
  const input = document.getElementById("adminDensityFile");
  const status = document.getElementById("adminDensityZoneStatus");
  const radius = 80;

  if (!input || !input.files.length) {
    alert("KML / KMZ ファイルを選択してください");
    return;
  }

  status.innerHTML = `
    <span class="loading">
      <span class="spinner"></span>
      密集ゾーンKMZを生成中…
    </span>
  `;

  try {
    const file = input.files[0];
    const extracted = await extractLayersFromKML(file);
    const layers = extracted.layers;
    const pointsByLayer = extracted.pointsByLayer;

    let allPoints = [];

    layers.forEach(layerName => {
      const points = pointsByLayer[layerName] || [];
      points.forEach(p => {
        allPoints.push({
          ...p,
          layer: layerName
        });
      });
    });

    const usablePoints = allPoints.filter(p => !isIgnoredForDensityCheck(p));

    if (usablePoints.length < 2) {
      status.innerHTML = `
        <div class="distance-warning">
          密集ゾーンを作成できる有効POIが不足しています。
        </div>
      `;
      return;
    }

    const densityList = usablePoints.map(center => {
      const nearby = usablePoints.filter(p => {
        return getDistanceMeters(center, p) <= radius;
      });

      return {
        center,
        count: nearby.length,
        nearby
      };
    });

    densityList.sort((a, b) => b.count - a.count);

    const pickedAreas = [];

    densityList.forEach(item => {
      if (item.count < 3) return;

      const tooClose = pickedAreas.some(area => {
  return getDistanceMeters(area.center, item.center) <= radius * 0.45;
});

      if (!tooClose) {
        pickedAreas.push(item);
      }
    });

    const topAreas = pickedAreas.slice(0, 10);
const highDensityAreas = topAreas.filter(area => area.count >= 10);

if (highDensityAreas.length === 0) {
  status.innerHTML = `
    <div class="distance-warning">
      高密度ゾーン候補は見つかりませんでした。<br>
      判定範囲：80m<br>
      高密度判定：80m以内に10件以上
    </div>
  `;
  return;
}
    if (topAreas.length === 0) {
      status.innerHTML = `
        <div class="distance-warning">
          密集ゾーン候補は見つかりませんでした。
        </div>
      `;
      return;
    }

    const parser = new DOMParser();
    const outputXml = parser.parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <name>Density Zones</name>
        </Document>
      </kml>`,
      "application/xml"
    );

    const doc = outputXml.getElementsByTagName("Document")[0];

    addDensityStyles(outputXml, doc);

    const highFolder = createFolder(outputXml, doc, "🔴 高密度ゾーン");

    highDensityAreas.forEach((area, index) => {
  const zone = createDensityZonePlacemark(
    outputXml,
    area.center,
    radius,
    "densityHigh",
    `高密度ゾーン_${index + 1}_${area.count}件`
  );

  highFolder.appendChild(zone);
});

    const serializer = new XMLSerializer();
    const newKml = serializer.serializeToString(outputXml);

    const zip = new JSZip();
    zip.file("doc.kml", newKml);

    const blob = await zip.generateAsync({ type: "blob" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);

    const now = new Date();
    a.download = `density_zones_${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}.kmz`;
    a.click();

    status.innerHTML = `
  高密度ゾーン：${highDensityAreas.length}件<br>
  判定範囲：80m<br>
  高密度判定：80m以内に10件以上<br>
  ✔ 高密度ゾーンKMZを生成しました
`;

  } catch (error) {
    console.error(error);
    status.innerHTML = `
      <div class="distance-warning">
        密集ゾーンKMZの生成中にエラーが発生しました。
      </div>
    `;
  }
}
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
function addDensityStyles(xml, doc) {
  const styles = [
    { id: "densityHigh", color: "7d0000ff" }
  ];

  styles.forEach(s => {
    const style = xml.createElement("Style");
    style.setAttribute("id", s.id);

    const poly = xml.createElement("PolyStyle");
    const color = xml.createElement("color");
    color.textContent = s.color;

    poly.appendChild(color);
    style.appendChild(poly);
    doc.appendChild(style);
  });
}

function createDensityZonePlacemark(xml, p, radius, styleId, label) {
  const pm = xml.createElement("Placemark");

  const name = xml.createElement("name");
  name.textContent = label;

  const styleUrl = xml.createElement("styleUrl");
  styleUrl.textContent = "#" + styleId;

  const polygon = xml.createElement("Polygon");
  const outer = xml.createElement("outerBoundaryIs");
  const ring = xml.createElement("LinearRing");
  const coordinates = xml.createElement("coordinates");

  coordinates.textContent = createCircle(p.lat, p.lng, radius);

  ring.appendChild(coordinates);
  outer.appendChild(ring);
  polygon.appendChild(outer);

  pm.appendChild(name);
  pm.appendChild(styleUrl);
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
function waitForRender() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}
function isDummyPoint(p) {
  const name = p.name || "";

  if (Number(p.lat) === 0 && Number(p.lng) === 0) return true;
  if (name.includes("ここに追加")) return true;
  if (name.includes("レイヤー保持用")) return true;

  return false;
}

async function generateCircleOnlyKMZ() {
  const files = Array.from(document.getElementById("circleOnlyFileInput").files);
  const status = document.getElementById("circleOnlyStatus");

  const radii = Array.from(
    document.querySelectorAll('input[name="circleOnlyRadius"]:checked')
  ).map(e => Number(e.value));

  if (files.length === 0) {
    alert("CSV / KML / KMZ ファイルを選択してください");
    return;
  }

  if (radii.length === 0) {
    alert("30m円または40m円を選択してください");
    return;
  }

  document.getElementById("loadingOverlay").style.display = "flex";
  document.getElementById("loadingText").textContent = "円だけKMZ生成中…";

  try {
    let points = [];

    for (const file of files) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".csv")) {
    const text = await file.text();
    points.push(...parseCSV(text));
  } else if (
    fileName.endsWith(".kml") ||
    fileName.endsWith(".kmz") ||
    fileName.endsWith(".zip")
  ) {
    points.push(...await getPointsFromKmlOrKmz(file));
  }
}
   points = points.filter(p => {
  if (isDummyPoint(p)) return false;

  const layerName = p.layer || "";
  if (
    layerName.includes("円") ||
    layerName.includes("30m") ||
    layerName.includes("40m")
  ) {
    return false;
  }

  return true;
});
    const beforeCount = points.length;

    if (beforeCount === 0) {
      alert("円を作成できるスポット座標が見つかりませんでした");
      status.textContent = "";
      return;
    }

    const result = removeDuplicate(points);
    points = result.uniquePoints;

    const parser = new DOMParser();
    const outputXml = parser.parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <name>Campsite Circle Only Output</name>
        </Document>
      </kml>`,
      "application/xml"
    );

    const doc = outputXml.getElementsByTagName("Document")[0];

    const folders = {
      circle40: createFolder(outputXml, doc, "40m円（基本距離）"),
      circle30: createFolder(outputXml, doc, "30m円（調整用）")
    };

    points.forEach(p => {
      radii.forEach(radius => {
        const circlePlacemark = createCirclePlacemark(outputXml, p, radius);

        if (radius === 40) {
          folders.circle40.appendChild(circlePlacemark);
        } else if (radius === 30) {
          folders.circle30.appendChild(circlePlacemark);
        }
      });
    });

    const serializer = new XMLSerializer();
    const newKml = serializer.serializeToString(outputXml);

    const zip = new JSZip();
    zip.file("doc.kml", newKml);

    const blob = await zip.generateAsync({ type: "blob" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);

    const now = new Date();
    a.download = `campsite_circles_${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}.kmz`;
    a.click();

    status.innerHTML =
      `読み込み：${beforeCount}件<br>` +
      `重複削除：${result.duplicateCount}件<br>` +
      `円作成対象：${points.length}件<br>` +
      `✔ 円だけKMZを生成しました`;

    const success = document.getElementById("successSound");
    if (success) {
      success.currentTime = 0;
      success.volume = 0.12;
      setTimeout(() => {
        success.play().catch(() => {});
      }, 100);
    }

  } catch (error) {
    console.error(error);
    alert("円だけKMZの生成中にエラーが発生しました");
    status.textContent = "";
  } finally {
    document.getElementById("loadingOverlay").style.display = "none";
  }
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
}

async function generateExistingOnlyKMZ() {
  const files = Array.from(document.getElementById("existingOnlyFileInput").files);
  const status = document.getElementById("existingOnlyStatus");

  if (files.length === 0) {
    alert("CSV / KML / KMZ ファイルを選択してください");
    return;
  }

  document.getElementById("loadingOverlay").style.display = "flex";
  document.getElementById("loadingText").textContent = "既存POI分類KMZ生成中…";

  try {
    let points = [];

    for (const file of files) {
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith(".csv")) {
        const text = await file.text();
        points.push(...parseCSV(text));
      } else if (
        fileName.endsWith(".kml") ||
        fileName.endsWith(".kmz") ||
        fileName.endsWith(".zip")
      ) {
        points.push(...await getPointsFromKmlOrKmz(file));
      }
    }

    points = points.filter(p => !isIgnoredLayerForExistingOnly(p));

    const beforeCount = points.length;

    if (beforeCount === 0) {
      alert("分類できる既存POIが見つかりませんでした");
      status.textContent = "";
      return;
    }

    const duplicateResult = removeDuplicate(points);
    points = duplicateResult.uniquePoints;

    const parser = new DOMParser();
    const outputXml = parser.parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <name>Campsite Existing POI Output</name>
        </Document>
      </kml>`,
      "application/xml"
    );

    const doc = outputXml.getElementsByTagName("Document")[0];

    const folders = {
      pokestop: createFolder(outputXml, doc, "既存のポケストップ"),
      gym: createFolder(outputXml, doc, "既存のジム"),
      power: createFolder(outputXml, doc, "既存のパワースポット")
    };

    const counts = {
      pokestop: 0,
      gym: 0,
      power: 0
    };

    points.forEach(p => {
      const kind = classifyType(p.type, p.name, p.layer);
      const pointPlacemark = createPointPlacemark(outputXml, p);

      if (kind === "gym") {
        folders.gym.appendChild(pointPlacemark);
        counts.gym++;
      } else if (kind === "power") {
        folders.power.appendChild(pointPlacemark);
        counts.power++;
      } else {
        folders.pokestop.appendChild(pointPlacemark);
        counts.pokestop++;
      }
    });

    const serializer = new XMLSerializer();
    const newKml = serializer.serializeToString(outputXml);

    const zip = new JSZip();
    zip.file("doc.kml", newKml);

    const blob = await zip.generateAsync({ type: "blob" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);

    const now = new Date();
    a.download = `campsite_existing_poi_${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}.kmz`;
    a.click();

    status.innerHTML =
      `読み込み：${beforeCount}件<br>` +
      `重複削除：${duplicateResult.duplicateCount}件<br>` +
      `既存ポケストップ：${counts.pokestop}件<br>` +
      `既存ジム：${counts.gym}件<br>` +
      `既存パワースポット：${counts.power}件<br>` +
      `✔ 既存POI分類KMZを生成しました`;

    const success = document.getElementById("successSound");
    if (success) {
      success.currentTime = 0;
      success.volume = 0.12;
      setTimeout(() => {
        success.play().catch(() => {});
      }, 100);
    }

  } catch (error) {
    console.error(error);
    alert("既存POI分類KMZの生成中にエラーが発生しました");
    status.textContent = "";
  } finally {
    document.getElementById("loadingOverlay").style.display = "none";
  }
}
async function generateKMZ() {
  if (ENABLE_QUIZ && localStorage.getItem("quizPassed") !== QUIZ_VERSION) {
  showQuiz();
  return;
}
  document.getElementById("loadingOverlay").style.display = "flex";
  const files = Array.from(document.getElementById("fileInput").files);
  const status = document.getElementById("status");

  const radii = Array.from(
    document.querySelectorAll('input[name="radius"]:checked')
  ).map(e => Number(e.value));

  if (files.length === 0) {
  alert("CSV / KML / KMZ ファイルを選択してください");
  document.getElementById("loadingOverlay").style.display = "none";
  return;
}
 if (radii.length === 0) {
  alert("30m円または40m円を選択してください");
  document.getElementById("loadingOverlay").style.display = "none";
  return;
}
await waitForRender();

  let points = [];

  for (const file of files) {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".csv")) {
      const text = await file.text();
      points.push(...parseCSV(text));
    } else if (
  fileName.endsWith(".kml") ||
  fileName.endsWith(".kmz") ||
  fileName.endsWith(".zip")
) {
  points.push(...await getPointsFromKmlOrKmz(file));
}  }

  const beforeCount = points.length;

 if (beforeCount === 0) {
  alert("スポット座標が見つかりませんでした");
  status.textContent = "";
  document.getElementById("loadingOverlay").style.display = "none";
  return;
}
await waitForRender();

  const result = removeDuplicate(points);
  points = result.uniquePoints;
document.getElementById("loadingText").textContent = "KMZ生成中…";
  status.innerHTML = `
  <span class="loading">
    <span class="spinner"></span>
    KMZ生成中…
  </span>
`;
  await sleep(3000);
  
await waitForRender();
  const parser = new DOMParser();
  const outputXml = parser.parseFromString(
    `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <name>Campsite Design Output</name>
      </Document>
    </kml>`,
    "application/xml"
  );

  const doc = outputXml.getElementsByTagName("Document")[0];
const hiddenStyle = outputXml.createElement("Style");
hiddenStyle.setAttribute("id", "hiddenStyle");

const iconStyle = outputXml.createElement("IconStyle");
const scale = outputXml.createElement("scale");
scale.textContent = "0";

iconStyle.appendChild(scale);
hiddenStyle.appendChild(iconStyle);
doc.appendChild(hiddenStyle);
  const folders = {
  pokestop: createFolder(outputXml, doc, "既存のポケストップ"),
  gym: createFolder(outputXml, doc, "既存のジム"),
  power: createFolder(outputXml, doc, "既存のパワースポット"),

  addPokestop: createFolder(outputXml, doc, "追加希望ポケスト"),
  addGym: createFolder(outputXml, doc, "追加希望ジム"),
  addPower: createFolder(outputXml, doc, "追加希望パワスポ"),

  circle40: createFolder(outputXml, doc, "40m円（基本距離）"),
  circle30: createFolder(outputXml, doc, "30m円（調整用）")
};

addDummyPlacemark(outputXml, folders.addPokestop, "ここに追加ポケストを配置");
addDummyPlacemark(outputXml, folders.addGym, "ここに追加ジムを配置");
addDummyPlacemark(outputXml, folders.addPower, "ここに追加パワスポを配置");

points.forEach(p => {
  const kind = classifyType(p.type, p.name, p.layer);
  const pointPlacemark = createPointPlacemark(outputXml, p);

  if (kind === "gym") {
    folders.gym.appendChild(pointPlacemark);
  } else if (kind === "power") {
    folders.power.appendChild(pointPlacemark);
  } else {
    folders.pokestop.appendChild(pointPlacemark);
  }

  radii.forEach(radius => {
    const circlePlacemark = createCirclePlacemark(outputXml, p, radius);

    if (radius === 40) {
      folders.circle40.appendChild(circlePlacemark);
    } else if (radius === 30) {
      folders.circle30.appendChild(circlePlacemark);
    }
  });
});

  const serializer = new XMLSerializer();
  const newKml = serializer.serializeToString(outputXml);

  const zip = new JSZip();
  zip.file("doc.kml", newKml);

  const blob = await zip.generateAsync({ type: "blob" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const now = new Date();
a.download = `campsite_${now.getFullYear()}${now.getMonth()+1}${now.getDate()}.kmz`;
 a.click();

const success = document.getElementById("successSound");
success.currentTime = 0;
success.volume = 0.12;

setTimeout(() => {
  success.play().catch(() => {});
}, 100);

// どんな状況でも消す（最強）
setTimeout(() => {
  document.getElementById("loadingOverlay").style.display = "none";
}, 300);
status.innerHTML =
    `読み込み：${beforeCount}件<br>` +
    `重複削除：${result.duplicateCount}件<br>` +
    `出力：${points.length}件<br>` +
    `✔ KMZを生成しました`;
  status.style.transform = "scale(1.05)";
setTimeout(() => {
  status.style.transform = "scale(1)";
}, 120);
}