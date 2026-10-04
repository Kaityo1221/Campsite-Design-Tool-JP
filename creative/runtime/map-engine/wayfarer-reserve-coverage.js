(() => {
  'use strict';

  const VERSION = '0.1.1';
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
    if (polygon.length >= 4) {
      const first = polygon[0];
      const last = polygon[polygon.length - 1];
      if (Math.abs(first[0] - last[0]) < 1e-12 && Math.abs(first[1] - last[1]) < 1e-12) {
        polygon.pop();
      }
    }
    if (polygon.length < 3 || polygon.length > 30) return [];
    return isSimplePolygon(polygon) ? polygon : [];
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

  function localPolygon(polygon) {
    const origin = polygon[0];
    return polygon.map(point => projectRelative(point, origin));
  }

  function cross(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  function onSegment(a, b, p, epsilon = 1e-7) {
    return Math.abs(cross(a, b, p)) <= epsilon &&
      p.x >= Math.min(a.x, b.x) - epsilon &&
      p.x <= Math.max(a.x, b.x) + epsilon &&
      p.y >= Math.min(a.y, b.y) - epsilon &&
      p.y <= Math.max(a.y, b.y) + epsilon;
  }

  function segmentsIntersect(a, b, c, d) {
    const abC = cross(a, b, c);
    const abD = cross(a, b, d);
    const cdA = cross(c, d, a);
    const cdB = cross(c, d, b);
    if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) &&
        ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) return true;
    return onSegment(a,b,c) || onSegment(a,b,d) || onSegment(c,d,a) || onSegment(c,d,b);
  }

  function isSimplePolygon(polygon) {
    const local = localPolygon(polygon);
    let twiceArea = 0;
    for (let i = 0; i < local.length; i += 1) {
      const a = local[i];
      const b = local[(i + 1) % local.length];
      twiceArea += a.x * b.y - b.x * a.y;
      if (Math.hypot(b.x - a.x, b.y - a.y) < 0.05) return false;
    }
    if (Math.abs(twiceArea) < 0.02) return false;

    for (let i = 0; i < local.length; i += 1) {
      const a = local[i];
      const b = local[(i + 1) % local.length];
      for (let j = i + 1; j < local.length; j += 1) {
        const adjacent =
          j === i ||
          j === i + 1 ||
          (i === 0 && j === local.length - 1);
        if (adjacent) continue;
        const c = local[j];
        const d = local[(j + 1) % local.length];
        if (segmentsIntersect(a,b,c,d)) return false;
      }
    }
    return true;
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
    isSimplePolygon,
    distanceToPolygonMeters,
    evaluate
  });
})();
