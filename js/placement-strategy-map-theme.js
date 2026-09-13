(() => {
  'use strict';

  const MODES = Object.freeze({
    normal: 'normal',
    tactical: 'tactical'
  });

  let installed = false;
  let mode = MODES.normal;

  function getMapEntries() {
    const entries = [];

    try {
      if (capacityMapInstance) {
        entries.push({ id: 'capacityMap', map: capacityMapInstance });
      }
    } catch (_error) {}

    try {
      if (capacityPreviewMapInstance) {
        entries.push({ id: 'capacityPreviewMap', map: capacityPreviewMapInstance });
      }
    } catch (_error) {}

    return entries;
  }

  function applyModeToContainer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const tactical = mode === MODES.tactical;
    container.classList.toggle('placement-strategy-map--tactical', tactical);
    container.classList.toggle('placement-strategy-map--normal', !tactical);
  }

  function updateControls() {
    document.querySelectorAll('[data-placement-map-mode]').forEach(button => {
      const active = button.dataset.placementMapMode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function announceMode() {
    window.dispatchEvent(new CustomEvent('placementstrategy:mapmode', {
      detail: { mode }
    }));
  }

  function applyMode() {
    applyModeToContainer('capacityMap');
    applyModeToContainer('capacityPreviewMap');
    updateControls();
    announceMode();
  }

  function setMode(nextMode) {
    if (!Object.values(MODES).includes(nextMode)) return;
    mode = nextMode;
    applyMode();
  }

  function buildControl(map, containerId) {
    if (!map || typeof L === 'undefined') return;

    const container = document.getElementById(containerId);
    if (!container || container.querySelector('.placement-map-mode-control')) {
      applyModeToContainer(containerId);
      return;
    }

    const control = L.control({ position: 'bottomleft' });
    control.onAdd = () => {
      const root = L.DomUtil.create('div', 'placement-map-mode-control leaflet-bar');
      root.setAttribute('role', 'group');
      root.setAttribute('aria-label', '地図表示切替');
      root.innerHTML = `
        <button type="button" data-placement-map-mode="normal" aria-pressed="true">🗺 通常地図</button>
        <button type="button" data-placement-map-mode="tactical" aria-pressed="false">🏯 布陣図</button>
      `;

      L.DomEvent.disableClickPropagation(root);
      L.DomEvent.disableScrollPropagation(root);

      root.querySelectorAll('[data-placement-map-mode]').forEach(button => {
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          setMode(button.dataset.placementMapMode);
        });
      });

      return root;
    };

    control.addTo(map);
    applyMode();
  }

  function decorateExistingMaps() {
    getMapEntries().forEach(({ id, map }) => buildControl(map, id));
    applyMode();
  }

  function install() {
    if (installed) return true;

    const originalRenderMap = window.renderCapacityMap;
    const originalRenderPreview = window.renderCapacityPreviewBaseMap;

    if (
      typeof originalRenderMap !== 'function' ||
      typeof originalRenderPreview !== 'function'
    ) {
      return false;
    }

    window.renderCapacityMap = function placementStrategyRenderCapacityMap(...args) {
      const result = originalRenderMap.apply(this, args);
      try {
        buildControl(capacityMapInstance, 'capacityMap');
      } catch (_error) {}
      return result;
    };

    window.renderCapacityPreviewBaseMap = function placementStrategyRenderCapacityPreviewMap(...args) {
      const result = originalRenderPreview.apply(this, args);
      try {
        buildControl(capacityPreviewMapInstance, 'capacityPreviewMap');
      } catch (_error) {}
      return result;
    };

    window.CampsitePlacementMapTheme = Object.freeze({
      modes: MODES,
      getMode: () => mode,
      setMode
    });

    installed = true;
    decorateExistingMaps();
    console.info('[Placement Strategy Map Theme] active', mode);
    return true;
  }

  function waitForBase(attempt = 0) {
    if (install()) return;

    if (attempt >= 120) {
      console.warn('[Placement Strategy Map Theme] map base did not become ready.');
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