window.APP_VERSION = "v6.1.0";
window.APP_UPDATED = "2026-06-15";
window.ENABLE_QUIZ = true;
window.QUIZ_VERSION = "beta1";
const ADMIN_CODE = "she1ep";

window._layerPoints = {};

let distanceData = {
  existing: [],
  add: []
};
/* パスコード入力を半角英数字だけに制限 */
function sanitizePasscodeInput(input) {
  input.value = input.value.replace(/[^A-Za-z0-9]/g, "");
}

function checkAccessCode() {
  const input = document.getElementById("accessCodeInput");
  const error = document.getElementById("loginError");
  const loginScreen = document.getElementById("loginScreen");
  const splashScreen = document.getElementById("splashScreen");

  if (input.value.trim() === "CA2026") {
    error.textContent = "";
    input.blur();

    document.body.classList.add("opening-mode");

loginScreen.remove();
splashScreen.classList.add("show");

    const loginSound = document.getElementById("loginSound");
    loginSound.currentTime = 0;
    loginSound.volume = 0.08;

    setTimeout(() => {
      loginSound.play().catch(() => {});
    }, 80);

    setTimeout(function () {
  splashScreen.remove();
  showOpeningScreen();
}, 1600);
  } else {
    error.textContent = "パスコードが違います";
  }
}


function openAdminLogin() {
  const modal = document.getElementById("adminLoginModal");
  const input = document.getElementById("adminCodeInput");
  const error = document.getElementById("adminLoginError");

  if (!modal) {
    alert("管理者ログイン画面が見つかりません");
    return;
  }

  if (error) error.textContent = "";
  if (input) input.value = "";

  modal.style.display = "flex";

  setTimeout(() => {
    if (input) input.focus();
  }, 100);
}

function closeAdminLogin() {
  const modal = document.getElementById("adminLoginModal");
  if (modal) {
    modal.style.display = "none";
  }
}

