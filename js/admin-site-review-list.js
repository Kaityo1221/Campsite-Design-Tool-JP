/* ======================================================
   Admin PRE-CHECK queue
   - Groups KMZ history by stable site_id
   - Shows latest scoped PRE-CHECK state directly in the list
   - Uses the same KMZ classification / distance rules as the workspace
   - Caches by upload + scope revision + policy version for the session
====================================================== */
(function () {
  "use strict";

  if (window.AdminSiteReviewList) return;

  const FUNCTION_NAME = "admin-kmz-access";
  const PAGE_SIZE = 24;
  const BATCH_SIZE = 24;
  const FETCH_CONCURRENCY = 4;
  const CACHE_PREFIX = "campsite-admin-precheck-v2:";

  let payload = null;
  let loading = false;
  let searchText = "";
  let visibleCount = PAGE_SIZE;
  let precheckGeneration = 0;
  let precheckRunning = false;
  const precheckByUpload = new Map();

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

  function compactNormalize(value) {
    return normalize(value).replace(/[\s　_＿\-－ー]+/g, "");
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

  function currentPolicy() {
    const snapshot = window.CampsitePolicy?.getSnapshot?.() || {};
    const limit = (value, fallback) => {
      if (value === null) return null;
      const n = Number(value);
      return Number.isFinite(n) && n >= 0 ? n : fallback;
    };
    return {
      versionNo: Number(snapshot.versionNo) || 0,
      spacingMeters: Number(snapshot.spacingMeters) || 50,
      limits: {
        total: limit(snapshot?.limits?.total, 25),
        pokestop: limit(snapshot?.limits?.pokestop, 12),
        gym: limit(snapshot?.limits?.gym, 8),
        powerSpot: limit(snapshot?.limits?.powerSpot, 5)
      }
    };
  }

  function ensureStyles() {
    if (document.getElementById("adminSiteReviewListStyles")) return;
    const style = document.createElement("style");
    style.id = "adminSiteReviewListStyles";
    style.textContent = `
      .admin-site-review{position:relative;overflow:hidden;margin-bottom:18px;border:1px solid rgba(99,102,241,.3);border-radius:22px;background:radial-gradient(circle at 100% 0%,rgba(99,102,241,.18),transparent 36%),linear-gradient(145deg,rgba(15,23,42,.98),rgba(2,6,23,.98));color:#e2e8f0;box-shadow:0 22px 60px rgba(2,6,23,.32)}
      .asr-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px 20px 12px}.asr-eyebrow{margin:0 0 5px;color:#a5b4fc;font-size:9px;font-weight:900;letter-spacing:.16em}.asr-head h3{margin:0;color:#f8fafc;font-size:clamp(20px,5vw,28px)}.asr-head p{margin:6px 0 0;max-width:650px;color:#94a3b8;font-size:10px;line-height:1.65}.asr-refresh{width:44px;height:44px;border:1px solid rgba(165,180,252,.25);border-radius:12px;background:rgba(99,102,241,.09);color:#e0e7ff;font-size:17px;font-weight:900;cursor:pointer}
      .asr-stats{display:flex;flex-wrap:wrap;gap:6px;padding:0 20px 11px}.asr-pill{padding:5px 8px;border:1px solid rgba(148,163,184,.14);border-radius:999px;background:rgba(30,41,59,.58);color:#cbd5e1;font-size:9px;font-weight:900}.asr-pill strong{color:#f8fafc}.asr-pill.warn strong{color:#fde68a}.asr-pill.good strong{color:#86efac}.asr-search-wrap{padding:0 20px 12px}.asr-search{box-sizing:border-box;width:100%;padding:10px 12px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:#0b1220;color:#f8fafc;font-size:13px}
      .asr-list{display:grid;gap:9px;padding:0 20px 20px}.asr-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px 14px;border:1px solid rgba(148,163,184,.14);border-radius:15px;background:linear-gradient(145deg,rgba(30,41,59,.72),rgba(15,23,42,.72))}.asr-card.warn{border-color:rgba(245,158,11,.3)}.asr-card.scope{border-color:rgba(148,163,184,.24)}.asr-card.good{border-color:rgba(34,197,94,.2)}.asr-title{min-width:0}.asr-title h4{margin:0;color:#f8fafc;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.asr-precheck{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:8px}.asr-precheck-main{font-size:11px;font-weight:1000}.asr-precheck.warn .asr-precheck-main{color:#fde68a}.asr-precheck.good .asr-precheck-main{color:#86efac}.asr-precheck.scope .asr-precheck-main,.asr-precheck.hold .asr-precheck-main{color:#cbd5e1}.asr-precheck.loading .asr-precheck-main{color:#64748b}.asr-mini{padding:3px 6px;border:1px solid rgba(148,163,184,.14);border-radius:999px;background:rgba(2,6,23,.42);color:#94a3b8;font-size:8px;font-weight:900;white-space:nowrap}.asr-mini b{color:#e2e8f0}.asr-meta{display:flex;flex-wrap:wrap;gap:5px 10px;margin-top:7px;color:#94a3b8;font-size:9px}.asr-meta strong{color:#cbd5e1}.asr-site-id{margin-top:5px;color:#475569;font-size:8px}.asr-open{min-width:132px;min-height:42px;padding:8px 10px;border:1px solid rgba(129,140,248,.32);border-radius:11px;background:rgba(79,70,229,.12);color:#eef2ff;font-size:10px;font-weight:900;cursor:pointer}.asr-open:hover{background:rgba(79,70,229,.2)}
      .asr-state{margin:0 20px 20px;padding:22px 14px;border:1px dashed rgba(148,163,184,.2);border-radius:14px;color:#94a3b8;text-align:center;font-size:10px;line-height:1.7}.asr-more{width:calc(100% - 40px);margin:0 20px 20px;min-height:40px;border:1px solid rgba(129,140,248,.25);border-radius:11px;background:rgba(79,70,229,.08);color:#c7d2fe;font-weight:900;cursor:pointer}
      @media(max-width:680px){.asr-head,.asr-stats,.asr-search-wrap,.asr-list{padding-left:14px;padding-right:14px}.asr-state{margin-left:14px;margin-right:14px}.asr-card{grid-template-columns:1fr}.asr-open{width:100%}.asr-more{width:calc(100% - 28px);margin-left:14px;margin-right:14px}}
    `;
    document.head.appendChild(style);
  }

  function getHost() {
    return document.getElementById("admin")?.querySelector(".panel") || null;
  }

  function ensureUi() {
    const host = getHost();
    if (!host) return null;
    let root = document.getElementById("adminSiteReviewList");
    if (root) return root;

    root = document.createElement("section");
    root.id = "adminSiteReviewList";
    root.className = "admin-site-review";
    root.innerHTML = `
      <div class="asr-head">
        <div><p class="asr-eyebrow">ADMIN · PRE-CHECK</p><h3>🔍 提出前チェック</h3><p>最新提出を自動確認し、確認が必要なサイトから先に表示します。正式な審査は運営側で行います。</p></div>
        <button type="button" class="asr-refresh" data-asr-refresh aria-label="更新">↻</button>
      </div>
      <div id="adminSiteReviewListBody"></div>`;

    const archive = document.getElementById("adminKmzBrowserV2");
    if (archive?.parentNode === host) host.insertBefore(root, archive);
    else host.prepend(root);
    root.querySelector("[data-asr-refresh]")?.addEventListener("click", () => load(true));
    return root;
  }

  function body() {
    return document.getElementById("adminSiteReviewListBody");
  }

  function sessionToken() {
    return window.CampsiteAdminAuth?.getSessionToken?.() || "";
  }

  async function invoke(action = "list", extra = {}) {
    if (!window.campsiteSupabase?.functions) throw new Error("Supabase client unavailable");
    const token = sessionToken();
    if (!token) throw new Error("管理者認証が必要です。");
    const { data, error } = await window.campsiteSupabase.functions.invoke(FUNCTION_NAME, {
      body: {
        action,
        currentDeviceId: localStorage.getItem("campsiteUserId") || "",
        sessionToken: token,
        ...extra
      }
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "提出前チェック情報を取得できませんでした。");
    return data;
  }

  function scopeMap() {
    const map = new Map();
    (Array.isArray(payload?.activeScopes) ? payload.activeScopes : []).forEach(scope => {
      if (scope?.siteId && Array.isArray(scope.vertices) && scope.vertices.length >= 3) map.set(scope.siteId, scope);
    });
    return map;
  }

  function groupedSitesRaw() {
    const rows = Array.isArray(payload?.historyRecords) ? payload.historyRecords : [];
    const usable = rows.filter(row => row.isDuplicate !== true && row.isCurrentDevice !== true);
    const groups = new Map();

    usable.forEach(row => {
      const key = row.siteId ? `site:${row.siteId}` : `legacy:${row.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });

    return [...groups.entries()].map(([key, records]) => {
      records.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      const latest = records[0];
      return {
        key,
        siteId: latest.siteId || null,
        latest,
        historyCount: records.length,
        title: latest.parkName && latest.parkName !== "公園名不明"
          ? latest.parkName
          : latest.displayFileName || latest.originalFileName || "名称不明"
      };
    });
  }

  function rankFor(result) {
    if (!result) return 4;
    if (result.kind === "warn") return 0;
    if (result.kind === "scope") return 1;
    if (result.kind === "hold") return 2;
    if (result.kind === "loading") return 3;
    if (result.kind === "good") return 5;
    return 4;
  }

  function groupedSites() {
    return groupedSitesRaw().sort((a, b) => {
      const ar = rankFor(precheckByUpload.get(a.latest.id));
      const br = rankFor(precheckByUpload.get(b.latest.id));
      if (ar !== br) return ar - br;
      return new Date(b.latest.createdAt || 0).getTime() - new Date(a.latest.createdAt || 0).getTime();
    });
  }

  function filteredSites() {
    const q = normalize(searchText);
    return groupedSites().filter(site => {
      if (!q) return true;
      const latest = site.latest;
      return normalize([
        site.title,
        latest.displayFileName,
        latest.originalFileName,
        latest.creatorDisplayName,
        site.siteId
      ].join(" ")).includes(q);
    });
  }

  function cacheKey(site, scope) {
    const policy = currentPolicy();
    return `${CACHE_PREFIX}${site.latest.id}:${Number(scope?.revision) || 0}:${policy.versionNo || 0}`;
  }

  function readCache(site, scope) {
    try {
      const raw = sessionStorage.getItem(cacheKey(site, scope));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function writeCache(site, scope, result) {
    try {
      sessionStorage.setItem(cacheKey(site, scope), JSON.stringify(result));
    } catch (_) {}
  }

  function precheckHtml(site) {
    const result = precheckByUpload.get(site.latest.id);
    if (!result) return `<div class="asr-precheck loading"><strong class="asr-precheck-main">… チェック待ち</strong></div>`;
    if (result.kind === "scope") return `<div class="asr-precheck scope"><strong class="asr-precheck-main">○ チェック範囲未設定</strong></div>`;
    if (result.kind === "legacy") return `<div class="asr-precheck hold"><strong class="asr-precheck-main">○ 旧履歴</strong></div>`;
    if (result.kind === "error") return `<div class="asr-precheck hold"><strong class="asr-precheck-main">○ チェックできません</strong></div>`;
    if (result.kind === "loading") return `<div class="asr-precheck loading"><strong class="asr-precheck-main">… チェック中</strong></div>`;

    const main = result.kind === "good"
      ? "✅ 問題なし"
      : result.kind === "hold"
        ? `○ 未分類 ${result.unknown || 0}件`
        : result.outsideAdded > 0 && result.issues === 0
          ? `⚠️ 追加予定が範囲外 ${result.outsideAdded}件`
          : `⚠️ 確認あり ${result.issues + (result.outsideAdded > 0 ? 1 : 0)}件`;

    return `
      <div class="asr-precheck ${result.kind}">
        <strong class="asr-precheck-main">${esc(main)}</strong>
        <span class="asr-mini">追加 <b>${result.added}</b></span>
        <span class="asr-mini">距離 <b>${result.spacing}</b></span>
        <span class="asr-mini">上限 <b>${result.limits}</b></span>
        <span class="asr-mini">重複 <b>${result.duplicates}</b></span>
        ${result.outsideAdded > 0 ? `<span class="asr-mini">範囲外追加 <b>${result.outsideAdded}</b></span>` : ""}
      </div>`;
  }

  function card(site) {
    const latest = site.latest;
    const result = precheckByUpload.get(latest.id);
    const historyLabel = site.siteId ? `${site.historyCount}件の提出履歴` : "旧履歴 · site未割当";
    return `
      <article class="asr-card ${esc(result?.kind || "")}">
        <div class="asr-title">
          <h4>${esc(site.title)}</h4>
          ${precheckHtml(site)}
          <div class="asr-meta">
            <span><strong>最新</strong> ${esc(fmtDate(latest.createdAt))}</span>
            <span><strong>履歴</strong> ${esc(historyLabel)}</span>
            <span><strong>POI</strong> ${latest.poiCount ?? "-"}件</span>
            <span><strong>作成者</strong> ${esc(latest.creatorDisplayName || "記録なし")}</span>
          </div>
          <div class="asr-site-id">${site.siteId ? `site_id ${esc(site.siteId)}` : "POI観測のない旧記録は従来照合で開きます"}</div>
        </div>
        <button type="button" class="asr-open" data-asr-open="${esc(latest.id)}">チェックを開く</button>
      </article>`;
  }

  function renderResults() {
    const host = body()?.querySelector("[data-asr-results]");
    if (!host || !payload) return;
    const sites = filteredSites();
    const visible = sites.slice(0, visibleCount);

    host.innerHTML = `
      ${visible.length ? `<div class="asr-list">${visible.map(card).join("")}</div>` : `<div class="asr-state">該当するサイトはありません。</div>`}
      ${visible.length < sites.length ? `<button type="button" class="asr-more" data-asr-more>さらに表示（${visible.length}/${sites.length}）</button>` : ""}`;

    host.querySelectorAll("[data-asr-open]").forEach(button => {
      button.addEventListener("click", () => window.AdminReviewWorkspace?.open?.(button.dataset.asrOpen));
    });
    host.querySelector("[data-asr-more]")?.addEventListener("click", () => {
      visibleCount += PAGE_SIZE;
      renderResults();
    });
  }

  function precheckStats(grouped) {
    let warn = 0, scope = 0, good = 0, hold = 0, pending = 0;
    grouped.forEach(site => {
      const result = precheckByUpload.get(site.latest.id);
      if (!result || result.kind === "loading") pending++;
      else if (result.kind === "warn") warn++;
      else if (result.kind === "scope") scope++;
      else if (result.kind === "good") good++;
      else if (result.kind === "hold") hold++;
    });
    return { warn, scope, good, hold, pending };
  }

  function renderStatsOnly() {
    const host = body()?.querySelector("[data-asr-stats]");
    if (!host) return;
    const grouped = groupedSitesRaw();
    const stable = grouped.filter(site => site.siteId).length;
    const withHistory = grouped.filter(site => site.historyCount > 1).length;
    const stats = precheckStats(grouped);
    host.innerHTML = `
      <span class="asr-pill"><strong>${grouped.length}</strong> サイト</span>
      <span class="asr-pill warn"><strong>${stats.warn}</strong> 要確認</span>
      <span class="asr-pill"><strong>${stats.scope}</strong> 範囲未設定</span>
      <span class="asr-pill good"><strong>${stats.good}</strong> 問題なし</span>
      ${stats.hold ? `<span class="asr-pill"><strong>${stats.hold}</strong> 保留</span>` : ""}
      ${stats.pending ? `<span class="asr-pill"><strong>${stats.pending}</strong> チェック中</span>` : ""}
      <span class="asr-pill"><strong>${withHistory}</strong> 履歴あり</span>
      <span class="asr-pill"><strong>${stable}</strong> site_id確定</span>`;
  }

  function render() {
    const el = body();
    if (!el || !payload) return;
    el.innerHTML = `
      <div class="asr-stats" data-asr-stats></div>
      <div class="asr-search-wrap"><input type="search" class="asr-search" data-asr-search placeholder="サイト名・作成者・site_idで検索" value="${esc(searchText)}" autocomplete="off" autocorrect="off" spellcheck="false"></div>
      <div data-asr-results></div>`;

    const input = el.querySelector("[data-asr-search]");
    if (input) {
      let composing = false;
      const applySearch = () => {
        searchText = input.value || "";
        visibleCount = PAGE_SIZE;
        renderResults();
      };
      input.addEventListener("compositionstart", () => { composing = true; });
      input.addEventListener("compositionend", () => { composing = false; applySearch(); });
      input.addEventListener("input", event => {
        if (composing || event.isComposing) return;
        applySearch();
      });
    }
    renderStatsOnly();
    renderResults();
  }

  function renderPrecheckProgress() {
    renderStatsOnly();
    renderResults();
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
      return { lat, lng };
    }).filter(Boolean);
  }

  function poiTypeFor(name, folder) {
    const text = compactNormalize(`${folder} ${name}`);
    if (/gym|ジム/.test(text)) return "gym";
    if (/power|パワースポット|パワスポ/.test(text)) return "powerSpot";
    if (/pok[eé]?stop|poke\s*stop|ポケスト/.test(text)) return "pokestop";
    return "unknown";
  }

  function categoryFor(name, folder) {
    const text = compactNormalize(`${folder} ${name}`);
    return /新規|追加希望|追加予定|追加候補|候補|new|planned|proposed|candidate|add/.test(text) ? "added" : "existing";
  }

  function isCircleContext(name, folder) {
    const text = compactNormalize(`${folder} ${name}`);
    return /(?:30|40|50)m|(?:３０|４０|５０)ｍ|円（|円\(|半径(?:30|40|50)/.test(text);
  }

  function isDummy(name, description) {
    const text = compactNormalize(`${name} ${description}`);
    return /ダミーポイント|レイヤー保持用|ここに追加/.test(text);
  }

  function parseKml(kmlText) {
    const doc = new DOMParser().parseFromString(kmlText, "application/xml");
    if (localNodes(doc, "parsererror").length) throw new Error("KMLを解析できませんでした。");
    const points = [];
    localNodes(doc, "Placemark").forEach(pm => {
      const name = directText(pm, "name") || "名称なし";
      const folder = folderNameFor(pm);
      const description = directText(pm, "description");
      if (isDummy(name, description) || isCircleContext(name, folder)) return;
      localNodes(pm, "Point").forEach(pointNode => {
        const coords = parseCoordinates(localNodes(pointNode, "coordinates")[0]?.textContent || "");
        if (!coords.length) return;
        points.push({
          name,
          lat: coords[0].lat,
          lng: coords[0].lng,
          added: categoryFor(name, folder) === "added",
          poiType: poiTypeFor(name, folder)
        });
      });
    });
    return points;
  }

  async function blobToKmlText(blob, fileName) {
    const lower = String(fileName || "").toLowerCase();
    if (lower.endsWith(".kml") || /(?:application|text)\/.*xml/i.test(blob.type || "")) return blob.text();
    if (!window.JSZip) throw new Error("KMZ展開ライブラリを読み込めませんでした。");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const entries = Object.values(zip.files).filter(entry => !entry.dir && /\.kml$/i.test(entry.name));
    if (!entries.length) throw new Error("KMZ内にKMLが見つかりません。");
    entries.sort((a, b) => {
      const aDoc = /(^|\/)doc\.kml$/i.test(a.name) ? 0 : 1;
      const bDoc = /(^|\/)doc\.kml$/i.test(b.name) ? 0 : 1;
      return aDoc - bDoc || a.name.localeCompare(b.name);
    });
    return entries[0].async("text");
  }

  function pointInPolygon(point, vertices) {
    if (!point || !Array.isArray(vertices) || vertices.length < 3) return false;
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = Number(vertices[i].lng), yi = Number(vertices[i].lat);
      const xj = Number(vertices[j].lng), yj = Number(vertices[j].lat);
      const crosses = ((yi > point.lat) !== (yj > point.lat)) &&
        (point.lng < (xj - xi) * (point.lat - yi) / ((yj - yi) || Number.EPSILON) + xi);
      if (crosses) inside = !inside;
    }
    return inside;
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

  function analyzePoints(points, scope) {
    const policy = currentPolicy();
    const vertices = scope?.vertices || [];
    const scoped = points.filter(point => pointInPolygon(point, vertices));
    const allAdded = points.filter(point => point.added);
    const added = scoped.filter(point => point.added);
    const outsideAdded = Math.max(0, allAdded.length - added.length);
    const counts = { totalAdded: added.length, pokestop: 0, gym: 0, powerSpot: 0, unknown: 0 };
    added.forEach(point => {
      if (point.poiType === "pokestop") counts.pokestop++;
      else if (point.poiType === "gym") counts.gym++;
      else if (point.poiType === "powerSpot") counts.powerSpot++;
      else counts.unknown++;
    });

    let spacing = 0;
    let duplicates = 0;
    for (let i = 0; i < scoped.length; i++) {
      for (let j = i + 1; j < scoped.length; j++) {
        const a = scoped[i], b = scoped[j];
        const distance = haversine(a, b);
        if (distance < 1) { duplicates++; continue; }
        if ((a.added || b.added) && distance < policy.spacingMeters) spacing++;
      }
    }

    const exceeded = (count, limit) => limit !== null && count > Number(limit);
    let limits = 0;
    if (exceeded(counts.totalAdded, policy.limits.total)) limits++;
    if (exceeded(counts.pokestop, policy.limits.pokestop)) limits++;
    if (exceeded(counts.gym, policy.limits.gym)) limits++;
    if (exceeded(counts.powerSpot, policy.limits.powerSpot)) limits++;

    const issues = spacing + duplicates + limits;
    const kind = issues > 0 || outsideAdded > 0 ? "warn" : counts.unknown > 0 ? "hold" : "good";
    return {
      kind,
      issues,
      spacing,
      duplicates,
      limits,
      added: counts.totalAdded,
      unknown: counts.unknown,
      outsideAdded,
      scoped: scoped.length,
      total: points.length
    };
  }

  async function mapLimit(items, limit, worker) {
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(items[index], index);
      }
    });
    await Promise.all(runners);
  }

  async function processBatch(sites, scopes, generation) {
    if (!sites.length || generation !== precheckGeneration) return;
    const data = await invoke("download_batch", { recordIds: sites.map(site => site.latest.id) });
    if (generation !== precheckGeneration) return;
    const itemMap = new Map((data.items || []).map(item => [item.recordId, item]));

    await mapLimit(sites, FETCH_CONCURRENCY, async site => {
      if (generation !== precheckGeneration) return;
      const scope = scopes.get(site.siteId);
      const item = itemMap.get(site.latest.id);
      if (!item?.signedUrl) {
        precheckByUpload.set(site.latest.id, { kind: "error" });
        return;
      }
      try {
        const response = await fetch(item.signedUrl, { cache: "no-store" });
        if (!response.ok) throw new Error("KMZ本体を取得できませんでした。");
        const blob = await response.blob();
        const kml = await blobToKmlText(blob, item.fileName || site.latest.displayFileName || "");
        const result = analyzePoints(parseKml(kml), scope);
        precheckByUpload.set(site.latest.id, result);
        writeCache(site, scope, result);
      } catch (error) {
        console.warn("site precheck failed", site.latest.id, error);
        precheckByUpload.set(site.latest.id, { kind: "error" });
      }
    });
  }

  function prepareImmediateStates(sites, scopes, force) {
    sites.forEach(site => {
      if (!site.siteId) {
        precheckByUpload.set(site.latest.id, { kind: "legacy" });
        return;
      }
      const scope = scopes.get(site.siteId);
      if (!scope) {
        precheckByUpload.set(site.latest.id, { kind: "scope" });
        return;
      }
      if (!force) {
        const cached = readCache(site, scope);
        if (cached) {
          precheckByUpload.set(site.latest.id, cached);
          return;
        }
      }
      precheckByUpload.set(site.latest.id, { kind: "loading" });
    });
  }

  async function startPrechecks(force = false) {
    const generation = ++precheckGeneration;
    if (precheckRunning) {
      // Older workers notice the generation change and stop updating the UI.
    }
    precheckRunning = true;
    const scopes = scopeMap();
    const sites = groupedSitesRaw();
    prepareImmediateStates(sites, scopes, force);
    renderPrecheckProgress();

    const pending = sites.filter(site => precheckByUpload.get(site.latest.id)?.kind === "loading");
    const visibleIds = new Set(filteredSites().slice(0, PAGE_SIZE).map(site => site.latest.id));
    pending.sort((a, b) => Number(visibleIds.has(b.latest.id)) - Number(visibleIds.has(a.latest.id)));

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      if (generation !== precheckGeneration) return;
      await processBatch(pending.slice(i, i + BATCH_SIZE), scopes, generation);
      if (generation !== precheckGeneration) return;
      renderPrecheckProgress();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (generation === precheckGeneration) {
      precheckRunning = false;
      renderPrecheckProgress();
    }
  }

  function renderState(message, error = false) {
    const el = body();
    if (!el) return;
    el.innerHTML = `<div class="asr-state" style="${error ? "color:#fecaca" : ""}">${esc(message)}</div>`;
  }

  async function load(force = false) {
    ensureUi();
    if (!window.CampsiteAdminAuth?.isUnlocked?.()) {
      renderState("🔒 管理者認証後に提出前チェックを表示します。");
      return;
    }
    if (loading) return;
    if (payload && !force) {
      render();
      startPrechecks(false);
      return;
    }

    loading = true;
    if (force) {
      precheckGeneration++;
      precheckByUpload.clear();
    }
    renderState("最新提出を整理しています…");
    try {
      payload = await invoke("list");
      visibleCount = PAGE_SIZE;
      render();
      startPrechecks(force);
    } catch (error) {
      console.warn("site precheck list load error", error);
      renderState(error?.message || "提出前チェック一覧を取得できませんでした。", true);
    } finally {
      loading = false;
    }
  }

  function installAuthBridge() {
    const existing = window.AdminKmzBrowser;
    if (!existing || existing.__siteReviewWrapped) return;
    const wrapped = {
      ...existing,
      __siteReviewWrapped: true,
      onAuthenticated: async () => {
        const tasks = [];
        if (typeof existing.onAuthenticated === "function") tasks.push(existing.onAuthenticated());
        tasks.push(load(true));
        await Promise.allSettled(tasks);
      }
    };
    window.AdminKmzBrowser = Object.freeze(wrapped);
  }

  function setup() {
    ensureStyles();
    ensureUi();
    installAuthBridge();
    if (window.CampsiteAdminAuth?.isUnlocked?.()) load(false);
    else renderState("🔒 管理者認証後に提出前チェックを表示します。");
  }

  window.AdminSiteReviewList = Object.freeze({
    reload: () => load(true),
    onAuthenticated: () => load(true)
  });

  setup();
})();