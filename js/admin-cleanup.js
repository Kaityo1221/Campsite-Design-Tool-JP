/* ======================================================
   Phase 7: Admin cleanup / information architecture

   - Remove retired Campsite-side research review UI
   - Remove the legacy MAP VIEWER launch surface
   - Keep backfill as a maintenance-only tool, not a primary review action
   - Creator inference remains available for legacy records
====================================================== */
(function () {
  "use strict";

  if (window.CampsiteAdminCleanup) return;

  const STYLE_ID = "campsiteAdminCleanupStyles";
  const MAINTENANCE_ID = "adminMaintenanceTools";

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .admin-kmz-map-launch{display:none!important}
      #${MAINTENANCE_ID}{margin:18px 0 0;border:1px solid rgba(148,163,184,.18);border-radius:14px;background:rgba(15,23,42,.42);overflow:hidden}
      #${MAINTENANCE_ID}>summary{padding:13px 15px;cursor:pointer;list-style:none;color:#cbd5e1;font-size:13px;font-weight:900;user-select:none}
      #${MAINTENANCE_ID}>summary::-webkit-details-marker{display:none}
      #${MAINTENANCE_ID}>summary::after{content:"⌄";float:right;color:#7dd3fc;font-size:16px;transition:transform .18s ease}
      #${MAINTENANCE_ID}[open]>summary::after{transform:rotate(180deg)}
      #${MAINTENANCE_ID}>.admin-maintenance-copy{margin:-3px 15px 12px;color:#64748b;font-size:11px;line-height:1.6}
      #${MAINTENANCE_ID}>#adminPoiBackfillCard{margin:0 12px 12px}
    `;
    document.head.appendChild(style);
  }

  function removeRetiredUi() {
    // Research Review Room / dictionary-candidate review now belongs to POI Master.
    document.getElementById("aliasReviewAdminBox")?.remove();

    // Phase 3 workspace replaced the standalone MAP VIEWER.
    document.querySelectorAll("[data-admin-kmz-map-launch], .admin-kmz-map-launch")
      .forEach(node => node.remove());
  }

  function ensureMaintenanceTools() {
    const card = document.getElementById("adminPoiBackfillCard");
    if (!card) return;

    let details = document.getElementById(MAINTENANCE_ID);
    if (!details) {
      const panel = document.querySelector("#admin .panel");
      if (!panel) return;

      details = document.createElement("details");
      details.id = MAINTENANCE_ID;
      details.innerHTML = `
        <summary>🧰 管理ツール / メンテナンス</summary>
        <p class="admin-maintenance-copy">通常の審査では使いません。過去データの復旧や未処理データがある時だけ開きます。</p>`;
      panel.appendChild(details);
    }

    if (card.parentElement !== details) details.appendChild(card);
  }

  function clean() {
    ensureStyles();
    removeRetiredUi();
    ensureMaintenanceTools();
  }

  clean();

  const observer = new MutationObserver(() => {
    requestAnimationFrame(clean);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.CampsiteAdminCleanup = Object.freeze({ refresh: clean });
})();
