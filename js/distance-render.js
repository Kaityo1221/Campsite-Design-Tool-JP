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

    const isReference = isExistingPoiPair(w);

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
      ${escapeDistanceHtml(w.a.layer)}：${escapeDistanceHtml(w.a.name)}<br>
× ${escapeDistanceHtml(w.b.layer)}：${escapeDistanceHtml(w.b.name)}<br>
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
