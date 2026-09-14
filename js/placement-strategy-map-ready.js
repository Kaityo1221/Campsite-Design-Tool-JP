(() => {
  'use strict';

  const GSI_STD_URL = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png';
  const GSI_ATTRIBUTION = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>';

  let installed = false;
  let tileLayerPatched = false;
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

  function patchBaseTileProvider() {
    if (tileLayerPatched || typeof L === 'undefined' || typeof L.tileLayer !== 'function') return;

    const originalTileLayer = L.tileLayer.bind(L);

    L.tileLayer = function placementStrategyTileLayer(url, options = {}) {
      const source = String(url || '');

      if (source.includes('tile.openstreetmap.org')) {
        return originalTileLayer(GSI_STD_URL, {
          ...options,
          attribution: GSI_ATTRIBUTION,
          maxZoom: Math.min(Number(options.maxZoom || 18), 18),
          updateWhenIdle: true,
          updateWhenZooming: false,
          keepBuffer: 3
        });
      }

      return originalTileLayer(url, options);
    };

    tileLayerPatched = true;
    console.info('[Placement Strategy Map Ready] default base map switched to GSI std');
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
          <small>地図タイルを整えています。</small>
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

  function currentTilesLoaded(layer) {
    try {
      const tiles = Object.values(layer?._tiles || {}).filter(tile => tile && tile.current !== false);
      if (!tiles.length) return false;

      return tiles.every(tile => {
        const image = tile.el;
        return Boolean(tile.loaded) && Boolean(image?.complete) && Number(image?.naturalWidth || 0) > 0;
      });
    } catch (_error) {
      return false;
    }
  }

  function mapTilesSettled(map) {
    const layers = activeTileLayers(map);
    if (!layers.length) return true;

    return layers.every(layer => {
      try {
        const idle = typeof layer.isLoading === 'function' ? !layer.isLoading() : true;
        return idle && currentTilesLoaded(layer);
      } catch (_error) {
        return false;
      }
    });
  }

  function renameBaseLayerLabel() {
    document.querySelectorAll('#capacityPreviewMap .leaflet-control-layers-base label span').forEach(span => {
      if (String(span.textContent || '').includes('OpenStreetMap')) {
        span.textContent = ' 地理院標準地図';
      }
    });
  }

  function settleLayout(map, { refitBounds = false } = {}) {
    if (!map) return;
    invalidate(map);
    if (refitBounds) refit(map);
    requestAnimationFrame(() => invalidate(map));
  }

  function preparePreviewMap({ refitBounds = true } = {}) {
    const map = getPreviewMap();
    if (!map) return;

    const token = ++readyToken;
    const shield = ensureShield();
    const started = performance.now();
    let stablePasses = 0;

    // Only settle layout. Do not repeatedly redraw tile layers while they are loading.
    window.setTimeout(() => settleLayout(map), 40);
    window.setTimeout(() => settleLayout(map, { refitBounds }), 180);
    window.setTimeout(() => settleLayout(map), 420);

    const check = () => {
      if (token !== readyToken) return;

      const elapsed = performance.now() - started;
      const settled = mapTilesSettled(map);
      stablePasses = settled ? stablePasses + 1 : 0;

      if (stablePasses >= 3 && elapsed >= 500) {
        settleLayout(map);
        renameBaseLayerLabel();
        window.setTimeout(() => {
          if (token !== readyToken) return;
          revealShield(shield);
        }, 120);
        return;
      }

      // If a tile request genuinely fails, keep the shield briefly, then reveal
      // the map rather than entering an endless redraw loop.
      if (elapsed >= 7000) {
        settleLayout(map, { refitBounds: false });
        renameBaseLayerLabel();
        revealShield(shield);
        return;
      }

      window.setTimeout(check, 140);
    };

    window.setTimeout(check, 180);
  }

  function repairVisibleMap({ refitBounds = false } = {}) {
    const map = getPreviewMap();
    if (!map) return;

    const shield = ensureShield();
    settleLayout(map, { refitBounds });

    const layers = activeTileLayers(map);
    let waiting = layers.length;

    const done = () => {
      waiting -= 1;
      if (waiting <= 0) {
        settleLayout(map);
        revealShield(shield);
      }
    };

    if (!layers.length) {
      window.setTimeout(() => revealShield(shield), 160);
      return;
    }

    layers.forEach(layer => {
      if (typeof layer.isLoading === 'function' && !layer.isLoading()) {
        done();
        return;
      }
      layer.once('load', done);
      layer.once('tileerror', () => {
        // A later successful load may still arrive. Timeout below is the fallback.
      });
    });

    window.setTimeout(() => {
      settleLayout(map);
      revealShield(shield);
    }, 2600);
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
        settleLayout(getPreviewMap(), { refitBounds: true });
      }, 120);
    });

    resizeObserver.observe(host);
  }

  function install() {
    if (installed) return true;
    if (typeof L === 'undefined') return false;

    patchBaseTileProvider();

    const original = window.renderCapacityPreviewBaseMap;
    if (typeof original !== 'function') return false;

    window.renderCapacityPreviewBaseMap = function placementStrategyReadyPreview(...args) {
      const result = original.apply(this, args);
      window.setTimeout(() => {
        observeContainer();
        renameBaseLayerLabel();
        preparePreviewMap({ refitBounds: true });
      }, 0);
      return result;
    };

    window.addEventListener('placementstrategy:mapmode', () => {
      settleLayout(getPreviewMap());
    });

    window.addEventListener('orientationchange', () => {
      window.setTimeout(() => repairVisibleMap({ refitBounds: true }), 220);
    });

    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => settleLayout(getPreviewMap()), 180);
    });

    window.addEventListener('pageshow', event => {
      if (event.persisted) window.setTimeout(() => repairVisibleMap(), 100);
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) window.setTimeout(() => repairVisibleMap(), 100);
    });

    window.CampsitePlacementMapReady = Object.freeze({
      prepare: preparePreviewMap,
      repair: repairVisibleMap
    });

    installed = true;
    observeContainer();
    if (getPreviewMap()) preparePreviewMap({ refitBounds: false });
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
