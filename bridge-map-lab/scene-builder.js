(() => {
  'use strict';

  const bridgeMapLab_activeRenderKinds = Object.freeze([
    'POKESTOP',
    'GYM',
    'POWERSPOT'
  ]);

  function bridgeMapLab_resolveRenderKind(poi) {
    if (bridgeMapLab_activeRenderKinds.includes(poi.state)) {
      return poi.state;
    }

    if (poi.state === 'NOT_IN_GAME' && poi.referenceKind === 'INACTIVE_POWERSPOT') {
      return 'INACTIVE_POWERSPOT';
    }

    return null;
  }

  function bridgeMapLab_buildMarkerRenderItem(poi, renderKind) {
    const ownerKey = `poi:${poi.guid}`;

    return Object.freeze({
      key: `marker:${ownerKey}`,
      itemType: 'marker',
      ownerKey,
      origin: 'existing',
      renderKind,
      layerKey: 'marker',
      geometry: Object.freeze({
        type: 'point',
        lat: poi.lat,
        lng: poi.lng
      })
    });
  }

  window.bridgeMapLab_buildScene = function (stateLayerResult) {
    const items = [];

    stateLayerResult.pois.forEach((poi) => {
      const renderKind = bridgeMapLab_resolveRenderKind(poi);
      if (renderKind === null) return;
      items.push(bridgeMapLab_buildMarkerRenderItem(poi, renderKind));
    });

    return Object.freeze({
      items: Object.freeze(items)
    });
  };
})();
