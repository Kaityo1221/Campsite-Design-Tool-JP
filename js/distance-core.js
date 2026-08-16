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

/* =========================
   UI大改修 07：提出前チェック
   元の6項目を基準にアップデートする。
========================= */

const PRE_SUBMIT_MANUAL_KEY = "campsitePreSubmitManualV2";

function ensurePreSubmitStyles() {
  if (document.getElementById("preSubmitStyles")) return;

  const style = document.createElement("style");
  style.id = "preSubmitStyles";
  style.textContent = `
    #check .pre-submit-lead{margin:0 0 16px;color:#cbd5e1;font-size:14px;line-height:1.75}
    #check .pre-submit-note{margin:0 0 16px;padding:12px 14px;border:1px solid rgba(56,189,248,.28);border-radius:12px;background:rgba(14,165,233,.07);color:#cbd5e1;font-size:12px;line-height:1.7}
    #check .pre-submit-group{margin:0 0 14px;padding:14px;border:1px solid rgba(148,163,184,.2);border-radius:14px;background:rgba(15,23,42,.55)}
    #check .pre-submit-group h3{margin:0 0 10px;color:#f8fafc;font-size:16px}
    #check .pre-submit-group p{margin:0 0 10px;color:#94a3b8;font-size:12px;line-height:1.6}
    #check .pre-submit-item{display:flex;align-items:flex-start;gap:10px;margin:8px 0;padding:10px 11px;border:1px solid rgba(148,163,184,.16);border-radius:11px;background:rgba(2,6,23,.35)}
    #check .pre-submit-state{flex:0 0 auto;min-width:24px;font-size:16px;line-height:1.45;text-align:center}
    #check .pre-submit-copy{min-width:0;flex:1}
    #check .pre-submit-copy strong{display:block;color:#e5e7eb;font-size:13px;line-height:1.55}
    #check .pre-submit-copy small{display:block;margin-top:2px;color:#94a3b8;font-size:11px;line-height:1.55}
    #check .pre-submit-item[data-state="ok"]{border-color:rgba(34,197,94,.28);background:rgba(34,197,94,.06)}
    #check .pre-submit-item[data-state="warn"]{border-color:rgba(245,158,11,.34);background:rgba(245,158,11,.07)}
    #check .pre-submit-item[data-state="ng"]{border-color:rgba(239,68,68,.35);background:rgba(239,68,68,.07)}
    #check .pre-submit-manual{width:20px;height:20px;margin:1px 0 0;accent-color:#22c55e}
    #check .pre-submit-result{margin-top:16px;padding:16px;border-radius:14px;text-align:center;border:1px solid rgba(245,158,11,.35);background:rgba(245,158,11,.08)}
    #check .pre-submit-result.ready{border-color:rgba(34,197,94,.42);background:rgba(34,197,94,.09)}
    #check .pre-submit-result strong{display:block;font-size:20px;color:#fde68a}
    #check .pre-submit-result.ready strong{color:#86efac}
    #check .pre-submit-result span{display:block;margin-top:5px;color:#cbd5e1;font-size:12px;line-height:1.6}
    #check .pre-submit-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;justify-content:center}
    #check .pre-submit-actions button{padding:9px 12px;border-radius:9px;border:1px solid rgba(56,189,248,.35);background:rgba(14,165,233,.11);color:#bae6fd;font-weight:700;cursor:pointer}
    @media(max-width:520px){#check .pre-submit-group{padding:12px}#check .pre-submit-item{padding:9px 10px}#check .pre-submit-actions button{width:100%}}
  `;

  document.head.appendChild(style);
}

function readPreSubmitManualState() {
  try {
    return JSON.parse(sessionStorage.getItem(PRE_SUBMIT_MANUAL_KEY) || "{}");
  } catch (_) {
    return {};
  }
}

function savePreSubmitManualState(state) {
  try {
    sessionStorage.setItem(PRE_SUBMIT_MANUAL_KEY, JSON.stringify(state));
  } catch (_) {}
}

function getPreSubmitLayerNames() {
  return Object.keys(window._layerPoints || {});
}