function checkAdminCode() {
  const input = document.getElementById("adminCodeInput");
  const error = document.getElementById("adminLoginError");

  if (!input) return;

  if (input.value.trim() === ADMIN_CODE) {
    if (error) error.textContent = "";
    closeAdminLogin();

    openTab("admin", null);
      localStorage.removeItem("campsiteAdminUnlocked");
sessionStorage.setItem("campsiteAdminUnlocked", "true");
showAliasReviewAdminBox();

    document.querySelectorAll(".tab-button").forEach(btn => {
      btn.classList.remove("active");
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  } else {
    if (error) error.textContent = "管理者パスコードが違います";
  }
}
document.addEventListener("DOMContentLoaded", function () {

  const accessCodeInput =
    document.getElementById("accessCodeInput");

  if (accessCodeInput) {
    accessCodeInput.addEventListener("keydown", function (e) {

      if (e.key === "Enter") {
  e.preventDefault();
  checkAccessCode();
}

    });
  }

  const adminaccessCodeInput =
    document.getElementById("adminCodeInput");

  if (adminaccessCodeInput) {
    adminaccessCodeInput.addEventListener("keydown", function (e) {

     if (e.key === "Enter") {
  e.preventDefault();
  checkAdminCode();
}

    });
  }
  /*
    iPhone / Chrome 対策:
    KMZ / KML / ZIP は accept 指定があると選択不可になる場合があるため、
    ファイル選択制限は外し、読み込み時にJS側で判定する。
  */
  [
    "distanceFile",
    "adminReviewFile",
    "adminCheckFile",
    "adminDensityFile",
    "capacityFile",
    "circleOnlyFileInput",
    "deduplicatePoiFile"
  ].forEach(id => {
    const input = document.getElementById(id);

    if (input) {
      input.removeAttribute("accept");
    }
  });
  const distanceInput =
  document.getElementById("distanceFile");

if (distanceInput) {
  distanceInput.addEventListener("change", function () {
    const file = distanceInput.files[0];

    if (!file) return;

    const fileName = file.name.toLowerCase();

    if (
      !fileName.endsWith(".kmz") &&
      !fileName.endsWith(".kml") &&
      !fileName.endsWith(".zip")
    ) {
      alert("完成KMZ / KML / ZIP ファイルを選択してください。PDFやJSONは読み込めません。");
      distanceInput.value = "";
      return;
    }

    loadDistanceFile();
  });
}

});

document.addEventListener("click", function (event) {

  const log =
    document.getElementById("updateLog");

  const badge =
    document.querySelector(".version-badge");

  if (!log || log.style.display !== "block") return;

  const clickedInsideLog =
    log.contains(event.target);

  const clickedBadge =
    badge && badge.contains(event.target);

  if (!clickedInsideLog && !clickedBadge) {
    log.style.display = "none";
  }

});
function showOpeningScreen() {
  const opening = document.getElementById("openingScreen");

  if (opening) {
    opening.classList.add("show");
  }
}

function startAdventure() {
  const opening = document.getElementById("openingScreen");

  let targetButton = null;

  document.querySelectorAll(".tab-button").forEach(button => {
    const onclick = button.getAttribute("onclick") || "";

    if (onclick.includes("openTab('tool'")) {
      targetButton = button;
    }
  });

  openTab("tool", targetButton);

  window.scrollTo({
    top: 0,
    behavior: "auto"
  });

  if (opening) {
    opening.style.opacity = "0";
    opening.style.transition = "opacity 0.4s ease";
  }

  setTimeout(() => {
    if (opening) {
      opening.classList.remove("show");
    }

    document.body.classList.remove("opening-mode");

    if (opening) {
      opening.style.opacity = "1";
    }
  }, 400);
}
let openingSceneChanged = false;

function changeOpeningScene() {
  if (openingSceneChanged) return;

  openingSceneChanged = true;

  const left = document.getElementById("openingSceneLeft");
  const right = document.getElementById("openingSceneRight");
  const glow = document.getElementById("sceneMagicGlow");
  const sheepTapArea = document.getElementById("sheepTapArea");
  const toolsArea = document.querySelector(".sign-tools");
  if (!left || !right) return;

  if (glow) {
    glow.classList.remove("play");
    void glow.offsetWidth;
    glow.classList.add("play");
  }

  left.classList.remove("active");

  setTimeout(() => {
  right.classList.add("active");
  
document
  .querySelector(".opening-scene-wrap")
  .classList.add("is-right");
  if (toolsArea) {
    toolsArea.style.display = "block";
  }
}, 250);

  if (sheepTapArea) {
    sheepTapArea.style.display = "none";
  }
}

function backToOpening() {
  const opening = document.getElementById("openingScreen");
  const left = document.getElementById("openingSceneLeft");
  const right = document.getElementById("openingSceneRight");
  const sheepTapArea = document.getElementById("sheepTapArea");
  const toolsArea = document.querySelector(".sign-tools");
  const glow = document.getElementById("sceneMagicGlow");
const openingWrap = document.querySelector(".opening-scene-wrap");
openingWrap?.classList.remove("is-right");

document.getElementById("soulIcon")?.classList.remove("show");
resetCampsiteLabTab();
  if (!opening) return;

  openingSceneChanged = false;

  if (left) left.classList.add("active");
  if (right) right.classList.remove("active");
  if (sheepTapArea) sheepTapArea.style.display = "block";
  if (toolsArea) toolsArea.style.display = "none";
  /* オープニングタブで戻った時は光演出を消す */
  if (glow) glow.classList.remove("play");

  document.body.classList.add("opening-mode");

  opening.style.opacity = "1";
  opening.style.transition = "opacity 0.4s ease";

  opening.classList.add("show");
}
function goOpeningTab(tabId) {
  const opening = document.getElementById("openingScreen");

  let targetButton = null;

  document.querySelectorAll(".tab-button").forEach(button => {
    const onclick = button.getAttribute("onclick") || "";

    if (onclick.includes(`openTab('${tabId}'`)) {
      targetButton = button;
    }
  });

  /*
    オープニングを表示したまま、先に裏側のタブを切り替える。
    opening-mode中は .container が非表示なので、前のタブは見えない。
  */
  document.body.classList.add("opening-mode");

  if (opening) {
    opening.classList.add("show");
    opening.style.opacity = "1";
    opening.style.transition = "none";
  }

  openTab(tabId, targetButton);

  window.scrollTo({
    top: 0,
    behavior: "auto"
  });

  /*
    フェードさせずに閉じる。
    これで前回のタブが一瞬見える現象を防ぐ。
  */
  setTimeout(() => {
    if (opening) {
      opening.classList.remove("show");
      opening.style.opacity = "1";
      opening.style.transition = "none";
    }

    document.body.classList.remove("opening-mode");
  }, 120);
}
function showSoulIcon(){
  const icon = document.getElementById("soulIcon");
  if (!icon) return;

  icon.classList.add("show");

  setTimeout(() => {
    icon.classList.remove("show");
  }, 2500);
}
/* =========================
   Campsite Lab Secret Tab
========================= */

/* オープニングの看板からLabへ入る時だけタブを解放する */
function openCampsiteLab() {
  const labTab =
    document.querySelector(".lab-secret-tab");

  if (labTab) {
    labTab.classList.add("show");
  }

  goOpeningTab("parts");

  /*
    goOpeningTab() では看板側のbuttonを渡していないため、
    表示後にLabタブをactiveにする
  */
  setTimeout(() => {
    document.querySelectorAll(".tab-button").forEach(button => {
      button.classList.remove("active");
    });

    if (labTab) {
      labTab.classList.add("active");
    }

    if (isCampsiteAdminUnlocked()) {
      showAliasReviewAdminBox();
    } else {
      hideAliasReviewAdminBox();
    }
  }, 140);
}
/* オープニングへ戻った時にLabタブを再び隠す */
function resetCampsiteLabTab() {
  const labTab =
    document.querySelector(".lab-secret-tab");

  if (!labTab) {
    return;
  }

  labTab.classList.remove("show");
  labTab.classList.remove("active");
}
/* =========================
   おかえりなさいモーダル
========================= */

function openReturnModal() {
  const modal = document.getElementById("returnModal");

  if (!modal) {
    return;
  }

  const sheepImage =
    modal.querySelector(".return-modal-sheep");

  if (
    sheepImage &&
    !sheepImage.getAttribute("src")
  ) {
    sheepImage.setAttribute(
      "src",
      sheepImage.dataset.src
    );
  }

  modal.style.display = "flex";

  requestAnimationFrame(() => {
    modal.classList.add("show");
  });
}

function closeReturnModal() {
  const modal = document.getElementById("returnModal");

  if (!modal) {
    return;
  }

  modal.classList.remove("show");
  modal.style.display = "none";
}

function closeReturnModalByBackdrop(event) {
  if (event.target.id === "returnModal") {
    closeReturnModal();
  }
}

function goFromReturnModal(tabId) {
  closeReturnModal();
  openTab(tabId);
}

/* =========================
   KMZ生成完了モーダル
========================= */

function openKmzCompleteModal() {
  const modal = document.getElementById("kmzCompleteModal");

  if (!modal) {
    return;
  }

  modal.style.display = "flex";

  requestAnimationFrame(() => {
    modal.classList.add("show");
  });
}

function closeKmzCompleteModal() {
  const modal = document.getElementById("kmzCompleteModal");

  if (!modal) {
    return;
  }

  modal.classList.remove("show");
  modal.style.display = "none";
}

function closeKmzCompleteModalByBackdrop(event) {
  if (event.target.id === "kmzCompleteModal") {
    closeKmzCompleteModal();
  }
}

function openGoogleMyMaps() {

  setWorkflowStep("mymaps");

  window.open(
    "https://www.google.com/maps/d/",
    "_blank"
  );
}
function toggleVersionHistory() {
  const modal =
    document.getElementById("versionHistoryModal");

  modal.style.display =
    modal.style.display === "flex"
      ? "none"
      : "flex";
}
document.addEventListener("DOMContentLoaded", () => {
  const versionInfo =
    document.getElementById("versionInfo");

  if (typeof setupAliasReviewAdminUi === "function") {
    setupAliasReviewAdminUi();
  }

  localStorage.removeItem("campsiteAdminUnlocked");

  if (typeof hideAliasReviewAdminBox === "function") {
    hideAliasReviewAdminBox();
  }

  if (versionInfo) {
    versionInfo.textContent =
      APP_VERSION + " ℹ";
  }
});
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
  console.log("Lab Engine POI分類完了:", points);
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

pendingLabResearchReport = {
  parkName,
  csvCount: files.length,
  loadedPoiCount: allPoints.length,
  dedupedPoiCount: points.length,
  removedDuplicateCount: dedupeResult.removed,
  unknownPoiCount,
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
未分類POI：${unknownPoiCount}件<br><br>
まだSupabaseには送信されていません。<br>
研究KMZを保存して会長のDiscord DMへ送り、一言メモを書いてから「研究結果を送信」を押してください。
        </div>
      `;
    }

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

function getAliasReviewCategoryLabel(category) {
  const labels = {
    REST: "休憩",
    STAY: "滞在",
    LOOP: "回遊",
    CAUTION: "注意",
    EXCLUDE: "除外",
    HOLD: "保留"
  };

  return labels[category] || category;
}

function getAliasReviewStatusForCategory(category) {
  if (category === "EXCLUDE") {
    return "excluded";
  }

  if (category === "HOLD") {
    return "hold";
  }

  return "reviewed";
}

function setAliasReviewStatus(message, type = "info") {
  const status = document.getElementById("aliasReviewStatus");

  if (!status) {
    return;
  }

  const color =
    type === "error"
      ? "#fecaca"
      : type === "success"
        ? "#bbf7d0"
        : "#cbd5e1";

  status.innerHTML = `
    <div style="color:${color};">
      ${escapeHtml(message)}
    </div>
  `;
}

async function fetchAliasReviewRemainingCount() {
  if (!window.campsiteSupabase) {
    return 0;
  }

  const { count, error } = await window.campsiteSupabase
    .from("alias_review_queue")
    .select("id", {
      count: "exact",
      head: true
    })
    .eq("review_status", "pending");

  if (error) {
    console.error("未分類レビュー残数取得エラー:", error);
    return 0;
  }

  return count || 0;
}

async function fetchNextAliasReviewItem() {
  if (!window.campsiteSupabase) {
    setAliasReviewStatus("Supabaseに接続されていません。", "error");
    return null;
  }

  const { data, error } = await window.campsiteSupabase
    .from("alias_review_queue")
    .select(`
      id,
      poi_name,
      normalized_name,
      count,
      sample_lat,
      sample_lng,
      source,
      review_status,
      suggested_category,
      review_note,
      created_at
    `)
    .eq("review_status", "pending")
    .order("count", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(30);

  if (error) {
    console.error("未分類レビュー取得エラー:", error);
    setAliasReviewStatus("未分類POIの取得に失敗しました。", "error");
    return null;
  }

  const items = Array.isArray(data) ? data : [];

  if (!items.length) {
    return null;
  }

  const nextItem = items.find(item => {
    return !aliasReviewSkippedIds.includes(String(item.id));
  });

  if (nextItem) {
    return nextItem;
  }

  /*
    30件すべてを「あとで見る」した場合は、
    スキップリストを一度リセットして先頭に戻る。
  */
  aliasReviewSkippedIds = [];

  return items[0];
}

function renderAliasReviewItem(item, remainingCount) {
  const card = document.getElementById("aliasReviewCard");
  const nameEl = document.getElementById("aliasReviewPoiName");
  const metaEl = document.getElementById("aliasReviewMeta");
  const mapLink = document.getElementById("aliasReviewMapLink");
  const noteEl = document.getElementById("aliasReviewNote");
  const remainingEl = document.getElementById("aliasReviewRemainingCount");

  if (remainingEl) {
    remainingEl.textContent = `残り ${remainingCount}件`;
  }

  if (!item) {
    currentAliasReviewItem = null;

    if (card) {
      card.style.display = "none";
    }

    setAliasReviewStatus("レビュー待ちの未分類POIはありません。", "success");
    return;
  }

  currentAliasReviewItem = item;

  if (card) {
    card.style.display = "block";
  }

  if (nameEl) {
    nameEl.textContent = item.poi_name || "名称なし";
  }

  if (metaEl) {
    metaEl.innerHTML = `
      出現数：${escapeHtml(item.count || 1)}件<br>
      正規化名：${escapeHtml(item.normalized_name || "-")}<br>
      source：${escapeHtml(item.source || "-")}
    `;
  }

  if (noteEl) {
    noteEl.value = "";
  }

  const lat = Number(item.sample_lat);
  const lng = Number(item.sample_lng);

  if (
    mapLink &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    mapLink.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    mapLink.style.display = "inline-flex";
  } else if (mapLink) {
    mapLink.href = "#";
    mapLink.style.display = "none";
  }

  setAliasReviewStatus("分類ボタンを押すと保存して次へ進みます。");
}

async function loadAliasReviewCard() {
  if (aliasReviewIsLoading) {
    return;
  }

  aliasReviewIsLoading = true;

  setAliasReviewStatus("未分類POIを読み込み中です…");

  try {
    const remainingCount =
      await fetchAliasReviewRemainingCount();

    const item =
      await fetchNextAliasReviewItem();

    renderAliasReviewItem(item, remainingCount);
  } catch (error) {
    console.error(error);
    setAliasReviewStatus("未分類レビューの読み込みに失敗しました。", "error");
  } finally {
    aliasReviewIsLoading = false;
  }
}

async function submitAliasReview(category) {
  if (!currentAliasReviewItem) {
    alert("レビュー対象がありません。");
    return;
  }

  if (!window.campsiteSupabase) {
    alert("Supabaseに接続されていません。");
    return;
  }

  const noteEl = document.getElementById("aliasReviewNote");
  const reviewNote = String(noteEl?.value || "").trim();

  const reviewStatus =
    getAliasReviewStatusForCategory(category);

  setAliasReviewStatus(
    `${getAliasReviewCategoryLabel(category)}として保存中です…`
  );

  const updatePayload = {
    review_status: reviewStatus,
    suggested_category: category,
    review_note: reviewNote,
    reviewed_at: new Date().toISOString(),
    reviewed_by: "会長"
  };

  const { error } = await window.campsiteSupabase
  .from("alias_review_queue")
  .update(updatePayload)
  .eq("id", currentAliasReviewItem.id)
  .eq("review_status", "pending");

  if (error) {
    console.error("未分類レビュー保存エラー:", error);
    setAliasReviewStatus("レビュー結果の保存に失敗しました。", "error");
    return;
  }

  setAliasReviewStatus(
    `${getAliasReviewCategoryLabel(category)}として保存しました。次を読み込みます。`,
    "success"
  );

  await loadAliasReviewCard();
  await loadAliasReviewHistory();
  await loadAliasDictionaryCandidates();
}
/* =========================
   CAMP-102: レビュー履歴表示
========================= */

async function loadAliasReviewHistory() {
  const list =
    document.getElementById("aliasReviewHistoryList");

  if (!list) {
    return;
  }

  if (!window.campsiteSupabase) {
    list.innerHTML = `
      <div class="alias-review-history-empty">
        Supabaseに接続されていません。
      </div>
    `;
    return;
  }

  list.innerHTML = `
    <div class="alias-review-history-empty">
      レビュー履歴を読み込み中...
    </div>
  `;

  const { data, error } = await window.campsiteSupabase
    .from("alias_review_queue")
    .select(`
      id,
      poi_name,
      normalized_name,
      suggested_category,
      review_status,
      review_note,
      reviewed_by,
      reviewed_at
    `)
    .not("reviewed_at", "is", null)
    .order("reviewed_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("レビュー履歴取得エラー:", error);

    list.innerHTML = `
      <div class="alias-review-history-empty">
        レビュー履歴の取得に失敗しました。
      </div>
    `;
    return;
  }

  if (!data || !data.length) {
    list.innerHTML = `
      <div class="alias-review-history-empty">
        まだレビュー履歴はありません。
      </div>
    `;
    return;
  }

  list.innerHTML = data.map(item => {
    const label =
      getAliasReviewCategoryLabel(
        item.suggested_category || item.review_status
      );

    const reviewedAt =
      formatAliasReviewDate(item.reviewed_at);

    const name =
      item.poi_name ||
      item.normalized_name ||
      "名称なし";

    const note =
      item.review_note
        ? `<div class="alias-review-history-note">メモ：${escapeHtml(item.review_note)}</div>`
        : "";

    return `
      <div class="alias-review-history-item">
        <div class="alias-review-history-main">
          <div class="alias-review-history-name">
            ${escapeHtml(name)}
          </div>

          <div class="alias-review-history-result">
            → ${escapeHtml(label)}
          </div>
        </div>

        <div class="alias-review-history-meta">
          ${escapeHtml(reviewedAt)}
          ${
            item.reviewed_by
              ? ` / ${escapeHtml(item.reviewed_by)}`
              : ""
          }
        </div>

        ${note}
      </div>
    `;
  }).join("");
}

function formatAliasReviewDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");

  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}
/* =========================
   CAMP-104: 辞書反映候補一覧
========================= */

async function loadAliasDictionaryCandidates() {
  const list =
    document.getElementById("aliasDictionaryCandidateList");

  if (!list) {
    return;
  }

  if (!window.campsiteSupabase) {
    list.innerHTML = `
      <div class="alias-dictionary-candidate-empty">
        Supabaseに接続されていません。
      </div>
    `;
    return;
  }

  list.innerHTML = `
    <div class="alias-dictionary-candidate-empty">
      辞書反映候補を読み込み中...
    </div>
  `;

  const { data, error } = await window.campsiteSupabase
  .from("alias_review_queue")
  .select(`
      id,
      poi_name,
      normalized_name,
      suggested_category,
      review_status,
      review_note,
      reviewed_by,
      reviewed_at,
      dictionary_status,
      dictionary_reviewed_at,
      dictionary_reviewed_by
    `)
  .eq("review_status", "reviewed")
  .order("reviewed_at", { ascending: false })
  .limit(50);

  if (error) {
    console.error("辞書反映候補取得エラー:", error);

    list.innerHTML = `
      <div class="alias-dictionary-candidate-empty">
        辞書反映候補の取得に失敗しました。
      </div>
    `;
    return;
  }

  const candidates = (data || []).filter(item => {
  return (
    item.suggested_category &&
    item.suggested_category !== "HOLD" &&
    item.suggested_category !== "EXCLUDE" &&
    item.dictionary_status !== "adopted" &&
item.dictionary_status !== "rejected" &&
item.dictionary_status !== "later"
  );
});

  if (!candidates.length) {
    list.innerHTML = `
      <div class="alias-dictionary-candidate-empty">
        まだ辞書反映候補はありません。<br>
        未分類レビューで「休憩・滞在・回遊・注意」に分類すると、ここに表示されます。
      </div>
    `;
    return;
  }

  list.innerHTML = candidates.map(item => {
    const label =
      getAliasReviewCategoryLabel(item.suggested_category);

    const reviewedAt =
      formatAliasReviewDate(item.reviewed_at);

    const name =
      item.poi_name ||
      item.normalized_name ||
      "名称なし";

    const note =
      item.review_note
        ? `<div class="alias-dictionary-candidate-note">メモ：${escapeHtml(item.review_note)}</div>`
        : "";
const dictionaryStatus =
  item.dictionary_status || "none";

const dictionaryStatusLabel = {
  adopted: "採用済み",
  later: "後で確認",
  rejected: "見送り",
  none: "未判断"
}[dictionaryStatus] || "未判断";
    return `
      <div class="alias-dictionary-candidate-item">
        <div class="alias-dictionary-candidate-main">
          <div class="alias-dictionary-candidate-name">
            ${escapeHtml(name)}
          </div>

          <div class="alias-dictionary-candidate-result">
            → ${escapeHtml(label)}
          </div>
        </div>

        <div class="alias-dictionary-candidate-meta">
          ${escapeHtml(reviewedAt)}
          ${
            item.reviewed_by
              ? ` / ${escapeHtml(item.reviewed_by)}`
              : ""
          }
        </div>

                ${note}

        <div class="alias-dictionary-candidate-status">
          辞書判断：${escapeHtml(dictionaryStatusLabel)}
        </div>

        <div class="alias-dictionary-candidate-actions">
          <button
            type="button"
            onclick="updateAliasDictionaryCandidateStatus('${escapeHtml(item.id)}', 'adopted')"
          >
            ✅ 採用
          </button>

          <button
            type="button"
            onclick="updateAliasDictionaryCandidateStatus('${escapeHtml(item.id)}', 'later')"
          >
            🕓 後で確認
          </button>

          <button
            type="button"
            onclick="updateAliasDictionaryCandidateStatus('${escapeHtml(item.id)}', 'rejected')"
          >
            🚫 見送り
          </button>
        </div>
      </div>
    `;
  }).join("");
}
/* =========================
   CAMP-105: 辞書反映候補ステータス管理
========================= */

async function updateAliasDictionaryCandidateStatus(id, status) {
  if (!id) {
    alert("候補IDが取得できませんでした。");
    return;
  }

  if (!window.campsiteSupabase) {
    alert("Supabaseに接続されていません。");
    return;
  }

  const labels = {
    adopted: "採用",
    later: "後で確認",
    rejected: "見送り"
  };

  const label = labels[status] || status;

  const ok = confirm(
    `この候補を「${label}」にしますか？`
  );

  if (!ok) {
    return;
  }

  const { data: item, error: fetchError } =
    await window.campsiteSupabase
      .from("alias_review_queue")
      .select(`
        id,
        poi_name,
        normalized_name,
        suggested_category,
        review_note
      `)
      .eq("id", id)
      .single();

  if (fetchError || !item) {
    console.error("辞書候補取得エラー:", fetchError);
    alert("辞書候補の取得に失敗しました。");
    return;
  }

  if (status === "adopted") {
    const aliasName =
      item.poi_name ||
      item.normalized_name ||
      "";

    const normalizedAlias =
      item.normalized_name ||
      item.poi_name ||
      "";

    const dictionaryMap = {
      REST: {
        dictionary_id: "LAB_REST",
        canonical_name: "休憩"
      },
      STAY: {
        dictionary_id: "LAB_STAY",
        canonical_name: "滞在"
      },
      LOOP: {
        dictionary_id: "LAB_LOOP",
        canonical_name: "回遊"
      },
      CAUTION: {
        dictionary_id: "LAB_CAUTION",
        canonical_name: "注意"
      }
    };

    const dictionary =
      dictionaryMap[item.suggested_category];

    if (!aliasName || !normalizedAlias || !dictionary) {
      alert("辞書登録に必要な情報が不足しています。");
      return;
    }

    const aliasId =
      `ALIAS_${dictionary.dictionary_id}_${Date.now()}`;

    const { error: upsertError } =
      await window.campsiteSupabase
        .from("alias_master")
        .upsert(
          {
            alias_id: aliasId,
            dictionary_id: dictionary.dictionary_id,
            canonical_name: dictionary.canonical_name,
            alias_name: aliasName,
            normalized_alias: normalizedAlias,
            match_type: "exact",
            source_type: "admin_review",
            review_status: "active",
            active: true,
            note: item.review_note || ""
          },
          {
            onConflict: "normalized_alias,dictionary_id"
          }
        );

    if (upsertError) {
  console.error("辞書反映エラー:", upsertError);

  alert(
    "辞書への反映に失敗しました。\n\n" +
    (upsertError.message || JSON.stringify(upsertError))
  );

  return;
}
  }

  const { error } = await window.campsiteSupabase
    .from("alias_review_queue")
    .update({
      dictionary_status: status,
      dictionary_reviewed_at: new Date().toISOString(),
      dictionary_reviewed_by: "会長"
    })
    .eq("id", id);

  if (error) {
    console.error("辞書候補ステータス更新エラー:", error);
    alert("辞書候補ステータスの更新に失敗しました。");
    return;
  }

  if (status === "adopted") {
    alert("辞書に反映しました。");
  }

  await loadAliasDictionaryCandidates();
}

function closeAliasReviewPanel() {
  const panel = document.getElementById("aliasReviewPanel");

  if (panel) {
    panel.style.display = "none";
  }
}

async function skipCurrentAliasReviewItem() {
  if (!currentAliasReviewItem) {
    await loadAliasReviewCard();
    return;
  }

  aliasReviewSkippedIds.push(String(currentAliasReviewItem.id));

  setAliasReviewStatus("この候補をあとで見るにしました。次を読み込みます。");

  await loadAliasReviewCard();
  await loadAliasReviewHistory();
  await loadAliasDictionaryCandidates();
}

function isCampsiteAdminUnlocked() {
  return sessionStorage.getItem("campsiteAdminUnlocked") === "true";
}

function showAliasReviewAdminBox() {
  const box = document.getElementById("aliasReviewAdminBox");

  if (box) {
    box.style.display = "block";
  }
}

function hideAliasReviewAdminBox() {
  const box = document.getElementById("aliasReviewAdminBox");
  const panel = document.getElementById("aliasReviewPanel");

  if (box) {
    box.style.display = "none";
  }

  if (panel) {
    panel.style.display = "none";
  }
}
function setupAliasReviewAdminUi() {
  const toggleButton =
    document.getElementById("aliasReviewToggleButton");

  const closeButton =
    document.getElementById("aliasReviewCloseButton");

  const skipButton =
    document.getElementById("aliasReviewSkipButton");

  const panel =
    document.getElementById("aliasReviewPanel");

  const actionButtons =
    document.querySelectorAll("[data-review-category]");

  if (toggleButton && panel) {
    toggleButton.addEventListener("click", async () => {
      const isHidden =
        panel.style.display === "none" || !panel.style.display;

      panel.style.display = isHidden ? "block" : "none";

      if (isHidden) {
  aliasReviewSkippedIds = [];
  await loadAliasReviewCard();
  await loadAliasReviewHistory();
  await loadAliasDictionaryCandidates();
}
    });
  }

  if (closeButton) {
    closeButton.addEventListener("click", () => {
      closeAliasReviewPanel();
    });
  }

  if (skipButton) {
    skipButton.addEventListener("click", async () => {
      if (aliasReviewIsLoading) {
        return;
      }

      await skipCurrentAliasReviewItem();
    });
  }

  actionButtons.forEach(button => {
    const pressOn = () => {
      button.classList.add("is-pressed");
    };

    const pressOff = () => {
      button.classList.remove("is-pressed");
    };

    button.addEventListener("touchstart", pressOn, {
      passive: true
    });

    button.addEventListener("touchend", pressOff);
    button.addEventListener("touchcancel", pressOff);
    button.addEventListener("mousedown", pressOn);
    button.addEventListener("mouseup", pressOff);
    button.addEventListener("mouseleave", pressOff);

    button.addEventListener("click", async () => {
      const category =
        button.getAttribute("data-review-category");

      if (!category || aliasReviewIsLoading) {
        return;
      }

      await submitAliasReview(category);
    });
  });
}


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
注意：${caution}
  ]]></description>
  <Point>
    <coordinates>${lng},${lat},0</coordinates>
  </Point>
</Placemark>`;

    groups[categoryKey].push(placemark);
  });

  const folders =
    ["rest", "stay", "loop", "caution", "unknown"]
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

function togglePolicyModal() {
  const modal = document.getElementById("policyModal");
  if (!modal) return;

  modal.classList.add("show");
}

function closePolicyModal() {
  const modal = document.getElementById("policyModal");
  if (!modal) return;

  modal.classList.remove("show");
}

document.addEventListener("click", function(event) {
  const modal = document.getElementById("policyModal");

  if (!modal || !modal.classList.contains("show")) {
    return;
  }

  if (event.target.id === "policyModal") {
    closePolicyModal();
  }
});
let labResearchKmzPoints = [];
let labResearchMapInstance = null;
let labResearchLayerGroup = null;
let pendingLabResearchReport = null;

function resetLabResearchKmzOutput() {
  labResearchKmzPoints = [];

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
