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
