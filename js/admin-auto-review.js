/* ======================================================
   Phase 5: Scoped automatic admin review
   - Runs only when an admin review scope is saved
   - Uses the shared Campsite policy (spacing + POI limits)
   - Distance warnings only for pairs involving an added POI
   - Duplicate candidates use the existing <1m rule
   - Never decides the final review status automatically
====================================================== */
(function () {
  "use strict";

  if (window.AdminAutoReview) return;

  const state = {
    map: null,
    warningLayer: null,
    observer: null,
    queued: false,
    lastResult: null
  };

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return String(value || "").normalize("NFKC").trim().toLowerCase();
  }

  function haversine(a, b) {
    const R = 6371000;
    const lat1 = Number(a.lat) * Math.PI / 180;
    const lat2 = Number(b.lat) * Math.PI / 180;
    const dLat = (Number(b.lat) - Number(a.lat)) * Math.PI / 180;
    const dLng = (Number(b.lng) - Number(a.lng)) * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function parseMarker(marker) {
    if (!marker || typeof marker.getLatLng !== "function") return null;
    const ll = marker.getLatLng();
    if (!Number.isFinite(ll?.lat) || !Number.isFinite(ll?.lng)) return null;

    let html = "";
    try {
      html = String(marker.getPopup?.()?.getContent?.() || "");
    } catch (_) {}

    let name = "名称なし";
    let detail = "";
    if (html) {
      try {
        const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
        name = String(doc.querySelector("strong")?.textContent || "名称なし").trim();
        detail = String(doc.body?.textContent || "").replace(name, "").trim();
      } catch (_) {}
    }

    const text = normalize(`${detail} ${html}`);
    const added = /追加予定/.test(detail) || /追加予定/.test(html);
    let poiType = "unknown";
    if (/gym|ジム/.test(text)) poiType = "gym";
    else if (/power|パワースポット|パワスポ/.test(text)) poiType = "powerSpot";
    else if (/pok[eé]?stop|poke\s*stop|ポケスト/.test(text)) poiType = "pokestop";

    return {
      marker,
      name,
      lat: ll.lat,
      lng: ll.lng,
      added,
      poiType
    };
  }

  function allPoiMarkers() {
    if (!state.map || !window.L) return [];
    const rows = [];
    state.map.eachLayer(layer => {
      if (!(layer instanceof L.CircleMarker)) return;
      const parsed = parseMarker(layer);
      if (parsed) rows.push(parsed);
    });
    return rows;
  }

  function currentPolicy() {
    const snapshot = window.CampsitePolicy?.getSnapshot?.() || {};
    return {
      versionNo: Number(snapshot.versionNo) || 0,
      spacingMeters: Number(snapshot.spacingMeters) || 50,
      limits: {
        total: snapshot?.limits?.total ?? 25,
        pokestop: snapshot?.limits?.pokestop ?? 12,
        gym: snapshot?.limits?.gym ?? 8,
        powerSpot: snapshot?.limits?.powerSpot ?? 5
      },
      fallback: window.CampsitePolicy?.isUsingFallback?.() === true
    };
  }

  function scopeReady() {
    const scope = window.AdminReviewScope?.getScope?.();
    return Boolean(scope && Array.isArray(scope.vertices) && scope.vertices.length >= 3);
  }

  function inSavedScope(point) {
    if (!scopeReady()) return false;
    return window.AdminReviewScope?.containsPoint?.(point) === true;
  }

  function limitExceeded(count, limit) {
    return limit !== null && Number.isFinite(Number(limit)) && count > Number(limit);
  }

  function limitText(limit) {
    return limit === null ? "無制限" : String(limit);
  }

  function analyze() {
    const policy = currentPolicy();
    const all = allPoiMarkers();
    if (!scopeReady()) {
      return {
        ready: false,
        policy,
        totalVisible: all.length,
        scoped: [],
        added: [],
        spacingPairs: [],
        duplicatePairs: [],
        counts: { totalAdded: 0, pokestop: 0, gym: 0, powerSpot: 0, unknown: 0 },
        limitWarnings: []
      };
    }

    const scoped = all.filter(p => inSavedScope({ lat: p.lat, lng: p.lng }));
    const added = scoped.filter(p => p.added);
    const counts = { totalAdded: added.length, pokestop: 0, gym: 0, powerSpot: 0, unknown: 0 };
    added.forEach(p => {
      if (p.poiType === "pokestop") counts.pokestop++;
      else if (p.poiType === "gym") counts.gym++;
      else if (p.poiType === "powerSpot") counts.powerSpot++;
      else counts.unknown++;
    });

    const spacingPairs = [];
    const duplicatePairs = [];
    for (let i = 0; i < scoped.length; i++) {
      for (let j = i + 1; j < scoped.length; j++) {
        const a = scoped[i];
        const b = scoped[j];
        const distance = haversine(a, b);
        if (distance < 1) {
          duplicatePairs.push({ a, b, distance });
          continue;
        }
        if (!(a.added || b.added)) continue;
        if (distance < policy.spacingMeters) spacingPairs.push({ a, b, distance });
      }
    }

    const limitWarnings = [];
    if (limitExceeded(counts.totalAdded, policy.limits.total)) {
      limitWarnings.push({ key: "total", label: "追加POI合計", count: counts.totalAdded, limit: policy.limits.total });
    }
    if (limitExceeded(counts.pokestop, policy.limits.pokestop)) {
      limitWarnings.push({ key: "pokestop", label: "PokéStop", count: counts.pokestop, limit: policy.limits.pokestop });
    }
    if (limitExceeded(counts.gym, policy.limits.gym)) {
      limitWarnings.push({ key: "gym", label: "Gym", count: counts.gym, limit: policy.limits.gym });
    }
    if (limitExceeded(counts.powerSpot, policy.limits.powerSpot)) {
      limitWarnings.push({ key: "powerSpot", label: "Power Spot", count: counts.powerSpot, limit: policy.limits.powerSpot });
    }

    return { ready: true, policy, totalVisible: all.length, scoped, added, spacingPairs, duplicatePairs, counts, limitWarnings };
  }

  function warningPoints(result) {
    const map = new Map();
    const push = (point, reason) => {
      const key = `${Number(point.lat).toFixed(7)},${Number(point.lng).toFixed(7)}`;
      if (!map.has(key)) map.set(key, { point, reasons: new Set() });
      map.get(key).reasons.add(reason);
    };
    result.spacingPairs.forEach(pair => {
      push(pair.a, `距離 ${pair.distance.toFixed(1)}m`);
      push(pair.b, `距離 ${pair.distance.toFixed(1)}m`);
    });
    result.duplicatePairs.forEach(pair => {
      push(pair.a, `重複候補 ${pair.distance.toFixed(1)}m`);
      push(pair.b, `重複候補 ${pair.distance.toFixed(1)}m`);
    });
    return [...map.values()];
  }

  function ensureWarningLayer() {
    if (!state.map || !window.L) return null;
    if (!state.warningLayer) state.warningLayer = L.layerGroup().addTo(state.map);
    return state.warningLayer;
  }

  function warningIcon() {
    return L.divIcon({
      className: "aar-warning-icon",
      html: `<span>⚠️</span>`,
      iconSize: [24, 24],
      iconAnchor: [4, 22]
    });
  }

  function renderMapWarnings(result) {
    const layer = ensureWarningLayer();
    if (!layer) return;
    layer.clearLayers();
    if (!result.ready) return;
    warningPoints(result).forEach(item => {
      const marker = L.marker([item.point.lat, item.point.lng], {
        icon: warningIcon(),
        interactive: true,
        keyboard: false,
        zIndexOffset: 900
      });
      marker.bindTooltip(`<strong>${esc(item.point.name)}</strong><br>${[...item.reasons].map(esc).join("<br>")}`, { direction: "top", opacity: .95 });
      marker.addTo(layer);
    });
  }

  function ensurePanel() {
    const inspector = document.querySelector("#adminReviewWorkspace #arwInspector");
    if (!inspector) return null;
    let panel = inspector.querySelector("#adminAutoReviewPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "adminAutoReviewPanel";
      panel.className = "arw-panel aar-panel";
      inspector.prepend(panel);
    }
    return panel;
  }

  function pairRows(pairs, emptyText, limit = 5) {
    if (!pairs.length) return `<div class="aar-ok">✅ ${esc(emptyText)}</div>`;
    const rows = pairs.slice(0, limit).map(pair => `
      <div class="aar-pair">
        <strong>${pair.distance.toFixed(1)}m</strong>
        <span>${esc(pair.a.name)} ↔ ${esc(pair.b.name)}</span>
      </div>`).join("");
    const more = pairs.length > limit ? `<div class="aar-more">ほか ${pairs.length - limit}件</div>` : "";
    return rows + more;
  }

  function renderPanel(result) {
    const panel = ensurePanel();
    if (!panel) return;

    if (!result.ready) {
      panel.innerHTML = `
        <div class="aar-head"><div><span>AUTO CHECK</span><h3>自動チェック</h3></div><strong class="aar-wait">待機</strong></div>
        <p class="aar-note">審査範囲を保存すると、その内側だけを自動チェックします。範囲外POIは判定しません。</p>`;
      return;
    }

    const p = result.policy;
    const c = result.counts;
    const issues = result.spacingPairs.length + result.duplicatePairs.length + result.limitWarnings.length;
    const limits = [
      `合計 ${c.totalAdded}/${limitText(p.limits.total)}`,
      `PokéStop ${c.pokestop}/${limitText(p.limits.pokestop)}`,
      `Gym ${c.gym}/${limitText(p.limits.gym)}`,
      `Power ${c.powerSpot}/${limitText(p.limits.powerSpot)}`
    ].join(" · ");

    panel.innerHTML = `
      <div class="aar-head">
        <div><span>AUTO CHECK</span><h3>自動チェック</h3></div>
        <strong class="${issues ? "aar-warn" : "aar-good"}">${issues ? `⚠️ ${issues}` : "✅ 0"}</strong>
      </div>
      <p class="aar-note">審査対象 ${result.scoped.length}件。現在ポリシー v${p.versionNo || "-"} / 距離 ${p.spacingMeters}m${p.fallback ? "（fallback）" : ""}</p>
      <div class="aar-check ${result.spacingPairs.length ? "warn" : "ok"}">
        <div class="aar-check-title"><strong>距離</strong><span>${result.spacingPairs.length ? `⚠️ ${result.spacingPairs.length}組` : "✅ 問題なし"}</span></div>
        ${pairRows(result.spacingPairs, `${p.spacingMeters}m未満の追加POI関連ペアなし`)}
      </div>
      <div class="aar-check ${result.limitWarnings.length ? "warn" : (c.unknown ? "hold" : "ok")}">
        <div class="aar-check-title"><strong>追加POI上限</strong><span>${result.limitWarnings.length ? `⚠️ ${result.limitWarnings.length}項目` : c.unknown ? "○ 一部保留" : "✅ 範囲内"}</span></div>
        <div class="aar-limits">${esc(limits)}</div>
        ${result.limitWarnings.map(item => `<div class="aar-limit-warning">⚠️ ${esc(item.label)} ${item.count} / 上限 ${item.limit}</div>`).join("")}
        ${c.unknown ? `<div class="aar-hold">種類未分類の追加POI ${c.unknown}件。種類別上限はその分だけ保留します。</div>` : ""}
      </div>
      <div class="aar-check ${result.duplicatePairs.length ? "warn" : "ok"}">
        <div class="aar-check-title"><strong>重複候補</strong><span>${result.duplicatePairs.length ? `⚠️ ${result.duplicatePairs.length}組` : "✅ なし"}</span></div>
        ${pairRows(result.duplicatePairs, "1m未満の重複候補なし")}
      </div>
      <p class="aar-foot">⚠️は確認ポイントです。自動判定だけで最終審査結果は確定しません。</p>`;
  }

  function run() {
    if (!document.querySelector("#adminReviewWorkspace.open")) return null;
    const result = analyze();
    state.lastResult = result;
    renderMapWarnings(result);
    renderPanel(result);
    window.dispatchEvent(new CustomEvent("adminautoreviewchange", { detail: { result } }));
    return result;
  }

  function queueRun() {
    if (state.queued) return;
    state.queued = true;
    requestAnimationFrame(() => {
      state.queued = false;
      run();
    });
  }

  function installMapHook() {
    if (!window.L?.Map || L.Map.prototype.__adminAutoReviewHookInstalled) return;
    L.Map.prototype.__adminAutoReviewHookInstalled = true;
    L.Map.addInitHook(function () {
      const container = this.getContainer?.();
      if (container?.id !== "arwMap") return;
      state.map = this;
      this.on("layeradd layerremove", event => {
        const layer = event?.layer;
        if (layer === state.warningLayer) return;
        if (layer instanceof L.CircleMarker) queueRun();
      });
      setTimeout(queueRun, 0);
    });
  }

  function observeInspector() {
    const inspector = document.querySelector("#adminReviewWorkspace #arwInspector");
    if (!inspector || state.observer) return;
    state.observer = new MutationObserver(() => {
      const existing = inspector.querySelector("#adminAutoReviewPanel");
      if (!existing) queueRun();
    });
    state.observer.observe(inspector, { childList: true, subtree: false });
  }

  installMapHook();
  const timer = setInterval(() => {
    installMapHook();
    observeInspector();
    if (state.map && state.observer) clearInterval(timer);
  }, 100);

  window.addEventListener("adminreviewscopechange", queueRun);
  window.addEventListener("campsitepolicychange", queueRun);

  const workspaceObserver = new MutationObserver(() => {
    if (document.querySelector("#adminReviewWorkspace.open")) {
      observeInspector();
      queueRun();
    } else if (state.warningLayer) {
      state.warningLayer.clearLayers();
    }
  });
  workspaceObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

  window.AdminAutoReview = Object.freeze({
    run,
    getResult: () => state.lastResult,
    refresh: queueRun
  });
})();
