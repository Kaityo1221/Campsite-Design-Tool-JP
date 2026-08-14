(() => {
  'use strict';

  const STORAGE_KEY = 'fieldModeBasemapRendererV1';
  const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@5.12.0/dist/maplibre-gl.css';
  const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@5.12.0/dist/maplibre-gl.js';
  const MAPLIBRE_LEAFLET_JS = 'https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.3/leaflet-maplibre-gl.js';
  const MAPLIBRE_STYLE = 'https://tiles.openfreemap.org/styles/bright';

  let maplibreLayer = null;
  let osmLayer = null;
  let control = null;

  function getFieldMap() {
    try {
      return map;
    } catch (_) {
      return null;
    }
  }

  function injectStyles() {
    if (!document.getElementById('fieldBasemapSwitchStyles')) {
      const style = document.createElement('style');
      style.id = 'fieldBasemapSwitchStyles';
      style.textContent = `
        .field-basemap-switch.leaflet-bar {
          display: flex;
          overflow: hidden;
          border: 0;
          border-radius: 12px;
          box-shadow: 0 3px 12px rgba(0,0,0,.20);
          background: rgba(255,255,255,.94);
        }
        .field-basemap-switch button {
          min-width: 64px;
          height: 34px;
          padding: 0 10px;
          border: 0;
          border-right: 1px solid rgba(90,105,120,.20);
          background: transparent;
          color: #39516a;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .field-basemap-switch button:last-child { border-right: 0; }
        .field-basemap-switch button[aria-pressed="true"] {
          background: #385f87;
          color: #fff;
        }
        .field-basemap-switch button:disabled {
          opacity: .55;
          cursor: wait;
        }
        @media (max-width: 520px) {
          .field-basemap-switch button {
            min-width: 58px;
            height: 32px;
            padding: 0 8px;
            font-size: 10px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    if (!document.getElementById('fieldMapLibreCss')) {
      const link = document.createElement('link');
      link.id = 'fieldMapLibreCss';
      link.rel = 'stylesheet';
      link.href = MAPLIBRE_CSS;
      document.head.appendChild(link);
    }
  }

  function loadScriptOnce(id, src) {
    return new Promise((resolve, reject) => {
      const existing = document.getElementById(id);
      if (existing) {
        if (existing.dataset.loaded === '1') {
          resolve();
          return;
        }
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
      script.addEventListener('load', () => {
        script.dataset.loaded = '1';
        resolve();
      }, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.appendChild(script);
    });
  }

  async function ensureMapLibre() {
    injectStyles();

    if (!window.maplibregl) {
      await loadScriptOnce('fieldMapLibreJs', MAPLIBRE_JS);
    }

    if (typeof L.maplibreGL !== 'function') {
      await loadScriptOnce('fieldMapLibreLeafletJs', MAPLIBRE_LEAFLET_JS);
    }

    if (typeof L.maplibreGL !== 'function') {
      throw new Error('MapLibre Leaflet binding could not be loaded.');
    }
  }

  function findOsmLayer(fieldMap) {
    let found = null;
    fieldMap.eachLayer(layer => {
      if (found || !(layer instanceof L.TileLayer)) return;
      const url = layer?._url || '';
      if (/openstreetmap\.org/i.test(url)) found = layer;
    });
    return found;
  }

  function setButtonState(mode, loading = false) {
    if (!control?._container) return;
    control._container.querySelectorAll('[data-field-basemap]').forEach(button => {
      button.disabled = loading;
      button.setAttribute('aria-pressed', button.dataset.fieldBasemap === mode ? 'true' : 'false');
    });
  }

  function saveMode(mode) {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch (_) {}
  }

  function readMode() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'maplibre' ? 'maplibre' : 'leaflet';
    } catch (_) {
      return 'leaflet';
    }
  }

  function setStatus(message) {
    const status = document.getElementById('fieldModeStatus');
    if (status) status.textContent = message;
  }

  async function switchBasemap(mode) {
    const fieldMap = getFieldMap();
    if (!fieldMap) return;

    if (mode === 'leaflet') {
      if (maplibreLayer && fieldMap.hasLayer(maplibreLayer)) {
        fieldMap.removeLayer(maplibreLayer);
      }
      if (osmLayer && !fieldMap.hasLayer(osmLayer)) {
        osmLayer.addTo(fieldMap);
      }
      setButtonState('leaflet');
      saveMode('leaflet');
      return;
    }

    setButtonState('maplibre', true);
    setStatus('MapLibre読込中');

    try {
      await ensureMapLibre();

      if (!maplibreLayer) {
        maplibreLayer = L.maplibreGL({
          style: MAPLIBRE_STYLE,
          attributionControl: false,
          interactive: false
        });
      }

      if (osmLayer && fieldMap.hasLayer(osmLayer)) {
        fieldMap.removeLayer(osmLayer);
      }
      if (!fieldMap.hasLayer(maplibreLayer)) {
        maplibreLayer.addTo(fieldMap);
      }

      setButtonState('maplibre');
      saveMode('maplibre');
      setStatus('MapLibre表示');
    } catch (error) {
      console.warn('MapLibre切替エラー:', error);
      if (osmLayer && !fieldMap.hasLayer(osmLayer)) {
        osmLayer.addTo(fieldMap);
      }
      setButtonState('leaflet');
      saveMode('leaflet');
      setStatus('通常地図へ復帰');
    }
  }

  function createControl(fieldMap) {
    const BasemapControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd() {
        const container = L.DomUtil.create('div', 'field-basemap-switch leaflet-bar');
        container.setAttribute('role', 'group');
        container.setAttribute('aria-label', '背景地図を切り替える');
        container.innerHTML = `
          <button type="button" data-field-basemap="leaflet" aria-pressed="true">通常</button>
          <button type="button" data-field-basemap="maplibre" aria-pressed="false">MapLibre</button>
        `;

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        container.querySelectorAll('[data-field-basemap]').forEach(button => {
          button.addEventListener('click', () => switchBasemap(button.dataset.fieldBasemap));
        });

        return container;
      }
    });

    control = new BasemapControl();
    control.addTo(fieldMap);
  }

  function setup() {
    const fieldMap = getFieldMap();
    if (!fieldMap || !window.L) return false;

    osmLayer = findOsmLayer(fieldMap);
    if (!osmLayer) return false;

    injectStyles();
    createControl(fieldMap);

    if (readMode() === 'maplibre') {
      switchBasemap('maplibre');
    } else {
      setButtonState('leaflet');
    }

    return true;
  }

  const timer = setInterval(() => {
    if (setup()) clearInterval(timer);
  }, 80);
  setTimeout(() => clearInterval(timer), 10000);
})();
