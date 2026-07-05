/*
  Lab Street View URL Preview / No API
  - Google Maps JavaScript API は使わない
  - KMZ / KML の walk_route を読み、Google Maps URLs の Street Viewリンクを生成する
  - stops ピンが近い地点では説明カードに表示する
*/

(function () {
  const state = {
    route: [],
    stops: [],
    points: [],
    currentIndex: 0,
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
      "labStreetViewStopButton"
    ];

    ids.forEach((id) => {
      const el = $(id);
      if (el) el.disabled = !enabled;
    });
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
      const name = textOf(pm, "name") || `地点${index + 1}`;
      const desc = textOf(pm, "description");
      const folder = folderNameOf(pm).toLowerCase();
      const line = pm.getElementsByTagName("LineString")[0];
      const point = pm.getElementsByTagName("Point")[0];

      if (line) {
        const coordsNode = line.getElementsByTagName("coordinates")[0];
        const coords = coordsNode ? parseCoordinates(coordsNode.textContent) : [];

        if (coords.length >= 2) {
          const routeText = `${folder} ${name.toLowerCase()}`;
          const score = /walk|route|ルート|導線|下見|さんぽ|散歩/.test(routeText) ? 2 : 1;
          routes.push({ name, folder, coords, score });
        }
      }

      if (point) {
        const coordsNode = point.getElementsByTagName("coordinates")[0];
        const coords = coordsNode ? parseCoordinates(coordsNode.textContent) : [];

        if (coords.length) {
          const stopText = `${folder} ${name.toLowerCase()}`;
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

    routes.sort((a, b) => b.score - a.score || b.coords.length - a.coords.length);

    const route = routes[0]?.coords || [];
    return { route, stops };
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
          <span>${idx + 1}</span>
          <strong>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</strong>
          <small>方角 ${Math.round(p.heading || 0)}°</small>
          ${stopBadge}
        </button>
      `;
    }).join("");

    panel.innerHTML = `<div class="lab-streetview-url-list">${rows}</div>`;

    panel.querySelectorAll(".lab-streetview-url-row").forEach((button) => {
      button.addEventListener("click", () => {
        state.currentIndex = Number(button.dataset.index || 0);
        syncCurrentPoint(true);
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
      window.open(p.url, "_blank", "noopener");
    }
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

    try {
      const kml = await readKmlText(file);
      const parsed = parseKml(kml);

      if (parsed.route.length < 2) {
        throw new Error("歩行ルートが見つかりません。マイマップに walk_route の線を作ってください。");
      }

      const interval = Number($("labStreetViewIntervalMeters")?.value || 50);

      state.route = parsed.route;
      state.stops = parsed.stops;
      state.points = buildPoints(state.route, state.stops, interval);
      state.currentIndex = 0;

      setupMap();
      renderLinkList();
      syncCurrentPoint(false);
      enableButtons(true);

      setStatus("APIなし下見リンクを生成しました。Street ViewはGoogleマップを別タブで開きます。", "success");
      setSummary(`
        ルート点数：${state.route.length}<br>
        生成リンク：${state.points.length}<br>
        説明ポイント：${state.stops.length}<br>
        ※Street Viewがない地点は、Googleマップ側で通常地図に切り替わる場合があります。
      `);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "下見リンクの生成に失敗しました。", "error");
      setSummary("");
      enableButtons(false);
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

    syncCurrentPoint(true);
  };

  window.resetLabStreetViewTour = function resetLabStreetViewTour() {
    if (!state.points.length) return;

    state.currentIndex = 0;
    syncCurrentPoint(false);
  };

  // 旧ボタン名が残っても壊れないようにする
  window.startLabStreetViewAutoTour = window.openCurrentLabStreetViewPoint;
  window.stopLabStreetViewAutoTour = window.resetLabStreetViewTour;
})();