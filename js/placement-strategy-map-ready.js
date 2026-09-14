(() => {
  'use strict';

  let installed = false;
  let readyToken = 0;
  let resizeTimer = null;

  function getPreviewMap() {
    try {
      return capacityPreviewMapInstance || null;
    } catch (_error) {
      return null;
    }
  }

  function getPolygon() {
    try {
      return capacityState?.polygon || [];
    } catch (_error) {
      return [];
    }
  }

  function ensureShield() {
    const host = document.getElementById('capacityPreviewMap');
    if (!host) return null;

    let shield = host.querySelector('.placement-map-ready-shield');
    if (!shield) {
      shield = document.createElement('div');
      shield.className = 'placement-map-ready-shield';
      shield.setAttribute('role', 'status');
      shield.setAttribute('aria-live', 'polite');
      shield.innerHTML = `
        <div class="placement-map-ready-shield__inner">
          <div class="placement-map-ready-shield__spinner" aria-hidden="true"></div>
          <strong>地図を読み込み中…</strong>
          <small>表示サイズと地図タイルを整えています。</small>
        </div>
      `;
      host.appendChild(shield);
    }

    shield.classList.remove('is-ready');
    return shield;
  }

  function revealShield(shield) {
    if (!shield) return;
    shield.classList.add('is-ready');
  }

  function invalidate(map) {
    try {
      map.invalidateSize({ animate: false, pan: false, debounceMoveend: true });
    } catch (_error) {}
  }

  function refit(map) {
    if (!map || typeof L === 'undefined') return;
    const polygon = getPolygon();
    if (!polygon.length) return;

    try {
      const bounds = L.latLngBounds(
        polygon
          .filter(point => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)))
          .map(point => [Number(point.lat), Number(point.lng)])
      );

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [18, 18],
          animate: false
        });
      }
    } catch (_error) {}
  }

  function activeTileLayers(map) {
    const layers = [];
    if (!map || typeof L === 'undefined') return layers;

    try {
      map.eachLayer(layer => {
        if (layer instanceof L.TileLayer && map.hasLayer(layer)) layers.push(layer);
      });
    } catch (_error) {}

    return layers;
  }

  function tileLayersSettled(map) {
    const layers = activeTileLayers(map);
    if (!layers.length) return true;

    return layers.every(layer => {
      try {
        return typeof layer.isLoading === 'function' ? !layer.isLoading() : true;
      } catch (_error) {
        return true;
      }
    });
  }

  function preparePreviewMap() {
    const map = getPreviewMap();
    if (!map) return;

    const token = ++readyToken;
    const shield = ensureShield();
    const started = performance.now();

    // iOS Safari may settle the map container height over several frames.
    const repairs = [0, 80, 220, 480, 900, 1500];
    repairs.forEach((delay, index) => {
      window.setTimeout(() => {
        if (token !== readyToken) return;
        invalidate(map);
        if (index === 1 || index === 3) refit(map);
      }, delay);
    });

    const check = () => {
      if (token !== readyToken) return;

      invalidate(map);
      const elapsed = performance.now() - started;
      const settled = tileLayersSettled(map);

      // Give Leaflet at least a few frames even when tiles are cached.
      if ((settled && elapsed >= 420) || elapsed >= 6500) {
        invalidate(map);
        refit(map);
        window.setTimeout(() => {
          if (token !== readyToken) return;
          invalidate(map);
          revealShield(shield);
        }, 120);
        return;
      }

      window.setTimeout(check, 120);
    };

    window.setTimeout(check, 160);
  }

  function repairVisibleMap({ refitBounds = false } = {}) {
    const map = getPreviewMap();
    if (!map) return;

    invalidate(map);
    if (refitBounds) refit(map);
    window.setTimeout(() => invalidate(map), 120);
    window.setTimeout(() => invalidate(map), 420);
  }

  function install() {
    if (installed) return true;
    const original = window.renderCapacityPreviewBaseMap;
    if (typeof original !== 'function') return false;

    window.renderCapacityPreviewBaseMap = function placementStrategyReadyPreview(...args) {
      const result = original.apply(this, args);
      window.setTimeout(preparePreviewMap, 0);
      return result;
    };

    window.addEventListener('placementstrategy:mapmode', () => {
      repairVisibleMap();
    });

    window.addEventListener('orientationchange', () => {
      window.setTimeout(() => repairVisibleMap({ refitBounds: true }), 220);
    });

    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => repairVisibleMap(), 180);
    });

    window.addEventListener('pageshow', event => {
      if (event.persisted) window.setTimeout(() => repairVisibleMap(), 80);
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) window.setTimeout(() => repairVisibleMap(), 80);
    });

    window.CampsitePlacementMapReady = Object.freeze({
      prepare: preparePreviewMap,
      repair: repairVisibleMap
    });

    installed = true;

    if (getPreviewMap()) preparePreviewMap();
    console.info('[Placement Strategy Map Ready] active');
    return true;
  }

  function waitForBase(attempt = 0) {
    if (install()) return;
    if (attempt >= 120) {
      console.warn('[Placement Strategy Map Ready] preview renderer did not become ready.');
      return;
    }
    window.setTimeout(() => waitForBase(attempt + 1), 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForBase(), { once: true });
  } else {
    waitForBase();
  }
})();
