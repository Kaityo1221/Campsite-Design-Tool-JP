(() => {
  'use strict';

  const DISTANCES = Object.freeze({
    preferred: 50,
    reference40: 40,
    reference30: 30
  });

  const TRIAL_COUNT = 30000;
  let cachedState = null;
  let cachedComparison = null;
  let compareScheduled = false;
  let previewWrapped = false;

  function getCapacityState() {
    try {
      return capacityState || null;
    } catch (_error) {
      return null;
    }
  }

  function getSelectedTotal() {
    return ['pokestop', 'gym', 'power'].reduce((sum, kind) => {
      const value = Number(document.getElementById(`capacitySelect_${kind}`)?.value || 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersects = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || Number.EPSILON) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function distanceToSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= Number.EPSILON) return distance(point, a);
    const t = Math.max(0, Math.min(1,
      ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq
    ));
    return distance(point, { x: a.x + t * dx, y: a.y + t * dy });
  }

  function distanceToPolygonEdge(point, polygon) {
    let minDistance = Infinity;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      minDistance = Math.min(minDistance, distanceToSegment(point, a, b));
    }
    return minDistance;
  }

  function estimateReferenceCapacity(polygon, blockingPoints, minDistance, trialCount = TRIAL_COUNT) {
    if (!Array.isArray(polygon) || polygon.length < 3) return { count: 0, points: [] };

    const meanLat = polygon.reduce((sum, point) => sum + Number(point.lat || 0), 0) / polygon.length;
    const metersPerLat = 111320;
    const metersPerLng = 111320 * Math.cos(meanLat * Math.PI / 180);

    const projectedPolygon = polygon.map(point => ({
      x: Number(point.lng) * metersPerLng,
      y: Number(point.lat) * metersPerLat
    }));
    const projectedBlocking = (blockingPoints || []).map(point => ({
      x: Number(point.lng) * metersPerLng,
      y: Number(point.lat) * metersPerLat
    })).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));

    const xs = projectedPolygon.map(point => point.x);
    const ys = projectedPolygon.map(point => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const boundaryMargin = 15;
    const accepted = [];

    for (let i = 0; i < trialCount; i++) {
      const candidate = {
        x: minX + Math.random() * (maxX - minX),
        y: minY + Math.random() * (maxY - minY)
      };

      if (!pointInPolygon(candidate, projectedPolygon)) continue;
      if (distanceToPolygonEdge(candidate, projectedPolygon) < boundaryMargin) continue;
      if (projectedBlocking.some(point => distance(candidate, point) < minDistance)) continue;
      if (accepted.some(point => distance(candidate, point) < minDistance)) continue;

      accepted.push(candidate);
    }

    return { count: accepted.length, points: accepted };
  }

  function computeComparison(state) {
    if (!state) return null;
    if (cachedState === state && cachedComparison) return cachedComparison;

    const count50 = Number(state.estimate?.points?.length || state.estimate?.count || 0);
    const raw40 = estimateReferenceCapacity(
      state.polygon,
      state.poi,
      DISTANCES.reference40
    ).count;
    const raw30 = estimateReferenceCapacity(
      state.polygon,
      state.poi,
      DISTANCES.reference30
    ).count;

    const count40 = Math.max(count50, raw40);
    const count30 = Math.max(count40, raw30);

    cachedState = state;
    cachedComparison = Object.freeze({
      50: count50,
      40: count40,
      30: count30
    });
    return cachedComparison;
  }

  function comparisonCard(distanceMeters, count, type) {
    const label = type === 'preferred' ? '原則' : '参考';
    return `
      <div class="placement-spacing-card placement-spacing-card--${type}">
        <div class="placement-spacing-card__distance">${distanceMeters}m <span>${label}</span></div>
        <strong>${count}<small>地点程度</small></strong>
      </div>
    `;
  }

  function renderComparisonPanel(comparison) {
    const manual = document.querySelector('#capacityResult .capacity-manual-settings');
    if (!manual || !comparison) return;

    let panel = document.getElementById('placementSpacingComparison');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'placementSpacingComparison';
      panel.className = 'placement-spacing-comparison';
      manual.insertAdjacentElement('beforebegin', panel);
    }

    panel.innerHTML = `
      <div class="placement-spacing-comparison__head">
        <strong>距離別の配置可能数</strong>
        <span>同じKMZを距離だけ変えて比較した概算です。</span>
      </div>
      <div class="placement-spacing-comparison__grid">
        ${comparisonCard(50, comparison[50], 'preferred')}
        ${comparisonCard(40, comparison[40], 'reference')}
        ${comparisonCard(30, comparison[30], 'reference')}
      </div>
      <div class="placement-spacing-comparison__note">
        候補生成は <strong>50m原則</strong> のままです。40m / 30m は比較用の参考値で、候補生成の合格条件には使用しません。
      </div>
    `;
  }

  function renderLoadingPanel() {
    const manual = document.querySelector('#capacityResult .capacity-manual-settings');
    if (!manual) return;
    let panel = document.getElementById('placementSpacingComparison');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'placementSpacingComparison';
      panel.className = 'placement-spacing-comparison';
      manual.insertAdjacentElement('beforebegin', panel);
    }
    panel.innerHTML = `
      <div class="placement-spacing-comparison__head">
        <strong>距離別の配置可能数</strong>
        <span>40m / 30m の参考値を計算中…</span>
      </div>
    `;
  }

  function scheduleComparison() {
    if (compareScheduled) return;
    const state = getCapacityState();
    if (!state || !document.querySelector('#capacityResult .capacity-manual-settings')) return;

    if (cachedState === state && cachedComparison) {
      renderComparisonPanel(cachedComparison);
      return;
    }

    compareScheduled = true;
    renderLoadingPanel();
    window.setTimeout(() => {
      try {
        const comparison = computeComparison(state);
        renderComparisonPanel(comparison);
      } catch (error) {
        console.warn('[Placement Spacing Compare] comparison failed', error);
      } finally {
        compareScheduled = false;
      }
    }, 0);
  }

  function statusText(count, selected) {
    return count >= selected ? '（選択数を満たす目安）' : '（不足）';
  }

  function buildInsufficientMessage(selected, comparison) {
    return [
      `選択数 ${selected}件に対して、50m原則の配置余地は${comparison[50]}地点程度です。`,
      '',
      '【距離別の比較目安】',
      `50m 原則：${comparison[50]}地点程度 ${statusText(comparison[50], selected)}`,
      `40m 参考：${comparison[40]}地点程度 ${statusText(comparison[40], selected)}`,
      `30m 参考：${comparison[30]}地点程度 ${statusText(comparison[30], selected)}`,
      '',
      '候補生成は50m原則のままです。',
      '40m / 30m は比較資料として表示しており、候補生成の合格条件には使用しません。'
    ].join('\n');
  }

  function wrapPreview() {
    if (previewWrapped) return true;
    const originalPreview = window.previewCandidatePoiPlacement;
    if (typeof originalPreview !== 'function') return false;

    window.previewCandidatePoiPlacement = function placementSpacingComparePreview(...args) {
      const state = getCapacityState();
      const selected = getSelectedTotal();
      const count50 = Number(state?.estimate?.points?.length || state?.estimate?.count || 0);

      if (state && selected > 0 && selected > count50) {
        const comparison = computeComparison(state);
        renderComparisonPanel(comparison);
        alert(buildInsufficientMessage(selected, comparison));
        return;
      }

      return originalPreview.apply(this, args);
    };

    previewWrapped = true;
    return true;
  }

  function install(attempt = 0) {
    wrapPreview();
    scheduleComparison();

    const result = document.getElementById('capacityResult');
    if (result && result.dataset.placementSpacingCompareObserver !== 'true') {
      result.dataset.placementSpacingCompareObserver = 'true';
      new MutationObserver(() => {
        requestAnimationFrame(scheduleComparison);
      }).observe(result, { childList: true, subtree: true });
    }

    if ((!previewWrapped || !result) && attempt < 120) {
      window.setTimeout(() => install(attempt + 1), 50);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => install(), { once: true });
  } else {
    install();
  }
})();