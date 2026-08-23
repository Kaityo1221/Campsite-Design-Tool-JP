/* ======================================================
   管理者専用: 過去の状態を見る
   - 既存の提出KMZ一覧へ、過去データがある時だけボタンを追加
   - 比較結果は保存せず、その場で取得・表示する
====================================================== */
(function () {
  "use strict";

  const LIST_FUNCTION = "admin-kmz-access";
  const PAST_FUNCTION = "admin-past-site-state";
  const CARD_DONE_ATTR = "data-past-state-checked";

  let recordIndex = [];
  let listLoaded = false;
  let listLoading = false;
  let modal = null;
  let map = null;
  let currentLayer = null;
  let previousLayer = null;
  let activeData = null;
  let activeHistoryIndex = 0;
  let viewportInitialized = false;

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return String(value || "").normalize("NFKC").trim().toLowerCase();
  }

  function fmtDateOnly(value) {
    const d = new Date(value || 0);
    if (Number.isNaN(d.getTime())) return "日時不明";
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  }

  function getToken() {
    return window.CampsiteAdminAuth?.getSessionToken?.() || "";
  }

  async function invoke(functionName, body) {
    if (!window.campsiteSupabase?.functions) throw new Error("Supabase client unavailable");
    const { data, error } = await window.campsiteSupabase.functions.invoke(functionName, { body });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "request failed");
    return data;
  }

  async function loadRecordIndex() {
    if (listLoaded || listLoading) return;
    const sessionToken = getToken();
    if (!sessionToken) return;
    listLoading = true;
    try {
      const data = await invoke(LIST_FUNCTION, { action: "list", sessionToken });
      recordIndex = Array.isArray(data.historyRecords) ? data.historyRecords : [];
      listLoaded = true;
    } catch (error) {
      console.warn("過去状態: 一覧取得をスキップしました", error);
    } finally {
      listLoading = false;
    }
  }

  function findRecordForCard(card) {
    const fileName = normalize(card.querySelector(".ak-filename")?.textContent);
    const title = normalize(card.querySelector(".ak-title h4")?.textContent);
    if (!fileName && !title) return null;
    const matches = recordIndex.filter(item => {
      const itemFile = normalize(item.displayFileName || item.originalFileName);
      const itemTitle = normalize(item.parkName);
      if (fileName && itemFile && fileName === itemFile) return true;
      return Boolean(title && itemTitle && title === itemTitle);
    });
    matches.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return matches[0] || null;
  }

  function ensureStyles() {
    if (document.getElementById("adminPastSiteStateStyles")) return;
    const style = document.createElement("style");
    style.id = "adminPastSiteStateStyles";
    style.textContent = `
      .ak-btn.past-state{border-color:rgba(99,102,241,.32);background:rgba(79,70,229,.10);color:#e0e7ff}
      .past-state-modal{display:none;position:fixed;inset:0;z-index:100000;background:rgba(2,6,23,.82);padding:18px;align-items:center;justify-content:center}
      .past-state-modal.open{display:flex}.past-state-card{width:min(920px,96vw);max-height:88vh;overflow:auto;border:1px solid rgba(148,163,184,.22);border-radius:18px;background:#0f172a;color:#e2e8f0;box-shadow:0 24px 80px rgba(0,0,0,.45)}
      .past-state-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 16px 10px}.past-state-head h3{margin:0;font-size:18px;color:#f8fafc}.past-state-head p{margin:5px 0 0;color:#94a3b8;font-size:11px}
      .past-state-close{width:42px;height:42px;border:1px solid rgba(148,163,184,.22);border-radius:11px;background:rgba(30,41,59,.9);color:#f8fafc;font-size:22px}
      .past-state-tabs{display:flex;gap:6px;padding:0 16px 8px}.past-state-tab{flex:1;min-height:42px;border:1px solid rgba(148,163,184,.18);border-radius:11px;background:rgba(30,41,59,.62);color:#94a3b8;font-weight:900}.past-state-tab.active{background:rgba(79,70,229,.18);border-color:rgba(129,140,248,.4);color:#eef2ff}
      .past-state-history{display:none;padding:0 16px 9px}.past-state-history.visible{display:block}.past-state-history-toggle{width:100%;min-height:36px;border:1px solid rgba(129,140,248,.22);border-radius:10px;background:rgba(79,70,229,.08);color:#c7d2fe;font-size:10px;font-weight:900}.past-state-history-panel{display:none;margin-top:6px}.past-state-history-panel.open{display:block}.past-state-history-select{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:#111827;color:#e5e7eb;font-weight:800}
      .past-state-legend{display:flex;flex-wrap:wrap;gap:7px;padding:0 16px 10px;color:#cbd5e1;font-size:10px;font-weight:800}.past-state-legend span{display:inline-flex;align-items:center;gap:5px;padding:5px 7px;border:1px solid rgba(148,163,184,.14);border-radius:999px;background:rgba(15,23,42,.58)}
      .past-state-dot{width:9px;height:9px;border-radius:50%;display:inline-block}.past-state-dot.new{background:#22c55e}.past-state-dot.same{background:#38bdf8}.past-state-dot.missing{background:#94a3b8;opacity:.45}
      #pastSiteStateMap{height:52vh;min-height:360px;margin:0 16px 16px;border-radius:14px;overflow:hidden;background:#020617}.past-state-note{padding:0 16px 14px;color:#94a3b8;font-size:10px;line-height:1.6}.past-state-popup-label{display:inline-block;margin-top:4px;font-size:11px;font-weight:900}
      @media(max-width:680px){.past-state-modal{padding:8px}.past-state-card{width:100%;max-height:94vh}.past-state-head{padding:13px 13px 9px}.past-state-tabs{padding:0 13px 7px}.past-state-history{padding:0 13px 8px}.past-state-legend{padding:0 13px 9px;gap:5px}.past-state-legend span{padding:4px 6px;font-size:9px}#pastSiteStateMap{height:55vh;min-height:320px;margin:0 10px 12px}.past-state-note{padding:0 13px 12px}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "past-state-modal";
    modal.innerHTML = `
      <div class="past-state-card" role="dialog" aria-modal="true" aria-labelledby="pastSiteStateTitle">
        <div class="past-state-head"><div><h3 id="pastSiteStateTitle">🕘 過去の状態を見る</h3><p id="pastSiteStateSubtitle"></p></div><button type="button" class="past-state-close" aria-label="閉じる">×</button></div>
        <div class="past-state-tabs"><button type="button" class="past-state-tab" data-state-view="previous">前回</button><button type="button" class="past-state-tab active" data-state-view="current">今回</button></div>
        <div class="past-state-history" id="pastSiteStateHistory"><button type="button" class="past-state-history-toggle">さらに前を見る</button><div class="past-state-history-panel"><select class="past-state-history-select" aria-label="比較する過去データ"></select></div></div>
        <div class="past-state-legend" aria-label="POI差分の見方"><span><i class="past-state-dot new"></i>今回追加</span><span><i class="past-state-dot same"></i>継続</span><span><i class="past-state-dot missing"></i>今回は未確認</span></div>
        <div id="pastSiteStateMap"></div>
        <div class="past-state-note">過去データは確認のための参考表示です。比較内容は保存されません。</div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector(".past-state-close")?.addEventListener("click", closeModal);
    modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
    modal.querySelectorAll("[data-state-view]").forEach(button => button.addEventListener("click", () => renderView(button.dataset.stateView, { preserveViewport: true })));
    modal.querySelector(".past-state-history-toggle")?.addEventListener("click", () => modal.querySelector(".past-state-history-panel")?.classList.toggle("open"));
    modal.querySelector(".past-state-history-select")?.addEventListener("change", event => {
      activeHistoryIndex = Math.max(0, Number(event.target.value) || 0);
      activeData.previous = activeData.history?.[activeHistoryIndex] || activeData.previous;
      updatePreviousTabLabel();
      renderView("previous", { preserveViewport: true });
    });
    return modal;
  }

  function closeModal() { modal?.classList.remove("open"); }

  function setupHistoryUi() {
    const history = Array.isArray(activeData?.history) ? activeData.history : [];
    const box = modal?.querySelector("#pastSiteStateHistory");
    const select = modal?.querySelector(".past-state-history-select");
    const panel = modal?.querySelector(".past-state-history-panel");
    if (!box || !select) return;
    box.classList.toggle("visible", history.length > 1);
    panel?.classList.remove("open");
    activeHistoryIndex = 0;
    select.innerHTML = history.map((item, index) => `<option value="${index}">${index === 0 ? "前回" : fmtDateOnly(item.createdAt)}</option>`).join("");
    select.value = "0";
    updatePreviousTabLabel();
  }

  function updatePreviousTabLabel() {
    const btn = modal?.querySelector('[data-state-view="previous"]');
    if (!btn) return;
    btn.textContent = activeHistoryIndex === 0 ? "前回" : fmtDateOnly(activeData?.previous?.createdAt);
  }

  function poiKey(poi) {
    if (poi.masterPoiId) return `id:${poi.masterPoiId}`;
    return `${normalize(poi.normalizedName || poi.name)}:${Number(poi.lat).toFixed(5)}:${Number(poi.lng).toFixed(5)}`;
  }

  function markerStyle(kind) {
    if (kind === "new") return { radius: 8, weight: 3, color: "#16a34a", fillColor: "#22c55e", fillOpacity: .88, opacity: 1 };
    if (kind === "missing") return { radius: 7, weight: 1, color: "#94a3b8", fillColor: "#94a3b8", fillOpacity: .18, opacity: .38 };
    return { radius: 7, weight: 2, color: "#0284c7", fillColor: "#38bdf8", fillOpacity: .72, opacity: .95 };
  }

  function diffLabel(kind) { return kind === "new" ? "今回追加" : kind === "missing" ? "今回は未確認" : "継続"; }
  function popupHtml(poi, kind) { return `<strong>${esc(poi.name)}</strong><br><span class="past-state-popup-label">${diffLabel(kind)}</span>`; }

  function renderView(view, options = {}) {
    if (!activeData || !window.L) return;
    ensureModal();
    modal.querySelectorAll("[data-state-view]").forEach(btn => btn.classList.toggle("active", btn.dataset.stateView === view));
    const preserveViewport = options.preserveViewport === true && map && viewportInitialized;
    const savedCenter = preserveViewport ? map.getCenter() : null;
    const savedZoom = preserveViewport ? map.getZoom() : null;

    if (!map) {
      map = L.map("pastSiteStateMap", { zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
    }

    currentLayer?.remove(); previousLayer?.remove();
    currentLayer = L.layerGroup(); previousLayer = L.layerGroup();
    const current = activeData.current?.pois || [];
    const previous = activeData.previous?.pois || [];
    const currentKeys = new Set(current.map(poiKey));
    const previousKeys = new Set(previous.map(poiKey));
    const bounds = [];

    current.forEach(poi => {
      const kind = previousKeys.has(poiKey(poi)) ? "same" : "new";
      currentLayer.addLayer(L.circleMarker([poi.lat, poi.lng], markerStyle(kind)).bindPopup(popupHtml(poi, kind)));
      bounds.push([poi.lat, poi.lng]);
    });
    previous.forEach(poi => {
      const kind = currentKeys.has(poiKey(poi)) ? "same" : "missing";
      previousLayer.addLayer(L.circleMarker([poi.lat, poi.lng], markerStyle(kind)).bindPopup(popupHtml(poi, kind)));
      bounds.push([poi.lat, poi.lng]);
    });

    if (view === "previous") previousLayer.addTo(map); else currentLayer.addTo(map);
    if (preserveViewport && savedCenter && Number.isFinite(savedZoom)) map.setView(savedCenter, savedZoom, { animate: false });
    else if (bounds.length) { map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 }); viewportInitialized = true; }
    setTimeout(() => { map.invalidateSize(); if (preserveViewport && savedCenter && Number.isFinite(savedZoom)) map.setView(savedCenter, savedZoom, { animate: false }); }, 80);
  }

  async function openPast(recordId) {
    const sessionToken = getToken();
    if (!sessionToken) return;
    try {
      const data = await invoke(PAST_FUNCTION, { sessionToken, recordId });
      if (!data.hasPast) return;
      activeData = data;
      activeData.history = Array.isArray(data.history) && data.history.length ? data.history : [data.previous];
      activeData.previous = activeData.history[0] || data.previous;
      viewportInitialized = false;
      ensureModal();
      const subtitle = modal.querySelector("#pastSiteStateSubtitle");
      if (subtitle) subtitle.textContent = data.current?.parkName || data.previous?.parkName || "";
      setupHistoryUi();
      modal.classList.add("open");
      renderView("current", { preserveViewport: false });
    } catch (error) { console.warn("過去状態表示エラー", error); }
  }

  async function enhanceCard(card) {
    if (!card || card.hasAttribute(CARD_DONE_ATTR)) return;
    card.setAttribute(CARD_DONE_ATTR, "checking");
    await loadRecordIndex();
    const record = findRecordForCard(card);
    if (!record?.id) { card.setAttribute(CARD_DONE_ATTR, "none"); return; }
    try {
      const data = await invoke(PAST_FUNCTION, { sessionToken: getToken(), recordId: record.id });
      if (!data.hasPast) { card.setAttribute(CARD_DONE_ATTR, "none"); return; }
      const actions = card.querySelector(":scope > .ak-actions");
      if (!actions || actions.querySelector("[data-past-state-button]")) return;
      const button = document.createElement("button");
      button.type = "button"; button.className = "ak-btn past-state"; button.dataset.pastStateButton = "true"; button.textContent = "🕘 過去を見る";
      button.addEventListener("click", () => openPast(record.id));
      actions.appendChild(button); card.setAttribute(CARD_DONE_ATTR, "ready");
    } catch (error) { card.setAttribute(CARD_DONE_ATTR, "error"); console.warn("過去状態照合をスキップしました", error); }
  }

  function scanCards() {
    if (!window.CampsiteAdminAuth?.isUnlocked?.()) return;
    document.querySelectorAll("#adminKmzBrowserV2 .ak-card").forEach(card => enhanceCard(card));
  }

  function setup() {
    ensureStyles(); ensureModal();
    const root = document.getElementById("admin") || document.body;
    const observer = new MutationObserver(() => scanCards());
    observer.observe(root, { childList: true, subtree: true });
    scanCards();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup, { once: true }); else setup();
})();