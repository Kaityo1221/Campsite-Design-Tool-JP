/* ======================================================
   POI spacing KMZ preserve / layer order
   - Circle layer order: 50m -> 40m -> 30m
   - Completed KML/KMZ keeps existing circle layers untouched
   - 50m is always added only when missing
   - Optional 40m / 30m are added only when selected and missing
====================================================== */

(() => {
  "use strict";

  const KML_NS = "http://www.opengis.net/kml/2.2";
  const WRAPPED = "__poiSpacingPreserveWrappedV2";

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

  function circleMetersFromFolder(folder) {
    if (!folder || localName(folder) !== "folder") return null;
    const name = directChildText(folder, "name");
    if (!name.includes("円")) return null;
    const match = name.match(/(?:^|[^0-9])(50|40|30)m/i);
    return match ? Number(match[1]) : null;
  }

  function findCircleFolders(xml, meters) {
    return Array.from(xml.getElementsByTagName("Folder")).filter(folder =>
      circleMetersFromFolder(folder) === meters
    );
  }

  function hasCircleFolder(xml, meters) {
    return findCircleFolders(xml, meters).length > 0;
  }

  function hasAnyKnownCircleFolder(xml) {
    return [50, 40, 30].some(meters => hasCircleFolder(xml, meters));
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

  function addUniqueCenter(list, seen, center, name) {
    if (!center) return;
    const key = `${center.lat.toFixed(7)},${center.lng.toFixed(7)}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ ...center, name: name || "POI" });
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

      addUniqueCenter(centers, seen, parseCoordinate(firstCoordinate), name);
    });

    return centers;
  }

  function polygonCenter(placemark) {
    const polygon = Array.from(placemark.children || []).find(node =>
      localName(node) === "polygon"
    ) || placemark.getElementsByTagName("Polygon")[0];

    if (!polygon) return null;

    const coordinatesNode = polygon.getElementsByTagName("coordinates")[0];
    const coordinateText = String(coordinatesNode?.textContent || "").trim();
    if (!coordinateText) return null;

    const points = coordinateText
      .split(/\s+/)
      .map(parseCoordinate)
      .filter(Boolean);

    if (points.length < 3) return null;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    points.forEach(point => {
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

  function collectExistingCircleCenters(xml) {
    const centers = [];
    const seen = new Set();

    for (const meters of [40, 30, 50]) {
      for (const folder of findCircleFolders(xml, meters)) {
        Array.from(folder.getElementsByTagName("Placemark")).forEach(placemark => {
          const rawName = directChildText(placemark, "name") || "POI";
          const cleanName = rawName.replace(/_(50|40|30)m円.*$/i, "");
          addUniqueCenter(centers, seen, polygonCenter(placemark), cleanName);
        });
      }
      if (centers.length > 0) break;
    }

    return centers;
  }

  function getCenters(xml) {
    const pointCenters = collectPointCenters(xml);
    return pointCenters.length > 0
      ? pointCenters
      : collectExistingCircleCenters(xml);
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

  function circleFolderLabel(meters) {
    if (meters === 50) return "50m円（目安）";
    return `${meters}m円（参考距離）`;
  }

  function createCircleFolder(xml, documentNode, meters, centers) {
    const folder = xml.createElementNS(KML_NS, "Folder");
    const folderName = xml.createElementNS(KML_NS, "name");
    folderName.textContent = circleFolderLabel(meters);
    folder.appendChild(folderName);

    centers.forEach(point => {
      folder.appendChild(createCirclePlacemark(xml, point, meters));
    });

    documentNode.appendChild(folder);
    return folder;
  }

  function ensureRadius(xml, meters, centers) {
    if (hasCircleFolder(xml, meters)) {
      return "kept";
    }

    createCircleFolder(xml, getDocumentNode(xml), meters, centers);
    return "added";
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

    const remaining = Array.from(documentNode.children || []);
    const insertionRef = remaining[firstIndex] || null;

    sorted.forEach(item => {
      documentNode.insertBefore(item.node, insertionRef);
    });
  }

  function patchCompletedKml(kmlText, options) {
    const xml = parseXml(kmlText);
    const centers = getCenters(xml);

    if (centers.length === 0) {
      throw new Error("円を作成できるPOI座標が見つかりませんでした");
    }

    const result = {
      50: ensureRadius(xml, 50, centers),
      40: hasCircleFolder(xml, 40) ? "kept" : "none",
      30: hasCircleFolder(xml, 30) ? "kept" : "none"
    };

    if (options.add40 && result[40] === "none") {
      result[40] = ensureRadius(xml, 40, centers);
    }

    if (options.add30 && result[30] === "none") {
      result[30] = ensureRadius(xml, 30, centers);
    }

    reorderCircleFolders(xml);

    return {
      kmlText: new XMLSerializer().serializeToString(xml),
      result
    };
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

      return {
        type: "zip",
        zip,
        kmlName,
        kmlText: await zip.files[kmlName].async("text")
      };
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
    return `${base}_円更新.kmz`;
  }

  async function downloadPatchedKmz(file, source, patchedKml) {
    let zip;

    if (source.type === "zip") {
      // Keep every original KMZ entry. Replace only the KML text.
      zip = source.zip;
      zip.file(source.kmlName, patchedKml);
    } else {
      zip = new window.JSZip();
      zip.file("doc.kml", patchedKml);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = completedOutputName(file.name);

    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  function selectedOptionalRadii(groupName) {
    return {
      add40: Boolean(document.querySelector(`input[name="${groupName}"][value="40"]`)?.checked),
      add30: Boolean(document.querySelector(`input[name="${groupName}"][value="30"]`)?.checked)
    };
  }

  function resultText(meters, state) {
    if (state === "added") return `${meters}m円を追加`;
    if (state === "kept") return `既存${meters}m円を保持`;
    return `${meters}m円なし`;
  }

  async function tryCompletedKmz(inputId, statusId, groupName) {
    const input = document.getElementById(inputId);
    const files = Array.from(input?.files || []);

    if (files.length !== 1) return false;

    const file = files[0];
    const source = await readKmlSource(file);
    if (!source) return false;

    const sourceXml = parseXml(source.kmlText);
    if (!hasAnyKnownCircleFolder(sourceXml)) {
      return false;
    }

    if (typeof window.showLoading === "function") {
      window.showLoading("既存円を確認して差分更新中…");
    }

    try {
      const options = selectedOptionalRadii(groupName);
      const patched = patchCompletedKml(source.kmlText, options);
      await downloadPatchedKmz(file, source, patched.kmlText);

      const status = document.getElementById(statusId);
      if (status) {
        status.innerHTML =
          "既存レイヤー・既存円はそのまま維持しました。<br>" +
          `✔ ${resultText(50, patched.result[50])}<br>` +
          `✔ ${resultText(40, patched.result[40])}<br>` +
          `✔ ${resultText(30, patched.result[30])}`;
      }

      const success = document.getElementById("successSound");
      if (success) {
        success.currentTime = 0;
        success.volume = 0.12;
        success.play().catch(() => {});
      }

      return true;
    } finally {
      if (typeof window.hideLoading === "function") {
        window.hideLoading();
      }
    }
  }

  function orderGeneratedKml(kmlText) {
    const xml = parseXml(kmlText);
    reorderCircleFolders(xml);
    return new XMLSerializer().serializeToString(xml);
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
        this.file(kmlName, orderGeneratedKml(kmlText));
      }

      return originalGenerateAsync.apply(this, args);
    };

    return () => {
      if (prototype.generateAsync !== originalGenerateAsync) {
        prototype.generateAsync = originalGenerateAsync;
      }
    };
  }

  async function runRegularWithOrder(original, thisArg, args) {
    const restoreOrderGuard = installCircleOrderGuard();
    try {
      return await original.apply(thisArg, args);
    } finally {
      restoreOrderGuard();
    }
  }

  function showPatchError(error) {
    console.error("完成KMZの円差分更新に失敗しました。", error);
    if (typeof window.hideLoading === "function") {
      window.hideLoading();
    }
    alert(
      "完成KMZの円更新中にエラーが発生しました。\n\n" +
      (error?.message || String(error))
    );
  }

  function wrapGenerator(name, inputId, statusId, groupName) {
    const original = window[name];
    if (typeof original !== "function" || original[WRAPPED]) return;

    const wrapped = async function (...args) {
      try {
        const handled = await tryCompletedKmz(inputId, statusId, groupName);
        if (handled) return;
      } catch (error) {
        showPatchError(error);
        return;
      }

      return runRegularWithOrder(original, this, args);
    };

    Object.defineProperty(wrapped, WRAPPED, { value: true });
    window[name] = wrapped;
  }

  wrapGenerator("generateKMZ", "fileInput", "status", "radius");
  wrapGenerator(
    "generateCircleOnlyKMZ",
    "circleOnlyFileInput",
    "circleOnlyStatus",
    "circleOnlyRadius"
  );
})();
