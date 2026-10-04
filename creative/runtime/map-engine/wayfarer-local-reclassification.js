(() => {
  'use strict';

  const VERSION = '0.1.0';
  const ZONE_KEYS = Object.freeze(['interior', 'reference100', 'reserve200']);

  function cloneJson(value, fallback) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return fallback; }
  }

  function stableGuid(raw) {
    return String(raw?.guid || raw?.poiId || '').trim();
  }

  function finiteCoordinate(raw, primary, secondary, min, max) {
    const value = Number(raw?.[primary] ?? raw?.[secondary]);
    return Number.isFinite(value) && value >= min && value <= max ? value : null;
  }

  function emptyZones() {
    return { interior:[], reference100:[], reserve200:[] };
  }

  function resultBase(observation, currentPolygon, coverage) {
    return {
      version: VERSION,
      sourceSnapshotId: String(observation?.snapshotId || ''),
      sourceObservedAt: String(observation?.observedAt || ''),
      currentPolygon: cloneJson(currentPolygon, []),
      coverage: cloneJson(coverage, null)
    };
  }

  function reclassify(observation, currentPolygon) {
    const evaluateCoverage = window.bridgeMapLab_evaluateWayfarerReserveCoverage;
    const coverageApi = window.bridgeMapLabWayfarerReserveCoverage;
    if (typeof evaluateCoverage !== 'function' || !coverageApi) {
      return Object.freeze({
        ...resultBase(observation, currentPolygon, null),
        canUseLocal: false,
        reason: 'COVERAGE_ENGINE_UNAVAILABLE',
        zones: Object.freeze(emptyZones()),
        counts: Object.freeze({ interior:0, reference100:0, reserve200:0, total:0 }),
        diagnostics: Object.freeze([])
      });
    }

    const zones = observation?.zones;
    if (!zones || typeof zones !== 'object' || ZONE_KEYS.some(key => !Array.isArray(zones[key]))) {
      return Object.freeze({
        ...resultBase(observation, currentPolygon, null),
        canUseLocal: false,
        reason: 'INVALID_OBSERVATION_ZONES',
        zones: Object.freeze(emptyZones()),
        counts: Object.freeze({ interior:0, reference100:0, reserve200:0, total:0 }),
        diagnostics: Object.freeze([])
      });
    }

    const coverage = evaluateCoverage(observation, currentPolygon);
    if (!coverage?.covered) {
      return Object.freeze({
        ...resultBase(observation, currentPolygon, coverage),
        canUseLocal: false,
        reason: 'REFERENCE_OUT_OF_COVERAGE',
        zones: Object.freeze(emptyZones()),
        counts: Object.freeze({ interior:0, reference100:0, reserve200:0, total:0 }),
        diagnostics: Object.freeze([])
      });
    }

    const polygon = coverageApi.normalizePolygon(currentPolygon);
    if (!polygon.length) {
      return Object.freeze({
        ...resultBase(observation, currentPolygon, coverage),
        canUseLocal: false,
        reason: 'INVALID_CURRENT_POLYGON',
        zones: Object.freeze(emptyZones()),
        counts: Object.freeze({ interior:0, reference100:0, reserve200:0, total:0 }),
        diagnostics: Object.freeze([])
      });
    }

    const derived = emptyZones();
    const diagnostics = [];
    const seen = new Set();

    for (const sourceKey of ZONE_KEYS) {
      zones[sourceKey].forEach((raw, index) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          diagnostics.push({ sourceZone:sourceKey, index, guid:null, code:'INVALID_POI' });
          return;
        }
        const guid = stableGuid(raw);
        if (!guid) {
          diagnostics.push({ sourceZone:sourceKey, index, guid:null, code:'INVALID_GUID' });
          return;
        }
        if (seen.has(guid)) {
          diagnostics.push({ sourceZone:sourceKey, index, guid, code:'DUPLICATE_GUID' });
          return;
        }
        seen.add(guid);

        const lat = finiteCoordinate(raw, 'lat', 'latitude', -90, 90);
        const lng = finiteCoordinate(raw, 'lng', 'longitude', -180, 180);
        if (lat === null || lng === null) {
          diagnostics.push({ sourceZone:sourceKey, index, guid, code:'INVALID_COORDINATE' });
          return;
        }

        const distanceMeters = coverageApi.distanceToPolygonMeters([lat,lng], polygon);
        const zoneKey = distanceMeters <= 0.25
          ? 'interior'
          : distanceMeters <= 100
            ? 'reference100'
            : 'reserve200';
        const observationZone = zoneKey === 'interior'
          ? 'INTERIOR'
          : zoneKey === 'reference100'
            ? 'REFERENCE_100'
            : 'RESERVE_200';

        derived[zoneKey].push(Object.freeze({
          ...raw,
          guid,
          lat,
          lng,
          observationZone
        }));
      });
    }

    const counts = Object.freeze({
      interior: derived.interior.length,
      reference100: derived.reference100.length,
      reserve200: derived.reserve200.length,
      total: derived.interior.length + derived.reference100.length + derived.reserve200.length
    });

    return Object.freeze({
      ...resultBase(observation, polygon, coverage),
      canUseLocal: true,
      reason: 'LOCAL_RECLASSIFICATION_AVAILABLE',
      zones: Object.freeze({
        interior: Object.freeze(derived.interior),
        reference100: Object.freeze(derived.reference100),
        reserve200: Object.freeze(derived.reserve200)
      }),
      counts,
      diagnostics: Object.freeze(diagnostics.map(item => Object.freeze(item)))
    });
  }

  window.bridgeMapLab_reclassifyWayfarerObservation = reclassify;
  window.bridgeMapLabWayfarerLocalReclassification = Object.freeze({
    version: VERSION,
    reclassify
  });
})();
