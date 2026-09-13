(() => {
  'use strict';

  const POLICY = Object.freeze({
    version: '2026-09-strategy-v4',
    preferredSpacingMeters: 50,
    referenceSpacingMeters: Object.freeze([40, 30]),
    boundaryMarginMeters: 15
  });

  const STRATEGIES = Object.freeze({
    balanced: Object.freeze({
      label: '鶴翼の陣',
      icon: '🪽',
      description: '',
      reason: '現代語：全体に広く散らして、偏りと混雑を抑える配置です。'
    }),
    interior: Object.freeze({
      label: '方円の陣',
      icon: '🛡️',
      description: '',
      reason: '現代語：外周に寄せすぎず、内側の安定した場所を優先する配置です。'
    }),
    gap: Object.freeze({
      label: '雁行の陣',
      icon: '🪶',
      description: '',
      reason: '現代語：既存POIの薄い場所を拾いながら、ずらして展開する配置です。'
    })
  });

  let installed = false;
  let strategyMode = 'balanced';
  let strategyPreviewLayer = null;

  function findCapacitySection() {
    const fileInput = document.getElementById('capacityFile');
    if (!fileInput) return null;
    return fileInput.closest('.step')?.parentElement || fileInput.closest('.panel') || null;
  }

  function updateEntryStatus() {
    const fileInput = document.getElementById('capacityFile');
    const status = document.getElementById('placementStrategyEntryStatus');
    if (!fileInput || !status) return;
    const ready = Boolean(fileInput.files?.length);
    status.textContent = ready
      ? '● KMZ準備完了：下のボタンから布陣解析へ'
      : '○ KMZを選択してください';
    status.style.color = ready ? '#bbf7d0' : '#cbd5e1';
  }

  function ensurePolicyBanner() {
    const fileInput = document.getElementById('capacityFile');
    const step = fileInput?.closest('.step');
    if (!step) return;

    let banner = document.getElementById('placementStrategyPolicyBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'placementStrategyPolicyBanner';
      banner.className = 'placement-strategy-policy';
      step.insertAdjacentElement('afterbegin', banner);
    }

    banner.innerHTML = `
      <div class="placement-strategy-policy__eyebrow">PLACEMENT STRATEGY / LAB</div>
      <div class="placement-strategy-policy__title">🏯 配置戦略・布陣図</div>
      <div class="placement-strategy-policy__main">原則 <strong>50m</strong> 間隔で候補余地を評価します。</div>
      <div class="placement-strategy-policy__sub">40m / 30m は参考距離です。候補生成の合格条件には使用しません。</div>
      <div style="margin-top:10px;padding:9px 11px;border-radius:10px;background:rgba(15,23,42,.42);font-size:12px;line-height:1.7;color:#dbeafe;font-weight:800;">
        KMZを選択 → 下の「🏯 配置戦略・布陣図を開く」 → 地図右上で「🗺 通常地図 / 🏯 布陣図」を切替
      </div>
      <div id="placementStrategyEntryStatus" style="margin-top:8px;font-size:11px;font-weight:900;color:#cbd5e1;">○ KMZを選択してください</div>
      <div class="placement-strategy-policy__version">${POLICY.version}</div>
    `;

    if (fileInput.dataset.placementStrategyStatusBound !== 'true') {
      fileInput.dataset.placementStrategyStatusBound = 'true';
      fileInput.addEventListener('change', updateEntryStatus);
    }
    updateEntryStatus();
  }

  function ensureLaunchButtonCopy() {
    const fileInput = document.getElementById('capacityFile');
    const step = fileInput?.closest('.step');
    if (!step) return;

    const button = step.querySelector('button[onclick*="analyzePlacementCapacity"]') ||
      document.querySelector('button[onclick*="analyzePlacementCapacity"]');
    if (button) {
      button.id = 'placementStrategyLaunchButton';
      button.textContent = '🏯 配置戦略・布陣図を開く';
      button.setAttribute('aria-label', '配置戦略と布陣図を解析して開く');
    }

    const empty = document.getElementById('placementResult');
    if (empty && empty.classList.contains('placement-empty')) {
      empty.textContent = 'KMZを読み込むと、配置戦略と布陣図を表示します。';
    }
  }

  function normalizePlacementCopy() {
    const section = findCapacitySection();
    if (!section) return;

    section.querySelectorAll('p.note').forEach(note => {
      const text = note.textContent || '';
      if (text.includes('40m間隔をもとに配置余地を概算')) {
        note.innerHTML = note.innerHTML.replace(
          '40m間隔をもとに配置余地を概算',
          '50m間隔を原則として配置余地を概算'
        );
      }
    });

    const result = document.getElementById('capacityResult');
    if (result) {
      const currentHtml = result.innerHTML;
      const nextHtml = currentHtml
        .replace(/配置余地チェック結果/g, '配置戦略解析結果')
        .replace(/2\. 候補POIの生成設定/g, '2. 配置戦略を選ぶ');
      if (nextHtml !== currentHtml) result.innerHTML = nextHtml;
    }

    const placement = document.getElementById('placementResult');
    if (placement) {
      const currentHtml = placement.innerHTML;
      const nextHtml = currentHtml
        .replace(/既存POI40m円除外後/g, '既存POI50m円除外後')
        .replace(/40m条件後/g, '50m条件後')
        .replace(/<div class="placement-title">🌿 配置余地<\/div>/g, '<div class="placement-title">🧠 配置戦略評価</div>');
      if (nextHtml !== currentHtml) placement.innerHTML = nextHtml;
    }

    ensurePolicyBanner();
    ensureLaunchButtonCopy();
  }

  function setupUiObserver() {
    normalizePlacementCopy();

    const target = document.getElementById('capacityResult');
    if (!target || target.dataset.placementStrategyObserverReady === 'true') return;

    target.dataset.placementStrategyObserverReady = 'true';
    new MutationObserver(() => {
      requestAnimationFrame(normalizePlacementCopy);
    }).observe(target, { childList: true, subtree: true });
  }

  function renderStrategyModeSelector() {
    return `
      <div class="placement-strategy-selector">
        <div class="placement-strategy-selector__lead">
          <strong>布陣を選択</strong>
          <span>布陣名をタップすると、現代風の意味を一言で表示します。</span>
        </div>
        <div class="placement-strategy-grid">
          ${Object.entries(STRATEGIES).map(([id, strategy]) => `
            <button
              type="button"
              class="placement-strategy-card ${strategyMode === id ? 'active' : ''}"
              data-placement-strategy="${id}"
              onclick="setPlacementStrategyMode('${id}')"
            >
              <span class="placement-strategy-card__icon">${strategy.icon}</span>
              <span class="placement-strategy-card__text">
                <strong>${strategy.label}</strong>
              </span>
              <span class="placement-strategy-card__check">${strategyMode === id ? '●' : '○'}</span>
            </button>
          `).join('')}
        </div>
        <div id="capacityModeMessage" class="placement-strategy-message">
          ${STRATEGIES[strategyMode].reason}
        </div>
      </div>
    `;
  }

  function refreshStrategySelectorState() {
    document.querySelectorAll('[data-placement-strategy]').forEach(button => {
      const id = button.dataset.placementStrategy;
      const active = id === strategyMode;
      button.classList.toggle('active', active);
      const check = button.querySelector('.placement-strategy-card__check');
      if (check) check.textContent = active ? '●' : '○';
    });

    const message = document.getElementById('capacityModeMessage');
    if (message) message.textContent = STRATEGIES[strategyMode].reason;
  }

  function setPlacementStrategyMode(mode) {
    if (!STRATEGIES[mode]) return;
    strategyMode = mode;
    refreshStrategySelectorState();

    const output = document.getElementById('candidatePreviewResult');
    if (output && output.textContent.trim()) {
      output.innerHTML = `
        <div class="placement-strategy-notice">
          布陣を「${STRATEGIES[mode].label}」へ変更しました。<br>
          もう一度「候補配置をプレビュー」を押して比較してください。
        </div>
      `;
    }
  }

  function getDistanceMeters(a, b) {
    const lat1 = Number(a?.lat);
    const lng1 = Number(a?.lng);
    const lat2 = Number(b?.lat);
    const lng2 = Number(b?.lng);
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;

    const rad = Math.PI / 180;
    const meanLat = ((lat1 + lat2) / 2) * rad;
    const dy = (lat2 - lat1) * 111320;
    const dx = (lng2 - lng1) * 111320 * Math.cos(meanLat);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getExistingPoi() {
    try {
      return (capacityState?.poi || []).filter(point => point.type !== 'add');
    } catch (_error) {
      return [];
    }
  }

  function nearestExistingDistance(point, existingPoi = getExistingPoi()) {
    if (!existingPoi.length) return 999;
    return Math.min(...existingPoi.map(existing => getDistanceMeters(point, existing)));
  }

  function nearestPickedDistance(point, picked) {
    if (!picked.length) return 140;
    return Math.min(...picked.map(existing => getDistanceMeters(point, existing)));
  }

  function scoreStrategyCandidate(point, picked, mode, existingPoi) {
    const edge = Number.isFinite(point.edgeDistance) ? point.edgeDistance : 0;
    const spread = nearestPickedDistance(point, picked);
    const existingGap = nearestExistingDistance(point, existingPoi);

    if (mode === 'interior') {
      return edge * 2.0 + Math.min(spread, 180) * 0.75 + Math.min(existingGap, 120) * 0.15;
    }

    if (mode === 'gap') {
      return Math.min(existingGap, 180) * 1.35 + Math.min(spread, 180) * 0.70 + Math.min(edge, 60) * 0.20;
    }

    return Math.min(spread, 180) * 1.25 + Math.min(edge, 80) * 0.45 + Math.min(existingGap, 120) * 0.25;
  }

  function pickStrategyCandidatePoints(points, count, mode) {
    const pool = [...points];
    const picked = [];
    const existingPoi = getExistingPoi();

    while (picked.length < count && pool.length) {
      const ranked = pool
        .map((point, index) => ({
          index,
          score: scoreStrategyCandidate(point, picked, mode, existingPoi)
        }))
        .sort((a, b) => b.score - a.score);

      const top = ranked.slice(0, Math.min(4, ranked.length));
      const selected = top[Math.floor(Math.random() * top.length)];
      picked.push(pool.splice(selected.index, 1)[0]);
    }

    return picked;
  }

  function getPreviewCounts() {
    return {
      pokestop: Number(document.getElementById('capacitySelect_pokestop')?.value || 0),
      gym: Number(document.getElementById('capacitySelect_gym')?.value || 0),
      power: Number(document.getElementById('capacitySelect_power')?.value || 0)
    };
  }

  function groupSelectedPoints(selectedPoints, counts) {
    let index = 0;
    const grouped = { pokestop: [], gym: [], power: [] };

    ['pokestop', 'gym', 'power'].forEach(kind => {
      for (let i = 0; i < counts[kind]; i++) {
        if (selectedPoints[index]) grouped[kind].push(selectedPoints[index]);
        index += 1;
      }
    });

    return grouped;
  }

  function getPreviewMetrics(points) {
    const existingPoi = getExistingPoi();
    const nearestExisting = points.map(point => nearestExistingDistance(point, existingPoi));
    const edgeDistances = points.map(point => Number(point.edgeDistance) || 0);

    let minCandidateSpacing = Infinity;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        minCandidateSpacing = Math.min(minCandidateSpacing, getDistanceMeters(points[i], points[j]));
      }
    }

    return {
      minCandidateSpacing: Number.isFinite(minCandidateSpacing) ? minCandidateSpacing : null,
      averageExistingDistance: nearestExisting.length
        ? nearestExisting.reduce((sum, value) => sum + value, 0) / nearestExisting.length
        : null,
      minBoundaryDistance: edgeDistances.length ? Math.min(...edgeDistances) : null
    };
  }

  function formatMeters(value) {
    return Number.isFinite(value) ? `${Math.round(value)}m` : '---';
  }

  function renderPreviewMarkers(grouped) {
    if (strategyPreviewLayer) strategyPreviewLayer.remove();
    strategyPreviewLayer = L.layerGroup().addTo(capacityPreviewMapInstance);

    const candidatePoints = [
      ...grouped.pokestop.map((point, i) => ({ ...point, kind: 'pokestop', name: `候補ポケストップ${i + 1}` })),
      ...grouped.gym.map((point, i) => ({ ...point, kind: 'gym', name: `候補ジム${i + 1}` })),
      ...grouped.power.map((point, i) => ({ ...point, kind: 'power', name: `候補パワースポット${i + 1}` }))
    ];

    const existingPoi = getExistingPoi();

    candidatePoints.forEach(point => {
      const existingDistance = nearestExistingDistance(point, existingPoi);
      const edgeDistance = Number(point.edgeDistance) || 0;

      L.circle([point.lat, point.lng], {
        radius: POLICY.preferredSpacingMeters,
        weight: 1,
        opacity: 0.28,
        fillOpacity: 0.025,
        interactive: false
      }).addTo(strategyPreviewLayer);

      L.circleMarker([point.lat, point.lng], {
        radius: 7,
        color: '#a855f7',
        fillColor: '#a855f7',
        weight: 2,
        fillOpacity: 0.92
      })
        .bindPopup(`
          <strong>${escapeCapacityHtml(point.name)}</strong><br>
          布陣：${escapeCapacityHtml(STRATEGIES[strategyMode].label)}<br>
          種別：${escapeCapacityHtml(CAPACITY_LABELS[point.kind] || point.kind)}<br>
          最寄り既存POI：約${Math.round(existingDistance)}m<br>
          活動範囲の端から：約${Math.round(edgeDistance)}m<br>
          <small>${escapeCapacityHtml(STRATEGIES[strategyMode].reason)}</small>
        `)
        .addTo(strategyPreviewLayer);
    });

    return candidatePoints;
  }

  function renderStrategyPreviewResult(counts, candidatePoints) {
    const output = document.getElementById('candidatePreviewResult');
    if (!output) return;

    const metrics = getPreviewMetrics(candidatePoints);
    const strategy = STRATEGIES[strategyMode];

    output.innerHTML = `
      <div class="placement-strategy-result">
        <div class="placement-strategy-result__head">
          <span class="placement-strategy-result__icon">${strategy.icon}</span>
          <div>
            <strong>${strategy.label}</strong>
            <small>${strategy.reason}</small>
          </div>
        </div>

        <div class="placement-strategy-metrics">
          <div><span>候補数</span><strong>${candidatePoints.length}</strong></div>
          <div><span>候補間の最小距離</span><strong>${formatMeters(metrics.minCandidateSpacing)}</strong></div>
          <div><span>既存POIとの平均距離</span><strong>${formatMeters(metrics.averageExistingDistance)}</strong></div>
          <div><span>境界からの最小余白</span><strong>${formatMeters(metrics.minBoundaryDistance)}</strong></div>
        </div>

        <div class="placement-strategy-breakdown">
          ポケストップ ${counts.pokestop}件 / ジム ${counts.gym}件 / パワースポット ${counts.power}件
        </div>

        <div class="placement-strategy-result__note">
          紫の円は各候補を中心とした50mの確認範囲です。候補は「置くべき場所」の確定ではなく、現地確認へ持ち出す比較案です。<br>
          同じ布陣でも再プレビューすると別案を試せます。
        </div>
      </div>
    `;
  }

  function previewPlacementStrategy() {
    let state;
    let previewMap;

    try {
      state = capacityState;
      previewMap = capacityPreviewMapInstance;
    } catch (_error) {
      state = null;
      previewMap = null;
    }

    if (!state) {
      alert('先に配置戦略を解析してください。');
      return;
    }

    if (!previewMap || typeof L === 'undefined') {
      alert('プレビューマップを読み込めませんでした。');
      return;
    }

    const counts = getPreviewCounts();
    const total = counts.pokestop + counts.gym + counts.power;

    if (total <= 0) {
      alert('プレビューする候補数を1件以上選択してください。');
      return;
    }

    if ((state.estimate?.points?.length || 0) < total) {
      alert('選択数に対して50m条件の配置余地が不足しています。');
      return;
    }

    const selectedPoints = pickStrategyCandidatePoints(state.estimate.points, total, strategyMode);
    const grouped = groupSelectedPoints(selectedPoints, counts);
    const candidatePoints = renderPreviewMarkers(grouped);

    try {
      capacityPreviewState = { counts, grouped };
    } catch (error) {
      console.warn('[Placement Strategy] preview state could not be shared with capacity.js', error);
    }

    const generateButton = document.getElementById('generateCandidatePoiButton');
    if (generateButton) generateButton.style.display = 'block';

    renderStrategyPreviewResult(counts, candidatePoints);
  }

  function installStrategyPatch() {
    if (installed) return true;

    const originalEstimateCapacityRandom = window.estimateCapacityRandom;
    const originalEstimateEffectiveFreeAreaGrid = window.estimateEffectiveFreeAreaGrid;
    const originalRenderPlacementSummaryCard = window.renderPlacementSummaryCard;

    if (typeof originalEstimateCapacityRandom !== 'function') return false;

    installed = true;

    window.CampsitePlacementStrategy = Object.freeze({
      policy: POLICY,
      strategies: STRATEGIES,
      mode: 'lab-overlay',
      base: 'capacity.js',
      getActiveStrategy: () => strategyMode
    });

    window.setPlacementStrategyMode = setPlacementStrategyMode;
    window.renderCapacityModeSelector = renderStrategyModeSelector;
    window.previewCandidatePoiPlacement = previewPlacementStrategy;

    window.estimateCapacityRandom = function placementStrategyEstimateCapacityRandom(
      polygon,
      blockingPoints,
      _legacyMinDistance,
      trialCount = 30000
    ) {
      return originalEstimateCapacityRandom(
        polygon,
        blockingPoints,
        POLICY.preferredSpacingMeters,
        trialCount
      );
    };

    if (typeof originalEstimateEffectiveFreeAreaGrid === 'function') {
      window.estimateEffectiveFreeAreaGrid = function placementStrategyEstimateEffectiveFreeAreaGrid(
        polygon,
        existingPoi,
        _legacyRadiusMeters,
        gridMeters = 10
      ) {
        return originalEstimateEffectiveFreeAreaGrid(
          polygon,
          existingPoi,
          POLICY.preferredSpacingMeters,
          gridMeters
        );
      };
    }

    if (typeof originalRenderPlacementSummaryCard === 'function') {
      window.renderPlacementSummaryCard = function placementStrategyRenderSummary(data) {
        originalRenderPlacementSummaryCard(data);
        normalizePlacementCopy();
      };
    }

    setupUiObserver();
    console.info('[Placement Strategy] active', POLICY, STRATEGIES);
    return true;
  }

  function waitForCapacityBase(attempt = 0) {
    if (installStrategyPatch()) return;

    if (attempt >= 100) {
      console.warn('[Placement Strategy] capacity.js did not become ready.');
      return;
    }

    window.setTimeout(() => waitForCapacityBase(attempt + 1), 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForCapacityBase(), { once: true });
  } else {
    waitForCapacityBase();
  }
})();