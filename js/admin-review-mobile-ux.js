/* Mobile interaction guard for the admin review workspace.
   - POI details can be dismissed explicitly or by tapping blank map.
   - Starting scope edit dismisses any open POI detail.
   - Scope-edit hit testing itself is handled by mobile layout CSS. */
(function () {
  "use strict";

  if (window.AdminReviewMobileUx) return;

  let queued = false;

  function workspace() {
    return document.getElementById("adminReviewWorkspace");
  }

  function inspector() {
    return document.getElementById("arwInspector");
  }

  function isEditingScope() {
    return Boolean(document.querySelector("#adminReviewWorkspace #adminReviewScopeControl [data-ars-save]"));
  }

  function dismissPoi() {
    inspector()?.classList.add("arw-poi-dismissed");
  }

  function revealPoi() {
    inspector()?.classList.remove("arw-poi-dismissed");
  }

  function ensureCloseButton() {
    const host = inspector();
    if (!host) return;
    const heading = host.querySelector(".arw-poi-name");
    if (!heading) {
      host.classList.remove("arw-poi-dismissed");
      return;
    }
    const panel = heading.closest(".arw-panel");
    if (!panel || panel.querySelector(".arw-poi-close")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "arw-poi-close";
    button.setAttribute("aria-label", "POI情報を閉じる");
    button.textContent = "×";
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      dismissPoi();
    });
    panel.prepend(button);
  }

  function queueEnsure() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      ensureCloseButton();
    });
  }

  document.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest("#adminReviewScopeControl [data-ars-edit]")) {
      dismissPoi();
      return;
    }

    if (isEditingScope()) return;

    const map = target.closest("#arwMap");
    if (!map) return;

    if (target.closest(".leaflet-control")) return;

    if (target.closest(".leaflet-overlay-pane path.leaflet-interactive")) {
      revealPoi();
      queueEnsure();
      return;
    }

    if (!target.closest(".leaflet-marker-icon")) {
      dismissPoi();
    }
  }, true);

  const observer = new MutationObserver(queueEnsure);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("adminreviewscopechange", () => {
    if (isEditingScope()) dismissPoi();
  });

  queueEnsure();

  window.AdminReviewMobileUx = Object.freeze({
    dismissPoi,
    revealPoi,
    isEditingScope
  });
})();
