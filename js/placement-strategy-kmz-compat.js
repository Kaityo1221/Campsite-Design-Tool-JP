(() => {
  'use strict';

  const currentPath = window.location.pathname.replace(/\/+$/, '');
  const supportedPage = currentPath.endsWith('/lab.html') || currentPath.endsWith('/placement-strategy.html');
  if (!supportedPage) return;

  const CIRCLE_LABEL = /(?:^|\s)(?:30|40|50)\s*m(?:\s|$)|サークル|circle/i;
  const ACTIVITY_LABEL = /活動範囲|活動エリア|活動区域|ポリゴン/i;

  function childrenByLocalName(node, name) {
    return Array.from(node?.children || []).filter(child => child.localName === name);
  }

  function directChildText(node, name) {
    return childrenByLocalName(node, name)[0]?.textContent?.trim() || '';
  }

  function folderNameForPlacemark(pm) {
    let node = pm?.parentElement || null;
    while (node) {
      if (node.localName === 'Folder') return directChildText(node, 'name');
      node = node.parentElement;
    }
    return '';
  }

  function parseCoordinateText(text) {
    const points = String(text || '')
      .trim()
      .split(/\s+/)
      .map(token => token.split(',').map(Number))
      .filter(parts => Number.isFinite(parts[0]) && Number.isFinite(parts[1]))
      .map(parts => ({ lng: parts[0], lat: parts[1] }));

    if (points.length > 3) {
      const first = points[0];
      const last = points[points.length - 1];
      if (first.lat === last.lat && first.lng === last.lng) points.pop();
    }
    return points;
  }

  function getPlacemarkPolygons(xml) {
    const placemarks = Array.from(xml.getElementsByTagNameNS('*', 'Placemark'));
    const candidates = [];

    placemarks.forEach((pm, placemarkIndex) => {
      const folder = folderNameForPlacemark(pm);
      const name = directChildText(pm, 'name');
      const label = `${folder} ${name}`.trim();
      const circleLike = CIRCLE_LABEL.test(label);
      const activityLike = ACTIVITY_LABEL.test(label) && !circleLike;
      const polygons = Array.from(pm.getElementsByTagNameNS('*', 'Polygon'));

      polygons.forEach((polygon, polygonIndex) => {
        const outer = polygon.getElementsByTagNameNS('*', 'outerBoundaryIs')[0] || polygon;
        const ring = outer.getElementsByTagNameNS('*', 'LinearRing')[0] || outer;
        const coord = ring.getElementsByTagNameNS('*', 'coordinates')[0] ||
          polygon.getElementsByTagNameNS('*', 'coordinates')[0];
        const points = parseCoordinateText(coord?.textContent || '');
        if (points.length < 3) return;

        candidates.push({
          points,
          folder,
          name,
          label,
          circleLike,
          activityLike,
          placemarkIndex,
          polygonIndex
        });
      });
    });

    return candidates;
  }

  function polygonAreaScore(points) {
    if (!points?.length) return 0;
    const meanLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const mPerLng = 111320 * Math.cos(meanLat * Math.PI / 180);
    const mPerLat = 110540;
    let twiceArea = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      twiceArea += (a.lng * mPerLng) * (b.lat * mPerLat) - (b.lng * mPerLng) * (a.lat * mPerLat);
    }
    return Math.abs(twiceArea) / 2;
  }

  function chooseActivityPolygon(xml) {
    const candidates = getPlacemarkPolygons(xml);
    if (!candidates.length) return null;

    const preferred = candidates.filter(candidate => candidate.activityLike);
    if (preferred.length) {
      preferred.sort((a, b) => polygonAreaScore(b.points) - polygonAreaScore(a.points));
      return preferred[0];
    }

    const nonCircle = candidates.filter(candidate => !candidate.circleLike);
    if (nonCircle.length) {
      nonCircle.sort((a, b) => polygonAreaScore(b.points) - polygonAreaScore(a.points));
      return nonCircle[0];
    }

    return null;
  }

  function inspectKmlText(text) {
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    if (xml.querySelector('parsererror')) return { score: -1, xml, polygon: null };
    const polygon = chooseActivityPolygon(xml);
    const pointCount = xml.getElementsByTagNameNS('*', 'Point').length;
    if (!polygon) return { score: pointCount ? 1 : 0, xml, polygon: null };
    const score = (polygon.activityLike ? 1000000 : 100000) + Math.min(99999, polygonAreaScore(polygon.points)) + pointCount;
    return { score, xml, polygon };
  }

  function installCompat() {
    if (typeof window.getCapacityKmlText !== 'function' ||
        typeof window.extractFirstCapacityPolygon !== 'function') {
      return false;
    }

    if (window.CampsitePlacementStrategyKmzCompat?.installed) return true;

    const legacyGetKmlText = window.getCapacityKmlText;
    const legacyExtractPolygon = window.extractFirstCapacityPolygon;

    window.getCapacityKmlText = async function placementStrategyGetKmlText(file) {
      const name = String(file?.name || '').toLowerCase();
      if (name.endsWith('.kml')) return await file.text();

      if ((name.endsWith('.kmz') || name.endsWith('.zip')) && window.JSZip) {
        const zip = await window.JSZip.loadAsync(file);
        const kmlPaths = Object.keys(zip.files).filter(path =>
          !zip.files[path].dir && path.toLowerCase().endsWith('.kml')
        );
        if (!kmlPaths.length) return null;

        const ordered = [
          ...kmlPaths.filter(path => /(^|\/)doc\.kml$/i.test(path)),
          ...kmlPaths.filter(path => !/(^|\/)doc\.kml$/i.test(path))
        ];

        let bestText = null;
        let bestScore = -Infinity;
        for (const path of ordered) {
          const text = await zip.files[path].async('text');
          const inspected = inspectKmlText(text);
          if (inspected.score > bestScore) {
            bestScore = inspected.score;
            bestText = text;
          }
          if (inspected.polygon?.activityLike) break;
        }
        if (bestText) return bestText;
      }

      return await legacyGetKmlText(file);
    };

    window.extractFirstCapacityPolygon = function placementStrategyExtractActivityPolygon(xml) {
      const chosen = chooseActivityPolygon(xml);
      if (chosen) return chosen.points;
      return [];
    };

    window.CampsitePlacementStrategyKmzCompat = Object.freeze({
      installed: true,
      version: '2026-09-creative-kmz-v2',
      chooseActivityPolygon,
      inspectKmlText,
      legacyExtractPolygon
    });

    console.info('[Placement Strategy] Creative KMZ compatibility installed');
    return true;
  }

  function waitForCapacity(attempt = 0) {
    if (installCompat()) return;
    if (attempt >= 200) {
      console.warn('[Placement Strategy] capacity.js compatibility install timed out');
      return;
    }
    window.setTimeout(() => waitForCapacity(attempt + 1), 50);
  }

  waitForCapacity();
})();
