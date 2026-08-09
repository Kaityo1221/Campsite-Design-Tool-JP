/* ======================================================
   管理者専用 Supabase API

   Issue #51:
   管理者画面の未分類POIレビュー / 辞書候補操作を、
   anonの直接SELECT/UPDATEではなく管理者セッション付き
   Edge Function admin-alias-access 経由へ切り替える。
====================================================== */

(function () {
  "use strict";

  const FUNCTION_NAME = "admin-alias-access";

  async function invokeAdminAlias(action, payload = {}) {
    if (!window.campsiteSupabase?.functions) {
      throw new Error("Supabaseクライアントを初期化できませんでした。");
    }

    const sessionToken = window.CampsiteAdminAuth?.getSessionToken?.() || "";
    if (!sessionToken) {
      throw new Error("管理者認証が必要です。");
    }

    const { data, error } = await window.campsiteSupabase.functions.invoke(
      FUNCTION_NAME,
      {
        body: {
          action,
          sessionToken,
          ...payload
        }
      }
    );

    if (error) {
      let message = error.message || "管理者処理に失敗しました。";
      let details = null;

      try {
        if (error.context && typeof error.context.json === "function") {
          details = await error.context.json();
          if (details?.error) message = details.error;
        }
      } catch (_) {}

      if (details?.authRequired === true || /管理者セッション|管理者認証/.test(message)) {
        window.CampsiteAdminAuth?.clearSession?.();
      }

      throw new Error(message);
    }

    if (!data?.success) {
      if (data?.authRequired === true) {
        window.CampsiteAdminAuth?.clearSession?.();
      }
      throw new Error(data?.error || "管理者処理に失敗しました。");
    }

    return data;
  }

  async function secureFetchAliasReviewRemainingCount() {
    try {
      const data = await invokeAdminAlias("remaining-count");
      return Number(data.count) || 0;
    } catch (error) {
      console.error("未分類レビュー残数取得エラー:", error);
      return 0;
    }
  }

  async function secureFetchNextAliasReviewItem() {
    try {
      const data = await invokeAdminAlias("next-items");
      const items = Array.isArray(data.items) ? data.items : [];

      if (!items.length) return null;

      const nextItem = items.find(item => {
        return !aliasReviewSkippedIds.includes(String(item.id));
      });

      if (nextItem) return nextItem;

      aliasReviewSkippedIds = [];
      return items[0] || null;
    } catch (error) {
      console.error("未分類レビュー取得エラー:", error);
      setAliasReviewStatus(error?.message || "未分類POIの取得に失敗しました。", "error");
      return null;
    }
  }

  async function secureSubmitAliasReview(category) {
    if (!currentAliasReviewItem) {
      alert("レビュー対象がありません。");
      return;
    }

    const noteEl = document.getElementById("aliasReviewNote");
    const reviewNote = String(noteEl?.value || "").trim();

    setAliasReviewStatus(
      `${getAliasReviewCategoryLabel(category)}として保存中です…`
    );

    try {
      await invokeAdminAlias("submit-review", {
        id: String(currentAliasReviewItem.id),
        category,
        reviewNote
      });

      setAliasReviewStatus(
        `${getAliasReviewCategoryLabel(category)}として保存しました。次を読み込みます。`,
        "success"
      );

      await loadAliasReviewCard();
      await loadAliasReviewHistory();
      await loadAliasDictionaryCandidates();
    } catch (error) {
      console.error("未分類レビュー保存エラー:", error);
      setAliasReviewStatus(error?.message || "レビュー結果の保存に失敗しました。", "error");
    }
  }

  async function secureLoadAliasReviewHistory() {
    const list = document.getElementById("aliasReviewHistoryList");
    if (!list) return;

    list.innerHTML = `
      <div class="alias-review-history-empty">
        レビュー履歴を読み込み中...
      </div>
    `;

    try {
      const data = await invokeAdminAlias("review-history");
      const items = Array.isArray(data.items) ? data.items : [];

      if (!items.length) {
        list.innerHTML = `
          <div class="alias-review-history-empty">
            まだレビュー履歴はありません。
          </div>
        `;
        return;
      }

      list.innerHTML = items.map(item => {
        const label = getAliasReviewCategoryLabel(
          item.suggested_category || item.review_status
        );
        const reviewedAt = formatAliasReviewDate(item.reviewed_at);
        const name = item.poi_name || item.normalized_name || "名称なし";
        const note = item.review_note
          ? `<div class="alias-review-history-note">メモ：${escapeHtml(item.review_note)}</div>`
          : "";

        return `
          <div class="alias-review-history-item">
            <div class="alias-review-history-main">
              <div class="alias-review-history-name">${escapeHtml(name)}</div>
              <div class="alias-review-history-result">→ ${escapeHtml(label)}</div>
            </div>
            <div class="alias-review-history-meta">
              ${escapeHtml(reviewedAt)}
              ${item.reviewed_by ? ` / ${escapeHtml(item.reviewed_by)}` : ""}
            </div>
            ${note}
          </div>
        `;
      }).join("");
    } catch (error) {
      console.error("レビュー履歴取得エラー:", error);
      list.innerHTML = `
        <div class="alias-review-history-empty">
          ${escapeHtml(error?.message || "レビュー履歴の取得に失敗しました。")}
        </div>
      `;
    }
  }

  async function secureLoadAliasDictionaryCandidates() {
    const list = document.getElementById("aliasDictionaryCandidateList");
    if (!list) return;

    list.innerHTML = `
      <div class="alias-dictionary-candidate-empty">
        辞書反映候補を読み込み中...
      </div>
    `;

    try {
      const data = await invokeAdminAlias("dictionary-candidates");
      const candidates = (Array.isArray(data.items) ? data.items : []).filter(item => {
        return (
          item.suggested_category &&
          item.suggested_category !== "HOLD" &&
          item.suggested_category !== "EXCLUDE" &&
          item.dictionary_status !== "adopted" &&
          item.dictionary_status !== "rejected"
        );
      });

      if (!candidates.length) {
        list.innerHTML = `
          <div class="alias-dictionary-candidate-empty">
            まだ辞書反映候補はありません。<br>
            未分類レビューで「休憩・滞在・回遊・注意」に分類すると、ここに表示されます。
          </div>
        `;
        return;
      }

      list.innerHTML = candidates.map(item => {
        const label = getAliasReviewCategoryLabel(item.suggested_category);
        const reviewedAt = formatAliasReviewDate(item.reviewed_at);
        const name = item.poi_name || item.normalized_name || "名称なし";
        const note = item.review_note
          ? `<div class="alias-dictionary-candidate-note">メモ：${escapeHtml(item.review_note)}</div>`
          : "";

        const dictionaryStatus = item.dictionary_status || "none";
        const dictionaryStatusLabel = {
          adopted: "採用済み",
          later: "後で確認",
          rejected: "見送り",
          none: "未判断"
        }[dictionaryStatus] || "未判断";

        return `
          <div class="alias-dictionary-candidate-item">
            <div class="alias-dictionary-candidate-main">
              <div class="alias-dictionary-candidate-name">${escapeHtml(name)}</div>
              <div class="alias-dictionary-candidate-result">→ ${escapeHtml(label)}</div>
            </div>
            <div class="alias-dictionary-candidate-meta">
              ${escapeHtml(reviewedAt)}
              ${item.reviewed_by ? ` / ${escapeHtml(item.reviewed_by)}` : ""}
            </div>
            ${note}
            <div class="alias-dictionary-candidate-status">
              辞書判断：${escapeHtml(dictionaryStatusLabel)}
            </div>
            <div class="alias-dictionary-candidate-actions">
              <button type="button" data-secure-dictionary-id="${escapeHtml(item.id)}" data-secure-dictionary-status="adopted">✅ 採用</button>
              <button type="button" data-secure-dictionary-id="${escapeHtml(item.id)}" data-secure-dictionary-status="later">🕓 後で確認</button>
              <button type="button" data-secure-dictionary-id="${escapeHtml(item.id)}" data-secure-dictionary-status="rejected">🚫 見送り</button>
            </div>
          </div>
        `;
      }).join("");

      list.querySelectorAll("[data-secure-dictionary-id]").forEach(button => {
        button.addEventListener("click", () => {
          secureUpdateAliasDictionaryCandidateStatus(
            button.dataset.secureDictionaryId,
            button.dataset.secureDictionaryStatus
          );
        });
      });
    } catch (error) {
      console.error("辞書反映候補取得エラー:", error);
      list.innerHTML = `
        <div class="alias-dictionary-candidate-empty">
          ${escapeHtml(error?.message || "辞書反映候補の取得に失敗しました。")}
        </div>
      `;
    }
  }

  async function secureUpdateAliasDictionaryCandidateStatus(id, status) {
    if (!id) {
      alert("候補IDが取得できませんでした。");
      return;
    }

    const labels = {
      adopted: "採用",
      later: "後で確認",
      rejected: "見送り"
    };
    const label = labels[status] || status;

    if (!confirm(`この候補を「${label}」にしますか？`)) {
      return;
    }

    try {
      await invokeAdminAlias("update-dictionary-status", { id, status });

      if (status === "adopted") {
        alert("辞書に反映しました。");
      } else if (status === "later") {
        alert("後で確認にしました。");
      } else {
        alert("見送りにしました。");
      }

      await secureLoadAliasDictionaryCandidates();
    } catch (error) {
      console.error("辞書候補ステータス更新エラー:", error);
      alert(error?.message || "辞書候補ステータスの更新に失敗しました。");
    }
  }

  // main.js の既存管理者関数を、安全なサーバー経由実装に差し替える。
  window.fetchAliasReviewRemainingCount = secureFetchAliasReviewRemainingCount;
  window.fetchNextAliasReviewItem = secureFetchNextAliasReviewItem;
  window.submitAliasReview = secureSubmitAliasReview;
  window.loadAliasReviewHistory = secureLoadAliasReviewHistory;
  window.loadAliasDictionaryCandidates = secureLoadAliasDictionaryCandidates;
  window.updateAliasDictionaryCandidateStatus = secureUpdateAliasDictionaryCandidateStatus;

  window.CampsiteAdminSecureApi = Object.freeze({
    invoke: invokeAdminAlias
  });
})();
