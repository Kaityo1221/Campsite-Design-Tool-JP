/* ======================================================
   Phase 3: Admin review workspace
   - One campsite = one review surface
   - Current / previous / older snapshots use site_id history
   - Snapshot switching keeps the map viewport
   - 30m / 40m / 50m circle layers are intentionally hidden here
   - POI click shows KML description as CA/KMZ memo when present
====================================================== */
(function () {
  "use strict";

  if (window.AdminReviewWorkspace) return;

  const ACCESS_FUNCTION = "admin-kmz-access";
  const HISTORY_FUNCTION = "admin-past-site-state";

  const state = {
    root: null,
    map: null,
    tileLayer: null,
    poiLayer: null,
    contextLayer: null,
    activeRecordId: "",
    activeIndex: 0,
    data: null,
    timeline: [],
    snapshot: null,
    loadSeq: 0,
    viewportReady: false,
    lastBlob: null,
    lastFileName: ""
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
    return String(value || "")
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/[\s　_＿\-－ー]+/g, "");
  }

  function fmtDate(value) {
    const d = new Date(value || 0);
    if (Number.isNaN(d.getTime())) return "日時不明";
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(d);
  }

  function fmtDateOnly(value) {
    const d = new Date(value || 0);
    if (Number.isNaN(d.getTime())) return "過去";
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  }

  function stripHtml(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const doc = new DOMParser().parseFromString(`<body>${raw}</body>`, "text/html");
      return String(doc.body?.textContent || raw)
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, 1600);
    } catch (_) {
      return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1600);
    }
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

  function ensureRoot() {
    if (state.root) return state.root;
    const root = document.createElement("section");
    root.id = "adminReviewWorkspace";
    root.className = "admin-review-workspace";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <header class="arw-topbar">
        <button type="button" class="arw-icon-btn" data-arw-close aria-label="閉じる">←</button>
        <div class="arw-title">
          <p class="arw-eyebrow">ADMIN · CAMPSITE REVIEW</p>
          <h2 id="arwSiteTitle">審査ワークスペース</h2>
          <p id="arwSiteMeta">サイト履歴を読み込んでいます…</p>
        </div>
        <div class="arw-top-actions">
          <button type="button" class="arw-action-btn" data-arw-download disabled>⬇ この版を取得</button>
          <button type="button" class="arw-action-btn primary" data-arw-legacy disabled>詳細解析</button>
          <button type="button" class="arw-icon-btn" data-arw-close aria-label="閉じる">×</button>
        </div>
      </header>
      <nav class="arw-timeline" id="arwTimeline" aria-label="サイト履歴"></nav>
      <div class="arw-summary" id="arwSummary"></div>
      <div class="arw-main">
        <div class="arw-map-wrap">
          <div class="arw-map" id="arwMap"></div>
          <div class="arw-map-state" id="arwMapState">地図を準備しています…</div>
          <div class="arw-map-note">履歴は重ねず、版ごとに切り替えて確認します。30m・40m・50m円は管理者審査では表示しません。</div>
        </div>
        <aside class="arw-inspector" id="arwInspector"></aside>
      </div>`;
    document.body.appendChild(root);
    state.root = root;

    root.querySelectorAll("[data-arw-close]").forEach(btn => btn.addEventListener("click", close));
    root.querySelector("[data-arw-download]")?.addEventListener("click", downloadActive);
    root.querySelector("[data-arw-legacy]")?.addEventListener("click", openLegacyReview);
    root.querySelector("#arwTimeline")?.addEventListener("click", event => {
      const button = event.target.closest("[data-arw-index]");
      if (!button) return;
      const index = Number(button.dataset.arwIndex);
      if (Number.isInteger(index)) showSnapshot(index, { preserveViewport: true });
    });
    window.addEventListener("keydown", event => {
      if (event.key === "Escape" && state.root?.classList.contains("open")) close();
    });
    return root;
  }

  async function ensureMap() {
    ensureRoot();
    await window.CampsiteAdminMapDeps?.ready?.();
    if (!window.L) throw new Error("地図ライブラリを読み込めませんでした。");
    if (state.map) return state.map;

    state.map = L.map("arwMap", { zoomControl: true }).setView([35.6812, 139.7671], 13);
    state.tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(state.map);
    state.contextLayer = L.layerGroup().addTo(state.map);
    state.poiLayer = L.layerGroup().addTo(state.map);
    return state.map;
  }

  function setMapState(message, error = false) {
    const box = state.root?.querySelector("#arwMapState");
    if (!box) return;
    box.textContent = message || "";
    box.classList.toggle("error", error);
    box.classList.toggle("hidden", !message);
  }

  function buildTimeline(data) {
    const items = [];
    const seen = new Set();
    const push = item => {
      if (!item?.id || seen.has(item.id)) return;
      seen.add(item.id);
      items.push(item);
    };
    push(data?.current);
    (Array.isArray(data?.history) ? data.history : []).forEach(push);
    if (items.length === 1 && data?.previous) push(data.previous);
    return items;
  }

  function renderTimeline() {
    const nav = state.root?.querySelector("#arwTimeline");
    if (!nav) return;
    nav.innerHTML = state.timeline.map((item, index) => {
      const top = index === 0 ? "今回" : index === 1 ? "前回" : fmtDateOnly(item.createdAt);
      const sub = index === 0 ? fmtDateOnly(item.createdAt) : index === 1 ? fmtDateOnly(item.createdAt) : `履歴 ${index}`;
      return `<button type="button" class="arw-time-btn ${index === state.activeIndex ? "active" : ""}" data-arw-index="${index}"><strong>${esc(top)}</strong><small>${esc(sub)}</small></button>`;
    }).join("");
    requestAnimationFrame(() => nav.querySelector(".arw-time-btn.active")?.scrollIntoView({ block: "nearest", inline: "center" }));
  }

  function comparisonKey(poi) {
    const lat = Number(poi?.lat);
    const lng = Number(poi?.lng);
    return `${normalize(poi?.normalizedName || poi?.name)}:${Number.isFinite(lat) ? lat.toFixed(5) : ""}:${Number.isFinite(lng) ? lng.toFixed(5) : ""}`;
  }

  function currentDelta() {
    const current = state.data?.current?.pois || [];
    const previous = state.timeline?.[1]?.pois || [];
    if (!previous.length) return { added: 0, removed: 0, same: 0, text: "初回" };
    const currentKeys = new Set(current.map(comparisonKey));
    const previousKeys = new Set(previous.map(comparisonKey));
    let added = 0;
    let removed = 0;
    let same = 0;
    currentKeys.forEach(key => previousKeys.has(key) ? same++ : added++);
    previousKeys.forEach(key => { if (!currentKeys.has(key)) removed++; });
    return { added, removed, same, text: `+${added} / -${removed}` };
  }

  function spacingMeters() {
    return Number(window.CampsitePolicy?.getSpacingMeters?.()) || Number(window.CampsitePoiSpacingPolicy?.targetMeters) || 50;
  }

  function renderSummary() {
    const host = state.root?.querySelector("#arwSummary");
    if (!host) return;
    const points = state.snapshot?.points || [];
    const added = points.filter(p => p.category === "added").length;
    const delta = currentDelta();
    const item = state.timeline[state.activeIndex] || {};
    host.innerHTML = `
      <div class="arw-stat"><span>この版のPOI</span><strong>${points.length}件</strong></div>
      <div class="arw-stat"><span>追加予定</span><strong>${added}件</strong></div>
      <div class="arw-stat ${state.activeIndex === 0 && (delta.added || delta.removed) ? "warn" : ""}"><span>前回比</span><strong>${state.activeIndex === 0 ? esc(delta.text) : "履歴版"}</strong></div>
      <div class="arw-stat"><span>サイト履歴</span><strong>${state.timeline.length}版</strong></div>
      <div class="arw-stat good"><span>現在の距離基準</span><strong>${spacingMeters()}m</strong></div>`;

    const title = state.root.querySelector("#arwSiteTitle");
    const meta = state.root.querySelector("#arwSiteMeta");
    if (title) title.textContent = state.data?.site?.name || state.data?.current?.parkName || item.parkName || "キャンプサイト";
    if (meta) meta.textContent = `${fmtDate(item.createdAt)} · ${item.fileName || "ファイル名不明"}${state.data?.site?.id ? ` · site ${String(state.data.site.id).slice(0, 8)}` : ""}`;
  }

  async function fetchKmz(recordId) {
    const info = await invoke(ACCESS_FUNCTION, { action: "download", recordId });
    const response = await fetch(info.signedUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("KMZ本体を取得できませんでした。");
    return { blob: await response.blob(), fileName: info.fileName || "campsite.kmz" };
  }

  async function blobToKmlText(blob, fileName) {
    const lower = String(fileName || "").toLowerCase();
    if (lower.endsWith(".kml") || /(?:application|text)\/.*xml/i.test(blob.type || "")) return blob.text();
    if (!window.JSZip) throw new Error("KMZ展開ライブラリを読み込めませんでした。");
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
    try { return Array.from(root.getElementsByTagNameNS("*", localName)); }
    catch (_) { return Array.from(root.getElementsByTagName(localName)); }
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
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
      return [lat, lng];
    }).filter(Boolean);
  }

  function poiTypeFor(name, folder) {
    const text = normalize(`${folder} ${name}`);
    if (/gym|ジム/.test(text)) return "Gym";
    if (/power|パワースポット|パワスポ/.test(text)) return "Power Spot";
    if (/pok[eé]?stop|poke\s*stop|ポケスト/.test(text)) return "PokéStop";
    return "POI";
  }

  function categoryFor(name, folder) {
    const text = normalize(`${folder} ${name}`);
    return /新規|追加希望|追加予定|追加候補|候補|new|planned|proposed|candidate|add/.test(text)
      ? "added"
      : "existing";
  }

  function isCircleContext(name, folder) {
    const text = normalize(`${folder} ${name}`);
    return /(?:30|40|50)m|(?:３０|４０|５０)ｍ|円（|円\(|半径(?:30|40|50)/.test(text);
  }

  function isReviewArea(name, folder) {
    const text = normalize(`${folder} ${name}`);
    return /活動範囲|対象範囲|boundary|reviewarea|sitearea/.test(text);
  }

  function isDummy(name, description) {
    const text = normalize(`${name} ${description}`);
    return /ダミーポイント|レイヤー保持用|ここに追加/.test(text);
  }

  function parseKml(kmlText) {
    const doc = new DOMParser().parseFromString(kmlText, "application/xml");
    if (localNodes(doc, "parsererror").length) throw new Error("KMLを解析できませんでした。");

    const points = [];
    const areas = [];
    const boundaryLines = [];

    localNodes(doc, "Placemark").forEach(pm => {
      const name = directText(pm, "name") || "名称なし";
      const folder = folderNameFor(pm);
      const descriptionRaw = directText(pm, "description");
      const memo = stripHtml(descriptionRaw);
      if (isDummy(name, descriptionRaw)) return;

      localNodes(pm, "Point").forEach(pointNode => {
        if (isCircleContext(name, folder)) return;
        const coords = parseCoordinates(localNodes(pointNode, "coordinates")[0]?.textContent || "");
        if (!coords.length) return;
        points.push({
          name,
          folder,
          memo,
          category: categoryFor(name, folder),
          poiType: poiTypeFor(name, folder),
          lat: coords[0][0],
          lng: coords[0][1]
        });
      });

      localNodes(pm, "Polygon").forEach(poly => {
        if (isCircleContext(name, folder) || !isReviewArea(name, folder)) return;
        const outer = localNodes(poly, "outerBoundaryIs")[0] || poly;
        const coords = parseCoordinates(localNodes(outer, "coordinates")[0]?.textContent || "");
        if (coords.length >= 3) areas.push({ name, folder, coords });
      });

      localNodes(pm, "LineString").forEach(line => {
        if (!isReviewArea(name, folder)) return;
        const coords = parseCoordinates(localNodes(line, "coordinates")[0]?.textContent || "");
        if (coords.length >= 2) boundaryLines.push({ name, folder, coords });
      });
    });

    return { points, areas, boundaryLines };
  }

  function pointPresence(point) {
    const key = comparisonKey(point);
    const snapshots = state.timeline.filter(item => (item?.pois || []).some(poi => comparisonKey(poi) === key));
    const current = (state.data?.current?.pois || []).some(poi => comparisonKey(poi) === key);
    return { count: snapshots.length, current };
  }

  function renderInspector(point = null) {
    const host = state.root?.querySelector("#arwInspector");
    if (!host) return;
    const active = state.timeline[state.activeIndex] || {};

    if (!point) {
      const delta = currentDelta();
      host.innerHTML = `
        <div class="arw-panel">
          <h3>この版を確認</h3>
          <p class="arw-panel-sub">POIをタップすると、名称・種類・座標・KMZ内のメモを確認できます。</p>
          <div class="arw-legend"><span><i class="arw-dot existing"></i>既存POI</span><span><i class="arw-dot added"></i>追加予定POI</span><span><i class="arw-line"></i>参考範囲</span></div>
          ${state.activeIndex === 0 && state.timeline.length > 1 ? `<div class="arw-history-note">前回との差分: 追加 ${delta.added} / 未確認 ${delta.removed} / 継続 ${delta.same}</div>` : `<div class="arw-history-note">${state.activeIndex === 0 ? "このサイトの初回履歴です。" : "過去のスナップショットを表示しています。"}</div>`}
        </div>
        <div class="arw-panel">
          <h3>スナップショット</h3>
          <div class="arw-detail-grid">
            <div class="arw-detail"><span>日時</span><strong>${esc(fmtDate(active.createdAt))}</strong></div>
            <div class="arw-detail"><span>ファイル</span><strong>${esc(active.fileName || state.lastFileName || "-")}</strong></div>
            <div class="arw-detail"><span>site_id</span><strong>${esc(state.data?.site?.id || "未割当")}</strong></div>
          </div>
          <button type="button" class="arw-inline-btn" data-arw-inline-legacy>従来の詳細解析を開く</button>
        </div>`;
      host.querySelector("[data-arw-inline-legacy]")?.addEventListener("click", openLegacyReview);
      return;
    }

    const presence = pointPresence(point);
    host.innerHTML = `
      <div class="arw-panel">
        <h2 class="arw-poi-name">${esc(point.name)}</h2>
        <div class="arw-tags"><span class="arw-tag">${esc(point.category === "added" ? "追加予定" : "既存")}</span><span class="arw-tag">${esc(point.poiType)}</span>${point.folder ? `<span class="arw-tag">${esc(point.folder)}</span>` : ""}</div>
        <div class="arw-detail-grid">
          <div class="arw-detail"><span>緯度</span><strong>${Number(point.lat).toFixed(6)}</strong></div>
          <div class="arw-detail"><span>経度</span><strong>${Number(point.lng).toFixed(6)}</strong></div>
          <div class="arw-detail"><span>サイト履歴</span><strong>${presence.count}版で確認</strong></div>
          <div class="arw-detail"><span>今回の版</span><strong>${presence.current ? "存在" : "未確認"}</strong></div>
        </div>
        <div class="arw-memo ${point.memo ? "" : "empty"}"><span>CAメモ / KMZ記載</span><p>${esc(point.memo || "メモは記載されていません。")}</p></div>
      </div>`;
  }

  function renderMap(snapshot, preserveViewport) {
    const savedCenter = preserveViewport && state.viewportReady ? state.map.getCenter() : null;
    const savedZoom = preserveViewport && state.viewportReady ? state.map.getZoom() : null;
    state.poiLayer.clearLayers();
    state.contextLayer.clearLayers();
    const bounds = L.latLngBounds([]);

    snapshot.areas.forEach(area => {
      area.coords.forEach(coord => bounds.extend(coord));
      L.polygon(area.coords, {
        color: "#94a3b8",
        weight: 2,
        dashArray: "7 7",
        opacity: .7,
        fillColor: "#64748b",
        fillOpacity: .025
      }).addTo(state.contextLayer);
    });
    snapshot.boundaryLines.forEach(line => {
      line.coords.forEach(coord => bounds.extend(coord));
      L.polyline(line.coords, { color: "#94a3b8", weight: 2, dashArray: "7 7", opacity: .65 }).addTo(state.contextLayer);
    });

    snapshot.points.forEach(point => {
      const coords = [point.lat, point.lng];
      bounds.extend(coords);
      const added = point.category === "added";
      const marker = L.circleMarker(coords, {
        radius: added ? 8 : 7,
        weight: 2,
        color: "#f8fafc",
        fillColor: added ? "#fbbf24" : "#38bdf8",
        fillOpacity: .95,
        opacity: .95
      });
      marker.bindPopup(`<strong>${esc(point.name)}</strong><br><span class="arw-marker-label">${esc(point.poiType)} · ${added ? "追加予定" : "既存"}</span>`, { className: "arw-leaflet-popup" });
      marker.on("click", () => renderInspector(point));
      marker.addTo(state.poiLayer);
    });

    if (savedCenter && Number.isFinite(savedZoom)) {
      state.map.setView(savedCenter, savedZoom, { animate: false });
    } else if (bounds.isValid()) {
      state.map.fitBounds(bounds.pad(.08), { maxZoom: 18, animate: false });
      state.viewportReady = true;
    }
    setTimeout(() => {
      state.map.invalidateSize(false);
      if (savedCenter && Number.isFinite(savedZoom)) state.map.setView(savedCenter, savedZoom, { animate: false });
    }, 0);
  }

  async function showSnapshot(index, options = {}) {
    const item = state.timeline[index];
    if (!item) return;
    const seq = ++state.loadSeq;
    state.activeIndex = index;
    renderTimeline();
    setMapState("この版のKMZを読み込んでいます…");
    state.root.querySelector("[data-arw-download]").disabled = true;
    state.root.querySelector("[data-arw-legacy]").disabled = true;
    renderInspector(null);

    try {
      const { blob, fileName } = await fetchKmz(item.id);
      if (seq !== state.loadSeq) return;
      const kmlText = await blobToKmlText(blob, fileName);
      if (seq !== state.loadSeq) return;
      const snapshot = parseKml(kmlText);
      state.snapshot = snapshot;
      state.lastBlob = blob;
      state.lastFileName = fileName;
      item.fileName = item.fileName || fileName;
      renderMap(snapshot, options.preserveViewport === true);
      renderSummary();
      renderInspector(null);
      state.root.querySelector("[data-arw-download]").disabled = false;
      state.root.querySelector("[data-arw-legacy]").disabled = false;
      setMapState("");
    } catch (error) {
      console.error("review workspace snapshot error", error);
      if (seq !== state.loadSeq) return;
      state.snapshot = { points: [], areas: [], boundaryLines: [] };
      renderSummary();
      renderInspector(null);
      setMapState(error?.message || "この版を表示できませんでした。", true);
    }
  }

  async function open(recordId) {
    const id = String(recordId || "").trim();
    if (!id) return;
    const root = ensureRoot();
    root.classList.add("open");
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("arw-lock");
    state.activeRecordId = id;
    state.activeIndex = 0;
    state.data = null;
    state.timeline = [];
    state.snapshot = null;
    state.viewportReady = false;
    renderInspector(null);
    const timeline = root.querySelector("#arwTimeline");
    const summary = root.querySelector("#arwSummary");
    if (timeline) timeline.innerHTML = "";
    if (summary) summary.innerHTML = "";
    root.querySelector("#arwSiteTitle").textContent = "審査ワークスペース";
    root.querySelector("#arwSiteMeta").textContent = "サイト履歴を読み込んでいます…";
    setMapState("サイト履歴を読み込んでいます…");

    try {
      await ensureMap();
      const data = await invoke(HISTORY_FUNCTION, { recordId: id });
      state.data = data;
      state.timeline = buildTimeline(data);
      if (!state.timeline.length) throw new Error("このKMZの履歴情報を表示できませんでした。");
      renderTimeline();
      await showSnapshot(0, { preserveViewport: false });
    } catch (error) {
      console.error("review workspace open error", error);
      setMapState(error?.message || "審査ワークスペースを開けませんでした。", true);
      const meta = root.querySelector("#arwSiteMeta");
      if (meta) meta.textContent = "読み込みに失敗しました";
    }
  }

  function close() {
    if (!state.root) return;
    state.root.classList.remove("open");
    state.root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("arw-lock");
  }

  function downloadActive() {
    if (!state.lastBlob) return;
    const url = URL.createObjectURL(state.lastBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = state.lastFileName || "campsite.kmz";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function openLegacyReview() {
    const item = state.timeline[state.activeIndex];
    if (!item) return;
    try {
      const { blob, fileName } = state.lastBlob && state.lastFileName
        ? { blob: state.lastBlob, fileName: state.lastFileName }
        : await fetchKmz(item.id);
      const input = document.getElementById("adminReviewFile");
      if (!input || typeof window.runAdminDashboardReview !== "function") {
        throw new Error("従来の詳細解析を起動できません。");
      }
      const file = new File([blob], fileName, { type: blob.type || "application/vnd.google-earth.kmz" });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      close();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      await window.runAdminDashboardReview();
    } catch (error) {
      alert(error?.message || "詳細解析を開けませんでした。");
    }
  }

  window.AdminReviewWorkspace = Object.freeze({
    open,
    close,
    isOpen: () => Boolean(state.root?.classList.contains("open"))
  });
})();
