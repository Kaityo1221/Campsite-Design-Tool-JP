function renderDistanceLoadErrorHtml(title, message = "") {
  return `
    <div class="distance-warning" style="
      margin-top:12px;
      padding:14px;
      border:1px solid rgba(239,68,68,0.65);
      border-radius:12px;
      background:rgba(239,68,68,0.14);
      color:#fecaca;
      line-height:1.7;
    ">
      <strong style="color:#f87171;">
        ⚠ ${escapeDistanceHtml(title)}
      </strong>

      ${message ? `
        <div style="
          margin-top:8px;
          color:#e5e7eb;
          font-size:13px;
        ">
          ${message}
        </div>
      ` : ""}
    </div>
  `;
}
  async function loadDistanceFile() {
  const fileInput = document.getElementById("distanceFile");
  const container = document.getElementById("distanceLayerList");
  const summary = document.getElementById("distancePoiSummary");
  const distanceResult = document.getElementById("distanceResult");

  if (!fileInput.files.length) {
    return;
  }

  const file = fileInput.files[0];

// 距離チェック実行後の自動送信用に元ファイルを保持
window._distanceSourceFile = file;

const fileName = file.name.toLowerCase();
  window._layerPoints = {};
  window._hasPolygon = false;
  window._activityPolygons = [];

  if (container) {
    container.innerHTML = "";
  }

  if (summary) {
    summary.innerHTML = "";
  }

  if (distanceResult) {
    distanceResult.innerHTML = "";
  }

const isKml = fileName.endsWith(".kml");
const isKmz = fileName.endsWith(".kmz");
const isZip = fileName.endsWith(".zip");
const isIphoneKmzZip =
  fileName.endsWith(".kmz.zip");
  
  if (isIphoneKmzZip) {
    if (summary) {
      summary.innerHTML = renderDistanceLoadErrorHtml(
        "末尾の .zip を削除してください",
        `
          iPhoneでは、KMZファイルが <strong>.kmz.zip</strong> として保存される場合があります。<br>
          「ファイル」アプリで対象ファイルを長押しし、<br>
          「名称変更」から末尾の <strong>.zip</strong> だけを削除してください。<br><br>

          例：<strong>campsite_2026612.kmz.zip</strong><br>
          ↓<br>
          <strong>campsite_2026612.kmz</strong>
        `
      );
    }

    return;
  }

  if (!isKml && !isKmz && !isZip) {
  if (summary) {
    summary.innerHTML = `
      <div class="distance-warning">
        ${createKmlKmzErrorMessage(
          "unsupported_extension",
          file.name || ""
        )}
      </div>
    `;
  }

  return;
}

  window._inputType = "kmz";

  if (summary) {
    summary.innerHTML = `
      <div class="distance-warning">
        KMZ/KMLを読み込み中です...<br>
        <small>${escapeDistanceHtml(file.name || "")}</small>
      </div>
    `;
  }
  try {
    const result =
      await extractLayersFromKML(file);

        // CAMP-009: KML/KMZの異常系を原因別に表示
    if (result.errorCode) {
      if (summary) {
        summary.innerHTML = `
          <div class="distance-warning">
            ${createKmlKmzErrorMessage(
              result.errorCode,
              result.errorDetail || ""
            )}
          </div>
        `;
      }

      return;
    }

    const layerNames =
      Object.keys(result.pointsByLayer || {});

    if (layerNames.length === 0) {
      if (summary) {
        summary.innerHTML = `
          <div class="distance-warning">
            ${createKmlKmzErrorMessage(
              "no_poi",
              "POIレイヤーが0件です"
            )}
          </div>
        `;
      }

      return;
    }

    window._layerPoints =
  result.pointsByLayer;

window._activityPolygons =
  result.polygons || [];

window._hasPolygon =
  window._activityPolygons.length > 0;

    const debugInfo =
      getTargetLayerDebugInfo();

    if (
      debugInfo.targetLayerCount === 0 ||
      debugInfo.targetPointCount === 0
    ) {
      if (summary) {
        summary.innerHTML = renderDistanceLoadErrorHtml(
          "判定対象となるPOIが見つかりません",
          `
            「既存」「追加」「追加希望」などのPOIレイヤーが含まれているか確認してください。<br>
            円・Buffers・活動範囲ポリゴンなどの補助レイヤーだけでは距離判定できません。
          `
        );
      }

      return;
    }

    if (container) {
      renderLayerSelector(
        result.layers,
        container
      );
    }

    if (summary) {
      const counts =
        countPoiTypesFromLayers(
          window._layerPoints
        );

      summary.innerHTML =
  renderDistancePrecheckCompactHtml(counts);
    }

    } catch (error) {
    console.error(
      "距離チェック用ファイルの読込に失敗しました",
      error
    );

    if (summary) {
      summary.innerHTML = `
        <div class="distance-warning">
          ${createKmlKmzErrorMessage(
            "parse_failed",
            error?.message || String(error)
          )}
        </div>
      `;
    }
  }
}
function extractPolygonsFromXml(xml) {
  const polygons = [];

  const polygonNodes =
    Array.from(
      xml.getElementsByTagName("Polygon")
    );

  polygonNodes.forEach(polygonNode => {
    let parent =
      polygonNode.parentElement;

    let folderName = "";

    while (parent) {
      if (
        parent.localName === "Folder" ||
        parent.tagName === "Folder"
      ) {
        const folderNameNode =
          Array.from(parent.children)
            .find(child => {
              return (
                child.localName === "name" ||
                child.tagName === "name"
              );
            });

        folderName =
          folderNameNode?.textContent || "";

        break;
      }

      parent =
        parent.parentElement;
    }

    /*
      30m円・40m円・Buffersなどは、
      活動範囲ポリゴンとして表示しない。
    */
    if (
      folderName &&
      isAuxiliaryLayer(folderName)
    ) {
      return;
    }

    const coordinatesNode =
      polygonNode
        .getElementsByTagName("coordinates")[0];

    if (!coordinatesNode) {
      return;
    }

    const latLngs =
      coordinatesNode
        .textContent
        .trim()
        .split(/\s+/)
        .map(coordText => {
          const [
            lng,
            lat
          ] =
            coordText
              .split(",")
              .map(Number);

          if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lng)
          ) {
            return null;
          }

          return [
            lat,
            lng
          ];
        })
        .filter(Boolean);

    if (latLngs.length < 3) {
      return;
    }

    polygons.push(
      latLngs
    );
  });

  return polygons;
}
async function extractLayersFromKML(file) {
  let kmlText = null;

  if (!file) {
    return {
      layers: [],
      pointsByLayer: {},
      polygons: [],
      errorCode: "no_file",
      errorDetail: ""
    };
  }

  const fileName = String(file.name || "").toLowerCase();

  // CAMP-009: 拡張子チェック
  if (!fileName.endsWith(".kml") && !fileName.endsWith(".kmz") && !fileName.endsWith(".zip")) {
    return {
      layers: [],
      pointsByLayer: {},
      polygons: [],
      errorCode: "unsupported_extension",
      errorDetail: file.name || ""
    };
  }

  // CAMP-009:
  // zipも技術的には読めるが、ユーザーにはKMZ推奨として扱う。
  // ただし中にKMLがあれば処理は続行する。
  const isZipFile = fileName.endsWith(".zip");

  try {
    if (fileName.endsWith(".kml")) {
      kmlText = await file.text();
    } else if (fileName.endsWith(".kmz") || isZipFile) {
      if (!isJSZipAvailable("距離チェック用KMZ読み込み")) {
        return {
          layers: [],
          pointsByLayer: {},
          polygons: [],
          errorCode: "jszip_unavailable",
          errorDetail: ""
        };
      }

      const zip = await JSZip.loadAsync(file);

      for (const name in zip.files) {
        if (name.toLowerCase().endsWith(".kml")) {
          kmlText = await zip.files[name].async("text");
          break;
        }

        if (name.toLowerCase().endsWith(".kmz")) {
          const kmzBlob = await zip.files[name].async("blob");
          const kmzZip = await JSZip.loadAsync(kmzBlob);

          for (const innerName in kmzZip.files) {
            if (innerName.toLowerCase().endsWith(".kml")) {
              kmlText = await kmzZip.files[innerName].async("text");
              break;
            }
          }
        }

        if (kmlText) {
          break;
        }
      }
    }
  } catch (error) {
    return {
      layers: [],
      pointsByLayer: {},
      polygons: [],
      errorCode: "parse_failed",
      errorDetail: error?.message || String(error)
    };
  }

  if (!kmlText) {
    return {
      layers: [],
      pointsByLayer: {},
      polygons: [],
      errorCode: isZipFile ? "zip_instead_of_kmz" : "kmz_without_kml",
      errorDetail: file.name || ""
    };
  }

  if (!String(kmlText).trim()) {
    return {
      layers: [],
      pointsByLayer: {},
      polygons: [],
      errorCode: "empty_kml",
      errorDetail: file.name || ""
    };
  }

  const xml =
    new DOMParser()
      .parseFromString(
        kmlText,
        "application/xml"
      );

  // CAMP-009: XMLとして壊れている場合
  const parserError =
    xml.getElementsByTagName("parsererror")[0];

  if (parserError) {
    return {
      layers: [],
      pointsByLayer: {},
      polygons: [],
      errorCode: "parse_failed",
      errorDetail: parserError.textContent || "XML parse error"
    };
  }

  // CAMP-009: KML内にPlacemarkがない場合
  const placemarks =
    Array.from(
      xml.getElementsByTagName("Placemark")
    );

  if (placemarks.length === 0) {
    return {
      layers: [],
      pointsByLayer: {},
      polygons: [],
      errorCode: "no_placemark",
      errorDetail: ""
    };
  }

  const polygons =
    extractPolygonsFromXml(
      xml
    );

  window._hasPolygon =
    polygons.length > 0;

  const pointsByLayer =
    extractPointsByLayer(
      xml
    );

  const layers =
    Object.keys(
      pointsByLayer
    );

  // CAMP-009: Placemarkはあるが、POIとして読める地点がない場合
  const totalPointCount =
    Object.values(pointsByLayer)
      .reduce((sum, points) => sum + points.length, 0);

  if (totalPointCount === 0) {
    return {
      layers,
      pointsByLayer,
      polygons,
      errorCode: "no_poi",
      errorDetail: `Placemark: ${placemarks.length}件 / Polygon: ${polygons.length}件`
    };
  }

  return {
    layers,
    pointsByLayer,
    polygons,
    errorCode: ""
  };
}
function getDistanceExtendedDataValue(pm, keyName) {
  const dataNodes = Array.from(pm.getElementsByTagName("Data"));

  for (const dataNode of dataNodes) {
    const nameAttr = dataNode.getAttribute("name");

    if (nameAttr === keyName) {
      return dataNode.getElementsByTagName("value")[0]?.textContent || "";
    }
  }

  return "";
}

