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

      await loadScript("js/admin-backfill-control.js?v=3", "campsiteAdminBackfillControlScript");
      await loadScript("js/admin-kmz-browser-v2.js?v=2", "campsiteAdminKmzBrowserV2Script");
      await loadScript("js/admin-kmz-card-collapse.js?v=3", "campsiteAdminKmzCardCollapseScript");
      await loadScript("js/admin-mobile-folders.js?v=3", "campsiteAdminMobileFoldersScript");
      await loadScript("js/admin-kmz-creator-inference.js?v=1", "campsiteAdminKmzCreatorInferenceScript");
      await loadScript("js/admin-map-deps.js?v=1", "campsiteAdminMapDepsScript");
      await window.CampsiteAdminMapDeps?.ready?.();

      // Phase 3: 履歴比較を独立モーダルではなく審査ワークスペースへ統合する。
      await loadStyle("css/admin-review-workspace.css?v=1", "campsiteAdminReviewWorkspaceStyle");
      await loadScript("js/admin-review-workspace.js?v=1", "campsiteAdminReviewWorkspaceScript");
      await loadScript("js/admin-review-workspace-bridge.js?v=1", "campsiteAdminReviewWorkspaceBridgeScript");

      // 旧 admin-past-site-state.js はロールバック用にリポジトリへ残すが、Phase 3では読み込まない。
      await loadScript("js/admin-poi-freshness.js?v=1", "campsiteAdminPoiFreshnessScript");
      await loadScript("js/ai-review-queue.js?v=1", "campsiteAiReviewQueueScript");
    } catch (error) {
      console.error("管理者機能初期化エラー", error);
    }
  }

  boot();
})();
