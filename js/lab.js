/* =========================
   Campsite Lab Standalone JS
   - Labページ内の研究機能だけを管理
   - index.html / 距離チェック / KMZ提出チェック / マップ表示制御には接続しない
========================= */


/* =========================
   Lab page local escape helper
   - lab.html は distance.js を読み込まないため、Lab内で使うescapeHtmlをここで持つ
========================= */
if (typeof window.escapeHtml !== "function") {
  window.escapeHtml = function (value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  };
}

/* =========================
   Campsite Lab Research Engine
   CSV → Existing POI KMZ
========================= */

/* =========================
   CAMP-107: Supabase alias_master 辞書をLab Engine分類に反映
========================= */

function normalizeLabAliasText(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getLabCategoryFromAliasDictionary(row) {
  const dictionaryId =
    String(row.dictionary_id || "").toUpperCase();

  const canonicalName =
    String(row.canonical_name || "");

  const categoryKey =
    String(row.category_key || "").toUpperCase();

  if (
    dictionaryId.includes("REST") ||
    categoryKey === "REST" ||
    canonicalName === "休憩"
  ) {
    return {
      key: "rest",
      label: "休憩"
    };
  }

  if (
    dictionaryId.includes("STAY") ||
    categoryKey === "STAY" ||
    canonicalName === "滞在"
  ) {
    return {
      key: "stay",
      label: "滞在"
    };
  }

  if (
    dictionaryId.includes("LOOP") ||
    categoryKey === "LOOP" ||
    canonicalName === "回遊"
  ) {
    return {
      key: "loop",
      label: "回遊"
    };
  }

  if (
    dictionaryId.includes("CAUTION") ||
    categoryKey === "CAUTION" ||
    canonicalName === "注意"
  ) {
    return {
      key: "caution",
      label: "注意"
    };
  }

  return null;
}

function findLabAliasDictionaryMatch(name, aliases) {
  const normalizedName =
    normalizeLabAliasText(name);

  if (!normalizedName) {
    return null;
  }

  const exactMatch = aliases.find(row => {
    const alias =
      normalizeLabAliasText(
        row.normalized_alias ||
        row.alias_name
      );

    return alias && normalizedName === alias;
  });

  if (exactMatch) {
    return exactMatch;
  }

  const partialMatch = aliases.find(row => {
    const matchType =
      String(row.match_type || "exact").toLowerCase();

    if (matchType !== "partial") {
      return false;
    }

    const alias =
      normalizeLabAliasText(
        row.normalized_alias ||
        row.alias_name
      );

    return alias && normalizedName.includes(alias);
  });

  return partialMatch || null;
}

async function loadLabAliasDictionaryFromSupabase() {
  if (!window.campsiteSupabase) {
    console.warn("Supabase未接続のため、alias_master辞書は読み込みません。");
    return [];
  }

  const { data, error } = await window.campsiteSupabase
    .from("alias_master")
    .select(`
      alias_id,
      dictionary_id,
      canonical_name,
      alias_name,
      normalized_alias,
      match_type,
      source_type,
      review_status,
      active,
      category_key
    `)
    .eq("active", true)
    .eq("review_status", "active")
    .limit(2000);

  if (error) {
    console.error("alias_master辞書読み込みエラー:", error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

window.enrichLabPointsWithPoiDatabank = async function(points) {
  const aliases =
    await loadLabAliasDictionaryFromSupabase();

  if (!aliases.length) {
    console.log("alias_master辞書は0件でした。既存ルールで分類します。");
    return points;
  }

  let matchedCount = 0;

  const enrichedPoints = (points || []).map(point => {
    const name =
      point.name ||
      point.title ||
      point.poi_name ||
      point.displayName ||
      "";

    const matchedAlias =
      findLabAliasDictionaryMatch(name, aliases);

    if (!matchedAlias) {
      return point;
    }

    const category =
      getLabCategoryFromAliasDictionary(matchedAlias);

    if (!category) {
      return point;
    }

    matchedCount += 1;

    return {
      ...point,
      _labCategoryKey: category.key,
      _labCategoryLabel: category.label,
      _labAliasMatched: true,
      _labAliasName:
        matchedAlias.alias_name ||
        matchedAlias.normalized_alias ||
        "",
      _labDictionaryId:
        matchedAlias.dictionary_id ||
        ""
    };
  });

  console.log(
    `alias_master辞書分類: ${matchedCount}件ヒット / ${points.length}件`
  );

  return enrichedPoints;
};
async function runLabCsvToKmzEngine() {
  const input =
    document.getElementById("labResearchCsvFile");

  const result =
    document.getElementById("labEngineResult");

  const machine =
    document.getElementById("labEngineMachine");

  if (!input || !input.files.length) {
    alert("研究するCSVファイルを選択してください");
    return;
  }

  const files = Array.from(input.files);

  const invalidFiles =
    files.filter(file => {
      return !file.name.toLowerCase().endsWith(".csv");
    });

  if (invalidFiles.length) {
    alert("Wayfarer Mapから出力したCSVだけを選択してください");
    input.value = "";
    return;
  }

  if (machine) {
  machine.classList.remove("complete");
  machine.classList.add("running");
}

resetLabResearchKmzOutput();

hideLabResearchMapOnStart();

startLabEngineSound();

  if (result) {
    result.innerHTML = `
      <div class="distance-warning" style="
        background:rgba(59,130,246,0.12);
        border:1px solid rgba(96,165,250,0.35);
      ">
        <span class="loading">
          <span class="spinner"></span>
          LAB ENGINE 起動中… 複数CSVを統合し、重複を削除しています。
        </span>
      </div>
    `;
  }

  try {
    let allPoints = [];

    for (const file of files) {
      const text = await file.text();

      const points = parseCSV(text)
        .map(p => ({
          ...p,
          _sourceFile: file.name
        }))
        .filter(p => {
          const lat = Number(p.lat);
          const lng = Number(p.lng);

          return (
            Number.isFinite(lat) &&
            Number.isFinite(lng)
          );
        });

      allPoints = allPoints.concat(points);
    }

    const dedupeResult =
      dedupeLabPoiPoints(allPoints);

    let points =
  dedupeResult.points;

    if (!points.length) {
      if (machine) {
        machine.classList.remove("running");
      }

      stopLabEngineSound();

      if (result) {
        result.innerHTML = `
          <div class="distance-warning">
            ⚠ 有効なPOI座標が見つかりませんでした。<br>
            CSVの緯度・経度列を確認してください。
          </div>
        `;
      }

      return;
    }
    if (typeof window.enrichLabPointsWithPoiDatabank === "function") {
      points = await window.enrichLabPointsWithPoiDatabank(points);
    }

    // CAMP-108:
// 3人レビューで承認済みの辞書と推論ルールをLabEngine本体へ投入。
// ここで付ける分類はLabEngine画面・研究KMZ用であり、
// index.html側の距離チェック、マップ表示制御、マイマップコメントには接続しない。
if (typeof window.enrichLabPointsWithLabEngineBrain === "function") {
  points = await window.enrichLabPointsWithLabEngineBrain(points);
}

// CAMP-109: LabEngine学習判定の内訳をカウント
(points || []).forEach(point => {
  window.LabEngineLearningStats?.recordDecision(point);
});

console.log("Lab Engine POI分類完了:", points);

/**
 * LabEngineの解析済みPOIを
 * スマートウォッチ歩行解析へ渡す
 */
if (
  window.CampsiteWalkAnalysis &&
  typeof window.CampsiteWalkAnalysis.setPoiData === "function"
) {
  const poiTransferResult =
    window.CampsiteWalkAnalysis.setPoiData(points);

  console.log(
    "歩行解析へのPOI転送完了:",
    poiTransferResult
  );
} else {
  console.warn(
    "歩行解析機能が見つからないため、POIは転送されませんでした。"
  );
}

renderLabResearchMap(points);
setLabResearchKmzReady(points);
    await new Promise(resolve => {
  setTimeout(resolve, 2200);
});

    const sourceName =
      files.map(file => file.name).join(" / ");

    // const kmzBlob =
//   await createLabExistingPoiKmz(
//     points,
//     sourceName
//   );

    const today =
      new Date().toISOString().slice(0, 10).replace(/-/g, "");

    const guessedParkName =
  guessLabParkName(points);

const parkName =
  sanitizeFileNamePart(guessedParkName);

const downloadName =
  `Lab_${parkName}_${today}.kmz`;

const unknownPoiCount =
  countUnknownLabPois(points);

const labEngineBrainMatchedCount =
  countLabEngineBrainMatchedPois(points);

pendingLabResearchReport = {
  parkName,
  csvCount: files.length,
  loadedPoiCount: allPoints.length,
  dedupedPoiCount: points.length,
  removedDuplicateCount: dedupeResult.removed,
  unknownPoiCount,
  labEngineBrainMatchedCount,
  kmzFilename: downloadName,
  points
};

showLabResearchSubmitBox();

    // downloadBlob(
//   kmzBlob,
//   downloadName
// );

    if (machine) {
      machine.classList.remove("running");
      machine.classList.add("complete");
    }

    stopLabEngineSound();

    if (result) {
      result.innerHTML = `
        <div class="distance-warning" style="
          background:rgba(34,197,94,0.12);
          border:1px solid rgba(34,197,94,0.35);
          color:#bbf7d0;
        ">
          ✅ LAB ENGINE COMPLETE<br><br>
          複数CSVを統合し、研究用KMZを生成しました。<br>
          推定公園名：${escapeHtml(parkName)}<br>
          ファイル名：${escapeHtml(downloadName)}<br>
          投入CSV：${files.length}件<br>
          読み込みPOI：${allPoints.length}件<br>
          重複削除：${dedupeResult.removed}件<br>
          出力POI：${points.length}件<br>
LabEngine学習判定：${labEngineBrainMatchedCount}件<br>
未分類POI：${unknownPoiCount}件<br><br>
まだSupabaseには送信されていません。<br>
研究KMZを保存して会長のDiscord DMへ送り、一言メモを書いてから「研究結果を送信」を押してください。
        </div>
      `;
    }

renderLabLearningBreakdown();
  } catch (error) {
    console.error(error);

    stopLabEngineSound();

    if (machine) {
      machine.classList.remove("running");
    }

    if (result) {
      result.innerHTML = `
        <div class="distance-warning">
          ⚠ LAB ENGINEでエラーが発生しました。<br>
          CSV形式を確認してください。
        </div>
      `;
    }
  }
}
async function saveLabResearchHistory(data) {
  if (!window.campsiteSupabase) {
    console.warn("Supabaseクライアントが未初期化のため、研究履歴は保存されませんでした。");
    return {
      success: false,
      message: "Supabase未接続"
    };
  }

  const { error } = await window.campsiteSupabase
    .from("lab_research_history")
    .insert({
  park_name: data.parkName,
  csv_count: data.csvCount,
  loaded_poi_count: data.loadedPoiCount,
  deduped_poi_count: data.dedupedPoiCount,
  removed_duplicate_count: data.removedDuplicateCount,
  unknown_poi_count: data.unknownPoiCount,
  kmz_filename: data.kmzFilename,
  researcher_note: data.researcherNote || "",
  submitted_at: new Date().toISOString()
});

  if (error) {
    console.error("研究履歴保存エラー:", error);

    return {
      success: false,
      message: error.message || "保存失敗"
    };
  }

  return {
    success: true,
    message: "保存済み"
  };
}

function countUnknownLabPois(points) {
  return (points || []).filter(point => {
    return getLabPoiCategoryKey(point) === "unknown";
  }).length;
}

function countLabEngineBrainMatchedPois(points) {
  return (points || []).filter(point => {
    return Boolean(point._labEngineBrainMatched);
  }).length;
}
async function saveAliasReviewQueue(points) {
  if (!window.campsiteSupabase) {
    console.warn("Supabase未接続のため、未分類POIレビューキューは保存されませんでした。");
    return {
      success: false,
      message: "Supabase未接続",
      savedCount: 0
    };
  }

  const items = buildUnknownPoiReviewItems(points);

  if (!items.length) {
    return {
      success: true,
      message: "未分類POIなし",
      savedCount: 0
    };
  }

  const rows = items.map(item => {
    const sample = item.samples?.[0] || {};

    return {
      poi_name: item.poi_name,
      normalized_name: item.normalized_name,
      count: item.count,
      sample_lat: sample.lat || null,
      sample_lng: sample.lng || null,
      source: "lab_engine",
      review_status: "pending",
      suggested_category: item.suggested_category || null,
      review_note: item.review_note || null
    };
  });

  const { error } = await window.campsiteSupabase
    .from("alias_review_queue")
    .insert(rows);

  if (error) {
    console.error("未分類POIレビューキュー保存エラー:", error);

    return {
      success: false,
      message: error.message || "保存失敗",
      savedCount: 0
    };
  }

  return {
    success: true,
    message: `${rows.length}件保存済み`,
    savedCount: rows.length
  };
}
function showLabResearchSubmitBox() {
  const box = document.getElementById("labResearchSubmitBox");
  const status = document.getElementById("labResearchSubmitStatus");
  const note = document.getElementById("labResearchNote");
  const button = document.getElementById("labResearchSubmitButton");

  if (box) {
    box.style.display = "block";
  }

  if (status) {
    status.innerHTML = "";
  }

  if (note) {
    note.value = "";
  }

  if (button) {
    button.disabled = false;
    button.textContent = "📮 研究結果を送信";
  }
}

async function submitLabResearchReport() {
  const status = document.getElementById("labResearchSubmitStatus");
  const noteInput = document.getElementById("labResearchNote");
  const button = document.getElementById("labResearchSubmitButton");

  if (!pendingLabResearchReport) {
    alert("先にLAB ENGINE STARTでCSVを解析してください。");
    return;
  }

  const researcherNote =
    String(noteInput?.value || "").trim();

  if (!researcherNote) {
    alert("公園について気づいたことを一言だけ入力してください。");
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "送信中…";
  }

  if (status) {
    status.innerHTML = `
      <div class="distance-warning" style="
        margin-top:12px;
        background:rgba(59,130,246,0.12);
        border:1px solid rgba(96,165,250,0.35);
      ">
        研究結果を送信中です…
      </div>
    `;
  }

  try {
    const historySaveResult =
      await saveLabResearchHistory({
        parkName: pendingLabResearchReport.parkName,
        csvCount: pendingLabResearchReport.csvCount,
        loadedPoiCount: pendingLabResearchReport.loadedPoiCount,
        dedupedPoiCount: pendingLabResearchReport.dedupedPoiCount,
        removedDuplicateCount: pendingLabResearchReport.removedDuplicateCount,
        unknownPoiCount: pendingLabResearchReport.unknownPoiCount,
        kmzFilename: pendingLabResearchReport.kmzFilename,
        researcherNote
      });

    const aliasReviewSaveResult =
      await saveAliasReviewQueue(
        pendingLabResearchReport.points
      );

    if (status) {
      status.innerHTML = `
        <div class="distance-warning" style="
          margin-top:12px;
          background:rgba(34,197,94,0.12);
          border:1px solid rgba(34,197,94,0.35);
          color:#bbf7d0;
        ">
          ✅ 研究結果を送信しました。<br><br>
          研究履歴：${escapeHtml(historySaveResult.message)}<br>
          未分類レビューキュー：${escapeHtml(aliasReviewSaveResult.message)}
        </div>
      `;
    }

    pendingLabResearchReport = null;

    if (button) {
      button.textContent = "送信済み";
    }

  } catch (error) {
    console.error(error);

    if (status) {
      status.innerHTML = `
        <div class="distance-warning" style="margin-top:12px;">
          ⚠ 研究結果の送信に失敗しました。<br>
          ConsoleまたはSupabase設定を確認してください。
        </div>
      `;
    }

    if (button) {
      button.disabled = false;
      button.textContent = "📮 研究結果を送信";
    }
  }
}
let currentAliasReviewItem = null;
let aliasReviewIsLoading = false;
let aliasReviewSkippedIds = [];



function scrollToLabEngineMachine() {
  const machine = document.getElementById("labEngineMachine");

  if (!machine) return;

  setTimeout(() => {
    machine.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }, 80);
}
function hideLabResearchMapOnStart() {
  const panel = document.getElementById("researchMapPanel");

  if (panel) {
    panel.style.display = "none";
  }
}
function dedupeLabPoiPoints(points) {
  const seen = new Map();
  const unique = [];

  points.forEach(point => {
    const lat = Number(point.lat);
    const lng = Number(point.lng);

    /*
      約0.1m単位で座標を丸める。
      Wayfarer Mapの重複抽出対策としては十分細かい。
    */
    const key =
      `${lat.toFixed(6)},${lng.toFixed(6)}`;

    if (!seen.has(key)) {
      seen.set(key, true);
      unique.push(point);
    }
  });

  return {
    points: unique,
    removed: points.length - unique.length
  };
}

function guessLabParkName(points) {
  const counts = new Map();

  points.forEach(point => {
    const texts = [
      point.name,
      point.title,
      point.description
    ]
      .filter(Boolean)
      .map(text => String(text));

    texts.forEach(text => {
      const matches = text.match(
        /[ぁ-んァ-ヶ一-龠A-Za-z0-9ー・（）()]+(?:公園|広場|庭園|緑地|遊園|運動公園|森林公園|臨海公園|中央公園|総合公園)/g
      );

      if (!matches) return;

      matches.forEach(name => {
        const cleaned = name
          .replace(/[「」『』【】\[\]]/g, "")
          .trim();

        if (!cleaned) return;

        counts.set(
          cleaned,
          (counts.get(cleaned) || 0) + 1
        );
      });
    });
  });

  if (!counts.size) {
    return "研究KMZ";
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])[0][0];
}

function sanitizeFileNamePart(text) {
  return String(text || "研究KMZ")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 40);
}
async function createLabExistingPoiKmz(points, sourceName) {
  const kml = createLabExistingPoiKml(
    points,
    sourceName
  );

  if (!isJSZipAvailable("研究用KMZ生成")) {
    throw new Error("JSZipが読み込まれていません");
  }

  const zip = new JSZip();

  zip.file("doc.kml", kml);

  return await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.google-earth.kmz"
  });
}
function getLabPoiCategoryLabel(input = "") {
  if (input && typeof input === "object" && input._labCategoryLabel) {
    return input._labCategoryLabel;
  }

  const name =
    input && typeof input === "object"
      ? input.name || input.title || ""
      : input;

  const labels = [];

  if (isRestPoi(name)) labels.push("休憩");
  if (isStayPoi(name)) labels.push("滞在");
  if (isLoopPoi(name)) labels.push("回遊");
  if (isCautionPoi(name)) labels.push("注意");

  return labels.length
    ? labels.join("・")
    : "未分類";
}
function getLabPoiStyleId(input = "") {
  const categoryKey = getLabPoiCategoryKey(input);

  if (categoryKey === "caution") {
    return "labCautionPoi";
  }

  if (categoryKey === "rest") {
    return "labRestPoi";
  }

  if (categoryKey === "stay") {
    return "labStayPoi";
  }

  if (categoryKey === "loop") {
    return "labLoopPoi";
  }
  if (categoryKey === "hold") {
    return "labHoldPoi";
  }

  if (categoryKey === "exclude") {
    return "labExcludePoi";
  }
  return "labUnknownPoi";
}
function getLabPoiCategoryKey(input = "") {
  if (input && typeof input === "object" && input._labCategoryKey) {
    return input._labCategoryKey;
  }

  const name =
    input && typeof input === "object"
      ? input.name || input.title || ""
      : input;

  if (isCautionPoi(name)) {
    return "caution";
  }

  if (isRestPoi(name)) {
    return "rest";
  }

  if (isStayPoi(name)) {
    return "stay";
  }

  if (isLoopPoi(name)) {
    return "loop";
  }

  return "unknown";
}

