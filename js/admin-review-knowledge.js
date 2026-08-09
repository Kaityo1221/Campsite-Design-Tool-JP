/* ======================================================
   Issue #65: 管理者レビュー結果の軽量記録

   方針:
   - 管理者レビュー結果を、その場限りにせず端末内へ記録する
   - 問題なし / 要確認 / 修正あり を残す
   - 理由を複数選択できる
   - 「知見候補にする」は候補フラグのみ。自動で推奨へ昇格しない
   - 初期実装は localStorage。外部送信しない
====================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "campsiteAdminReviewRecordsV1";
  const MAX_RECORDS = 100;

  const REVIEW_STATUS = Object.freeze({
    OK: "ok",
    NEEDS_CHECK: "needs_check",
    NEEDS_REVISION: "needs_revision"
  });

  const REVIEW_STATUS_LABELS = Object.freeze({
    [REVIEW_STATUS.OK]: "問題なし",
    [REVIEW_STATUS.NEEDS_CHECK]: "要確認",
    [REVIEW_STATUS.NEEDS_REVISION]: "修正あり"
  });

  const REVIEW_REASONS = Object.freeze([
    { id: "distance", label: "距離" },
    { id: "poi_limit", label: "追加POI上限" },
    { id: "layer", label: "レイヤー構成" },
    { id: "polygon", label: "活動範囲" },
    { id: "duplicate", label: "重複POI" },
    { id: "traffic", label: "通行・滞留" },
    { id: "route", label: "回遊性" },
    { id: "waiting", label: "集合・待機場所" },
    { id: "other", label: "その他" }
  ]);

  function escapeReviewKnowledgeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function loadAdminReviewRecords() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("管理者レビュー記録を読み込めませんでした。", error);
      return [];
    }
  }

  function saveAdminReviewRecords(records) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(records.slice(0, MAX_RECORDS))
    );
  }

  function inferAdminReviewStatus(text) {
    const value = String(text || "");

    if (value.includes("要修正")) {
      return REVIEW_STATUS.NEEDS_REVISION;
    }

    if (value.includes("要確認")) {
      return REVIEW_STATUS.NEEDS_CHECK;
    }

    if (value.includes("提出前確認OK")) {
      return REVIEW_STATUS.OK;
    }

    return REVIEW_STATUS.NEEDS_CHECK;
  }

  function inferAdminReviewReasons(text) {
    const value = String(text || "");
    const reasons = new Set();

    if (/30m未満|30〜40m|30～40m|距離/.test(value)) reasons.add("distance");
    if (/追加POI上限|上限25件|上限12件|上限8件|上限5件/.test(value)) reasons.add("poi_limit");
    if (/レイヤー/.test(value)) reasons.add("layer");
    if (/活動範囲ポリゴン|活動範囲/.test(value)) reasons.add("polygon");
    if (/重複POI|座標完全一致/.test(value)) reasons.add("duplicate");

    return [...reasons];
  }

  function getCurrentAdminReviewFileName() {
    return document.getElementById("adminReviewFile")?.files?.[0]?.name || "名称未取得";
  }

  function getAdminReviewStatusOptionsHtml(selectedStatus) {
    return Object.values(REVIEW_STATUS)
      .map(status => `
        <label class="admin-review-record-status-option">
          <input
            type="radio"
            name="adminReviewRecordStatus"
            value="${status}"
            ${status === selectedStatus ? "checked" : ""}
          >
          <span>${REVIEW_STATUS_LABELS[status]}</span>
        </label>
      `)
      .join("");
  }

  function getAdminReviewReasonOptionsHtml(selectedReasons) {
    const selected = new Set(selectedReasons || []);

    return REVIEW_REASONS
      .map(reason => `
        <label class="admin-review-record-reason-option">
          <input
            type="checkbox"
            value="${reason.id}"
            data-admin-review-reason
            ${selected.has(reason.id) ? "checked" : ""}
          >
          <span>${reason.label}</span>
        </label>
      `)
      .join("");
  }

  function ensureAdminReviewKnowledgeStyles() {
    if (document.getElementById("adminReviewKnowledgeStyles")) return;

    const style = document.createElement("style");
    style.id = "adminReviewKnowledgeStyles";
    style.textContent = `
      .admin-review-record-panel {
        margin-top: 16px;
        padding: 16px;
        border: 1px solid rgba(56,189,248,.28);
        border-radius: 14px;
        background: rgba(15,23,42,.72);
        color: #e2e8f0;
      }

      .admin-review-record-panel h4 {
        margin: 0 0 6px;
        color: #7dd3fc;
        font-size: 15px;
      }

      .admin-review-record-panel .admin-review-record-note {
        margin: 0 0 14px;
        color: #94a3b8;
        font-size: 12px;
        line-height: 1.7;
      }

      .admin-review-record-field {
        margin-top: 14px;
      }

      .admin-review-record-field-title {
        margin-bottom: 8px;
        color: #cbd5e1;
        font-size: 12px;
        font-weight: 900;
      }

      .admin-review-record-statuses,
      .admin-review-record-reasons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .admin-review-record-status-option,
      .admin-review-record-reason-option {
        position: relative;
        cursor: pointer;
      }

      .admin-review-record-status-option input,
      .admin-review-record-reason-option input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }

      .admin-review-record-status-option span,
      .admin-review-record-reason-option span {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        padding: 6px 10px;
        box-sizing: border-box;
        border: 1px solid rgba(148,163,184,.26);
        border-radius: 999px;
        background: rgba(30,41,59,.72);
        color: #cbd5e1;
        font-size: 12px;
        font-weight: 800;
      }

      .admin-review-record-status-option input:checked + span,
      .admin-review-record-reason-option input:checked + span {
        border-color: rgba(56,189,248,.58);
        background: rgba(14,165,233,.16);
        color: #e0f2fe;
      }

      .admin-review-record-panel textarea {
        width: 100%;
        min-height: 72px;
        box-sizing: border-box;
        padding: 10px 12px;
        border: 1px solid rgba(148,163,184,.28);
        border-radius: 10px;
        background: rgba(2,6,23,.72);
        color: #f8fafc;
        font: inherit;
        resize: vertical;
      }

      .admin-review-record-candidate {
        display: flex;
        gap: 9px;
        align-items: flex-start;
        margin-top: 14px;
        color: #dbeafe;
        font-size: 12px;
        line-height: 1.6;
      }

      .admin-review-record-candidate input {
        margin-top: 3px;
      }

      .admin-review-record-save {
        width: 100%;
        margin-top: 14px;
        padding: 11px 14px;
        border: 1px solid rgba(34,197,94,.5);
        border-radius: 10px;
        background: rgba(34,197,94,.16);
        color: #dcfce7;
        font-weight: 900;
        cursor: pointer;
      }

      .admin-review-record-saved {
        margin-top: 10px;
        color: #86efac;
        font-size: 12px;
        line-height: 1.6;
      }
    `;

    document.head.appendChild(style);
  }

  function buildReviewObservation(record) {
    if (!record.knowledgeCandidate) return null;

    const reasonLabels = record.reasons
      .map(id => REVIEW_REASONS.find(reason => reason.id === id)?.label)
      .filter(Boolean);

    return {
      id: `kmz-review-${record.id}`,
      category: record.reasons[0] || "other",
      observation: record.memo || reasonLabels.join(" / ") || "管理者レビューで確認が必要だった設計傾向",
      evidence: `${record.fileName} の管理者レビュー結果: ${REVIEW_STATUS_LABELS[record.status]}`,
      sourceType: "kmz_review",
      sourceRef: record.fileName,
      confirmedAt: record.reviewedAt.slice(0, 10),
      regionalVariation: true,
      promotionStatus: "candidate"
    };
  }

  function saveCurrentAdminReviewRecord(panel) {
    const status = panel.querySelector('input[name="adminReviewRecordStatus"]:checked')?.value;
    const reasons = [...panel.querySelectorAll("[data-admin-review-reason]:checked")]
      .map(input => input.value);
    const memo = panel.querySelector("[data-admin-review-memo]")?.value.trim() || "";
    const knowledgeCandidate = panel.querySelector("[data-admin-review-candidate]")?.checked === true;

    if (!status) {
      alert("レビュー結果を選択してください。");
      return;
    }

    const record = {
      id: crypto.randomUUID(),
      fileName: getCurrentAdminReviewFileName(),
      status,
      reasons,
      memo,
      knowledgeCandidate,
      reviewedAt: new Date().toISOString(),
      source: "admin-review"
    };

    record.knowledgeObservation = buildReviewObservation(record);

    if (
      record.knowledgeObservation &&
      window.CampsiteKnowledge?.validateReviewObservation
    ) {
      const errors = window.CampsiteKnowledge.validateReviewObservation(
        record.knowledgeObservation
      );

      if (errors.length) {
        console.warn("知見候補データの検証エラー", errors);
        alert("知見候補の形式を確認できませんでした。通常のレビュー記録として保存します。");
        record.knowledgeCandidate = false;
        record.knowledgeObservation = null;
      }
    }

    const records = loadAdminReviewRecords();
    records.unshift(record);
    saveAdminReviewRecords(records);

    const saved = panel.querySelector("[data-admin-review-record-saved]");
    if (saved) {
      saved.textContent = `保存しました。端末内レビュー記録: ${Math.min(records.length, MAX_RECORDS)}件`;
    }
  }

  function createAdminReviewRecordPanel(result) {
    if (!result || result.querySelector("[data-admin-review-record-panel]")) return;

    const text = result.innerText || result.textContent || "";
    if (!/提出前確認OK|要確認|要修正/.test(text)) return;

    const status = inferAdminReviewStatus(text);
    const reasons = inferAdminReviewReasons(text);

    const panel = document.createElement("div");
    panel.className = "admin-review-record-panel";
    panel.dataset.adminReviewRecordPanel = "true";
    panel.innerHTML = `
      <h4>📝 このレビューを記録</h4>
      <p class="admin-review-record-note">
        後から「どんな修正が多いか」を振り返るための管理者用メモです。<br>
        初期版はこの端末内だけに保存し、利用者画面には表示しません。
      </p>

      <div class="admin-review-record-field">
        <div class="admin-review-record-field-title">レビュー結果</div>
        <div class="admin-review-record-statuses">
          ${getAdminReviewStatusOptionsHtml(status)}
        </div>
      </div>

      <div class="admin-review-record-field">
        <div class="admin-review-record-field-title">確認理由</div>
        <div class="admin-review-record-reasons">
          ${getAdminReviewReasonOptionsHtml(reasons)}
        </div>
      </div>

      <div class="admin-review-record-field">
        <div class="admin-review-record-field-title">メモ（任意）</div>
        <textarea
          data-admin-review-memo
          maxlength="500"
          placeholder="例：入口付近に追加POIが集中。別のKMZでも同じ傾向があるか確認する。"
        ></textarea>
      </div>

      <label class="admin-review-record-candidate">
        <input type="checkbox" data-admin-review-candidate>
        <span>
          <strong>知見候補にする</strong><br>
          これは候補フラグだけです。自動で「推奨」や「必須確認」にはなりません。
        </span>
      </label>

      <button type="button" class="admin-review-record-save" data-admin-review-record-save>
        このレビューを端末内に記録
      </button>
      <div class="admin-review-record-saved" data-admin-review-record-saved></div>
    `;

    panel.querySelector("[data-admin-review-record-save]")?.addEventListener("click", () => {
      saveCurrentAdminReviewRecord(panel);
    });

    result.appendChild(panel);
  }

  function refreshAdminReviewRecordPanel() {
    const result = document.getElementById("adminReviewResult");
    if (!result || !result.textContent.trim()) return;
    createAdminReviewRecordPanel(result);
  }

  function setupAdminReviewKnowledge() {
    ensureAdminReviewKnowledgeStyles();

    const result = document.getElementById("adminReviewResult");
    if (!result || result.dataset.adminReviewKnowledgeReady === "true") return;

    result.dataset.adminReviewKnowledgeReady = "true";

    const observer = new MutationObserver(() => {
      requestAnimationFrame(refreshAdminReviewRecordPanel);
    });

    observer.observe(result, { childList: true, subtree: true });
    refreshAdminReviewRecordPanel();
  }

  window.CampsiteAdminReviewRecords = Object.freeze({
    storageKey: STORAGE_KEY,
    load: loadAdminReviewRecords,
    statuses: REVIEW_STATUS,
    reasons: REVIEW_REASONS
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupAdminReviewKnowledge);
  } else {
    setupAdminReviewKnowledge();
  }
})();
