window._densityAreas = [];
function escapeAdminHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getAdminLayerInfo(layerName) {
  const name = layerName || "";
  const lower = name.toLowerCase();

  const isCircle =
    name.includes("円") ||
    name.includes("30m") ||
    name.includes("40m");

  const isAdd =
    name.includes("追加希望") ||
    name.includes("追加") ||
    name.includes("新規") ||
    name.includes("CA Pokestop") ||
    name.includes("CA Pokéstop") ||
    lower.includes("add");

  const isPokestop =
    name.includes("ポケスト") ||
    name.includes("ポケストップ") ||
    lower.includes("pokestop") ||
    lower.includes("poke stop");

  const isGym =
    name.includes("ジム") ||
    lower.includes("gym");

  const isPower =
    name.includes("パワ") ||
    name.includes("パワースポット") ||
    name.includes("パワスポ") ||
    lower.includes("power");

  const isExisting =
    !isCircle &&
    !isAdd &&
    (
      name.includes("既存") ||
      isPokestop ||
      isGym ||
      isPower
    );

  return {
    isCircle,
    isAdd,
    isExisting,
    isPokestop,
    isGym,
    isPower
  };
}

async function runAdminFileCheck() {
  const input = document.getElementById("adminCheckFile");
  const result = document.getElementById("adminCheckResult");

  if (!input || !input.files.length) {
    alert("KML / KMZ ファイルを選択してください");
    return;
  }

  const file = input.files[0];
  const fileName = file.name.toLowerCase();

  result.innerHTML = `
    <div class="distance-warning" style="
      background:rgba(59,130,246,0.12);
      border:1px solid rgba(96,165,250,0.35);
    ">
      <span class="loading">
        <span class="spinner"></span>
        内容チェック中…
      </span>
    </div>
  `;

  try {
    let layers = [];
    let pointsByLayer = {};

    if (fileName.endsWith(".csv")) {
      const text = await file.text();
      const points = parseCSV(text);
      layers = ["CSV_POI"];
      pointsByLayer["CSV_POI"] = points.map(p => ({
        ...p,
        layer: "CSV_POI"
      }));
    } else if (
      fileName.endsWith(".kml") ||
      fileName.endsWith(".kmz") ||
      fileName.endsWith(".zip")
    ) {
      const extracted = await extractLayersFromKML(file);
      layers = extracted.layers;
      pointsByLayer = extracted.pointsByLayer;
    } else {
      result.innerHTML = `
        <div class="distance-warning">
          対応していないファイル形式です。KML / KMZ を選択してください。
        </div>
      `;
      return;
    }

    const allPoints = [];
    let dummyCount = 0;

    const layerSummary = layers.map(layerName => {
      const points = pointsByLayer[layerName] || [];
      const info = getAdminLayerInfo(layerName);

      points.forEach(p => {
        const point = {
          ...p,
          layer: layerName
        };

        if (isDummyPoint(point)) {
          dummyCount++;
        }

        allPoints.push(point);
      });

      return {
        name: layerName,
        count: points.length,
        ...info
      };
    });

    const circleLayers = layerSummary.filter(l => l.isCircle);
    const addLayers = layerSummary.filter(l => l.isAdd);
    const existingLayers = layerSummary.filter(l => l.isExisting);

    const usablePoints = allPoints.filter(p => !isDummyPoint(p));

const existingPoints = usablePoints.filter(p => {
  const info = getAdminLayerInfo(p.layer);
  return info.isExisting;
});

const counts = {
  pokestop: 0,
  gym: 0,
  power: 0
};

existingPoints.forEach(p => {
  const kind = classifyType(p.type, p.name, p.layer);

  if (kind === "gym") {
    counts.gym++;
  } else if (kind === "power") {
    counts.power++;
  } else {
    counts.pokestop++;
  }
});

    const layerListHtml = layerSummary.length === 0 ? `
      <div style="opacity:0.75;">レイヤー情報が見つかりませんでした。</div>
    ` : layerSummary.map(layer => {
      let badge = "通常";

      if (layer.isCircle) badge = "円";
      else if (layer.isAdd) badge = "追加希望";
      else if (layer.isExisting) badge = "既存POI";

      return `
        <div style="
          margin:8px 0;
          padding:10px;
          border-radius:10px;
          background:rgba(15,23,42,0.65);
          border:1px solid rgba(148,163,184,0.22);
        ">
          <strong>${escapeAdminHtml(layer.name)}</strong><br>
          件数：${layer.count}件 / 種別：${badge}
        </div>
      `;
    }).join("");

    const cautionMessages = [];

    if (circleLayers.length > 0) {
      cautionMessages.push("円レイヤーあり：再生成時は古い円レイヤーの扱いに注意");
    }

    if (addLayers.length === 0) {
  cautionMessages.push("追加希望レイヤーなし：既存POI確認用データの可能性あり");
}

    if (dummyCount > 0) {
      cautionMessages.push(`ダミーポイントあり：${dummyCount}件`);
    }

    const cautionHtml = cautionMessages.length === 0 ? `
      <div style="
        margin-top:12px;
        padding:12px;
        border-radius:12px;
        background:rgba(34,197,94,0.12);
        border:1px solid rgba(34,197,94,0.35);
        color:#bbf7d0;
      ">
        ✅ 大きな注意点は見つかりませんでした。
      </div>
    ` : `
      <div style="
        margin-top:12px;
        padding:12px;
        border-radius:12px;
        background:rgba(249,115,22,0.12);
        border:1px solid rgba(249,115,22,0.35);
        color:#fed7aa;
      ">
        <strong>確認ポイント</strong><br>
        ${cautionMessages.map(m => "・" + escapeAdminHtml(m)).join("<br>")}
      </div>
    `;

    result.innerHTML = `
      <div class="distance-warning" style="
        background:rgba(59,130,246,0.10);
        border:1px solid rgba(96,165,250,0.35);
      ">
        <strong>KMZ内容チェック結果</strong><br><br>

        ファイル名：${escapeAdminHtml(file.name)}<br>
        レイヤー数：${layers.length}件<br>
        全ポイント数：${allPoints.length}件<br>
有効POI数：${usablePoints.length}件<br>
既存POI判定数：${existingPoints.length}件<br>
ダミーポイント：${dummyCount}件<br><br>

        <strong>推定分類</strong><br>
        既存ポケストップ相当：${counts.pokestop}件<br>
        既存ジム相当：${counts.gym}件<br>
        既存パワースポット相当：${counts.power}件<br><br>

        <strong>レイヤー構成</strong><br>
        既存POI系レイヤー：${existingLayers.length}件<br>
        追加希望系レイヤー：${addLayers.length}件<br>
        円レイヤー：${circleLayers.length}件<br>

        ${cautionHtml}

        <br>
        <details>
          <summary style="cursor:pointer; font-weight:bold;">
            レイヤー一覧を開く
          </summary>
          <div style="margin-top:10px;">
            ${layerListHtml}
          </div>
        </details>
      </div>
    `;

  } catch (error) {
    console.error(error);
    result.innerHTML = `
      <div class="distance-warning">
        内容チェック中にエラーが発生しました。<br>
        ファイル形式またはKMZ内のKML構成を確認してください。
      </div>
    `;
  }
}

