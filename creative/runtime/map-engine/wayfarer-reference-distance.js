(() => {
  'use strict';

  const EARTH_RADIUS_METERS = 6371008.8;
  const SOURCE_TYPES = Object.freeze({
    EXISTING: 'EXISTING_POI',
    CANDIDATE: 'NEW_CANDIDATE',
    REFERENCE: 'REFERENCE_100'
  });

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function point(value) {
    if (Array.isArray(value) && value.length >= 2) {
      const lat = finite(value[0]);
      const lng = finite(value[1]);
      if (lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return [lat, lng];
      }
      return null;
    }
    if (value && typeof value === 'object') {
      const lat = finite(value.lat ?? value.latitude);
      const lng = finite(value.lng ?? value.longitude);
      if (lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return [lat, lng];
      }
    }
    return null;
  }

  function radians(value) {
    return value * Math.PI / 180;
  }

  function distanceMeters(a, b) {
    const p1 = point(a);
    const p2 = point(b);
    if (!p1 || !p2) return null;
    const lat1 = radians(p1[0]);
    const lat2 = radians(p2[0]);
    const dLat = lat2 - lat1;
    const dLng = radians(p2[1] - p1[1]);
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function editableCandidate(record, excludeRecordId) {
    if (!record || typeof record !== 'object' || record.deleted === true) return null;
    const id = String(record.id || '').trim();
    if (excludeRecordId && id === String(excludeRecordId)) return null;
    const layer = String(record.layer || '');
    if (!layer.startsWith('existing-') && !layer.startsWith('new-')) return null;
    const latlng = point(record.latlng);
    if (!latlng) return null;
    return {
      sourceType: layer.startsWith('new-') ? SOURCE_TYPES.CANDIDATE : SOURCE_TYPES.EXISTING,
      recordId: id,
      guid: String(record.guid || ''),
      title: String(record.title || ''),
      readOnly: false,
      latlng
    };
  }

  function referenceCandidate(item) {
    if (!item || typeof item !== 'object') return null;
    if (item.origin !== 'reference' || item.layerKey !== 'marker' || item.observationZone !== 'REFERENCE_100') return null;
    const latlng = point(item.geometry);
    if (!latlng) return null;
    return {
      sourceType: SOURCE_TYPES.REFERENCE,
      recordId: '',
      guid: String(item.ownerKey || '').replace(/^reference:/, ''),
      title: String(item.title || ''),
      readOnly: true,
      latlng
    };
  }

  function freezeResult(candidate, distance) {
    return Object.freeze({
      sourceType: candidate.sourceType,
      distanceMeters: distance,
      recordId: candidate.recordId,
      guid: candidate.guid,
      title: candidate.title,
      readOnly: candidate.readOnly,
      lat: candidate.latlng[0],
      lng: candidate.latlng[1]
    });
  }

  window.bridgeMapLab_findNearestCreativePoi = function (origin, editableRecords, referenceSceneItems, excludeRecordId = '') {
    const originPoint = point(origin);
    if (!originPoint) return null;

    const candidates = [];
    for (const record of Array.isArray(editableRecords) ? editableRecords : []) {
      const candidate = editableCandidate(record, excludeRecordId);
      if (candidate) candidates.push(candidate);
    }
    for (const item of Array.isArray(referenceSceneItems) ? referenceSceneItems : []) {
      const candidate = referenceCandidate(item);
      if (candidate) candidates.push(candidate);
    }

    let best = null;
    let bestDistance = Infinity;
    for (const candidate of candidates) {
      const distance = distanceMeters(originPoint, candidate.latlng);
      if (distance === null || !Number.isFinite(distance)) continue;
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }

    return best ? freezeResult(best, bestDistance) : null;
  };

  window.bridgeMapLab_referenceDistanceSourceTypes = SOURCE_TYPES;
})();
