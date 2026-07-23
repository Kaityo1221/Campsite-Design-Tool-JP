window._densityAreas = [];
let adminReviewMapInstance = null;
function escapeAdminHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function copyAdminReviewSummary() {
  const text =
    window._adminReviewSummaryText || "";

  if (!text.trim()) {
    alert("コピーするレビュー文がありません");
    return;
  }

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert("レビュー共有文をコピーしました");
      })
      .catch(() => {
        fallbackCopyAdminReviewSummary();
      });

    return;
  }

  fallbackCopyAdminReviewSummary();
}

function fallbackCopyAdminReviewSummary() {
  const textarea =
    document.getElementById("adminReviewShareText");

  if (!textarea) {
    alert("コピーできませんでした");
    return;
  }

  textarea.focus();
  textarea.select();

  document.execCommand("copy");

  alert("レビュー共有文をコピーしました");
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
function analyzePoiDuplicates(points) {
  const coordMap = new Map();

  points.forEach(p => {
    if (isDummyPoint(p)) return;

    const lat = Number(p.lat);
    const lng = Number(p.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const coord = `${lat.toFixed(6)},${lng.toFixed(6)}`;

    if (!coordMap.has(coord)) {
      coordMap.set(coord, []);
    }

    coordMap.get(coord).push(p);
  });

  const duplicateCoordGroups = [...coordMap.entries()]
    .filter(([coord, items]) => items.length >= 2);

  return {
    duplicateCoordGroups
  };
}
async function runAdminDashboardReview() {
  const input =
    document.getElementById("adminReviewFile");

  const result =
    document.getElementById("adminReviewResult");

  if (!input || !input.files.length) {
    alert("完成KMZを選択してください");
    return;
  }

  const file = input.files[0];
  const fileName = file.name.toLowerCase();

  if (
    !fileName.endsWith(".kml") &&
    !fileName.endsWith(".kmz") &&
    !fileName.endsWith(".zip")
  ) {
    result.innerHTML = `
      <div class="distance-warning">
        ⚠ KML / KMZ形式のファイルを選択してください。
      </div>
    `;

    return;
  }

  result.innerHTML = `
    <div class="distance-warning" style="
      background:rgba(59,130,246,0.12);
      border:1px solid rgba(96,165,250,0.35);
    ">
      <span class="loading">
        <span class="spinner"></span>
        管理者レビュー中…
      </span>
    </div>
  `;

  try {
    const extracted =
      await extractLayersFromKML(file);

    if (extracted.errorCode === "KML_NOT_FOUND") {
      result.innerHTML = `
        <div class="distance-warning">
          ⚠ KMZ内にKMLファイルが見つかりません。
        </div>
      `;

      return;
    }

    const layers =
      extracted.layers || [];

    const pointsByLayer =
      extracted.pointsByLayer || {};
      
const polygons =
  extracted.polygons || [];
    const allPoints = [];
    let dummyCount = 0;

    layers.forEach(layerName => {
      const points =
        pointsByLayer[layerName] || [];

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
    });

    const usablePoints =
      allPoints.filter(p => !isDummyPoint(p));

    const existingPoints =
      usablePoints.filter(p => {
        return getAdminLayerInfo(
          p.layer || ""
        ).isExisting;
      });

    const addedPoints =
      usablePoints.filter(p => {
        return getAdminLayerInfo(
          p.layer || ""
        ).isAdd;
      });

    const circleLayers =
      layers.filter(layerName => {
        return getAdminLayerInfo(
          layerName
        ).isCircle;
      });

    const duplicateInfo =
      analyzePoiDuplicates(
        usablePoints
      );

    const hasPolygon =
      window._hasPolygon === true;
const addedPoiCounts = {
  pokestop: 0,
  gym: 0,
  power: 0
};

addedPoints.forEach(p => {
  const kind =
    classifyType(
      p.type,
      p.name,
      p.layer
    );

  if (kind === "gym") {
    addedPoiCounts.gym++;
  } else if (kind === "power") {
    addedPoiCounts.power++;
  } else {
    addedPoiCounts.pokestop++;
  }
});

const addedPoiTotal =
  addedPoiCounts.pokestop +
  addedPoiCounts.gym +
  addedPoiCounts.power;

const poiLimitDetails = [];

if (addedPoiTotal > 25) {
  poiLimitDetails.push(
    `合計 ${addedPoiTotal}件 / 上限25件`
  );
}

if (addedPoiCounts.pokestop > 12) {
  poiLimitDetails.push(
    `ポケストップ ${addedPoiCounts.pokestop}件 / 上限12件`
  );
}

if (addedPoiCounts.gym > 8) {
  poiLimitDetails.push(
    `ジム ${addedPoiCounts.gym}件 / 上限8件`
  );
}

if (addedPoiCounts.power > 5) {
  poiLimitDetails.push(
    `パワースポット ${addedPoiCounts.power}件 / 上限5件`
  );
}

const addedPoiLimitOk =
  poiLimitDetails.length === 0;

const under30Pairs = [];
const adjustablePairs = [];
const existingReferencePairs = [];

for (
  let i = 0;
  i < usablePoints.length;
  i++
) {
  for (
    let j = i + 1;
    j < usablePoints.length;
    j++
  ) {
    const a = usablePoints[i];
    const b = usablePoints[j];

    const aInfo =
      getAdminLayerInfo(
        a.layer || ""
      );

    const bInfo =
      getAdminLayerInfo(
        b.layer || ""
      );

    const distance =
      getDistanceMeters(a, b);

    /*
      1m未満は重複POI側で扱う。
      距離警告として二重計上しない。
    */
    if (distance < 1) {
      continue;
    }

    const involvesAddedPoi =
      aInfo.isAdd ||
      bInfo.isAdd;

    if (!involvesAddedPoi) {
      if (distance < 40) {
        existingReferencePairs.push({
          a,
          b,
          distance
        });
      }

      continue;
    }

    if (distance < 30) {
      under30Pairs.push({
        a,
        b,
        distance
      });
    } else if (distance < 40) {
      adjustablePairs.push({
        a,
        b,
        distance
      });
    }
  }
}
    const criticalMessages = [];
    const cautionMessages = [];
    const referenceMessages = [];

    if (!hasPolygon) {
      criticalMessages.push(
        "活動範囲ポリゴンがありません"
      );
    }
if (!addedPoiLimitOk) {
  criticalMessages.push(
    `追加POI上限超過：${
      poiLimitDetails.join(" / ")
    }`
  );
}

if (under30Pairs.length > 0) {
  criticalMessages.push(
    `追加POIに関係する30m未満の近接：${
      under30Pairs.length
    }件`
  );
}

if (adjustablePairs.length > 0) {
  cautionMessages.push(
    `追加POIに関係する30〜40mの調整可能距離：${
      adjustablePairs.length
    }件`
  );
}

if (existingReferencePairs.length > 0) {
  referenceMessages.push(
    `既存POI同士の40m未満近接：${
      existingReferencePairs.length
    }件`
  );
}
    if (
      duplicateInfo
        .duplicateCoordGroups
        .length > 0
    ) {
      criticalMessages.push(
        `座標完全一致の重複POI：${
          duplicateInfo
            .duplicateCoordGroups
            .length
        }グループ`
      );
    }

    if (addedPoints.length === 0) {
      cautionMessages.push(
        "追加希望POIが見つかりません"
      );
    }

    if (dummyCount > 0) {
      cautionMessages.push(
        `ダミーポイント：${dummyCount}件`
      );
    }

    if (circleLayers.length > 0) {
      referenceMessages.push(
        `円レイヤー：${circleLayers.length}件`
      );
    }

    let status = "提出前確認OK";
    let statusIcon = "✅";
    let statusColor = "#22c55e";

    if (criticalMessages.length > 0) {
      status = "要修正";
      statusIcon = "🚨";
      statusColor = "#ef4444";
    } else if (cautionMessages.length > 0) {
      status = "要確認";
      statusIcon = "⚠";
      statusColor = "#f97316";
    }
    const nextActionText =
  criticalMessages.length > 0
    ? "赤い要修正項目を先に確認し、表示されているタグの内容を優先して直してください。"
    : cautionMessages.length > 0
      ? "提出は可能そうですが、30〜40mの調整距離やダミーポイントを確認してください。"
      : "大きな問題は見つかりません。提出前の最終確認として、地図と活動範囲を確認してください。";
    const reviewerCommentText =
  criticalMessages.length > 0
    ? "現時点では提出前に修正が必要です。要修正項目を調整したうえで、再度KMZを確認してください。"
    : cautionMessages.length > 0
      ? "大きな問題はありませんが、提出前に要確認項目を見直してください。"
      : "提出前チェックでは大きな問題は見つかりませんでした。最終確認後に提出へ進めます。";
              const nextActionItems = [];

    if (!hasPolygon) {
      nextActionItems.push("活動範囲ポリゴンを追加");
    }

    if (!addedPoiLimitOk) {
      nextActionItems.push("追加POI上限を調整");
    }

    if (under30Pairs.length > 0) {
      nextActionItems.push("30m未満の近接を修正");
    }

    if (
      duplicateInfo
        .duplicateCoordGroups
        .length > 0
    ) {
      nextActionItems.push("重複POIを確認");
    }

    if (adjustablePairs.length > 0) {
      nextActionItems.push("30〜40mを確認");
    }

    if (nextActionItems.length === 0) {
      nextActionItems.push("地図と活動範囲を最終確認");
    }

    const nextActionItemsHtml =
      nextActionItems
        .map(item => `
          <span style="
            display:inline-block;
            margin:6px 6px 0 0;
            padding:5px 9px;
            border-radius:999px;
            background:rgba(59,130,246,0.14);
            border:1px solid rgba(147,197,253,0.35);
            color:#bfdbfe;
            font-size:12px;
            font-weight:bold;
          ">
            ${escapeAdminHtml(item)}
          </span>
        `)
        .join("");
    const renderMetric = (
  label,
  value,
  type = "neutral"
) => {
  const styles = {
    ok: {
      color: "#22c55e",
      background: "rgba(34,197,94,0.10)",
      border: "rgba(34,197,94,0.35)"
    },

    caution: {
      color: "#f97316",
      background: "rgba(249,115,22,0.10)",
      border: "rgba(249,115,22,0.35)"
    },

    danger: {
      color: "#ef4444",
      background: "rgba(239,68,68,0.10)",
      border: "rgba(239,68,68,0.38)"
    },
reference: {
  color: "#7dd3fc",
  background: "rgba(14,165,233,0.10)",
  border: "rgba(56,189,248,0.35)"
},
    neutral: {
      color: "#f8fafc",
      background: "rgba(15,23,42,0.66)",
      border: "rgba(148,163,184,0.20)"
    }
  };

  const style =
    styles[type] || styles.neutral;

  return `
    <div style="
      padding:12px;
      border-radius:12px;
      background:${style.background};
      border:1px solid ${style.border};
    ">
      <div style="
        color:#94a3b8;
        font-size:12px;
      ">
        ${escapeAdminHtml(label)}
      </div>

      <strong style="
        display:block;
        margin-top:4px;
        color:${style.color};
        font-size:20px;
      ">
        ${escapeAdminHtml(value)}
      </strong>
    </div>
  `;
};

    const renderPoiLimitCheckRow = () => {
  const statusColor =
    addedPoiLimitOk
      ? "#22c55e"
      : "#ef4444";

  const statusBackground =
    addedPoiLimitOk
      ? "rgba(34,197,94,0.10)"
      : "rgba(239,68,68,0.10)";

  const statusIcon =
    addedPoiLimitOk
      ? "○"
      : "×";

  const exceededItems = [];

  if (addedPoiTotal > 25) {
    exceededItems.push(
      `合計 ${addedPoiTotal} / 25件`
    );
  }

  if (addedPoiCounts.pokestop > 12) {
    exceededItems.push(
      `ポケストップ ${addedPoiCounts.pokestop} / 12件`
    );
  }

  if (addedPoiCounts.gym > 8) {
    exceededItems.push(
      `ジム ${addedPoiCounts.gym} / 8件`
    );
  }

  if (addedPoiCounts.power > 5) {
    exceededItems.push(
      `パワースポット ${addedPoiCounts.power} / 5件`
    );
  }

  const summaryText =
    addedPoiLimitOk
      ? `合計 ${addedPoiTotal} / 25件`
      : `超過：${exceededItems.join("・")}`;

  const renderPoiDetail = (
    label,
    current,
    limit
  ) => {
    const isOver =
      current > limit;

    return `
      <div style="
        display:grid;
        grid-template-columns:
          minmax(130px, 1fr) auto 22px;
        gap:8px;
        margin-top:6px;
        color:#cbd5e1;
        font-size:13px;
      ">
        <span>
          ${escapeAdminHtml(label)}
        </span>

        <span>
          ${current} / ${limit}件
        </span>

        <strong style="
          color:${
            isOver
              ? "#ef4444"
              : "#22c55e"
          };
        ">
          ${isOver ? "×" : "○"}
        </strong>
      </div>
    `;
  };

  return `
    <div style="
      margin-top:8px;
      padding:10px 12px;
      border-radius:10px;
      background:${statusBackground};
      border:1px solid ${statusColor};
    ">
      <div style="
        display:grid;
        grid-template-columns:
          34px minmax(130px, 1fr) 2fr;
        gap:8px;
        align-items:center;
      ">
        <strong style="
          color:${statusColor};
          font-size:24px;
          line-height:1;
        ">
          ${statusIcon}
        </strong>

        <strong style="
          color:#f8fafc;
        ">
          追加POI上限
        </strong>

        <span style="
          color:#cbd5e1;
          font-size:13px;
        ">
          ${escapeAdminHtml(summaryText)}
        </span>
      </div>

      <details style="
        margin-top:8px;
        padding-left:42px;
      ">
        <summary style="
          cursor:pointer;
          color:#93c5fd;
          font-size:13px;
          font-weight:bold;
        ">
          内訳を見る
        </summary>

        <div style="
          margin-top:8px;
          max-width:420px;
        ">
          ${renderPoiDetail(
            "ポケストップ",
            addedPoiCounts.pokestop,
            12
          )}

          ${renderPoiDetail(
            "ジム",
            addedPoiCounts.gym,
            8
          )}

          ${renderPoiDetail(
            "パワースポット",
            addedPoiCounts.power,
            5
          )}
        </div>
      </details>
    </div>
  `;
};
const renderDistancePairCheckRow = (
  label,
  pairs,
  status
) => {
  const settings = {
    caution: {
      icon: "△",
      color: "#f97316",
      background:
        "rgba(249,115,22,0.10)"
    },

    danger: {
      icon: "×",
      color: "#ef4444",
      background:
        "rgba(239,68,68,0.10)"
    }
  };

  const setting =
    settings[status];

  const sortedPairs =
    [...pairs].sort(
      (a, b) =>
        a.distance - b.distance
    );

  const visiblePairs =
    sortedPairs.slice(0, 10);

  const detailHtml =
    visiblePairs.map(pair => `
      <div style="
        margin-top:8px;
        padding:8px 10px;
        border-radius:8px;
        background:rgba(15,23,42,0.55);
        color:#cbd5e1;
        font-size:13px;
        line-height:1.65;
      ">
        <strong style="
          color:${setting.color};
        ">
          ${pair.distance.toFixed(1)}m
        </strong><br>

        ${escapeAdminHtml(
          pair.a.name || "名称なし"
        )}
        <span style="opacity:0.68;">
          （${escapeAdminHtml(
            pair.a.layer || "不明"
          )}）
        </span><br>

        × ${escapeAdminHtml(
          pair.b.name || "名称なし"
        )}
        <span style="opacity:0.68;">
          （${escapeAdminHtml(
            pair.b.layer || "不明"
          )}）
        </span>
      </div>
    `).join("");

  const moreText =
    sortedPairs.length > 10
      ? `
        <div style="
          margin-top:8px;
          color:#94a3b8;
          font-size:12px;
        ">
          ほか ${sortedPairs.length - 10}件
        </div>
      `
      : "";

  return `
    <div style="
      margin-top:8px;
      padding:10px 12px;
      border-radius:10px;
      background:${setting.background};
      border:1px solid ${setting.color};
    ">
      <div style="
        display:grid;
        grid-template-columns:
          34px minmax(130px, 1fr) 2fr;
        gap:8px;
        align-items:center;
      ">
        <strong style="
          color:${setting.color};
          font-size:24px;
          line-height:1;
        ">
          ${setting.icon}
        </strong>

        <strong style="
          color:#f8fafc;
        ">
          ${escapeAdminHtml(label)}
        </strong>

        <span style="
          color:#cbd5e1;
          font-size:13px;
        ">
          ${pairs.length}件
        </span>
      </div>

      <details style="
        margin-top:8px;
        padding-left:42px;
      ">
        <summary style="
          cursor:pointer;
          color:#93c5fd;
          font-size:13px;
          font-weight:bold;
        ">
          内訳を見る
        </summary>

        <div style="
          margin-top:8px;
          max-width:680px;
        ">
          ${detailHtml}
          ${moreText}
        </div>
      </details>
    </div>
  `;
};
const renderReviewCheckRow = (
  label,
  status,
  note
) => {
  const settings = {
    ok: {
      icon: "○",
      color: "#22c55e",
      background:
        "rgba(34,197,94,0.10)"
    },

    caution: {
      icon: "△",
      color: "#f97316",
      background:
        "rgba(249,115,22,0.10)"
    },

    danger: {
      icon: "×",
      color: "#ef4444",
      background:
        "rgba(239,68,68,0.10)"
    }
  };

  const setting =
    settings[status];

  return `
    <div style="
      display:grid;
      grid-template-columns:
        34px minmax(150px, 1fr) 2fr;
      gap:8px;
      align-items:center;
      margin-top:8px;
      padding:10px 12px;
      border-radius:10px;
      background:${setting.background};
      border:1px solid ${setting.color};
    ">
      <strong style="
        color:${setting.color};
        font-size:24px;
        line-height:1;
      ">
        ${setting.icon}
      </strong>

      <strong style="
        color:#f8fafc;
      ">
        ${escapeAdminHtml(label)}
      </strong>

      <span style="
        color:#cbd5e1;
        font-size:13px;
      ">
        ${escapeAdminHtml(note)}
      </span>
    </div>
  `;
};
    
    const renderMessageList = (
  items,
  emptyText,
  type = "reference"
) => {
  const settings = {
    danger: {
      icon: "×",
      color: "#ef4444",
      background: "rgba(239,68,68,0.10)",
      border: "rgba(239,68,68,0.42)"
    },

    caution: {
      icon: "△",
      color: "#f97316",
      background: "rgba(249,115,22,0.10)",
      border: "rgba(249,115,22,0.42)"
    },

    reference: {
      icon: "i",
      color: "#94a3b8",
      background: "rgba(148,163,184,0.08)",
      border: "rgba(148,163,184,0.28)"
    }
  };

  const setting =
    settings[type] || settings.reference;

  if (items.length === 0) {
    return `
      <div style="
        margin-top:8px;
        padding:10px 12px;
        border-radius:10px;
        background:rgba(34,197,94,0.08);
        border:1px solid rgba(34,197,94,0.25);
        color:#bbf7d0;
        font-size:13px;
      ">
        ○ ${escapeAdminHtml(emptyText)}
      </div>
    `;
  }

  return items
    .map((message, index) => `
      <div style="
        display:grid;
        grid-template-columns:28px 1fr;
        gap:8px;
        align-items:start;
        margin-top:8px;
        padding:10px 12px;
        border-radius:10px;
        background:${setting.background};
        border:1px solid ${setting.border};
      ">
        <strong style="
          color:${setting.color};
          font-size:18px;
          line-height:1.2;
          text-align:center;
        ">
          ${setting.icon}
        </strong>

        <div style="
          color:#e5e7eb;
          font-size:13px;
          line-height:1.65;
        ">
          <span style="opacity:0.72;">
            ${index + 1}.
          </span>
          ${escapeAdminHtml(message)}
        </div>
      </div>
    `)
    .join("");
};
    const reviewShareText = `
【Campsite提出KMZレビュー】

総合判定：${status}

次にやること：
${nextActionText}

レビューコメント：
${reviewerCommentText}

ファイル名：
${file.name}

確認結果：
・活動範囲ポリゴン：${hasPolygon ? "あり" : "なし"}
・追加POI：${addedPoints.length}件
・30m未満の近接：${under30Pairs.length}件
・30〜40mの調整距離：${adjustablePairs.length}件
・重複POI：${duplicateInfo.duplicateCoordGroups.length}グループ
・追加POI上限：${addedPoiLimitOk ? "問題なし" : "超過あり"}

要修正：
${criticalMessages.length ? criticalMessages.map(m => "・" + m).join("\n") : "・特になし"}

要確認：
${cautionMessages.length ? cautionMessages.map(m => "・" + m).join("\n") : "・特になし"}

参考情報：
${referenceMessages.length ? referenceMessages.map(m => "・" + m).join("\n") : "・特になし"}
`.trim();

    window._adminReviewSummaryText =
      reviewShareText;
    result.innerHTML = `
            <div class="distance-warning" style="
        border:1px solid ${statusColor};
        background:rgba(15,23,42,0.72);
      ">
        <strong style="
          color:${statusColor};
          font-size:22px;
        ">
          ${statusIcon} 総合判定：${status}
        </strong>

        <div style="
          margin-top:8px;
          color:#cbd5e1;
          font-size:13px;
        ">
          ${escapeAdminHtml(file.name)}
        </div>

        <div style="
          margin-top:12px;
          padding:10px 12px;
          border-radius:10px;
          background:rgba(15,23,42,0.58);
          border:1px solid rgba(148,163,184,0.20);
        ">
          <strong style="
            display:block;
            margin-bottom:4px;
            color:#e2e8f0;
            font-size:14px;
          ">
            次にやること
          </strong>

          <div style="
            color:#cbd5e1;
            font-size:13px;
            line-height:1.7;
          ">
            ${escapeAdminHtml(nextActionText)}
          </div>
                    <div style="
            margin-top:8px;
          ">
            ${nextActionItemsHtml}
          </div>
        </div>
      </div>

      <div style="
        display:grid;
        grid-template-columns:
          repeat(
            auto-fit,
            minmax(140px, 1fr)
          );
        gap:10px;
        margin-top:14px;
      ">
        ${renderMetric(
  "重大警告",
  criticalMessages.length + "件",
  criticalMessages.length > 0
    ? "danger"
    : "ok"
)}

        ${renderMetric(
  "要確認",
  cautionMessages.length + "件",
  cautionMessages.length > 0
    ? "caution"
    : "ok"
)}

        ${renderMetric(
  "参考情報",
  referenceMessages.length + "件",
  referenceMessages.length > 0
    ? "reference"
    : "neutral"
)}

        ${renderMetric(
          "既存POI",
          existingPoints.length + "件"
        )}

        ${renderMetric(
  "追加POI",
  addedPoints.length + "件",
  addedPoiLimitOk
    ? "neutral"
    : "danger"
)}

        ${renderMetric(
  "活動範囲ポリゴン",
  hasPolygon ? "○" : "×",
  hasPolygon
    ? "ok"
    : "danger"
)}

        ${renderMetric(
          "レイヤー",
          layers.length + "件"
        )}

                ${renderMetric(
          "全ポイント",
          allPoints.length + "件"
        )}
      </div>

      <div class="distance-warning" style="
        margin-top:14px;
        border:1px solid rgba(56,189,248,0.38);
        background:rgba(14,165,233,0.08);
      ">
        <strong style="
          color:#7dd3fc;
          font-size:18px;
        ">
          提出前チェック
        </strong>

        ${renderReviewCheckRow(
          "活動範囲ポリゴン",
          hasPolygon
            ? "ok"
            : "danger",
          hasPolygon
            ? "設定済み"
            : "未設定"
        )}

                ${renderPoiLimitCheckRow()}

        ${renderReviewCheckRow(
          "重複POI",
          duplicateInfo
            .duplicateCoordGroups
            .length === 0
            ? "ok"
            : "danger",
          duplicateInfo
            .duplicateCoordGroups
            .length === 0
            ? "問題なし"
            : `${
                duplicateInfo
                  .duplicateCoordGroups
                  .length
              }グループ`
        )}

        ${
  under30Pairs.length === 0
    ? renderReviewCheckRow(
        "30m未満の近接",
        "ok",
        "問題なし"
      )
    : renderDistancePairCheckRow(
        "30m未満の近接",
        under30Pairs,
        "danger"
      )
}

        ${
  adjustablePairs.length === 0
    ? renderReviewCheckRow(
        "30〜40mの調整距離",
        "ok",
        "問題なし"
      )
    : renderDistancePairCheckRow(
        "30〜40mの調整距離",
        adjustablePairs,
        "caution"
      )
}
      </div>

      <div class="distance-warning" style="
        margin-top:14px;
        border:1px solid rgba(147,197,253,0.38);
        background:rgba(30,64,175,0.12);
      ">
        <strong style="
          color:#bfdbfe;
          font-size:18px;
        ">
          Ryota共有用メモ
        </strong>

        <p style="
          margin-top:8px;
          color:#cbd5e1;
          font-size:12px;
          line-height:1.7;
        ">
          レビュー結果をそのまま共有できる短文です。
        </p>

        <textarea
          id="adminReviewShareText"
          readonly
          style="
            width:100%;
            min-height:190px;
            margin-top:10px;
            padding:12px;
            border-radius:10px;
            border:1px solid rgba(148,163,184,0.30);
            background:rgba(15,23,42,0.85);
            color:#e5e7eb;
            font-size:13px;
            line-height:1.65;
            resize:vertical;
          "
        >${escapeAdminHtml(reviewShareText)}</textarea>

        <button
          type="button"
          class="generate"
          onclick="copyAdminReviewSummary()"
          style="margin-top:10px;"
        >
          共有文をコピー
        </button>
      </div>
      
      
      <div class="distance-warning" style="
        margin-top:14px;
        border:1px solid rgba(56,189,248,0.38);
        background:rgba(14,165,233,0.08);
      ">
        <strong style="
          color:#7dd3fc;
          font-size:18px;
        ">
          管理者レビュー地図
        </strong>

        <details style="
  margin-top:8px;
  padding:10px 12px;
  border-radius:10px;
  background:rgba(15,23,42,0.48);
  border:1px solid rgba(148,163,184,0.18);
  color:#cbd5e1;
  font-size:12px;
  line-height:1.75;
">
  <summary style="
    cursor:pointer;
    color:#7dd3fc;
    font-weight:bold;
    font-size:13px;
  ">
    地図の見方を開く
  </summary>

  <div style="
    margin-top:8px;
  ">
  ※右上のレイヤーボタンから、地理院航空写真とOpenStreetMapを切り替えられます。<br>

※
<strong style="
  color:#fca5a5;
  text-decoration:underline;
  text-underline-offset:3px;
">
  赤い実線
</strong>
は30m未満の近接です。提出前に優先して修正してください。<br>

※
<strong style="
  color:#67e8f9;
  text-decoration:underline;
  text-underline-offset:3px;
">
  水色の実線
</strong>
は30〜40mの調整可能距離です。配置調整の候補として確認してください。<br>

※
<strong style="
  color:#fde68a;
  text-decoration:underline;
  text-underline-offset:3px;
">
  黄色い点線
</strong>
は、追加POIの近接が1件だけの場合に表示する調整方向です。<br>

※
<strong style="
  color:#fca5a5;
  text-decoration:underline;
  text-underline-offset:3px;
">
  複数のPOIと近接している場合は方向を表示しません。
</strong>
<strong style="
  color:#93c5fd;
">
  Niantic側の正確なPOIデータ
</strong>
をもとに調整してください。
  </div>
</details>

        <div
          id="adminReviewMap"
          style="
            width:100%;
            height:460px;
            margin-top:12px;
            border-radius:12px;
            overflow:hidden;
          "
        ></div>
        <details style="
  margin-top:10px;
  padding:10px 12px;
  border-radius:10px;
  background:rgba(15,23,42,0.58);
  border:1px solid rgba(148,163,184,0.20);
  color:#cbd5e1;
  font-size:12px;
  line-height:1.8;
">
  <summary style="
    cursor:pointer;
    color:#e2e8f0;
    font-weight:bold;
    font-size:13px;
  ">
    地図凡例を開く
  </summary>

  <div style="
    margin-top:8px;
  ">

  <div>
    <span style="
      display:inline-block;
      width:34px;
      border-top:6px solid #ef4444;
      vertical-align:middle;
      margin-right:8px;
    "></span>
    30m未満：最優先で修正
  </div>

  <div>
    <span style="
      display:inline-block;
      width:34px;
      border-top:3px solid #06b6d4;
      vertical-align:middle;
      margin-right:8px;
    "></span>
    30〜40m：調整候補
  </div>

  <div>
    <span style="
      display:inline-block;
      width:34px;
      border-top:4px dashed #eab308;
      vertical-align:middle;
      margin-right:8px;
    "></span>
    調整方向：追加POIの参考移動方向
  </div>

  <div>
    <span style="
      display:inline-block;
      width:18px;
      height:12px;
      border:2px solid #22c55e;
      background:rgba(34,197,94,0.18);
      vertical-align:middle;
      margin-right:16px;
    "></span>
    活動範囲：実際に歩く・遊ぶエリア
   </div>

  </div>
</details>
      </div>
      <div class="distance-warning" style="
        margin-top:14px;
        border:1px solid rgba(239,68,68,0.38);
        background:rgba(239,68,68,0.10);
      ">
        <strong style="color:#fca5a5;">
          🔴 要修正
        </strong>

        ${renderMessageList(
  criticalMessages,
  "重大な問題は見つかりませんでした。",
  "danger"
)}
      </div>

      <div class="distance-warning" style="
        margin-top:12px;
        border:1px solid rgba(249,115,22,0.38);
        background:rgba(249,115,22,0.10);
      ">
        <strong style="color:#fdba74;">
          🟠 要確認
        </strong>

${renderMessageList(
  cautionMessages,
  "追加の確認事項はありません。",
  "caution"
)}
      </div>

      <div class="distance-warning" style="
        margin-top:12px;
        border:1px solid rgba(148,163,184,0.30);
        background:rgba(148,163,184,0.08);
      ">
        <strong style="color:#cbd5e1;">
          ⚪ 参考情報
        </strong>

        ${renderMessageList(
  referenceMessages,
  "参考情報はありません。",
  "reference"
)}
      </div>
    `;

   renderAdminReviewBaseMap(
  usablePoints,
  under30Pairs,
  adjustablePairs,
  polygons
);

  } catch (error) {
    console.error(error);

    result.innerHTML = `
      <div class="distance-warning">
        ⚠ 管理者レビュー中にエラーが発生しました。<br>
        ファイル形式またはKMZ内の構成を確認してください。
      </div>
    `;
  }
}

function renderAdminReviewBaseMap(
  points = [],
  under30Pairs = [],
  adjustablePairs = [],
  polygons = []
) {
  const mapElement =
    document.getElementById("adminReviewMap");

  if (!mapElement) {
    return;
  }

  if (typeof L === "undefined") {
    console.error(
      "Leafletが読み込まれていません"
    );

    mapElement.innerHTML = `
      <div style="
        padding:16px;
        color:#fecaca;
      ">
        地図ライブラリを読み込めませんでした。
      </div>
    `;

    return;
  }

  if (adminReviewMapInstance) {
    adminReviewMapInstance.remove();
    adminReviewMapInstance = null;
  }

  adminReviewMapInstance =
    L.map("adminReviewMap", {
      zoomControl: true
    });

  const adminPhotoLayer =
    L.tileLayer(
      "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
      {
        attribution:
          '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>',
        maxZoom: 18
      }
    );

  const adminOsmLayer =
    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19
      }
    );

adminOsmLayer.addTo(
  adminReviewMapInstance
);

  const existingPoiLayer =
  L.layerGroup().addTo(
    adminReviewMapInstance
  );

const addedPoiLayer =
  L.layerGroup().addTo(
    adminReviewMapInstance
  );

const dangerDistanceLayer =
  L.layerGroup().addTo(
    adminReviewMapInstance
  );

const cautionDistanceLayer =
  L.layerGroup().addTo(
    adminReviewMapInstance
  );
const adviceDirectionLayer =
  L.layerGroup().addTo(
    adminReviewMapInstance
  );

  const activityPolygonLayer =
  L.layerGroup().addTo(
    adminReviewMapInstance
  );
L.control.layers(
  {
    "OpenStreetMap":
      adminOsmLayer,

    "地理院航空写真":
      adminPhotoLayer
  },
  {
    "🔵 既存POI":
      existingPoiLayer,

    "🟣 追加POI":
      addedPoiLayer,

    '<span style="display:inline-block;width:28px;border-top:4px solid #ef4444;vertical-align:middle;margin-right:6px;"></span>30m未満':
  dangerDistanceLayer,

'<span style="display:inline-block;width:28px;border-top:4px solid #06b6d4;vertical-align:middle;margin-right:6px;"></span>30〜40m':
  cautionDistanceLayer,

'<span style="display:inline-block;width:28px;border-top:4px dashed #eab308;vertical-align:middle;margin-right:6px;"></span>調整方向':
  adviceDirectionLayer,
  
    

"🟢 活動範囲":
  activityPolygonLayer
  },
  {
    collapsed: true
  }
).addTo(
  adminReviewMapInstance
);

const markerBounds = [];
polygons.forEach(polygonLatLngs => {
  if (
    !Array.isArray(polygonLatLngs) ||
    polygonLatLngs.length < 3
  ) {
    return;
  }

  L.polygon(
    polygonLatLngs,
    {
      color: "#22c55e",
      weight: 3,
      opacity: 0.9,
      fillColor: "#22c55e",
      fillOpacity: 0.12
    }
  )
    .bindPopup(`
      <strong style="
        color:#16a34a;
      ">
        活動範囲ポリゴン
      </strong><br>
      実際に歩く範囲・活動エリアです。
    `)
    .addTo(
      activityPolygonLayer
    );

  polygonLatLngs.forEach(latLng => {
    markerBounds.push(
      latLng
    );
  });
});
points.forEach(point => {
  const lat =
    Number(point.lat);

  const lng =
    Number(point.lng);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return;
  }

  const info =
    getAdminLayerInfo(
      point.layer || ""
    );

  const markerColor =
    info.isAdd
      ? "#a855f7"
      : "#3b82f6";

  const marker =
    L.circleMarker(
      [lat, lng],
      {
        radius:
          info.isAdd ? 7 : 5,

        color:
          markerColor,

        fillColor:
          markerColor,

        fillOpacity:
          info.isAdd ? 0.92 : 0.72,

        weight: 2
      }
    );

  marker.bindPopup(`
    <strong>
      ${escapeAdminHtml(
        point.name || "名称なし"
      )}
    </strong><br>

    ${escapeAdminHtml(
      point.layer || "レイヤー不明"
    )}
  `);

  if (info.isAdd) {
    marker.addTo(
      addedPoiLayer
    );
  } else {
    marker.addTo(
      existingPoiLayer
    );
  }

  markerBounds.push(
    [lat, lng]
  );
});

