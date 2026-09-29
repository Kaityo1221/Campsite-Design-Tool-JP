(() => {
  'use strict';

  const bridgeMapLab_fallbackFillColor = '#69727d';
  const bridgeMapLab_stateFillColors = Object.freeze({
    POKESTOP: '#2F80ED',
    GYM: '#E53935',
    POWERSPOT: '#8E44AD',
    UNKNOWN: bridgeMapLab_fallbackFillColor
  });

  function bridgeMapLab_getMarkerStyle(state) {
    return Object.freeze({
      fillColor: Object.hasOwn(bridgeMapLab_stateFillColors, state)
        ? bridgeMapLab_stateFillColors[state]
        : bridgeMapLab_fallbackFillColor
    });
  }

  window.bridgeMapLab_buildColorLayer = function (stateLayerResult) {
    const coloredPois = stateLayerResult.pois.map((poi) => Object.freeze({
      guid: poi.guid,
      lat: poi.lat,
      lng: poi.lng,
      sourceGameObjects: poi.sourceGameObjects,
      state: poi.state,
      markerStyle: bridgeMapLab_getMarkerStyle(poi.state)
    }));

    return Object.freeze({
      pois: Object.freeze(coloredPois)
    });
  };
})();
