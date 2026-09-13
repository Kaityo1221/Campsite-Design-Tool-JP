(() => {
  'use strict';

  const ZONE_POLICY = Object.freeze({
    preferredSpacingMeters: 50,
    referenceSpacingMeters: 40,
    boundaryMarginMeters: 15,
    corePoiClearanceMeters: 75,
    coreBoundaryMarginMeters: 30,
    baseGridMeters: 12,
    maxCells: 6500
  });

  const LEVELS = Object.freeze({
    core: Object.freeze({
      label: '本命候補地',
      color: '#16a34a',
      fillOpacity: 0.30,
      summary: '50m条件に加えて、既存POIと境界の両方に余裕があります。'
    }),
    available: Object.freeze({
      label: '配置可能地',
      color: '#22c55e',
      fillOpacity: 0.20,
      summary: '50m条件を満たしています。現地状況を確認して候補にできます。'
    }),
    reference: Object.freeze({
      label: '40〜50m参考帯',
      color: '#f59e0b',
      fillOpacity: 0.22,
      summary: '40m以上50m未満です。現行方針では候補外ですが、比較用に表示します。'
    }),
    blocked: Object.freeze({
      label: '要注意・対象外',
      color: '#ef4444',
      fillOpacity: 0.16,
      summary: '50m条件または境界余白を満たしていません。'
    })
  });

  let installed = false;
  let visible = true;
  let zoneLayer = null;
  let lastSummary = null;
  let mapClickHandler = null;

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

  function classifyPoint({ edgeDistance, nearestPoiDistance }) {
    if (
      nearestPoiDistance >= ZONE_POLICY.corePoiClearanceMeters &&
      edgeDistance >= ZONE_POLICY.coreBoundaryMarginMeters
    ) {
      return 'core';
    }

    if (
      nearestPoiDistance >= ZONE_POLICY.preferredSpacingMeters &&
      edgeDistance >= ZONE_POLICY.boundaryMarginMeters
    ) {
      return 'available';
    }

    if (
      nearestPoiDistance >= ZONE_POLICY.referenceSpacingMeters &&
      nearestPoiDistance < ZONE_POLICY.preferredSpacingMeters &&
      edgeDistance >= ZONE_POLICY.boundaryMarginMeters
    ) {
      return 'reference';
    }

    return 'blocked';
  }

  function buildReason(level, nearestPoiDistance, edgeDistance, nearestPoiName) {
    const reasons = [];
    const poiName = nearestPoiName ? `「${nearestPoiName}」` : '既存POI';

    if (level === 'core') {
      reasons.push(`${poiName}まで約${Math.round(nearestPoiDistance)}m`);
      reasons.push(`活動範囲の端まで約${Math.round(edgeDistance)}m`);
      reasons.push('距離と境界の両方に余裕があります');
      return reasons;
    }

    if (level === 'available') {
      reasons.push(`${poiName}まで約${Math.round(nearestPoiDistance)}mで50m条件を満たします`);
      reasons.push(`活動範囲の端まで約${Math.round(edgeDistance)}m`);
      return reasons;
    }

    if (level === 'reference') {
      reasons.push(`${poiName}まで約${Math.round(nearestPoiDistance)}m`);
      reasons.push('40m以上50m未満のため参考帯です');
      return reasons;
    }

    if (nearestPoiDistance < ZONE_POLICY.referenceSpacingMeters) {
      reasons.push(`${poiName}まで約${Math.round(nearestPoiDistance)}mで40m未満です`);
    } else if (nearestPoiDistance < ZONE_POLICY.preferredSpacingMeters) {
      reasons.push(`${poiName}まで約${Math.round(nearestPoiDistance)}mで50m未満です`);
    }

    if (edgeDistance < ZONE_POLICY.boundaryMarginMeters) {
      reasons.push(`活動範囲の端まで約${Math.round(edgeDistance)}mで境界余白が不足しています`);
    }

    if (!reasons.length) reasons.push('現行の配置条件を満たしていません');
    return reasons;
  }

  function buildProjection(data) {
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
      y: p.lat * metersPerLat,
      name: p.name || 'POI',
      type: p.type || 'existing',
      kind: p.kind || ''
    }));

    return {
      metersPerLat,
      metersPerLng,
      projectedPolygon,
      blocking
    };
  }

  function inspectProjectedPoint(point, projection) {
    const edgeDistance = distanceToPolygonEdge(point, projection.projectedPolygon);

    let nearestPoiDistance = Infinity;
    let nearestPoi = null;
    projection.blocking.forEach(existing => {
      const d = distance(point, existing);
      if (d < nearestPoiDistance) {
        nearestPoiDistance = d;
        nearestPoi = existing;
      }
    });

    const level = classifyPoint({ edgeDistance, nearestPoiDistance });
    return {
      level,
      edgeDistance,
      nearestPoiDistance,
      nearestPoi,
      reasons: buildReason(level, nearestPoiDistance, edgeDistance, nearestPoi?.name)
    };
  }

  function buildZoneCells(data) {
    const projection = buildProjection(data);
    if (!projection) return null;

    const { projectedPolygon, metersPerLat, metersPerLng } = projection;
    const xs = projectedPolygon.map(p => p.x);
    const ys = projectedPolygon.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const gridMeters = getAdaptiveGridMeters(maxX - minX, maxY - minY);

    const cells = [];
    const counts = { core: 0, available: 0, reference: 0, blocked: 0 };

    for (let x = minX; x <= maxX; x += gridMeters) {
      for (let y = minY; y <= maxY; y += gridMeters) {
        const point = { x, y };
        if (!pointInPolygon(point, projectedPolygon)) continue;

        const inspected = inspectProjectedPoint(point, projection);
        counts[inspected.level] += 1;

        cells.push({
          lat: y / metersPerLat,
          lng: x / metersPerLng,
          level: inspected.level,
          nearestPoiDistance: inspected.nearestPoiDistance,
          nearestPoiName: inspected.nearestPoi?.name || '',
          edgeDistance: inspected.edgeDistance
        });
      }
    }

    return {
      cells,
      counts,
      gridMeters,
      projection
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
      const style = LEVELS[cell.level] || LEVELS.blocked;
      L.circleMarker([cell.lat, cell.lng], {
        renderer,
        radius: Math.max(3.5, Math.min(6, summary.gridMeters * 0.32)),
        stroke: false,
        fillColor: style.color,
        fillOpacity: style.fillOpacity,
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
          <strong>🏯 理由付き布陣図</strong>
          <small>色で余白を読み、地図をタップするとその地点の判定理由を確認できます。</small>
        </div>
        <button type="button" id="placementStrategyZoneToggle">表示中</button>
      </div>
      <div class="placement-strategy-zone-legend">
        <span><i class="core"></i>本命候補地</span>
        <span><i class="available"></i>配置可能地</span>
        <span><i class="reference"></i>40〜50m参考帯</span>
        <span><i class="blocked"></i>要注意・対象外</span>
      </div>
      <div id="placementStrategyZoneStats" class="placement-strategy-zone-stats">
        KMZを解析すると布陣図を表示します。
      </div>
      <div class="placement-strategy-zone-note">
        判定はAIではなく、既存POI距離・50m方針・活動範囲境界の固定ルールで計算します。色は配置を確定するものではありません。
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

    const counts = summary.counts;
    target.innerHTML = `
      <div><span>本命候補地</span><strong>${counts.core}</strong><small>セル</small></div>
      <div><span>配置可能地</span><strong>${counts.available}</strong><small>セル</small></div>
      <div><span>40〜50m参考</span><strong>${counts.reference}</strong><small>セル</small></div>
      <div><span>要注意・対象外</span><strong>${counts.blocked}</strong><small>セル</small></div>
    `;
  }

  function installMapInspection(summary) {
    const map = getPreviewMap();
    if (!map || typeof L === 'undefined') return;

    if (mapClickHandler) map.off('click', mapClickHandler);

    mapClickHandler = event => {
      const projection = summary?.projection;
      if (!projection) return;

      const point = {
        x: event.latlng.lng * projection.metersPerLng,
        y: event.latlng.lat * projection.metersPerLat
      };

      if (!pointInPolygon(point, projection.projectedPolygon)) {
        L.popup()
          .setLatLng(event.latlng)
          .setContent(`
            <div class="placement-strategy-zone-popup">
              <strong>活動範囲外</strong><br>
              <span>この地点は活動範囲ポリゴンの外です。</span>
            </div>
          `)
          .openOn(map);
        return;
      }

      const inspected = inspectProjectedPoint(point, projection);
      const style = LEVELS[inspected.level] || LEVELS.blocked;
      const poiDistance = Number.isFinite(inspected.nearestPoiDistance)
        ? `${Math.round(inspected.nearestPoiDistance)}m`
        : 'なし';
      const poiName = inspected.nearestPoi?.name || 'なし';

      L.popup()
        .setLatLng(event.latlng)
        .setContent(`
          <div class="placement-strategy-zone-popup">
            <strong style="color:${style.color};">${style.label}</strong>
            <div>${style.summary}</div>
            <hr>
            <div>最寄りPOI：${escapeCapacityHtml(poiName)}</div>
            <div>POIまで：約${poiDistance}</div>
            <div>境界まで：約${Math.round(inspected.edgeDistance)}m</div>
            <ul>${inspected.reasons.map(reason => `<li>${escapeCapacityHtml(reason)}</li>`).join('')}</ul>
          </div>
        `)
        .openOn(map);
    };

    map.on('click', mapClickHandler);
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
    installMapInspection(summary);

    window.CampsitePlacementZones = Object.freeze({
      policy: ZONE_POLICY,
      levels: LEVELS,
      summary: {
        gridMeters: summary.gridMeters,
        counts: { ...summary.counts }
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
