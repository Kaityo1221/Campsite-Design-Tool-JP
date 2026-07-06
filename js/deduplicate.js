"use strict";

/* =========================
   Duplicate POI Organizer
   既存POIの重複整理
========================= */

/*
  CSV：
  重複削除後の既存POI分類KMZを新規生成する。

  KML / KMZ：
  元の構造を維持したまま、
  既存POIの重複Placemarkだけを削除する。
  追加POI、円、ダミーポイントには触れない。
*/

async function generateDeduplicatedPoiKMZ() {
  const input =
    document.getElementById("deduplicatePoiFile");

  const status =
    document.getElementById("deduplicatePoiStatus");

  if (!input || !status) {
    alert("重複POI整理画面が見つかりません");
    return;
  }

  const files =
    Array.from(input.files || []);

  if (files.length === 0) {
    alert("CSV / KML / KMZ ファイルを1つ以上選択してください");
    return;
  }

  showLoading("既存POIの重複を整理中…");

  try {
    let result;

    const csvFiles =
      files.filter(file =>
        String(file.name || "")
          .toLowerCase()
          .endsWith(".csv")
      );

    const kmlKmzFiles =
      files.filter(file => {
        const fileName =
          String(file.name || "").toLowerCase();

        return (
          fileName.endsWith(".kml") ||
          fileName.endsWith(".kmz") ||
          fileName.endsWith(".zip")
        );
      });

    const invalidFiles =
      files.filter(file => {
        const fileName =
          String(file.name || "").toLowerCase();

        return !(
          fileName.endsWith(".csv") ||
          fileName.endsWith(".kml") ||
          fileName.endsWith(".kmz") ||
          fileName.endsWith(".zip")
        );
      });

    if (invalidFiles.length > 0) {
      alert("CSV / KML / KMZ ファイルのみ選択してください");
      status.textContent = "";
      return;
    }

    /*
      CSV複数選択：
      一地域を複数CSVで抽出したケース。
      全CSVを結合してから重複削除し、新規KMZを生成する。
    */
    if (csvFiles.length > 0 && kmlKmzFiles.length === 0) {
      result =
        await createDeduplicatedKmzFromCsvFiles(csvFiles);

    /*
      KML / KMZ 1ファイル：
      従来どおり、元構造を維持して既存POIだけ重複削除する。
    */
    } else if (csvFiles.length === 0 && kmlKmzFiles.length === 1) {
      result =
        await createDeduplicatedKmzFromKmlOrKmz(kmlKmzFiles[0]);

    /*
      KML / KMZ 複数、または CSV と KML/KMZ 混在：
      元構造維持が難しいため、いったん非対応にする。
    */
    } else {
      alert(
        "複数ファイル選択はCSVのみ対応しています。\n\n" +
        "CSVを複数選択するか、KML / KMZ は1ファイルだけ選択してください。"
      );
      status.textContent = "";
      return;
    }

    if (result.existingBefore === 0) {
      alert("整理できる既存POIが見つかりませんでした");
      status.textContent = "";
      return;
    }

    downloadDeduplicatedPoiKmz(result.blob);

    status.innerHTML =
      `読み込みファイル：${files.length}件<br>` +
      `既存POI読み込み：${result.existingBefore}件<br>` +
      `重複削除：${result.duplicateCount}件<br>` +
      `整理後の既存POI：${result.existingAfter}件<br>` +
      `追加POI・円などの保持：${result.preservedCount}件<br>` +
      `✔ 重複整理済みKMZを生成しました`;

    playDeduplicateSuccessSound();

  } catch (error) {
    console.error("重複POI整理エラー:", error);

    alert(
      "重複POIの整理中にエラーが発生しました。\n\n" +
      "エラー内容：\n" +
      (error?.message || String(error))
    );

    status.textContent = "";

  } finally {
    hideLoading();
  }
}

/* =========================
   CSV Mode
========================= */

