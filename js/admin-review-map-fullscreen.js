/* Admin PRE-CHECK map fullscreen toggle for mobile.
   Keeps the current center/zoom when switching modes. */
(function () {
  "use strict";

  if (window.AdminReviewMapFullscreen) return;

  let mapRef = null;
  let queued = false;

  function captureAdminMap() {
    if (!window.L?.map || window.L.map.__adminReviewFullscreenWrapped) return;
    const originalMap = window.L.map;
    function wrappedMap(...args) {
      const map = originalMap.apply(this, args);
      try {
        if (map?.getContainer?.()?.id === "arwMap") mapRef = map;
      } catch (_) {}
      return map;
    }
    wrappedMap.__adminReviewFullscreenWrapped = true;
    wrappedMap.__original = originalMap;
    window.L.map = wrappedMap;
  }

  function root() {
    return document.getElementById("adminReviewWorkspace");
  }

  function updateButton(button, fullscreen) {
    if (!button) return;
    button.textContent = fullscreen ? "← 通常表示" : "⛶ 地図を全画面";
    button.setAttribute("aria-label", fullscreen ? "通常表示に戻す" : "地図を全画面表示する");
    button.setAttribute("aria-pressed", fullscreen ? "true" : "false");
  }

  function ensureButton() {
    const workspace = root();
    const wrap = workspace?.querySelector(".arw-map-wrap");
    if (!workspace || !wrap) return null;

    let button = wrap.querySelector(".arw-map-fullscreen-toggle");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "arw-map-fullscreen-toggle";
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        toggle();
      });
      wrap.appendChild(button);
    }
    updateButton(button, workspace.classList.contains("arw-map-fullscreen"));
    return button;
  }

  function resizeMap(center, zoom) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          mapRef?.invalidateSize?.(false);
          if (center && Number.isFinite(zoom)) {
            mapRef?.setView?.(center, zoom, { animate: false });
          }
        } catch (_) {}
        try { window.dispatchEvent(new Event("resize")); } catch (_) {}
      });
    });
  }

  function toggle(force) {
    const workspace = root();
    if (!workspace) return;

    const next = typeof force === "boolean"
      ? force
      : !workspace.classList.contains("arw-map-fullscreen");

    let center = null;
    let zoom = null;
    try {
      center = mapRef?.getCenter?.() || null;
      zoom = mapRef?.getZoom?.();
    } catch (_) {}

    workspace.classList.toggle("arw-map-fullscreen", next);
    updateButton(ensureButton(), next);
    resizeMap(center, zoom);
  }

  function scheduleEnsure() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const workspace = root();
      if (!workspace) return;
      ensureButton();
      if (!workspace.classList.contains("open") && workspace.classList.contains("arw-map-fullscreen")) {
        workspace.classList.remove("arw-map-fullscreen");
        updateButton(ensureButton(), false);
      }
    });
  }

  captureAdminMap();

  const observer = new MutationObserver(scheduleEnsure);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class"]
  });

  window.visualViewport?.addEventListener("resize", () => {
    if (!root()?.classList.contains("arw-map-fullscreen")) return;
    resizeMap(null, null);
  });

  scheduleEnsure();

  window.AdminReviewMapFullscreen = Object.freeze({
    toggle,
    isFullscreen: () => Boolean(root()?.classList.contains("arw-map-fullscreen"))
  });
})();
