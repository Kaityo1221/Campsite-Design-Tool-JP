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

/* ブラウザ更新後も通常ログイン状態を維持する */
const CAMPSITE_ACCESS_UNLOCKED_KEY = "campsiteAccessUnlocked";

function rememberCampsiteAccessAfterLogin() {
  window.setTimeout(() => {
    if (!document.getElementById("loginScreen")) {
      try {
        localStorage.setItem(CAMPSITE_ACCESS_UNLOCKED_KEY, "true");
      } catch (_) {}
    }
  }, 0);
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
    document.body.classList.add("opening-mode");

    if (typeof showOpeningScreen === "function") {
      showOpeningScreen();
    }

    return;
  }

  document
    .getElementById("loginButton")
    ?.addEventListener("click", rememberCampsiteAccessAfterLogin);

  document
    .getElementById("accessCodeInput")
    ?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        rememberCampsiteAccessAfterLogin();
      }
    });
});