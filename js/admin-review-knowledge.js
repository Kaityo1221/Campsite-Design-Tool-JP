/* Phase 6 compatibility shim.
   The legacy localStorage review recorder is intentionally disabled.
   Final admin review records are now stored server-side by admin-review-records.js.
*/
(function () {
  "use strict";
  if (window.CampsiteAdminReviewRecords) return;
  window.CampsiteAdminReviewRecords = Object.freeze({
    load: () => [],
    refresh: () => undefined,
    storage: "server-workspace"
  });
})();
