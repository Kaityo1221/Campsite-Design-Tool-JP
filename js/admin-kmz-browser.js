/* 管理者機能 セキュアローダー */
(function () {
  "use strict";

  function loadScript(src, id) {
    return new Promise((resolve, reject) => {
      if (document.getElementById(id)) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`${src} を読み込めませんでした。`));
      document.head.appendChild(script);
    });
  }

  function loadStyle(href, id) {
    return new Promise((resolve, reject) => {
      if (document.getElementById(id)) {
        resolve();
        return;
      }

      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`${href} を読み込めませんでした。`));
      document.head.appendChild(link);
    });
  }

  async function boot() {
    try {
      if (!window.CampsiteAdminAuth) {
        await loadScript("js/admin-auth.js?v=1", "campsiteAdminAuthScript");
      }

      if (!window.CampsiteAdminSecureApi) {
        await loadScript("js/admin-secure-api.js?v=1", "campsiteAdminSecureApiScript");
      }

      if (!window.CampsiteAdminPolicyApi) {
        await loadScript("js/admin-policy-api.js?v=1", "campsiteAdminPolicyApiScript");
      }

      // Maintenance / archive helpers. Backfill stays available, but Phase 7 moves it under maintenance UI.
      await loadScript("js/admin-backfill-control.js?v=3", "campsiteAdminBackfillControlScript");
      await loadScript("js/admin-kmz-browser-v2.js?v=2", "campsiteAdminKmzBrowserV2Script");
      await loadScript("js/admin-kmz-card-collapse.js?v=3", "campsiteAdminKmzCardCollapseScript");
      await loadScript("js/admin-mobile-folders.js?v=3", "campsiteAdminMobileFoldersScript");

      // Legacy creator inference is intentionally kept only for old records without direct Discord identity.
      await loadScript("js/admin-kmz-creator-inference.js?v=1", "campsiteAdminKmzCreatorInferenceScript");

      // Phase 7 runtime cleanup removes retired Research Review / MAP VIEWER surfaces and groups maintenance tools.
      await loadScript("js/admin-cleanup.js?v=1", "campsiteAdminCleanupScript");

      await loadScript("js/admin-map-deps.js?v=1", "campsiteAdminMapDepsScript");
      await window.CampsiteAdminMapDeps?.ready?.();

      // Site-centered review workspace.
      await loadStyle("css/admin-review-workspace.css?v=1", "campsiteAdminReviewWorkspaceStyle");

      // Admin-only review scope.
      await loadStyle("css/admin-review-scope.css?v=1", "campsiteAdminReviewScopeStyle");
      await loadScript("js/admin-review-scope.js?v=2", "campsiteAdminReviewScopeScript");

      // Scoped automatic checks.
      await loadStyle("css/admin-auto-review.css?v=1", "campsiteAdminAutoReviewStyle");
      await loadScript("js/admin-auto-review.js?v=3", "campsiteAdminAutoReviewScript");

      await loadScript("js/admin-review-workspace.js?v=2", "campsiteAdminReviewWorkspaceScript");
      await loadScript("js/admin-review-workspace-bridge.js?v=2", "campsiteAdminReviewWorkspaceBridgeScript");
      await loadScript("js/admin-site-review-list.js?v=3", "campsiteAdminSiteReviewListScript");

      // Mobile QA / map-first interaction.
      await loadStyle("css/admin-review-mobile-layout.css?v=5", "campsiteAdminReviewMobileLayoutStyle");
      await loadStyle("css/admin-review-mobile-fit.css?v=1", "campsiteAdminReviewMobileFitStyle");
      await loadStyle("css/admin-review-map-fullscreen.css?v=1", "campsiteAdminReviewMapFullscreenStyle");
      await loadScript("js/admin-review-fit-fix.js?v=1", "campsiteAdminReviewFitFixScript");
      await loadScript("js/admin-review-map-fullscreen.js?v=1", "campsiteAdminReviewMapFullscreenScript");
      await loadScript("js/admin-review-mobile-ux.js?v=2", "campsiteAdminReviewMobileUxScript");

      // PRE-CHECK is the primary result shown immediately when a site opens.
      // The formal FINAL REVIEW UI is intentionally parked; its server-side history remains available for future reuse.
      await loadScript("js/admin-precheck-summary.js?v=3", "campsiteAdminPrecheckSummaryScript");
      await loadScript("js/admin-precheck-polish.js?v=2", "campsiteAdminPrecheckPolishScript");
      await loadScript("js/admin-precheck-tap-fix.js?v=1", "campsiteAdminPrecheckTapFixScript");

      // Phase 7 removed the standalone past-state modal, POI freshness check and Campsite-side AI review queue.
    } catch (error) {
      console.error("管理者機能初期化エラー", error);
    }
  }

  boot();
})();
