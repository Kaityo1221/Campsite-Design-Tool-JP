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

  function markerOptions(poi) {
    if (poi.referenceKind === 'INACTIVE_POWERSPOT') {
      return {
        radius: 5,
        color: '#ec4899',
        weight: 2,
        opacity: 0.82,
        dashArray: '3 3',
        fillColor: '#fbcfe8',
        fillOpacity: 0.18,
        interactive: false
      };
    }
    return {
      radius: 5,
      color: '#64748b',
      weight: 2,
      opacity: 0.9,
      dashArray: '3 3',
      fillColor: '#f8fafc',
      fillOpacity: 0.04,
      interactive: false
    };
  }

  function injectLegendStyles() {
    if (document.getElementById('campsiteBridgeReferenceStyles')) return;
    const style = document.createElement('style');
    style.id = 'campsiteBridgeReferenceStyles';
    style.textContent = `
      #campsiteBridgeSelection .bridge-reference-note{width:100%;margin-top:2px;color:#cbd5e1;font-size:10px;font-weight:800}
      #campsiteBridgeSelection .bridge-dot.reference-not-in-game{background:transparent!important;border:2px dashed #64748b;box-sizing:border-box}
      #campsiteBridgeSelection .bridge-dot.reference-inactive-power{background:#fbcfe8!important;border:2px dashed #ec4899;box-sizing:border-box}
    `;
    document.head.appendChild(style);
  }

  function installLegendAndFit() {
    const legend = document.querySelector('#campsiteBridgeSelection .bridge-legend');
    if (!legend) return false;

    injectLegendStyles();
    if (!legend.querySelector('[data-bridge-reference-legend]')) {
      const fragment = document.createDocumentFragment();
      const notInGame = document.createElement('span');
      notInGame.dataset.bridgeReferenceLegend = 'not-in-game';
      notInGame.innerHTML = `<i class="bridge-dot reference-not-in-game"></i>Not in Game ${counts.notInGame.toLocaleString('ja-JP')}`;
      const inactivePower = document.createElement('span');
      inactivePower.dataset.bridgeReferenceLegend = 'inactive-power';
      inactivePower.innerHTML = `<i class="bridge-dot reference-inactive-power"></i>Inactive Power Spot ${counts.inactivePowerSpot.toLocaleString('ja-JP')}`;
      const note = document.createElement('div');
      note.className = 'bridge-reference-note';
      note.dataset.bridgeReferenceLegend = 'note';
      note.textContent = '※ 点線の2種類はWayfarer照合用の参照表示です。ポリゴン選択・Campsite設計対象には含みません。';
      fragment.append(notInGame, inactivePower, note);
      legend.appendChild(fragment);
    }

    const fitButton = document.getElementById('bridgeFitBtn');
    if (fitButton && fitButton.dataset.referenceFitBound !== '1') {
      fitButton.dataset.referenceFitBound = '1';
      fitButton.addEventListener('click', () => {
        if (!installedMap) return;
        const active = Array.isArray(adapter?.pois) ? adapter.pois : [];
        const points = [...active, ...references]
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
    for (const poi of references) {
      L.circleMarker([poi.lat, poi.lng], markerOptions(poi)).addTo(referenceLayer);
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
    getMap: () => installedMap,
    getLayer: () => referenceLayer
  });
})();