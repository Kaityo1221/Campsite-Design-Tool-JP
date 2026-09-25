(() => {
  'use strict';

  const ADAPTER_KEY = 'campsiteBridgeAdapter.v0.3';
  const REFERENCE_KINDS = new Set(['NOT_IN_GAME', 'INACTIVE_POWERSPOT']);

  function readAdapter() {
    try { return JSON.parse(sessionStorage.getItem(ADAPTER_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function normalizeReference(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const guid = String(raw.guid || '').trim();
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    const referenceKind = String(raw.referenceKind || '').trim().toUpperCase();
    if (!guid || !Number.isFinite(lat) || !Number.isFinite(lng) || !REFERENCE_KINDS.has(referenceKind)) return null;
    return {
      guid,
      title: String(raw.title || ''),
      lat,
      lng,
      referenceKind,
      gameEntity: String(raw.gameEntity || '').trim().toUpperCase(),
      gameStatus: String(raw.gameStatus || 'UNKNOWN').trim().toUpperCase()
    };
  }

  const adapter = readAdapter();
  const activeGuids = new Set((Array.isArray(adapter?.pois) ? adapter.pois : []).map(poi => String(poi?.guid || '')).filter(Boolean));
  const references = (Array.isArray(adapter?.referencePois) ? adapter.referencePois : [])
    .map(normalizeReference)
    .filter(Boolean)
    .filter(poi => !activeGuids.has(poi.guid));
  const visibleReferences = references.filter(poi => poi.referenceKind === 'INACTIVE_POWERSPOT');

  if (!references.length || !window.L) return;

  const counts = references.reduce((result, poi) => {
    result.total += 1;
    if (poi.referenceKind === 'NOT_IN_GAME') result.notInGame += 1;
    if (poi.referenceKind === 'INACTIVE_POWERSPOT') result.inactivePowerSpot += 1;
    return result;
  }, { total:0, notInGame:0, inactivePowerSpot:0 });

  let referenceLayer = null;
  let installedMap = null;
  let uiTimer = null;

  function inactiveIcon() {
    return L.divIcon({
      className: 'bridge-reference-inactive-icon',
      html: '<span class="bridge-reference-inactive-diamond"></span>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  function injectLegendStyles() {
    if (document.getElementById('campsiteBridgeReferenceStyles')) return;
    const style = document.createElement('style');
    style.id = 'campsiteBridgeReferenceStyles';
    style.textContent = `
      #campsiteBridgeSelection .bridge-reference-note{width:100%;margin-top:2px;color:#cbd5e1;font-size:10px;font-weight:800}
      #campsiteBridgeSelection .bridge-dot.reference-inactive-power{width:10px;height:10px;border-radius:2px;background:#f3a8c9!important;border:2px solid #e879aa;box-sizing:border-box;transform:rotate(45deg)}
      .bridge-reference-inactive-icon{background:transparent!important;border:0!important}
      .bridge-reference-inactive-diamond{display:block;width:18px;height:18px;margin:5px;transform:rotate(45deg);border:3px solid #fff;border-radius:3px;background:#f3a8c9;box-shadow:0 0 0 2px #e879aa,0 2px 5px rgba(0,0,0,.25);opacity:.72}
    `;
    document.head.appendChild(style);
  }

  function installLegendAndFit() {
    const legend = document.querySelector('#campsiteBridgeSelection .bridge-legend');
    if (!legend) return false;

    injectLegendStyles();
    if (counts.inactivePowerSpot > 0 && !legend.querySelector('[data-bridge-reference-legend="inactive-power"]')) {
      const inactivePower = document.createElement('span');
      inactivePower.dataset.bridgeReferenceLegend = 'inactive-power';
      inactivePower.innerHTML = `<i class="bridge-dot reference-inactive-power"></i>Inactive PS ${counts.inactivePowerSpot.toLocaleString('ja-JP')}`;
      legend.appendChild(inactivePower);
    }
    if (!legend.querySelector('[data-bridge-reference-legend="note"]')) {
      const note = document.createElement('div');
      note.className = 'bridge-reference-note';
      note.dataset.bridgeReferenceLegend = 'note';
      note.textContent = counts.notInGame
        ? `Inactive PSは審査対象です。Not in Game ${counts.notInGame.toLocaleString('ja-JP')}件は内部照合のみ保持し、地図には表示しません。`
        : 'Inactive PSは審査対象です。';
      legend.appendChild(note);
    }

    const fitButton = document.getElementById('bridgeFitBtn');
    if (fitButton && fitButton.dataset.referenceFitBound !== '1') {
      fitButton.dataset.referenceFitBound = '1';
      fitButton.addEventListener('click', () => {
        if (!installedMap) return;
        const active = Array.isArray(adapter?.pois) ? adapter.pois : [];
        const points = [...active, ...visibleReferences]
          .map(poi => [Number(poi?.lat), Number(poi?.lng)])
          .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
        if (!points.length) return;
        const bounds = L.latLngBounds(points);
        if (bounds.isValid()) installedMap.fitBounds(bounds, { padding:[24,24], maxZoom:17 });
      });
    }
    return true;
  }

  function renderReferences(map) {
    if (!map || installedMap === map) return;
    installedMap = map;
    referenceLayer = L.layerGroup().addTo(map);
    for (const poi of visibleReferences) {
      L.marker([poi.lat, poi.lng], { icon: inactiveIcon(), interactive:false, keyboard:false }).addTo(referenceLayer);
    }
    if (uiTimer) clearInterval(uiTimer);
    let attempts = 0;
    uiTimer = setInterval(() => {
      attempts += 1;
      if (installLegendAndFit() || attempts >= 100) {
        clearInterval(uiTimer);
        uiTimer = null;
      }
    }, 100);
  }

  const originalMapFactory = L.map;
  if (typeof originalMapFactory === 'function' && originalMapFactory.__campsiteBridgeReferenceWrapped !== true) {
    const wrappedMapFactory = function(...args) {
      const map = originalMapFactory.apply(this, args);
      try {
        if (map?.getContainer?.()?.id === 'campsiteBridgeMap') {
          window.__campsiteBridgeLeafletMap = map;
          setTimeout(() => renderReferences(map), 0);
        }
      } catch (_) {}
      return map;
    };
    try { Object.defineProperty(wrappedMapFactory, '__campsiteBridgeReferenceWrapped', { value:true }); } catch (_) {}
    L.map = wrappedMapFactory;
  }

  if (window.__campsiteBridgeLeafletMap) renderReferences(window.__campsiteBridgeLeafletMap);

  window.CampsiteBridgeReferenceVisuals = Object.freeze({
    counts: { ...counts },
    references: references.map(poi => ({ ...poi })),
    visibleReferences: visibleReferences.map(poi => ({ ...poi })),
    getMap: () => installedMap,
    getLayer: () => referenceLayer
  });
})();