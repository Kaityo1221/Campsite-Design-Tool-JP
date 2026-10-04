(() => {
  'use strict';

  const SUPPORTED_RENDER_KINDS = new Set(['POKESTOP', 'GYM', 'POWERSPOT', 'INACTIVE_POWERSPOT']);

  function markerOpacity(zone) {
    return zone === 'REFERENCE_100' ? 0.58 : 1;
  }

  function circleOpacity(zone) {
    return zone === 'REFERENCE_100' ? 0.42 : 0.72;
  }

  function validateEntry(entry, index) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError(`Reference Geometry entry at index ${index} must be an object.`);
    }
    if (typeof entry.guid !== 'string' || entry.guid.trim() === '') {
      throw new TypeError(`Reference Geometry entry at index ${index} must have guid.`);
    }
    if (!SUPPORTED_RENDER_KINDS.has(entry.renderKind)) {
      throw new TypeError(`Reference Geometry entry "${entry.guid}" has invalid renderKind.`);
    }
    if (!['INTERIOR', 'REFERENCE_100'].includes(entry.observationZone)) {
      throw new TypeError(`Reference Geometry entry "${entry.guid}" has invalid observationZone.`);
    }
    if (entry.pointGeometry?.type !== 'point') {
      throw new Error(`Missing point geometry for reference:${entry.guid}`);
    }
    if (entry.circle50Geometry?.type !== 'circle' || Number(entry.circle50Geometry.radiusMeters) !== 50) {
      throw new Error(`Missing 50m circle geometry for reference:${entry.guid}`);
    }
  }

  function markerItem(entry) {
    return Object.freeze({
      key: `marker:${entry.ownerKey}`,
      itemType: 'marker',
      ownerKey: entry.ownerKey,
      origin: 'reference',
      renderKind: entry.renderKind,
      observationZone: entry.observationZone,
      readOnly: true,
      source: 'wayfarer-observation',
      layerKey: 'marker',
      style: Object.freeze({ opacity: markerOpacity(entry.observationZone) }),
      geometry: entry.pointGeometry
    });
  }

  function circleItem(entry) {
    return Object.freeze({
      key: `circle50:${entry.ownerKey}`,
      itemType: 'circle',
      ownerKey: entry.ownerKey,
      origin: 'reference',
      renderKind: entry.renderKind,
      observationZone: entry.observationZone,
      readOnly: true,
      source: 'wayfarer-observation',
      layerKey: 'circle-50',
      radiusMeters: 50,
      style: Object.freeze({ opacity: circleOpacity(entry.observationZone), fillOpacity: 0.035 }),
      geometry: entry.circle50Geometry
    });
  }

  window.bridgeMapLab_buildWayfarerReferenceScene = function (referenceGeometry) {
    if (!referenceGeometry || !Array.isArray(referenceGeometry.entries)) {
      throw new TypeError('referenceGeometry.entries must be an array.');
    }

    const items = [];
    referenceGeometry.entries.forEach((entry, index) => {
      validateEntry(entry, index);
      items.push(markerItem(entry), circleItem(entry));
    });
    return Object.freeze({ items: Object.freeze(items) });
  };

  window.bridgeMapLab_mergeSceneWithWayfarerReferences = function (baseScene, referenceScene) {
    if (!baseScene || !Array.isArray(baseScene.items)) throw new TypeError('baseScene.items must be an array.');
    if (!referenceScene || !Array.isArray(referenceScene.items)) throw new TypeError('referenceScene.items must be an array.');

    const items = [...baseScene.items, ...referenceScene.items];
    const keys = new Set();
    for (const item of items) {
      const key = String(item?.key || '');
      if (!key) throw new Error('Merged Scene RenderItem.key is required.');
      if (keys.has(key)) throw new Error(`Duplicate merged Scene key: ${key}`);
      keys.add(key);
    }
    return Object.freeze({ items: Object.freeze(items) });
  };
})();