function isIgnoredForDensityCheck(p) {
  const info = getAdminLayerInfo(p.layer || "");
  const layerName = p.layer || "";

  // ダミーポイントは除外
  if (isDummyPoint(p)) return true;

  // 円レイヤーは除外
  if (info.isCircle) return true;

  if (
    layerName.includes("円") ||
    layerName.includes("30m") ||
    layerName.includes("40m")
  ) {
    return true;
  }

  // 追加希望レイヤーは除外しない
  // 密集チェックでは、既存POIと追加希望POIをまたいで判定する

  return false;
}

function getDensityRank(count) {
  if (count >= 10) {
    return {
      label: "高密度",
      icon: "🔴",
      color: "#ef4444",
      message: "既存POIと追加希望POIを含めて、かなり集中しています。集合・滞留の発生に注意してください。"
    };
  }

  if (count >= 6) {
    return {
      label: "中密度",
      icon: "🟠",
      color: "#f97316",
      message: "既存POIと追加希望POIを含めて、まとまりがあります。遊びやすい一方で、人の流れに注意が必要です。"
    };
  }

  if (count >= 3) {
    return {
      label: "低密度",
      icon: "🟢",
      color: "#22c55e",
      message: "軽いまとまりがあります。回遊ポイント候補として確認できます。"
    };
  }

  return {
    label: "通常",
    icon: "⚪",
    color: "#94a3b8",
    message: "大きな密集はありません。"
  };
}

