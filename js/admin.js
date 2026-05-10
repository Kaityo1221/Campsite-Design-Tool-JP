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