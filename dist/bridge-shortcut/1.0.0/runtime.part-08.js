
// Campsite Bridge shared POI color overlay loader.
// Kept as a separate runtime tail so existing Shortcut launchers automatically
// receive the feature through the remotely-fetched runtime without reinstalling.
(() => {
  'use strict';

  const COLOR_OVERLAY_URL = 'https://kaityo1221.github.io/Campsite-Design-Tool-JP/js/bridge-wayfarer-poi-colors.js';

  if (window.__campsiteBridgePoiColorsInstalled) {
    try { window.CampsiteBridgePoiColors?.refresh?.(); } catch (_) {}
    return;
  }
  if (window.__campsiteBridgePoiColorsLoading) return;
  window.__campsiteBridgePoiColorsLoading = true;

  fetch(`${COLOR_OVERLAY_URL}?t=${Date.now()}`, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`POI colors HTTP ${response.status}`);
      return response.text();
    })
    .then(code => {
      if (!code.includes('CampsiteBridgePoiColors')) throw new Error('POI colors validation failed');
      const script = document.createElement('script');
      script.dataset.campsiteBridgePoiColorsRuntime = '1';
      script.textContent = `${code}\n//# sourceURL=campsite-bridge-wayfarer-poi-colors.js`;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
      try { window.CampsiteBridgePoiColors?.refresh?.(); } catch (_) {}
    })
    .catch(error => {
      console.warn('[Campsite Bridge Shortcut] POI color overlay unavailable', error);
    })
    .finally(() => {
      window.__campsiteBridgePoiColorsLoading = false;
    });
})();
