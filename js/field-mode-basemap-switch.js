(() => {
  'use strict';

  const STORAGE_KEY = 'fieldModeBasemapRendererV1';
  const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@5.12.0/dist/maplibre-gl.css';
  const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@5.12.0/dist/maplibre-gl.js';
  const MAPLIBRE_LEAFLET_JS = 'https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.3/leaflet-maplibre-gl.js';
  const MAPLIBRE_STYLE = 'https://tiles.openfreemap.org/styles/bright';

  let maplibreLayer = null;
  let osmLayer = null;
  let switchBar = null;

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
        .field-basemap-row {
          display: none;
          align-items: center;
          justify-content: flex-end;
          gap: 7px;
          margin: 8px 2px 0;
          min-height: 34px;
        }
        .field-mode-ready .field-basemap-row {
          display: flex;
        }
        .field-basemap-label {
          margin-right: 2px;
          color: #746957;
          font-size: 11px;
          font-weight: 800;
        }
        .field-basemap-switch {
          display: inline-flex;
          overflow: hidden;
          border: 1px solid rgba(138,107,49,.35);
          border-radius: 10px;
          background: #fffaf0;
        }
        .field-basemap-switch button {
          min-height: 32px;
          padding: 5px 11px;
          border: 0;
          border-right: 1px solid rgba(138,107,49,.22);
          background: transparent;
          color: #6b552b;
          font: inherit;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .field-basemap-switch button:last-child {
          border-right: 0;
        }
        .field-basemap-switch button[aria-pressed="true"] {
          background: #385f87;
          color: #fff;
        }
        .field-basemap-switch button:disabled {
          opacity: .55;
          cursor: wait;
        }
        @media (max-width: 520px) {
          .field-basemap-row {
            margin-top: 6px;
          }
          .field-basemap-label {
            font-size: 10px;
          }
          .field-basemap-switch button {
            min-height: 30px;
            padding: 4px 9px;
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
    if (!switchBar) return;

    switchBar.querySelectorAll('[data-field-basemap]').forEach(button => {
      button.disabled = loading;
      button.setAttribute(
        'aria-pressed',
        button.dataset.fieldBasemap === mode ? 'true' : 'false'
      );
    });
  }

  function saveMode(mode) {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch (_) {}
  }

  function readMode() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'maplibre'
        ? 'maplibre'
        : 'leaflet';
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

      if (maplibreLayer && fieldMap.hasLayer(maplibreLayer)) {
        fieldMap.removeLayer(maplibreLayer);
      }

      if (osmLayer && !fieldMap.hasLayer(osmLayer)) {
        osmLayer.addTo(fieldMap);
      }

      setButtonState('leaflet');
      saveMode('leaflet');
      setStatus('通常地図へ復帰');
    }
  }

  function createSwitchBar() {
    if (document.getElementById('fieldBasemapRow')) {
      switchBar = document.getElementById('fieldBasemapSwitch');
      return Boolean(switchBar);
    }

    const intro = document.querySelector('.field-mode-intro');
    const stage = document.querySelector('.field-mode-stage');
    if (!intro || !stage) return false;

    const row = document.createElement('div');
    row.id = 'fieldBasemapRow';
    row.className = 'field-basemap-row';
    row.innerHTML = `
      <span class="field-basemap-label">背景地図</span>
      <div
        id="fieldBasemapSwitch"
        class="field-basemap-switch"
        role="group"
        aria-label="背景地図を切り替える"
      >
        <button type="button" data-field-basemap="leaflet" aria-pressed="true">通常</button>
        <button type="button" data-field-basemap="maplibre" aria-pressed="false">MapLibre</button>
      </div>
    `;

    intro.insertAdjacentElement('afterend', row);
    switchBar = row.querySelector('#fieldBasemapSwitch');

    switchBar.querySelectorAll('[data-field-basemap]').forEach(button => {
      button.addEventListener('click', () => {
        switchBasemap(button.dataset.fieldBasemap);
      });
    });

    return true;
  }

  function setup() {
    const fieldMap = getFieldMap();
    if (!fieldMap || !window.L) return false;

    osmLayer = findOsmLayer(fieldMap);
    if (!osmLayer) return false;

    injectStyles();
    if (!createSwitchBar()) return false;

    const savedMode = readMode();
    setButtonState(savedMode);

    if (savedMode === 'maplibre') {
      switchBasemap('maplibre');
    }

    return true;
  }

  const timer = setInterval(() => {
    if (setup()) clearInterval(timer);
  }, 80);

  setTimeout(() => clearInterval(timer), 10000);
})();
