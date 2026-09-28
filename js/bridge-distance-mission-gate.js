(() => {
  'use strict';

  const PROJECT_KEY = 'campsiteProject.v1';
  let presentationQueued = false;

  function readProject() {
    try { return JSON.parse(sessionStorage.getItem(PROJECT_KEY) || 'null'); }
    catch (_) { return null; }
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

  function missionState(project) {
    const env = project?.siteEnvironment || {};
    const environmentComplete = (
      ['easy', 'narrow', 'careful'].includes(env.traffic) &&
      typeof env.plaza === 'boolean' &&
      typeof env.circulation === 'boolean' &&
      typeof env.waiting === 'boolean'
    );

    const points = (Array.isArray(project?.currentPois) ? project.currentPois : []).map(pointOf).filter(Boolean);
    let duplicateCount = 0;
    let unresolvedPairCount = 0;
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i];
        const b = points[j];
        const distance = distanceMeters(a, b);
        if (distance < 1) duplicateCount += 1;
        if (distance >= 50 || (a.role === 'existing' && b.role === 'existing')) continue;
        const added = [a, b].filter((point) => point.role === 'added');
        if (!added.length || added.some((point) => !point.comment)) unresolvedPairCount += 1;
      }
    }

    return {
      environmentComplete,
      duplicateCount,
      unresolvedPairCount,
      stale: project?.distanceResult?.stale === true,
    };
  }

  function ensureStyles() {
    if (document.getElementById('campsiteMissionGateStyles')) return;
    const style = document.createElement('style');
    style.id = 'campsiteMissionGateStyles';
    style.textContent = `
      #distance .distance-site-observation-step{display:none!important}
      .campsite-chairman-sign.campsite-mission-gate-pop{animation:campsiteMissionGatePop .46s ease both}
      .campsite-mission-card.campsite-stale-distance-card>.campsite-mission-body{display:none!important}
      .campsite-stale-mission-note{margin:0 16px 16px;padding:12px 13px;border:1px solid rgba(245,158,11,.5);border-radius:12px;background:rgba(245,158,11,.1);color:#fde68a;font-size:12px;font-weight:800;line-height:1.65}
      @keyframes campsiteMissionGatePop{0%{transform:scale(.94) rotate(-1.2deg)}55%{transform:scale(1.04) rotate(.6deg)}100%{transform:scale(1) rotate(-.35deg)}}
    `;
    document.head.appendChild(style);
  }

  function cardByKicker(shell, wanted) {
    return Array.from(shell.querySelectorAll('.campsite-mission-card')).find((card) => {
      const kicker = card.querySelector('.campsite-mission-kicker');
      return String(kicker?.textContent || '').trim() === wanted;
    }) || null;
  }

  function setLampState(shell, index, state) {
    const lamp = shell.querySelectorAll('.campsite-mission-lamp')[index];
    if (lamp instanceof HTMLElement && lamp.dataset.state !== state) lamp.dataset.state = state;
  }

  function addStaleNote(card) {
    if (!(card instanceof HTMLElement)) return;
    card.classList.add('campsite-stale-distance-card');
    if (card.querySelector(':scope > .campsite-stale-mission-note')) return;
    const note = document.createElement('div');
    note.className = 'campsite-stale-mission-note';
    note.textContent = '⚠️ 設計変更後の距離チェック待ちです。再チェックすると最新の結果を表示します。';
    card.appendChild(note);
  }

  function clearStalePresentation(shell) {
    shell.querySelectorAll('.campsite-stale-distance-card').forEach((card) => card.classList.remove('campsite-stale-distance-card'));
    shell.querySelectorAll('.campsite-stale-mission-note').forEach((note) => note.remove());
    const advice = cardByKicker(shell, 'OPERATION TIPS');
    if (advice instanceof HTMLElement && advice.dataset.staleHidden === 'true') {
      advice.style.removeProperty('display');
      delete advice.dataset.staleHidden;
    }
  }

  function applyStalePresentation() {
    presentationQueued = false;
    const project = readProject();
    const shell = document.querySelector('.campsite-mission-shell');
    if (!project || project.source !== 'bridge' || !(shell instanceof HTMLElement)) return;

    if (project?.distanceResult?.stale !== true) {
      clearStalePresentation(shell);
      return;
    }

    // 設計変更後は、距離由来のMISSION 1・2と運用ヒントを確定結果として見せない。
    addStaleNote(cardByKicker(shell, 'MISSION 1'));
    addStaleNote(cardByKicker(shell, 'MISSION 2'));
    const advice = cardByKicker(shell, 'OPERATION TIPS');
    if (advice instanceof HTMLElement && advice.dataset.staleHidden !== 'true') {
      advice.style.display = 'none';
      advice.dataset.staleHidden = 'true';
    }
    setLampState(shell, 0, 'yellow');
    setLampState(shell, 1, 'yellow');
    setLampState(shell, 3, 'red');
    setLampState(shell, 4, 'gray');
  }

  function queuePresentationSync() {
    if (presentationQueued) return;
    presentationQueued = true;
    requestAnimationFrame(applyStalePresentation);
  }

  function focusElement(selector) {
    const element = document.querySelector(selector);
    if (!(element instanceof HTMLElement)) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.remove('campsite-mission-gate-pop');
    requestAnimationFrame(() => element.classList.add('campsite-mission-gate-pop'));
  }

  function block(event, selector) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    focusElement(selector);
  }

  function onPreSubmit(event) {
    const button = event.target?.closest?.('[data-go-pre-submit]');
    if (!button) return;
    const project = readProject();
    if (!project || project.source !== 'bridge') return;
    const state = missionState(project);

    if (state.stale) {
      block(event, '#campsiteDistanceStaleWarning');
      return;
    }
    if (state.duplicateCount > 0) {
      block(event, '.campsite-duplicate-alert');
      return;
    }
    if (!state.environmentComplete) {
      block(event, '.campsite-chairman-sign');
      return;
    }
    // 50m未満のCAコメント不足は既存のcomment-gateに任せる。
  }

  function boot() {
    const params = new URLSearchParams(location.search);
    if (params.get('campsiteProject') !== 'bridge') return;
    ensureStyles();
    document.addEventListener('click', onPreSubmit, true);
    const observer = new MutationObserver(queuePresentationSync);
    observer.observe(document.body, { childList: true, subtree: true });
    queuePresentationSync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