function getPreSubmitAddedPoiCount() {
  return getPreSubmitLayerNames().reduce((sum, name) => {
    if (!/(追加|希望)/.test(name)) return sum;
    const points = window._layerPoints?.[name];
    return sum + (Array.isArray(points) ? points.length : 0);
  }, 0);
}

function getPreSubmitLayerState() {
  const names = getPreSubmitLayerNames();

  if (!names.length) {
    return { state: "warn", detail: "完成KMZを読み込むと自動確認します。" };
  }

  const hasExisting = names.some(name => /既存/.test(name));
  const hasAdded = names.some(name => /(追加|希望)/.test(name));
  const hasAmbiguousPoiLayer = names.some(name => {
    const isPoi = /(ポケスト|pokestop|ジム|gym|パワー|power)/i.test(name);
    return isPoi && !/(既存|追加|希望)/.test(name);
  });

  return hasExisting && hasAdded && !hasAmbiguousPoiLayer
    ? { state: "ok", detail: "既存POIと追加POIを別レイヤーとして認識しています。" }
    : { state: "ng", detail: "POIレイヤー名に「既存」または「追加」が入っているか確認してください。" };
}

function getPreSubmitDistanceRunState() {
  const result = document.getElementById("distanceResult");
  const hasResult = Boolean(result && (result.textContent || "").trim());

  return hasResult
    ? { state: "ok", detail: "完成KMZで距離チェックを実施済みです。" }
    : { state: "warn", detail: "完成KMZで距離チェックを実施してください。" };
}

function getPreSubmitDuplicateState() {
  const result = document.getElementById("distanceResult");
  if (!result || !(result.textContent || "").trim()) {
    return { state: "warn", detail: "距離チェック実施後に確認できます。" };
  }

  const duplicates = getPrecheckDuplicatePois();
  return duplicates.length === 0
    ? { state: "ok", detail: "重複POI候補はありません。" }
    : { state: "ng", detail: `重複POI候補が${duplicates.length}件あります。` };
}

function getPreSubmitAutoItems() {
  const hasData = getPreSubmitLayerNames().length > 0;
  const addedCount = getPreSubmitAddedPoiCount();

  return [
    {
      id: "addedLimit",
      label: "追加POIは25個以内に収まっている",
      state: !hasData ? "warn" : (addedCount <= 25 ? "ok" : "ng"),
      detail: !hasData ? "完成KMZを読み込むと自動確認します。" : `追加POI：${addedCount}件 / 最大25件`
    },
    {
      id: "layers",
      label: "既存POIと追加POIのレイヤーを分けている",
      ...getPreSubmitLayerState()
    },
    {
      id: "polygon",
      label: "活動範囲ポリゴンを設定している",
      state: !hasData ? "warn" : (window._hasPolygon ? "ok" : "ng"),
      detail: !hasData
        ? "完成KMZを読み込むと自動確認します。"
        : (window._hasPolygon ? "活動範囲を検出しました。" : "活動範囲ポリゴンが見つかりません。")
    },
    {
      id: "distanceRun",
      label: "完成KMZで距離チェックを実施している",
      ...getPreSubmitDistanceRunState()
    },
    {
      id: "duplicate",
      label: "重複POI候補を確認している",
      ...getPreSubmitDuplicateState()
    }
  ];
}

function getPreSubmitStateIcon(state) {
  if (state === "ok") return "✅";
  if (state === "ng") return "⚠️";
  return "○";
}

function renderPreSubmitItem(item) {
  return `
    <div class="pre-submit-item" data-state="${item.state}">
      <span class="pre-submit-state">${getPreSubmitStateIcon(item.state)}</span>
      <div class="pre-submit-copy">
        <strong>${item.label}</strong>
        <small>${item.detail}</small>
      </div>
    </div>
  `;
}

function renderPreSubmitManualItem(item, manualState) {
  const checked = manualState[item.id] === true;

  return `
    <label class="pre-submit-item" data-state="${checked ? "ok" : "warn"}">
      <input
        class="pre-submit-manual"
        type="checkbox"
        data-pre-submit-manual="${item.id}"
        ${checked ? "checked" : ""}
      >
      <span class="pre-submit-copy">
        <strong>${item.label}</strong>
        <small>${item.detail}</small>
      </span>
    </label>
  `;
}

