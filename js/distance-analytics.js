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
   通常ログイン保持 / 前回タブ復元 / 簡易ログアウト
========================= */
const CAMPSITE_ACCESS_UNLOCKED_KEY = "campsiteAccessUnlocked";
const CAMPSITE_LAST_TAB_KEY = "campsiteLastTab";

function rememberCampsiteAccessAfterLogin() {
  window.setTimeout(() => {
    if (!document.getElementById("loginScreen")) {
      try {
        localStorage.setItem(CAMPSITE_ACCESS_UNLOCKED_KEY, "true");
      } catch (_) {}
    }
  }, 0);
}

function rememberCampsiteTab(tabId) {
  if (!tabId || tabId === "admin") return;

  const target = document.getElementById(tabId);
  if (!target || !target.classList.contains("tab-content")) return;

  try {
    localStorage.setItem(CAMPSITE_LAST_TAB_KEY, tabId);
  } catch (_) {}
}

function getRememberedCampsiteTab() {
  try {
    const tabId = localStorage.getItem(CAMPSITE_LAST_TAB_KEY);

    if (!tabId || tabId === "admin") return "";

    const target = document.getElementById(tabId);
    if (!target || !target.classList.contains("tab-content")) return "";

    return tabId;
  } catch (_) {
    return "";
  }
}

function restoreRememberedCampsiteTab() {
  const tabId = getRememberedCampsiteTab();
  if (!tabId || typeof openTab !== "function") return false;

  const opening = document.getElementById("openingScreen");

  if (opening) {
    opening.classList.remove("show");
    opening.style.opacity = "1";
  }

  document.body.classList.remove("opening-mode");

  let targetButton = null;
  document.querySelectorAll(".tab-button").forEach(button => {
    const onclick = button.getAttribute("onclick") || "";
    if (onclick.includes(`openTab('${tabId}'`)) {
      targetButton = button;
    }
  });

  openTab(tabId, targetButton);
  window.scrollTo({ top: 0, behavior: "auto" });
  return true;
}

function logoutCampsiteOnThisDevice() {
  try {
    localStorage.removeItem(CAMPSITE_ACCESS_UNLOCKED_KEY);
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

/* tabs.js の既存 openTab を壊さず、公開タブだけ記憶する */
if (typeof openTab === "function") {
  const originalOpenTab = openTab;

  openTab = function(tabId, button) {
    const result = originalOpenTab(tabId, button);
    rememberCampsiteTab(tabId);
    return result;
  };
}

document.addEventListener("DOMContentLoaded", () => {
  let accessRemembered = false;

  try {
    accessRemembered =
      localStorage.getItem(CAMPSITE_ACCESS_UNLOCKED_KEY) === "true";
  } catch (_) {}

  if (accessRemembered) {
    document.getElementById("loginScreen")?.remove();
    document.getElementById("splashScreen")?.remove();
    addCampsiteLogoutButton();

    if (!restoreRememberedCampsiteTab()) {
      document.body.classList.add("opening-mode");

      if (typeof showOpeningScreen === "function") {
        showOpeningScreen();
      }
    }

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