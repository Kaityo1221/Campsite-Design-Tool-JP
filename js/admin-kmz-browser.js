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

      // Phase 4: 管理者専用の審査範囲を site_id 単位で保存・再利用する。
      // Map init hook を先に登録するため、ワークスペース本体より先に読み込む。
      await loadStyle("css/admin-review-scope.css?v=1", "campsiteAdminReviewScopeStyle");
      await loadScript("js/admin-review-scope.js?v=1", "campsiteAdminReviewScopeScript");

      // Phase 5: 保存済み審査範囲の内側だけを共有ポリシーで自動チェックする。
      // Scope と同様に地図生成前に hook を登録する。
      await loadStyle("css/admin-auto-review.css?v=1", "campsiteAdminAutoReviewStyle");
      await loadScript("js/admin-auto-review.js?v=1", "campsiteAdminAutoReviewScript");

      await loadScript("js/admin-review-workspace.js?v=1", "campsiteAdminReviewWorkspaceScript");
      await loadScript("js/admin-review-workspace-bridge.js?v=1", "campsiteAdminReviewWorkspaceBridgeScript");
      await loadScript("js/admin-site-review-list.js?v=1", "campsiteAdminSiteReviewListScript");

      // 旧 admin-past-site-state.js はロールバック用にリポジトリへ残すが、Phase 3以降は読み込まない。
      await loadScript("js/admin-poi-freshness.js?v=1", "campsiteAdminPoiFreshnessScript");
      await loadScript("js/ai-review-queue.js?v=1", "campsiteAiReviewQueueScript");
    } catch (error) {
      console.error("管理者機能初期化エラー", error);
    }
  }

  boot();
})();
