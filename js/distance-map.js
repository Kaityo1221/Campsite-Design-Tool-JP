let distanceLeafletLoadPromise = null;

function ensureDistanceLeafletLoaded() {
  if (typeof L !== "undefined") {
    return Promise.resolve();
  }

  if (distanceLeafletLoadPromise) {
    return distanceLeafletLoadPromise;
  }

  distanceLeafletLoadPromise = new Promise((resolve, reject) => {
    const loadStylesheet = href => {
      if (document.querySelector(`link[href="${href}"]`)) {
        return;
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    };

    loadStylesheet(
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
    );

    const sources = [
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
      "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"
    ];

    const tryLoad = index => {
      if (typeof L !== "undefined") {
        resolve();
        return;
      }

      if (index >= sources.length) {
        distanceLeafletLoadPromise = null;
        reject(new Error("Leaflet could not be loaded"));
        return;
      }

      const script = document.createElement("script");
      script.src = sources[index];
      script.async = true;

      script.onload = () => {
        if (typeof L !== "undefined") {
          resolve();
        } else {
          script.remove();
          tryLoad(index + 1);
        }
      };

      script.onerror = () => {
        script.remove();
        tryLoad(index + 1);
      };

      document.head.appendChild(script);
    };

    tryLoad(0);
  });

  return distanceLeafletLoadPromise;
}

function addDistanceMapLegend() {
  if (!distanceLeafletMap || typeof L === "undefined") {
    return;
  }

  const legend = L.control({
    position: "bottomright"
  });

  legend.onAdd = function () {
    const div = L.DomUtil.create(
      "div",
      "distance-leaflet-legend is-collapsed"
    );

    div.innerHTML = `
      <button
        type="button"
        class="distance-legend-toggle"
        aria-expanded="false"
      >
        凡例
      </button>

      <div class="distance-legend-body">
        <strong>凡例</strong>

        <div>
          <span class="distance-legend-dot existing"></span>
          既存POI
        </div>

        <div>
          <span class="distance-legend-dot add"></span>
          追加POI
        </div>

        <div>
          <span class="distance-legend-line area"></span>
          活動範囲
        </div>

        <div>
          <span class="distance-legend-line dense"></span>
          20m未満
        </div>

        <div>
          <span class="distance-legend-line stay"></span>
          20〜30m
        </div>

        <div>
          <span class="distance-legend-line light"></span>
          30〜40m
        </div>

        <div>
          <span class="distance-legend-line reference"></span>
          既存同士参考
        </div>
      </div>
    `;

    const toggleButton =
      div.querySelector(".distance-legend-toggle");

    toggleButton.addEventListener("click", () => {
      const isCollapsed =
        div.classList.toggle("is-collapsed");

      toggleButton.setAttribute(
        "aria-expanded",
        String(!isCollapsed)
      );
    });

    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    return div;
  };

  legend.addTo(distanceLeafletMap);
}

function focusDistanceWarning(warningIndex) {
  const warning =
    latestDistanceWarnings[Number(warningIndex)];

  if (!warning || !distanceLeafletMap) {
    return;
  }

  const aLatLng = [
    Number(warning.a.lat),
    Number(warning.a.lng)
  ];

  const bLatLng = [
    Number(warning.b.lat),
    Number(warning.b.lng)
  ];

  if (
    !Number.isFinite(aLatLng[0]) ||
    !Number.isFinite(aLatLng[1]) ||
    !Number.isFinite(bLatLng[0]) ||
    !Number.isFinite(bLatLng[1])
  ) {
    return;
  }

  const mapElement =
    document.getElementById("distanceMap");

  if (mapElement) {
    mapElement.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  setTimeout(() => {
    distanceLeafletMap.fitBounds(
      [aLatLng, bLatLng],
      {
        padding: [80, 80],
        maxZoom: 19
      }
    );

    const line =
      distanceWarningLineLayers.get(String(warningIndex));

    if (line) {
      const originalWeight =
        line.options.weight || 3;

      const originalOpacity =
        line.options.opacity ?? 0.85;

      line.setStyle({
        weight: 8,
        opacity: 1
      });

      line.openPopup();

      setTimeout(() => {
        line.setStyle({
          weight: originalWeight,
          opacity: originalOpacity
        });
      }, 1800);
    }
  }, 280);
}

function renderSimpleDistanceMap(points = [], warnings = []) {
  latestDistanceWarnings = warnings || [];
  distanceWarningLineLayers = new Map();
  const mapElement = document.getElementById("distanceMap");

  if (!mapElement) {
    return;
  }

  mapElement.innerHTML = "";
  mapElement.style.display = "block";
  mapElement.style.height = "";
  mapElement.style.minHeight = "";

  if (typeof L === "undefined") {
    mapElement.innerHTML = `
      <div class="distance-map-empty">
        地図を読み込んでいます…
      </div>
    `;

    ensureDistanceLeafletLoaded()
      .then(() => {
        renderSimpleDistanceMap(points, warnings);
      })
      .catch(() => {
        mapElement.innerHTML = `
          <div class="distance-map-empty">
            地図を読み込めませんでした。通信環境を確認して、もう一度距離チェックを実行してください。
          </div>
        `;
        mapElement.style.height = "auto";
        mapElement.style.minHeight = "0";
      });

    return;
  }

  function pickNumber(p, keys) {
    for (const key of keys) {
      if (p[key] !== undefined && p[key] !== null && p[key] !== "") {
        const value = Number(String(p[key]).trim());
        if (!isNaN(value)) return value;
      }
    }

    return NaN;
  }

  function getPointLatLng(p) {
    const lat = pickNumber(p, [
      "lat",
      "latitude",
      "Latitude",
      "LAT",
      "緯度"
    ]);

    const lng = pickNumber(p, [
      "lng",
      "lon",
      "longitude",
      "Longitude",
      "LON",
      "経度"
    ]);

    if (isNaN(lat) || isNaN(lng)) {
      return null;
    }

    return [lat, lng];
  }

  const validPoints = points
    .map(p => {
      const latLng = getPointLatLng(p);

      if (!latLng) {
        return null;
      }

      return {
        ...p,
        lat: latLng[0],
        lng: latLng[1]
      };
    })
    .filter(Boolean);

  if (!validPoints.length) {
    mapElement.innerHTML = `
      <div class="distance-map-empty">
        表示できるPOIがありません。
      </div>
    `;
    return;
  }

  if (distanceLeafletMap) {
    distanceLeafletMap.remove();
    distanceLeafletMap = null;
    distanceLeafletLayerGroup = null;
    distancePolygonLayerGroup = null;
  }

  distanceLeafletMap = L.map("distanceMap", {
    zoomControl: true
  });

  const osmLayer = L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }
  );

  const aerialLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri"
    }
  );

  osmLayer.addTo(distanceLeafletMap);

  distanceLeafletLayerGroup =
    L.layerGroup().addTo(distanceLeafletMap);

  distancePolygonLayerGroup =
    L.layerGroup().addTo(distanceLeafletMap);

  L.control.layers(
    {
      "OSM": osmLayer,
      "航空写真": aerialLayer
    },
    {
      "活動範囲": distancePolygonLayerGroup
    },
    {
      collapsed: false
    }
  ).addTo(distanceLeafletMap);

  addDistanceMapLegend();

  const bounds = [];

  /*
    活動範囲ポリゴン
  */
  (window._activityPolygons || []).forEach((polygon, index) => {
    if (!Array.isArray(polygon) || polygon.length < 3) {
      return;
    }

    L.polygon(polygon, {
      color: "#a855f7",
      fillColor: "#a855f7",
      fillOpacity: 0.18,
      weight: 2,
      interactive: false
    })
      .bindPopup(`活動範囲ポリゴン ${index + 1}`)
      .addTo(distancePolygonLayerGroup);

    polygon.forEach(latLng => bounds.push(latLng));
  });

  /*
    POI
  */
  validPoints.forEach(p => {
    const latLng = [p.lat, p.lng];

    const layerName =
      p.originalLayer ||
      p.layer ||
      "";

    const isAdd =
      isAddedLayerName(layerName);

    const color =
      isAdd ? "#22c55e" : "#38bdf8";

    const label =
      isAdd ? "追加POI" : "既存POI";

    L.circleMarker(latLng, {
      radius: isAdd ? 8 : 6,
      color,
      fillColor: color,
      fillOpacity: 0.92,
      weight: 2
    })
      .bindPopup(`
        <strong>${escapeDistanceHtml(p.name || "名称なし")}</strong><br>
        ${escapeDistanceHtml(label)}<br>
        レイヤー：${escapeDistanceHtml(layerName || "-")}
      `)
      .addTo(distanceLeafletLayerGroup);

    bounds.push(latLng);
  });

  /*
    近接ライン
  */
  (warnings || []).forEach((w, index) => {
    const aLatLng = getPointLatLng(w.a);
    const bLatLng = getPointLatLng(w.b);

    if (!aLatLng || !bLatLng) {
      return;
    }

    const isExistingA =
      isExistingLayerName(w.a.originalLayer || w.a.layer || "");

    const isExistingB =
      isExistingLayerName(w.b.originalLayer || w.b.layer || "");

    const isReference =
      isExistingA && isExistingB;

    let color = "#facc15";
    let label = "軽微";

    if (w.distance < 20) {
      color = "#ef4444";
      label = "密集";
    } else if (w.distance < 30) {
      color = "#f97316";
      label = "滞留";
    }

    if (isReference) {
      color = "#94a3b8";
      label = "参考";
    }

    const warningIndex =
      Number.isFinite(Number(w.warningIndex))
        ? Number(w.warningIndex)
        : index;

    const warningLine = L.polyline([aLatLng, bLatLng], {
      color,
      weight: isReference ? 2 : 3,
      opacity: isReference ? 0.55 : 0.85,
      dashArray: isReference || w.distance >= 30 ? "6,6" : null
    })
      .bindPopup(`
        <strong>${escapeDistanceHtml(label)}：${w.distance.toFixed(1)}m</strong><br>
        ${escapeDistanceHtml(w.a.layer || "-")}：${escapeDistanceHtml(w.a.name || "名称なし")}<br>
        × ${escapeDistanceHtml(w.b.layer || "-")}：${escapeDistanceHtml(w.b.name || "名称なし")}
      `)
      .addTo(distanceLeafletLayerGroup);

    distanceWarningLineLayers.set(
      String(warningIndex),
      warningLine
    );

    bounds.push(aLatLng);
    bounds.push(bLatLng);
  });

  if (bounds.length) {
    distanceLeafletMap.fitBounds(bounds, {
      padding: [28, 28]
    });
  }

  setTimeout(() => {
    distanceLeafletMap?.invalidateSize();
  }, 160);
}
