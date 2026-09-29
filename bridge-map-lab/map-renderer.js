(() => {
  'use strict';

  const bridgeMapLab_markerBaseStyle = Object.freeze({
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
      render(scene) {
        markerLayer.clearLayers();
        renderedMarkers = scene.items.map((renderItem) => ({
          renderItem,
          marker: L.circleMarker(
            [renderItem.geometry.lat, renderItem.geometry.lng],
            Object.assign({}, bridgeMapLab_markerBaseStyle, renderItem.style || {})
          ).addTo(markerLayer)
        }));

        return renderedMarkers.length;
      },

      getDiagnostics() {
        return renderedMarkers.map(({ renderItem, marker }) => ({
          key: renderItem.key,
          ownerKey: renderItem.ownerKey,
          renderKind: renderItem.renderKind,
          fillColor: marker.options.fillColor,
          dataLayerLat: renderItem.geometry.lat,
          dataLayerLng: renderItem.geometry.lng,
          leafletLatLng: marker.getLatLng()
        }));
      }
    });
  };
})();
