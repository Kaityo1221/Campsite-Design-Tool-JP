/* ======================================================
   管理者専用: Supabase 提出KMZブラウザ

   - 管理者ログイン後だけ一覧取得
   - 初期表示は同一ファイルをまとめた「実ファイル」
   - 全履歴へ切替可能
   - Storageは公開せず、Edge Functionから短時間URLを取得
   - KMZ取得 / そのまま管理者レビューへ送る
====================================================== */

(function () {
  "use strict";

  const FUNCTION_NAME = "admin-kmz-browser";
  const PAGE_SIZE = 24;

  let adminCode = "";
  let payload = null;
  let viewMode = "unique";
  let actionFilter = "all";
  let searchText = "";
  let excludeCurrentDevice = true;
  let visibleCount = PAGE_SIZE;
  let isLoading = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(value) {
    if (!value) return "日時不明";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "日時不明";

    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function formatBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function normalizeSearch(value) {
    return String(value || "").normalize("NFKC").toLowerCase().trim();
  }

  function getActionLabel(actionType) {
    return actionType === "distance_check" ? "距離チェック" : "KMZ生成";
  }

  function getActionIcon(actionType) {
    return actionType === "distance_check" ? "📏" : "🗺️";
  }

  function ensureStyles() {
    if (document.getElementById("adminKmzBrowserStyles")) return;

    const style = document.createElement("style");
    style.id = "adminKmzBrowserStyles";
    style.textContent = `
      .admin-kmz-browser {
        position: relative;
        overflow: hidden;
        margin-bottom: 20px;
        padding: 0;
        border: 1px solid rgba(56,189,248,.28);
        border-radius: 22px;
        background:
          radial-gradient(circle at 95% 0%, rgba(14,165,233,.18), transparent 33%),
          radial-gradient(circle at 5% 100%, rgba(99,102,241,.12), transparent 36%),
          linear-gradient(145deg, rgba(15,23,42,.98), rgba(2,6,23,.98));
        box-shadow: 0 22px 60px rgba(2,6,23,.34);
        color: #e2e8f0;
      }

      .admin-kmz-browser::before {
        content: "";
        position: absolute;
        inset: 0 0 auto 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(125,211,252,.7), transparent);
      }

      .admin-kmz-browser-hero {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
        padding: 22px 22px 16px;
      }

      .admin-kmz-browser-eyebrow {
        margin: 0 0 7px;
        color: #7dd3fc;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .14em;
      }

      .admin-kmz-browser h3 {
        margin: 0;
        color: #f8fafc;
        font-size: clamp(20px, 5vw, 28px);
        letter-spacing: -.02em;
      }

      .admin-kmz-browser-sub {
        margin: 8px 0 0;
        max-width: 640px;
        color: #94a3b8;
        font-size: 12px;
        line-height: 1.75;
      }

      .admin-kmz-browser-refresh {
        flex: 0 0 auto;
        min-width: 44px;
        height: 44px;
        padding: 0 12px;
        border: 1px solid rgba(125,211,252,.3);
        border-radius: 13px;
        background: rgba(14,165,233,.1);
        color: #e0f2fe;
        font-weight: 900;
        cursor: pointer;
      }

      .admin-kmz-browser-refresh:disabled {
        opacity: .55;
        cursor: wait;
      }

      .admin-kmz-summary {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 9px;
        padding: 0 22px 16px;
      }

      .admin-kmz-stat {
        min-width: 0;
        padding: 13px 12px;
        border: 1px solid rgba(148,163,184,.16);
        border-radius: 15px;
        background: rgba(15,23,42,.64);
      }

      .admin-kmz-stat strong {
        display: block;
        color: #f8fafc;
        font-size: clamp(20px, 5vw, 28px);
        line-height: 1.05;
      }

      .admin-kmz-stat span {
        display: block;
        margin-top: 5px;
        color: #94a3b8;
        font-size: 10px;
        font-weight: 800;
      }

      .admin-kmz-stat.primary strong { color: #7dd3fc; }
      .admin-kmz-stat.duplicate strong { color: #fbbf24; }
      .admin-kmz-stat.device strong { color: #c4b5fd; }

      .admin-kmz-activity-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        padding: 0 22px 16px;
      }

      .admin-kmz-activity-pill {
        padding: 5px 9px;
        border: 1px solid rgba(148,163,184,.18);
        border-radius: 999px;
        background: rgba(30,41,59,.6);
        color: #cbd5e1;
        font-size: 10px;
        font-weight: 800;
      }

      .admin-kmz-browser-note {
        margin: 0 22px 16px;
        padding: 10px 12px;
        border-left: 3px solid rgba(56,189,248,.55);
        border-radius: 9px;
        background: rgba(14,165,233,.07);
        color: #94a3b8;
        font-size: 11px;
        line-height: 1.65;
      }

      .admin-kmz-current-device-toggle {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 2px 9px;
        align-items: center;
        margin: 0 22px 14px;
        padding: 11px 13px;
        border: 1px solid rgba(167,139,250,.24);
        border-radius: 13px;
        background: rgba(124,58,237,.07);
        color: #ddd6fe;
        cursor: pointer;
      }

      .admin-kmz-current-device-toggle input {
        grid-row: 1 / span 2;
        width: 17px;
        height: 17px;
        accent-color: #38bdf8;
      }

      .admin-kmz-current-device-toggle span {
        font-size: 12px;
        font-weight: 900;
      }

      .admin-kmz-current-device-toggle small {
        color: #8b9bb2;
        font-size: 9px;
      }

      .admin-kmz-activity-pill.current-device {
        border-color: rgba(167,139,250,.26);
        color: #ddd6fe;
      }

      .admin-kmz-controls {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        padding: 0 22px 14px;
      }

      .admin-kmz-search {
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        padding: 11px 13px;
        border: 1px solid rgba(148,163,184,.22);
        border-radius: 12px;
        outline: none;
        background: rgba(2,6,23,.65);
        color: #f8fafc;
        font-size: 14px;
      }

      .admin-kmz-search:focus {
        border-color: rgba(56,189,248,.58);
        box-shadow: 0 0 0 3px rgba(14,165,233,.09);
      }

      .admin-kmz-action-filter {
        padding: 10px 12px;
        border: 1px solid rgba(148,163,184,.22);
        border-radius: 12px;
        background: #0f172a;
        color: #f8fafc;
        font-weight: 800;
      }

      .admin-kmz-mode-tabs {
        display: flex;
        gap: 6px;
        margin: 0 22px 14px;
        padding: 4px;
        border: 1px solid rgba(148,163,184,.16);
        border-radius: 13px;
        background: rgba(2,6,23,.56);
      }

      .admin-kmz-mode-button {
        flex: 1;
        padding: 9px 10px;
        border: 0;
        border-radius: 9px;
        background: transparent;
        color: #94a3b8;
        font-size: 11px;
        font-weight: 900;
        cursor: pointer;
      }

      .admin-kmz-mode-button.active {
        background: linear-gradient(135deg, rgba(14,165,233,.2), rgba(99,102,241,.15));
        color: #e0f2fe;
        box-shadow: inset 0 0 0 1px rgba(125,211,252,.22);
      }

      .admin-kmz-list-wrap {
        padding: 0 22px 22px;
      }

      .admin-kmz-list-head {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
        margin-bottom: 10px;
        color: #94a3b8;
        font-size: 11px;
      }

      .admin-kmz-list {
        display: grid;
        gap: 10px;
      }

      .admin-kmz-card {
        position: relative;
        overflow: hidden;
        padding: 15px;
        border: 1px solid rgba(148,163,184,.16);
        border-radius: 16px;
        background: linear-gradient(145deg, rgba(30,41,59,.72), rgba(15,23,42,.72));
      }

      .admin-kmz-card::after {
        content: "";
        position: absolute;
        inset: 0 auto 0 0;
        width: 3px;
        background: rgba(56,189,248,.55);
      }

      .admin-kmz-card.is-duplicate::after {
        background: rgba(251,191,36,.68);
      }

      .admin-kmz-card-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }

      .admin-kmz-card-title-wrap { min-width: 0; }

      .admin-kmz-card-title {
        margin: 0;
        overflow-wrap: anywhere;
        color: #f8fafc;
        font-size: 15px;
        line-height: 1.45;
      }

      .admin-kmz-file-name {
        margin-top: 4px;
        overflow-wrap: anywhere;
        color: #64748b;
        font-size: 10px;
      }

      .admin-kmz-badges {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 5px;
        flex: 0 0 auto;
      }

      .admin-kmz-badge {
        padding: 4px 7px;
        border-radius: 999px;
        background: rgba(14,165,233,.12);
        color: #bae6fd;
        font-size: 9px;
        font-weight: 900;
        white-space: nowrap;
      }

      .admin-kmz-badge.duplicate {
        background: rgba(245,158,11,.12);
        color: #fde68a;
      }

      .admin-kmz-badge.history {
        background: rgba(99,102,241,.13);
        color: #c7d2fe;
      }

      .admin-kmz-meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 7px 12px;
        margin-top: 13px;
      }

      .admin-kmz-meta-item {
        min-width: 0;
        color: #94a3b8;
        font-size: 10px;
        line-height: 1.5;
      }

      .admin-kmz-meta-item strong {
        color: #cbd5e1;
        font-weight: 900;
      }

      .admin-kmz-card-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 13px;
      }

      .admin-kmz-action-button {
        min-height: 39px;
        padding: 8px 10px;
        border: 1px solid rgba(125,211,252,.24);
        border-radius: 11px;
        background: rgba(14,165,233,.08);
        color: #e0f2fe;
        font-size: 11px;
        font-weight: 900;
        cursor: pointer;
      }

      .admin-kmz-action-button.review {
        border-color: rgba(167,139,250,.3);
        background: rgba(124,58,237,.1);
        color: #ede9fe;
      }

      .admin-kmz-action-button:disabled {
        opacity: .5;
        cursor: wait;
      }

      .admin-kmz-empty,
      .admin-kmz-loading,
      .admin-kmz-error,
      .admin-kmz-locked {
        padding: 28px 16px;
        border: 1px dashed rgba(148,163,184,.22);
        border-radius: 15px;
        text-align: center;
        color: #94a3b8;
        font-size: 12px;
        line-height: 1.7;
      }

      .admin-kmz-error { color: #fecaca; }

      .admin-kmz-reauth-button,
      .admin-kmz-more {
        margin-top: 12px;
        padding: 9px 14px;
        border: 1px solid rgba(125,211,252,.3);
        border-radius: 10px;
        background: rgba(14,165,233,.1);
        color: #e0f2fe;
        font-weight: 900;
        cursor: pointer;
      }

      .admin-kmz-more {
        width: 100%;
      }

      @media (max-width: 680px) {
        .admin-kmz-browser-hero,
        .admin-kmz-summary,
        .admin-kmz-controls,
        .admin-kmz-list-wrap {
          padding-left: 14px;
          padding-right: 14px;
        }

        .admin-kmz-browser-note,
        .admin-kmz-mode-tabs,
        .admin-kmz-current-device-toggle {
          margin-left: 14px;
          margin-right: 14px;
        }

        .admin-kmz-summary {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .admin-kmz-controls {
          grid-template-columns: 1fr;
        }

        .admin-kmz-card-top {
          display: block;
        }

        .admin-kmz-badges {
          justify-content: flex-start;
          margin-top: 9px;
        }

        .admin-kmz-card-actions {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function getAdminPanel() {
    return document.getElementById("admin")?.querySelector(".panel") || null;
  }

  function ensureBrowserUi() {
    const panel = getAdminPanel();
    if (!panel) return null;

    let browser = document.getElementById("adminKmzBrowser");
    if (browser) return browser;

    browser = document.createElement("section");
    browser.id = "adminKmzBrowser";
    browser.className = "admin-kmz-browser";
    browser.innerHTML = `
      <div class="admin-kmz-browser-hero">
        <div>
          <p class="admin-kmz-browser-eyebrow">ADMIN · SUPABASE ARCHIVE</p>
          <h3>📦 提出KMZブラウザ</h3>
          <p class="admin-kmz-browser-sub">
            Supabaseに保存されたKMZ生成・距離チェック履歴を確認します。
            同じファイルはまとめて表示でき、そのまま管理者レビューへ送れます。
          </p>
        </div>
        <button type="button" class="admin-kmz-browser-refresh" data-admin-kmz-refresh title="再読み込み">↻</button>
      </div>

      <div id="adminKmzBrowserBody">
        <div class="admin-kmz-locked">
          管理者ログイン後に提出KMZを読み込みます。
        </div>
      </div>
    `;

    panel.prepend(browser);

    browser.querySelector("[data-admin-kmz-refresh]")?.addEventListener("click", () => {
      loadRecords(true);
    });

    return browser;
  }

  function renderLocked() {
    const body = document.getElementById("adminKmzBrowserBody");
    if (!body) return;

    body.innerHTML = `
      <div class="admin-kmz-list-wrap">
        <div class="admin-kmz-locked">
          🔒 KMZ本体は非公開Storageに保存されています。<br>
          閲覧するには管理者コードをもう一度確認してください。<br>
          <button type="button" class="admin-kmz-reauth-button" data-admin-kmz-reauth>管理者認証</button>
        </div>
      </div>
    `;

    body.querySelector("[data-admin-kmz-reauth]")?.addEventListener("click", () => {
      if (typeof window.openAdminLogin === "function") window.openAdminLogin();
    });
  }

  function renderLoading() {
    const body = document.getElementById("adminKmzBrowserBody");
    if (!body) return;

    body.innerHTML = `
      <div class="admin-kmz-list-wrap">
        <div class="admin-kmz-loading">📡 Supabaseから提出履歴を読み込んでいます…</div>
      </div>
    `;
  }

  function renderError(message) {
    const body = document.getElementById("adminKmzBrowserBody");
    if (!body) return;

    body.innerHTML = `
      <div class="admin-kmz-list-wrap">
        <div class="admin-kmz-error">
          ${escapeHtml(message || "提出KMZ一覧を取得できませんでした。")}
        </div>
      </div>
    `;
  }

  function getFilteredRecords() {
    if (!payload) return [];

    const source = viewMode === "history"
      ? payload.historyRecords || []
      : payload.uniqueRecords || [];

    const query = normalizeSearch(searchText);

    return source.filter(record => {
      if (excludeCurrentDevice) {
        if (viewMode === "unique") {
          if (record.hasOtherDeviceActivity !== true) return false;
        } else if (record.isCurrentDevice === true) {
          return false;
        }
      }

      if (actionFilter !== "all") {
        const types = Array.isArray(record.actionTypes)
          ? record.actionTypes
          : [record.actionType];

        if (!types.includes(actionFilter)) return false;
      }

      if (!query) return true;

      const haystack = normalizeSearch([
        record.parkName,
        record.originalFileName,
        record.displayFileName,
        record.deviceLabel,
        getActionLabel(record.actionType)
      ].join(" "));

      return haystack.includes(query);
    });
  }

  function getScoreText(record) {
    const score = Number(record.campsiteScore);
    const rank = record.campsiteRank ? String(record.campsiteRank) : "";

    if (!Number.isFinite(score) && !rank) return "-";
    if (Number.isFinite(score) && rank) return `${score} / ${rank}`;
    if (Number.isFinite(score)) return String(score);
    return rank;
  }

  function renderRecordCard(record) {
    const title = record.parkName && record.parkName !== "公園名不明"
      ? record.parkName
      : record.displayFileName || record.originalFileName || "名称不明";

    const fileName = record.displayFileName || record.originalFileName || "ファイル名不明";
    const date = record.lastActivityAt || record.createdAt;
    const historyCount = Number(record.historyCount) || 1;
    const duplicateCount = Number(record.duplicateCount) || 0;
    const isDuplicate = record.isDuplicate === true;
    const deviceText = viewMode === "unique"
      ? (record.hasCurrentDeviceActivity && record.hasOtherDeviceActivity
          ? "この端末＋他端末"
          : record.hasCurrentDeviceActivity
            ? "この端末"
            : record.deviceLabel || "端末不明")
      : record.deviceLabel || "端末不明";

    const badges = [
      `<span class="admin-kmz-badge">${getActionIcon(record.actionType)} ${getActionLabel(record.actionType)}</span>`
    ];

    if (viewMode === "unique" && historyCount > 1) {
      badges.push(`<span class="admin-kmz-badge history">履歴 ${historyCount}回</span>`);
    }

    if ((viewMode === "unique" && duplicateCount > 0) || isDuplicate) {
      badges.push(`<span class="admin-kmz-badge duplicate">${viewMode === "unique" ? `重複 ${duplicateCount}回` : "重複履歴"}</span>`);
    }

    return `
      <article class="admin-kmz-card ${isDuplicate ? "is-duplicate" : ""}">
        <div class="admin-kmz-card-top">
          <div class="admin-kmz-card-title-wrap">
            <h4 class="admin-kmz-card-title">${escapeHtml(title)}</h4>
            <div class="admin-kmz-file-name">${escapeHtml(fileName)}</div>
          </div>
          <div class="admin-kmz-badges">${badges.join("")}</div>
        </div>

        <div class="admin-kmz-meta">
          <div class="admin-kmz-meta-item"><strong>最終利用</strong><br>${escapeHtml(formatDate(date))}</div>
          <div class="admin-kmz-meta-item"><strong>匿名端末</strong><br>${escapeHtml(deviceText)}</div>
          <div class="admin-kmz-meta-item"><strong>POI</strong><br>${record.poiCount ?? "-"}件（追加 ${record.addedPoiCount ?? "-"}）</div>
          <div class="admin-kmz-meta-item"><strong>警告 / 評価</strong><br>${record.warningCount ?? "-"}件 / ${escapeHtml(getScoreText(record))}</div>
          <div class="admin-kmz-meta-item"><strong>サイズ</strong><br>${escapeHtml(formatBytes(record.fileSizeBytes))}</div>
          <div class="admin-kmz-meta-item"><strong>保存期限</strong><br>${escapeHtml(formatDate(record.expiresAt))}</div>
        </div>

        <div class="admin-kmz-card-actions">
          <button type="button" class="admin-kmz-action-button" data-admin-kmz-download="${escapeHtml(record.id)}">
            ⬇ KMZを取得
          </button>
          <button type="button" class="admin-kmz-action-button review" data-admin-kmz-review="${escapeHtml(record.id)}">
            🔎 このKMZをレビュー
          </button>
        </div>
      </article>
    `;
  }

  function renderBrowser() {
    const body = document.getElementById("adminKmzBrowserBody");
    if (!body || !payload) return;

    const summary = payload.summary || {};
    const showingOther = excludeCurrentDevice && (Number(summary.currentDeviceHistoryCount) || 0) > 0;
    const summaryUnique = showingOther ? summary.otherUniqueFiles : summary.uniqueFiles;
    const summaryHistory = showingOther ? summary.otherDeviceHistoryCount : summary.totalHistory;
    const summaryDuplicate = showingOther ? summary.otherDuplicateHistory : summary.duplicateHistory;
    const summaryDevices = showingOther ? summary.otherDistinctDevices : summary.distinctDevices;
    const summaryToday = showingOther ? summary.otherTodayCount : summary.todayCount;
    const summaryLast7 = showingOther ? summary.otherLast7DaysCount : summary.last7DaysCount;
    const summaryKmz = showingOther ? summary.otherKmzGenerateCount : summary.kmzGenerateCount;
    const summaryDistance = showingOther ? summary.otherDistanceCheckCount : summary.distanceCheckCount;
    const filtered = getFilteredRecords();
    const visible = filtered.slice(0, visibleCount);

    body.innerHTML = `
      <div class="admin-kmz-summary">
        <div class="admin-kmz-stat primary"><strong>${Number(summaryUnique) || 0}</strong><span>${showingOther ? "他端末の実ファイル" : "実ファイル"}</span></div>
        <div class="admin-kmz-stat"><strong>${Number(summaryHistory) || 0}</strong><span>${showingOther ? "他端末の履歴" : "アップロード履歴"}</span></div>
        <div class="admin-kmz-stat duplicate"><strong>${Number(summaryDuplicate) || 0}</strong><span>重複履歴</span></div>
        <div class="admin-kmz-stat device"><strong>${Number(summaryDevices) || 0}</strong><span>${showingOther ? "その他の匿名端末ID" : "匿名端末ID"}</span></div>
      </div>

      <div class="admin-kmz-activity-strip">
        <span class="admin-kmz-activity-pill">今日 ${Number(summaryToday) || 0}件</span>
        <span class="admin-kmz-activity-pill">直近7日 ${Number(summaryLast7) || 0}件</span>
        <span class="admin-kmz-activity-pill">KMZ生成 ${Number(summaryKmz) || 0}件</span>
        <span class="admin-kmz-activity-pill">距離チェック ${Number(summaryDistance) || 0}件</span>
        ${Number(summary.currentDeviceHistoryCount) > 0 ? `<span class="admin-kmz-activity-pill current-device">この端末 ${Number(summary.currentDeviceHistoryCount)}件</span>` : ""}
      </div>

      <div class="admin-kmz-browser-note">
        「匿名端末ID」は利用人数ではありません。同じ人の複数端末やブラウザ保存状態の変化で増減します。<br>
        「実ファイル」は同一内容の重複アップロードを1件にまとめた数です。
      </div>

      <label class="admin-kmz-current-device-toggle">
        <input type="checkbox" data-admin-kmz-exclude-current ${excludeCurrentDevice ? "checked" : ""}>
        <span>🧪 この端末の履歴を除く</span>
        <small>今使っているブラウザのテスト履歴だけを除外します</small>
      </label>

      <div class="admin-kmz-controls">
        <input
          type="search"
          class="admin-kmz-search"
          data-admin-kmz-search
          placeholder="拠点名・ファイル名・端末ラベルで検索"
          value="${escapeHtml(searchText)}"
        >
        <select class="admin-kmz-action-filter" data-admin-kmz-filter>
          <option value="all" ${actionFilter === "all" ? "selected" : ""}>すべて</option>
          <option value="kmz_generate" ${actionFilter === "kmz_generate" ? "selected" : ""}>KMZ生成</option>
          <option value="distance_check" ${actionFilter === "distance_check" ? "selected" : ""}>距離チェック</option>
        </select>
      </div>

      <div class="admin-kmz-mode-tabs">
        <button type="button" class="admin-kmz-mode-button ${viewMode === "unique" ? "active" : ""}" data-admin-kmz-mode="unique">
          実ファイル ${Number(summaryUnique) || 0}
        </button>
        <button type="button" class="admin-kmz-mode-button ${viewMode === "history" ? "active" : ""}" data-admin-kmz-mode="history">
          全履歴 ${Number(summaryHistory) || 0}
        </button>
      </div>

      <div class="admin-kmz-list-wrap">
        <div class="admin-kmz-list-head">
          <strong>${viewMode === "unique" ? "実ファイル" : "全履歴"}</strong>
          <span>${filtered.length}件中 ${visible.length}件表示</span>
        </div>
        <div class="admin-kmz-list">
          ${visible.length ? visible.map(renderRecordCard).join("") : `<div class="admin-kmz-empty">条件に一致するKMZはありません。</div>`}
        </div>
        ${visible.length < filtered.length ? `<button type="button" class="admin-kmz-more" data-admin-kmz-more>さらに表示</button>` : ""}
      </div>
    `;

    bindBrowserEvents();
  }

  function bindBrowserEvents() {
    const body = document.getElementById("adminKmzBrowserBody");
    if (!body) return;

    body.querySelector("[data-admin-kmz-exclude-current]")?.addEventListener("change", event => {
      excludeCurrentDevice = event.target.checked === true;
      visibleCount = PAGE_SIZE;
      renderBrowser();
    });

    const search = body.querySelector("[data-admin-kmz-search]");
    search?.addEventListener("input", event => {
      searchText = event.target.value || "";
      visibleCount = PAGE_SIZE;
      renderBrowser();
      requestAnimationFrame(() => {
        const next = document.querySelector("[data-admin-kmz-search]");
        if (next) {
          next.focus();
          next.setSelectionRange(searchText.length, searchText.length);
        }
      });
    });

    body.querySelector("[data-admin-kmz-filter]")?.addEventListener("change", event => {
      actionFilter = event.target.value || "all";
      visibleCount = PAGE_SIZE;
      renderBrowser();
    });

    body.querySelectorAll("[data-admin-kmz-mode]").forEach(button => {
      button.addEventListener("click", () => {
        viewMode = button.dataset.adminKmzMode === "history" ? "history" : "unique";
        visibleCount = PAGE_SIZE;
        renderBrowser();
      });
    });

    body.querySelector("[data-admin-kmz-more]")?.addEventListener("click", () => {
      visibleCount += PAGE_SIZE;
      renderBrowser();
    });

    body.querySelectorAll("[data-admin-kmz-download]").forEach(button => {
      button.addEventListener("click", () => downloadRecord(button.dataset.adminKmzDownload, button));
    });

    body.querySelectorAll("[data-admin-kmz-review]").forEach(button => {
      button.addEventListener("click", () => reviewRecord(button.dataset.adminKmzReview, button));
    });
  }

  async function invokeFunction(body) {
    if (!window.campsiteSupabase?.functions) {
      throw new Error("Supabaseクライアントを初期化できませんでした。");
    }

    if (!adminCode) {
      throw new Error("管理者認証が必要です。");
    }

    const { data, error } = await window.campsiteSupabase.functions.invoke(
      FUNCTION_NAME,
      { body: { ...body, adminCode } }
    );

    if (error) throw error;
    if (!data?.success) {
      const exception = new Error(data?.error || "管理者KMZブラウザの処理に失敗しました。");
      exception.authRequired = data?.authRequired === true;
      throw exception;
    }

    return data;
  }

  async function loadRecords(force = false) {
    ensureBrowserUi();

    if (!adminCode) {
      renderLocked();
      return;
    }

    if (isLoading) return;
    if (payload && !force) {
      renderBrowser();
      return;
    }

    isLoading = true;
    const refresh = document.querySelector("[data-admin-kmz-refresh]");
    if (refresh) refresh.disabled = true;
    renderLoading();

    try {
      payload = await invokeFunction({
        action: "list",
        currentDeviceId: localStorage.getItem("campsiteUserId") || ""
      });
      visibleCount = PAGE_SIZE;
      renderBrowser();
    } catch (error) {
      console.warn("管理者KMZ一覧取得エラー", error);
      if (error?.authRequired || /認証/.test(error?.message || "")) {
        adminCode = "";
        renderLocked();
      } else {
        renderError(error?.message || "提出KMZ一覧を取得できませんでした。");
      }
    } finally {
      isLoading = false;
      const nextRefresh = document.querySelector("[data-admin-kmz-refresh]");
      if (nextRefresh) nextRefresh.disabled = false;
    }
  }

  async function getDownloadInfo(recordId) {
    return invokeFunction({ action: "download", recordId });
  }

  async function fetchRecordBlob(recordId) {
    const info = await getDownloadInfo(recordId);
    const response = await fetch(info.signedUrl, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("KMZ本体を取得できませんでした。");
    }

    const blob = await response.blob();
    return {
      blob,
      fileName: info.fileName || "campsite.kmz"
    };
  }

  async function downloadRecord(recordId, button) {
    if (!recordId || button?.disabled) return;

    const originalText = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = "取得中…";
    }

    try {
      const { blob, fileName } = await fetchRecordBlob(recordId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.warn("管理者KMZ取得エラー", error);
      alert(error?.message || "KMZを取得できませんでした。");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText || "⬇ KMZを取得";
      }
    }
  }

  async function reviewRecord(recordId, button) {
    if (!recordId || button?.disabled) return;

    const originalText = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = "読込中…";
    }

    try {
      const { blob, fileName } = await fetchRecordBlob(recordId);
      const input = document.getElementById("adminReviewFile");

      if (!input) {
        throw new Error("管理者レビュー欄が見つかりません。");
      }

      const file = new File(
        [blob],
        fileName,
        { type: blob.type || "application/vnd.google-earth.kmz" }
      );

      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;

      input.scrollIntoView({ behavior: "smooth", block: "center" });

      if (typeof window.runAdminDashboardReview !== "function") {
        throw new Error("管理者レビュー機能を起動できません。");
      }

      await window.runAdminDashboardReview();
    } catch (error) {
      console.warn("管理者KMZレビュー読込エラー", error);
      alert(error?.message || "KMZをレビューへ読み込めませんでした。");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText || "🔎 このKMZをレビュー";
      }
    }
  }

  function unlock(code) {
    const normalized = String(code || "").trim();
    if (!normalized) return;

    adminCode = normalized;
    payload = null;
    ensureBrowserUi();
    loadRecords(true);
  }

  function wrapAdminLogin() {
    const original = window.checkAdminCode;
    if (typeof original !== "function" || original.__adminKmzBrowserWrapped) return;

    function wrappedCheckAdminCode(...args) {
      const input = document.getElementById("adminCodeInput");
      const candidate = input?.value?.trim() || "";

      const result = original.apply(this, args);

      if (sessionStorage.getItem("campsiteAdminUnlocked") === "true" && candidate) {
        unlock(candidate);
      }

      return result;
    }

    wrappedCheckAdminCode.__adminKmzBrowserWrapped = true;
    window.checkAdminCode = wrappedCheckAdminCode;
  }

  function setup() {
    ensureStyles();
    ensureBrowserUi();
    wrapAdminLogin();

    if (sessionStorage.getItem("campsiteAdminUnlocked") === "true" && !adminCode) {
      renderLocked();
    }
  }

  window.AdminKmzBrowser = Object.freeze({
    unlock,
    reload: () => loadRecords(true),
    open: () => {
      ensureBrowserUi();
      return loadRecords(false);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
