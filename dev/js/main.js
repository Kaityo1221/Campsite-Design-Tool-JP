window.ENABLE_QUIZ = true;
window.QUIZ_VERSION = "beta2";
const ADMIN_PASSWORD = "she1ep";

window._layerPoints = {};

let distanceData = {
  existing: [],
  add: []
};


function checkPassword() {
  const input = document.getElementById("passwordInput");
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
  const input = document.getElementById("adminPasswordInput");
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

function checkAdminPassword() {
  const input = document.getElementById("adminPasswordInput");
  const error = document.getElementById("adminLoginError");

  if (!input) return;

  if (input.value.trim() === ADMIN_PASSWORD) {
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

  const passwordInput =
    document.getElementById("passwordInput");

  if (passwordInput) {
    passwordInput.addEventListener("keydown", function (e) {

      if (e.key === "Enter") {
        e.preventDefault();
        checkPassword();
      }

    });
  }

  const adminPasswordInput =
    document.getElementById("adminPasswordInput");

  if (adminPasswordInput) {
    adminPasswordInput.addEventListener("keydown", function (e) {

      if (e.key === "Enter") {
        e.preventDefault();
        checkAdminPassword();
      }

    });
  }

  const distanceInput =
    document.getElementById("distanceFile");

  if (distanceInput) {
    distanceInput.addEventListener(
      "change",
      loadDistanceFile
    );
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
    先に裏側のタブを切り替える。
    opening-mode中は.containerが非表示なので、切り替え途中は見えない。
  */
  openTab(tabId, targetButton);

  window.scrollTo({
    top: 0,
    behavior: "auto"
  });

  if (opening) {
    opening.style.opacity = "0";
    opening.style.transition = "opacity 0.35s ease";
  }

  setTimeout(() => {
    if (opening) {
      opening.classList.remove("show");
    }

    document.body.classList.remove("opening-mode");

    if (opening) {
      opening.style.opacity = "1";
    }
  }, 350);
}