const addDistanceLines = (
  pairs,
  layer,
  color,
  weight = 4
) => {
  pairs.forEach(pair => {
    const aLat =
      Number(pair.a.lat);

    const aLng =
      Number(pair.a.lng);

    const bLat =
      Number(pair.b.lat);

    const bLng =
      Number(pair.b.lng);

    if (
      !Number.isFinite(aLat) ||
      !Number.isFinite(aLng) ||
      !Number.isFinite(bLat) ||
      !Number.isFinite(bLng)
    ) {
      return;
    }

    const line =
  L.polyline(
    [
      [aLat, aLng],
      [bLat, bLng]
    ],
    {
  color,
  weight,
  opacity: 0.9
}
  );

    line.bindPopup(`
      <strong>
        ${pair.distance.toFixed(1)}m
      </strong><br>

      ${escapeAdminHtml(
        pair.a.name || "名称なし"
      )}<br>

      × ${escapeAdminHtml(
        pair.b.name || "名称なし"
      )}
    `);

    line.addTo(layer);
  });
};

addDistanceLines(
  under30Pairs,
  dangerDistanceLayer,
  "#ef4444",
  6
);

addDistanceLines(
  adjustablePairs,
  cautionDistanceLayer,
  "#06b6d4",
  3
);

/*
  単一近接の追加POIだけに、
  参考となる調整方向を黄色い点線で表示する。

  ・対象は30〜40mのみ
  ・相手が既存POIの場合のみ
  ・追加POIが複数のPOIと近接する場合は表示しない
  ・40mぴったりではなく、概算で2mの余裕を持たせる
*/

