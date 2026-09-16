/* ======================================================
   Phase 3: Site-centered admin review queue
   - Groups KMZ history by stable site_id
   - Keeps legacy/unassigned records accessible
   - Sits above the raw KMZ archive
====================================================== */
(function () {
  "use strict";

  if (window.AdminSiteReviewList) return;

  const FUNCTION_NAME = "admin-kmz-access";
  const PAGE_SIZE = 24;
  let payload = null;
  let loading = false;
  let searchText = "";
  let visibleCount = PAGE_SIZE;

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

  function ensureStyles() {
    if (document.getElementById("adminSiteReviewListStyles")) return;
    const style = document.createElement("style");
    style.id = "adminSiteReviewListStyles";
    style.textContent = `
      .admin-site-review{position:relative;overflow:hidden;margin-bottom:18px;border:1px solid rgba(99,102,241,.3);border-radius:22px;background:radial-gradient(circle at 100% 0%,rgba(99,102,241,.18),transparent 36%),linear-gradient(145deg,rgba(15,23,42,.98),rgba(2,6,23,.98));color:#e2e8f0;box-shadow:0 22px 60px rgba(2,6,23,.32)}
      .asr-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px 20px 12px}.asr-eyebrow{margin:0 0 5px;color:#a5b4fc;font-size:9px;font-weight:900;letter-spacing:.16em}.asr-head h3{margin:0;color:#f8fafc;font-size:clamp(20px,5vw,28px)}.asr-head p{margin:6px 0 0;max-width:650px;color:#94a3b8;font-size:10px;line-height:1.65}.asr-refresh{width:44px;height:44px;border:1px solid rgba(165,180,252,.25);border-radius:12px;background:rgba(99,102,241,.09);color:#e0e7ff;font-size:17px;font-weight:900;cursor:pointer}
      .asr-stats{display:flex;flex-wrap:wrap;gap:6px;padding:0 20px 11px}.asr-pill{padding:5px 8px;border:1px solid rgba(148,163,184,.14);border-radius:999px;background:rgba(30,41,59,.58);color:#cbd5e1;font-size:9px;font-weight:900}.asr-pill strong{color:#f8fafc}.asr-search-wrap{padding:0 20px 12px}.asr-search{box-sizing:border-box;width:100%;padding:10px 12px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:#0b1220;color:#f8fafc;font-size:13px}
      .asr-list{display:grid;gap:9px;padding:0 20px 20px}.asr-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px 14px;border:1px solid rgba(148,163,184,.14);border-radius:15px;background:linear-gradient(145deg,rgba(30,41,59,.72),rgba(15,23,42,.72))}.asr-title{min-width:0}.asr-title h4{margin:0;color:#f8fafc;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.asr-meta{display:flex;flex-wrap:wrap;gap:5px 10px;margin-top:6px;color:#94a3b8;font-size:9px}.asr-meta strong{color:#cbd5e1}.asr-site-id{margin-top:5px;color:#475569;font-size:8px}.asr-open{min-width:132px;min-height:42px;padding:8px 10px;border:1px solid rgba(129,140,248,.32);border-radius:11px;background:rgba(79,70,229,.12);color:#eef2ff;font-size:10px;font-weight:900;cursor:pointer}.asr-open:hover{background:rgba(79,70,229,.2)}
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
        <div><p class="asr-eyebrow">ADMIN · REVIEW QUEUE</p><h3>🗂️ キャンプサイト審査</h3><p>KMZファイルではなく、同じサイトの履歴をひとまとめにして審査します。サイトを開くと「今回・前回・さらに前」を同じ地図位置で切り替えられます。</p></div>
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

  async function invoke() {
    if (!window.campsiteSupabase?.functions) throw new Error("Supabase client unavailable");
    const sessionToken = window.CampsiteAdminAuth?.getSessionToken?.() || "";
    if (!sessionToken) throw new Error("管理者認証が必要です。");
    const { data, error } = await window.campsiteSupabase.functions.invoke(FUNCTION_NAME, {
      body: {
        action: "list",
        currentDeviceId: localStorage.getItem("campsiteUserId") || "",
        sessionToken
      }
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "審査対象を取得できませんでした。");
    return data;
  }

  function groupedSites() {
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
    }).sort((a, b) => new Date(b.latest.createdAt || 0).getTime() - new Date(a.latest.createdAt || 0).getTime());
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

  function card(site) {
    const latest = site.latest;
    const historyLabel = site.siteId
      ? `${site.historyCount}件の提出履歴`
      : "旧履歴 · site未割当";
    return `
      <article class="asr-card">
        <div class="asr-title">
          <h4>${esc(site.title)}</h4>
          <div class="asr-meta">
            <span><strong>最新</strong> ${esc(fmtDate(latest.createdAt))}</span>
            <span><strong>履歴</strong> ${esc(historyLabel)}</span>
            <span><strong>POI</strong> ${latest.poiCount ?? "-"}件</span>
            <span><strong>作成者</strong> ${esc(latest.creatorDisplayName || "記録なし")}</span>
          </div>
          <div class="asr-site-id">${site.siteId ? `site_id ${esc(site.siteId)}` : "POI観測のない旧記録は従来照合で開きます"}</div>
        </div>
        <button type="button" class="asr-open" data-asr-open="${esc(latest.id)}">審査を開く</button>
      </article>`;
  }

  function renderResults() {
    const host = body()?.querySelector("[data-asr-results]");
    if (!host || !payload) return;
    const sites = filteredSites();
    const visible = sites.slice(0, visibleCount);

    host.innerHTML = `
      ${visible.length ? `<div class="asr-list">${visible.map(card).join("")}</div>` : `<div class="asr-state">該当する審査サイトはありません。</div>`}
      ${visible.length < sites.length ? `<button type="button" class="asr-more" data-asr-more>さらに表示（${visible.length}/${sites.length}）</button>` : ""}`;

    host.querySelectorAll("[data-asr-open]").forEach(button => {
      button.addEventListener("click", () => window.AdminReviewWorkspace?.open?.(button.dataset.asrOpen));
    });
    host.querySelector("[data-asr-more]")?.addEventListener("click", () => {
      visibleCount += PAGE_SIZE;
      renderResults();
    });
  }

  function render() {
    const el = body();
    if (!el || !payload) return;
    const grouped = groupedSites();
    const stable = grouped.filter(site => site.siteId).length;
    const legacy = grouped.length - stable;
    const withHistory = grouped.filter(site => site.historyCount > 1).length;

    el.innerHTML = `
      <div class="asr-stats">
        <span class="asr-pill"><strong>${grouped.length}</strong> 審査サイト</span>
        <span class="asr-pill"><strong>${withHistory}</strong> 履歴あり</span>
        <span class="asr-pill"><strong>${stable}</strong> site_id確定</span>
        ${legacy ? `<span class="asr-pill"><strong>${legacy}</strong> 旧履歴</span>` : ""}
      </div>
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

      input.addEventListener("compositionstart", () => {
        composing = true;
      });
      input.addEventListener("compositionend", () => {
        composing = false;
        applySearch();
      });
      input.addEventListener("input", event => {
        if (composing || event.isComposing) return;
        applySearch();
      });
    }

    renderResults();
  }

  function renderState(message, error = false) {
    const el = body();
    if (!el) return;
    el.innerHTML = `<div class="asr-state" style="${error ? "color:#fecaca" : ""}">${esc(message)}</div>`;
  }

  async function load(force = false) {
    ensureUi();
    if (!window.CampsiteAdminAuth?.isUnlocked?.()) {
      renderState("🔒 管理者認証後に審査サイトを表示します。");
      return;
    }
    if (loading) return;
    if (payload && !force) {
      render();
      return;
    }

    loading = true;
    renderState("審査サイトを整理しています…");
    try {
      payload = await invoke();
      visibleCount = PAGE_SIZE;
      render();
    } catch (error) {
      console.warn("site review list load error", error);
      renderState(error?.message || "審査サイトを取得できませんでした。", true);
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
    else renderState("🔒 管理者認証後に審査サイトを表示します。");
  }

  window.AdminSiteReviewList = Object.freeze({
    reload: () => load(true),
    onAuthenticated: () => load(true)
  });

  setup();
})();
