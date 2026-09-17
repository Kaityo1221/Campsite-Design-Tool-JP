/* Ensure Leaflet fits PRE-CHECK data after the mobile map has its real size. */
(function () {
  "use strict";
  if (!window.L?.Map?.prototype || window.__adminReviewFitFixInstalled) return;

  const proto = window.L.Map.prototype;
  const originalFitBounds = proto.fitBounds;
  if (typeof originalFitBounds !== "function") return;

  proto.fitBounds = function (bounds, options) {
    try {
      const container = this.getContainer?.();
      if (container?.id === "arwMap") this.invalidateSize(false);
    } catch (_) {}
    return originalFitBounds.call(this, bounds, options);
  };

  window.__adminReviewFitFixInstalled = true;
})();