const getAdminPointKey = point => {
  return [
    point.layer || "",
    point.name || "",
    Number(point.lat).toFixed(7),
    Number(point.lng).toFixed(7)
  ].join("::");
};

const proximityCountByAddedPoi =
  new Map();

[
  ...under30Pairs,
  ...adjustablePairs
].forEach(pair => {
  const aInfo =
    getAdminLayerInfo(
      pair.a.layer || ""
    );

  const bInfo =
    getAdminLayerInfo(
      pair.b.layer || ""
    );

  if (aInfo.isAdd) {
    const key =
      getAdminPointKey(pair.a);

    proximityCountByAddedPoi.set(
      key,
      (
        proximityCountByAddedPoi
          .get(key) || 0
      ) + 1
    );
  }

  if (bInfo.isAdd) {
    const key =
      getAdminPointKey(pair.b);

    proximityCountByAddedPoi.set(
      key,
      (
        proximityCountByAddedPoi
          .get(key) || 0
      ) + 1
    );
  }
});

const calculateAdjustedPoint = (
  fixedPoint,
  movingPoint,
  moveMeters
) => {
  const fixedLat =
    Number(fixedPoint.lat);

  const fixedLng =
    Number(fixedPoint.lng);

  const movingLat =
    Number(movingPoint.lat);

  const movingLng =
    Number(movingPoint.lng);

  if (
    !Number.isFinite(fixedLat) ||
    !Number.isFinite(fixedLng) ||
    !Number.isFinite(movingLat) ||
    !Number.isFinite(movingLng)
  ) {
    return null;
  }

  const meanLat =
    (fixedLat + movingLat) / 2;

  const metersPerLat =
    111320;

  const metersPerLng =
    111320 *
    Math.cos(
      meanLat * Math.PI / 180
    );

  const dx =
    (movingLng - fixedLng) *
    metersPerLng;

  const dy =
    (movingLat - fixedLat) *
    metersPerLat;

  const length =
    Math.hypot(dx, dy);

  if (!length) {
    return null;
  }

  const unitX =
    dx / length;

  const unitY =
    dy / length;

  return {
    lat:
      movingLat +
      (
        unitY *
        moveMeters
      ) /
      metersPerLat,

    lng:
      movingLng +
      (
        unitX *
        moveMeters
      ) /
      metersPerLng
  };
};