async function createDeduplicatedKmzFromCsv(file) {
  const text =
    await file.text();

  let points =
  parseCSV(text)
    .filter(point => {
      if (isDummyPoint(point)) return false;

      const layerName = point.layer || "";
      const name = point.name || "";
      const type = point.type || "";

      const judgeText =
        `${layerName} ${name} ${type}`;

      const lower =
        judgeText.toLowerCase();

      return !(
        judgeText.includes("追加") ||
        lower.includes("add") ||
        lower.includes("new") ||
        judgeText.includes("円") ||
        judgeText.includes("30m") ||
        judgeText.includes("40m") ||
        judgeText.includes("ダミー") ||
        judgeText.includes("レイヤー保持用") ||
        judgeText.includes("ここに追加")
      );
    });
  const existingBefore =
    points.length;

  const duplicateResult =
    removeDuplicate(points);

  points =
    duplicateResult.uniquePoints;

  const parser =
    new DOMParser();

  const outputXml =
    parser.parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <name>Campsite Deduplicated Existing POI Output</name>
        </Document>
      </kml>`,
      "application/xml"
    );

  const doc =
    outputXml.getElementsByTagName("Document")[0];

  const folders = {
    pokestop:
      createFolder(outputXml, doc, "既存のポケストップ"),

    gym:
      createFolder(outputXml, doc, "既存のジム"),

    power:
      createFolder(outputXml, doc, "既存のパワースポット")
  };

  points.forEach(point => {
    const kind =
      classifyType(
        point.type,
        point.name,
        point.layer
      );

    const placemark =
      createPointPlacemark(
        outputXml,
        point
      );

    if (kind === "gym") {
      folders.gym.appendChild(placemark);

    } else if (kind === "power") {
      folders.power.appendChild(placemark);

    } else {
      folders.pokestop.appendChild(placemark);
    }
  });

  const serializer =
    new XMLSerializer();

  const kmlText =
    serializer.serializeToString(outputXml);

  if (!isJSZipAvailable("CSV重複整理KMZ生成")) {
    throw new Error("JSZipが読み込まれていません");
  }

  const zip =
    new JSZip();

  zip.file("doc.kml", kmlText);

  const blob =
    await zip.generateAsync({
      type: "blob"
    });

  return {
    blob,
    existingBefore,
    existingAfter: points.length,
    duplicateCount:
      duplicateResult.duplicateCount,
    preservedCount: 0
  };
}
async function createDeduplicatedKmzFromCsvFiles(files) {
  let points = [];

  for (const file of files) {
    const text =
      await file.text();

    const parsedPoints =
      parseCSV(text)
        .filter(point => {
          if (isDummyPoint(point)) return false;

          const layerName = point.layer || "";
          const name = point.name || "";
          const type = point.type || "";

          const judgeText =
            `${layerName} ${name} ${type}`;

          const lower =
            judgeText.toLowerCase();

          return !(
            judgeText.includes("追加") ||
            lower.includes("add") ||
            lower.includes("new") ||
            judgeText.includes("円") ||
            judgeText.includes("30m") ||
            judgeText.includes("40m") ||
            judgeText.includes("ダミー") ||
            judgeText.includes("レイヤー保持用") ||
            judgeText.includes("ここに追加")
          );
        });

    points.push(...parsedPoints);
  }

  const existingBefore =
    points.length;

  const duplicateResult =
    removeDuplicate(points);

  points =
    duplicateResult.uniquePoints;

  const parser =
    new DOMParser();

  const outputXml =
    parser.parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <name>Campsite Deduplicated Existing POI Output</name>
        </Document>
      </kml>`,
      "application/xml"
    );

  const doc =
    outputXml.getElementsByTagName("Document")[0];

  const folders = {
    pokestop:
      createFolder(outputXml, doc, "既存のポケストップ"),

    gym:
      createFolder(outputXml, doc, "既存のジム"),

    power:
      createFolder(outputXml, doc, "既存のパワースポット")
  };

  points.forEach(point => {
    const kind =
      classifyType(
        point.type,
        point.name,
        point.layer
      );

    const placemark =
      createPointPlacemark(
        outputXml,
        point
      );

    if (kind === "gym") {
      folders.gym.appendChild(placemark);

    } else if (kind === "power") {
      folders.power.appendChild(placemark);

    } else {
      folders.pokestop.appendChild(placemark);
    }
  });

  const serializer =
    new XMLSerializer();

  const kmlText =
    serializer.serializeToString(outputXml);

  if (!isJSZipAvailable("CSV重複整理KMZ生成")) {
    throw new Error("JSZipが読み込まれていません");
  }

  const zip =
    new JSZip();

  zip.file("doc.kml", kmlText);

  const blob =
    await zip.generateAsync({
      type: "blob"
    });

  return {
    blob,
    existingBefore,
    existingAfter: points.length,
    duplicateCount:
      duplicateResult.duplicateCount,
    preservedCount: 0
  };
}
/* =========================
   KML / KMZ Mode
========================= */

