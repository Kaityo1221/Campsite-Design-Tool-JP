/* CAMP: AI要確認レビューキュー
 * AIが断定しなかった pending POI を、管理者セッション付き
 * Edge Function admin-alias-access 経由で安全に絞り込む。
 */
(function () {
  "use strict";

  let reviewMode = "ai";

  async function invokeSecure(action, payload = {}) {
    if (!window.CampsiteAdminSecureApi?.invoke) {
      throw new Error("管理者レビューAPIを読み込めませんでした。");
    }

    return window.CampsiteAdminSecureApi.invoke(action, payload);
  }

  window.fetchAliasReviewRemainingCount = async function () {
    try {
      const data = await invokeSecure("remaining-count", {
        reviewMode
      });
      return Number(data.count) || 0;
    } catch (error) {
      console.error("AI要確認レビュー残数取得エラー:", error);
      if (typeof setAliasReviewStatus === "function") {
        setAliasReviewStatus(error?.message || "AI要確認件数の取得に失敗しました。", "error");
      }
      return 0;
    }
  };

  window.fetchNextAliasReviewItem = async function () {
    try {
      const data = await invokeSecure("next-items", {
        reviewMode
      });
      const items = Array.isArray(data.items) ? data.items : [];

      if (!items.length) return null;

      const skipped =
        typeof aliasReviewSkippedIds !== "undefined" && Array.isArray(aliasReviewSkippedIds)
          ? aliasReviewSkippedIds
          : [];

      const nextItem = items.find(item => {
        return !skipped.includes(String(item.id));
      });

      if (nextItem) return nextItem;

      if (typeof aliasReviewSkippedIds !== "undefined") {
        aliasReviewSkippedIds = [];
      }

      return items[0] || null;
    } catch (error) {
      console.error("AI要確認レビュー取得エラー:", error);
      if (typeof setAliasReviewStatus === "function") {
        setAliasReviewStatus(error?.message || "AI要確認POIの取得に失敗しました。", "error");
      }
      return null;
    }
  };

  const originalRenderAliasReviewItem = window.renderAliasReviewItem;

  if (typeof originalRenderAliasReviewItem === "function") {
    window.renderAliasReviewItem = function (item, remainingCount) {
      originalRenderAliasReviewItem(item, remainingCount);

      const remainingEl = document.getElementById("aliasReviewRemainingCount");
      if (remainingEl) {
        remainingEl.textContent =
          reviewMode === "ai"
            ? `🤖 AI要確認 残り ${remainingCount}件`
            : `🧩 未分類 残り ${remainingCount}件`;
      }

      const badge = document.getElementById("aiReviewQueueCardBadge");
      if (badge) {
        badge.style.display = reviewMode === "ai" && item ? "block" : "none";
      }
    };
  }

  async function getPendingCounts() {
    try {
      const [allData, aiData] = await Promise.all([
        invokeSecure("remaining-count", { reviewMode: "all" }),
        invokeSecure("remaining-count", { reviewMode: "ai" })
      ]);

      return {
        all: Number(allData.count) || 0,
        ai: Number(aiData.count) || 0
      };
    } catch (error) {
      console.error("AIレビュー件数取得エラー:", error);
      return { all: 0, ai: 0 };
    }
  }

  async function refreshModeButtons() {
    const counts = await getPendingCounts();
    const aiButton = document.getElementById("aiReviewQueueOnlyButton");
    const allButton = document.getElementById("aiReviewQueueAllButton");

    if (aiButton) {
      aiButton.textContent = `🤖 AI要確認 ${counts.ai}件`;
      aiButton.style.opacity = reviewMode === "ai" ? "1" : "0.62";
      aiButton.style.borderColor = reviewMode === "ai" ? "#a78bfa" : "#475569";
    }

    if (allButton) {
      allButton.textContent = `🧩 すべての未分類 ${counts.all}件`;
      allButton.style.opacity = reviewMode === "all" ? "1" : "0.62";
      allButton.style.borderColor = reviewMode === "all" ? "#38bdf8" : "#475569";
    }
  }

  async function changeReviewMode(nextMode) {
    reviewMode = nextMode === "all" ? "all" : "ai";

    if (typeof aliasReviewSkippedIds !== "undefined") {
      aliasReviewSkippedIds = [];
    }

    await refreshModeButtons();

    if (typeof loadAliasReviewCard === "function") {
      await loadAliasReviewCard();
    }
  }

  function injectReviewControls() {
    const panel = document.getElementById("aliasReviewPanel");
    if (!panel || document.getElementById("aiReviewQueueControls")) return;

    const guide = panel.querySelector(".alias-review-guide");
    if (!guide) return;

    const controls = document.createElement("div");
    controls.id = "aiReviewQueueControls";
    controls.style.cssText = [
      "margin:12px 0 16px",
      "padding:12px",
      "border-radius:14px",
      "background:rgba(124,58,237,0.12)",
      "border:1px solid rgba(167,139,250,0.35)"
    ].join(";");

    controls.innerHTML = `
      <div style="font-weight:800;color:#ddd6fe;margin-bottom:8px;">
        🤖 AI一次判定レビュー
      </div>
      <div style="font-size:13px;line-height:1.7;color:#cbd5e1;margin-bottom:10px;">
        AIが名前だけでは断定しなかったPOIを優先表示します。<br>
        ここで判定するとAI要確認リストから自動で消えます。
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button
          type="button"
          id="aiReviewQueueOnlyButton"
          style="padding:9px 12px;border-radius:10px;border:1px solid #a78bfa;background:#312e81;color:white;font-weight:700;"
        >🤖 AI要確認</button>
        <button
          type="button"
          id="aiReviewQueueAllButton"
          style="padding:9px 12px;border-radius:10px;border:1px solid #475569;background:#1e293b;color:white;font-weight:700;"
        >🧩 すべての未分類</button>
      </div>
    `;

    guide.parentNode.insertBefore(controls, guide);

    const card = document.getElementById("aliasReviewCard");
    if (card) {
      const badge = document.createElement("div");
      badge.id = "aiReviewQueueCardBadge";
      badge.textContent = "🤖 AIでは断定せず、人間確認に回したPOI";
      badge.style.cssText = [
        "display:none",
        "margin-bottom:10px",
        "padding:7px 9px",
        "border-radius:9px",
        "background:rgba(124,58,237,0.18)",
        "border:1px solid rgba(167,139,250,0.35)",
        "color:#ddd6fe",
        "font-size:12px",
        "font-weight:700"
      ].join(";");
      card.insertBefore(badge, card.firstChild);
    }

    document
      .getElementById("aiReviewQueueOnlyButton")
      ?.addEventListener("click", () => changeReviewMode("ai"));

    document
      .getElementById("aiReviewQueueAllButton")
      ?.addEventListener("click", () => changeReviewMode("all"));

    refreshModeButtons();
  }

  const originalSubmitAliasReview = window.submitAliasReview;

  if (typeof originalSubmitAliasReview === "function") {
    window.submitAliasReview = async function (category) {
      await originalSubmitAliasReview(category);
      await refreshModeButtons();
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectReviewControls, { once: true });
  } else {
    injectReviewControls();
  }
})();
