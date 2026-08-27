/* Differential KMZ circle geometry guard.
   Downsamples 30m / 40m / 50m circle polygons to 36 segments immediately
   before JSZip generates the output archive. This keeps the differential
   updater lightweight without altering existing non-circle geometry. */
(() => {
  'use strict';

  const WRAPPED = '__campsiteDiff36GuardWrapped';
  const TARGET_SEGMENTS = 36;

  function directChildText(element, tagName) {
    if (!element) return '';
    const target = String(tagName || '').toLowerCase();
    const child = Array.from(element.children || []).find(node =>
      String(node.localName || node.tagName || '').toLowerCase() === target
    );
    return child?.textContent?.trim() || '';
  }

  function isCircleFolder(folder) {
    const name = directChildText(folder, 'name').normalize('NFKC');
    return /(?:30|40|50)\s*m/i.test(name) && /(円|サークル|circle)/i.test(name);
  }

  function downsampleCoordinates(text) {
    const points = String(text || '')
      .trim()
      .split(/\s+/)
      .map(value => {
        const parts = value.split(',');
        const lng = Number(parts[0]);
        const lat = Number(parts[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
        return { lng, lat };
      })
      .filter(Boolean);

    if (points.length < 4) return null;

    const unique = points.slice();
    const first = unique[0];
    const last = unique[unique.length - 1];
    if (
      first && last &&
      Math.abs(first.lng - last.lng) < 1e-12 &&
      Math.abs(first.lat - last.lat) < 1e-12
    ) {
      unique.pop();
    }

    if (unique.length <= TARGET_SEGMENTS) return null;

    const sampled = [];
    for (let i = 0; i < TARGET_SEGMENTS; i++) {
      const index = Math.floor(i * unique.length / TARGET_SEGMENTS);
      sampled.push(unique[index]);
    }
    sampled.push({ ...sampled[0] });

    return sampled
      .map(point => `${point.lng.toFixed(7)},${point.lat.toFixed(7)},0`)
      .join(' ');
  }

  function optimizeKml(text) {
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    if (xml.getElementsByTagName('parsererror').length > 0) return text;

    let changed = false;
    Array.from(xml.getElementsByTagName('Folder')).forEach(folder => {
      if (!isCircleFolder(folder)) return;

      Array.from(folder.getElementsByTagName('Polygon')).forEach(polygon => {
        const coordinates = polygon.getElementsByTagName('coordinates')[0];
        if (!coordinates) return;
        const optimized = downsampleCoordinates(coordinates.textContent);
        if (!optimized) return;
        coordinates.textContent = optimized;
        changed = true;
      });
    });

    return changed ? new XMLSerializer().serializeToString(xml) : text;
  }

  function install() {
    const Zip = window.JSZip;
    const prototype = Zip?.prototype;
    if (!prototype || typeof prototype.generateAsync !== 'function') return false;
    if (prototype.generateAsync[WRAPPED]) return true;

    const original = prototype.generateAsync;
    const wrapped = async function (...args) {
      const kmlNames = Object.keys(this.files || {}).filter(name =>
        name.toLowerCase().endsWith('.kml') && !this.files[name]?.dir
      );

      for (const name of kmlNames) {
        try {
          const text = await this.files[name].async('text');
          const optimized = optimizeKml(text);
          if (optimized !== text) this.file(name, optimized);
        } catch (error) {
          console.warn('36-segment differential circle optimization skipped:', error);
        }
      }

      return original.apply(this, args);
    };

    Object.defineProperty(wrapped, WRAPPED, { value: true });
    prototype.generateAsync = wrapped;
    return true;
  }

  if (!install()) {
    const timer = setInterval(() => {
      if (install()) clearInterval(timer);
    }, 100);
    setTimeout(() => clearInterval(timer), 10000);
  }
})();
