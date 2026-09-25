;(() => {
  // iPhone color policy: Campsite Bridge collects/classifies/sends POIs only.
  // Visual POI coloring is delegated to WFMM. Keep Bridge's data pipeline active,
  // but suppress every Bridge-owned game-entity marker on iPhone/iPad Safari.
  const ua = String(navigator?.userAgent || '');
  if (!/iPhone|iPad|iPod/i.test(ua)) return;

  const STYLE_ID = 'campsite-bridge-iphone-wfmm-color-policy';
  const LEGACY_ROOT_IDS = [
    'campsite-bridge-iphone-latest-colors',
    'campsite-bridge-iphone-dom-overlay',
    'campsite-bridge-iphone-forced-poi-colors',
    'campsite-bridge-iphone-map-anchored-poi',
    'campsite-bridge-iphone-pane-locked-poi',
    'campsite-bridge-poi-colors'
  ];

  function ensurePolicyStyle() {
    let style = document.getElementById(STYLE_ID);
    if (style) return style;
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [data-cbs-game-entity],
      #campsite-bridge-iphone-latest-colors,
      #campsite-bridge-iphone-dom-overlay,
      #campsite-bridge-iphone-forced-poi-colors,
      #campsite-bridge-iphone-map-anchored-poi,
      #campsite-bridge-iphone-pane-locked-poi,
      #campsite-bridge-poi-colors {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
    return style;
  }

  function removeLegacyRoots() {
    for (const id of LEGACY_ROOT_IDS) {
      try { document.getElementById(id)?.remove?.(); } catch (_) {}
    }
  }

  ensurePolicyStyle();
  removeLegacyRoots();
  setTimeout(removeLegacyRoots, 250);
  setTimeout(removeLegacyRoots, 1200);

  window.CampsiteBridgeIPhonePoiColorPolicy = Object.freeze({
    provider: 'WFMM',
    bridgeColors: false,
    collection: true,
    classification: true,
    export: true
  });
})();
