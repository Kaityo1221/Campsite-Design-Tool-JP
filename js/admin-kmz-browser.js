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

  async function boot() {
    try {
      if (!window.CampsiteAdminAuth) {
        await loadScript("js/admin-auth.js?v=1", "campsiteAdminAuthScript");
      }

      if (!window.CampsiteAdminSecureApi) {
        await loadScript("js/admin-secure-api.js?v=1", "campsiteAdminSecureApiScript");
      }

      await loadScript("js/admin-kmz-browser-v2.js?v=2", "campsiteAdminKmzBrowserV2Script");
      await loadScript("js/admin-mobile-folders.js?v=3", "campsiteAdminMobileFoldersScript");
      await loadScript("js/ai-review-queue.js?v=1", "campsiteAiReviewQueueScript");
    } catch (error) {
      console.error("管理者機能初期化エラー", error);
    }
  }

  boot();
})();
