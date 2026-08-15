function getUserId() {
  let userId = localStorage.getItem("campsiteUserId");

  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("campsiteUserId", userId);
  }

  return userId;
}
function getJstIsoString(date = new Date()) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);

  return jst
    .toISOString()
    .replace("Z", "+09:00");
}
async function sendAnalytics(data) {
  fetch(
    "https://script.google.com/macros/s/AKfycbxldgzcVeez7AEQk0MXbd569zRIQ_4Z8hHBKrO3lBA9bePX8C3Z5HTqjo9YnbBVTZpl/exec",
    {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    }
  ).catch(() => {});
}
function sendDistanceCheckAnalytics(points, poiVolumeCounts, poiCounts, expansionRate, displayCounts, campsite) {
  const parkName = guessParkNameFromPoints(points);

  sendAnalytics({
    timestamp: getJstIsoString(),
    userId: getUserId(),

    toolVersion: window.APP_VERSION,
    action: "distance_check",

    parkName: parkName,
    parkNameSource: parkName ? "poi_name" : "",

    hasPolygon: window._hasPolygon === true,
    inputType: window._inputType || "unknown",
    deviceType: window.innerWidth <= 720 ? "mobile" : "desktop",

    totalPoiCount: points.length,
    existingPoiCount: poiVolumeCounts.existing,
    addedPoiCount: poiVolumeCounts.added,
    expansionRate: expansionRate,

    pokestopCount: poiCounts.pokestop,
    gymCount: poiCounts.gym,
    powerspotCount: poiCounts.power,

    denseCount: displayCounts.dense,
    stayCount: displayCounts.stay,
    lightCount: displayCounts.light,

    trafficOk: campsite.trafficOk,

    hasOpenSpace:
      document.getElementById("hasOpenSpace")?.checked,

    hasLoopRoute:
      document.getElementById("hasLoopRoute")?.checked,

    hasWaitingSpace:
      document.getElementById("hasWaitingSpace")?.checked,

    score: campsite.score,
    rank: campsite.rank,
    summary: campsite.summary
  });
}

/* =========================
   通常ログイン保持 / 初期表示 / 簡易ログアウト

   ログイン状態だけを最大3日間保持し、前回開いていた機能は復元しない。
   再起動時は毎回「事前準備 > 使い方」から始める。
========================= */
const CAMPSITE_ACCESS_UNLOCKED_KEY = "campsiteAccessUnlocked";
const CAMPSITE_ACCESS_LOGIN_AT_KEY = "campsiteAccessLoginAt";
const CAMPSITE_ACCESS_TTL_MS = 3 * 24 * 60 * 60 * 1000;
/* 旧バージョンが保存した最後のタブを削除するためだけ残す */
const CAMPSITE_LAST_TAB_KEY = "campsiteLastTab";

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

function clearCampsiteRememberedAccess() {
  try {
    localStorage.removeItem(CAMPSITE_ACCESS_UNLOCKED_KEY);
    localStorage.removeItem(CAMPSITE_ACCESS_LOGIN_AT_KEY);
  } catch (_) {}
}

function expireCampsiteAccessNow() {
  clearCampsiteRememberedAccess();
  window.location.reload();
}

function scheduleCampsiteAccessExpiry(loginAt) {
  const remainingMs = loginAt + CAMPSITE_ACCESS_TTL_MS - Date.now();

  if (remainingMs <= 0) {
    expireCampsiteAccessNow();
    return;
  }

  window.setTimeout(expireCampsiteAccessNow, remainingMs);
}

function rememberCampsiteAccessAfterLogin() {
  window.setTimeout(() => {
    if (!document.getElementById("loginScreen")) {
      try {
        const loginAt = Date.now();
        localStorage.setItem(CAMPSITE_ACCESS_UNLOCKED_KEY, "true");
        localStorage.setItem(CAMPSITE_ACCESS_LOGIN_AT_KEY, String(loginAt));
        scheduleCampsiteAccessExpiry(loginAt);
      } catch (_) {}
    }
  }, 0);
}

