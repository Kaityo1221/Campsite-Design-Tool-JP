(async () => {
  'use strict';

  const BASE = 'https://kaityo1221.github.io/Campsite-Design-Tool-JP/js/bridge-shortcut/';
  const PANEL_ID = 'campsite-bridge-089-panel';
  const TIMEOUT_MS = 8000;

  const finish = payload => {
    try {
      completion(payload);
    } catch (_) {}
  };

  try {
    const isWayfarer = /(^|\.)wayfarer\.(nianticlabs\.com|scopely\.com)$/i.test(location.hostname);
    if (!isWayfarer) {
      alert('SafariでWayfarerを開いてからCampsite Bridgeを実行してください。');
      finish({ ok: false, reason: 'not-wayfarer' });
      return;
    }

    if (document.getElementById(PANEL_ID)) {
      finish({ ok: true, alreadyRunning: true });
      return;
    }

    const manifestResponse = await fetch(`${BASE}manifest.json?v=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!manifestResponse.ok) {
      throw new Error(`manifest HTTP ${manifestResponse.status}`);
    }

    const manifest = await manifestResponse.json();
    if (!manifest || !Array.isArray(manifest.parts) || manifest.parts.length === 0) {
      throw new Error('manifest.parts is empty');
    }

    let code = '';
    for (const part of manifest.parts) {
      const partUrl = `${BASE}${encodeURIComponent(part)}?v=${encodeURIComponent(manifest.version || '')}&t=${Date.now()}`;
      const response = await fetch(partUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`${part} HTTP ${response.status}`);
      }
      code += `${await response.text()}\n`;
    }

    const script = document.createElement('script');
    script.dataset.campsiteBridgeShortcut = String(manifest.version || 'remote');
    script.textContent = `${code}\n//# sourceURL=campsite-bridge-shortcut-${manifest.version || 'remote'}.js`;
    (document.head || document.documentElement).appendChild(script);
    script.remove();

    const startedAt = Date.now();
    while (Date.now() - startedAt < TIMEOUT_MS) {
      if (document.getElementById(PANEL_ID)) {
        finish({ ok: true, version: manifest.version || null });
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('Campsite Bridge panel did not appear');
  } catch (error) {
    console.error('[Campsite Bridge Shortcut]', error);
    alert(`Campsite Bridgeを起動できませんでした。\n${error?.message || error}`);
    finish({ ok: false, reason: String(error?.message || error) });
  }
})();
