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
  const bridgeMapLab_circleRadii = Object.freeze([50, 40, 30]);

  function bridgeMapLab_zeroStats() {
    return Object.freeze({ created: 0, reused: 0, removed: 0 });
  }

  function bridgeMapLab_emptySyncStats() {
    return Object.freeze({
      markers: bridgeMapLab_zeroStats(),
      circles50: bridgeMapLab_zeroStats(),
      circles40: bridgeMapLab_zeroStats(),
      circles30: bridgeMapLab_zeroStats()
    });
  }

  window.bridgeMapLab_createMapRenderer = function (map, options) {
    const settings = Object.assign({ opacity: 1 }, options || {});
    const markerLayer = L.layerGroup().addTo(map);
    const markerEntries = new Map();
    const circleLayers = new Map();
    const circleEntries = new Map();
    bridgeMapLab_circleRadii.forEach((radius) => {
      circleLayers.set(radius, L.layerGroup().addTo(map));
      circleEntries.set(radius, new Map());
    });

    let markerOrder = [];
    const circleOrder = new Map(bridgeMapLab_circleRadii.map((radius) => [radius, []]));
    let lastSyncStats = bridgeMapLab_emptySyncStats();
    let destroyed = false;

    function assertAlive() {
      if (destroyed) throw new Error('Map renderer has been destroyed');
    }

    function validateScene(scene) {
      if (!scene || !Array.isArray(scene.items)) throw new Error('Renderer requires Scene.items');
      const seenKeys = new Set();
      const markers = [];
      const circles = new Map(bridgeMapLab_circleRadii.map((radius) => [radius, []]));

      scene.items.forEach((renderItem) => {
        const key = String(renderItem?.key || '');
        if (!key) throw new Error('RenderItem.key is required');
        if (seenKeys.has(key)) throw new Error(`Duplicate RenderItem.key: ${key}`);
        seenKeys.add(key);

        if (renderItem.layerKey === 'marker') {
          if (renderItem.geometry?.type !== 'point') throw new Error(`Invalid marker geometry for ${key}`);
          markers.push(renderItem);
          return;
        }

        const circleMatch = String(renderItem.layerKey || '').match(/^circle-(50|40|30)$/);
        if (circleMatch) {
          const radius = Number(circleMatch[1]);
          if (renderItem.geometry?.type !== 'circle') throw new Error(`Invalid circle geometry for ${key}`);
          if (Number(renderItem.geometry.radiusMeters) !== radius) {
            throw new Error(`Circle radius mismatch for ${key}`);
          }
          circles.get(radius).push(renderItem);
          return;
        }

        throw new Error(`Unsupported layerKey: ${renderItem.layerKey}`);
      });

      return { markers, circles };
    }

    function syncMarkers(renderItems) {
      const desiredKeys = new Set(renderItems.map((item) => item.key));
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
        const naturalFillOpacity = Number.isFinite(Number(style.fillOpacity)) ? Number(style.fillOpacity) : bridgeMapLab_markerBaseStyle.fillOpacity;
        style.opacity = settings.opacity;
        style.fillOpacity = naturalFillOpacity * settings.opacity;
        style.interactive = false;
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

    function syncCircles(radius, renderItems) {
      const layerGroup = circleLayers.get(radius);
      const entries = circleEntries.get(radius);
      const desiredKeys = new Set(renderItems.map((item) => item.key));
      let created = 0;
      let reused = 0;
      let removed = 0;

      entries.forEach((entry, key) => {
        if (desiredKeys.has(key)) return;
        layerGroup.removeLayer(entry.layer);
        entries.delete(key);
        removed += 1;
      });

      circleOrder.set(radius, renderItems.map((renderItem) => {
        const key = renderItem.key;
        const latLng = [renderItem.geometry.lat, renderItem.geometry.lng];
        const baseStyle = Object.assign({ interactive: false, fillOpacity: 0 }, renderItem.style || {});
        const naturalOpacity = Number.isFinite(Number(baseStyle.opacity)) ? Number(baseStyle.opacity) : 1;
        const naturalFillOpacity = Number.isFinite(Number(baseStyle.fillOpacity)) ? Number(baseStyle.fillOpacity) : 0;
        const style = Object.assign({}, baseStyle, {
          opacity: naturalOpacity * settings.opacity,
          fillOpacity: naturalFillOpacity * settings.opacity,
          interactive: false
        });
        const existing = entries.get(key);

        if (existing) {
          existing.layer.setLatLng(latLng);
          existing.layer.setRadius(renderItem.geometry.radiusMeters);
          existing.layer.setStyle(style);
          existing.renderItem = renderItem;
          reused += 1;
          return key;
        }

        const layer = L.circle(latLng, Object.assign({ radius: renderItem.geometry.radiusMeters }, style)).addTo(layerGroup);
        entries.set(key, { renderItem, layer });
        created += 1;
        return key;
      }));

      return Object.freeze({ created, reused, removed });
    }

    function clearRenderedState() {
      markerLayer.clearLayers();
      markerEntries.clear();
      markerOrder = [];
      bridgeMapLab_circleRadii.forEach((radius) => {
        circleLayers.get(radius).clearLayers();
        circleEntries.get(radius).clear();
        circleOrder.set(radius, []);
      });
      lastSyncStats = bridgeMapLab_emptySyncStats();
    }

    function circleDiagnostics(radius) {
      const entries = circleEntries.get(radius);
      return circleOrder.get(radius).map((key) => {
        const entry = entries.get(key);
        const renderItem = entry.renderItem;
        const circle = entry.layer;
        return {
          key: renderItem.key,
          ownerKey: renderItem.ownerKey,
          renderKind: renderItem.renderKind,
          radiusMeters: circle.getRadius(),
          leafletLatLng: circle.getLatLng(),
          leafletId: L.stamp(circle)
        };
      });
    }

    return Object.freeze({
      render(scene) {
        assertAlive();
        const desired = validateScene(scene);
        const markers = syncMarkers(desired.markers);
        const circles50 = syncCircles(50, desired.circles.get(50));
        const circles40 = syncCircles(40, desired.circles.get(40));
        const circles30 = syncCircles(30, desired.circles.get(30));
        lastSyncStats = Object.freeze({ markers, circles50, circles40, circles30 });
        return markerEntries.size;
      },

      destroy() {
        if (destroyed) return;
        clearRenderedState();
        map.removeLayer(markerLayer);
        bridgeMapLab_circleRadii.forEach((radius) => map.removeLayer(circleLayers.get(radius)));
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

      getCircleDiagnostics(radius) {
        if (radius !== undefined) {
          const normalized = Number(radius);
          if (!bridgeMapLab_circleRadii.includes(normalized)) return [];
          return circleDiagnostics(normalized);
        }
        return bridgeMapLab_circleRadii.flatMap(circleDiagnostics);
      },

      getRenderedCounts() {
        return Object.freeze({
          markers: markerEntries.size,
          circles50: circleEntries.get(50).size,
          circles40: circleEntries.get(40).size,
          circles30: circleEntries.get(30).size
        });
      },

      getLastSyncStats() {
        return lastSyncStats;
      }
    });
  };
})();