function getPlacemarkPoiName(pm) {
  const extendedName =
    getDistanceExtendedDataValue(pm, "名前") ||
    getDistanceExtendedDataValue(pm, "name") ||
    getDistanceExtendedDataValue(pm, "title");

  if (extendedName.trim()) {
    return extendedName.trim();
  }

  const placemarkName =
    pm.getElementsByTagName("name")[0]?.textContent || "";

  if (
    placemarkName.trim() &&
    placemarkName.trim() !== "無題"
  ) {
    return placemarkName.trim();
  }

  return "無題";
}
function isLayerRetentionDummyPlacemark(pm) {
  const point =
    pm.getElementsByTagName("Point")[0];

  const coord =
    point?.getElementsByTagName("coordinates")[0]?.textContent;

  if (!coord) {
    return false;
  }

  const [lng, lat] =
    coord.trim().split(",").map(Number);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat === 35 &&
    lng === 139
  );
}

function extractPointsByLayer(xml) {
  const result = {};

  const folders = Array.from(xml.getElementsByTagName("Folder"));

  folders.forEach(folder => {
    const layerName =
      folder.getElementsByTagName("name")[0]?.textContent || "無名レイヤー";

    const placemarks = Array.from(folder.getElementsByTagName("Placemark"));

    result[layerName] = placemarks.map(pm => {
      if (isLayerRetentionDummyPlacemark(pm)) {
        return null;
      }

      const point = pm.getElementsByTagName("Point")[0];
      if (!point) return null;

      const coord = point.getElementsByTagName("coordinates")[0]?.textContent;
      if (!coord) return null;

      const [lng, lat] = coord.trim().split(",").map(Number);
      if (isNaN(lat) || isNaN(lng)) return null;

      return {
  lat,
  lng,
  name: getPlacemarkPoiName(pm),
  layer: layerName
};
    }).filter(Boolean);
  });

  return result;
}

