function toggleUpdateLog(event) {
  if (event) {
    event.stopPropagation();
  }

  const log = document.getElementById("updateLog");

  if (!log) {
    alert("更新履歴が見つかりません");
    return;
  }

  log.style.display = log.style.display === "block" ? "none" : "block";
}
  function toggleRenameGuide() {
  const guide = document.getElementById("renameGuide");
  guide.style.display = guide.style.display === "block" ? "none" : "block";
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

const ADMIN_PASSWORD = "she1ep";
document.addEventListener("DOMContentLoaded", function () {
  const passwordInput = document.getElementById("passwordInput");

  if (passwordInput) {
    passwordInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        checkPassword();
      }
    });
  }

  const adminPasswordInput = document.getElementById("adminPasswordInput");

  if (adminPasswordInput) {
    adminPasswordInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        checkAdminPassword();
      }
    });
  }
 const distanceInput = document.getElementById("distanceFile");

  if (distanceInput) {
    distanceInput.addEventListener("change", loadDistanceFile);
  }
});
document.addEventListener("click", function (event) {
  const log = document.getElementById("updateLog");
  const badge = document.querySelector(".version-badge");

  if (!log || log.style.display !== "block") return;

  const clickedInsideLog = log.contains(event.target);
  const clickedBadge = badge && badge.contains(event.target);

  if (!clickedInsideLog && !clickedBadge) {
    log.style.display = "none";
  }
});