function renderPreSubmitCheck() {
  const section = document.getElementById("check");
  const panel = section?.querySelector(".panel");

  if (!panel) return;

  ensurePreSubmitStyles();

  const manualState = readPreSubmitManualState();
  const autoItems = getPreSubmitAutoItems();
  const manualItems = [
    {
      id: "spacing40",
      label: "POI間隔は50m以上を基本としている",
      detail: "まず50m以上の間隔を目標に配置します。"
    },
    {
      id: "spacing30to40",
      label: "50m未満の配置は例外として必要性を確認している",
      detail: "40m・30m台は参考値であり、原則は50m以上です。50m未満にする場合は必要性を確認します。"
    },
    {
      id: "playability",
      label: "「置ける」より「遊びやすい」を優先している",
      detail: "POI数だけでなく、歩きやすさ・回遊しやすさ・滞在しやすさまで確認します。"
    },
    {
      id: "siteEnvironment",
      label: "現地の安全性・広場・回遊動線・待機場所など、現地の状況を理解している",
      detail: "現地環境チェックなどを参考に、人の流れや滞留場所を含めて現地の特徴を把握しているか確認します。"
    },
    {
      id: "privateMap",
      label: "設計図を配置前に一般公開していない",
      detail: "設計図は配置されるまで適切に管理します。"
    }
  ];

  const autoOk = autoItems.every(item => item.state === "ok");
  const manualOk = manualItems.every(item => manualState[item.id] === true);
  const ready = autoOk && manualOk;

  panel.innerHTML = `
    <h2>提出前チェック</h2>
    <p class="pre-submit-lead">
      元の申請前チェックリストを基準に、完成KMZで確認できる項目は自動判定し、設計意図や現地確認はCA本人が確認します。
    </p>

    <div class="pre-submit-note">
      <strong>距離の基本：</strong>
      POI間隔は50m以上を原則とします。40m・30m台は参考値で、50m未満の配置は例外として必要性を確認します。
    </div>

    <div class="pre-submit-group">
      <h3>🤖 自動確認</h3>
      <p>完成KMZと距離チェック結果から確認します。</p>
      ${autoItems.map(renderPreSubmitItem).join("")}
    </div>

    <div class="pre-submit-group">
      <h3>👤 CA本人確認</h3>
      <p>設計意図と現地の確認内容をチェックしてください。</p>
      ${manualItems.map(item => renderPreSubmitManualItem(item, manualState)).join("")}
    </div>

    <div class="pre-submit-result ${ready ? "ready" : ""}">
      <strong>${ready ? "🎉 提出準備OK" : "📝 まだ確認があります"}</strong>
      <span>
        ${ready
          ? "提出前の確認項目がすべて揃いました。"
          : "未確認または要確認の項目を確認してください。"}
      </span>
      <div class="pre-submit-actions">
        <button type="button" data-pre-submit-distance>距離チェックへ戻る</button>
      </div>
    </div>
  `;

  panel.querySelectorAll("[data-pre-submit-manual]").forEach(input => {
    input.addEventListener("change", () => {
      const state = readPreSubmitManualState();
      state[input.dataset.preSubmitManual] = input.checked;
      savePreSubmitManualState(state);
      renderPreSubmitCheck();
    });
  });

  panel.querySelector("[data-pre-submit-distance]")?.addEventListener("click", () => {
    const button = document.querySelector('.tab-button[onclick*="distance"]');
    if (typeof window.openTab === "function") {
      window.openTab("distance", button || null);
    }
  });
}

function setupPreSubmitCheck() {
  document.getElementById("distanceFile")?.addEventListener("change", () => {
    try {
      sessionStorage.removeItem(PRE_SUBMIT_MANUAL_KEY);
    } catch (_) {}
  });

  document.addEventListener("click", event => {
    const target = event.target.closest?.(".tab-button, .opening-sign-area");
    if (!target) return;

    setTimeout(() => {
      if (document.getElementById("check")?.classList.contains("active")) {
        renderPreSubmitCheck();
      }
    }, 0);
  });

  renderPreSubmitCheck();
}

document.addEventListener("DOMContentLoaded", setupPreSubmitCheck);
window.renderPreSubmitCheck = renderPreSubmitCheck;