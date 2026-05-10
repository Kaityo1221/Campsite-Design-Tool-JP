window.ENABLE_QUIZ = true;
window.QUIZ_VERSION = "beta2";
const ADMIN_PASSWORD = "she1ep";

window._layerPoints = {};

let distanceData = {
  existing: [],
  add: []
};

function toggleUpdateLog(event) {
  if (event) {
    event.stopPropagation();
  }

  const log = document.getElementById("updateLog");

  if (!log) {
    alert("更新履歴が見つかりません");
    return;
  }

  log.style.display =
    log.style.display === "block" ? "none" : "block";
}

function toggleRenameGuide() {
  const guide = document.getElementById("renameGuide");

  guide.style.display =
    guide.style.display === "block" ? "none" : "block";
}

function openTab(tabId, button) {
  document.querySelectorAll(".tab-content").forEach(tab => {
    tab.classList.remove("active");
  });

  document.querySelectorAll(".tab-button").forEach(btn => {
    btn.classList.remove("active");
  });

  const targetTab = document.getElementById(tabId);

  if (targetTab) {
    targetTab.classList.add("active");
  }

  if (button && button.classList) {
    button.classList.add("active");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}
function checkPassword() {
  const input = document.getElementById("passwordInput");
  const error = document.getElementById("loginError");
  const loginScreen = document.getElementById("loginScreen");
  const splashScreen = document.getElementById("splashScreen");

  if (input.value.trim() === "CA2026") {
    error.textContent = "";
    input.blur();

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
    }, 1400);

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