(() => {
  'use strict';

  const POLICY = Object.freeze({
    version: '2026-09-strategy-v1',
    preferredSpacingMeters: 50,
    referenceSpacingMeters: Object.freeze([40, 30]),
    boundaryMarginMeters: 15
  });

  const originals = {
    estimateCapacityRandom: window.estimateCapacityRandom,
    estimateEffectiveFreeAreaGrid: window.estimateEffectiveFreeAreaGrid,
    renderPlacementSummaryCard: window.renderPlacementSummaryCard
  };

  if (typeof originals.estimateCapacityRandom !== 'function') {
    console.warn('[Placement Strategy] capacity.js is not ready. Strategy patch skipped.');
    return;
  }

  window.CampsitePlacementStrategy = Object.freeze({
    policy: POLICY,
    mode: 'lab-overlay',
    base: 'capacity.js'
  });

  // Labの配置戦略モードだけ、候補生成の最低間隔を50mへ統一する。
  window.estimateCapacityRandom = function placementStrategyEstimateCapacityRandom(
    polygon,
    blockingPoints,
    _legacyMinDistance,
    trialCount = 30000
  ) {
    return originals.estimateCapacityRandom(
      polygon,
      blockingPoints,
      POLICY.preferredSpacingMeters,
      trialCount
    );
  };

  // 配置余地の面積評価も50m基準へ統一する。
  if (typeof originals.estimateEffectiveFreeAreaGrid === 'function') {
    window.estimateEffectiveFreeAreaGrid = function placementStrategyEstimateEffectiveFreeAreaGrid(
      polygon,
      existingPoi,
      _legacyRadiusMeters,
      gridMeters = 10
    ) {
      return originals.estimateEffectiveFreeAreaGrid(
        polygon,
        existingPoi,
        POLICY.preferredSpacingMeters,
        gridMeters
      );
    };
  }

  // 旧カードの計算ロジックを活かしつつ、Lab上の表示だけ現行ポリシーへ合わせる。
  if (typeof originals.renderPlacementSummaryCard === 'function') {
    window.renderPlacementSummaryCard = function placementStrategyRenderSummary(data) {
      originals.renderPlacementSummaryCard(data);
      const container = document.getElementById('placementResult');
      if (!container) return;

      container.innerHTML = container.innerHTML
        .replace(/既存POI40m円除外後/g, '既存POI50m円除外後')
        .replace(/40m条件後/g, '50m条件後');
    };
  }

  function findCapacitySection() {
    const fileInput = document.getElementById('capacityFile');
    if (!fileInput) return null;
    return fileInput.closest('.step')?.parentElement || fileInput.closest('.panel') || null;
  }

  function ensurePolicyBanner() {
    if (document.getElementById('placementStrategyPolicyBanner')) return;

    const fileInput = document.getElementById('capacityFile');
    const step = fileInput?.closest('.step');
    if (!step) return;

    const banner = document.createElement('div');
    banner.id = 'placementStrategyPolicyBanner';
    banner.className = 'placement-strategy-policy';
    banner.innerHTML = `
      <div class="placement-strategy-policy__title">🧬 配置戦略ポリシー</div>
      <div class="placement-strategy-policy__main">原則 <strong>50m</strong> 間隔で候補余地を評価します。</div>
      <div class="placement-strategy-policy__sub">40m / 30m は参考距離です。候補生成の合格条件には使用しません。</div>
      <div class="placement-strategy-policy__version">${POLICY.version}</div>
    `;

    step.insertAdjacentElement('afterbegin', banner);
  }

  function refreshCapacityCopy() {
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

    ensurePolicyBanner();
  }

  function setup() {
    refreshCapacityCopy();

    const target = document.getElementById('capacityResult');
    if (target && target.dataset.placementStrategyObserverReady !== 'true') {
      target.dataset.placementStrategyObserverReady = 'true';
      new MutationObserver(() => {
        requestAnimationFrame(() => {
          const placement = document.getElementById('placementResult');
          if (placement) {
            placement.innerHTML = placement.innerHTML
              .replace(/既存POI40m円除外後/g, '既存POI50m円除外後')
              .replace(/40m条件後/g, '50m条件後');
          }
        });
      }).observe(target, { childList: true, subtree: true });
    }

    console.info('[Placement Strategy] active', POLICY);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();
