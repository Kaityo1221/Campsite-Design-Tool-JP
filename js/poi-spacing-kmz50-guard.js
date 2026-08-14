/* ======================================================
   50m KMZ generation guard
   - 50m circle layer is always included in generated KMZ
   - 30m / 40m remain optional reference layers
   - Works after the legacy generateKMZ safety wrapper
====================================================== */

(() => {
  "use strict";

  const KML_NS = "http://www.opengis.net/kml/2.2";
  const WRAPPED = "__poiSpacingKmz50GuardWrapped";

  function directChildText(element, tagName) {
    if (!element) return "";

    const target = String(tagName || "").toLowerCase();
    const child = Array.from(element.children || []).find(node =>
      String(node.localName || node.tagName || "").toLowerCase() === target
    );

    return child?.textContent?.trim() || "";
  }

  function getFolderName(element) {
    let current = element?.parentElement || null;

    while (current) {
      const localName = String(current.localName || current.tagName || "").toLowerCase();
      if (localName === "folder") {
        return directChildText(current, "name");
      }
      current = current.parentElement;
    }

    return "";
  }

  function parseCoordinate(text) {
    const parts = String(text || "").trim().split(",");
    const lng = Number(parts[0]);
    const lat = Number(parts[1]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return { lat, lng };
  }

  function collectPointCenters(xml) {
    const points = [];
    const seen = new Set();

    Array.from(xml.getElementsByTagName("Placemark")).forEach(placemark => {
      const pointNode = placemark.getElementsByTagName("Point")[0];
      if (!pointNode) return;

      const folderName = getFolderName(placemark);
      if (/円|30m|40m|50m/i.test(folderName)) return;

      const name = directChildText(placemark, "name");
      const description = directChildText(placemark, "description");

      if (
        name.startsWith("ここに追加") ||
        description.includes("ダミーポイント") ||
        description.includes("レイヤー保持用")
      ) {
        return;
      }

      const coordinates = pointNode.getElementsByTagName("coordinates")[0]?.textContent?.trim();
      const center = parseCoordinate(String(coordinates || "").split(/\s+/)[0]);
      if (!center) return;

      const key = `${center.lat.toFixed(7)},${center.lng.toFixed(7)}`;
      if (seen.has(key)) return;
      seen.add(key);

      points.push({
        ...center,
        name: name || "POI"
      });
    });

    return points;
  }

  function getPolygonCenter(placemark) {
    const polygon = placemark.getElementsByTagName("Polygon")[0];
    if (!polygon) return null;

    const text = polygon.getElementsByTagName("coordinates")[0]?.textContent?.trim();
    if (!text) return null;

    const coordinates = text
      .split(/\s+/)
      .map(parseCoordinate)
      .filter(Boolean);

    if (coordinates.length < 3) return null;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    coordinates.forEach(point => {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLng = Math.min(minLng, point.lng);
      maxLng = Math.max(maxLng, point.lng);
    });

    if (![minLat, maxLat, minLng, maxLng].every(Number.isFinite)) {
      return null;
    }

    return {
      lat: (minLat + maxLat) / 2,
      lng: (minLng + maxLng) / 2
    };
  }

  function collectCircleCenters(xml) {
    const points = [];
    const seen = new Set();

    Array.from(xml.getElementsByTagName("Folder")).forEach(folder => {
      const folderName = directChildText(folder, "name");
      if (!/(30m|40m).*円|円.*(30m|40m)/i.test(folderName)) return;

      Array.from(folder.getElementsByTagName("Placemark")).forEach(placemark => {
        const center = getPolygonCenter(placemark);
        if (!center) return;

        const key = `${center.lat.toFixed(7)},${center.lng.toFixed(7)}`;
        if (seen.has(key)) return;
        seen.add(key);

        let name = directChildText(placemark, "name") || "POI";
        name = name.replace(/_(30|40)m円.*$/i, "");

        points.push({
          ...center,
          name
        });
      });
    });

    return points;
  }

  function createCircleCoordinates(lat, lng, radiusMeters, steps = 72) {
    const coordinates = [];
    const earthRadius = 6378137;
    const centerLat = Number(lat) * Math.PI / 180;
    const centerLng = Number(lng) * Math.PI / 180;
    const radius = Number(radiusMeters);

    if (
      !Number.isFinite(centerLat) ||
      !Number.isFinite(centerLng) ||
      !Number.isFinite(radius)
    ) {
      return "";
    }

    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const pointLat = Math.asin(
        Math.sin(centerLat) * Math.cos(radius / earthRadius) +
        Math.cos(centerLat) * Math.sin(radius / earthRadius) * Math.cos(angle)
      );
      const pointLng = centerLng + Math.atan2(
        Math.sin(angle) * Math.sin(radius / earthRadius) * Math.cos(centerLat),
        Math.cos(radius / earthRadius) - Math.sin(centerLat) * Math.sin(pointLat)
      );

      coordinates.push(
        `${pointLng * 180 / Math.PI},${pointLat * 180 / Math.PI},0`
      );
    }

    return coordinates.join(" ");
  }

  function createFolder(xml, documentNode, name) {
    const folder = xml.createElementNS(KML_NS, "Folder");
    const nameNode = xml.createElementNS(KML_NS, "name");
    nameNode.textContent = name;
    folder.appendChild(nameNode);
    documentNode.appendChild(folder);
    return folder;
  }

  function createCirclePlacemark(xml, point, radius) {
    const placemark = xml.createElementNS(KML_NS, "Placemark");
    const name = xml.createElementNS(KML_NS, "name");
    name.textContent = point.name ? `${point.name}_${radius}m円` : "";
    placemark.appendChild(name);

    const polygon = xml.createElementNS(KML_NS, "Polygon");
    const outer = xml.createElementNS(KML_NS, "outerBoundaryIs");
    const ring = xml.createElementNS(KML_NS, "LinearRing");
    const coordinates = xml.createElementNS(KML_NS, "coordinates");
    coordinates.textContent = createCircleCoordinates(point.lat, point.lng, radius);

    ring.appendChild(coordinates);
    outer.appendChild(ring);
    polygon.appendChild(outer);
    placemark.appendChild(polygon);

    return placemark;
  }

  function findCircleFolder(xml, meters) {
    return Array.from(xml.getElementsByTagName("Folder")).find(folder => {
      const name = directChildText(folder, "name");
      return name.includes(`${meters}m`) && name.includes("円");
    }) || null;
  }

  function renameReferenceFolders(xml) {
    const folder40 = findCircleFolder(xml, 40);
    const folder30 = findCircleFolder(xml, 30);

    const name40 = folder40 && Array.from(folder40.children || []).find(node =>
      String(node.localName || node.tagName || "").toLowerCase() === "name"
    );
    const name30 = folder30 && Array.from(folder30.children || []).find(node =>
      String(node.localName || node.tagName || "").toLowerCase() === "name"
    );

    if (name40) name40.textContent = "40m円（参考距離）";
    if (name30) name30.textContent = "30m円（参考距離）";
  }

  function removeUnselectedReferenceFolders(xml, keep40, keep30) {
    if (!keep40) {
      findCircleFolder(xml, 40)?.remove();
    }
    if (!keep30) {
      findCircleFolder(xml, 30)?.remove();
    }
  }

  function ensure50mLayer(kmlText, options) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(kmlText, "application/xml");

    if (xml.getElementsByTagName("parsererror").length > 0) {
      throw new Error("KMLの解析に失敗しました");
    }

    const documentNode = xml.getElementsByTagName("Document")[0];
    if (!documentNode) {
      throw new Error("KML Documentが見つかりません");
    }

    renameReferenceFolders(xml);

    let folder50 = findCircleFolder(xml, 50);

    if (!folder50) {
      let centers = collectPointCenters(xml);
      if (centers.length === 0) {
        centers = collectCircleCenters(xml);
      }

      if (centers.length === 0) {
        throw new Error("50m円の中心座標を取得できませんでした");
      }

      folder50 = createFolder(xml, documentNode, "50m円（目安）");
      centers.forEach(point => {
        folder50.appendChild(createCirclePlacemark(xml, point, 50));
      });
    } else {
      const nameNode = Array.from(folder50.children || []).find(node =>
        String(node.localName || node.tagName || "").toLowerCase() === "name"
      );
      if (nameNode) nameNode.textContent = "50m円（目安）";
    }

    removeUnselectedReferenceFolders(
      xml,
      options.keep40,
      options.keep30
    );

    return new XMLSerializer().serializeToString(xml);
  }

  function force50Checkbox(groupName) {
    const input = document.querySelector(`input[name="${groupName}"][value="50"]`);
    if (!input) return () => {};

    const oldChecked = input.checked;
    input.checked = true;

    return () => {
      input.checked = oldChecked;
    };
  }

  function installZipGuard(options) {
    const Zip = window.JSZip;
    const prototype = Zip?.prototype;

    if (!prototype || typeof prototype.generateAsync !== "function") {
      return () => {};
    }

    const originalGenerateAsync = prototype.generateAsync;

    prototype.generateAsync = async function (...args) {
      try {
        const entry = this.file("doc.kml");
        if (entry) {
          const originalKml = await entry.async("string");
          const patchedKml = ensure50mLayer(originalKml, options);
          this.file("doc.kml", patchedKml);
        }
      } catch (error) {
        console.error("50m円の必須生成に失敗しました。", error);
        throw error;
      }

      return originalGenerateAsync.apply(this, args);
    };

    return () => {
      if (prototype.generateAsync !== originalGenerateAsync) {
        prototype.generateAsync = originalGenerateAsync;
      }
    };
  }

  function wrapGenerator(name, groupName, circleOnly = false) {
    const original = window[name];
    if (typeof original !== "function" || original[WRAPPED]) return;

    const wrapped = async function (...args) {
      const input40 = document.querySelector(`input[name="${groupName}"][value="40"]`);
      const input30 = document.querySelector(`input[name="${groupName}"][value="30"]`);

      const keep40 = Boolean(input40?.checked);
      const keep30 = Boolean(input30?.checked);
      const restore50 = force50Checkbox(groupName);

      let seeded40 = false;
      if (circleOnly && !keep40 && !keep30 && input40) {
        input40.checked = true;
        seeded40 = true;
      }

      const restoreZip = installZipGuard({ keep40, keep30 });

      try {
        return await original.apply(this, args);
      } finally {
        restoreZip();
        restore50();
        if (seeded40 && input40) {
          input40.checked = false;
        }
      }
    };

    Object.defineProperty(wrapped, WRAPPED, { value: true });
    window[name] = wrapped;
  }

  function apply() {
    wrapGenerator("generateKMZ", "radius", false);
    wrapGenerator("generateCircleOnlyKMZ", "circleOnlyRadius", true);
  }

  apply();
  window.addEventListener("load", apply, { once: true });
})();
