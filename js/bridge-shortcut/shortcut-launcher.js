(async () => {
  'use strict';

  const LAUNCHER_VERSION = '1.1.0';
  const RUNTIME_URL = 'https://kaityo1221.github.io/Campsite-Design-Tool-JP/js/bridge-shortcut/campsite-bridge-shortcut-runtime.js';
  const WAYFARER_HOST = /(^|\.)wayfarer\.(nianticlabs\.com|scopely\.com)$/i;
  const PANEL_ID = 'campsite-bridge-shortcut-panel';

  const finish = value => {
    try { completion(value); } catch (_) {}
  };

  const bridgeStarted = () => Boolean(
    document.getElementById(PANEL_ID) ||
    window.CampsiteBridgeShortcut
  );

  async function runRuntime(code) {
    let lastError = null;

    // Safari Shortcuts already executes this launcher as page JavaScript.
    // Execute the downloaded runtime in that same context first. Creating an
    // inline <script> can be silently rejected by Wayfarer's CSP on iPhone.
    try {
      eval(`${code}\n//# sourceURL=campsite-bridge-shortcut-runtime.js`);
    } catch (error) {
      lastError = error;
      console.warn('[Campsite Bridge Shortcut Launcher] direct eval failed', error);
    }
    await Promise.resolve();
    if (bridgeStarted()) return 'eval';

    // Compatibility fallback for browsers where direct eval is unavailable.
    try {
      const runner = new Function(`${code}\n//# sourceURL=campsite-bridge-shortcut-runtime.js`);
      runner.call(window);
    } catch (error) {
      lastError = error;
      console.warn('[Campsite Bridge Shortcut Launcher] Function fallback failed', error);
    }
    await Promise.resolve();
    if (bridgeStarted()) return 'function';

    // Final legacy fallback. Verify the UI actually started because CSP may
    // accept appendChild() while refusing to execute the inline script.
    try {
      const script = document.createElement('script');
      script.dataset.campsiteBridgeShortcutLauncher = '1';
      script.textContent = `${code}\n//# sourceURL=campsite-bridge-shortcut-runtime.js`;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (error) {
      lastError = error;
      console.warn('[Campsite Bridge Shortcut Launcher] script fallback failed', error);
    }
    await new Promise(resolve => setTimeout(resolve, 60));
    if (bridgeStarted()) return 'script';

    const detail = String(lastError?.message || lastError || '').trim();
    throw new Error(detail ? `runtime loaded but Bridge UI did not start: ${detail}` : 'runtime loaded but Bridge UI did not start');
  }

  try {
    if (!WAYFARER_HOST.test(location.hostname)) {
      alert('SafariでWayfarerを開いてからCampsite Bridgeを実行してください。');
      finish({ ok: false, reason: 'not-wayfarer', launcherVersion: LAUNCHER_VERSION });
      return;
    }

    const response = await fetch(`${RUNTIME_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`runtime HTTP ${response.status}`);

    const code = await response.text();
    if (!code.includes("const BRIDGE_VERSION = '")) {
      throw new Error('runtime validation failed');
    }

    const mode = await runRuntime(code);
    finish({ ok: true, launcherVersion: LAUNCHER_VERSION, mode });
  } catch (error) {
    console.error('[Campsite Bridge Shortcut Launcher]', error);
    alert(`Campsite Bridgeを起動できませんでした。\n${error?.message || error}`);
    finish({ ok: false, launcherVersion: LAUNCHER_VERSION, reason: String(error?.message || error) });
  }
})();
