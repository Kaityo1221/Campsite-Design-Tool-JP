(() => {
  'use strict';

  function currentMode() {
    try {
      return window.CampsitePlacementMapTheme?.getMode?.() || 'normal';
    } catch (_error) {
      return 'normal';
    }
  }

  function syncZoneVisibility(mode) {
    const shouldShow = mode === 'tactical';
    const zones = window.CampsitePlacementZones;
    const toggle = document.getElementById('placementStrategyZoneToggle');

    if (!zones || typeof zones.isVisible !== 'function' || !toggle) return false;

    const isVisible = Boolean(zones.isVisible());
    if (isVisible !== shouldShow) toggle.click();
    return true;
  }

  function syncWhenReady(mode, attempt = 0) {
    if (syncZoneVisibility(mode)) return;
    if (attempt >= 80) return;
    window.setTimeout(() => syncWhenReady(mode, attempt + 1), 50);
  }

  window.addEventListener('placementstrategy:mapmode', event => {
    syncWhenReady(event.detail?.mode || currentMode());
  });

  const boot = () => syncWhenReady(currentMode());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
