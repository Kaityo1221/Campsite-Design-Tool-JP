(async () => {
  'use strict';

  const RUNTIME_URL = 'https://kaityo1221.github.io/Campsite-Design-Tool-JP/js/bridge-shortcut/campsite-bridge-shortcut-runtime.js';
  const WAYFARER_HOST = /(^|\.)wayfarer\.(nianticlabs\.com|scopely\.com)$/i;

  const finish = value => {
    try { completion(value); } catch (_) {}
  };

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

    const script = document.createElement('script');
    script.dataset.campsiteBridgeShortcutLauncher = '1';
    script.textContent = `${code}\n//# sourceURL=campsite-bridge-shortcut-runtime.js`;
    (document.head || document.documentElement).appendChild(script);
    script.remove();

    finish({ ok: true });
  } catch (error) {
    console.error('[Campsite Bridge Shortcut Launcher]', error);
    alert(`Campsite Bridgeを起動できませんでした。\n${error?.message || error}`);
    finish({ ok: false, reason: String(error?.message || error) });
  }
})();