function hasValidRememberedCampsiteAccess() {
  try {
    if (localStorage.getItem(CAMPSITE_ACCESS_UNLOCKED_KEY) !== "true") {
      return false;
    }

    const loginAt = Number(localStorage.getItem(CAMPSITE_ACCESS_LOGIN_AT_KEY));
    const now = Date.now();

    /*
      旧バージョンの期限なしログインには時刻がないため、
      更新後は一度だけ再ログインしてもらい、そこから3日間を数える。
    */
    if (!Number.isFinite(loginAt) || loginAt <= 0 || loginAt > now) {
      clearCampsiteRememberedAccess();
      return false;
    }

    if (now - loginAt >= CAMPSITE_ACCESS_TTL_MS) {
      clearCampsiteRememberedAccess();
      return false;
    }

    scheduleCampsiteAccessExpiry(loginAt);
    return true;
  } catch (_) {
    return false;
  }
}

function resetCampsiteStartupView() {
  try {
    localStorage.removeItem(CAMPSITE_LAST_TAB_KEY);
  } catch (_) {}

  const opening = document.getElementById("openingScreen");

  if (opening) {
    opening.classList.remove("show");
    opening.style.opacity = "1";
  }

  document.body.classList.remove("opening-mode");

  document.querySelectorAll(".tab-content").forEach(tab => {
    tab.classList.remove("active");
  });

  document.querySelectorAll(".tab-button").forEach(button => {
    button.classList.remove("active");
  });

  document.getElementById("howto")?.classList.add("active");

  const manualButton = document.querySelector(
    ".dashboard-prep .tab-button[onclick*=\"openTab('howto'\"]"
  );
  manualButton?.classList.add("active");

  if (typeof updateWorkflowStep === "function") {
    updateWorkflowStep("howto");
  }

  /*
    dashboard-folders.js が事前準備を details 化した後に実行する。
    Safari の前回スクロール位置の復元もここで上書きする。
  */
  window.setTimeout(() => {
    window.requestAnimationFrame(() => {
      const prepFold = document.querySelector(
        'details[data-dashboard-fold-enhanced="prep"]'
      );
      const prepTarget = prepFold || document.querySelector(".dashboard-prep");

      if (prepFold) {
        prepFold.open = true;
      }

      if (!prepTarget) {
        window.scrollTo({ top: 0, behavior: "auto" });
        return;
      }

      const targetTop =
        prepTarget.getBoundingClientRect().top + window.scrollY - 12;

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "auto"
      });
    });
  }, 0);
}

function logoutCampsiteOnThisDevice() {
  clearCampsiteRememberedAccess();

  try {
    localStorage.removeItem(CAMPSITE_LAST_TAB_KEY);
    sessionStorage.removeItem("campsiteAdminUnlocked");
  } catch (_) {}

  window.location.reload();
}

function addCampsiteLogoutButton() {
  if (document.getElementById("campsiteLogoutButton")) return;

  const button = document.createElement("button");
  button.id = "campsiteLogoutButton";
  button.type = "button";
  button.textContent = "ログアウト";
  button.setAttribute("aria-label", "この端末のログイン情報を消す");
  button.style.position = "fixed";
  button.style.top = "calc(10px + env(safe-area-inset-top))";
  button.style.right = "12px";
  button.style.zIndex = "4500";
  button.style.padding = "7px 11px";
  button.style.border = "1px solid rgba(148,163,184,.35)";
  button.style.borderRadius = "999px";
  button.style.background = "rgba(15,23,42,.82)";
  button.style.color = "#cbd5e1";
  button.style.fontSize = "12px";
  button.style.fontWeight = "700";
  button.style.cursor = "pointer";
  button.style.backdropFilter = "blur(8px)";
  button.addEventListener("click", logoutCampsiteOnThisDevice);

  document.body.appendChild(button);
}

document.addEventListener("DOMContentLoaded", () => {
  const accessRemembered = hasValidRememberedCampsiteAccess();

  if (accessRemembered) {
    document.getElementById("loginScreen")?.remove();
    document.getElementById("splashScreen")?.remove();
    addCampsiteLogoutButton();

    resetCampsiteStartupView();

    return;
  }

  document
    .getElementById("loginButton")
    ?.addEventListener("click", () => {
      rememberCampsiteAccessAfterLogin();
      window.setTimeout(addCampsiteLogoutButton, 0);
    });

  document
    .getElementById("accessCodeInput")
    ?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        rememberCampsiteAccessAfterLogin();
        window.setTimeout(addCampsiteLogoutButton, 0);
      }
    });
});
