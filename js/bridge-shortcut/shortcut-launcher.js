(async () => {
  'use strict';

  const RUNTIME_URL = 'https://kaityo1221.github.io/Campsite-Design-Tool-JP/js/bridge-shortcut/campsite-bridge-shortcut-runtime.js';
  const POI_COLORS_URL = 'https://kaityo1221.github.io/Campsite-Design-Tool-JP/js/bridge-wayfarer-poi-colors.js';
  const WAYFARER_HOST = /(^|\.)wayfarer\.(nianticlabs\.com|scopely\.com)$/i;

  const finish = value => {
    try { completion(value); } catch (_) {}
  };

  function inject(code, source, datasetKey) {
    const script = document.createElement('script');
    if (datasetKey) script.dataset[datasetKey] = '1';
    script.textContent = `${code}\n//# sourceURL=${source}`;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  try {
    if (!WAYFARER_HOST.test(location.hostname)) {
      alert('SafariでWayfarerを開いてからCampsite Bridgeを実行してください。');
      finish({ ok: false, reason: 'not-wayfarer' });
      return;
    }

    const response = await fetch(`${RUNTIME_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`runtime HTTP ${response.status}`);

    const code = await response.text();
    if (!code.includes("const BRIDGE_VERSION = '")) {
      throw new Error('runtime validation failed');
    }

    inject(code, 'campsite-bridge-shortcut-runtime.js', 'campsiteBridgeShortcutLauncher');

    // Visual enhancement is deliberately non-fatal. Bridge send/receive must
    // remain available even if the optional color overlay cannot be fetched.
    try {
      const visualResponse = await fetch(`${POI_COLORS_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!visualResponse.ok) throw new Error(`visuals HTTP ${visualResponse.status}`);
      const visualCode = await visualResponse.text();
      if (!visualCode.includes('__campsiteBridgePoiColorsInstalled')) {
        throw new Error('visuals validation failed');
      }
      inject(visualCode, 'campsite-bridge-wayfarer-poi-colors.js', 'campsiteBridgePoiColorsLauncher');
    } catch (visualError) {
      console.warn('[Campsite Bridge Shortcut] POI color overlay unavailable', visualError);
    }

    finish({ ok: true });
  } catch (error) {
    console.error('[Campsite Bridge Shortcut Launcher]', error);
    alert(`Campsite Bridgeを起動できませんでした。\n${error?.message || error}`);
    finish({ ok: false, reason: String(error?.message || error) });
  }
})();