adjustablePairs.forEach(pair => {
  const aInfo =
    getAdminLayerInfo(
      pair.a.layer || ""
    );

  const bInfo =
    getAdminLayerInfo(
      pair.b.layer || ""
    );

  let movingPoint = null;
  let fixedPoint = null;

  /*
    追加POIと既存POIの組み合わせだけ対象にする。
    追加POI同士の組み合わせには方向を表示しない。
  */
  if (
    aInfo.isAdd &&
    bInfo.isExisting
  ) {
    movingPoint = pair.a;
    fixedPoint = pair.b;
  } else if (
    bInfo.isAdd &&
    aInfo.isExisting
  ) {
    movingPoint = pair.b;
    fixedPoint = pair.a;
  } else {
    return;
  }

  const movingPointKey =
    getAdminPointKey(
      movingPoint
    );

  /*
    同じ追加POIに複数の近接がある場合は、
    Ryota側で判断してもらう。
  */
  if (
    proximityCountByAddedPoi
      .get(movingPointKey) !== 1
  ) {
    return;
  }

  const remainingMeters =
    Math.max(
      0,
      40 - pair.distance
    );

  /*
    Wayfarer Map由来の概算座標なので、
    40mぴったりではなく2m余裕を持たせる。
  */
  const suggestedMoveMeters =
    Math.ceil(
      (
        remainingMeters + 2
      ) * 10
    ) / 10;

  const adjustedPoint =
    calculateAdjustedPoint(
      fixedPoint,
      movingPoint,
      suggestedMoveMeters
    );

  if (!adjustedPoint) {
    return;
  }

  const advicePopupHtml = `
    <strong style="
      color:#eab308;
    ">
      △ 調整方向
    </strong><br><br>

    ${escapeAdminHtml(
      movingPoint.name ||
      "名称なし"
    )}<br>

    現在距離：
    ${pair.distance.toFixed(1)}m<br>

    40m確保まで：
    約${remainingMeters.toFixed(1)}m<br>

    参考移動量：
    約${suggestedMoveMeters.toFixed(1)}m<br><br>

    <span style="
      font-size:12px;
      color:#64748b;
    ">
      ※Wayfarer Map由来の概算です。<br>
      最終調整はNiantic側の正確な
      POIデータで確認してください。
    </span>
  `;

  L.polyline(
    [
      [
        Number(movingPoint.lat),
        Number(movingPoint.lng)
      ],
      [
        adjustedPoint.lat,
        adjustedPoint.lng
      ]
    ],
    {
      color: "#eab308",
      weight: 4,
      opacity: 0.95,
      dashArray: "4 7"
    }
  )
    .bindPopup(
      advicePopupHtml
    )
    .addTo(
      adviceDirectionLayer
    );

  L.circleMarker(
  [
    adjustedPoint.lat,
    adjustedPoint.lng
  ],
  {
    radius: 4,
    color: "#eab308",
    fillColor: "#facc15",
    fillOpacity: 0.52,
    weight: 2
  }
)
    .bindPopup(
      advicePopupHtml
    )
    .addTo(
      adviceDirectionLayer
    );
});
if (markerBounds.length > 0) {
  adminReviewMapInstance.fitBounds(
  markerBounds,
  {
    padding: [36, 36],
    maxZoom: 17
  }
);
}

  setTimeout(() => {
    adminReviewMapInstance
      .invalidateSize();
  }, 0);
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