async function createDeduplicatedKmzFromKmlOrKmz(file) {
  const fileName =
    String(file.name || "").toLowerCase();

  let zip = null;
  let kmlFileName = "doc.kml";
  let kmlText = "";

  if (
    fileName.endsWith(".kmz") ||
    fileName.endsWith(".zip")
  ) {
    if (!isJSZipAvailable("KML / KMZ重複整理")) {
      throw new Error("JSZipが読み込まれていません");
    }

    zip =
      await JSZip.loadAsync(file);

    kmlFileName =
      Object.keys(zip.files).find(name =>
        name.toLowerCase().endsWith(".kml")
      );

    if (!kmlFileName) {
      throw new Error(
        "KMZ内にKMLファイルが見つかりません"
      );
    }

    kmlText =
      await zip.files[kmlFileName].async("text");

  } else {
    kmlText =
      await file.text();
  }

  const parser =
    new DOMParser();

  const xml =
    parser.parseFromString(
      kmlText,
      "application/xml"
    );

  const parseError =
    xml.getElementsByTagName("parsererror")[0];

  if (parseError) {
    throw new Error(
      "KMLファイルを正しく読み込めませんでした"
    );
  }

  const placemarks =
    Array.from(
      xml.getElementsByTagName("Placemark")
    );

  const seen =
    new Set();

  let existingBefore = 0;
  let duplicateCount = 0;
  let preservedCount = 0;

  placemarks.forEach(placemark => {
    if (!isDeduplicateTargetExistingPoi(placemark)) {
      preservedCount++;
      return;
    }

    existingBefore++;

    const key =
      createExistingPoiDuplicateKey(placemark);

    /*
      座標を取得できないPlacemarkは、
      誤削除を避けるためそのまま保持する。
    */
    if (!key) {
      return;
    }

    if (seen.has(key)) {
      placemark.remove();
      duplicateCount++;
      return;
    }

    seen.add(key);
  });

  const serializer =
    new XMLSerializer();

  const newKmlText =
    serializer.serializeToString(xml);

  if (!zip) {
    if (!isJSZipAvailable("KML重複整理KMZ生成")) {
      throw new Error("JSZipが読み込まれていません");
    }

    zip =
      new JSZip();

    kmlFileName =
      "doc.kml";
  }

  /*
    KMZの場合は元ZIPを利用する。
    画像などの付属ファイルがあっても保持される。
  */
  zip.file(
    kmlFileName,
    newKmlText
  );

  const blob =
    await zip.generateAsync({
      type: "blob"
    });

  return {
    blob,
    existingBefore,
    existingAfter:
      existingBefore - duplicateCount,
    duplicateCount,
    preservedCount
  };
}

/* =========================
   KML Placemark Judge
========================= */

function isDeduplicateTargetExistingPoi(placemark) {
  const point =
    placemark.getElementsByTagName("Point")[0];

  /*
    円はPolygonなので対象外。
    Pointを持つPlacemarkだけを見る。
  */
  if (!point) {
    return false;
  }

  const name =
    placemark
      .getElementsByTagName("name")[0]
      ?.textContent
      ?.trim() || "";

  const description =
    placemark
      .getElementsByTagName("description")[0]
      ?.textContent
      ?.trim() || "";

  const layer =
    getDeduplicateParentFolderName(
      placemark
    );

  const text =
    `${name} ${description} ${layer}`;

  /*
    追加POI、円、ダミーは対象外。
  */
const lower = text.toLowerCase();

if (
  text.includes("追加") ||
  lower.includes("add") ||
  lower.includes("new") ||
  text.includes("30m") ||
  text.includes("40m") ||
  text.includes("円") ||
  text.includes("ダミー") ||
  text.includes("レイヤー保持用") ||
  text.includes("ここに追加")
) {
  return false;
}
  return true;
}

function createExistingPoiDuplicateKey(placemark) {
  const point =
    placemark.getElementsByTagName("Point")[0];

  const coordinatesText =
    point
      ?.getElementsByTagName("coordinates")[0]
      ?.textContent
      ?.trim();

  if (!coordinatesText) {
    return "";
  }

  const firstCoordinate =
    coordinatesText
      .split(/\s+/)[0];

  const parts =
    firstCoordinate
      .split(",");

  const lng =
    Number(parts[0]);

  const lat =
    Number(parts[1]);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return "";
  }

  /*
    小数点以下7桁で比較。
    約1cm単位の差まで区別する。
  */
  return (
    `coord:` +
    `${lat.toFixed(7)},` +
    `${lng.toFixed(7)}`
  );
}

function getDeduplicateParentFolderName(element) {
  let current =
    element.parentElement;

  while (current) {
    if (
      current.localName === "Folder" ||
      current.tagName === "Folder"
    ) {
      const folderName =
        Array.from(current.children)
          .find(child =>
            child.localName === "name" ||
            child.tagName === "name"
          )
          ?.textContent
          ?.trim();

      return folderName || "";
    }

    current =
      current.parentElement;
  }

  return "";
}

/* =========================
   Download / Sound
========================= */

function downloadDeduplicatedPoiKmz(blob) {
  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  const now =
    new Date();

  a.href =
    url;

  a.download =
    `campsite_deduplicated_` +
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, "0")}` +
    `${String(now.getDate()).padStart(2, "0")}` +
    `.kmz`;

  a.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function playDeduplicateSuccessSound() {
  const success =
    document.getElementById("successSound");

  if (!success) {
    return;
  }

  success.currentTime =
    0;

  success.volume =
    0.12;

  setTimeout(() => {
    success
      .play()
      .catch(() => {});
  }, 100);
}
window.generateDeduplicatedPoiKMZ =
  generateDeduplicatedPoiKMZ;