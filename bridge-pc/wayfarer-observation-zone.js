(() => {
  'use strict';

  const VERSION = '0.1.0';
  const EARTH_RADIUS_METERS = 6378137;
  const ZONES = Object.freeze({
    INTERIOR: 'INTERIOR',
    REFERENCE_100: 'REFERENCE_100',
    RESERVE_200: 'RESERVE_200',
    OUTSIDE: 'OUTSIDE'
  });

  if (window.__campsiteWayfarerObservationZoneInstalled) return;
  window.__campsiteWayfarerObservationZoneInstalled = true;

  function finite(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizePoint(value) {
    if (Array.isArray(value) && value.length >= 2) {
      const lat = finite(value[0]);
      const lng = finite(value[1]);
      if (lat === null || lng === null) return null;
      return { lat, lng };
    }
    if (value && typeof value === 'object') {
      const lat = finite(value.lat ?? value.latitude);
      const lng = finite(value.lng ?? value.longitude);
      if (lat === null || lng === null) return null;
      return { lat, lng };
    }
    return null;
  }

  function normalizePolygon(values) {
    const polygon = (Array.isArray(values) ? values : []).map(normalizePoint).filter(Boolean);
    if (polygon.length < 3) throw new Error('Observation polygon needs at least 3 vertices.');
    return polygon;
  }

  function metersPerDegreeLat() {
    return (Math.PI / 180) * EARTH_RADIUS_METERS;
  }

  function metersPerDegreeLng(latitude) {
    const latRad = Math.max(-89.999999, Math.min(89.999999, latitude)) * Math.PI / 180;
    return metersPerDegreeLat() * Math.max(1e-9, Math.cos(latRad));
  }

  function projectRelative(point, origin) {
    const avgLat = (point.lat + origin.lat) / 2;
    return {
      x: (point.lng - origin.lng) * metersPerDegreeLng(avgLat),
      y: (point.lat - origin.lat) * metersPerDegreeLat()
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
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      if (distancePointToSegmentMeters(point, a, b) <= toleranceMeters) return true;
    }
    return false;
  }

  function pointInPolygon(pointInput, polygonInput) {
    const point = normalizePoint(pointInput);
    const polygon = normalizePolygon(polygonInput);
    if (!point) return false;
    if (pointOnBoundary(point, polygon)) return true;

    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng;
      const yi = polygon[i].lat;
      const xj = polygon[j].lng;
      const yj = polygon[j].lat;
      const intersects =
        ((yi > point.lat) !== (yj > point.lat)) &&
        (point.lng < ((xj - xi) * (point.lat - yi)) / ((yj - yi) || 1e-15) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function distanceToPolygonMeters(pointInput, polygonInput) {
    const point = normalizePoint(pointInput);
    const polygon = normalizePolygon(polygonInput);
    if (!point) return Infinity;
    if (pointInPolygon(point, polygon)) return 0;

    let nearest = Infinity;
    for (let i = 0; i < polygon.length; i += 1) {
      nearest = Math.min(
        nearest,
        distancePointToSegmentMeters(point, polygon[i], polygon[(i + 1) % polygon.length])
      );
    }
    return nearest;
  }

  function classifyPoint(pointInput, polygonInput) {
    const point = normalizePoint(pointInput);
    if (!point) return { zone: ZONES.OUTSIDE, distanceMeters: Infinity };
    const polygon = normalizePolygon(polygonInput);
    if (pointInPolygon(point, polygon)) return { zone: ZONES.INTERIOR, distanceMeters: 0 };

    const distanceMeters = distanceToPolygonMeters(point, polygon);
    if (distanceMeters <= 100) return { zone: ZONES.REFERENCE_100, distanceMeters };
    if (distanceMeters <= 200) return { zone: ZONES.RESERVE_200, distanceMeters };
    return { zone: ZONES.OUTSIDE, distanceMeters };
  }

  function poiType(poi) {
    const kind = String(poi?.poiKind || '').trim().toUpperCase();
    const entity = String(poi?.gameEntity || '').trim().toUpperCase();
    const status = String(poi?.gameStatus || '').trim().toUpperCase();
    const referenceKind = String(poi?.referenceKind || '').trim().toUpperCase();

    if (status === 'ACTIVE' && kind === 'POKESTOP') return 'POKESTOP';
    if (status === 'ACTIVE' && kind === 'GYM') return 'GYM';
    if (status === 'ACTIVE' && kind === 'POWERSPOT') return 'ACTIVE_POWERSPOT';
    if (status === 'INACTIVE' && entity === 'POWERSPOT' && referenceKind === 'INACTIVE_POWERSPOT') {
      return 'INACTIVE_POWERSPOT';
    }
    return null;
  }

  function emptyCounts() {
    return { pokestop: 0, gym: 0, activePowerSpot: 0, inactivePowerSpot: 0, total: 0 };
  }

  function increment(counts, type) {
    if (type === 'POKESTOP') counts.pokestop += 1;
    else if (type === 'GYM') counts.gym += 1;
    else if (type === 'ACTIVE_POWERSPOT') counts.activePowerSpot += 1;
    else if (type === 'INACTIVE_POWERSPOT') counts.inactivePowerSpot += 1;
    counts.total += 1;
  }

  function classifyPois(polygonInput, poisInput) {
    const polygon = normalizePolygon(polygonInput);
    const zones = { interior: [], reference100: [], reserve200: [] };
    const counts = {
      interior: emptyCounts(),
      reference100: emptyCounts(),
      reserve200: emptyCounts()
    };
    let excluded = 0;
    let outside = 0;

    for (const poi of Array.isArray(poisInput) ? poisInput : []) {
      const type = poiType(poi);
      if (!type) {
        excluded += 1;
        continue;
      }
      const point = normalizePoint(poi);
      if (!point) {
        excluded += 1;
        continue;
      }

      const placement = classifyPoint(point, polygon);
      const item = {
        ...poi,
        observationZone: placement.zone,
        distanceFromPolygonMeters: placement.distanceMeters
      };

      if (placement.zone === ZONES.INTERIOR) {
        zones.interior.push(item);
        increment(counts.interior, type);
      } else if (placement.zone === ZONES.REFERENCE_100) {
        zones.reference100.push(item);
        increment(counts.reference100, type);
      } else if (placement.zone === ZONES.RESERVE_200) {
        zones.reserve200.push(item);
        increment(counts.reserve200, type);
      } else {
        outside += 1;
      }
    }

    return {
      version: VERSION,
      polygon: polygon.map(point => [point.lat, point.lng]),
      zones,
      counts,
      visibleTotal: counts.interior.total + counts.reference100.total,
      retainedTotal: counts.interior.total + counts.reference100.total + counts.reserve200.total,
      excludedCount: excluded,
      outsideCount: outside
    };
  }

  window.CampsiteWayfarerObservationZone = Object.freeze({
    version: VERSION,
    zones: ZONES,
    normalizePoint,
    normalizePolygon,
    pointInPolygon,
    distancePointToSegmentMeters,
    distanceToPolygonMeters,
    classifyPoint,
    poiType,
    classifyPois
  });
})();