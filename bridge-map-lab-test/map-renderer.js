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

  function bridgeMapLab_emptySyncStats() {
    return Object.freeze({
      markers: Object.freeze({ created: 0, reused: 0, removed: 0 }),
      circles50: Object.freeze({ created: 0, reused: 0, removed: 0 })
    });
  }

  window.bridgeMapLab_createMapRenderer = function (map) {
    const circle50Layer = L.layerGroup().addTo(map);
    const markerLayer = L.layerGroup().addTo(map);
    const markerEntries = new Map();
    const circle50Entries = new Map();
    let markerOrder = [];
    let circle50Order = [];
    let lastSyncStats = bridgeMapLab_emptySyncStats();
    let destroyed = false;

    function bridgeMapLab_assertAlive() {
      if (destroyed) {
        throw new Error('Map renderer has been destroyed');
      }
    }

    function bridgeMapLab_validateScene(scene) {
      if (!scene || !Array.isArray(scene.items)) {
        throw new Error('Renderer requires Scene.items');
      }

      const seenKeys = new Set();
      const markers = [];
      const circles50 = [];

      scene.items.forEach((renderItem) => {
        const key = String(renderItem?.key || '');
        if (!key) {
          throw new Error('RenderItem.key is required');
        }
        if (seenKeys.has(key)) {
          throw new Error(`Duplicate RenderItem.key: ${key}`);
        }
        seenKeys.add(key);

        if (renderItem.layerKey === 'marker') {
          if (renderItem.geometry?.type !== 'point') {
            throw new Error(`Invalid marker geometry for ${key}`);
          }
          markers.push(renderItem);
          return;
        }

        if (renderItem.layerKey === 'circle-50') {
          if (renderItem.geometry?.type !== 'circle') {
            throw new Error(`Invalid circle geometry for ${key}`);
          }
          circles50.push(renderItem);
          return;
        }

        throw new Error(`Unsupported layerKey: ${renderItem.layerKey}`);
      });

      return { markers, circles50 };
    }

    function bridgeMapLab_syncMarkers(renderItems) {
      const desiredKeys = new Set(renderItems.map((renderItem) => renderItem.key));
      let created = 0;
      let reused = 0;
      let removed = 0;

      markerEntries.forEach((entry, key) => {
        if (desiredKeys.has(key)) return;
        markerLayer.removeLayer(entry.layer);
        markerEntries.delete(key);
        removed += 1;
      });

      markerOrder = renderItems.map((renderItem) => {
        const key = renderItem.key;
        const latLng = [renderItem.geometry.lat, renderItem.geometry.lng];
        const style = Object.assign({}, bridgeMapLab_markerBaseStyle, renderItem.style || {});
        const radius = Number.isFinite(Number(style.radius)) ? Number(style.radius) : bridgeMapLab_markerBaseStyle.radius;
        const existing = markerEntries.get(key);

        if (existing) {
          existing.layer.setLatLng(latLng);
          existing.layer.setRadius(radius);
          existing.layer.setStyle(style);
          existing.renderItem = renderItem;
          reused += 1;
          return key;
        }

        const layer = L.circleMarker(latLng, style).addTo(markerLayer);
        markerEntries.set(key, { renderItem, layer });
        created += 1;
        return key;
      });

      return Object.freeze({ created, reused, removed });
    }

    function bridgeMapLab_syncCircles50(renderItems) {
      const desiredKeys = new Set(renderItems.map((renderItem) => renderItem.key));
      let created = 0;
      let reused = 0;
      let removed = 0;

      circle50Entries.forEach((entry, key) => {
        if (desiredKeys.has(key)) return;
        circle50Layer.removeLayer(entry.layer);
        circle50Entries.delete(key);
        removed += 1;
      });

      circle50Order = renderItems.map((renderItem) => {
        const key = renderItem.key;
        const latLng = [renderItem.geometry.lat, renderItem.geometry.lng];
        const style = Object.assign({ interactive: false }, renderItem.style || {});
        const existing = circle50Entries.get(key);

        if (existing) {
          existing.layer.setLatLng(latLng);
          existing.layer.setRadius(renderItem.geometry.radiusMeters);
          existing.layer.setStyle(style);
          existing.renderItem = renderItem;
          reused += 1;
          return key;
        }

        const layer = L.circle(
          latLng,
          Object.assign({ radius: renderItem.geometry.radiusMeters }, style)
        ).addTo(circle50Layer);
        circle50Entries.set(key, { renderItem, layer });
        created += 1;
        return key;
      });

      return Object.freeze({ created, reused, removed });
    }

    function bridgeMapLab_clearRenderedState() {
      circle50Layer.clearLayers();
      markerLayer.clearLayers();
      markerEntries.clear();
      circle50Entries.clear();
      markerOrder = [];
      circle50Order = [];
      lastSyncStats = bridgeMapLab_emptySyncStats();
    }

    return Object.freeze({
      render(scene) {
        bridgeMapLab_assertAlive();
        const desired = bridgeMapLab_validateScene(scene);
        const circles50 = bridgeMapLab_syncCircles50(desired.circles50);
        const markers = bridgeMapLab_syncMarkers(desired.markers);
        lastSyncStats = Object.freeze({ markers, circles50 });
        return markerEntries.size;
      },

      destroy() {
        if (destroyed) return;

        bridgeMapLab_clearRenderedState();
        map.removeLayer(circle50Layer);
        map.removeLayer(markerLayer);
        destroyed = true;
      },

      isDestroyed() {
        return destroyed;
      },

      getDiagnostics() {
        return markerOrder.map((key) => {
          const entry = markerEntries.get(key);
          const renderItem = entry.renderItem;
          const marker = entry.layer;
          return {
            key: renderItem.key,
            ownerKey: renderItem.ownerKey,
            renderKind: renderItem.renderKind,
            fillColor: marker.options.fillColor,
            dataLayerLat: renderItem.geometry.lat,
            dataLayerLng: renderItem.geometry.lng,
            leafletLatLng: marker.getLatLng(),
            leafletId: L.stamp(marker)
          };
        });
      },

      getCircleDiagnostics() {
        return circle50Order.map((key) => {
          const entry = circle50Entries.get(key);
          const renderItem = entry.renderItem;
          const circle = entry.layer;
          return {
            key: renderItem.key,
            ownerKey: renderItem.ownerKey,
            renderKind: renderItem.renderKind,
            color: circle.options.color,
            fillColor: circle.options.fillColor,
            radiusMeters: circle.getRadius(),
            leafletLatLng: circle.getLatLng(),
            leafletId: L.stamp(circle)
          };
        });
      },

      getRenderedCounts() {
        return Object.freeze({
          markers: markerEntries.size,
          circles50: circle50Entries.size
        });
      },

      getLastSyncStats() {
        return lastSyncStats;
      }
    });
  };
})();
