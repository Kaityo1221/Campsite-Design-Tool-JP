(() => {
  'use strict';

  const VERSION = '0.1.0';
  const EARTH_RADIUS_METERS = 6378137;
  const REQUIRED_REFERENCE_METERS = 100;
  const DEFAULT_SAMPLE_SPACING_METERS = 2;
  const DEFAULT_MAX_SAMPLES = 20000;
  const PROJECTION_GUARD_METERS = 0.5;

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizePoint(value) {
    if (!Array.isArray(value) || value.length < 2) return null;
    const lat = finite(value[0]);
    const lng = finite(value[1]);
    if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lat, lng];
  }

  function normalizePolygon(values) {
    const polygon = (Array.isArray(values) ? values : []).map(normalizePoint).filter(Boolean);
    return polygon.length >= 3 && polygon.length <= 30 ? polygon : [];
  }

  function metersPerDegreeLat() {
    return (Math.PI / 180) * EARTH_RADIUS_METERS;
  }

  function metersPerDegreeLng(latitude) {
    const latRad = Math.max(-89.999999, Math.min(89.999999, latitude)) * Math.PI / 180;
    return metersPerDegreeLat() * Math.max(1e-9, Math.cos(latRad));
  }

  function projectRelative(point, origin) {
    const avgLat = (point[0] + origin[0]) / 2;
    return {
      x: (point[1] - origin[1]) * metersPerDegreeLng(avgLat),
      y: (point[0] - origin[0]) * metersPerDegreeLat()
    };
  }

  function distancePointToSegmentMeters(point, a, b) {
    const pa = projectRelative(a, point);
    const pb = projectRelative(b, point);
    const vx = pb.x - pa.x;
    const vy = pb.y - pa.y;
    const lengthSquared = vx * vx + vy * vy;
    if (lengthSquared <= 1e-18) return Math.hypot(pa.x, pa.y);
    const t = Math.max(0, Math.min(1, -(pa.x * vx + pa.y * vy) / lengthSquared));
    return Math.hypot(pa.x + t * vx, pa.y + t * vy);
  }

  function pointOnBoundary(point, polygon, toleranceMeters = 0.25) {
    for (let index = 0; index < polygon.length; index += 1) {
      if (distancePointToSegmentMeters(point, polygon[index], polygon[(index + 1) % polygon.length]) <= toleranceMeters) {
        return true;
      }
    }
    return false;
  }

  function pointInPolygon(point, polygon) {
    if (pointOnBoundary(point, polygon)) return true;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const yi = polygon[i][0];
      const xi = polygon[i][1];
      const yj = polygon[j][0];
      const xj = polygon[j][1];
      const intersects =
        ((yi > point[0]) !== (yj > point[0])) &&
        (point[1] < ((xj - xi) * (point[0] - yi)) / ((yj - yi) || 1e-15) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function distanceToPolygonMeters(point, polygon) {
    if (pointInPolygon(point, polygon)) return 0;
    let nearest = Infinity;
    for (let index = 0; index < polygon.length; index += 1) {
      nearest = Math.min(
        nearest,
        distancePointToSegmentMeters(point, polygon[index], polygon[(index + 1) % polygon.length])
      );
    }
    return nearest;
  }

  function segmentLengthMeters(a, b) {
    const projected = projectRelative(b, a);
    return Math.hypot(projected.x, projected.y);
  }

  function resultBase(observation, acquiredBufferMeters, availableExpansionMeters, sampleSpacingMeters) {
    return {
      version: VERSION,
      requiredReferenceMeters: REQUIRED_REFERENCE_METERS,
      acquiredBufferMeters,
      availableExpansionMeters,
      sampleSpacingMeters,
      acquisitionCoverageComplete: observation?.acquisition?.coverageComplete === true
    };
  }

  function evaluate(observation, currentPolygonInput, options = {}) {
    const acquiredPolygon = normalizePolygon(observation?.polygon);
    const currentPolygon = normalizePolygon(currentPolygonInput);
    const acquiredBufferMeters = finite(observation?.acquisition?.bufferMeters);
    const sampleSpacingMeters = Math.max(
      0.5,
      Math.min(10, finite(options.sampleSpacingMeters) ?? DEFAULT_SAMPLE_SPACING_METERS)
    );
    const maxSamples = Math.max(100, Math.floor(finite(options.maxSamples) ?? DEFAULT_MAX_SAMPLES));
    const availableExpansionMeters =
      acquiredBufferMeters === null ? null : acquiredBufferMeters - REQUIRED_REFERENCE_METERS;
    const base = resultBase(observation, acquiredBufferMeters, availableExpansionMeters, sampleSpacingMeters);

    if (!acquiredPolygon.length) {
      return Object.freeze({ ...base, covered: false, reason: 'INVALID_ACQUISITION_POLYGON', sampleCount: 0, maxDistanceMeters: null });
    }
    if (!currentPolygon.length) {
      return Object.freeze({ ...base, covered: false, reason: 'INVALID_CURRENT_POLYGON', sampleCount: 0, maxDistanceMeters: null });
    }
    if (acquiredBufferMeters === null) {
      return Object.freeze({ ...base, covered: false, reason: 'MISSING_ACQUISITION_BUFFER', sampleCount: 0, maxDistanceMeters: null });
    }
    if (availableExpansionMeters < 0) {
      return Object.freeze({ ...base, covered: false, reason: 'INSUFFICIENT_ACQUISITION_BUFFER', sampleCount: 0, maxDistanceMeters: null });
    }

    let estimatedSamples = 0;
    const edgeSteps = [];
    for (let index = 0; index < currentPolygon.length; index += 1) {
      const a = currentPolygon[index];
      const b = currentPolygon[(index + 1) % currentPolygon.length];
      const steps = Math.max(1, Math.ceil(segmentLengthMeters(a, b) / sampleSpacingMeters));
      edgeSteps.push(steps);
      estimatedSamples += steps;
      if (estimatedSamples > maxSamples) {
        return Object.freeze({ ...base, covered: false, reason: 'SAMPLE_LIMIT', sampleCount: 0, maxDistanceMeters: null });
      }
    }

    const safetyMarginMeters = Math.min(
      availableExpansionMeters,
      sampleSpacingMeters / 2 + PROJECTION_GUARD_METERS
    );
    const safeDistanceMeters = Math.max(0, availableExpansionMeters - safetyMarginMeters);
    let sampleCount = 0;
    let maxDistanceMeters = 0;

    for (let index = 0; index < currentPolygon.length; index += 1) {
      const a = currentPolygon[index];
      const b = currentPolygon[(index + 1) % currentPolygon.length];
      const steps = edgeSteps[index];
      for (let step = 0; step < steps; step += 1) {
        const t = step / steps;
        const point = [
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t
        ];
        const distanceMeters = distanceToPolygonMeters(point, acquiredPolygon);
        sampleCount += 1;
        maxDistanceMeters = Math.max(maxDistanceMeters, distanceMeters);
        if (distanceMeters > safeDistanceMeters) {
          return Object.freeze({
            ...base,
            covered: false,
            reason: 'OUTSIDE_RESERVE',
            sampleCount,
            maxDistanceMeters,
            safetyMarginMeters,
            safeDistanceMeters
          });
        }
      }
    }

    return Object.freeze({
      ...base,
      covered: true,
      reason: 'COVERED',
      sampleCount,
      maxDistanceMeters,
      safetyMarginMeters,
      safeDistanceMeters
    });
  }

  window.bridgeMapLab_evaluateWayfarerReserveCoverage = evaluate;
  window.bridgeMapLabWayfarerReserveCoverage = Object.freeze({
    version: VERSION,
    requiredReferenceMeters: REQUIRED_REFERENCE_METERS,
    normalizePolygon,
    distanceToPolygonMeters,
    evaluate
  });
})();
