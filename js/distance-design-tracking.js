(() => {
  'use strict';

  const TRACK_URL = 'https://azkshxjgsbtjgwbapcfw.supabase.co/rest/v1/rpc/record_campsite_design_event';
  const TRACK_KEY = 'sb_publishable_rWbeIqdWJJHHBtphER8bdg__CaS_xGK';

  function getDeviceId() {
    try {
      const key = 'campsiteUserId';
      let value = localStorage.getItem(key);
      if (!value) {
        value = crypto.randomUUID?.() || ('dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
        localStorage.setItem(key, value);
      }
      return value;
    } catch (_) {
      return null;
    }
  }

  function getParkName() {
    const fileName = String(window._distanceSourceFile?.name || '')
      .replace(/\.kmz\.zip$/i, '')
      .replace(/\.(kmz|kml|zip)$/i, '')
      .replace(/_creative$/i, '')
      .trim();
    if (fileName) return fileName;

    try {
      const points = collectPoints();
      const guessed = typeof window.guessParkNameFromPoints === 'function'
        ? window.guessParkNameFromPoints(points)
        : '';
      return String(guessed || 'campsite').trim() || 'campsite';
    } catch (_) {
      return 'campsite';
    }
  }

  function normalizePoint(point) {
    if (!point) return null;
    if (Array.isArray(point) && point.length >= 2) {
      const lat = Number(point[0]);
      const lng = Number(point[1]);
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
    }
    const lat = Number(point.lat ?? point.latitude ?? point[0]);
    const lng = Number(point.lng ?? point.lon ?? point.longitude ?? point[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }

  function polygonPoints(polygon) {
    const raw = Array.isArray(polygon)
      ? polygon
      : (Array.isArray(polygon?.points)
          ? polygon.points
          : (Array.isArray(polygon?.coordinates) ? polygon.coordinates : []));
    return raw.map(normalizePoint).filter(Boolean);
  }

  function polygonAreaScore(polygon) {
    const pts = polygonPoints(polygon);
    if (pts.length < 3) return 0;
    const lat0 = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const kx = 111320 * Math.cos(lat0 * Math.PI / 180);
    const ky = 110540;
    let area2 = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const ax = a[1] * kx;
      const ay = a[0] * ky;
      const bx = b[1] * kx;
      const by = b[0] * ky;
      area2 += ax * by - bx * ay;
    }
    return Math.abs(area2) / 2;
  }

  function collectActivityPolygons() {
    const raw = Array.isArray(window._activityPolygons) ? window._activityPolygons : [];
    const candidates = raw
      .map(polygon => ({ polygon, area: polygonAreaScore(polygon) }))
      .filter(item => item.area > 0)
      .sort((a, b) => b.area - a.area);

    if (!candidates.length) return [];

    // Distance-check KMZs may contain one buffer polygon per POI.
    // The activity area is the single large polygon that encloses the design,
    // so tracking keeps only the largest polygon and ignores distance circles.
    return [candidates[0].polygon];
  }

  function canonicalLayer(layerName) {
    try {
      const type = typeof window.getPoiTypeFromLayerName === 'function'
        ? window.getPoiTypeFromLayerName(layerName)
        : null;
      const role = typeof window.isAddedLayerName === 'function' && window.isAddedLayerName(layerName)
        ? 'new'
        : (typeof window.isExistingLayerName === 'function' && window.isExistingLayerName(layerName) ? 'existing' : null);
      if (!type || !role) return null;
      return `${role}-${type === 'power' ? 'power' : type}`;
    } catch (_) {
      return null;
    }
  }

  function collectPoints() {
    const out = [];
    Object.entries(window._layerPoints || {}).forEach(([layerName, points]) => {
      if (!Array.isArray(points)) return;
      if (typeof window.isAuxiliaryLayer === 'function' && window.isAuxiliaryLayer(layerName)) return;
      const layer = canonicalLayer(layerName);
      if (!layer) return;
      points.forEach(point => {
        const lat = Number(point?.lat);
        const lng = Number(point?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        out.push({ ...point, lat, lng, layer, originalLayer: layerName });
      });
    });
    return out;
  }

  function getCenter(points, polygons) {
    const polygonCoords = polygons.flatMap(polygonPoints);
    if (polygonCoords.length) {
      return {
        lat: polygonCoords.reduce((sum, p) => sum + p[0], 0) / polygonCoords.length,
        lng: polygonCoords.reduce((sum, p) => sum + p[1], 0) / polygonCoords.length,
        source: 'polygon'
      };
    }
    if (points.length) {
      return {
        lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
        lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
        source: 'poi_centroid'
      };
    }
    return { lat: null, lng: null, source: null };
  }

  function projectKey(parkName, center) {
    const normalized = String(parkName || 'campsite')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    const lat = Number.isFinite(center.lat) ? center.lat.toFixed(3) : 'na';
    const lng = Number.isFinite(center.lng) ? center.lng.toFixed(3) : 'na';
    return `${normalized}|${lat},${lng}`;
  }

  function canonicalDesign(points, polygons) {
    const poi = points
      .map(p => [p.layer, p.lat.toFixed(6), p.lng.toFixed(6)].join('|'))
      .sort();
    const poly = polygons
      .map(polygonPoints)
      .filter(points => points.length)
      .map(points => points.map(p => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).sort().join('|'))
      .sort();
    return JSON.stringify({ poi, poly });
  }

  async function hashText(text) {
    try {
      if (crypto.subtle) {
        const bytes = new TextEncoder().encode(text);
        const buffer = await crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (_) {}

    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return 'fnv1a-' + (hash >>> 0).toString(16).padStart(8, '0');
  }

  async function trackDistanceCheck() {
    try {
      const points = collectPoints();
      if (points.length < 2) return;
      const polygons = collectActivityPolygons();
      const center = getCenter(points, polygons);
      const parkName = getParkName();
      const fingerprint = await hashText(canonicalDesign(points, polygons));
      const existing = points.filter(p => p.layer.startsWith('existing-')).length;
      const added = points.filter(p => p.layer.startsWith('new-')).length;

      await fetch(TRACK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: TRACK_KEY
        },
        body: JSON.stringify({
          p_project_key: projectKey(parkName, center),
          p_park_name: parkName,
          p_center_lat: center.lat,
          p_center_lng: center.lng,
          p_center_source: center.source,
          p_anonymous_device_id: getDeviceId(),
          p_design_fingerprint: fingerprint,
          p_source_type: 'distance_check',
          p_event_type: 'distance_check',
          p_poi_count: points.length,
          p_existing_poi_count: existing,
          p_added_poi_count: added,
          p_polygon_count: polygons.length
        }),
        keepalive: true
      });
    } catch (_) {}
  }

  function installWrapper() {
    const original = window.runDistanceCheck;
    if (typeof original !== 'function') {
      setTimeout(installWrapper, 250);
      return;
    }
    if (original.__designTrackingWrapped) return;

    const wrapped = async function (...args) {
      const result = await original.apply(this, args);
      void trackDistanceCheck();
      return result;
    };
    wrapped.__designTrackingWrapped = true;
    window.runDistanceCheck = wrapped;
  }

  installWrapper();
})();
