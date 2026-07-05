/*
  Lab Street View URL Preview / No API
  - Google Maps JavaScript API は使わない
  - KMZ / KML のルートを一覧化し、選択したルートでGoogle Maps URLsのStreet Viewリンクを生成する
  - stops ピンが近い地点では説明カードに表示する
*/

(function () {
  const state = {
  routes: [],
  selectedRouteIndex: 0,
  route: [],
  stops: [],
  points: [],
  currentIndex: 0,
  viewerWindow: null,
  map: null,
  routeLayer: null,
  markerLayer: null,
  currentMarker: null
};

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(message, type = "") {
    const el = $("labStreetViewStatus");
    if (!el) return;
    el.className = `lab-streetview-status ${type}`.trim();
    el.textContent = message;
  }

  function setSummary(html) {
    const el = $("labStreetViewSummary");
    if (el) el.innerHTML = html || "";
  }

  function setProgress() {
    const el = $("labStreetViewProgress");
    if (!el) return;

    if (!state.points.length) {
      el.textContent = "- / -";
      return;
    }

    el.textContent = `${state.currentIndex + 1} / ${state.points.length}`;
  }

  function enableButtons(enabled) {
    const ids = [
  "labStreetViewStartButton",
  "labStreetViewStepButton",
  "labStreetViewPrevButton",
  "labStreetViewStopButton"
];

    ids.forEach((id) => {
      const el = $(id);
      if (el) el.disabled = !enabled;
    });
  }

  function enableRouteSelect(enabled) {
    const select = $("labStreetViewRouteSelect");
    if (select) select.disabled = !enabled;
  }

  async function readKmlText(file) {
    const name = file.name.toLowerCase();

    if (name.endsWith(".kml")) {
      return await file.text();
    }

    if (!window.JSZip) {
      throw new Error("JSZipが読み込まれていません。KMZを読むにはJSZipが必要です。");
    }

    const zip = await JSZip.loadAsync(file);
    const kmlEntry = Object.values(zip.files).find((entry) =>
      !entry.dir && entry.name.toLowerCase().endsWith(".kml")
    );

    if (!kmlEntry) {
      throw new Error("KMZ / ZIP内にKMLが見つかりませんでした。");
    }

    return await kmlEntry.async("text");
  }

  function textOf(node, selector) {
    const found = node.querySelector(selector);
    return found ? found.textContent.trim() : "";
  }

  function folderNameOf(placemark) {
    let parent = placemark.parentElement;

    while (parent) {
      if (parent.tagName && parent.tagName.toLowerCase().endsWith("folder")) {
        return textOf(parent, "name");
      }
      parent = parent.parentElement;
    }

    return "";
  }

  function parseCoordinates(text) {
    return text
      .trim()
      .split(/\s+/)
      .map((pair) => {
        const [lng, lat] = pair.split(",").map(Number);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return null;
        }

        return { lat, lng };
      })
      .filter(Boolean);
  }

  function parseKml(kmlText) {
    const doc = new DOMParser().parseFromString(kmlText, "application/xml");
    const parseError = doc.querySelector("parsererror");

    if (parseError) {
      throw new Error("KMLの読み込みに失敗しました。");
    }

    const placemarks = Array.from(doc.getElementsByTagName("Placemark"));
    const routes = [];
    const stops = [];

    placemarks.forEach((pm, index) => {
      const name = textOf(pm, "name") || `ルート${index + 1}`;
      const desc = textOf(pm, "description");
      const folder = folderNameOf(pm);
      const folderLower = folder.toLowerCase();

      const line = pm.getElementsByTagName("LineString")[0];
      const point = pm.getElementsByTagName("Point")[0];

      if (line) {
        const coordsNode = line.getElementsByTagName("coordinates")[0];
        const coords = coordsNode ? parseCoordinates(coordsNode.textContent) : [];

        if (coords.length >= 2) {
          routes.push({
            name,
            folder,
            coords,
            distance: routeLengthMeters(coords)
          });
        }
      }

      if (point) {
        const coordsNode = point.getElementsByTagName("coordinates")[0];
        const coords = coordsNode ? parseCoordinates(coordsNode.textContent) : [];

        if (coords.length) {
          const stopText = `${folderLower} ${name.toLowerCase()}`;
          const isStop =
            /stop|stops|説明|確認|立ち止|チェック|下見/.test(stopText) ||
            /^\d+[_＿\-.]/.test(name);

          stops.push({
            name,
            desc,
            folder,
            ...coords[0],
            isStop
          });
        }
      }
    });

    return { routes, stops };
  }

  function toRad(deg) {
    return deg * Math.PI / 180;
  }

  function toDeg(rad) {
    return rad * 180 / Math.PI;
  }

  function distanceMeters(a, b) {
    const R = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(dLng / 2) ** 2;

    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function routeLengthMeters(route) {
    let total = 0;

    for (let i = 0; i < route.length - 1; i++) {
      total += distanceMeters(route[i], route[i + 1]);
    }

    return total;
  }

  function bearingDegrees(a, b) {
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const dLng = toRad(b.lng - a.lng);

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function interpolate(a, b, ratio) {
    return {
      lat: a.lat + (b.lat - a.lat) * ratio,
      lng: a.lng + (b.lng - a.lng) * ratio
    };
  }

  function densifyRoute(route, intervalMeters) {
    if (route.length < 2) return [];

    const out = [];

    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i];
      const b = route[i + 1];
      const d = distanceMeters(a, b);
      const steps = Math.max(1, Math.floor(d / intervalMeters));

      for (let s = 0; s < steps; s++) {
        const ratio = s / steps;
        const p = interpolate(a, b, ratio);
        p.heading = bearingDegrees(a, b);
        out.push(p);
      }
    }

    const last = route[route.length - 1];
    const prev = route[route.length - 2];

    out.push({
      ...last,
      heading: bearingDegrees(prev, last)
    });

    return out;
  }

  function nearestStop(point, stops) {
    let best = null;

    for (const stop of stops) {
      const d = distanceMeters(point, stop);

      if (d <= 35 && (!best || d < best.distance)) {
        best = {
          ...stop,
          distance: d
        };
      }
    }

    return best;
  }

  function makeStreetViewUrl(point) {
    const fov = Number($("labStreetViewFov")?.value || 80);
    const viewpoint = `${point.lat.toFixed(7)},${point.lng.toFixed(7)}`;
    const heading = Math.round(point.heading || 0);

    return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(viewpoint)}&heading=${heading}&pitch=0&fov=${fov}`;
  }

  function openInStreetViewViewer(point) {
  if (!point || !point.url) return;

  const windowName = "campsite_lab_streetview_viewer";

  state.viewerWindow = window.open(point.url, windowName);

  if (state.viewerWindow) {
    state.viewerWindow.focus();
  }
}
  function buildPoints(route, stops, intervalMeters) {
    const sampled = densifyRoute(route, intervalMeters);

    return sampled.map((p, index) => {
      const stop = nearestStop(p, stops);

      return {
        ...p,
        index,
        stop,
        url: makeStreetViewUrl(p)
      };
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function populateRouteSelect(routes) {
    const select = $("labStreetViewRouteSelect");
    if (!select) return;

    select.innerHTML = "";

    if (!routes.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "ルートが見つかりません";
      select.appendChild(option);
      enableRouteSelect(false);
      return;
    }

    routes.forEach((route, index) => {
      const option = document.createElement("option");
      const distance = Math.round(route.distance || routeLengthMeters(route.coords));
      const folder = route.folder ? `${route.folder} / ` : "";

      option.value = String(index);
      option.textContent = `${index + 1}. ${folder}${route.name}（約${distance}m / ${route.coords.length}点）`;
      select.appendChild(option);
    });

    select.value = String(state.selectedRouteIndex || 0);
    enableRouteSelect(routes.length > 1);
  }

  function selectedRoute() {
    const select = $("labStreetViewRouteSelect");
    const index = Number(select?.value ?? state.selectedRouteIndex ?? 0);

    state.selectedRouteIndex = Number.isFinite(index) ? index : 0;
    return state.routes[state.selectedRouteIndex] || state.routes[0];
  }

  function updateCard() {
    const card = $("labStreetViewStopCard");
    if (!card) return;

    if (!state.points.length) {
      card.innerHTML = "<strong>現在の確認</strong><br>まだ下見リンクは生成されていません。";
      return;
    }

    const p = state.points[state.currentIndex];

    const stopHtml = p.stop
      ? `
        <br><br>
        <strong>近くの説明ポイント</strong><br>
        ${escapeHtml(p.stop.name)}
        ${p.stop.desc ? `<br><span>${escapeHtml(p.stop.desc)}</span>` : ""}
      `
      : "<br><br>近くに説明ポイントはありません。";

    card.innerHTML = `
      <strong>現在の確認</strong><br>
      ${state.currentIndex + 1}地点目 / ${state.points.length}地点<br>
      緯度経度：${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}<br>
      進行方向：${Math.round(p.heading || 0)}°
      ${stopHtml}
      <br><br>
      <a href="${p.url}" target="_blank" rel="noopener">GoogleマップでStreet Viewを開く</a>
    `;
  }

  function renderLinkList() {
    const panel = $("labStreetViewPanorama");
    if (!panel) return;

    if (!state.points.length) {
      panel.innerHTML = `
        <div class="lab-streetview-placeholder">
          ここにStreet Viewリンク一覧が表示されます。
        </div>
      `;
      return;
    }

    const rows = state.points.map((p, idx) => {
      const stopBadge = p.stop
        ? `<span class="lab-streetview-stop-badge">${escapeHtml(p.stop.name)}</span>`
        : "";

      return `
  <button type="button" class="lab-streetview-url-row" data-index="${idx}">
    <span class="lab-streetview-url-index">${idx + 1}</span>
    <strong>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</strong>
    ${stopBadge}
  </button>
`;
    }).join("");

    panel.innerHTML = `<div class="lab-streetview-url-list">${rows}</div>`;

    panel.querySelectorAll(".lab-streetview-url-row").forEach((button) => {
      button.addEventListener("click", () => {
        state.currentIndex = Number(button.dataset.index || 0);
        syncCurrentPoint(false);
      });
    });
  }

  function setupMap() {
    const el = $("labStreetViewMiniMap");
    if (!el || !window.L) return;

    if (!state.map) {
      state.map = L.map(el, {
        zoomControl: false
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
      }).addTo(state.map);

      state.routeLayer = L.layerGroup().addTo(state.map);
      state.markerLayer = L.layerGroup().addTo(state.map);
    }

    state.routeLayer.clearLayers();
    state.markerLayer.clearLayers();

    if (state.currentMarker) {
      state.map.removeLayer(state.currentMarker);
      state.currentMarker = null;
    }

    const latLngs = state.route.map((p) => [p.lat, p.lng]);

    if (latLngs.length) {
      L.polyline(latLngs, {
        weight: 4
      }).addTo(state.routeLayer);

      state.map.fitBounds(latLngs, {
        padding: [10, 10]
      });
    }

    state.stops.forEach((stop) => {
      L.circleMarker([stop.lat, stop.lng], {
        radius: 5,
        weight: 2
      })
        .bindTooltip(stop.name)
        .addTo(state.markerLayer);
    });

    setTimeout(() => {
      state.map.invalidateSize();
    }, 80);
  }

  function syncCurrentPoint(openUrl) {
    if (!state.points.length) return;

    setProgress();
    updateCard();

    const p = state.points[state.currentIndex];

    if (state.map && window.L) {
      if (!state.currentMarker) {
        state.currentMarker = L.circleMarker([p.lat, p.lng], {
          radius: 7,
          weight: 3
        }).addTo(state.map);
      } else {
        state.currentMarker.setLatLng([p.lat, p.lng]);
      }

      state.map.panTo([p.lat, p.lng]);
    }

    document.querySelectorAll(".lab-streetview-url-row").forEach((row) => {
      row.classList.toggle("active", Number(row.dataset.index) === state.currentIndex);
    });

    if (openUrl) {
  openInStreetViewViewer(p);
}
  }

  function generateSelectedRouteTour() {
    const routeInfo = selectedRoute();

    if (!routeInfo || !routeInfo.coords || routeInfo.coords.length < 2) {
      throw new Error("使用できるルートが見つかりません。");
    }

    const interval = Number($("labStreetViewIntervalMeters")?.value || 50);

    state.route = routeInfo.coords;
    state.points = buildPoints(state.route, state.stops, interval);
    state.currentIndex = 0;

    setupMap();
    renderLinkList();
    syncCurrentPoint(false);
    enableButtons(true);

    const distance = Math.round(routeInfo.distance || routeLengthMeters(routeInfo.coords));

    setStatus("APIなし下見リンクを生成しました。Street Viewは外部ビューアで開きます。", "success");
    setSummary(`
      選択ルート：${escapeHtml(routeInfo.name)}<br>
      ルート距離：約${distance}m<br>
      ルート点数：${state.route.length}<br>
      生成リンク：${state.points.length}<br>
      説明ポイント：${state.stops.length}<br>
      検出ルート数：${state.routes.length}<br>
      ※Street Viewがない地点は、Googleマップ側で通常地図に切り替わる場合があります。
    `);
  }

  window.prepareLabStreetViewTour = async function prepareLabStreetViewTour() {
    const input = $("labStreetViewKmzFile");
    const file = input?.files?.[0];

    if (!file) {
      alert("下見用KMZ / KMLを選択してください。");
      return;
    }

    setStatus("KMZ / KMLを解析中…", "loading");
    enableButtons(false);
    enableRouteSelect(false);

    try {
      const kml = await readKmlText(file);
      const parsed = parseKml(kml);

      if (!parsed.routes.length) {
        throw new Error("ルート線が見つかりません。マイマップに線を作ってください。");
      }

      state.routes = parsed.routes;
      state.stops = parsed.stops;
      state.selectedRouteIndex = 0;

      populateRouteSelect(state.routes);
      generateSelectedRouteTour();

      if (state.routes.length > 1) {
        setStatus(`ルートを${state.routes.length}本検出しました。使用するルートを選択できます。`, "success");
      }
    } catch (error) {
      console.error(error);
      setStatus(error.message || "下見リンクの生成に失敗しました。", "error");
      setSummary("");
      enableButtons(false);
      enableRouteSelect(false);
    }
  };

  window.openCurrentLabStreetViewPoint = function openCurrentLabStreetViewPoint() {
  syncCurrentPoint(true);
};

window.stepLabStreetViewAutoTour = function stepLabStreetViewAutoTour() {
  if (!state.points.length) return;

  state.currentIndex = Math.min(
    state.currentIndex + 1,
    state.points.length - 1
  );

  syncCurrentPoint(false);
};

window.prevLabStreetViewPoint = function prevLabStreetViewPoint() {
  if (!state.points.length) return;

  state.currentIndex = Math.max(
    state.currentIndex - 1,
    0
  );

  syncCurrentPoint(false);
};

 window.resetLabStreetViewTour = function resetLabStreetViewTour() {
  if (!state.points.length) return;

  state.currentIndex = 0;
  syncCurrentPoint(false);
};

  document.addEventListener("change", (event) => {
    if (event.target && event.target.id === "labStreetViewRouteSelect") {
      try {
        generateSelectedRouteTour();
      } catch (error) {
        console.error(error);
        setStatus(error.message || "ルートの切り替えに失敗しました。", "error");
      }
    }

    if (
      event.target &&
      (event.target.id === "labStreetViewIntervalMeters" ||
        event.target.id === "labStreetViewFov")
    ) {
      if (state.routes.length) {
        try {
          generateSelectedRouteTour();
        } catch (error) {
          console.error(error);
          setStatus(error.message || "下見リンクの再生成に失敗しました。", "error");
        }
      }
    }
  });

  // 旧ボタン名が残っても壊れないようにする
  window.startLabStreetViewAutoTour = window.openCurrentLabStreetViewPoint;
  window.stopLabStreetViewAutoTour = window.resetLabStreetViewTour;
})();