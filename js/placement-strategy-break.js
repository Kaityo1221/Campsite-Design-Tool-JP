(() => {
  'use strict';

  const LIMITS = Object.freeze({ pokestop: 12, gym: 8, power: 5 });
  const LABELS = Object.freeze({
    pokestop: 'ポケストップ',
    gym: 'ジム',
    power: 'パワースポット'
  });
  const MARKS = Object.freeze({ pokestop: '印', gym: '標', power: '望' });
  const KINDS = Object.freeze(['pokestop', 'gym', 'power']);

  let installed = false;
  let observer = null;

  function getState() {
    try {
      return capacityState || null;
    } catch (_error) {
      return null;
    }
  }

  function addedPoints(state = getState()) {
    return (state?.poi || []).filter(point => point.type === 'add');
  }

  function countKinds(points = addedPoints()) {
    return points.reduce((counts, point) => {
      if (Object.prototype.hasOwnProperty.call(counts, point.kind)) {
        counts[point.kind] += 1;
      }
      return counts;
    }, { pokestop: 0, gym: 0, power: 0 });
  }

  function getRemaining(counts) {
    return {
      pokestop: Math.max(0, LIMITS.pokestop - counts.pokestop),
      gym: Math.max(0, LIMITS.gym - counts.gym),
      power: Math.max(0, LIMITS.power - counts.power)
    };
  }

  function getSaturated(counts) {
    return KINDS.filter(kind => counts[kind] >= LIMITS[kind]);
  }

  function statusText(kind, count) {
    const limit = LIMITS[kind];
    if (count > limit) return `${MARKS[kind]} ${LABELS[kind]} ${count}/${limit}（+${count - limit}）`;
    return `${MARKS[kind]} ${LABELS[kind]} ${count}/${limit}（上限）`;
  }

  function ensurePanel() {
    const result = document.getElementById('capacityResult');
    const state = getState();
    if (!result || !state) return;

    const counts = countKinds(addedPoints(state));
    const saturated = getSaturated(counts);
    let panel = document.getElementById('placementStrategyBreakPanel');

    if (!saturated.length) {
      panel?.remove();
      return;
    }

    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'placementStrategyBreakPanel';
      panel.className = 'placement-break-panel';

      const manual = result.querySelector('.capacity-manual-settings');
      if (manual) manual.insertAdjacentElement('beforebegin', panel);
      else result.prepend(panel);
    }

    const total = KINDS.reduce((sum, kind) => sum + counts[kind], 0);
    const signature = `${KINDS.map(kind => counts[kind]).join('-')}|${total}`;
    if (panel.dataset.signature === signature) return;
    panel.dataset.signature = signature;

    panel.innerHTML = `
      <div class="placement-break-panel__eyebrow">BREAK FORMATION</div>
      <div class="placement-break-panel__head">
        <div>
          <strong>🔥 破戒して再編成</strong>
          <small>上限に達した追加希望POIを、CAの希望を残しながら組み替えます。</small>
        </div>
      </div>
      <div class="placement-break-panel__status">
        ${saturated.map(kind => `<span class="${counts[kind] > LIMITS[kind] ? 'over' : 'limit'}">${statusText(kind, counts[kind])}</span>`).join('')}
      </div>
      <p>
        地点は動かしません。追加希望POIの種別だけを最小限変更し、50m原則もそのまま維持します。
      </p>
      <button type="button" class="placement-break-button" onclick="runPlacementStrategyBreak()">
        🔥 破戒して再編成
      </button>
      <div id="placementStrategyBreakMessage" class="placement-break-panel__message"></div>
    `;
  }

  function computeTargetCounts(counts) {
    const total = KINDS.reduce((sum, kind) => sum + counts[kind], 0);
    const totalLimit = KINDS.reduce((sum, kind) => sum + LIMITS[kind], 0);

    if (total > totalLimit) {
      return {
        ok: false,
        reason: `追加希望POIが${total}件あり、3種の総上限${totalLimit}件を超えています。種別再編成だけでは収まりません。`
      };
    }

    const target = {
      pokestop: Math.min(counts.pokestop, LIMITS.pokestop),
      gym: Math.min(counts.gym, LIMITS.gym),
      power: Math.min(counts.power, LIMITS.power)
    };

    let unassigned = total - KINDS.reduce((sum, kind) => sum + target[kind], 0);

    while (unassigned > 0) {
      const destination = KINDS
        .map(kind => ({ kind, spare: LIMITS[kind] - target[kind] }))
        .filter(item => item.spare > 0)
        .sort((a, b) => b.spare - a.spare)[0];

      if (!destination) {
        return { ok: false, reason: '上限内へ再配分できる空きがありません。' };
      }

      target[destination.kind] += 1;
      unassigned -= 1;
    }

    // 「上限ちょうど」でも破戒が役立つよう、可能なら1枠だけ空ける。
    // 超過を解消した種類についても、他種に余裕があれば1枠の余白を作る。
    const saturated = getSaturated(counts)
      .map(kind => ({ kind, over: Math.max(0, counts[kind] - LIMITS[kind]) }))
      .sort((a, b) => b.over - a.over || KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));

    saturated.forEach(({ kind: source }) => {
      if (target[source] < LIMITS[source] || target[source] <= 0) return;

      const destination = KINDS
        .filter(kind => kind !== source)
        .map(kind => ({ kind, spare: LIMITS[kind] - target[kind] }))
        .filter(item => item.spare > 0)
        .sort((a, b) => b.spare - a.spare)[0];

      if (!destination) return;
      target[source] -= 1;
      target[destination.kind] += 1;
    });

    return { ok: true, target };
  }

  function buildMoves(points, counts, target) {
    const groups = { pokestop: [], gym: [], power: [] };
    points.forEach(point => {
      if (groups[point.kind]) groups[point.kind].push(point);
    });

    const movers = [];
    KINDS.forEach(kind => {
      const moveOut = Math.max(0, counts[kind] - target[kind]);
      if (!moveOut) return;
      const candidates = [...groups[kind]].reverse();
      for (let i = 0; i < moveOut; i++) {
        if (candidates[i]) movers.push({ point: candidates[i], from: kind, to: null });
      }
    });

    const needs = {};
    KINDS.forEach(kind => {
      needs[kind] = Math.max(0, target[kind] - counts[kind]);
    });

    movers.forEach(move => {
      const destination = KINDS
        .filter(kind => kind !== move.from && needs[kind] > 0)
        .sort((a, b) => needs[b] - needs[a])[0];

      if (!destination) return;
      move.to = destination;
      needs[destination] -= 1;
    });

    return movers.filter(move => move.to);
  }

  function resetCandidatePreview() {
    try {
      if (capacityPreviewCandidateLayer) {
        capacityPreviewCandidateLayer.remove();
        capacityPreviewCandidateLayer = null;
      }
    } catch (_error) {}

    try {
      capacityPreviewState = null;
    } catch (_error) {}

    const generateButton = document.getElementById('generateCandidatePoiButton');
    if (generateButton) generateButton.style.display = 'none';

    const previewResult = document.getElementById('candidatePreviewResult');
    if (previewResult) previewResult.innerHTML = '';
    const kmlResult = document.getElementById('candidateKmlResult');
    if (kmlResult) kmlResult.innerHTML = '';
  }

  function renderCapacityUiAfterBreak(state, beforeCounts, afterCounts, changes) {
    const result = document.getElementById('capacityResult');
    if (!result) return;

    const remaining = getRemaining(afterCounts);
    state.remaining = remaining;

    const modeSelector = typeof window.renderCapacityModeSelector === 'function'
      ? window.renderCapacityModeSelector()
      : '';

    const selectHtml = kind => {
      if (typeof window.renderCapacitySelect === 'function') {
        return window.renderCapacitySelect(kind, remaining[kind]);
      }
      let options = '';
      for (let i = 0; i <= remaining[kind]; i++) options += `<option value="${i}">${i}</option>`;
      return `<label>${LABELS[kind]}：<select id="capacitySelect_${kind}">${options}</select></label><br>`;
    };

    result.innerHTML = `
      <div class="distance-warning placement-break-result-shell">
        <div class="placement-break-result">
          <div class="placement-break-result__title">🔥 破戒後の配分</div>
          <div class="placement-break-result__counts">
            ${KINDS.map(kind => `
              <div>
                <span>${MARKS[kind]} ${LABELS[kind]}</span>
                <strong>${beforeCounts[kind]} → ${afterCounts[kind]}</strong>
                <small>上限 ${LIMITS[kind]} / 残り ${remaining[kind]}</small>
              </div>
            `).join('')}
          </div>
          <div class="placement-break-result__changes">
            <strong>${changes.length}件を再編成</strong>
            ${changes.length
              ? `<ul>${changes.map(change => `<li>${escapeHtml(change.name)}：${MARKS[change.from]} ${LABELS[change.from]} → ${MARKS[change.to]} ${LABELS[change.to]}</li>`).join('')}</ul>`
              : '<p>種別変更なし。現在の配分を維持しました。</p>'}
          </div>
          <p class="placement-break-result__note">地点と50m原則は変更していません。種別だけを再配分しています。</p>
        </div>

        <div class="capacity-section-title">2. 配置戦略を選ぶ</div>
        ${modeSelector}

        <div class="capacity-manual-settings">
          <strong>マニュアル設定</strong>
          <span class="note">（破戒後の残容量で指定）</span>
          <br><br>
          ${selectHtml('pokestop')}
          ${selectHtml('gym')}
          ${selectHtml('power')}
        </div>

        <button class="generate" onclick="previewCandidatePoiPlacement()">候補配置をプレビュー</button>
        <button id="generateCandidatePoiButton" class="generate" onclick="generateCandidatePoiKMZ()" style="display:none; margin-top:10px;">候補POI KMZを生成</button>
        <div id="candidatePreviewResult"></div>
        <div id="candidateKmlResult"></div>
        <div id="capacitySupabaseStatus" class="note" style="display:none;"></div>
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function refreshMaps(state) {
    try {
      if (typeof window.renderCapacityMap === 'function') {
        window.renderCapacityMap(state.polygon, state.poi);
      }
      if (typeof window.renderCapacityPreviewBaseMap === 'function') {
        window.renderCapacityPreviewBaseMap(state.polygon, state.poi);
      }
    } catch (error) {
      console.warn('[Placement Strategy Break] map refresh failed', error);
    }

    window.setTimeout(() => {
      window.CampsitePlacementSymbols?.refresh?.();
    }, 50);
  }

  function runBreak() {
    const state = getState();
    if (!state) {
      alert('先にKMZを解析してください。');
      return;
    }

    const points = addedPoints(state);
    const beforeCounts = countKinds(points);
    const saturated = getSaturated(beforeCounts);
    if (!saturated.length) {
      alert('現在は上限到達・超過がありません。破戒は不要です。');
      return;
    }

    points.forEach(point => {
      if (!point.placementStrategyPreferredKind) {
        point.placementStrategyPreferredKind = point.kind;
      }
    });

    const plan = computeTargetCounts(beforeCounts);
    const message = document.getElementById('placementStrategyBreakMessage');

    if (!plan.ok) {
      if (message) message.textContent = plan.reason;
      alert(plan.reason);
      return;
    }

    const moves = buildMoves(points, beforeCounts, plan.target);

    if (!moves.length) {
      const text = '総容量に空きがないため、今回は種別を動かして新しい空きを作れません。';
      if (message) message.textContent = text;
      alert(text);
      return;
    }

    const changes = moves.map(move => {
      const preferred = move.point.placementStrategyPreferredKind || move.from;
      move.point.placementStrategyPreferredKind = preferred;
      move.point.placementStrategyReorganizedFrom = move.from;
      move.point.kind = move.to;
      return {
        name: move.point.name || '追加希望POI',
        from: move.from,
        to: move.to
      };
    });

    const afterCounts = countKinds(points);
    state.remaining = getRemaining(afterCounts);

    resetCandidatePreview();
    renderCapacityUiAfterBreak(state, beforeCounts, afterCounts, changes);
    refreshMaps(state);
    ensurePanel();

    window.dispatchEvent(new CustomEvent('placementstrategy:break', {
      detail: { beforeCounts, afterCounts, changes }
    }));
  }

  function install() {
    if (installed) return;
    const result = document.getElementById('capacityResult');
    if (!result) return;

    window.runPlacementStrategyBreak = runBreak;
    window.CampsitePlacementBreak = Object.freeze({
      limits: LIMITS,
      getCounts: () => countKinds(),
      run: runBreak
    });

    observer = new MutationObserver(() => {
      requestAnimationFrame(ensurePanel);
    });
    observer.observe(result, { childList: true, subtree: true });

    window.addEventListener('placementstrategy:formation', ensurePanel);
    installed = true;
    ensurePanel();
    console.info('[Placement Strategy Break] active');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();