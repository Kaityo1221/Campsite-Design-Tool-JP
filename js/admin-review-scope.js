/* ======================================================
   Phase 4: Admin-only review scope
   - Saved per site_id, never written back to CA/KMZ data
   - Tap map to add vertices, drag handles to edit
   - Current scope is reused across future submissions for the same site
   - Exposes scope membership for later automated review phases
====================================================== */
(function () {
  "use strict";

  if (window.AdminReviewScope) return;

  const SCOPE_FUNCTION = "admin-review-scope";
  const HISTORY_FUNCTION = "admin-past-site-state";

  const state = {
    map: null,
    ui: null,
    siteId: "",
    recordId: "",
    scope: null,
    vertices: [],
    draft: [],
    editing: false,
    scopeLayer: null,
    draftLayer: null,
    handles: [],
    loadSeq: 0,
    patched: false,
    summaryObserver: null,
    refreshQueued: false
  };

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getToken() {
    return window.CampsiteAdminAuth?.getSessionToken?.() || "";
  }

  async function invoke(functionName, body = {}) {
    if (!window.campsiteSupabase?.functions) throw new Error("Supabase client unavailable");
    const sessionToken = getToken();
    if (!sessionToken) throw new Error("管理者認証が必要です。");
    const { data, error } = await window.campsiteSupabase.functions.invoke(functionName, {
      body: { ...body, sessionToken }
    });
    if (error) {
      let message = error.message || "管理者処理に失敗しました。";
      try {
        const details = error.context && typeof error.context.json === "function"
          ? await error.context.json()
          : null;
        if (details?.error) message = details.error;
      } catch (_) {}
      throw new Error(message);
    }
    if (!data?.success) throw new Error(data?.error || "管理者処理に失敗しました。");
    return data;
  }

  function validVertex(value) {
    const lat = Number(value?.lat);
    const lng = Number(value?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
      ? { lat, lng }
      : null;
  }

  function normalizeVertices(value) {
    if (!Array.isArray(value)) return [];
    return value.map(validVertex).filter(Boolean).slice(0, 200);
  }

  function pointInPolygon(point, vertices = state.vertices) {
    const p = validVertex(point);
    if (!p || !Array.isArray(vertices) || vertices.length < 3) return null;
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].lng;
      const yi = vertices[i].lat;
      const xj = vertices[j].lng;
      const yj = vertices[j].lat;
      const crosses = ((yi > p.lat) !== (yj > p.lat)) &&
        (p.lng < (xj - xi) * (p.lat - yi) / ((yj - yi) || Number.EPSILON) + xi);
      if (crosses) inside = !inside;
    }
    return inside;
  }

  function mapPoiLayers() {
    if (!state.map || !window.L) return [];
    const items = [];
    state.map.eachLayer(layer => {
      if (layer instanceof L.CircleMarker && typeof layer.getLatLng === "function" && typeof layer.setStyle === "function") {
        items.push(layer);
      }
    });
    return items;
  }

  function effectiveVertices() {
    return state.editing ? state.draft : state.vertices;
  }

  function scopeCounts() {
    const markers = mapPoiLayers();
    const vertices = effectiveVertices();
    if (vertices.length < 3) return { total: markers.length, inside: null, outside: null };
    let inside = 0;
    let outside = 0;
    markers.forEach(marker => {
      const ll = marker.getLatLng();
      if (pointInPolygon({ lat: ll.lat, lng: ll.lng }, vertices)) inside++;
      else outside++;
    });
    return { total: markers.length, inside, outside };
  }

  function applyPoiDimming() {
    const vertices = effectiveVertices();
    const scoped = vertices.length >= 3;
    mapPoiLayers().forEach(marker => {
      const ll = marker.getLatLng();
      const inside = scoped ? pointInPolygon({ lat: ll.lat, lng: ll.lng }, vertices) : true;
      marker.setStyle({
        fillOpacity: inside ? .95 : .16,
        opacity: inside ? .95 : .34
      });
    });
  }

  function removeLayer(layer) {
    if (!layer || !state.map) return;
    try { state.map.removeLayer(layer); } catch (_) {}
  }

  function clearHandles() {
    state.handles.forEach(removeLayer);
    state.handles = [];
  }

  function drawSavedScope() {
    removeLayer(state.scopeLayer);
    state.scopeLayer = null;
    if (!state.map || state.editing || state.vertices.length < 3) return;
    state.scopeLayer = L.polygon(state.vertices.map(v => [v.lat, v.lng]), {
      color: "#f8fafc",
      weight: 3,
      dashArray: "10 7",
      opacity: .95,
      fillColor: "#0f172a",
      fillOpacity: .055,
      interactive: false
    }).addTo(state.map);
  }

  function vertexIcon(index) {
    return L.divIcon({
      className: "ars-vertex-icon",
      html: `<span>${index + 1}</span>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  }

  function drawDraft() {
    removeLayer(state.draftLayer);
    state.draftLayer = null;
    clearHandles();
    if (!state.map || !state.editing) return;

    const latlngs = state.draft.map(v => [v.lat, v.lng]);
    if (latlngs.length >= 3) {
      state.draftLayer = L.polygon(latlngs, {
        color: "#f8fafc",
        weight: 3,
        dashArray: "5 6",
        opacity: 1,
        fillColor: "#0f172a",
        fillOpacity: .1,
        interactive: false
      }).addTo(state.map);
    } else if (latlngs.length >= 2) {
      state.draftLayer = L.polyline(latlngs, {
        color: "#f8fafc",
        weight: 3,
        dashArray: "5 6",
        opacity: 1,
        interactive: false
      }).addTo(state.map);
    }

    state.draft.forEach((vertex, index) => {
      const marker = L.marker([vertex.lat, vertex.lng], {
        draggable: true,
        icon: vertexIcon(index),
        keyboard: false,
        riseOnHover: true
      }).addTo(state.map);
      marker.on("drag", event => {
        const ll = event.target.getLatLng();
        state.draft[index] = { lat: ll.lat, lng: ll.lng };
        redrawDraftShapeOnly();
        refreshVisuals();
      });
      state.handles.push(marker);
    });
    refreshVisuals();
  }

  function redrawDraftShapeOnly() {
    removeLayer(state.draftLayer);
    state.draftLayer = null;
    if (!state.map || !state.editing) return;
    const latlngs = state.draft.map(v => [v.lat, v.lng]);
    if (latlngs.length >= 3) {
      state.draftLayer = L.polygon(latlngs, {
        color: "#f8fafc", weight: 3, dashArray: "5 6", opacity: 1,
        fillColor: "#0f172a", fillOpacity: .1, interactive: false
      }).addTo(state.map);
    } else if (latlngs.length >= 2) {
      state.draftLayer = L.polyline(latlngs, {
        color: "#f8fafc", weight: 3, dashArray: "5 6", opacity: 1, interactive: false
      }).addTo(state.map);
    }
  }

  function ensureUi() {
    const wrap = document.querySelector("#adminReviewWorkspace .arw-map-wrap");
    if (!wrap) return null;
    let ui = wrap.querySelector("#adminReviewScopeControl");
    if (ui) {
      state.ui = ui;
      return ui;
    }
    ui = document.createElement("div");
    ui.id = "adminReviewScopeControl";
    ui.className = "ars-control";
    ui.innerHTML = `<div class="ars-head"><strong>審査範囲</strong><span data-ars-status>読込待ち</span></div><div class="ars-counts" data-ars-counts></div><div class="ars-help" data-ars-help>管理者だけに保存される内部範囲です。</div><div class="ars-actions" data-ars-actions></div>`;
    wrap.appendChild(ui);
    state.ui = ui;
    renderUi();
    return ui;
  }

  function renderUi(message = "") {
    const ui = ensureUi();
    if (!ui) return;
    const status = ui.querySelector("[data-ars-status]");
    const counts = ui.querySelector("[data-ars-counts]");
    const help = ui.querySelector("[data-ars-help]");
    const actions = ui.querySelector("[data-ars-actions]");
    const siteAvailable = Boolean(state.siteId);
    const c = scopeCounts();

    if (status) {
      if (!siteAvailable) status.textContent = "site_id未割当";
      else if (state.editing) status.textContent = `編集中 · ${state.draft.length}頂点`;
      else if (state.scope) status.textContent = `保存済み v${state.scope.revision} · ${state.vertices.length}頂点`;
      else status.textContent = "未指定";
    }

    if (counts) {
      counts.innerHTML = c.inside === null
        ? `<span>POI ${c.total}</span><span>範囲未指定</span>`
        : `<span>審査対象 <b>${c.inside}</b></span><span>対象外 <b>${c.outside}</b></span>`;
    }

    if (help) {
      if (message) help.textContent = message;
      else if (!siteAvailable) help.textContent = "この古い履歴はsite_idがないため、範囲保存はできません。";
      else if (state.editing) help.textContent = "地図をタップして頂点追加。番号付きの点はドラッグできます。";
      else help.textContent = "管理者だけに保存され、CAのKMZには書き戻しません。";
    }

    if (!actions) return;
    if (!siteAvailable) {
      actions.innerHTML = `<button type="button" disabled>範囲保存不可</button>`;
      return;
    }
    if (state.editing) {
      actions.innerHTML = `<button type="button" class="primary" data-ars-save ${state.draft.length < 3 ? "disabled" : ""}>保存</button><button type="button" data-ars-undo ${state.draft.length ? "" : "disabled"}>1点戻す</button><button type="button" data-ars-cancel>取消</button>`;
      actions.querySelector("[data-ars-save]")?.addEventListener("click", saveDraft);
      actions.querySelector("[data-ars-undo]")?.addEventListener("click", undoVertex);
      actions.querySelector("[data-ars-cancel]")?.addEventListener("click", cancelEdit);
    } else {
      actions.innerHTML = `<button type="button" class="primary" data-ars-edit>${state.scope ? "範囲を編集" : "範囲を描く"}</button>${state.scope ? `<button type="button" class="danger" data-ars-clear>範囲を解除</button>` : ""}`;
      actions.querySelector("[data-ars-edit]")?.addEventListener("click", startEdit);
      actions.querySelector("[data-ars-clear]")?.addEventListener("click", clearScope);
    }
  }

  function onMapClick(event) {
    if (!state.editing || state.draft.length >= 200) return;
    const target = event?.originalEvent?.target;
    if (target?.classList?.contains?.("leaflet-interactive")) return;
    const ll = event.latlng;
    if (!ll) return;
    state.draft.push({ lat: ll.lat, lng: ll.lng });
    drawDraft();
  }

  function startEdit() {
    if (!state.siteId || !state.map) return;
    state.editing = true;
    state.draft = state.vertices.map(v => ({ ...v }));
    removeLayer(state.scopeLayer);
    state.scopeLayer = null;
    state.map.on("click", onMapClick);
    drawDraft();
    renderUi();
  }

  function undoVertex() {
    if (!state.editing || !state.draft.length) return;
    state.draft.pop();
    drawDraft();
  }

  function stopEditMode() {
    if (state.map) state.map.off("click", onMapClick);
    removeLayer(state.draftLayer);
    state.draftLayer = null;
    clearHandles();
    state.editing = false;
    state.draft = [];
  }

  function cancelEdit() {
    stopEditMode();
    drawSavedScope();
    refreshVisuals();
    renderUi();
  }

  async function saveDraft() {
    if (!state.siteId || state.draft.length < 3) return;
    const vertices = state.draft.map(v => ({ lat: v.lat, lng: v.lng }));
    renderUi("審査範囲を保存しています…");
    try {
      const data = await invoke(SCOPE_FUNCTION, {
        action: "save",
        siteId: state.siteId,
        recordId: state.recordId || null,
        vertices
      });
      stopEditMode();
      state.scope = data.scope || null;
      state.vertices = normalizeVertices(data.scope?.vertices || vertices);
      drawSavedScope();
      refreshVisuals();
      renderUi(`v${state.scope?.revision || "?"} として保存しました。`);
      dispatchChange("save");
    } catch (error) {
      console.error("review scope save error", error);
      renderUi(error?.message || "審査範囲を保存できませんでした。");
    }
  }

  async function clearScope() {
    if (!state.siteId || !state.scope) return;
    if (!window.confirm("このサイトの現在の審査範囲を解除しますか？ 過去revisionは履歴として残ります。")) return;
    renderUi("審査範囲を解除しています…");
    try {
      await invoke(SCOPE_FUNCTION, { action: "clear", siteId: state.siteId });
      state.scope = null;
      state.vertices = [];
      removeLayer(state.scopeLayer);
      state.scopeLayer = null;
      refreshVisuals();
      renderUi("現在の審査範囲を解除しました。");
      dispatchChange("clear");
    } catch (error) {
      console.error("review scope clear error", error);
      renderUi(error?.message || "審査範囲を解除できませんでした。");
    }
  }

  function renderSummaryStat() {
    const host = document.querySelector("#adminReviewWorkspace #arwSummary");
    if (!host) return;
    let stat = host.querySelector("[data-ars-summary]");
    if (!stat) {
      stat = document.createElement("div");
      stat.className = "arw-stat ars-summary-stat";
      stat.setAttribute("data-ars-summary", "1");
      host.appendChild(stat);
    }
    const c = scopeCounts();
    if (!state.siteId) stat.innerHTML = `<span>審査範囲</span><strong>保存不可</strong>`;
    else if (c.inside === null) stat.innerHTML = `<span>審査範囲</span><strong>未指定</strong>`;
    else stat.innerHTML = `<span>審査対象 / 対象外</span><strong>${c.inside} / ${c.outside}</strong>`;
  }

  function refreshVisuals() {
    applyPoiDimming();
    renderSummaryStat();
    renderUi();
  }

  function queueRefresh() {
    if (state.refreshQueued) return;
    state.refreshQueued = true;
    requestAnimationFrame(() => {
      state.refreshQueued = false;
      refreshVisuals();
    });
  }

  function observeWorkspace() {
    ensureUi();
    const summary = document.querySelector("#adminReviewWorkspace #arwSummary");
    if (!summary || state.summaryObserver) return;
    state.summaryObserver = new MutationObserver(() => queueRefresh());
    state.summaryObserver.observe(summary, { childList: true, subtree: true });
  }

  function resetSiteState(recordId = "") {
    stopEditMode();
    removeLayer(state.scopeLayer);
    state.scopeLayer = null;
    state.recordId = String(recordId || "");
    state.siteId = "";
    state.scope = null;
    state.vertices = [];
    renderUi("サイト情報を読み込んでいます…");
    refreshVisuals();
  }

  async function loadForRecord(recordId) {
    const seq = ++state.loadSeq;
    resetSiteState(recordId);
    try {
      const history = await invoke(HISTORY_FUNCTION, { recordId });
      if (seq !== state.loadSeq) return;
      state.siteId = String(history?.site?.id || history?.current?.siteId || "");
      if (!state.siteId) {
        renderUi();
        dispatchChange("unassigned");
        return;
      }
      const data = await invoke(SCOPE_FUNCTION, { action: "get", siteId: state.siteId });
      if (seq !== state.loadSeq) return;
      state.scope = data.scope || null;
      state.vertices = normalizeVertices(data.scope?.vertices || []);
      drawSavedScope();
      refreshVisuals();
      renderUi();
      dispatchChange("load");
    } catch (error) {
      if (seq !== state.loadSeq) return;
      console.error("review scope load error", error);
      renderUi(error?.message || "審査範囲を読み込めませんでした。");
    }
  }

  function dispatchChange(reason) {
    window.dispatchEvent(new CustomEvent("adminreviewscopechange", {
      detail: {
        reason,
        siteId: state.siteId || null,
        scope: state.scope ? { ...state.scope, vertices: state.vertices.map(v => ({ ...v })) } : null,
        counts: scopeCounts()
      }
    }));
  }

  function installMapHook() {
    if (!window.L?.Map || L.Map.prototype.__adminReviewScopeHookInstalled) return;
    L.Map.prototype.__adminReviewScopeHookInstalled = true;
    L.Map.addInitHook(function () {
      const container = this.getContainer?.();
      if (container?.id !== "arwMap") return;
      state.map = this;
      setTimeout(() => {
        ensureUi();
        drawSavedScope();
        refreshVisuals();
      }, 0);
    });
  }

  function patchWorkspace() {
    const original = window.AdminReviewWorkspace;
    if (!original || original.__phase4ScopeWrapped) return Boolean(original?.__phase4ScopeWrapped);
    const wrapped = Object.freeze({
      __phase4ScopeWrapped: true,
      open: async recordId => {
        const scopePromise = loadForRecord(recordId);
        const result = await original.open(recordId);
        observeWorkspace();
        await scopePromise;
        queueRefresh();
        return result;
      },
      close: () => {
        cancelEdit();
        return original.close();
      },
      isOpen: () => original.isOpen()
    });
    window.AdminReviewWorkspace = wrapped;
    state.patched = true;
    return true;
  }

  installMapHook();

  const bootTimer = window.setInterval(() => {
    installMapHook();
    if (patchWorkspace()) {
      window.clearInterval(bootTimer);
    }
  }, 50);

  const domObserver = new MutationObserver(() => {
    if (!document.getElementById("adminReviewWorkspace")) return;
    ensureUi();
    observeWorkspace();
  });
  domObserver.observe(document.documentElement, { childList: true, subtree: true });

  window.AdminReviewScope = Object.freeze({
    containsPoint: point => pointInPolygon(point, state.vertices),
    getSiteId: () => state.siteId || null,
    getScope: () => state.scope ? { ...state.scope, vertices: state.vertices.map(v => ({ ...v })) } : null,
    getCounts: () => ({ ...scopeCounts() }),
    reload: () => state.recordId ? loadForRecord(state.recordId) : Promise.resolve()
  });
})();
