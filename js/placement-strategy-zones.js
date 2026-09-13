(() => {
  'use strict';

  const ZONE_POLICY = Object.freeze({
    preferredSpacingMeters: 50,
    boundaryMarginMeters: 15,
    corePoiClearanceMeters: 75,
    coreBoundaryMarginMeters: 30,
    baseGridMeters: 12,
    maxCells: 6500
  });

  let installed = false;
  let visible = true;
  let zoneLayer = null;
  let lastSummary = null;

  function getCapacityData() {
    try {
      return capacityState || null;
    } catch (_error) {
      return null;
    }
  }

  function getPreviewMap() {
    try {
      return capacityPreviewMapInstance || null;
    } catch (_error) {
      return null;
    }
  }

  function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersects =
        ((yi > point.y) !== (yj > point.y)) &&
        (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function distanceToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (dx === 0 && dy === 0) return distance(point, start);

    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - start.x) * dx + (point.y - start.y) * dy) /
          (dx * dx + dy * dy)
      )
    );

    return distance(point, {
      x: start.x + t * dx,
      y: start.y + t * dy
    });
  }

  function distanceToPolygonEdge(point, polygon) {
    let min = Infinity;
    for (let i = 0; i < polygon.length; i++) {
      min = Math.min(
        min,
        distanceToSegment(point, polygon[i], polygon[(i + 1) % polygon.length])
      );
    }
    return min;
  }

  function getAdaptiveGridMeters(width, height) {
    const base = ZONE_POLICY.baseGridMeters;
    const estimated = (width * height) / (base * base);
    if (estimated <= ZONE_POLICY.maxCells) return base;
    const adaptive = Math.sqrt((width * height) / ZONE_POLICY.maxCells);
    return Math.max(base, Math.ceil(adaptive / 2) * 2);
  }

  function buildZoneCells(data) {
    const polygon = data?.polygon || [];
    const poi = data?.poi || [];
    if (polygon.length < 3) return null;

    const meanLat = polygon.reduce((sum, p) => sum + p.lat, 0) / polygon.length;
    const metersPerLat = 111320;
    const metersPerLng = 111320 * Math.cos((meanLat * Math.PI) / 180);

    const projectedPolygon = polygon.map(p => ({
      x: p.lng * metersPerLng,
      y: p.lat * metersPerLat
    }));

    const blocking = poi.map(p => ({
      x: p.lng * metersPerLng,
      y: p.lat * metersPerLat
    }));

    const xs = projectedPolygon.map(p => p.x);
    const ys = projectedPolygon.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const gridMeters = getAdaptiveGridMeters(maxX - minX, maxY - minY);

    const cells = [];
    let reference40to50 = 0;
    let rejectedBoundary = 0;

    for (let x = minX; x <= maxX; x += gridMeters) {
      for (let y = minY; y <= maxY; y += gridMeters) {
        const point = { x, y };
        if (!pointInPolygon(point, projectedPolygon)) continue;

        const edgeDistance = distanceToPolygonEdge(point, projectedPolygon);
        if (edgeDistance < ZONE_POLICY.boundaryMarginMeters) {
          rejectedBoundary += 1;
          continue;
        }

        const nearestPoiDistance = blocking.length
          ? Math.min(...blocking.map(existing => distance(point, existing)))
          : Infinity;

        if (nearestPoiDistance >= ZONE_POLICY.preferredSpacingMeters) {
          const level =
            nearestPoiDistance >= ZONE_POLICY.corePoiClearanceMeters &&
            edgeDistance >= ZONE_POLICY.coreBoundaryMarginMeters
              ? 'core'
              : 'available';

          cells.push({
            lat: y / metersPerLat,
            lng: x / metersPerLng,
            level,
            nearestPoiDistance,
            edgeDistance
          });
        } else if (nearestPoiDistance >= 40) {
          reference40to50 += 1;
        }
      }
    }

    return {
      cells,
      gridMeters,
      reference40to50,
      rejectedBoundary,
      coreCount: cells.filter(cell => cell.level === 'core').length,
      availableCount: cells.filter(cell => cell.level === 'available').length
    };
  }

  function removeZoneLayer() {
    if (zoneLayer) {
      zoneLayer.remove();
      zoneLayer = null;
    }
  }

  function renderZoneLayer(summary) {
    removeZoneLayer();
    if (!visible || !summary?.cells?.length) return;

    const map = getPreviewMap();
    if (!map || typeof L === 'undefined') return;

    const renderer = L.canvas({ padding: 0.4 });
    zoneLayer = L.layerGroup().addTo(map);

    summary.cells.forEach(cell => {
      const isCore = cell.level === 'core';
      L.circleMarker([cell.lat, cell.lng], {
        renderer,
        radius: Math.max(3.5, Math.min(6, summary.gridMeters * 0.32)),
        stroke: false,
        fillColor: isCore ? '#22c55e' : '#38bdf8',
        fillOpacity: isCore ? 0.24 : 0.15,
        interactive: false
      }).addTo(zoneLayer);
    });
  }

  function ensurePanel() {
    if (document.getElementById('placementStrategyZonePanel')) return;

    const banner = document.getElementById('placementStrategyPolicyBanner');
    if (!banner) return;

    const panel = document.createElement('div');
    panel.id = 'placementStrategyZonePanel';
    panel.className = 'placement-strategy-zone-panel';
    panel.innerHTML = `
      <div class="placement-strategy-zone-panel__head">
        <div>
          <strong>🗺️ 候補エリア</strong>
          <small>50m条件を満たす「余白」を点ではなく面として読みます。</small>
        </div>
        <button type="button" id="placementStrategyZoneToggle">表示中</button>
      </div>
      <div class="placement-strategy-zone-legend">
        <span><i class="core"></i>余裕あり</span>
        <span><i class="available"></i>配置可能</span>
      </div>
      <div id="placementStrategyZoneStats" class="placement-strategy-zone-stats">
        KMZを解析すると候補エリアを表示します。
      </div>
      <div class="placement-strategy-zone-note">
        40〜50mは参考帯として内部集計しますが、候補エリアには含めません。
      </div>
    `;

    banner.insertAdjacentElement('afterend', panel);
    panel.querySelector('#placementStrategyZoneToggle')?.addEventListener('click', () => {
      visible = !visible;
      const button = document.getElementById('placementStrategyZoneToggle');
      if (button) button.textContent = visible ? '表示中' : '非表示';
      if (lastSummary) renderZoneLayer(lastSummary);
    });
  }

  function renderStats(summary) {
    const target = document.getElementById('placementStrategyZoneStats');
    if (!target || !summary) return;

    const total = summary.cells.length;
    const approxArea = Math.round(total * summary.gridMeters * summary.gridMeters);
    target.innerHTML = `
      <div><span>余裕あり</span><strong>${summary.coreCount}</strong><small>セル</small></div>
      <div><span>配置可能</span><strong>${summary.availableCount}</strong><small>セル</small></div>
      <div><span>概算余白</span><strong>${approxArea.toLocaleString()}</strong><small>㎡相当</small></div>
      <div><span>解析メッシュ</span><strong>${summary.gridMeters}</strong><small>m</small></div>
    `;
  }

  function refreshZones() {
    ensurePanel();
    const data = getCapacityData();
    if (!data?.polygon?.length) return;

    const summary = buildZoneCells(data);
    if (!summary) return;

    lastSummary = summary;
    renderZoneLayer(summary);
    renderStats(summary);

    window.CampsitePlacementZones = Object.freeze({
      policy: ZONE_POLICY,
      summary: {
        gridMeters: summary.gridMeters,
        coreCount: summary.coreCount,
        availableCount: summary.availableCount,
        reference40to50: summary.reference40to50
      },
      refresh: refreshZones,
      isVisible: () => visible
    });
  }

  function install() {
    if (installed) return true;
    if (typeof window.renderCapacityPreviewBaseMap !== 'function') return false;

    const originalRenderPreviewBaseMap = window.renderCapacityPreviewBaseMap;
    window.renderCapacityPreviewBaseMap = function placementStrategyRenderPreviewBaseMap(...args) {
      const result = originalRenderPreviewBaseMap.apply(this, args);
      window.setTimeout(refreshZones, 0);
      return result;
    };

    installed = true;
    ensurePanel();
    return true;
  }

  function waitForBase(attempt = 0) {
    if (install()) return;
    if (attempt >= 120) {
      console.warn('[Placement Strategy Zones] base map did not become ready.');
      return;
    }
    window.setTimeout(() => waitForBase(attempt + 1), 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForBase(), { once: true });
  } else {
    waitForBase();
  }
})();
