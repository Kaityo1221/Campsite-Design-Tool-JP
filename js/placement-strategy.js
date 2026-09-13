(() => {
  'use strict';

  const POLICY = Object.freeze({
    version: '2026-09-strategy-v1',
    preferredSpacingMeters: 50,
    referenceSpacingMeters: Object.freeze([40, 30]),
    boundaryMarginMeters: 15
  });

  let installed = false;

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

    const placement = document.getElementById('placementResult');
    if (placement) {
      placement.innerHTML = placement.innerHTML
        .replace(/既存POI40m円除外後/g, '既存POI50m円除外後')
        .replace(/40m条件後/g, '50m条件後');
    }

    ensurePolicyBanner();
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

  function installStrategyPatch() {
    if (installed) return true;

    const originalEstimateCapacityRandom = window.estimateCapacityRandom;
    const originalEstimateEffectiveFreeAreaGrid = window.estimateEffectiveFreeAreaGrid;
    const originalRenderPlacementSummaryCard = window.renderPlacementSummaryCard;

    if (typeof originalEstimateCapacityRandom !== 'function') {
      return false;
    }

    installed = true;

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
      return originalEstimateCapacityRandom(
        polygon,
        blockingPoints,
        POLICY.preferredSpacingMeters,
        trialCount
      );
    };

    // 配置余地の面積評価も50m基準へ統一する。
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

    // 旧カードのロジックを活かしつつ、Lab上の表示だけ現行ポリシーへ合わせる。
    if (typeof originalRenderPlacementSummaryCard === 'function') {
      window.renderPlacementSummaryCard = function placementStrategyRenderSummary(data) {
        originalRenderPlacementSummaryCard(data);
        normalizePlacementCopy();
      };
    }

    setupUiObserver();
    console.info('[Placement Strategy] active', POLICY);
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
