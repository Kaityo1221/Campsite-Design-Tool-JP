/* ======================================================
   管理者専用: 提出KMZブラウザ v2
   - CampsiteAdminAuth の管理者セッション必須
   - Supabase admin-kmz-access 経由
   - Storageは非公開、90秒署名URLのみ
====================================================== */

(function () {
  "use strict";

  const FUNCTION_NAME = "admin-kmz-access";
  const PAGE_SIZE = 24;

  let payload = null;
  let viewMode = "unique";
  let actionFilter = "all";
  let searchText = "";
  let excludeCurrentDevice = true;
  let visibleCount = PAGE_SIZE;
  let loading = false;

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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

  function fmtBytes(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  function normalize(value) {
    return String(value || "").normalize("NFKC").toLowerCase().trim();
  }

  function actionLabel(type) {
    return type === "distance_check" ? "距離チェック" : "KMZ生成";
  }

  function ensureStyles() {
    if (document.getElementById("adminKmzBrowserV2Styles")) return;

    const style = document.createElement("style");
    style.id = "adminKmzBrowserV2Styles";
    style.textContent = `
      .admin-kmz-v2{position:relative;overflow:hidden;margin-bottom:20px;border:1px solid rgba(56,189,248,.28);border-radius:22px;background:radial-gradient(circle at 95% 0%,rgba(14,165,233,.18),transparent 34%),radial-gradient(circle at 5% 100%,rgba(99,102,241,.12),transparent 36%),linear-gradient(145deg,rgba(15,23,42,.98),rgba(2,6,23,.98));box-shadow:0 22px 60px rgba(2,6,23,.34);color:#e2e8f0}
      .admin-kmz-v2::before{content:"";position:absolute;inset:0 0 auto;height:1px;background:linear-gradient(90deg,transparent,rgba(125,211,252,.75),transparent)}
      .ak-hero{display:flex;justify-content:space-between;gap:14px;padding:22px 22px 15px}.ak-eyebrow{margin:0 0 6px;color:#7dd3fc;font-size:10px;font-weight:900;letter-spacing:.16em}.ak-hero h3{margin:0;color:#f8fafc;font-size:clamp(21px,5vw,29px)}.ak-sub{margin:7px 0 0;max-width:650px;color:#94a3b8;font-size:11px;line-height:1.7}.ak-refresh{width:44px;height:44px;border:1px solid rgba(125,211,252,.28);border-radius:13px;background:rgba(14,165,233,.1);color:#e0f2fe;font-weight:900;cursor:pointer}.ak-refresh:disabled{opacity:.5}
      .ak-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:0 22px 14px}.ak-stat{padding:13px 11px;border:1px solid rgba(148,163,184,.15);border-radius:15px;background:rgba(15,23,42,.62)}.ak-stat strong{display:block;color:#f8fafc;font-size:clamp(20px,5vw,28px);line-height:1}.ak-stat span{display:block;margin-top:5px;color:#94a3b8;font-size:9px;font-weight:900}.ak-stat.blue strong{color:#7dd3fc}.ak-stat.amber strong{color:#fbbf24}.ak-stat.violet strong{color:#c4b5fd}
      .ak-pills{display:flex;flex-wrap:wrap;gap:6px;padding:0 22px 13px}.ak-pill{padding:5px 8px;border:1px solid rgba(148,163,184,.17);border-radius:999px;background:rgba(30,41,59,.6);color:#cbd5e1;font-size:9px;font-weight:900}
      .ak-note{margin:0 22px 13px;padding:10px 12px;border-left:3px solid rgba(56,189,248,.55);border-radius:9px;background:rgba(14,165,233,.07);color:#94a3b8;font-size:10px;line-height:1.65}
      .ak-own{display:grid;grid-template-columns:auto 1fr;gap:2px 9px;align-items:center;margin:0 22px 13px;padding:10px 12px;border:1px solid rgba(167,139,250,.22);border-radius:13px;background:rgba(124,58,237,.07);cursor:pointer}.ak-own input{grid-row:1/span 2;width:17px;height:17px;accent-color:#38bdf8}.ak-own span{font-size:11px;font-weight:900;color:#ddd6fe}.ak-own small{font-size:9px;color:#8191a8}
      .ak-controls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;padding:0 22px 12px}.ak-search,.ak-select{box-sizing:border-box;padding:10px 12px;border:1px solid rgba(148,163,184,.22);border-radius:12px;background:#0b1220;color:#f8fafc}.ak-search{width:100%;font-size:14px}.ak-select{font-weight:800}
      .ak-tabs{display:flex;gap:5px;margin:0 22px 13px;padding:4px;border:1px solid rgba(148,163,184,.15);border-radius:13px;background:rgba(2,6,23,.55)}.ak-tab{flex:1;padding:9px;border:0;border-radius:9px;background:transparent;color:#94a3b8;font-size:10px;font-weight:900;cursor:pointer}.ak-tab.active{background:linear-gradient(135deg,rgba(14,165,233,.2),rgba(99,102,241,.15));color:#e0f2fe;box-shadow:inset 0 0 0 1px rgba(125,211,252,.2)}
      .ak-wrap{padding:0 22px 22px}.ak-head{display:flex;justify-content:space-between;gap:8px;margin-bottom:9px;color:#94a3b8;font-size:10px}.ak-list{display:grid;gap:9px}.ak-card{position:relative;overflow:hidden;padding:14px;border:1px solid rgba(148,163,184,.15);border-radius:16px;background:linear-gradient(145deg,rgba(30,41,59,.72),rgba(15,23,42,.72))}.ak-card::before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:rgba(56,189,248,.6)}.ak-card.dup::before{background:rgba(251,191,36,.7)}
      .ak-card-top{display:flex;justify-content:space-between;gap:10px}.ak-title{min-width:0}.ak-title h4{margin:0;color:#f8fafc;font-size:14px;overflow-wrap:anywhere}.ak-filename{margin-top:4px;color:#64748b;font-size:9px;overflow-wrap:anywhere}.ak-badges{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px}.ak-badge{padding:4px 6px;border-radius:999px;background:rgba(14,165,233,.12);color:#bae6fd;font-size:8px;font-weight:900;white-space:nowrap}.ak-badge.dup{background:rgba(245,158,11,.12);color:#fde68a}.ak-badge.hist{background:rgba(99,102,241,.13);color:#c7d2fe}
      .ak-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 12px;margin-top:12px}.ak-meta div{color:#94a3b8;font-size:9px;line-height:1.5}.ak-meta strong{color:#cbd5e1}.ak-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px}.ak-btn{min-height:39px;padding:8px;border:1px solid rgba(125,211,252,.24);border-radius:11px;background:rgba(14,165,233,.08);color:#e0f2fe;font-size:10px;font-weight:900;cursor:pointer}.ak-btn.review{border-color:rgba(167,139,250,.3);background:rgba(124,58,237,.1);color:#ede9fe}.ak-btn:disabled{opacity:.5}.ak-more{width:100%;margin-top:10px;padding:9px;border:1px solid rgba(125,211,252,.25);border-radius:10px;background:rgba(14,165,233,.08);color:#e0f2fe;font-weight:900}.ak-state{margin:0 22px 22px;padding:26px 15px;border:1px dashed rgba(148,163,184,.22);border-radius:15px;text-align:center;color:#94a3b8;font-size:11px;line-height:1.7}.ak-login{margin-top:10px;padding:9px 13px;border:1px solid rgba(125,211,252,.3);border-radius:10px;background:rgba(14,165,233,.1);color:#e0f2fe;font-weight:900}
      @media(max-width:680px){.ak-hero,.ak-stats,.ak-pills,.ak-controls,.ak-wrap{padding-left:14px;padding-right:14px}.ak-note,.ak-own,.ak-tabs,.ak-state{margin-left:14px;margin-right:14px}.ak-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.ak-controls{grid-template-columns:1fr}.ak-card-top{display:block}.ak-badges{justify-content:flex-start;margin-top:8px}.ak-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function getHostPanel() {
    return document.getElementById("admin")?.querySelector(".panel") || null;
  }

  function ensureUi() {
    const host = getHostPanel();
    if (!host) return null;

    let root = document.getElementById("adminKmzBrowserV2");
    if (root) return root;

    root = document.createElement("section");
    root.id = "adminKmzBrowserV2";
    root.className = "admin-kmz-v2";
    root.innerHTML = `
      <div class="ak-hero">
        <div>
          <p class="ak-eyebrow">ADMIN · SECURE ARCHIVE</p>
          <h3>📦 提出KMZブラウザ</h3>
          <p class="ak-sub">Supabaseへ匿名送信されたKMZ生成・距離チェック履歴を、管理者セッションで安全に確認します。</p>
        </div>
        <button class="ak-refresh" type="button" data-ak-refresh>↻</button>
      </div>
      <div id="adminKmzBrowserV2Body"></div>
    `;
    host.prepend(root);
    root.querySelector("[data-ak-refresh]")?.addEventListener("click", () => load(true));
    return root;
  }

  function body() {
    return document.getElementById("adminKmzBrowserV2Body");
  }

  function renderLocked() {
    const el = body();
    if (!el) return;
    el.innerHTML = `<div class="ak-state">🔒 管理者セッションが必要です。<br><button type="button" class="ak-login" data-ak-login>管理者認証</button></div>`;
    el.querySelector("[data-ak-login]")?.addEventListener("click", () => window.CampsiteAdminAuth?.openAdminEntry?.());
  }

  function renderState(text, error = false) {
    const el = body();
    if (!el) return;
    el.innerHTML = `<div class="ak-state" style="${error ? "color:#fecaca" : ""}">${esc(text)}</div>`;
  }

  function filteredRecords() {
    if (!payload) return [];
    const list = viewMode === "history" ? payload.historyRecords || [] : payload.uniqueRecords || [];
    const q = normalize(searchText);

    return list.filter(item => {
      if (excludeCurrentDevice) {
        if (viewMode === "unique") {
          if (item.hasOtherDeviceActivity !== true) return false;
        } else if (item.isCurrentDevice === true) {
          return false;
        }
      }

      if (actionFilter !== "all") {
        const types = Array.isArray(item.actionTypes) ? item.actionTypes : [item.actionType];
        if (!types.includes(actionFilter)) return false;
      }

      if (!q) return true;
      return normalize([
        item.parkName,
        item.originalFileName,
        item.displayFileName,
        item.deviceLabel,
        actionLabel(item.actionType)
      ].join(" ")).includes(q);
    });
  }

  function scoreText(item) {
    const score = Number(item.campsiteScore);
    const rank = item.campsiteRank || "";
    if (Number.isFinite(score) && rank) return `${score} / ${rank}`;
    if (Number.isFinite(score)) return String(score);
    return rank || "-";
  }

  function card(item) {
    const title = item.parkName && item.parkName !== "公園名不明"
      ? item.parkName
      : item.displayFileName || item.originalFileName || "名称不明";
    const history = Number(item.historyCount) || 1;
    const dups = Number(item.duplicateCount) || 0;
    const isDup = item.isDuplicate === true;
    const device = viewMode === "unique"
      ? item.hasCurrentDeviceActivity && item.hasOtherDeviceActivity
        ? "この端末＋他端末"
        : item.hasCurrentDeviceActivity ? "この端末" : item.deviceLabel || "端末不明"
      : item.deviceLabel || "端末不明";

    const badges = [`<span class="ak-badge">${item.actionType === "distance_check" ? "📏" : "🗺️"} ${actionLabel(item.actionType)}</span>`];
    if (viewMode === "unique" && history > 1) badges.push(`<span class="ak-badge hist">履歴 ${history}回</span>`);
    if ((viewMode === "unique" && dups > 0) || isDup) badges.push(`<span class="ak-badge dup">${viewMode === "unique" ? `重複 ${dups}回` : "重複履歴"}</span>`);

    return `
      <article class="ak-card ${isDup ? "dup" : ""}">
        <div class="ak-card-top">
          <div class="ak-title"><h4>${esc(title)}</h4><div class="ak-filename">${esc(item.displayFileName || item.originalFileName || "-")}</div></div>
          <div class="ak-badges">${badges.join("")}</div>
        </div>
        <div class="ak-meta">
          <div><strong>最終利用</strong><br>${esc(fmtDate(item.lastActivityAt || item.createdAt))}</div>
          <div><strong>匿名端末</strong><br>${esc(device)}</div>
          <div><strong>POI</strong><br>${item.poiCount ?? "-"}件（追加 ${item.addedPoiCount ?? "-"}）</div>
          <div><strong>警告 / 評価</strong><br>${item.warningCount ?? "-"}件 / ${esc(scoreText(item))}</div>
          <div><strong>サイズ</strong><br>${esc(fmtBytes(item.fileSizeBytes))}</div>
          <div><strong>保存期限</strong><br>${esc(fmtDate(item.expiresAt))}</div>
        </div>
        <div class="ak-actions">
          <button type="button" class="ak-btn" data-ak-download="${esc(item.id)}">⬇ KMZを取得</button>
          <button type="button" class="ak-btn review" data-ak-review="${esc(item.id)}">🔎 このKMZをレビュー</button>
        </div>
      </article>
    `;
  }

  function render() {
    const el = body();
    if (!el || !payload) return;

    const s = payload.summary || {};
    const other = excludeCurrentDevice && Number(s.currentDeviceHistoryCount) > 0;
    const values = {
      unique: other ? s.otherUniqueFiles : s.uniqueFiles,
      history: other ? s.otherDeviceHistoryCount : s.totalHistory,
      dup: other ? s.otherDuplicateHistory : s.duplicateHistory,
      devices: other ? s.otherDistinctDevices : s.distinctDevices,
      today: other ? s.otherTodayCount : s.todayCount,
      week: other ? s.otherLast7DaysCount : s.last7DaysCount,
      kmz: other ? s.otherKmzGenerateCount : s.kmzGenerateCount,
      distance: other ? s.otherDistanceCheckCount : s.distanceCheckCount
    };

    const filtered = filteredRecords();
    const visible = filtered.slice(0, visibleCount);

    el.innerHTML = `
      <div class="ak-stats">
        <div class="ak-stat blue"><strong>${Number(values.unique)||0}</strong><span>${other ? "他端末の実ファイル" : "実ファイル"}</span></div>
        <div class="ak-stat"><strong>${Number(values.history)||0}</strong><span>${other ? "他端末の履歴" : "アップロード履歴"}</span></div>
        <div class="ak-stat amber"><strong>${Number(values.dup)||0}</strong><span>重複履歴</span></div>
        <div class="ak-stat violet"><strong>${Number(values.devices)||0}</strong><span>匿名端末ID</span></div>
      </div>
      <div class="ak-pills">
        <span class="ak-pill">今日 ${Number(values.today)||0}件</span>
        <span class="ak-pill">直近7日 ${Number(values.week)||0}件</span>
        <span class="ak-pill">KMZ生成 ${Number(values.kmz)||0}件</span>
        <span class="ak-pill">距離チェック ${Number(values.distance)||0}件</span>
        ${Number(s.currentDeviceHistoryCount)>0 ? `<span class="ak-pill">この端末 ${Number(s.currentDeviceHistoryCount)}件</span>` : ""}
      </div>
      <div class="ak-note">「匿名端末ID」は人数ではありません。複数端末やブラウザ保存状態で増減します。「実ファイル」は同一内容を1件にまとめた数です。</div>
      <label class="ak-own"><input type="checkbox" data-ak-own ${excludeCurrentDevice ? "checked" : ""}><span>🧪 この端末の履歴を除く</span><small>今使っているブラウザのテスト履歴を除外</small></label>
      <div class="ak-controls">
        <input class="ak-search" type="search" data-ak-search placeholder="拠点名・ファイル名・端末で検索" value="${esc(searchText)}">
        <select class="ak-select" data-ak-filter><option value="all">すべて</option><option value="kmz_generate" ${actionFilter==="kmz_generate"?"selected":""}>KMZ生成</option><option value="distance_check" ${actionFilter==="distance_check"?"selected":""}>距離チェック</option></select>
      </div>
      <div class="ak-tabs"><button class="ak-tab ${viewMode==="unique"?"active":""}" data-ak-mode="unique">実ファイル ${Number(values.unique)||0}</button><button class="ak-tab ${viewMode==="history"?"active":""}" data-ak-mode="history">全履歴 ${Number(values.history)||0}</button></div>
      <div class="ak-wrap">
        <div class="ak-head"><strong>${viewMode==="unique"?"実ファイル":"全履歴"}</strong><span>${filtered.length}件中 ${visible.length}件表示</span></div>
        <div class="ak-list">${visible.length ? visible.map(card).join("") : `<div class="ak-state" style="margin:0">該当するKMZはありません。</div>`}</div>
        ${visible.length < filtered.length ? `<button type="button" class="ak-more" data-ak-more>さらに表示</button>` : ""}
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    const el = body();
    if (!el) return;

    el.querySelector("[data-ak-own]")?.addEventListener("change", e => {
      excludeCurrentDevice = e.target.checked === true;
      visibleCount = PAGE_SIZE;
      render();
    });
    el.querySelector("[data-ak-search]")?.addEventListener("input", e => {
      searchText = e.target.value || "";
      visibleCount = PAGE_SIZE;
      render();
      requestAnimationFrame(() => {
        const input = body()?.querySelector("[data-ak-search]");
        input?.focus();
        input?.setSelectionRange(searchText.length, searchText.length);
      });
    });
    el.querySelector("[data-ak-filter]")?.addEventListener("change", e => {
      actionFilter = e.target.value || "all";
      visibleCount = PAGE_SIZE;
      render();
    });
    el.querySelectorAll("[data-ak-mode]").forEach(btn => btn.addEventListener("click", () => {
      viewMode = btn.dataset.akMode === "history" ? "history" : "unique";
      visibleCount = PAGE_SIZE;
      render();
    }));
    el.querySelector("[data-ak-more]")?.addEventListener("click", () => {
      visibleCount += PAGE_SIZE;
      render();
    });
    el.querySelectorAll("[data-ak-download]").forEach(btn => btn.addEventListener("click", () => download(btn.dataset.akDownload, btn)));
    el.querySelectorAll("[data-ak-review]").forEach(btn => btn.addEventListener("click", () => review(btn.dataset.akReview, btn)));
  }

  async function invoke(bodyData) {
    if (!window.campsiteSupabase?.functions) throw new Error("Supabaseクライアントを初期化できませんでした。");
    const sessionToken = window.CampsiteAdminAuth?.getSessionToken?.() || "";
    if (!sessionToken) throw new Error("管理者認証が必要です。");

    const { data, error } = await window.campsiteSupabase.functions.invoke(FUNCTION_NAME, {
      body: { ...bodyData, sessionToken }
    });

    if (error) {
      let message = error.message || "管理者KMZ処理に失敗しました。";
      try {
        const details = error.context && typeof error.context.json === "function" ? await error.context.json() : null;
        if (details?.error) message = details.error;
      } catch (_) {}
      throw new Error(message);
    }
    if (!data?.success) throw new Error(data?.error || "管理者KMZ処理に失敗しました。");
    return data;
  }

  async function load(force = false) {
    ensureUi();
    if (!window.CampsiteAdminAuth?.isUnlocked?.()) {
      renderLocked();
      return;
    }
    if (loading) return;
    if (payload && !force) {
      render();
      return;
    }

    loading = true;
    renderState("📡 Supabaseから提出履歴を読み込んでいます…");
    try {
      payload = await invoke({
        action: "list",
        currentDeviceId: localStorage.getItem("campsiteUserId") || ""
      });
      visibleCount = PAGE_SIZE;
      render();
    } catch (e) {
      console.warn("管理者KMZ一覧取得エラー", e);
      if (/認証|セッション/.test(e?.message || "")) {
        window.CampsiteAdminAuth?.clearSession?.();
        renderLocked();
      } else {
        renderState(e?.message || "一覧を取得できませんでした。", true);
      }
    } finally {
      loading = false;
    }
  }

  async function fetchBlob(recordId) {
    const info = await invoke({ action: "download", recordId });
    const response = await fetch(info.signedUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("KMZ本体を取得できませんでした。");
    return { blob: await response.blob(), fileName: info.fileName || "campsite.kmz" };
  }

  async function download(recordId, button) {
    const old = button.textContent;
    button.disabled = true;
    button.textContent = "取得中…";
    try {
      const { blob, fileName } = await fetchBlob(recordId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      alert(e?.message || "KMZを取得できませんでした。");
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  }

  async function review(recordId, button) {
    const old = button.textContent;
    button.disabled = true;
    button.textContent = "読込中…";
    try {
      const { blob, fileName } = await fetchBlob(recordId);
      const input = document.getElementById("adminReviewFile");
      if (!input) throw new Error("管理者レビュー欄が見つかりません。");

      const file = new File([blob], fileName, { type: blob.type || "application/vnd.google-earth.kmz" });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.scrollIntoView({ behavior: "smooth", block: "center" });

      if (typeof window.runAdminDashboardReview !== "function") throw new Error("管理者レビュー機能を起動できません。");
      await window.runAdminDashboardReview();
    } catch (e) {
      alert(e?.message || "KMZをレビューへ読み込めませんでした。");
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  }

  function setup() {
    ensureStyles();
    ensureUi();
    if (window.CampsiteAdminAuth?.isUnlocked?.()) load(false);
    else renderLocked();
  }

  window.AdminKmzBrowser = Object.freeze({
    onAuthenticated: () => {
      payload = null;
      return load(true);
    },
    reload: () => load(true),
    open: () => load(false)
  });

  setup();
})();
