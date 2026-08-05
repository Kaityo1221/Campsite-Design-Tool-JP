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
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[＿_－ー\-]/g, "");
}

function isAddedLayerName(layerName) {
  const name = normalizeLayerNameText(layerName);

  const keywords = [
    "追加",
    "追加希望",
    "新規",
    "希望",
    "候補",
    "proposed",
    "candidate",
    "new",
    "add",
    "capokestop",
    "capokestops",
    "cagym",
    "cagyms",
    "capowerspot",
    "capowerspots"
  ];

  return keywords.some(keyword =>
    name.includes(normalizeLayerNameText(keyword))
  );
}
function isExistingLayerName(layerName) {
  const name = normalizeLayerNameText(layerName);

  const keywords = [
    "既存",
    "既存poi",
    "existing",
    "current"
  ];

  return keywords.some(keyword =>
    name.includes(normalizeLayerNameText(keyword))
  );
}
function getPoiOriginalLayerName(poi) {
  return String(poi?.originalLayer || poi?.layer || "");
}

function isExistingPoi(poi) {
  return isExistingLayerName(getPoiOriginalLayerName(poi));
}

function isExistingPoiPair(warning) {
  return isExistingPoi(warning?.a) && isExistingPoi(warning?.b);
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
  isAddedLayerName(layerName);

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

    const isExisting = isExistingLayerName(layerName);

    const isAdded =
  isAddedLayerName(layerName);

    if (isExisting) {
      counts.existing += points.length;
    } else if (isAdded) {
      counts.added += points.length;
    }
  });

  return counts;
}
function countPoiBreakdownByRoleAndType(pointsByLayer) {
  const result = {
    existing: {
      pokestop: 0,
      gym: 0,
      power: 0,
      unknown: 0,
      total: 0
    },
    added: {
      pokestop: 0,
      gym: 0,
      power: 0,
      unknown: 0,
      total: 0
    },
    total: {
      pokestop: 0,
      gym: 0,
      power: 0,
      unknown: 0,
      total: 0
    }
  };

  Object.entries(pointsByLayer || {}).forEach(([layerName, points]) => {
    if (!Array.isArray(points)) return;

    if (isAuxiliaryLayer(layerName)) {
      return;
    }

    let role = null;

    if (isExistingLayerName(layerName)) {
      role = "existing";
    } else if (isAddedLayerName(layerName)) {
      role = "added";
    }

    if (!role) return;

    const type =
      getPoiTypeFromLayerName(layerName) || "unknown";

    const count = points.length;

    result[role][type] += count;
    result[role].total += count;

    result.total[type] += count;
    result.total.total += count;
  });

  return result;
}

