/* Phase 6 save guard: never persist stale AUTO CHECK or fallback policy. */
(function () {
  "use strict";

  document.addEventListener("click", async event => {
    const button = event.target?.closest?.("#adminReviewWorkspace [data-arr-save]");
    if (!button) return;

    const mapState = document.querySelector("#adminReviewWorkspace #arwMapState");
    const loading = mapState && !mapState.classList.contains("hidden") && String(mapState.textContent || "").trim();
    if (loading) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      alert("KMZの読み込みが完了してから審査結果を保存してください。");
      return;
    }

    if (window.CampsitePolicy?.isUsingFallback?.() === true) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      button.disabled = true;
      try {
        await window.CampsitePolicy.refresh();
        if (window.CampsitePolicy?.isUsingFallback?.() === true) {
          alert("審査ルールをサーバーから確認できませんでした。通信状態を確認してから再度保存してください。");
          return;
        }
        button.disabled = false;
        button.click();
      } catch (error) {
        console.warn("Policy refresh before review save failed", error);
        alert("審査ルールをサーバーから確認できませんでした。通信状態を確認してから再度保存してください。");
      } finally {
        button.disabled = false;
      }
      return;
    }

    // Recalculate against the currently rendered snapshot immediately before save.
    try { window.AdminAutoReview?.run?.(); } catch (error) {
      console.warn("AUTO CHECK refresh before review save failed", error);
    }
  }, true);
})();