function renderLayerSelector(layers, container) {
  container.innerHTML = "";

  const targetLayers = layers.filter(name => {
    const points = window._layerPoints[name] || [];

    if (!points.length) {
      return false;
    }

    return isDistanceTargetLayer(name);
  });

  const polygonCount =
    window._activityPolygons?.length || 0;

  if (targetLayers.length === 0 && polygonCount === 0) {
    container.innerHTML = "判定できるPOIレイヤーがありません。";
    return;
  }

  container.innerHTML = `
    ${targetLayers.map(name => `
      <div class="layer-row">
        <strong>${escapeDistanceHtml(cleanLayerName(name))}</strong>
        <span class="note">（${window._layerPoints[name]?.length || 0}件）</span>
      </div>
    `).join("")}

    <div class="layer-row">
      <strong>活動範囲ポリゴン</strong>
      <span class="note">（${polygonCount}件）</span>
    </div>
  `;
}

function getTargetLayerDebugInfo() {
  const layerPoints = window._layerPoints || {};
  const allLayerNames = Object.keys(layerPoints);

  const targetLayerNames = allLayerNames.filter(layerName => {
    if (layerName === "CSV_POI") return true;

    return isDistanceTargetLayer(layerName);
  });

  let allPointCount = 0;
  let targetPointCount = 0;

  allLayerNames.forEach(layerName => {
    allPointCount += layerPoints[layerName]?.length || 0;
  });

  targetLayerNames.forEach(layerName => {
    targetPointCount += layerPoints[layerName]?.length || 0;
  });

  return {
    allLayerCount: allLayerNames.length,
    targetLayerCount: targetLayerNames.length,
    allPointCount,
    targetPointCount,
    targetLayerNames
  };
}
function renderDistanceUploadSummary() {
  const info = getTargetLayerDebugInfo();

  return `
    <div class="distance-warning" style="
      margin-top:12px;
      border:1px solid rgba(56,189,248,0.45);
      background:rgba(14,165,233,0.10);
    ">
      <strong>読み込み内容の確認</strong><br><br>
      全レイヤー数：${info.allLayerCount}件<br>
      判定対象レイヤー数：${info.targetLayerCount}件<br>
      全POI数：${info.allPointCount}件<br>
      判定対象POI数：${info.targetPointCount}件<br>
活動範囲ポリゴン：${window._hasPolygon ? `あり（${window._activityPolygons?.length || 0}件）` : "なし"}<br>

${window._hasPolygon ? "" : `
  <div style="
    margin-top:10px;
    padding:10px 12px;
    border-radius:10px;
    background:rgba(245,158,11,0.14);
    border:1px solid rgba(245,158,11,0.35);
    color:#fde68a;
    line-height:1.7;
  ">
    ⚠ 活動範囲ポリゴンが見つかりません。<br>
    Google My Mapsで、実際に歩く範囲や活動エリアをポリゴンで囲んだレイヤーを作成してください。
  </div>
`}
<br>
<strong>判定対象レイヤー</strong><br>
${info.targetLayerNames.map(name => escapeDistanceHtml(name)).join("<br>") || "なし"}
    </div>
  `;
}
