(() => {
  'use strict';

  const bridgeMapLab_defaultCircleRadiusMeters = 50;

  function bridgeMapLab_buildPointGeometry(poi) {
    return Object.freeze({
      type: 'point',
      lat: poi.lat,
      lng: poi.lng
    });
  }

  function bridgeMapLab_buildCircleGeometry(poi, radiusMeters) {
    return Object.freeze({
      type: 'circle',
      lat: poi.lat,
      lng: poi.lng,
      radiusMeters
    });
  }

  window.bridgeMapLab_buildGeometryLayer = function (stateLayerResult) {
    const entries = stateLayerResult.pois.map((poi) => {
      const ownerKey = `poi:${poi.guid}`;

      return Object.freeze({
        ownerKey,
        pointGeometry: bridgeMapLab_buildPointGeometry(poi),
        circleGeometries: Object.freeze({
          50: bridgeMapLab_buildCircleGeometry(poi, bridgeMapLab_defaultCircleRadiusMeters)
        })
      });
    });

    return Object.freeze({
      entries: Object.freeze(entries)
    });
  };
})();
