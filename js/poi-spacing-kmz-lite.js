/* ======================================================
   KMZ circle geometry lightweight optimizer
   - Keeps circle radii unchanged
   - Resamples generated circle polygons to 36 segments
   - Rounds coordinates to 7 decimal places
====================================================== */

(() => {
  "use strict";

  const WRAPPED = "__campsiteKmzLiteWrapped";
  const TARGET_SEGMENTS = 36;

  function isCircleFolder(folder) {
    const name = Array.from(folder.children || []).find(node =>
      String(node.localName || node.tagName || "").toLowerCase() === "name"
    )?.textContent || "";

    return /(?:30|40|50)m/i.test(name) && name.includes("円");
  }

  function parseCoordinate(text) {
    const [lngRaw, latRaw, altitudeRaw] = String(text || "").split(",");
    const lng = Number(lngRaw);
    const lat = Number(latRaw);
    const altitude = Number(altitudeRaw || 0);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

    return {
      lng,
      lat,
      altitude: Number.isFinite(altitude) ? altitude : 0
    };
  }

  function formatCoordinate(point) {
    return `${point.lng.toFixed(7)},${point.lat.toFixed(7)},${Number(point.altitude || 0).toFixed(0)}`;
  }

  function resampleRing(points) {
    if (points.length < 4) return points;

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

    if (unique.length <= TARGET_SEGMENTS) {
      const closed = unique.slice();
      if (closed.length > 0) closed.push({ ...closed[0] });
      return closed;
    }

    const sampled = [];
    for (let i = 0; i < TARGET_SEGMENTS; i++) {
      const index = Math.round(i * unique.length / TARGET_SEGMENTS) % unique.length;
      sampled.push(unique[index]);
    }

    if (sampled.length > 0) sampled.push({ ...sampled[0] });
    return sampled;
  }

  function optimizeKml(kmlText) {
    const xml = new DOMParser().parseFromString(kmlText, "application/xml");
    if (xml.getElementsByTagName("parsererror").length > 0) {
      return kmlText;
    }

    Array.from(xml.getElementsByTagName("Folder"))
      .filter(isCircleFolder)
      .forEach(folder => {
        Array.from(folder.getElementsByTagName("Polygon")).forEach(polygon => {
          const coordinateNode = polygon.getElementsByTagName("coordinates")[0];
          if (!coordinateNode) return;

          const points = String(coordinateNode.textContent || "")
            .trim()
            .split(/\s+/)
            .map(parseCoordinate)
            .filter(Boolean);

          if (points.length < 4) return;

          coordinateNode.textContent = resampleRing(points)
            .map(formatCoordinate)
            .join(" ");
        });
      });

    return new XMLSerializer().serializeToString(xml);
  }

  function install() {
    const Zip = window.JSZip;
    const prototype = Zip?.prototype;

    if (!prototype || typeof prototype.generateAsync !== "function") return;
    if (prototype.generateAsync[WRAPPED]) return;

    const originalGenerateAsync = prototype.generateAsync;

    const wrapped = async function (...args) {
      const entry = this.file("doc.kml");
      if (entry) {
        try {
          const originalKml = await entry.async("string");
          const optimizedKml = optimizeKml(originalKml);
          this.file("doc.kml", optimizedKml);
        } catch (error) {
          console.warn("KMZ軽量化をスキップしました。", error);
        }
      }

      return originalGenerateAsync.apply(this, args);
    };

    Object.defineProperty(wrapped, WRAPPED, { value: true });
    prototype.generateAsync = wrapped;
  }

  install();
  window.addEventListener("load", install, { once: true });
})();
