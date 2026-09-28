(() => {
  'use strict';

  const PROJECT_KEY = 'campsiteProject.v1';
  const MAP_KEY = 'campsiteDistanceMission4Viewed.v1';
  let timer = 0;
  let patching = false;

  function readProject() {
    try { return JSON.parse(sessionStorage.getItem(PROJECT_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function resultToken(project) {
    const result = project?.distanceResult || {};
    return String(result.designSignature || result.checkedAt || '');
  }

  function mapViewed(project) {
    if (!project || project?.distanceResult?.stale === true) return false;
    const token = resultToken(project);
    if (!token) return false;
    try { return sessionStorage.getItem(MAP_KEY) === token; }
    catch (_) { return false; }
  }

  function markMapViewed(project) {
    const token = resultToken(project);
    if (!token) return;
    try { sessionStorage.setItem(MAP_KEY, token); }
    catch (_) {}
  }

  function ensureStyles() {
    if (document.getElementById('campsiteMissionLayoutV2Styles')) return;
    const link = document.createElement('link');
    link.id = 'campsiteMissionLayoutV2Styles';
    link.rel = 'stylesheet';
    link.href = './css/bridge-distance-mission-layout-v2.css?v=1';
    document.head.appendChild(link);
  }

  function cardByKicker(shell, wanted) {
    return Array.from(shell.querySelectorAll(':scope > .campsite-mission-card')).find(card => {
      const kicker = card.querySelector('.campsite-mission-kicker');
      return String(kicker?.textContent || '').trim() === wanted;
    }) || null;
  }

  function setText(root, selector, text) {
    const node = root?.querySelector(selector);
    if (node) node.textContent = text;
  }

  function patchMission1(card) {
    if (!(card instanceof HTMLElement)) return;
    const list = card.querySelector('.campsite-pair-list');
    if (!(list instanceof HTMLElement) || card.querySelector('[data-v2-pair-toggle]')) return;
    if (!list.children.length) return;
    list.dataset.v2Collapsed = 'true';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'campsite-v2-toggle';
    button.dataset.v2PairToggle = '1';
    button.setAttribute('aria-expanded', 'false');
    button.textContent = '詳細を見る';
    list.insertAdjacentElement('beforebegin', button);
    button.addEventListener('click', () => {
      const opening = list.dataset.v2Collapsed === 'true';
      list.dataset.v2Collapsed = opening ? 'false' : 'true';
      button.setAttribute('aria-expanded', opening ? 'true' : 'false');
      button.textContent = opening ? '詳細を閉じる' : '詳細を見る';
    });
  }

  function environmentSummary(project) {
    const env = project?.siteEnvironment || project?.distanceSiteEnvironment || {};
    const traffic = ['easy', 'narrow', 'careful'].includes(env.traffic) ? env.traffic : null;
    const booleanText = value => typeof value === 'boolean' ? (value ? 'あり' : 'なし') : '未確認';
    const circulationText = typeof env.circulation === 'boolean' ? (env.circulation ? 'できる' : 'できない') : '未確認';
    const trafficText = traffic === 'easy' ? 'スムーズ' : traffic ? '⚠️ 注意' : '未確認';
    const complete = Boolean(traffic && typeof env.plaza === 'boolean' && typeof env.circulation === 'boolean' && typeof env.waiting === 'boolean');
    return {
      complete,
      html: `<div class="campsite-env-summary"><div class="campsite-env-summary-row"><span>🚶 通行</span><strong>${trafficText}</strong></div><div class="campsite-env-summary-row"><span>🏞 広場</span><strong>${booleanText(env.plaza)}</strong></div><div class="campsite-env-summary-row"><span>🔄 回遊</span><strong>${circulationText}</strong></div><div class="campsite-env-summary-row"><span>🪑 待機</span><strong>${booleanText(env.waiting)}</strong></div></div>`
    };
  }

  function patchMission3(card, project) {
    if (!(card instanceof HTMLElement)) return;
    setText(card, '.campsite-mission-prompt', '現地の使い方を確認しましょう');
    const body = card.querySelector('.campsite-mission-body');
    if (!(body instanceof HTMLElement)) return;
    const rows = Array.from(body.querySelectorAll(':scope > .campsite-env-row'));
    if (!rows.length) return;

    let editor = body.querySelector(':scope > .campsite-env-editor');
    if (!(editor instanceof HTMLElement)) {
      editor = document.createElement('div');
      editor.className = 'campsite-env-editor';
      rows[0].insertAdjacentElement('beforebegin', editor);
      rows.forEach(row => editor.appendChild(row));
    }
    editor.dataset.v2Collapsed = 'true';

    body.querySelector(':scope > .campsite-env-summary')?.remove();
    body.querySelector(':scope > [data-v2-env-toggle]')?.remove();
    const summary = environmentSummary(project);
    body.insertAdjacentHTML('afterbegin', summary.html);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'campsite-v2-toggle';
    toggle.dataset.v2EnvToggle = '1';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = summary.complete ? '確認内容を編集' : '現地確認を入力';
    body.querySelector(':scope > .campsite-env-summary')?.insertAdjacentElement('afterend', toggle);
    toggle.addEventListener('click', () => {
      const opening = editor.dataset.v2Collapsed === 'true';
      editor.dataset.v2Collapsed = opening ? 'false' : 'true';
      toggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
      toggle.textContent = opening ? '閉じる' : (summary.complete ? '確認内容を編集' : '現地確認を入力');
    });

    const sign = body.querySelector('.campsite-chairman-sign');
    if (sign && !summary.complete) sign.textContent = '⚠️ 現地環境の確認が残っています。現地で状況を確認して入力してください。';
  }

  function patchMapCard(card) {
    if (!(card instanceof HTMLElement)) return;
    setText(card, '.campsite-mission-kicker', 'MISSION 4');
    let prompt = card.querySelector('.campsite-mission-prompt');
    if (!prompt) {
      prompt = document.createElement('div');
      prompt.className = 'campsite-mission-prompt';
      card.querySelector('.campsite-mission-kicker')?.insertAdjacentElement('afterend', prompt);
    }
    prompt.textContent = '配置を地図で見てみましょう';
    setText(card, '.campsite-mission-title', '🗺️ 配置・マップ');
    const bodyText = card.querySelector('.campsite-mission-body > div');
    if (bodyText) bodyText.textContent = '既存POI・新規POI・活動範囲を確認します。地図はボタンを押した時だけ読み込みます。';
  }

  function patchFinalCard(card, goal) {
    if (!(card instanceof HTMLElement)) return;
    setText(card, '.campsite-mission-kicker', 'MISSION 5');
    setText(card, '.campsite-mission-prompt', '最後に確認して準備完了');
    setText(card, '.campsite-mission-title', '✅ 最終確認');
    const body = card.querySelector('.campsite-mission-body');
    if (!(body instanceof HTMLElement)) return;
    let note = body.querySelector('.campsite-v2-final-note');
    if (!note) {
      note = document.createElement('div');
      note.className = 'campsite-v2-final-note';
      note.textContent = 'この下の「セーブする」「CREATIVE MODEに戻って修正」「提出前チェック」から次の操作へ進めます。';
      body.appendChild(note);
    }
    if (goal instanceof HTMLElement && goal.parentElement !== body) body.appendChild(goal);
  }

  function patchAdvice(shell) {
    const advice = cardByKicker(shell, 'OPERATION TIPS');
    if (advice instanceof HTMLElement) advice.dataset.v2Hidden = 'true';
  }

  function patchProgress(shell, project) {
    const lamps = Array.from(shell.querySelectorAll('.campsite-mission-lamp'));
    if (lamps.length < 5) return;
    const labels = ['新規POI', '拠点', '現地', 'マップ', '最終'];
    labels.forEach((label, index) => setText(lamps[index], '.campsite-mission-label', label));

    const stale = project?.distanceResult?.stale === true;
    const duplicateBlocked = Boolean(shell.querySelector('.campsite-duplicate-alert'));
    const mapDone = mapViewed(project);
    lamps[3].dataset.state = stale ? 'gray' : mapDone ? 'green' : 'gray';
    const oldReady = lamps[4].dataset.state === 'green';
    lamps[4].dataset.state = (stale || duplicateBlocked) ? 'red' : (oldReady && mapDone) ? 'green' : 'yellow';
  }

  function patchShell() {
    if (patching) return;
    patching = true;
    try {
      const project = readProject();
      if (!project || project.source !== 'bridge') return;
      const result = document.getElementById('distanceResult');
      const shell = result?.querySelector(':scope > .campsite-mission-shell');
      if (!(shell instanceof HTMLElement)) return;
      shell.dataset.layoutV2 = 'true';
      document.body.classList.add('campsite-mission-layout-v2');

      const mission1 = cardByKicker(shell, 'MISSION 1');
      const mission3 = cardByKicker(shell, 'MISSION 3');
      const oldFinal = cardByKicker(shell, 'MISSION 4');
      const mapCard = cardByKicker(shell, 'OPTION');
      const goal = shell.querySelector(':scope > .campsite-goal');

      patchMission1(mission1);
      patchMission3(mission3, project);
      patchAdvice(shell);
      patchMapCard(mapCard);
      patchFinalCard(oldFinal, goal);
      if (mapCard instanceof HTMLElement && oldFinal instanceof HTMLElement && mapCard.nextElementSibling !== oldFinal) shell.insertBefore(mapCard, oldFinal);
      patchProgress(shell, project);

      const mapButton = mapCard?.querySelector('[data-mission-map]');
      if (mapButton instanceof HTMLElement && mapButton.dataset.v2Hooked !== 'true') {
        mapButton.dataset.v2Hooked = 'true';
        mapButton.addEventListener('click', () => {
          const latest = readProject();
          if (latest && latest.source === 'bridge') markMapViewed(latest);
          setTimeout(schedulePatch, 80);
        });
      }
    } finally {
      patching = false;
    }
  }

  function focusMission4() {
    const shell = document.querySelector('#distanceResult > .campsite-mission-shell');
    const card = shell ? cardByKicker(shell, 'MISSION 4') : null;
    if (!(card instanceof HTMLElement)) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.remove('campsite-v2-focus');
    requestAnimationFrame(() => card.classList.add('campsite-v2-focus'));
  }

  function onPreSubmit(event) {
    const button = event.target?.closest?.('[data-go-pre-submit]');
    if (!button) return;
    const project = readProject();
    if (!project || project.source !== 'bridge') return;
    if (project?.distanceResult?.stale === true || mapViewed(project)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    focusMission4();
  }

  function schedulePatch(delay = 120) {
    clearTimeout(timer);
    timer = setTimeout(patchShell, delay);
  }

  function boot() {
    const params = new URLSearchParams(location.search);
    if (params.get('campsiteProject') !== 'bridge') return;
    ensureStyles();
    document.addEventListener('click', onPreSubmit, true);
    const distance = document.getElementById('distance');
    if (distance instanceof HTMLElement) {
      const observer = new MutationObserver(() => schedulePatch(120));
      observer.observe(distance, { childList: true, subtree: true, characterData: true });
    }
    window.addEventListener('pageshow', () => schedulePatch(80));
    schedulePatch(650);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
