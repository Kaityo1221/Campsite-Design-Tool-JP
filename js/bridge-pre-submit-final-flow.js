(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('campsiteProject') !== 'bridge') return;

  function getPanel() {
    return document.querySelector('#check .panel');
  }

  function needsDistanceReview(panel) {
    return Array.from(panel.querySelectorAll('.pre-submit-item')).some(item => {
      if (item.dataset.state === 'ok') return false;
      const text = String(item.textContent || '');
      return text.includes('完成KMZで距離チェックを実施している') ||
        text.includes('重複POI候補を確認している');
    });
  }

  function firstUnfinishedItem(panel) {
    return panel.querySelector('.pre-submit-item[data-state="warn"], .pre-submit-item[data-state="ng"]');
  }

  function patchFinalCheckActions() {
    const panel = getPanel();
    if (!panel) return;

    const result = panel.querySelector('.pre-submit-result');
    const actions = result?.querySelector('.pre-submit-actions');
    if (!result || !actions) return;

    const ready = result.classList.contains('ready');
    const distanceButton = actions.querySelector('[data-pre-submit-distance]');
    const distanceReview = needsDistanceReview(panel);

    if (distanceButton) {
      distanceButton.style.display = distanceReview ? '' : 'none';
    }

    let reviewButton = actions.querySelector('[data-bridge-pre-submit-review]');
    if (!ready && !reviewButton) {
      reviewButton = document.createElement('button');
      reviewButton.type = 'button';
      reviewButton.dataset.bridgePreSubmitReview = '1';
      reviewButton.textContent = '未確認項目を確認する';
      actions.prepend(reviewButton);
    } else if (ready && reviewButton) {
      reviewButton.remove();
    }
  }

  function focusUnfinishedItem() {
    const panel = getPanel();
    const target = panel ? firstUnfinishedItem(panel) : null;
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const previousOutline = target.style.outline;
    const previousOffset = target.style.outlineOffset;
    target.style.outline = '3px solid rgba(245,158,11,.72)';
    target.style.outlineOffset = '3px';
    setTimeout(() => {
      target.style.outline = previousOutline;
      target.style.outlineOffset = previousOffset;
    }, 1400);
  }

  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-bridge-pre-submit-review]')) {
      focusUnfinishedItem();
      return;
    }

    if (event.target.closest?.('.tab-button, .opening-sign-area, [data-go-pre-submit]')) {
      setTimeout(patchFinalCheckActions, 40);
    }
  });

  document.addEventListener('change', event => {
    if (!event.target.closest?.('[data-pre-submit-manual]')) return;
    setTimeout(patchFinalCheckActions, 0);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(patchFinalCheckActions, 120), { once: true });
  } else {
    setTimeout(patchFinalCheckActions, 120);
  }
})();
