/* ======================================================
   POI spacing KMZ differential updater
   - 50m is always part of the desired output
   - 40m / 30m are optional additions
   - Existing 50m / 40m / 30m circle layers are never regenerated
   - Only missing requested radii are generated
   - Existing non-circle layers and KMZ assets are preserved
   - Circle layer order is normalized to 50m -> 40m -> 30m
====================================================== */

(() => {
  "use strict";

  const KML_NS = "http://www.opengis.net/kml/2.2";
  const WRAPPED = "__poiSpacingDiffWrapped";

  function nodeName(node) {
    return String(node?.localName || node?.tagName || "").toLowerCase();
  }

  function directChildText(element, tagName) {
    if (!element) return "";
    const target = String(tagName || "").toLowerCase();
    const child = Array.from(element.children || []).find(node =>
      nodeName(node) === target
    );
    return child?.textContent?.trim() || "";
  }

  function parseXml(text) {
    const xml = new DOMParser().parseFromString(text, "application/xml");
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
    if (!folder || nodeName(folder) !== "folder") return null;
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

  function countPolygons(folder) {
    return folder
      ? Array.from(folder.getElementsByTagName("Placemark")).filter(placemark =>
          Boolean(placemark.getElementsByTagName("Polygon")[0])
        ).length
      : 0;
  }

  function hasUsableCircle(xml, meters) {
    return findCircleFolders(xml, meters).some(folder => countPolygons(folder) > 0);
  }

  function hasAnyKnownCircle(xml) {
    return [50, 40, 30].some(meters => findCircleFolders(xml, meters).length > 0);
  }

  function getParentFolderName(element) {
    let current = element?.parentElement || null;
    while (current) {
      if (nodeName(current) === "folder") {
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

  function addUniqueCenter(centers, seen, center, name) {
    if (!center) return;
    const key = `${center.lat.toFixed(7)},${center.lng.toFixed(7)}`;
    if (seen.has(key)) return;
    seen.add(key);
    centers.push({ ...center, name: name || "POI" });
  }

  function collectPointCenters(xml) {
    const centers = [];
    const seen = new Set();

    Array.from(xml.getElementsByTagName("Placemark")).forEach(placemark => {
      const pointNode = Array.from(placemark.children || []).find(node =>
        nodeName(node) === "point"
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
        nodeName(node) === "coordinates"
      );
      const first = String(coordinatesNode?.textContent || "")
        .trim()
        .split(/\s+/)[0];

      addUniqueCenter(centers, seen, parseCoordinate(first), name);
    });

    return centers;
  }

  function polygonCenter(placemark) {
    const polygon = placemark.getElementsByTagName("Polygon")[0];
    const text = polygon?.getElementsByTagName("coordinates")[0]?.textContent?.trim();
    if (!text) return null;

    const points = text
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

    for (const meters of [50, 40, 30]) {
      const folders = findCircleFolders(xml, meters);
      for (const folder of folders) {
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

  function createCirclePlacemark(xml, point, meters) {
    const placemark = xml.createElementNS(KML_NS, "Placemark");
    const name = xml.createElementNS(KML_NS, "name");
    name.textContent = point.name ? `${point.name}_${meters}m円` : "";
    placemark.appendChild(name);

    const polygon = xml.createElementNS(KML_NS, "Polygon");
    const outer = xml.createElementNS(KML_NS, "outerBoundaryIs");
    const ring = xml.createElementNS(KML_NS, "LinearRing");
    const coordinates = xml.createElementNS(KML_NS, "coordinates");
    coordinates.textContent = createCircleCoordinates(point.lat, point.lng, meters);

    ring.appendChild(coordinates);
    outer.appendChild(ring);
    polygon.appendChild(outer);
    placemark.appendChild(polygon);
    return placemark;
  }

  function labelForRadius(meters) {
    return meters === 50
      ? "50m円（目安）"
      : `${meters}m円（参考距離）`;
  }

  function ensureRadius(xml, meters, centers) {
    const existingFolders = findCircleFolders(xml, meters);
    const usable = existingFolders.find(folder => countPolygons(folder) > 0);

    if (usable) {
      return "kept";
    }

    let folder = existingFolders[0] || null;
    if (!folder) {
      folder = xml.createElementNS(KML_NS, "Folder");
      const name = xml.createElementNS(KML_NS, "name");
      name.textContent = labelForRadius(meters);
      folder.appendChild(name);
      getDocumentNode(xml).appendChild(folder);
    }

    centers.forEach(point => {
      folder.appendChild(createCirclePlacemark(xml, point, meters));
    });

    return "added";
  }

  function reorderCircleFolders(xml) {
    const documentNode = getDocumentNode(xml);
    const children = Array.from(documentNode.children || []);
    const circles = children
      .map((node, index) => ({ node, index, meters: circleMetersFromFolder(node) }))
      .filter(item => item.meters !== null);

    if (circles.length <= 1) return;

    const firstIndex = Math.min(...circles.map(item => item.index));
    const sorted = circles.slice().sort((a, b) => {
      if (a.meters !== b.meters) return b.meters - a.meters;
      return a.index - b.index;
    });

    circles.forEach(item => item.node.remove());
    const remaining = Array.from(documentNode.children || []);
    const reference = remaining[firstIndex] || null;
    sorted.forEach(item => documentNode.insertBefore(item.node, reference));
  }

  function desiredRadii(groupName) {
    const desired = [50];
    if (document.querySelector(`input[name="${groupName}"][value="40"]`)?.checked) {
      desired.push(40);
    }
    if (document.querySelector(`input[name="${groupName}"][value="30"]`)?.checked) {
      desired.push(30);
    }
    return desired;
  }

  function patchKmlByDifference(kmlText, groupName) {
    const xml = parseXml(kmlText);
    const centers = getCenters(xml);
    if (centers.length === 0) {
      throw new Error("円を作成できるPOI座標が見つかりませんでした");
    }

    const result = {};
    const requested = new Set(desiredRadii(groupName));

    for (const meters of [50, 40, 30]) {
      if (requested.has(meters)) {
        result[meters] = ensureRadius(xml, meters, centers);
      } else if (hasUsableCircle(xml, meters)) {
        result[meters] = "kept";
      } else {
        result[meters] = "none";
      }
    }

    reorderCircleFolders(xml);

    return {
      text: new XMLSerializer().serializeToString(xml),
      result
    };
  }

  async function readSource(file) {
    const name = String(file?.name || "").toLowerCase();

    if (name.endsWith(".kmz") || name.endsWith(".zip")) {
      if (!window.JSZip) throw new Error("JSZipが読み込まれていません");
      const zip = await window.JSZip.loadAsync(file);
      const kmlName = Object.keys(zip.files).find(path =>
        path.toLowerCase().endsWith(".kml") && !zip.files[path].dir
      );
      if (!kmlName) throw new Error("KMZ内にKMLが見つかりませんでした");
      return {
        type: "zip",
        zip,
        kmlName,
        text: await zip.files[kmlName].async("text")
      };
    }

    if (name.endsWith(".kml")) {
      return {
        type: "kml",
        zip: null,
        kmlName: "doc.kml",
        text: await file.text()
      };
    }

    return null;
  }

  function outputName(fileName) {
    const base = String(fileName || "campsite")
      .replace(/\.kmz\.zip$/i, "")
      .replace(/\.(kmz|zip|kml)$/i, "");
    return `${base}_円差分更新.kmz`;
  }

  async function savePatched(file, source, patchedText) {
    let zip;
    if (source.type === "zip") {
      zip = source.zip;
      zip.file(source.kmlName, patchedText);
    } else {
      zip = new window.JSZip();
      zip.file("doc.kml", patchedText);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = outputName(file.name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function statusText(meters, state) {
    if (state === "added") return `${meters}m円：不足分を追加`;
    if (state === "kept") return `${meters}m円：既存を保持`;
    return `${meters}m円：変更なし`;
  }

  async function tryDiffUpdate(inputId, statusId, groupName) {
    const files = Array.from(document.getElementById(inputId)?.files || []);
    if (files.length !== 1) return false;

    const file = files[0];
    const source = await readSource(file);
    if (!source) return false;

    const xml = parseXml(source.text);
    if (!hasAnyKnownCircle(xml)) return false;

    if (typeof window.showLoading === "function") {
      window.showLoading("既存円を確認して差分だけ生成中…");
    }

    try {
      const patched = patchKmlByDifference(source.text, groupName);
      await savePatched(file, source, patched.text);

      const status = document.getElementById(statusId);
      if (status) {
        status.innerHTML =
          "既存レイヤー・既存円は変更していません。<br>" +
          `✔ ${statusText(50, patched.result[50])}<br>` +
          `✔ ${statusText(40, patched.result[40])}<br>` +
          `✔ ${statusText(30, patched.result[30])}`;
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

  function wrap(name, inputId, statusId, groupName) {
    const original = window[name];
    if (typeof original !== "function" || original[WRAPPED]) return;

    const wrapped = async function (...args) {
      try {
        if (await tryDiffUpdate(inputId, statusId, groupName)) return;
      } catch (error) {
        console.error("円の差分更新に失敗しました。", error);
        if (typeof window.hideLoading === "function") window.hideLoading();
        alert(
          "円の差分更新中にエラーが発生しました。\n\n" +
          (error?.message || String(error))
        );
        return;
      }

      return original.apply(this, args);
    };

    Object.defineProperty(wrapped, WRAPPED, { value: true });
    window[name] = wrapped;
  }

  wrap("generateKMZ", "fileInput", "status", "radius");
  wrap("generateCircleOnlyKMZ", "circleOnlyFileInput", "circleOnlyStatus", "circleOnlyRadius");
})();
