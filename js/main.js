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