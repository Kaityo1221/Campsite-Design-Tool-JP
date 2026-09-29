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
    const circle50Layer = L.layerGroup().addTo(map);
    const markerLayer = L.layerGroup().addTo(map);
    let renderedMarkers = [];
    let renderedCircles50 = [];

    return Object.freeze({
      render(scene) {
        circle50Layer.clearLayers();
        markerLayer.clearLayers();
        renderedMarkers = [];
        renderedCircles50 = [];

        scene.items.forEach((renderItem) => {
          if (renderItem.layerKey === 'circle-50') {
            if (renderItem.geometry?.type !== 'circle') {
              throw new Error(`Invalid circle geometry for ${renderItem.key}`);
            }

            const circle = L.circle(
              [renderItem.geometry.lat, renderItem.geometry.lng],
              Object.assign({
                radius: renderItem.geometry.radiusMeters,
                interactive: false
              }, renderItem.style || {})
            ).addTo(circle50Layer);

            renderedCircles50.push({ renderItem, circle });
            return;
          }

          if (renderItem.layerKey === 'marker') {
            if (renderItem.geometry?.type !== 'point') {
              throw new Error(`Invalid marker geometry for ${renderItem.key}`);
            }

            const marker = L.circleMarker(
              [renderItem.geometry.lat, renderItem.geometry.lng],
              Object.assign({}, bridgeMapLab_markerBaseStyle, renderItem.style || {})
            ).addTo(markerLayer);

            renderedMarkers.push({ renderItem, marker });
            return;
          }

          throw new Error(`Unsupported layerKey: ${renderItem.layerKey}`);
        });

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
      },

      getCircleDiagnostics() {
        return renderedCircles50.map(({ renderItem, circle }) => ({
          key: renderItem.key,
          ownerKey: renderItem.ownerKey,
          renderKind: renderItem.renderKind,
          color: circle.options.color,
          fillColor: circle.options.fillColor,
          radiusMeters: circle.getRadius(),
          leafletLatLng: circle.getLatLng()
        }));
      },

      getRenderedCounts() {
        return Object.freeze({
          markers: renderedMarkers.length,
          circles50: renderedCircles50.length
        });
      }
    });
  };
})();
