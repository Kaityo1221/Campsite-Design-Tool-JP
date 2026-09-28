(() => {
  'use strict';

  let timer = 0;
  const REMOVE_TITLES = ['拠点充実度', '判定結果'];

  function cleanup() {
    timer = 0;
    const legacy = document.querySelector('#distanceResult > .campsite-mission-legacy');
    if (!(legacy instanceof HTMLElement)) return;

    legacy.querySelectorAll('.distance-result-section').forEach(section => {
      const heading = section.querySelector('.distance-result-heading');
      const title = String(heading?.textContent || section.getAttribute('data-result-title') || '').trim();
      if (REMOVE_TITLES.some(target => title.includes(target))) section.remove();
    });

    // Safety net for older markup where the score panel was not wrapped yet.
    Array.from(legacy.children).forEach(child => {
      if (!(child instanceof HTMLElement) || child.classList.contains('distance-result-map')) return;
      const text = String(child.textContent || '');
      if (text.includes('拠点充実度') && (text.includes('100') || /[SABC][+\-]?/.test(text) || text.includes('★'))) {
        child.remove();
      }
    });

    legacy.dataset.scoringUiRemoved = 'true';
  }

  function schedule(delay = 80) {
    clearTimeout(timer);
    timer = window.setTimeout(cleanup, delay);
  }

  function boot() {
    if (new URLSearchParams(location.search).get('campsiteProject') !== 'bridge') return;
    const result = document.getElementById('distanceResult');
    if (result instanceof HTMLElement) {
      new MutationObserver(() => schedule()).observe(result, { childList: true, subtree: true });
    }
    window.addEventListener('pageshow', () => schedule(60));
    schedule(700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