async function runAdminDensityCheck() {
  const input = document.getElementById("adminDensityFile");
  const result = document.getElementById("adminDensityResult");
  const radius = Number(document.getElementById("adminDensityRadius")?.value || 100);

  if (!input || !input.files.length) {
    alert("KML / KMZ ファイルを選択してください");
    return;
  }

  const file = input.files[0];
  const fileName = file.name.toLowerCase();

  if (
    !fileName.endsWith(".kml") &&
    !fileName.endsWith(".kmz") &&
    !fileName.endsWith(".zip")
  ) {
    alert("KML / KMZ ファイルを選択してください");
    return;
  }

  result.innerHTML = `
    <div class="distance-warning" style="
      background:rgba(59,130,246,0.12);
      border:1px solid rgba(96,165,250,0.35);
    ">
      <span class="loading">
        <span class="spinner"></span>
        密集エリアをチェック中…
      </span>
    </div>
  `;

  try {
    const extracted = await extractLayersFromKML(file);
    const layers = extracted.layers;
    const pointsByLayer = extracted.pointsByLayer;

    let allPoints = [];

    layers.forEach(layerName => {
      const points = pointsByLayer[layerName] || [];

      points.forEach(p => {
        allPoints.push({
          ...p,
          layer: layerName
        });
      });
    });

    const usablePoints = allPoints.filter(p => !isIgnoredForDensityCheck(p));

    if (usablePoints.length < 2) {
      result.innerHTML = `
        <div class="distance-warning">
          密集チェックには有効POIが2件以上必要です。<br>
          円レイヤー、追加希望レイヤー、ダミーポイントを除外した結果、判定対象が不足しています。
        </div>
      `;
      return;
    }

    const densityList = usablePoints.map(center => {
      const nearby = usablePoints.filter(p => {
        return getDistanceMeters(center, p) <= radius;
      });

      return {
        center,
        count: nearby.length,
        nearby
      };
    });

    densityList.sort((a, b) => b.count - a.count);

    const pickedAreas = [];

    densityList.forEach(item => {
      if (item.count < 3) return;

      const tooClose = pickedAreas.some(area => {
        return getDistanceMeters(area.center, item.center) <= radius;
      });

      if (!tooClose) {
        pickedAreas.push(item);
      }
    });

    const topAreas = pickedAreas.slice(0, 10);

window._densityAreas = topAreas;

if (topAreas.length === 0) {
      result.innerHTML = `
        <div class="distance-warning" style="
          background:rgba(34,197,94,0.12);
          border:1px solid rgba(34,197,94,0.35);
          color:#bbf7d0;
        ">
          ✅ 目立つ密集エリアは見つかりませんでした。<br><br>
          判定対象POI：${usablePoints.length}件<br>
          判定半径：${radius}m
        </div>
      `;
      return;
    }

    const areaHtml = topAreas.map((area, index) => {
  const rank = getDensityRank(area.count);

  const layerTypeCounts = {
    existing: 0,
    add: 0,
    other: 0
  };

  area.nearby.forEach(p => {
    const info = getAdminLayerInfo(p.layer || "");

    if (info.isAdd) {
      layerTypeCounts.add++;
    } else if (info.isExisting) {
      layerTypeCounts.existing++;
    } else {
      layerTypeCounts.other++;
    }
  });

  const nearbyNames = area.nearby
        .slice(0, 8)
        .map(p => `・${escapeAdminHtml(p.name)} <span style="opacity:0.7;">(${escapeAdminHtml(p.layer)})</span>`)
        .join("<br>");

      const moreCount = area.nearby.length > 8
        ? `<br><span style="opacity:0.75;">ほか ${area.nearby.length - 8}件</span>`
        : "";

      return `
        <div style="
          margin:12px 0;
          padding:14px;
          border-radius:14px;
          background:rgba(15,23,42,0.65);
          border:1px solid rgba(148,163,184,0.25);
          border-left:6px solid ${rank.color};
        ">
          <strong style="color:${rank.color}; font-size:16px;">
            ${rank.icon} エリア${index + 1}：${rank.label}
          </strong><br>

          中心候補：${escapeAdminHtml(area.center.name)}<br>
半径${radius}m以内：${area.count}件<br>
中心レイヤー：${escapeAdminHtml(area.center.layer)}<br>
内訳：既存 ${layerTypeCounts.existing}件 / 追加希望 ${layerTypeCounts.add}件 / その他 ${layerTypeCounts.other}件<br><br>
          <span style="color:#cbd5e1;">${rank.message}</span>

          <details style="margin-top:10px;">
            <summary style="cursor:pointer; font-weight:bold;">
              周辺POIを見る
            </summary>
            <div style="margin-top:8px; line-height:1.7;">
              ${nearbyNames}
              ${moreCount}
            </div>
          </details>
        </div>
      `;
    }).join("");

    result.innerHTML = `
      <div class="distance-warning" style="
        background:rgba(59,130,246,0.10);
        border:1px solid rgba(96,165,250,0.35);
      ">
        <strong>密集エリアチェック結果</strong><br><br>

        ファイル名：${escapeAdminHtml(file.name)}<br>
        レイヤー数：${layers.length}件<br>
        全ポイント数：${allPoints.length}件<br>
        判定対象POI：${usablePoints.length}件<br>
        判定半径：${radius}m<br>
        密集エリア候補：${topAreas.length}件<br><br>

        ${areaHtml}
      </div>
    `;

  } catch (error) {
    console.error(error);
    result.innerHTML = `
      <div class="distance-warning">
        密集エリアチェック中にエラーが発生しました。<br>
        ファイル形式またはKMZ内のKML構成を確認してください。
      </div>
    `;
  }
}
async function generateDensityAreaKMZ() {
  const densityAreas = window._densityAreas || [];

  if (!densityAreas.length) {
    alert("先に密集エリアチェックを実行してください");
    return;
  }

  const radius =
    Number(document.getElementById("adminDensityRadius")?.value || 100);

  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>密集エリアチェック</name>

<Style id="densityCircle">
  <LineStyle>
    <color>ff0000ff</color>
    <width>4</width>
  </LineStyle>
  <PolyStyle>
    <color>330000ff</color>
    <fill>1</fill>
    <outline>1</outline>
  </PolyStyle>
</Style>
`;

  densityAreas.forEach((area, index) => {
    const center = area.center || area;

    const lat = Number(center.lat);
    const lng = Number(center.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.warn("密集エリアの座標が取得できません", area);
      return;
    }

    const count = area.count || area.nearby?.length || 0;

    let existing = 0;
    let add = 0;

    (area.nearby || []).forEach(p => {
      const info = getAdminLayerInfo(p.layer || "");

      if (info.isAdd) {
        add++;
      } else if (info.isExisting) {
        existing++;
      }
    });

    const rank = getDensityRank(count);

    const circleCoords = createCircleCoordinates(lat, lng, radius);

    kml += `
<Placemark>
  <name>密集エリア${index + 1}：${rank.label}</name>
  <description><![CDATA[
中心候補：${center.name || "不明"}<br>
判定半径：${radius}m<br>
半径内POI：${count}件<br>
既存POI：${existing}件<br>
追加希望POI：${add}件<br><br>
${rank.message}
  ]]></description>
  <styleUrl>#densityCircle</styleUrl>
  <Polygon>
    <outerBoundaryIs>
      <LinearRing>
        <coordinates>${circleCoords}</coordinates>
      </LinearRing>
    </outerBoundaryIs>
  </Polygon>
</Placemark>
`;
  });

  kml += `
</Document>
</kml>`;

  const zip = new JSZip();
  zip.file("doc.kml", kml);

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.google-earth.kmz"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "density-area-check.kmz";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
function createCircleCoordinates(lat, lng, radius) {

  const coords = [];

  const earthRadius = 6378137;

  for (let i = 0; i <= 360; i += 8) {

    const angle = i * Math.PI / 180;

    const dx = radius * Math.cos(angle);
    const dy = radius * Math.sin(angle);

    const newLat =
      lat + (dy / earthRadius) * (180 / Math.PI);

    const newLng =
      lng +
      (dx / earthRadius) *
      (180 / Math.PI) /
      Math.cos(lat * Math.PI / 180);

    coords.push(`${newLng},${newLat},0`);
  }

  return coords.join(" ");
}