const cautionMessages = [];

const duplicateInfo = analyzePoiDuplicates(usablePoints);

if (duplicateInfo.duplicateCoordGroups.length > 0) {
  document.body.classList.add("admin-alert");

setTimeout(() => {
  document.body.classList.remove("admin-alert");
}, 1000);
  if (navigator.vibrate) {
    navigator.vibrate([120, 80, 120]);
  } else {
    console.log("この端末はバイブ通知に対応していません");
  }
  const duplicateDetailsHtml = duplicateInfo.duplicateCoordGroups.map(([coord, items], index) => {
    const poiList = items.map(p => {
      return `・${escapeAdminHtml(p.name || "名称なし")} <span style="opacity:0.7;">(${escapeAdminHtml(p.layer || "不明")})</span>`;
    }).join("<br>");

    return `
      <details style="margin-top:8px;">
        <summary style="cursor:pointer; font-weight:bold;">
          グループ${index + 1}：${escapeAdminHtml(coord)}（${items.length}件）
        </summary>
        <div style="margin-top:6px; line-height:1.7;">
          ${poiList}
        </div>
      </details>
    `;
  }).join("");

  cautionMessages.push({
    html: `
      <div class="admin-danger-pulse" style="
        margin-top:10px;
        padding:10px 12px;
        border-radius:12px;
      ">
        <details>
          <summary style="cursor:pointer; font-weight:bold; color:#fecaca;">
            🚨 座標完全一致 ${duplicateInfo.duplicateCoordGroups.length}グループ
          </summary>
          <div style="margin-top:8px;">
            ${duplicateDetailsHtml}
          </div>
        </details>
      </div>
    `
  });
}
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
        ${cautionMessages.map(m => {
  if (typeof m === "object" && m.html) {
    return m.html;
  }

  return "・" + escapeAdminHtml(m);
}).join("<br>")}
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
      message: "既存POIと追加希望POIを含めて、かなり集中しています。集合・滞留の発生に注意してください。"
    };
  }

  if (count >= 6) {
    return {
      label: "中密度",
      icon: "🟠",
      color: "#f97316",
      message: "既存POIと追加希望POIを含めて、まとまりがあります。遊びやすい一方で、人の流れに注意が必要です。"
    };
  }

  if (count >= 3) {
    return {
      label: "低密度",
      icon: "🟢",
      color: "#22c55e",
      message: "軽いまとまりがあります。回遊ポイント候補として確認できます。"
    };
  }

  return {
    label: "通常",
    icon: "⚪",
    color: "#94a3b8",
    message: "大きな密集はありません。"
  };
}

