/* ======================================================
   管理者専用: 提出KMZ MAP VIEWER
   - sessionStorage の管理者セッションを引き継ぐ
   - Supabase admin-kmz-access 経由で一覧 / KMZ本体を取得
   - KMZ内KMLを Leaflet に描画
====================================================== */
(function () {
  "use strict";

  const FUNCTION_NAME = "admin-kmz-access";
  const SESSION_TOKEN_KEY = "campsiteAdminSessionToken";
  const SESSION_EXPIRES_KEY = "campsiteAdminSessionExpiresAt";
  const SUPABASE_URL = "https://azkshxjgsbtjgwbapcfw.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rWbeIqdWJJHHBtphER8bdg__CaS_xGK";

  const state = {
    records: [],
    filtered: [],
    selectedId: "",
    search: "",
    excludeOwn: true,
    currentBlob: null,
    currentFileName: "",
    loadSequence: 0
  };

  const els = {};
  let client = null;
  let map = null;
  let dataLayer = null;

  function cacheElements() {
    [
      "kmvBackButton", "kmvSearch", "kmvExcludeOwn", "kmvListCount", "kmvRecordList",
      "kmvPrev", "kmvNext", "kmvPosition", "kmvMapState", "kmvTitle", "kmvFileName",
      "kmvDownload", "kmvMeta", "kmvRenderStatus"
    ].forEach(id => { els[id] = document.getElementById(id); });
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return String(value || "").normalize("NFKC").toLowerCase().trim();
  }

  function fmtDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(d);
  }

  function scoreText(item) {
    const score = Number(item?.campsiteScore);
    const rank = item?.campsiteRank || "";
    if (Number.isFinite(score) && rank) return `${score} / ${rank}`;
    if (Number.isFinite(score)) return String(score);
    return rank || "-";
  }

  function actionLabel(type) {
    return type === "distance_check" ? "距離チェック" : "KMZ生成";
  }

  function displayTitle(item) {
    if (item?.parkName && item.parkName !== "公園名不明") return item.parkName;
    return item?.displayFileName || item?.originalFileName || "名称不明";
  }

  function sessionToken() {
    return sessionStorage.getItem(SESSION_TOKEN_KEY) || "";
  }

  function hasLiveSession() {
    const token = sessionToken();
    const expiresAt = sessionStorage.getItem(SESSION_EXPIRES_KEY) || "";
    if (!token || !expiresAt) return false;
    const expires = new Date(expiresAt).getTime();
    return Number.isFinite(expires) && expires > Date.now();
  }

  function clearAdminSession() {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_EXPIRES_KEY);
    sessionStorage.removeItem("campsiteAdminUnlocked");
  }

  function ensureSupabase() {
    if (window.campsiteSupabase?.functions) return window.campsiteSupabase;
    if (!window.supabase?.createClient) throw new Error("Supabase SDKを読み込めませんでした。");
    window.campsiteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    return window.campsiteSupabase;
  }

  async function invoke(bodyData) {
    if (!hasLiveSession()) throw new Error("管理者セッションの有効期限が切れています。");
    client = client || ensureSupabase();
    const { data, error } = await client.functions.invoke(FUNCTION_NAME, {
      body: { ...bodyData, sessionToken: sessionToken() }
    });

    if (error) {
      let message = error.message || "管理者KMZ処理に失敗しました。";
      try {
        const details = error.context && typeof error.context.json === "function"
          ? await error.context.json()
          : null;
        if (details?.error) message = details.error;
      } catch (_) {}
      throw new Error(message);
    }
    if (!data?.success) throw new Error(data?.error || "管理者KMZ処理に失敗しました。");
    return data;
  }

  function showMapState(message, error = false) {
    if (!els.kmvMapState) return;
    els.kmvMapState.textContent = message;
    els.kmvMapState.classList.remove("hidden", "error");
    if (error) els.kmvMapState.classList.add("error");
  }

  function hideMapState() {
    els.kmvMapState?.classList.add("hidden");
  }

  function initMap() {
    map = L.map("kmvMap", { zoomControl: true }).setView([35.6812, 139.7671], 13);
    map.attributionControl.setPosition("bottomright");

    const base = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
    const aerial = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 20,
      attribution: "Tiles &copy; Esri"
    });
    L.control.layers({ "地図": base, "航空写真": aerial }, null, { position: "topright" }).addTo(map);
    dataLayer = L.layerGroup().addTo(map);
  }

  function recordMatches(item) {
    if (state.excludeOwn && item?.hasOtherDeviceActivity !== true) return false;
    const q = normalize(state.search);
    if (!q) return true;
    return normalize([
      item?.parkName,
      item?.originalFileName,
      item?.displayFileName,
      item?.creatorDisplayName,
      item?.deviceLabel,
      actionLabel(item?.actionType)
    ].join(" ")).includes(q);
  }

  function applyFilters({ selectFirstIfNeeded = true } = {}) {
    state.filtered = state.records.filter(recordMatches);
    if (selectFirstIfNeeded && (!state.selectedId || !state.filtered.some(r => String(r.id) === String(state.selectedId)))) {
      state.selectedId = state.filtered[0]?.id ? String(state.filtered[0].id) : "";
    }
    renderRecordList();
    updateNavigation();
  }

  function renderRecordList() {
    if (!els.kmvRecordList) return;
    els.kmvListCount.textContent = `${state.filtered.length}件 / 全${state.records.length}件`;
    if (!state.filtered.length) {
      els.kmvRecordList.innerHTML = `<div class="kmv-empty">該当する提出KMZはありません。<br>検索条件または「この端末の履歴を除く」を変更してください。</div>`;
      return;
    }

    els.kmvRecordList.innerHTML = state.filtered.map(item => {
      const active = String(item.id) === String(state.selectedId) ? " active" : "";
      const creator = item.hasCreatorIdentity ? (item.creatorDisplayName || "作成者") : (item.deviceLabel || "匿名端末");
      return `<button type="button" class="kmv-record${active}" data-record-id="${esc(item.id)}">
        <strong>${esc(displayTitle(item))}</strong>
        <small>${esc(item.displayFileName || item.originalFileName || "-")}</small>
        <small>${esc(fmtDate(item.lastActivityAt || item.createdAt))} · ${esc(creator)}</small>
      </button>`;
    }).join("");

    els.kmvRecordList.querySelectorAll("[data-record-id]").forEach(button => {
      button.addEventListener("click", () => selectRecord(button.dataset.recordId));
    });

    requestAnimationFrame(() => {
      els.kmvRecordList.querySelector(".kmv-record.active")?.scrollIntoView({ block: "nearest" });
    });
  }

  function currentIndex() {
    return state.filtered.findIndex(r => String(r.id) === String(state.selectedId));
  }

  function updateNavigation() {
    const index = currentIndex();
    const hasSelection = index >= 0;
    els.kmvPrev.disabled = !hasSelection || index <= 0;
    els.kmvNext.disabled = !hasSelection || index >= state.filtered.length - 1;
    els.kmvPosition.textContent = hasSelection ? `${index + 1} / ${state.filtered.length}` : `- / ${state.filtered.length || 0}`;
  }

  function moveSelection(delta) {
    const index = currentIndex();
    const target = index + delta;
    if (index < 0 || target < 0 || target >= state.filtered.length) return;
    selectRecord(state.filtered[target].id);
  }

  function selectedRecord() {
    return state.records.find(r => String(r.id) === String(state.selectedId)) || null;
  }

  function renderMeta(item, featureSummary = null) {
    const creator = item?.hasCreatorIdentity
      ? item.creatorDisplayName || "作成者"
      : "記録なし";
    const features = featureSummary
      ? `${featureSummary.points}点 / ${featureSummary.lines}線 / ${featureSummary.polygons}面`
      : "-";
    els.kmvMeta.innerHTML = `
      <div>作成者<strong>${esc(creator)}</strong></div>
      <div>最終利用<strong>${esc(fmtDate(item?.lastActivityAt || item?.createdAt))}</strong></div>
      <div>POI<strong>${item?.poiCount ?? "-"}件（追加 ${item?.addedPoiCount ?? "-"}）</strong></div>
      <div>警告 / 評価<strong>${item?.warningCount ?? "-"}件 / ${esc(scoreText(item))}</strong></div>
      <div>用途<strong>${esc(actionLabel(item?.actionType))}</strong></div>
      <div>描画要素<strong>${esc(features)}</strong></div>
      <div>匿名端末<strong>${esc(item?.deviceLabel || "-")}</strong></div>
      <div>保存期限<strong>${esc(fmtDate(item?.expiresAt))}</strong></div>
    `;
  }

  async function fetchKmz(recordId) {
    const info = await invoke({ action: "download", recordId });
    const response = await fetch(info.signedUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("KMZ本体を取得できませんでした。");
    return {
      blob: await response.blob(),
      fileName: info.fileName || "campsite.kmz"
    };
  }

  async function blobToKmlText(blob, fileName) {
    const lower = String(fileName || "").toLowerCase();
    if (lower.endsWith(".kml") || /(?:application|text)\/.*xml/i.test(blob.type || "")) {
      return blob.text();
    }

    try {
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const entries = Object.values(zip.files).filter(entry => !entry.dir && /\.kml$/i.test(entry.name));
      if (!entries.length) throw new Error("KMZ内にKMLが見つかりません。");
      entries.sort((a, b) => {
        const aDoc = /(^|\/)doc\.kml$/i.test(a.name) ? 0 : 1;
        const bDoc = /(^|\/)doc\.kml$/i.test(b.name) ? 0 : 1;
        return aDoc - bDoc || a.name.localeCompare(b.name);
      });
      return entries[0].async("text");
    } catch (zipError) {
      const text = await blob.text();
      if (/<\s*kml\b/i.test(text)) return text;
      throw zipError;
    }
  }

  function localNodes(root, localName) {
    if (!root) return [];
    try {
      return Array.from(root.getElementsByTagNameNS("*", localName));
    } catch (_) {
      return Array.from(root.getElementsByTagName(localName));
    }
  }

  function directText(node, localName) {
    for (const child of Array.from(node?.children || [])) {
      if (child.localName === localName) return String(child.textContent || "").trim();
    }
    return "";
  }

  function folderNameFor(node) {
    let current = node?.parentElement || null;
    while (current) {
      if (current.localName === "Folder") return directText(current, "name");
      current = current.parentElement;
    }
    return "";
  }

  function parseCoordinates(text) {
    return String(text || "").trim().split(/\s+/).map(part => {
      const values = part.split(",");
      const lng = Number(values[0]);
      const lat = Number(values[1]);
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
    }).filter(Boolean);
  }

  function popupHtml(name, folder) {
    const title = name || "名称なし";
    return `<strong>${esc(title)}</strong>${folder ? `<br><span>${esc(folder)}</span>` : ""}`;
  }

  function categoryFor(name, folder) {
    const text = normalize(`${folder} ${name}`);
    if (/追加|追加予定|追加希望|追加候補|候補|新設|planned|candidate|proposed|add/.test(text)) return "added";
    if (/50\s*m|50m|半径50|５０ｍ/.test(text)) return "circle50";
    if (/40\s*m|40m|半径40|４０ｍ/.test(text)) return "circle40";
    if (/30\s*m|30m|半径30|３０ｍ/.test(text)) return "circle30";
    if (/活動範囲|対象範囲|範囲|boundary|area|site/.test(text)) return "area";
    return "existing";
  }

  function polygonStyle(category) {
    if (category === "circle50") return { color: "#fb923c", weight: 2, opacity: .9, fillColor: "#fb923c", fillOpacity: .05 };
    if (category === "circle40") return { color: "#a78bfa", weight: 2, opacity: .85, fillColor: "#a78bfa", fillOpacity: .04 };
    if (category === "circle30") return { color: "#38bdf8", weight: 2, opacity: .8, fillColor: "#38bdf8", fillOpacity: .04 };
    if (category === "area") return { color: "#34d399", weight: 3, opacity: .95, fillColor: "#34d399", fillOpacity: .08 };
    return { color: "#94a3b8", weight: 2, opacity: .72, fillColor: "#64748b", fillOpacity: .04 };
  }

  function renderKml(kmlText) {
    const doc = new DOMParser().parseFromString(kmlText, "application/xml");
    if (localNodes(doc, "parsererror").length) throw new Error("KMLを解析できませんでした。");

    const geometries = { polygons: [], lines: [], points: [] };
    const placemarks = localNodes(doc, "Placemark");

    placemarks.forEach(pm => {
      const name = directText(pm, "name");
      const folder = folderNameFor(pm);
      const category = categoryFor(name, folder);

      localNodes(pm, "Polygon").forEach(poly => {
        const outer = localNodes(poly, "outerBoundaryIs")[0] || poly;
        const coordNode = localNodes(outer, "coordinates")[0];
        const coords = parseCoordinates(coordNode?.textContent || "");
        if (coords.length >= 3) geometries.polygons.push({ name, folder, category, coords });
      });

      localNodes(pm, "LineString").forEach(line => {
        const coordNode = localNodes(line, "coordinates")[0];
        const coords = parseCoordinates(coordNode?.textContent || "");
        if (coords.length >= 2) geometries.lines.push({ name, folder, category, coords });
      });

      localNodes(pm, "Point").forEach(point => {
        const coordNode = localNodes(point, "coordinates")[0];
        const coords = parseCoordinates(coordNode?.textContent || "");
        if (coords.length) geometries.points.push({ name, folder, category, coords: coords[0] });
      });
    });

    dataLayer.clearLayers();
    const bounds = L.latLngBounds([]);

    geometries.polygons.forEach(item => {
      item.coords.forEach(coord => bounds.extend(coord));
      L.polygon(item.coords, polygonStyle(item.category))
        .bindPopup(popupHtml(item.name, item.folder))
        .addTo(dataLayer);
    });

    geometries.lines.forEach(item => {
      item.coords.forEach(coord => bounds.extend(coord));
      const style = polygonStyle(item.category);
      L.polyline(item.coords, { color: style.color, weight: Math.max(2, style.weight), opacity: style.opacity })
        .bindPopup(popupHtml(item.name, item.folder))
        .addTo(dataLayer);
    });

    geometries.points.forEach(item => {
      bounds.extend(item.coords);
      const added = item.category === "added";
      L.circleMarker(item.coords, {
        radius: added ? 8 : 7,
        weight: 2,
        color: "#f8fafc",
        fillColor: added ? "#fbbf24" : "#38bdf8",
        fillOpacity: .95
      }).bindPopup(popupHtml(item.name, item.folder)).addTo(dataLayer);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(.08), { maxZoom: 18, animate: false });
    } else {
      map.setView([35.6812, 139.7671], 13, { animate: false });
    }

    return {
      points: geometries.points.length,
      lines: geometries.lines.length,
      polygons: geometries.polygons.length,
      placemarks: placemarks.length
    };
  }

  async function selectRecord(recordId, { replaceUrl = true } = {}) {
    const id = String(recordId || "");
    const item = state.records.find(record => String(record.id) === id);
    if (!item) return;

    state.selectedId = id;
    state.currentBlob = null;
    state.currentFileName = "";
    const sequence = ++state.loadSequence;

    renderRecordList();
    updateNavigation();
    els.kmvTitle.textContent = displayTitle(item);
    els.kmvFileName.textContent = item.displayFileName || item.originalFileName || "-";
    els.kmvDownload.disabled = true;
    renderMeta(item);
    els.kmvRenderStatus.textContent = "KMZを取得しています…";
    showMapState("KMZを取得して地図を描画しています…");

    if (replaceUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("record", id);
      history.replaceState(null, "", url);
    }

    try {
      const { blob, fileName } = await fetchKmz(id);
      if (sequence !== state.loadSequence) return;
      const kmlText = await blobToKmlText(blob, fileName);
      if (sequence !== state.loadSequence) return;
      const featureSummary = renderKml(kmlText);
      state.currentBlob = blob;
      state.currentFileName = fileName;
      els.kmvFileName.textContent = fileName;
      els.kmvDownload.disabled = false;
      renderMeta(item, featureSummary);
      els.kmvRenderStatus.textContent = `Placemark ${featureSummary.placemarks}件を読み込み、地図へ描画しました。`;
      hideMapState();
      setTimeout(() => map.invalidateSize(false), 0);
    } catch (error) {
      if (sequence !== state.loadSequence) return;
      console.error("KMZ map render error", error);
      dataLayer.clearLayers();
      els.kmvRenderStatus.textContent = error?.message || "KMZを地図へ描画できませんでした。";
      showMapState(error?.message || "KMZを地図へ描画できませんでした。", true);
      if (/認証|セッション|期限/.test(error?.message || "")) clearAdminSession();
    }
  }

  function downloadCurrent() {
    if (!state.currentBlob) return;
    const url = URL.createObjectURL(state.currentBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = state.currentFileName || "campsite.kmz";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderLocked() {
    state.records = [];
    state.filtered = [];
    state.selectedId = "";
    els.kmvRecordList.innerHTML = `<div class="kmv-empty">🔒 管理者セッションがありません。<br>管理画面へ戻って管理者認証を行ってください。</div>`;
    els.kmvListCount.textContent = "管理者認証が必要です";
    els.kmvTitle.textContent = "管理者認証が必要です";
    els.kmvFileName.textContent = "-";
    els.kmvMeta.innerHTML = "";
    els.kmvRenderStatus.textContent = "";
    els.kmvDownload.disabled = true;
    updateNavigation();
    showMapState("🔒 管理画面へ戻って管理者認証を行ってください。", true);
  }

  async function loadRecords() {
    if (!hasLiveSession()) {
      renderLocked();
      return;
    }

    showMapState("提出KMZ一覧を読み込んでいます…");
    try {
      const payload = await invoke({
        action: "list",
        currentDeviceId: localStorage.getItem("campsiteUserId") || ""
      });
      state.records = (payload.uniqueRecords || [])
        .filter(item => item?.id)
        .sort((a, b) => new Date(b.lastActivityAt || b.createdAt || 0) - new Date(a.lastActivityAt || a.createdAt || 0));

      const requested = new URL(window.location.href).searchParams.get("record") || "";
      state.selectedId = state.records.some(r => String(r.id) === String(requested)) ? String(requested) : "";
      applyFilters();

      if (!state.filtered.length) {
        dataLayer.clearLayers();
        showMapState("表示できる提出KMZがありません。検索条件を変更してください。");
        return;
      }

      await selectRecord(state.selectedId || state.filtered[0].id, { replaceUrl: true });
    } catch (error) {
      console.error("KMZ list load error", error);
      if (/認証|セッション|期限/.test(error?.message || "")) clearAdminSession();
      renderLocked();
      els.kmvRenderStatus.textContent = error?.message || "提出KMZ一覧を取得できませんでした。";
    }
  }

  function bindEvents() {
    els.kmvBackButton.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else window.location.href = "index.html";
    });
    els.kmvSearch.addEventListener("input", event => {
      state.search = event.target.value || "";
      const before = state.selectedId;
      applyFilters();
      if (!state.filtered.length) {
        state.loadSequence += 1;
        dataLayer.clearLayers();
        showMapState("検索条件に一致する提出KMZはありません。");
        return;
      }
      if (before !== state.selectedId) selectRecord(state.selectedId);
    });
    els.kmvExcludeOwn.addEventListener("change", event => {
      state.excludeOwn = event.target.checked === true;
      const before = state.selectedId;
      applyFilters();
      if (!state.filtered.length) {
        state.loadSequence += 1;
        dataLayer.clearLayers();
        showMapState("表示できる提出KMZがありません。");
        return;
      }
      if (before !== state.selectedId) selectRecord(state.selectedId);
    });
    els.kmvPrev.addEventListener("click", () => moveSelection(-1));
    els.kmvNext.addEventListener("click", () => moveSelection(1));
    els.kmvDownload.addEventListener("click", downloadCurrent);
    window.addEventListener("keydown", event => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "ArrowLeft") moveSelection(-1);
      if (event.key === "ArrowRight") moveSelection(1);
    });
  }

  async function boot() {
    cacheElements();
    initMap();
    bindEvents();
    try {
      ensureSupabase();
    } catch (error) {
      showMapState(error?.message || "Supabaseを初期化できませんでした。", true);
      return;
    }
    await loadRecords();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