function getLabPoiFolderName(categoryKey) {
  const names = {
    rest: "🟢 休憩",
    stay: "🟡 滞在",
    loop: "🔵 回遊",
    caution: "🔴 注意",
    hold: "🟣 保留",
    exclude: "⚫ 除外",
    unknown: "⚪ 未分類"
  };

  return names[categoryKey] || names.unknown;
}
function isRestPoi(name = "") {
  return /ベンチ|東屋|四阿|あずまや|休憩|休憩所|水飲み|水飲場|藤棚|パーゴラ|トイレ/.test(String(name));
}

function isStayPoi(name = "") {
  return /広場|芝生|ステージ|交流|集会|噴水|時計|モニュメント|花壇|休憩広場/.test(String(name));
}

function isLoopPoi(name = "") {
  return /遊歩道|園路|橋|案内板|案内図|入口|出入口|散策|歩道|通路|門|マップ/.test(String(name));
}

function isCautionPoi(name = "") {
  return /駐車場|駐輪場|車道|道路|学校|病院|坂|階段|工事|水辺|池|川|喫煙|立入禁止|管理棟/.test(String(name));
}
function createLabExistingPoiKml(points, sourceName) {
  const groups = {
    rest: [],
    stay: [],
    loop: [],
    caution: [],
    hold: [],
    exclude: [],
    unknown: []
  };

  points.forEach((p, index) => {
    const lat = Number(p.lat);
    const lng = Number(p.lng);

    const rawName =
      p.name ||
      p.title ||
      `POI_${index + 1}`;

    const name =
      escapeKmlText(rawName);

    const kind =
      classifyType(
        p.type,
        rawName,
        p.layer || "CSV_POI"
      ) ||
      "poi";

    const sourceFile =
      p._sourceFile || sourceName;

    const categoryLabel =
  getLabPoiCategoryLabel(p);

const categoryKey =
  getLabPoiCategoryKey(p);

const styleId =
  getLabPoiStyleId(p);

const rest =
  categoryKey === "rest" ? "○" : "×";

const stay =
  categoryKey === "stay" ? "○" : "×";

const loop =
  categoryKey === "loop" ? "○" : "×";

const caution =
  categoryKey === "caution" ? "○" : "×";
const hold =
  categoryKey === "hold" ? "○" : "×";

const exclude =
  categoryKey === "exclude" ? "○" : "×";

    const placemark = `
<Placemark>
  <name>${name}</name>
  <styleUrl>#${styleId}</styleUrl>
  <description><![CDATA[
<strong>${name}</strong><br><br>

研究用KMZ<br>
推定カテゴリ：${escapeKmlText(categoryLabel)}<br>
種別：${escapeKmlText(kind)}<br>
元CSV：${escapeKmlText(sourceFile)}<br><br>

座標<br>
lat：${lat}<br>
lng：${lng}<br><br>

休憩：${rest}<br>
滞在：${stay}<br>
回遊：${loop}<br>
注意：${caution}<br>
保留：${hold}<br>
除外：${exclude}
  ]]></description>
  <Point>
    <coordinates>${lng},${lat},0</coordinates>
  </Point>
</Placemark>`;

    groups[categoryKey].push(placemark);
  });

  const folders =
    ["rest", "stay", "loop", "caution", "hold", "exclude", "unknown"]
      .map(key => {
        if (!groups[key].length) {
          return "";
        }

        return `
<Folder>
  <name>${getLabPoiFolderName(key)}</name>
  ${groups[key].join("")}
</Folder>`;
      })
      .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>Campsite Lab Research KMZ</name>
  <description><![CDATA[
<strong>KMZアイコン凡例</strong><br><br>
🟢 休憩：ベンチ・東屋・トイレなど<br>
🟡 滞在：広場・芝生・噴水など<br>
🔵 回遊：遊歩道・橋・案内板など<br>
🔴 注意：駐車場・階段・水辺など<br>
🟣 保留：情報不足・人間確認が必要<br>
⚫ 除外：設計対象から外す候補<br>
⚪ 未分類：辞書追加候補
  ]]></description>

  <Style id="labRestPoi">
    <IconStyle>
      <scale>1.0</scale>
      <Icon>
        <href>http://maps.google.com/mapfiles/kml/paddle/grn-circle.png</href>
      </Icon>
    </IconStyle>
  </Style>

  <Style id="labStayPoi">
    <IconStyle>
      <scale>1.0</scale>
      <Icon>
        <href>http://maps.google.com/mapfiles/kml/paddle/ylw-circle.png</href>
      </Icon>
    </IconStyle>
  </Style>

  <Style id="labLoopPoi">
    <IconStyle>
      <scale>1.0</scale>
      <Icon>
        <href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href>
      </Icon>
    </IconStyle>
  </Style>

  <Style id="labCautionPoi">
    <IconStyle>
      <scale>1.0</scale>
      <Icon>
        <href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href>
      </Icon>
    </IconStyle>
  </Style>
  <Style id="labHoldPoi">
    <IconStyle>
      <scale>1.0</scale>
      <Icon>
        <href>http://maps.google.com/mapfiles/kml/paddle/purple-circle.png</href>
      </Icon>
    </IconStyle>
  </Style>

  <Style id="labExcludePoi">
    <IconStyle>
      <scale>1.0</scale>
      <Icon>
        <href>http://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href>
      </Icon>
    </IconStyle>
  </Style>
  <Style id="labUnknownPoi">
    <IconStyle>
      <scale>1.0</scale>
      <Icon>
        <href>http://maps.google.com/mapfiles/kml/paddle/wht-circle.png</href>
      </Icon>
    </IconStyle>
  </Style>

  ${folders}
</Document>
</kml>`;
}

function downloadBlob(blob, fileName) {
  const a = document.createElement("a");

  a.href = URL.createObjectURL(blob);
  a.download = fileName;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(a.href);
}

function escapeKmlText(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function startLabEngineSound() {
  const audio = document.getElementById("labEngineSound");

  if (!audio) return;

  audio.currentTime = 0;
  audio.loop = true;
  audio.volume = 0.45;

  const playPromise = audio.play();

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {
      console.log("音声再生はブラウザにブロックされました");
    });
  }
}

function stopLabEngineSound() {
  const audio = document.getElementById("labEngineSound");

  if (!audio) return;

  audio.pause();
  audio.currentTime = 0;
}

let labResearchKmzPoints = [];
let labResearchMapInstance = null;
let labResearchLayerGroup = null;
let pendingLabResearchReport = null;

function resetLabResearchKmzOutput() {
  labResearchKmzPoints = [];
  /**
   * 前回の歩行解析用POIもクリアする
   */
  if (
    window.CampsiteWalkAnalysis &&
    typeof window.CampsiteWalkAnalysis.clearPoiData === "function"
  ) {
    window.CampsiteWalkAnalysis.clearPoiData();
  }

  // CAMP-109: LabEngine 学習判定カウンターをリセット
  window.LabEngineLearningStats?.reset();

  // CAMP-109: 前回の学習判定内訳カードを非表示に戻す
  const learningBreakdownBox = document.getElementById("labLearningBreakdown");
  if (learningBreakdownBox) {
    learningBreakdownBox.hidden = true;
  }

  const button = document.getElementById("researchKmzButton");

  if (!button) return;

  button.disabled = true;
  button.classList.add("disabled");

  const note = button.querySelector("small");

  if (note) {
    note.textContent = "CSV解析後に保存できます";
  }
}

function setLabResearchKmzReady(points) {
  labResearchKmzPoints = points;

  const button = document.getElementById("researchKmzButton");
  if (!button) return;

  button.disabled = false;
  button.classList.remove("disabled");

  const note = button.querySelector("small");
  if (note) {
    note.textContent = "研究結果をKMZで保存";
  }
}

function downloadResearchKmz() {
  if (!labResearchKmzPoints.length) {
    alert("先にCSVをLab Engineへ投入してください。");
    return;
  }

  const sourceName = "Campsite Lab Research";

  createLabExistingPoiKmz(
    labResearchKmzPoints,
    sourceName
  ).then(blob => {
    const today =
      new Date().toISOString().slice(0, 10).replace(/-/g, "");

    const parkName =
      sanitizeFileNamePart(
        guessLabParkName(labResearchKmzPoints)
      );

    downloadBlob(
      blob,
      `Lab_${parkName}_${today}.kmz`
    );
  });
}

function renderLabResearchMap(points) {
  const panel = document.getElementById("researchMapPanel");
  const mapElement = document.getElementById("researchResultMap");
  const summary = document.getElementById("researchMapSummary");

  if (!panel || !mapElement) return;

  panel.style.display = "block";

  if (typeof L === "undefined") {
    mapElement.innerHTML = `
      <div class="distance-warning">
        地図ライブラリを読み込めませんでした。
      </div>
    `;
    return;
  }

  if (labResearchMapInstance) {
    labResearchMapInstance.remove();
    labResearchMapInstance = null;
  }

  labResearchMapInstance = L.map("researchResultMap", {
    zoomControl: true
  });

  const osmLayer = L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19
    }
  );

  osmLayer.addTo(labResearchMapInstance);

  labResearchLayerGroup = L.layerGroup()
    .addTo(labResearchMapInstance);

  const bounds = [];

  points.forEach(point => {
    const lat = Number(point.lat);
    const lng = Number(point.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const name =
      point.name ||
      point.title ||
      "POI";

    const categoryKey =
  getLabPoiCategoryKey(point);

    const color =
      getLabResearchCategoryColor(categoryKey);

    const label =
      getLabPoiFolderName(categoryKey);

    L.circleMarker([lat, lng], {
      radius: 6,
      color,
      fillColor: color,
      weight: 1.5,
      fillOpacity: 0.9
    })
      .bindPopup(`
        <strong>${escapeHtml(name)}</strong><br>
        分類：${escapeHtml(label)}
      `)
      .addTo(labResearchLayerGroup);

    bounds.push([lat, lng]);
  });

  if (bounds.length) {
    labResearchMapInstance.fitBounds(bounds, {
      padding: [24, 24]
    });
  }

  setTimeout(() => {
    labResearchMapInstance?.invalidateSize();
  }, 100);

  if (summary) {
    summary.innerHTML = renderLabResearchSummary(points);
  }
  renderUnknownPoiReview(points);
}

function getLabResearchCategoryColor(categoryKey) {
  const colors = {
    rest: "#22c55e",
    stay: "#facc15",
    loop: "#3b82f6",
    caution: "#ef4444",
    hold: "#a855f7",
    exclude: "#64748b",
    unknown: "#f8fafc"
  };

  return colors[categoryKey] || colors.unknown;
}

function renderLabResearchSummary(points) {
  const counts = {
  rest: 0,
  stay: 0,
  loop: 0,
  caution: 0,
  hold: 0,
  exclude: 0,
  unknown: 0
};

  points.forEach(point => {
    const key =
  getLabPoiCategoryKey(point);
    counts[key] =
      (counts[key] || 0) + 1;
  });

  return `
  <strong>研究結果</strong><br>
  🟢 休憩：${counts.rest}件　
  🟡 滞在：${counts.stay}件　
  🔵 回遊：${counts.loop}件　
  🔴 注意：${counts.caution}件　
  🟣 保留：${counts.hold}件　
  ⚫ 除外：${counts.exclude}件　
  ⚪ 未分類：${counts.unknown}件
`;
}

// ===============================
// CAMP-096：未分類POIレビュー候補
// ===============================

let latestUnknownPoiReviewItems = [];

function normalizePoiNameForReview(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

function isUnknownPoiForReview(point) {
  if (!point) return false;

  const categoryKey = getLabPoiCategoryKey(point);

  return categoryKey === "unknown";
}

function buildUnknownPoiReviewItems(points) {
  const map = new Map();

  (points || []).forEach((point) => {
    if (!isUnknownPoiForReview(point)) return;

    const rawName =
      point.name ||
      point.title ||
      point.poi_name ||
      point.displayName ||
      "";

    const normalizedName = normalizePoiNameForReview(rawName);
    if (!normalizedName) return;

    if (!map.has(normalizedName)) {
      map.set(normalizedName, {
        poi_name: rawName,
        normalized_name: normalizedName,
        count: 0,
        samples: [],
        review_status: "pending",
        suggested_category: "",
        review_note: ""
      });
    }

    const item = map.get(normalizedName);
    item.count += 1;

    if (item.samples.length < 3) {
      item.samples.push({
        lat: point.lat || point.latitude || "",
        lng: point.lng || point.lon || point.longitude || ""
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.normalized_name.localeCompare(b.normalized_name, "ja");
  });
}

function renderUnknownPoiReview(points) {
  const box = document.getElementById("unknownPoiReviewBox");
  const summary = document.getElementById("unknownPoiSummary");
  const list = document.getElementById("unknownPoiList");

  if (!box || !summary || !list) return;

  const items = buildUnknownPoiReviewItems(points);
  latestUnknownPoiReviewItems = items;

  box.style.display = "block";

  if (!items.length) {
    summary.textContent =
      "未分類POIはありません。現在の辞書で全件分類できています。";
    list.innerHTML = "";
    return;
  }

  const totalCount = items.reduce((sum, item) => sum + item.count, 0);

  summary.textContent =
  `未分類：${totalCount}件 / 名称 ${items.length}種類（画面表示は上位20件）`;

const DISPLAY_LIMIT = 20;
const visibleItems = items.slice(0, DISPLAY_LIMIT);
const hiddenTypeCount = Math.max(items.length - DISPLAY_LIMIT, 0);

list.innerHTML = `
  ${visibleItems.map((item) => {
    return `
      <div class="unknown-poi-item">
        <div
          class="unknown-poi-name"
          title="${escapeHtml(item.normalized_name)}"
        >
          ${escapeHtml(item.normalized_name)}
        </div>
        <div class="unknown-poi-count">${item.count}件</div>
      </div>
    `;
  }).join("")}

  ${
    hiddenTypeCount > 0
      ? `
        <div class="unknown-poi-more">
          ほか ${hiddenTypeCount} 種類は、研究結果送信後に未分類レビューで確認できます
        </div>
      `
      : ""
  }
`;
}
// ======================================================
// CAMP-109: LabEngine 学習判定内訳 表示
// ======================================================

function renderLabLearningBreakdown() {
  let box = document.getElementById("labLearningBreakdown");
  let body = document.getElementById("labLearningBreakdownBody");

  // CAMP-109:
  // lab.html側にカードが無い、または位置が遠い場合でも
  // LAB ENGINE COMPLETE の直下に自動生成する
  if (!box || !body) {
    const result = document.getElementById("labEngineResult");

    if (!result) {
      return;
    }

    box = document.createElement("div");
    box.id = "labLearningBreakdown";
    box.className = "panel";
    box.style.marginTop = "16px";

    box.innerHTML = `
      <h2>学習判定の内訳</h2>
      <div id="labLearningBreakdownBody"></div>
    `;

    result.insertAdjacentElement("afterend", box);

    body = document.getElementById("labLearningBreakdownBody");
  }

  if (!body) {
    return;
  }

  // CAMP-109: 既存カードがページ下部にある場合でも、完了結果の直下へ移動する
  const resultBox = document.getElementById("labEngineResult");
  if (resultBox) {
    resultBox.insertAdjacentElement("afterend", box);
  }
  
    // CAMP-109: スマホ表示で「学習判定の内訳」が不自然に改行されないよう調整
  const title = box.querySelector("h2");
if (title) {
  title.style.whiteSpace = "normal";
  title.style.wordBreak = "break-word";
  title.style.fontSize = "clamp(22px, 5.4vw, 30px)";
  title.style.lineHeight = "1.25";
  title.style.letterSpacing = "-0.04em";
}

  box.hidden = false;

  if (!window.LabEngineLearningStats) {
    body.innerHTML = `
      <div class="lab-learning-breakdown">
        <p><strong>学習判定の内訳を取得できませんでした。</strong></p>
        <p class="note warning">
          LabEngineLearningStats が見つかりません。<br>
          lab-engine-brain.js の読み込み順、またはキャッシュを確認してください。
        </p>
      </div>
    `;
    return;
  }

  const stats = window.LabEngineLearningStats.getBreakdown();

  body.innerHTML = `
  <div class="lab-learning-breakdown">
    <p style="
      margin:0 0 18px;
      font-weight:800;
      font-size:clamp(20px, 5vw, 28px);
      line-height:1.4;
      word-break:break-word;
    ">
      学習判定：${stats.learningHit}件
    </p>

        <div style="
      display:grid;
      gap:14px;
      font-weight:800;
      font-size:clamp(18px, 4.8vw, 26px);
      line-height:1.45;
    ">
      <div style="
        display:flex;
        justify-content:space-between;
        gap:16px;
        align-items:flex-start;
      ">
        <span style="min-width:0; overflow-wrap:anywhere;">・最終判定マスターヒット</span>
        <span style="white-space:nowrap;">${stats.engineDecisionHit || 0}件</span>
      </div>

      <div style="
        display:flex;
        justify-content:space-between;
        gap:16px;
        align-items:flex-start;
      ">
        <span style="min-width:0; overflow-wrap:anywhere;">・辞書ヒット</span>
        <span style="white-space:nowrap;">${stats.dictionaryHit}件</span>
      </div>

      <div style="
        display:flex;
        justify-content:space-between;
        gap:16px;
        align-items:flex-start;
      ">
        <span style="min-width:0; overflow-wrap:anywhere;">・推論ルールヒット</span>
        <span style="white-space:nowrap;">${stats.inferenceRuleHit}件</span>
      </div>

      <div style="
        display:flex;
        justify-content:space-between;
        gap:16px;
        align-items:flex-start;
      ">
        <span style="min-width:0; overflow-wrap:anywhere;">・未一致</span>
        <span style="white-space:nowrap;">${stats.unmatched}件</span>
      </div>
    </div>

    <hr style="margin:22px 0;">

    <div style="
      display:grid;
      gap:14px;
      font-weight:800;
      font-size:clamp(18px, 4.8vw, 26px);
      line-height:1.45;
    ">
      <div style="
        display:grid;
        grid-template-columns:1em minmax(0,1fr) auto;
        gap:8px;
        align-items:start;
      ">
        <span>・</span>
        <span style="min-width:0; overflow-wrap:anywhere;">読込辞書件数</span>
        <span>${stats.dictionaryCount}件</span>
      </div>

      <div style="
        display:grid;
        grid-template-columns:1em minmax(0,1fr) auto;
        gap:8px;
        align-items:start;
      ">
        <span>・</span>
        <span style="min-width:0; overflow-wrap:anywhere;">読込ルール件数</span>
        <span>${stats.ruleCount}件</span>
      </div>

      <div style="
        display:grid;
        grid-template-columns:1em minmax(0,1fr) auto;
        gap:8px;
        align-items:start;
      ">
        <span>・</span>
        <span style="min-width:0; overflow-wrap:anywhere;">判定対象POI</span>
        <span>${stats.totalJudged}件</span>
      </div>
    </div>

    <p class="note" style="margin-top:22px; overflow-wrap:anywhere;">
      ${stats.diagnosis}
    </p>

    ${
      stats.lastError
        ? `<p class="note warning" style="overflow-wrap:anywhere;">読込エラー：${String(stats.lastError)}</p>`
        : ""
    }
  </div>
`;
}
