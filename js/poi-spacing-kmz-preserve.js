/* ======================================================
   POI spacing KMZ preserve / layer order
   - Circle layer order: 50m -> 40m -> 30m
   - If a completed KML/KMZ already contains 30m/40m circles,
     preserve the original file and add only the 50m circle layer.
====================================================== */

(() => {
  "use strict";

  const KML_NS = "http://www.opengis.net/kml/2.2";
  const WRAPPED = "__poiSpacingPreserveWrapped";

  function localName(node) {
    return String(node?.localName || node?.tagName || "").toLowerCase();
  }

  function directChildText(element, tagName) {
    if (!element) return "";
    const target = String(tagName || "").toLowerCase();
    const child = Array.from(element.children || []).find(node =>
      localName(node) === target
    );
    return child?.textContent?.trim() || "";
  }

  function circleMetersFromFolder(folder) {
    if (!folder || localName(folder) !== "folder") return null;
    const name = directChildText(folder, "name");
    if (!name.includes("円")) return null;
    const match = name.match(/(?:^|[^0-9])(50|40|30)m/i);
    return match ? Number(match[1]) : null;
  }

  function parseXml(kmlText) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(kmlText, "application/xml");
    if (xml.getElementsByTagName("parsererror").length > 0) {
      throw new Error("KMLの解析に失敗しました");
    }
    return xml;
  }

  function getDocumentNode(xml) {
    const documentNode = xml.getElementsByTagName("Document")[0];
    if (!documentNode) {
      throw new Error("KML Documentが見つかりません");
    }
    return documentNode;
  }

  function reorderCircleFolders(xml) {
    const documentNode = getDocumentNode(xml);
    const children = Array.from(documentNode.children || []);

    const circleFolders = children
      .map((node, index) => ({
        node,
        index,
        meters: circleMetersFromFolder(node)
      }))
      .filter(item => item.meters !== null);

    if (circleFolders.length <= 1) return;

    const firstIndex = Math.min(...circleFolders.map(item => item.index));
    const sorted = circleFolders
      .slice()
      .sort((a, b) => {
        if (a.meters !== b.meters) return b.meters - a.meters;
        return a.index - b.index;
      });

    circleFolders.forEach(item => item.node.remove());

    const remainingChildren = Array.from(documentNode.children || []);
    const insertionRef = remainingChildren[firstIndex] || null;

    sorted.forEach(item => {
      documentNode.insertBefore(item.node, insertionRef);
    });
  }

  function orderKmlText(kmlText) {
    const xml = parseXml(kmlText);
    reorderCircleFolders(xml);
    return new XMLSerializer().serializeToString(xml);
  }

  function getParentFolderName(element) {
    let current = element?.parentElement || null;
    while (current) {
      if (localName(current) === "folder") {
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
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  function collectPointCenters(xml) {
    const centers = [];
    const seen = new Set();

    Array.from(xml.getElementsByTagName("Placemark")).forEach(placemark => {
      const pointNode = Array.from(placemark.children || []).find(node =>
        localName(node) === "point"
      );
      if (!pointNode) return;

      const folderName = getParentFolderName(placemark);
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

      const coordinatesNode = Array.from(pointNode.children || []).find(node =>
        localName(node) === "coordinates"
      );
      const firstCoordinate = String(coordinatesNode?.textContent || "")
        .trim()
        .split(/\s+/)[0];
      const center = parseCoordinate(firstCoordinate);
      if (!center) return;

      const key = `${center.lat.toFixed(7)},${center.lng.toFixed(7)}`;
      if (seen.has(key)) return;
      seen.add(key);

      centers.push({
        ...center,
        name: name || "POI"
      });
    });

    return centers;
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

  function create50mFolder(xml, documentNode, centers) {
    const folder = xml.createElementNS(KML_NS, "Folder");
    const folderName = xml.createElementNS(KML_NS, "name");
    folderName.textContent = "50m円（目安）";
    folder.appendChild(folderName);

    centers.forEach(point => {
      const placemark = xml.createElementNS(KML_NS, "Placemark");
      const name = xml.createElementNS(KML_NS, "name");
      name.textContent = point.name ? `${point.name}_50m円` : "";
      placemark.appendChild(name);

      const polygon = xml.createElementNS(KML_NS, "Polygon");
      const outer = xml.createElementNS(KML_NS, "outerBoundaryIs");
      const ring = xml.createElementNS(KML_NS, "LinearRing");
      const coordinates = xml.createElementNS(KML_NS, "coordinates");
      coordinates.textContent = createCircleCoordinates(point.lat, point.lng, 50);

      ring.appendChild(coordinates);
      outer.appendChild(ring);
      polygon.appendChild(outer);
      placemark.appendChild(polygon);
      folder.appendChild(placemark);
    });

    const firstReferenceFolder = Array.from(documentNode.children || []).find(node => {
      const meters = circleMetersFromFolder(node);
      return meters === 40 || meters === 30;
    }) || null;

    documentNode.insertBefore(folder, firstReferenceFolder);
    return folder;
  }

  function hasCircleFolder(xml, meters) {
    return Array.from(xml.getElementsByTagName("Folder")).some(folder =>
      circleMetersFromFolder(folder) === meters
    );
  }

  function hasExistingReferenceCircles(kmlText) {
    const xml = parseXml(kmlText);
    return hasCircleFolder(xml, 40) || hasCircleFolder(xml, 30);
  }

  function add50mOnlyToCompletedKml(kmlText) {
    const xml = parseXml(kmlText);
    const documentNode = getDocumentNode(xml);

    if (!hasCircleFolder(xml, 50)) {
      const centers = collectPointCenters(xml);
      if (centers.length === 0) {
        throw new Error("50m円を作成できるPOI座標が見つかりませんでした");
      }
      create50mFolder(xml, documentNode, centers);
    }

    // Existing 30m/40m layers and all other layers are preserved as-is.
    // Only their display order relative to the circle layers is normalized.
    reorderCircleFolders(xml);

    return new XMLSerializer().serializeToString(xml);
  }

  async function readKmlSource(file) {
    const lowerName = String(file?.name || "").toLowerCase();

    if (lowerName.endsWith(".kmz") || lowerName.endsWith(".zip")) {
      if (!window.JSZip) {
        throw new Error("JSZipが読み込まれていません");
      }

      const zip = await window.JSZip.loadAsync(file);
      const kmlName = Object.keys(zip.files).find(name =>
        name.toLowerCase().endsWith(".kml") && !zip.files[name].dir
      );

      if (!kmlName) {
        throw new Error("KMZ内にKMLが見つかりませんでした");
      }

      const kmlText = await zip.files[kmlName].async("text");
      return { type: "zip", zip, kmlName, kmlText };
    }

    if (lowerName.endsWith(".kml")) {
      return {
        type: "kml",
        zip: null,
        kmlName: "doc.kml",
        kmlText: await file.text()
      };
    }

    return null;
  }

  function completedOutputName(fileName) {
    const base = String(fileName || "completed")
      .replace(/\.kmz\.zip$/i, "")
      .replace(/\.(kmz|zip|kml)$/i, "");
    return `${base}_50m追加.kmz`;
  }

  async function downloadCompletedKmzWith50m(file, source, patchedKml) {
    let zip;

    if (source.type === "zip") {
      zip = source.zip;
      zip.file(source.kmlName, patchedKml);
    } else {
      zip = new window.JSZip();
      zip.file("doc.kml", patchedKml);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = completedOutputName(file.name);

    document.body.appendChild(a);
    a.click();
    a.remove();

    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function playSuccessSound() {
    const success = document.getElementById("successSound");
    if (!success) return;
    success.currentTime = 0;
    success.volume = 0.12;
    success.play().catch(() => {});
  }

  async function tryCompletedKmzAdd50mOnly() {
    const input = document.getElementById("circleOnlyFileInput");
    const files = Array.from(input?.files || []);

    if (files.length !== 1) return false;

    const file = files[0];
    const source = await readKmlSource(file);
    if (!source) return false;

    if (!hasExistingReferenceCircles(source.kmlText)) {
      return false;
    }

    if (typeof window.showLoading === "function") {
      window.showLoading("完成KMZに50m円を追加中…");
    }

    try {
      const patchedKml = add50mOnlyToCompletedKml(source.kmlText);
      await downloadCompletedKmzWith50m(file, source, patchedKml);

      const status = document.getElementById("circleOnlyStatus");
      if (status) {
        status.innerHTML =
          "既存レイヤー・既存円を維持しました。<br>" +
          "✔ 50m円だけを追加したKMZを生成しました";
      }

      playSuccessSound();
      return true;
    } finally {
      if (typeof window.hideLoading === "function") {
        window.hideLoading();
      }
    }
  }

  function installCircleOrderGuard() {
    const Zip = window.JSZip;
    const prototype = Zip?.prototype;
    if (!prototype || typeof prototype.generateAsync !== "function") {
      return () => {};
    }

    const originalGenerateAsync = prototype.generateAsync;

    prototype.generateAsync = async function (...args) {
      const kmlNames = Object.keys(this.files || {}).filter(name =>
        name.toLowerCase().endsWith(".kml") && !this.files[name].dir
      );

      for (const kmlName of kmlNames) {
        const entry = this.file(kmlName);
        if (!entry) continue;
        const kmlText = await entry.async("string");
        this.file(kmlName, orderKmlText(kmlText));
      }

      return originalGenerateAsync.apply(this, args);
    };

    return () => {
      if (prototype.generateAsync !== originalGenerateAsync) {
        prototype.generateAsync = originalGenerateAsync;
      }
    };
  }

  function wrapRegularGenerator(name) {
    const original = window[name];
    if (typeof original !== "function" || original[WRAPPED]) return;

    const wrapped = async function (...args) {
      const restoreOrderGuard = installCircleOrderGuard();
      try {
        return await original.apply(this, args);
      } finally {
        restoreOrderGuard();
      }
    };

    Object.defineProperty(wrapped, WRAPPED, { value: true });
    window[name] = wrapped;
  }

  function wrapCircleOnlyGenerator() {
    const original = window.generateCircleOnlyKMZ;
    if (typeof original !== "function" || original[WRAPPED]) return;

    const wrapped = async function (...args) {
      try {
        const handled = await tryCompletedKmzAdd50mOnly();
        if (handled) return;
      } catch (error) {
        console.error("完成KMZへの50m円追加に失敗しました。", error);
        if (typeof window.hideLoading === "function") {
          window.hideLoading();
        }
        alert(
          "完成KMZへの50m円追加中にエラーが発生しました。\n\n" +
          (error?.message || String(error))
        );
        return;
      }

      const restoreOrderGuard = installCircleOrderGuard();
      try {
        return await original.apply(this, args);
      } finally {
        restoreOrderGuard();
      }
    };

    Object.defineProperty(wrapped, WRAPPED, { value: true });
    window.generateCircleOnlyKMZ = wrapped;
  }

  wrapRegularGenerator("generateKMZ");
  wrapCircleOnlyGenerator();
})();
