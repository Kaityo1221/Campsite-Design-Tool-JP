/* Phase 6 save guard: never persist a stale AUTO CHECK while a history snapshot is still loading. */
(function () {
  "use strict";

  document.addEventListener("click", event => {
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

    // Recalculate against the currently rendered snapshot immediately before save.
    try { window.AdminAutoReview?.run?.(); } catch (error) {
      console.warn("AUTO CHECK refresh before review save failed", error);
    }
  }, true);
})();
