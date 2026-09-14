(() => {
  'use strict';

  const SYMBOLS = Object.freeze({
    pokestop: Object.freeze({ role: '旗', className: 'flag', modern: 'PokéStop', newMark: '印' }),
    gym: Object.freeze({ role: '城', className: 'castle', modern: 'Gym', newMark: '標' }),
    power: Object.freeze({ role: '櫓', className: 'tower', modern: 'Power Spot', newMark: '望' })
  });

  let installed = false;
  const layers = {
    capacityMap: null,
    capacityPreviewMap: null
  };

  function getMode() {
    return window.CampsitePlacementMapTheme?.getMode?.() || 'normal';
  }

  function getMap(containerId) {
    try {
      if (containerId === 'capacityMap') return capacityMapInstance || null;
      if (containerId === 'capacityPreviewMap') return capacityPreviewMapInstance || null;
    } catch (_error) {}
    return null;
  }

  function getState() {
    try {
      return capacityState || null;
    } catch (_error) {
      return null;
    }
  }

  function safe(text) {
    if (typeof window.escapeCapacityHtml === 'function') return window.escapeCapacityHtml(text);
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function roleFor(kind) {
    return SYMBOLS[kind] || SYMBOLS.pokestop;
  }

  function makeIcon({ kind, state = 'existing', label }) {
    const role = roleFor(kind);
    const stateClass = state === 'candidate' ? 'candidate' : state === 'add' ? 'add' : 'existing';
    const short = state === 'existing' ? role.role : role.newMark;
    const hasCandidateRing = state === 'candidate';

    return L.divIcon({
      className: 'placement-tactical-icon-shell',
      html: `
        <div class="placement-tactical-symbol ${role.className} ${stateClass}" title="${safe(label)}">
          <span class="placement-tactical-symbol__glyph">${short}</span>
          ${hasCandidateRing ? '<span class="placement-tactical-symbol__candidate-ring" aria-hidden="true"></span>' : ''}
        </div>
      `,
      iconSize: state === 'existing' && kind === 'gym' ? [23, 23] : state === 'existing' && kind === 'pokestop' ? [20, 24] : [22, 22],
      iconAnchor: state === 'existing' && kind === 'pokestop' ? [10, 22] : [11, 11],
      popupAnchor: [0, state === 'existing' && kind === 'pokestop' ? -22 : -15]
    });
  }

  function popupForPoi(point) {
    const isAdd = point.type === 'add';
    const role = roleFor(point.kind);
    return `
      <div class="placement-tactical-popup">
        <strong>${safe(point.name || 'POI')}</strong><br>
        <span>布陣図：${isAdd ? role.newMark : role.role}</span><br>
        <span>現代語：${isAdd ? `新規${role.modern}` : `既存${role.modern}`}</span><br>
        <span>レイヤー：${safe(point.layer || '未設定')}</span>
      </div>
    `;
  }

  function getCandidatePoints() {
    let preview;
    try {
      preview = capacityPreviewState;
    } catch (_error) {
      preview = null;
    }

    if (!preview?.grouped) return [];

    return [
      ...(preview.grouped.pokestop || []).map((point, index) => ({ ...point, kind: 'pokestop', name: `候補ポケストップ${index + 1}` })),
      ...(preview.grouped.gym || []).map((point, index) => ({ ...point, kind: 'gym', name: `候補ジム${index + 1}` })),
      ...(preview.grouped.power || []).map((point, index) => ({ ...point, kind: 'power', name: `候補パワースポット${index + 1}` }))
    ];
  }

  function popupForCandidate(point) {
    const strategy = window.CampsitePlacementStrategy;
    const mode = strategy?.getActiveStrategy?.();
    const formation = strategy?.strategies?.[mode];
    const role = roleFor(point.kind);

    return `
      <div class="placement-tactical-popup candidate">
        <strong>${safe(point.name)}</strong><br>
        <span>布陣図：○${role.newMark}</span><br>
        <span>現代語：自動候補${safe(role.modern)}</span><br>
        ${formation ? `<span>布陣：${safe(formation.label)}</span><br><span>${safe(formation.reason)}</span>` : ''}
      </div>
    `;
  }

  function clearLayer(containerId) {
    const layer = layers[containerId];
    if (!layer) return;
    try { layer.remove(); } catch (_error) {}
    layers[containerId] = null;
  }

  function renderFor(containerId) {
    clearLayer(containerId);
    if (getMode() !== 'tactical' || typeof L === 'undefined') return;

    const map = getMap(containerId);
    const state = getState();
    if (!map || !state) return;

    const layer = L.layerGroup().addTo(map);
    layers[containerId] = layer;

    (state.poi || []).forEach(point => {
      const isAdd = point.type === 'add';
      L.marker([point.lat, point.lng], {
        icon: makeIcon({
          kind: point.kind,
          state: isAdd ? 'add' : 'existing',
          label: point.name
        }),
        keyboard: true,
        zIndexOffset: isAdd ? 450 : 350
      })
        .bindPopup(popupForPoi(point))
        .addTo(layer);
    });

    if (containerId === 'capacityPreviewMap') {
      getCandidatePoints().forEach(point => {
        L.marker([point.lat, point.lng], {
          icon: makeIcon({ kind: point.kind, state: 'candidate', label: point.name }),
          keyboard: true,
          zIndexOffset: 700
        })
          .bindPopup(popupForCandidate(point))
          .addTo(layer);
      });
    }
  }

  function refresh() {
    renderFor('capacityMap');
    renderFor('capacityPreviewMap');
  }

  function install() {
    if (installed) return true;
    if (!window.CampsitePlacementMapTheme || typeof window.previewCandidatePoiPlacement !== 'function') {
      return false;
    }

    const originalPreview = window.previewCandidatePoiPlacement;
    const originalRenderMap = window.renderCapacityMap;
    const originalRenderPreview = window.renderCapacityPreviewBaseMap;

    window.previewCandidatePoiPlacement = function placementStrategyTacticalPreview(...args) {
      const result = originalPreview.apply(this, args);
      window.setTimeout(refresh, 0);
      return result;
    };

    if (typeof originalRenderMap === 'function') {
      window.renderCapacityMap = function placementStrategyTacticalRenderMap(...args) {
        const result = originalRenderMap.apply(this, args);
        window.setTimeout(refresh, 0);
        return result;
      };
    }

    if (typeof originalRenderPreview === 'function') {
      window.renderCapacityPreviewBaseMap = function placementStrategyTacticalRenderPreview(...args) {
        const result = originalRenderPreview.apply(this, args);
        window.setTimeout(refresh, 0);
        return result;
      };
    }

    window.addEventListener('placementstrategy:mapmode', refresh);
    window.addEventListener('placementstrategy:formation', refresh);

    window.CampsitePlacementSymbols = Object.freeze({
      symbols: SYMBOLS,
      refresh
    });

    installed = true;
    refresh();
    console.info('[Placement Strategy Symbols] active');
    return true;
  }

  function waitForBase(attempt = 0) {
    if (install()) return;
    if (attempt >= 120) {
      console.warn('[Placement Strategy Symbols] placement strategy base did not become ready.');
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