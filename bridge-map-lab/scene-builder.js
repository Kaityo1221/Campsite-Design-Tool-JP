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

  function bridgeMapLab_buildMarkerRenderItem(poi, renderKind, pointGeometry) {
    const ownerKey = `poi:${poi.guid}`;

    return Object.freeze({
      key: `marker:${ownerKey}`,
      itemType: 'marker',
      ownerKey,
      origin: 'existing',
      renderKind,
      layerKey: 'marker',
      geometry: pointGeometry
    });
  }

  window.bridgeMapLab_buildScene = function (stateLayerResult, geometryLayerResult) {
    const items = [];
    const geometryByOwnerKey = new Map(
      geometryLayerResult.entries.map((entry) => [entry.ownerKey, entry])
    );

    stateLayerResult.pois.forEach((poi) => {
      const renderKind = bridgeMapLab_resolveRenderKind(poi);
      if (renderKind === null) return;

      const ownerKey = `poi:${poi.guid}`;
      const geometryEntry = geometryByOwnerKey.get(ownerKey);
      if (!geometryEntry || !geometryEntry.pointGeometry) {
        throw new Error(`Missing geometry for ${ownerKey}`);
      }

      items.push(bridgeMapLab_buildMarkerRenderItem(
        poi,
        renderKind,
        geometryEntry.pointGeometry
      ));
    });

    return Object.freeze({
      items: Object.freeze(items)
    });
  };
})();
