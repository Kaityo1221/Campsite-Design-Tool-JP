(() => {
  'use strict';

  const bridgeMapLab_markerStyle = Object.freeze({
    radius: 8,
    color: '#f1f3f5',
    weight: 2,
    fillColor: '#69727d',
    fillOpacity: 0.92,
    interactive: false
  });

  window.bridgeMapLab_createMapRenderer = function (map) {
    const markerLayer = L.layerGroup().addTo(map);
    let renderedMarkers = [];

    return Object.freeze({
      render(pois) {
        markerLayer.clearLayers();
        renderedMarkers = pois.map((poi) => ({
          poi,
          marker: L.circleMarker([poi.lat, poi.lng], bridgeMapLab_markerStyle).addTo(markerLayer)
        }));

        return renderedMarkers.length;
      },

      getDiagnostics() {
        return renderedMarkers.map(({ poi, marker }) => ({
          guid: poi.guid,
          state: poi.state,
          dataLayerLat: poi.lat,
          dataLayerLng: poi.lng,
          leafletLatLng: marker.getLatLng()
        }));
      }
    });
  };
})();
