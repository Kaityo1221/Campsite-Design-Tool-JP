(() => {
  'use strict';

  const bridgeMapLab_activeRenderKinds = Object.freeze([
    'POKESTOP',
    'GYM',
    'POWERSPOT'
  ]);
  const bridgeMapLab_existingCircleRadii = Object.freeze([50, 40, 30]);

  function bridgeMapLab_resolveRenderKind(poi) {
    if (bridgeMapLab_activeRenderKinds.includes(poi.state)) return poi.state;
    if (poi.state === 'NOT_IN_GAME' && poi.referenceKind === 'INACTIVE_POWERSPOT') return 'INACTIVE_POWERSPOT';
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
      sourceLayer: poi.sourceLayer || null,
      layerKey: 'marker',
      geometry: pointGeometry
    });
  }

  function bridgeMapLab_buildCircleRenderItem(poi, renderKind, circleGeometry, radiusMeters) {
    const ownerKey = `poi:${poi.guid}`;
    return Object.freeze({
      key: `circle${radiusMeters}:${ownerKey}`,
      itemType: 'circle',
      ownerKey,
      origin: 'existing',
      renderKind,
      sourceLayer: poi.sourceLayer || null,
      layerKey: `circle-${radiusMeters}`,
      radiusMeters,
      geometry: circleGeometry
    });
  }

  function bridgeMapLab_existingLayerVisible(poi, settings) {
    const visibility = settings.existingTypesVisible;
    const sourceLayer = String(poi.sourceLayer || '');
    if (!visibility || typeof visibility !== 'object' || !sourceLayer) return true;
    return visibility[sourceLayer] !== false;
  }

  function bridgeMapLab_existingVisibleCircleRadii(settings) {
    if (Array.isArray(settings.circleRadiiVisible)) {
      const selected = new Set(settings.circleRadiiVisible.map(Number));
      return bridgeMapLab_existingCircleRadii.filter((radius) => selected.has(radius));
    }
    return settings.circle50Visible === false ? [] : [50];
  }

  window.bridgeMapLab_buildScene = function (stateLayerResult, geometryLayerResult, displaySettings) {
    const items = [];
    const settings = Object.assign({ circle50Visible: true }, displaySettings || {});
    const geometryByOwnerKey = new Map((geometryLayerResult?.entries || []).map((entry) => [entry.ownerKey, entry]));
    const visibleCircleRadii = bridgeMapLab_existingVisibleCircleRadii(settings);

    (stateLayerResult?.pois || []).forEach((poi) => {
      const renderKind = bridgeMapLab_resolveRenderKind(poi);
      if (renderKind === null || !bridgeMapLab_existingLayerVisible(poi, settings)) return;
      const ownerKey = `poi:${poi.guid}`;
      const geometryEntry = geometryByOwnerKey.get(ownerKey);
      if (!geometryEntry || !geometryEntry.pointGeometry) throw new Error(`Missing point geometry for ${ownerKey}`);

      items.push(bridgeMapLab_buildMarkerRenderItem(poi, renderKind, geometryEntry.pointGeometry));
      visibleCircleRadii.forEach((radiusMeters) => {
        const circleGeometry = geometryEntry.circleGeometries?.[radiusMeters];
        if (!circleGeometry) throw new Error(`Missing ${radiusMeters}m circle geometry for ${ownerKey}`);
        items.push(bridgeMapLab_buildCircleRenderItem(poi, renderKind, circleGeometry, radiusMeters));
      });
    });

    return Object.freeze({ items: Object.freeze(items) });
  };
})();
