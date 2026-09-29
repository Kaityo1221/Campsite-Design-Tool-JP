(() => {
  'use strict';

  const bridgeMapLab_stateFillColors = Object.freeze({
    POKESTOP: '#2F80ED',
    GYM: '#E53935',
    POWERSPOT: '#8E44AD'
  });
  const bridgeMapLab_inactivePowerSpotFillColor = '#C9A7EB';

  function bridgeMapLab_buildDisplayDecision(poi) {
    if (Object.hasOwn(bridgeMapLab_stateFillColors, poi.state)) {
      return Object.freeze({
        guid: poi.guid,
        lat: poi.lat,
        lng: poi.lng,
        sourceGameObjects: poi.sourceGameObjects,
        state: poi.state,
        referenceKind: poi.referenceKind,
        visible: true,
        markerStyle: Object.freeze({
          fillColor: bridgeMapLab_stateFillColors[poi.state]
        })
      });
    }

    if (poi.state === 'NOT_IN_GAME' && poi.referenceKind === 'INACTIVE_POWERSPOT') {
      return Object.freeze({
        guid: poi.guid,
        lat: poi.lat,
        lng: poi.lng,
        sourceGameObjects: poi.sourceGameObjects,
        state: poi.state,
        referenceKind: poi.referenceKind,
        visible: true,
        markerStyle: Object.freeze({
          fillColor: bridgeMapLab_inactivePowerSpotFillColor
        })
      });
    }

    return Object.freeze({
      guid: poi.guid,
      lat: poi.lat,
      lng: poi.lng,
      sourceGameObjects: poi.sourceGameObjects,
      state: poi.state,
      referenceKind: poi.referenceKind,
      visible: false,
      markerStyle: null
    });
  }

  window.bridgeMapLab_buildColorLayer = function (stateLayerResult) {
    const decisions = stateLayerResult.pois.map(bridgeMapLab_buildDisplayDecision);
    const visiblePois = decisions.filter((decision) => decision.visible);

    return Object.freeze({
      pois: Object.freeze(visiblePois),
      decisions: Object.freeze(decisions),
      counts: Object.freeze({
        visible: visiblePois.length,
        hidden: decisions.length - visiblePois.length
      })
    });
  };
})();
