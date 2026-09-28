(() => {
  'use strict';

  let renderTimer = 0;
  let busy = false;

  function missionShell() {
    return document.querySelector('#distanceResult > .campsite-mission-shell');
  }

  function finalCard(shell) {
    if (!(shell instanceof HTMLElement)) return null;
    return shell.querySelector(':scope > [data-v3-role="final"]') ||
      Array.from(shell.querySelectorAll(':scope > .campsite-mission-card')).find(card =>
        String(card.querySelector('.campsite-mission-kicker')?.textContent || '').trim() === 'MISSION 5'
      ) || null;
  }

  function missionReady(shell) {
    const canonical = window.CampsiteMissionState?.getState?.();
    if (canonical?.mission5) return canonical.mission5 === 'green';
    const finalLamp = shell?.querySelectorAll('.campsite-mission-lamp')?.[4];
    return finalLamp instanceof HTMLElement && finalLamp.dataset.state === 'green';
  }

  function ensureActions(card) {
    const body = card?.querySelector('.campsite-mission-body');
    if (!(body instanceof HTMLElement)) return null;

    let actions = body.querySelector(':scope > .campsite-v2-final-actions');
    if (actions instanceof HTMLElement) return actions;

    actions = document.createElement('div');
    actions.className = 'campsite-v2-final-actions';
    actions.innerHTML = `
      <button type="button" data-v2-save>💾 セーブする</button>
      <button type="button" data-v2-rework>✏️ CREATIVE MODEに戻って修正</button>
      <button type="button" data-v2-submit>提出前チェックへ進む</button>
      <div class="campsite-v2-action-status" data-v2-action-status aria-live="polite"></div>
    `;

    const goal = body.querySelector(':scope > .campsite-goal');
    if (goal) goal.insertAdjacentElement('afterend', actions);
    else body.appendChild(actions);

    const status = actions.querySelector('[data-v2-action-status]');
    const save = actions.querySelector('[data-v2-save]');
    const rework = actions.querySelector('[data-v2-rework]');
    const submit = actions.querySelector('[data-v2-submit]');

    save?.addEventListener('click', async () => {
      if (!(save instanceof HTMLButtonElement) || save.disabled) return;
      save.disabled = true;
      if (status) status.textContent = 'バックアップKMZを作成しています…';
      try {
        if (window.CampsiteDistanceBackup?.save) {
          await window.CampsiteDistanceBackup.save(status);
        } else {
          const original = document.querySelector('[data-distance-checkpoint-save]');
          if (!(original instanceof HTMLElement)) throw new Error('save action unavailable');
          original.click();
          if (status) status.textContent = '保存処理を開始しました。';
        }
      } catch (error) {
        console.warn('[Campsite Mission 5] save failed', error);
        if (status) status.textContent = '保存できませんでした。もう一度お試しください。';
      } finally {
        save.disabled = false;
      }
    });

    rework?.addEventListener('click', () => {
      const original = document.querySelector('[data-project-rework]');
      if (original instanceof HTMLElement) {
        original.click();
        return;
      }
      if (status) status.textContent = 'CREATIVE MODEへ戻る準備ができていません。';
    });

    submit?.addEventListener('click', () => {
      if (!(submit instanceof HTMLButtonElement) || submit.disabled) return;
      const original = document.querySelector('[data-go-pre-submit]');
      if (original instanceof HTMLElement) {
        original.click();
        return;
      }
      if (status) status.textContent = '提出前チェックを開く準備ができていません。';
    });

    return actions;
  }

  function render() {
    renderTimer = 0;
    if (busy) return;
    busy = true;
    try {
      const shell = missionShell();
      const card = finalCard(shell);
      if (!(shell instanceof HTMLElement) || !(card instanceof HTMLElement)) return;

      const actions = ensureActions(card);
      const submit = actions?.querySelector('[data-v2-submit]');
      if (submit instanceof HTMLButtonElement) {
        const ready = missionReady(shell);
        if (submit.disabled === ready) submit.disabled = !ready;
        submit.setAttribute('aria-disabled', ready ? 'false' : 'true');
      }
    } finally {
      busy = false;
    }
  }

  function schedule(delay = 80) {
    clearTimeout(renderTimer);
    renderTimer = window.setTimeout(render, delay);
  }

  function boot() {
    if (new URLSearchParams(location.search).get('campsiteProject') !== 'bridge') return;
    const distance = document.getElementById('distance');
    if (distance instanceof HTMLElement) {
      new MutationObserver(() => schedule()).observe(distance, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-state', 'data-v3-role']
      });
    }
    window.addEventListener('pageshow', () => schedule(60));
    schedule(700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