async function runAdminDensityCheck() {
  const input = document.getElementById("adminDensityFile");
  const result = document.getElementById("adminDensityResult");
  const radius = Number(document.getElementById("adminDensityRadius")?.value || 100);

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
        return getDistanceMeters(area.center, item.center) <= radius;
      });

      if (!tooClose) {
        pickedAreas.push(item);
      }
    });

    const topAreas = pickedAreas.slice(0, 10);

window._densityAreas = topAreas;

if (topAreas.length === 0) {
      result.innerHTML = `
        <div class="distance-warning" style="
          background:rgba(34,197,94,0.12);
          border:1px solid rgba(34,197,94,0.35);
          color:#bbf7d0;
        ">
          ✅ 目立つ密集エリアは見つかりませんでした。<br><br>
          判定対象POI：${usablePoints.length}件<br>
          判定半径：${radius}m
        </div>
      `;
      return;
    }

    const areaHtml = topAreas.map((area, index) => {
  const rank = getDensityRank(area.count);

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
          border-left:6px solid ${rank.color};
        ">
          <strong style="color:${rank.color}; font-size:16px;">
            ${rank.icon} エリア${index + 1}：${rank.label}
          </strong><br>

          中心候補：${escapeAdminHtml(area.center.name)}<br>
半径${radius}m以内：${area.count}件<br>
中心レイヤー：${escapeAdminHtml(area.center.layer)}<br>
内訳：既存 ${layerTypeCounts.existing}件 / 追加希望 ${layerTypeCounts.add}件 / その他 ${layerTypeCounts.other}件<br><br>
          <span style="color:#cbd5e1;">${rank.message}</span>

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
async function generateDensityAreaKMZ() {
  const densityAreas = window._densityAreas || [];

  if (!densityAreas.length) {
    alert("先に密集エリアチェックを実行してください");
    return;
  }

  const radius =
    Number(document.getElementById("adminDensityRadius")?.value || 100);

  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>密集エリアチェック</name>

<Style id="densityCircle">
  <LineStyle>
    <color>ff0000ff</color>
    <width>4</width>
  </LineStyle>
  <PolyStyle>
    <color>330000ff</color>
    <fill>1</fill>
    <outline>1</outline>
  </PolyStyle>
</Style>
`;

  densityAreas.forEach((area, index) => {
    const center = area.center || area;

    const lat = Number(center.lat);
    const lng = Number(center.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.warn("密集エリアの座標が取得できません", area);
      return;
    }

    const count = area.count || area.nearby?.length || 0;

    let existing = 0;
    let add = 0;

    (area.nearby || []).forEach(p => {
      const info = getAdminLayerInfo(p.layer || "");

      if (info.isAdd) {
        add++;
      } else if (info.isExisting) {
        existing++;
      }
    });

    const rank = getDensityRank(count);

    const circleCoords = createAdminCircleCoordinates(lat, lng, radius);

    kml += `
<Placemark>
  <name>密集エリア${index + 1}：${rank.label}</name>
  <description><![CDATA[
中心候補：${center.name || "不明"}<br>
判定半径：${radius}m<br>
半径内POI：${count}件<br>
既存POI：${existing}件<br>
追加希望POI：${add}件<br><br>
${rank.message}
  ]]></description>
  <styleUrl>#densityCircle</styleUrl>
  <Polygon>
    <outerBoundaryIs>
      <LinearRing>
        <coordinates>${circleCoords}</coordinates>
      </LinearRing>
    </outerBoundaryIs>
  </Polygon>
</Placemark>
`;
  });

  kml += `
</Document>
</kml>`;

  if (!isJSZipAvailable("密集エリアKMZ生成")) {
    return;
  }

  const zip = new JSZip();
  zip.file("doc.kml", kml);

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.google-earth.kmz"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "density-area-check.kmz";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
function createAdminCircleCoordinates(lat, lng, radius) {

  const coords = [];

  const earthRadius = 6378137;

  for (let i = 0; i <= 360; i += 8) {

    const angle = i * Math.PI / 180;

    const dx = radius * Math.cos(angle);
    const dy = radius * Math.sin(angle);

    const newLat =
      lat + (dy / earthRadius) * (180 / Math.PI);

    const newLng =
      lng +
      (dx / earthRadius) *
      (180 / Math.PI) /
      Math.cos(lat * Math.PI / 180);

    coords.push(`${newLng},${newLat},0`);
  }

  return coords.join(" ");
}