(() => {
  'use strict';

  let installed = false;
  let readyToken = 0;
  let resizeTimer = null;
  let resizeObserver = null;
  let lastObservedSize = '';

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
      map.invalidateSize({ animate: false, pan: false, debounceMoveend: false });
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

  function redrawTileLayers(map) {
    activeTileLayers(map).forEach(layer => {
      try {
        layer.redraw();
      } catch (_error) {}
    });
  }

  function currentTilesLoaded(layer) {
    try {
      const tiles = Object.values(layer?._tiles || {}).filter(tile => tile && tile.current !== false);
      if (!tiles.length) return false;

      return tiles.every(tile => {
        const image = tile.el;
        const loaded = Boolean(tile.loaded);
        const imageReady = !image || (image.complete && Number(image.naturalWidth || 0) > 0);
        return loaded && imageReady;
      });
    } catch (_error) {
      return false;
    }
  }

  function tileLayersSettled(map) {
    const layers = activeTileLayers(map);
    if (!layers.length) return true;

    return layers.every(layer => {
      try {
        const notLoading = typeof layer.isLoading === 'function' ? !layer.isLoading() : true;
        return notLoading && currentTilesLoaded(layer);
      } catch (_error) {
        return false;
      }
    });
  }

  function hardRepair(map, { refitBounds = true, redraw = true } = {}) {
    if (!map) return;

    invalidate(map);
    if (refitBounds) refit(map);
    invalidate(map);
    if (redraw) redrawTileLayers(map);

    requestAnimationFrame(() => {
      invalidate(map);
      if (refitBounds) refit(map);
    });
  }

  function preparePreviewMap() {
    const map = getPreviewMap();
    if (!map) return;

    const token = ++readyToken;
    const shield = ensureShield();
    const started = performance.now();
    let stablePasses = 0;
    let redrawRounds = 0;

    // Wait for iOS Safari to finish layout, then rebuild Leaflet's tile grid.
    [0, 80, 220, 480, 900, 1500].forEach((delay, index) => {
      window.setTimeout(() => {
        if (token !== readyToken) return;
        hardRepair(map, {
          refitBounds: index === 1 || index === 3 || index === 5,
          redraw: index === 1 || index === 3 || index === 5
        });
      }, delay);
    });

    const check = () => {
      if (token !== readyToken) return;

      invalidate(map);
      const elapsed = performance.now() - started;
      const settled = tileLayersSettled(map);

      if (settled) stablePasses += 1;
      else stablePasses = 0;

      // Require several consecutive settled checks. This avoids revealing the
      // map after an old, too-small tile grid has merely finished loading.
      if (stablePasses >= 4 && elapsed >= 700) {
        hardRepair(map, { refitBounds: true, redraw: false });
        window.setTimeout(() => {
          if (token !== readyToken) return;
          invalidate(map);
          revealShield(shield);
        }, 180);
        return;
      }

      // If Safari reports loading complete but the current tile set is still
      // incomplete, force a fresh tile grid rather than waiting on stale tiles.
      if (!settled && elapsed > 1200 && redrawRounds < 3) {
        redrawRounds += 1;
        hardRepair(map, { refitBounds: redrawRounds === 1, redraw: true });
      }

      // Do not show a visibly fragmented map. After a longer wait, do one last
      // rebuild and keep the shield briefly before revealing.
      if (elapsed >= 9000) {
        hardRepair(map, { refitBounds: true, redraw: true });
        window.setTimeout(() => {
          if (token !== readyToken) return;
          invalidate(map);
          revealShield(shield);
        }, 900);
        return;
      }

      window.setTimeout(check, 140);
    };

    window.setTimeout(check, 180);
  }

  function repairVisibleMap({ refitBounds = false, hard = false } = {}) {
    const map = getPreviewMap();
    if (!map) return;

    if (hard) {
      const shield = ensureShield();
      hardRepair(map, { refitBounds, redraw: true });
      window.setTimeout(() => {
        hardRepair(map, { refitBounds, redraw: true });
      }, 180);
      window.setTimeout(() => revealShield(shield), 650);
      return;
    }

    invalidate(map);
    if (refitBounds) refit(map);
    window.setTimeout(() => invalidate(map), 120);
    window.setTimeout(() => invalidate(map), 420);
  }

  function observeContainer() {
    const host = document.getElementById('capacityPreviewMap');
    if (!host || typeof ResizeObserver === 'undefined') return;

    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;

      const rect = entry.contentRect;
      const signature = `${Math.round(rect.width)}x${Math.round(rect.height)}`;
      if (!rect.width || !rect.height || signature === lastObservedSize) return;
      lastObservedSize = signature;

      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        repairVisibleMap({ refitBounds: true, hard: true });
      }, 90);
    });

    resizeObserver.observe(host);
  }

  function install() {
    if (installed) return true;
    const original = window.renderCapacityPreviewBaseMap;
    if (typeof original !== 'function') return false;

    window.renderCapacityPreviewBaseMap = function placementStrategyReadyPreview(...args) {
      const result = original.apply(this, args);
      window.setTimeout(() => {
        observeContainer();
        preparePreviewMap();
      }, 0);
      return result;
    };

    window.addEventListener('placementstrategy:mapmode', () => {
      repairVisibleMap({ hard: true });
    });

    window.addEventListener('orientationchange', () => {
      window.setTimeout(() => repairVisibleMap({ refitBounds: true, hard: true }), 220);
    });

    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => repairVisibleMap({ hard: true }), 180);
    });

    window.addEventListener('pageshow', event => {
      if (event.persisted) window.setTimeout(() => repairVisibleMap({ hard: true }), 80);
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) window.setTimeout(() => repairVisibleMap({ hard: true }), 80);
    });

    window.CampsitePlacementMapReady = Object.freeze({
      prepare: preparePreviewMap,
      repair: repairVisibleMap,
      redraw: () => {
        const map = getPreviewMap();
        if (map) hardRepair(map, { refitBounds: true, redraw: true });
      }
    });

    installed = true;
    observeContainer();
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
