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

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function roleOf(poi) {
    if (poi?.role === 'added' || String(poi?.layer || '').startsWith('new-')) return 'added';
    return 'existing';
  }

  function pointOf(poi) {
    const lat = Number(poi?.lat);
    const lng = Number(poi?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      role: roleOf(poi),
      name: String(poi?.title || poi?.name || '名称なし').trim() || '名称なし',
      comment: String(poi?.description || poi?.memo || '').trim(),
    };
  }

  function distanceMeters(a, b) {
    const R = 6371000;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const q = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
  }

  function analyse(project) {
    const points = (Array.isArray(project?.currentPois) ? project.currentPois : []).map(pointOf).filter(Boolean);
    const missionPairs = [];
    const duplicatePairs = [];

    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i];
        const b = points[j];
        const distance = distanceMeters(a, b);
        if (distance < 1) duplicatePairs.push({ a, b, distance });
        if (distance >= 50 || (a.role === 'existing' && b.role === 'existing')) continue;
        const added = [a, b].filter(point => point.role === 'added');
        const confirmed = added.length > 0 && added.every(point => Boolean(point.comment));
        missionPairs.push({ a, b, distance, added, confirmed });
      }
    }

    return {
      missionPairs,
      duplicatePairs,
      unresolvedPairs: missionPairs.filter(pair => !pair.confirmed),
    };
  }

  function environmentState(project) {
    const env = project?.siteEnvironment || project?.distanceSiteEnvironment || {};
    const traffic = ['easy', 'narrow', 'careful'].includes(env.traffic) ? env.traffic : null;
    return {
      env,
      traffic,
      complete: Boolean(
        traffic &&
        typeof env.plaza === 'boolean' &&
        typeof env.circulation === 'boolean' &&
        typeof env.waiting === 'boolean'
      ),
    };
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
    link.href = './css/bridge-distance-mission-layout-v2.css?v=2';
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
    if (node && node.textContent !== text) node.textContent = text;
  }

  function pairKind(pair) {
    return pair.a.role === 'added' && pair.b.role === 'added' ? '新規 × 新規' : '新規 × 既存';
  }

  function pairHtml(pair) {
    const comments = pair.added.map(point => point.comment
      ? `<div>📝 ${esc(point.name)}：${esc(point.comment)}</div>`
      : `<div class="campsite-mission-warn">コメント未入力：${esc(point.name)}</div>`
    ).join('');
    return `<div class="campsite-pair"><strong>${pair.distance.toFixed(1)}m</strong><br>${esc(pair.a.name)} × ${esc(pair.b.name)}<br><span class="campsite-v2-pair-kind">${pairKind(pair)}</span><br><span class="${pair.confirmed ? 'campsite-mission-ok' : 'campsite-mission-warn'}">${pair.confirmed ? '✅ CA確認済み' : '⚠️ CA確認待ち'}</span>${comments}</div>`;
  }

  function patchMission1(card, analysis) {
    if (!(card instanceof HTMLElement)) return;
    const list = card.querySelector('.campsite-pair-list');
    if (!(list instanceof HTMLElement)) return;

    if (list.dataset.v2Built !== 'true') {
      list.dataset.v2Built = 'true';
      list.innerHTML = analysis.missionPairs.map(pairHtml).join('') || '<div class="campsite-mission-ok">✅ 50m未満の候補はありません</div>';
    }
    if (card.querySelector('[data-v2-pair-toggle]')) return;

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
    const state = environmentState(project);
    const env = state.env;
    const booleanText = value => typeof value === 'boolean' ? (value ? 'あり' : 'なし') : '未確認';
    const circulationText = typeof env.circulation === 'boolean' ? (env.circulation ? 'できる' : 'できない') : '未確認';
    const trafficText = state.traffic === 'easy' ? 'スムーズ' : state.traffic ? '⚠️ 注意' : '未確認';
    return {
      complete: state.complete,
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

  function patchMapCard(card, analysis) {
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

    const body = card.querySelector('.campsite-mission-body');
    if (!(body instanceof HTMLElement)) return;
    let summary = body.querySelector('.campsite-v2-map-summary');
    if (!summary) {
      summary = document.createElement('div');
      summary.className = 'campsite-v2-map-summary';
      body.insertAdjacentElement('afterbegin', summary);
    }
    summary.innerHTML = `<div>既存POI・新規POI・活動範囲を確認</div>${analysis.missionPairs.length ? `<div>⚠️ 近接ライン ${analysis.missionPairs.length}組</div>` : ''}`;
    const oldText = Array.from(body.children).find(node => node !== summary && node.tagName === 'DIV' && !node.classList.contains('campsite-v2-map-summary'));
    if (oldText instanceof HTMLElement) oldText.style.display = 'none';
  }

  function missionReady(project, analysis) {
    const stale = project?.distanceResult?.stale === true;
    return {
      stale,
      envDone: environmentState(project).complete,
      mission1Done: analysis.unresolvedPairs.length === 0,
      duplicateBlocked: analysis.duplicatePairs.length > 0,
      mapDone: mapViewed(project),
    };
  }

  function patchFinalCard(card, project, analysis, goal) {
    if (!(card instanceof HTMLElement)) return;
    const state = missionReady(project, analysis);
    const ready = state.mission1Done && state.envDone && state.mapDone && !state.stale && !state.duplicateBlocked;

    setText(card, '.campsite-mission-kicker', 'MISSION 5');
    setText(card, '.campsite-mission-prompt', '最後に確認して準備完了');
    setText(card, '.campsite-mission-title', '✅ 最終確認');

    const body = card.querySelector('.campsite-mission-body');
    if (!(body instanceof HTMLElement)) return;
    const list = body.querySelector('.campsite-final-list');
    if (list instanceof HTMLElement) {
      const rows = [];
      rows.push(`<div class="campsite-final-row"><span>${state.mission1Done ? '✅' : '⚠️'}</span><span>${state.mission1Done ? '50m未満の候補はすべてCA確認済みです' : `未確認の50m未満POIが${analysis.unresolvedPairs.length}組あります`}</span></div>`);
      rows.push(`<div class="campsite-final-row"><span>${state.envDone ? '✅' : '⚠️'}</span><span>${state.envDone ? '現地環境を確認済みです' : '現地環境の確認が残っています'}</span></div>`);
      rows.push(`<div class="campsite-final-row"><span>${state.mapDone ? '✅' : '⚪️'}</span><span>${state.mapDone ? '配置・マップを確認済みです' : '配置・マップを確認してください'}</span></div>`);
      rows.push(`<div class="campsite-final-row"><span>${state.stale ? '🔴' : '✅'}</span><span>${state.stale ? 'CREATIVE MODEで設計が変更されています。距離チェックを再実行してください。' : '距離チェック結果は現在の設計です'}</span></div>`);
      if (state.duplicateBlocked) rows.push(`<div class="campsite-final-row"><span>🚨</span><span>重複POIが${analysis.duplicatePairs.length}組あります。上の修正候補を確認してください。</span></div>`);
      list.innerHTML = rows.join('');
    }

    body.querySelector(':scope > .campsite-v2-final-actions')?.remove();
    const actions = document.createElement('div');
    actions.className = 'campsite-v2-final-actions';
    actions.innerHTML = `<button type="button" data-v2-save>💾 セーブする</button><button type="button" data-v2-rework>✏️ CREATIVE MODEに戻って修正</button><button type="button" data-v2-submit ${ready ? '' : 'disabled'}>提出前チェックへ進む</button><div class="campsite-v2-action-status" data-v2-action-status></div>`;
    body.appendChild(actions);

    const actionStatus = actions.querySelector('[data-v2-action-status]');
    actions.querySelector('[data-v2-save]')?.addEventListener('click', async () => {
      if (typeof window.CampsiteDistanceBackup?.save === 'function') {
        if (actionStatus) actionStatus.textContent = 'バックアップKMZを作成しています…';
        try { await window.CampsiteDistanceBackup.save(actionStatus); }
        catch (_) { if (actionStatus) actionStatus.textContent = '保存できませんでした。もう一度お試しください。'; }
        return;
      }
      const original = document.querySelector('[data-distance-checkpoint-save]');
      if (original instanceof HTMLElement) original.click();
    });
    actions.querySelector('[data-v2-rework]')?.addEventListener('click', () => {
      const original = document.querySelector('[data-project-rework]');
      if (original instanceof HTMLElement) original.click();
      else location.href = './creative/index.html?campsiteProject=bridge';
    });
    actions.querySelector('[data-v2-submit]')?.addEventListener('click', () => {
      const original = document.querySelector('[data-go-pre-submit]');
      if (original instanceof HTMLElement) original.click();
    });

    if (goal instanceof HTMLElement) {
      goal.dataset.ready = ready ? 'true' : 'false';
      const goalTitle = goal.querySelector('.campsite-goal-title');
      const goalNote = goal.querySelector('.campsite-goal-note');
      if (goalTitle) goalTitle.textContent = ready ? '🟢 準備完了！' : (state.stale || state.duplicateBlocked ? '🔴 修正・再確認が必要です' : '🟡 確認が残っています');
      if (goalNote) goalNote.textContent = ready ? '必要な確認がすべて揃いました。' : '黄色・赤・グレーのMISSIONを確認してください。';
      if (goal.parentElement !== body) body.appendChild(goal);
    }
  }

  function patchAdvice(shell) {
    const advice = cardByKicker(shell, 'OPERATION TIPS');
    if (advice instanceof HTMLElement) advice.dataset.v2Hidden = 'true';
  }

  function patchProgress(shell, project, analysis) {
    const lamps = Array.from(shell.querySelectorAll('.campsite-mission-lamp'));
    if (lamps.length < 5) return;
    const labels = ['新規POI', '拠点', '現地', '地図', '最終'];
    labels.forEach((label, index) => setText(lamps[index], '.campsite-mission-label', label));

    const state = missionReady(project, analysis);
    const ready = state.mission1Done && state.envDone && state.mapDone && !state.stale && !state.duplicateBlocked;
    lamps[0].dataset.state = state.stale ? 'yellow' : (state.mission1Done ? 'green' : 'yellow');
    lamps[1].dataset.state = state.stale ? 'yellow' : 'green';
    lamps[2].dataset.state = state.envDone ? 'green' : 'yellow';
    lamps[3].dataset.state = state.stale ? 'red' : (state.mapDone ? 'green' : 'gray');
    lamps[4].dataset.state = (state.stale || state.duplicateBlocked) ? 'red' : (ready ? 'green' : 'yellow');
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

      const analysis = analyse(project);
      const mission1 = cardByKicker(shell, 'MISSION 1');
      const mission3 = cardByKicker(shell, 'MISSION 3');
      const oldFinal = cardByKicker(shell, 'MISSION 4');
      const mapCard = cardByKicker(shell, 'OPTION');
      const goal = shell.querySelector(':scope > .campsite-goal');

      patchMission1(mission1, analysis);
      patchMission3(mission3, project);
      patchAdvice(shell);
      patchMapCard(mapCard, analysis);
      patchFinalCard(oldFinal, project, analysis, goal);
      if (mapCard instanceof HTMLElement && oldFinal instanceof HTMLElement && mapCard.nextElementSibling !== oldFinal) shell.insertBefore(mapCard, oldFinal);
      patchProgress(shell, project, analysis);

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
