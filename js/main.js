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

  if (versionInfo) {
    versionInfo.textContent =
      APP_VERSION + " ℹ";
  }
});
/* =========================
   Campsite Lab Research Engine
   CSV → Existing POI KMZ
========================= */

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

    const points =
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

    await new Promise(resolve => {
      setTimeout(resolve, 1600);
    });

    const sourceName =
      files.map(file => file.name).join(" / ");

    const kmzBlob =
      await createLabExistingPoiKmz(
        points,
        sourceName
      );

    const today =
      new Date().toISOString().slice(0, 10).replace(/-/g, "");

    const guessedParkName =
  guessLabParkName(points);

const parkName =
  sanitizeFileNamePart(guessedParkName);

const downloadName =
  `Lab_${parkName}_${today}.kmz`;

    downloadBlob(
      kmzBlob,
      downloadName
    );

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
          ファイル名：${escapeHtml(downloadName)}<br>
          投入CSV：${files.length}件<br>
          読み込みPOI：${allPoints.length}件<br>
          重複削除：${dedupeResult.removed}件<br>
          出力POI：${points.length}件<br><br>
          このKMZを保存して、Campsite Labの研究アーカイブへ登録してください。
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
function getLabPoiCategoryLabel(name = "") {
  const labels = [];

  if (isRestPoi(name)) labels.push("休憩");
  if (isStayPoi(name)) labels.push("滞在");
  if (isLoopPoi(name)) labels.push("回遊");
  if (isCautionPoi(name)) labels.push("注意");

  return labels.length
    ? labels.join("・")
    : "未分類";
}
function getLabPoiStyleId(name = "") {
  /*
    注意系は最優先。
    休憩にも見えるけど駐車場・階段・水辺などなら赤にする。
  */
  if (isCautionPoi(name)) {
    return "labCautionPoi";
  }

  if (isRestPoi(name)) {
    return "labRestPoi";
  }

  if (isStayPoi(name)) {
    return "labStayPoi";
  }

  if (isLoopPoi(name)) {
    return "labLoopPoi";
  }

  return "labUnknownPoi";
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
  const placemarks =
    points.map((p, index) => {
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

      const rest =
        isRestPoi(rawName) ? "○" : "×";

      const stay =
        isStayPoi(rawName) ? "○" : "×";

      const loop =
        isLoopPoi(rawName) ? "○" : "×";

      const caution =
        isCautionPoi(rawName) ? "○" : "×";

      const categoryLabel =
        getLabPoiCategoryLabel(rawName);
const styleId =
  getLabPoiStyleId(rawName);
      return `
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
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>Campsite Lab Research KMZ</name>

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

  ${placemarks}
</Document>
</kml>`;
}
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