function renderPoiBreakdownHtml(breakdown) {
  const rows = [
    {
      label: "ポケストップ",
      icon: "🔵",
      key: "pokestop"
    },
    {
      label: "ジム",
      icon: "🟡",
      key: "gym"
    },
    {
      label: "パワースポット",
      icon: "🟣",
      key: "power"
    },
    {
      label: "未分類",
      icon: "⚪",
      key: "unknown"
    }
  ].filter(row => breakdown.total[row.key] > 0);

  return `
    <div class="poi-count-box">
      <h3>POI内訳サマリー</h3>

      <div style="
        display:grid;
        grid-template-columns:1.7fr 0.7fr 0.7fr 0.7fr;
        gap:6px;
        align-items:center;
        font-size:13px;
        color:#e5e7eb;
      ">
        <div style="opacity:0.75;">種別</div>
        <div style="text-align:right; opacity:0.75;">既存</div>
        <div style="text-align:right; opacity:0.75;">追加</div>
        <div style="text-align:right; opacity:0.75;">合計</div>

        ${rows.map(row => `
          <div style="
  padding:8px 0;
  border-top:1px solid rgba(148,163,184,0.18);
  font-weight:700;
  line-height:1.25;
">
  <div style="font-size:22px; line-height:1;">
    ${row.icon}
  </div>
  <div style="
    margin-top:4px;
    font-size:13px;
    white-space:nowrap;
    letter-spacing:-0.04em;
  ">
    ${row.label}
  </div>
</div>

          <div style="
            padding:8px 0;
            border-top:1px solid rgba(148,163,184,0.18);
            text-align:right;
          ">
            ${breakdown.existing[row.key]}
          </div>

          <div style="
            padding:8px 0;
            border-top:1px solid rgba(148,163,184,0.18);
            text-align:right;
            font-weight:800;
            color:#bfdbfe;
          ">
            ${breakdown.added[row.key]}
          </div>

          <div style="
            padding:8px 0;
            border-top:1px solid rgba(148,163,184,0.18);
            text-align:right;
            font-weight:800;
          ">
            ${breakdown.total[row.key]}
          </div>
        `).join("")}

        <div style="
          padding-top:10px;
          border-top:2px solid rgba(56,189,248,0.45);
          font-weight:900;
        ">
          合計
        </div>

        <div style="
          padding-top:10px;
          border-top:2px solid rgba(56,189,248,0.45);
          text-align:right;
          font-weight:900;
        ">
          ${breakdown.existing.total}
        </div>

        <div style="
          padding-top:10px;
          border-top:2px solid rgba(56,189,248,0.45);
          text-align:right;
          font-weight:900;
          color:#bfdbfe;
        ">
          ${breakdown.added.total}
        </div>

        <div style="
          padding-top:10px;
          border-top:2px solid rgba(56,189,248,0.45);
          text-align:right;
          font-weight:900;
        ">
          ${breakdown.total.total}
        </div>
      </div>
    </div>
  `;
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
function renderDistancePrecheckCompactHtml(counts) {
  const info = getTargetLayerDebugInfo();
  const duplicates = getPrecheckDuplicatePois();

  const poiVolumeCounts =
    countExistingAndAddedPoi(window._layerPoints);

  const addedTotal =
    poiVolumeCounts.added;

  const hasDuplicate =
    duplicates.length > 0;

  const hasPolygon =
    window._hasPolygon === true;

  const poiLimitExceeded =
    addedTotal > 25 ||
    counts.pokestop > POI_LIMITS.pokestop ||
    counts.gym > POI_LIMITS.gym ||
    counts.power > POI_LIMITS.power;

  const hasWarning =
    hasDuplicate ||
    !hasPolygon ||
    poiLimitExceeded;

  const statusIcon =
    hasWarning ? "⚠" : "✅";

  const statusText =
    hasWarning
      ? "事前チェック注意"
      : "事前チェック完了";

  const duplicateText =
    hasDuplicate
      ? `あり（${duplicates.length}件）`
      : "なし";

  const polygonText =
    hasPolygon
      ? `あり（${window._activityPolygons?.length || 0}件）`
      : "なし";

  const addedPoiText =
    poiLimitExceeded
      ? `${addedTotal}件 ⚠`
      : `${addedTotal}件`;

  return `
    <div class="distance-precheck-compact ${hasWarning ? "is-warning" : "is-ok"}">
      <div class="distance-precheck-head">
        <strong>${statusIcon} ${statusText}</strong>
        <span>STEP 1</span>
      </div>

      <div class="distance-precheck-grid">
        <div>
          <small>判定対象POI</small>
          <strong>${info.targetPointCount}件</strong>
        </div>

        <div class="${poiLimitExceeded ? "is-warning" : "is-ok"}">
          <small>追加POI</small>
          <strong>${addedPoiText}</strong>
        </div>

        <div class="${hasPolygon ? "is-ok" : "is-warning"}">
          <small>活動範囲</small>
          <strong>${polygonText}</strong>
        </div>

        <div class="${hasDuplicate ? "is-warning" : "is-ok"}">
          <small>重複POI</small>
          <strong>${duplicateText}</strong>
        </div>
      </div>

      ${
        poiLimitExceeded
          ? `
            <div class="distance-precheck-alert">
              ⚠ 追加POIが上限を超えています。<br>
              追加POIは最大25件です。内訳を調整してください。
            </div>
          `
          : ""
      }

      <details class="distance-precheck-details">
        <summary>詳細を見る</summary>

        ${renderDistanceUploadSummary()}
${renderPoiBreakdownHtml(countPoiBreakdownByRoleAndType(window._layerPoints))}
${renderPoiCountHtml(counts)}
${getPoiLimitWarningHtml(counts, addedTotal)}
        ${
          hasDuplicate
            ? renderPrecheckDuplicatePoiHtml()
            : `
              <div class="distance-warning" style="
                border:1px solid rgba(34,197,94,0.45);
                background:rgba(34,197,94,0.12);
              ">
                ✅ 重複POIはありません。
              </div>
            `
        }
      </details>

      <div class="distance-precheck-next">
        <button
          type="button"
          onclick="scrollToDistanceCheckStep()"
        >
          ↓ STEP 2：距離チェックへ進む
        </button>
      </div>
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
function getPoiLimitWarningHtml(counts, addedTotalOverride = null) {
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

  const countedTotal =
    counts.pokestop +
    counts.gym +
    counts.power;

  const total =
    Number.isFinite(Number(addedTotalOverride))
      ? Number(addedTotalOverride)
      : countedTotal;

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
