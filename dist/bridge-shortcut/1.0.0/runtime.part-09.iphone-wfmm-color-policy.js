;(() => {
  // Stage 5 iPhone display policy.
  // Bridge no longer scans, recolors, hides or redraws Wayfarer map markers.
  // Wayfarer/WFMM remain the display owners; Bridge stays data-only.
  const ua = String(navigator?.userAgent || '');
  if (!/iPhone|iPad|iPod/i.test(ua)) return;

  window.CampsiteBridgeIPhonePoiColorPolicy = Object.freeze({
    provider: 'WAYFARER_OR_WFMM',
    bridgeColors: false,
    hideWayfarerHollowDots: false,
    legacyDomScanning: false,
    legacyCanvasSampling: false,
    mutationObserver: false,
    polling: false,
    collection: true,
    classification: true,
    export: true
  });
})();
