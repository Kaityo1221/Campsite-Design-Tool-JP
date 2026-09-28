(() => {
  'use strict';

  let timer = 0;

  function shell() {
    return document.querySelector('#distanceResult > .campsite-mission-shell');
  }

  function finalCard(root) {
    if (!(root instanceof HTMLElement)) return null;
    return root.querySelector(':scope > [data-v3-role="final"]') ||
      Array.from(root.querySelectorAll(':scope > .campsite-mission-card')).find(card =>
        String(card.querySelector('.campsite-mission-kicker')?.textContent || '').trim() === 'MISSION 5'
      ) || null;
  }

  function duplicateCount(root) {
    const alert = root?.querySelector(':scope > .campsite-duplicate-alert');
    if (!(alert instanceof HTMLElement)) return 0;
    const rows = alert.querySelectorAll('.campsite-duplicate-pair');
    if (rows.length) return rows.length;
    const match = String(alert.textContent || '').match(/重複POIが\s*(\d+)\s*組/);
    return match ? Number(match[1]) : 1;
  }

  function ensureAlertPosition(root) {
    const alert = root.querySelector(':scope > .campsite-duplicate-alert');
    if (!(alert instanceof HTMLElement)) return;
    if (root.firstElementChild !== alert) root.insertBefore(alert, root.firstElementChild);
  }

  function updateFinal(root, count) {
    const card = finalCard(root);
    const list = card?.querySelector('.campsite-final-list');
    if (!(list instanceof HTMLElement)) return;

    Array.from(list.querySelectorAll('.campsite-final-row')).forEach(row => {
      const value = String(row.textContent || '');
      if (value.includes('重複POI')) row.remove();
    });

    if (count <= 0) return;

    const row = document.createElement('div');
    row.className = 'campsite-final-row';
    row.dataset.duplicateFinal = '1';
    row.innerHTML = `<span>🚨</span><span>重複POIが${count}組見つかっています。CREATIVE MODEで修正してください。</span>`;
    list.appendChild(row);
  }

  function apply() {
    timer = 0;
    const root = shell();
    if (!(root instanceof HTMLElement)) return;
    ensureAlertPosition(root);
    updateFinal(root, duplicateCount(root));
  }

  function schedule(delay = 80) {
    clearTimeout(timer);
    timer = window.setTimeout(apply, delay);
  }

  function boot() {
    if (new URLSearchParams(location.search).get('campsiteProject') !== 'bridge') return;
    const distance = document.getElementById('distance');
    if (distance instanceof HTMLElement) {
      new MutationObserver(() => schedule()).observe(distance, { childList: true, subtree: true });
    }
    window.addEventListener('pageshow', () => schedule(60));
    schedule(760);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
