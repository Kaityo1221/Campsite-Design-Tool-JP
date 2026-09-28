(() => {
  'use strict';

  const PROJECT_KEY = 'campsiteProject.v1';
  const MAP_VIEWED_KEY = 'campsiteDistanceMission4Viewed.v1';
  let timer = 0;
  let applying = false;

  function readProject() {
    try { return JSON.parse(sessionStorage.getItem(PROJECT_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function roleOf(poi) {
    if (poi?.role === 'added' || String(poi?.layer || '').toLowerCase().startsWith('new-')) return 'added';
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
      comment: String(poi?.description || poi?.memo || '').trim()
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

  function pairState(project) {
    const points = (Array.isArray(project?.currentPois) ? project.currentPois : []).map(pointOf).filter(Boolean);
    let unresolved = 0;
    let duplicates = 0;

    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i];
        const b = points[j];
        const distance = distanceMeters(a, b);
        if (distance < 1) duplicates += 1;
        if (distance >= 50 || (a.role === 'existing' && b.role === 'existing')) continue;

        const added = [a, b].filter(point => point.role === 'added');
        if (!added.length || added.some(point => !point.comment)) unresolved += 1;
      }
    }

    return { unresolved, duplicates };
  }

  function environmentState(project) {
    const env = project?.siteEnvironment || project?.distanceSiteEnvironment || {};
    const traffic = ['easy', 'narrow', 'careful'].includes(env.traffic) ? env.traffic : null;
    const plaza = typeof env.plaza === 'boolean' ? env.plaza : null;
    const circulation = typeof env.circulation === 'boolean' ? env.circulation : null;
    const waiting = typeof env.waiting === 'boolean' ? env.waiting : null;
    const values = [traffic, plaza, circulation, waiting];
    const entered = values.filter(value => value !== null).length;
    return {
      entered,
      complete: entered === 4
    };
  }

  function mapToken(project) {
    return String(project?.distanceResult?.designSignature || project?.distanceResult?.checkedAt || '');
  }

  function mapViewed(project) {
    if (!project || project?.distanceResult?.stale === true) return false;
    const token = mapToken(project);
    if (!token) return false;
    try { return sessionStorage.getItem(MAP_VIEWED_KEY) === token; }
    catch (_) { return false; }
  }

  function derive(project) {
    const stale = project?.distanceResult?.stale === true;
    const pairs = pairState(project);
    const environment = environmentState(project);
    const mapDone = mapViewed(project);

    const mission1 = stale ? 'yellow' : (pairs.unresolved > 0 ? 'yellow' : 'green');
    const mission2 = stale ? 'yellow' : 'green';
    const mission3 = environment.complete ? 'green' : (environment.entered > 0 ? 'yellow' : 'gray');
    const mission4 = stale ? 'gray' : (mapDone ? 'green' : 'gray');

    let mission5 = 'gray';
    if (stale || pairs.duplicates > 0) mission5 = 'red';
    else if ([mission1, mission2, mission3, mission4].every(state => state === 'green')) mission5 = 'green';
    else if ([mission1, mission2, mission3, mission4].some(state => state === 'yellow')) mission5 = 'yellow';

    return {
      mission1,
      mission2,
      mission3,
      mission4,
      mission5,
      stale,
      duplicateCount: pairs.duplicates,
      unresolvedPairCount: pairs.unresolved,
      environmentEntered: environment.entered,
      environmentComplete: environment.complete,
      mapViewed: mapDone
    };
  }

  function setLamp(lamp, state, index) {
    if (!(lamp instanceof HTMLElement)) return;
    lamp.dataset.state = state;
    const meanings = { green: '完了', yellow: '要確認', red: '修正が必要', gray: '未着手' };
    const label = String(lamp.querySelector('.campsite-mission-label')?.textContent || `MISSION ${index + 1}`).trim();
    lamp.setAttribute('aria-label', `${label}：${meanings[state] || state}`);
    lamp.title = meanings[state] || state;
  }

  function apply() {
    timer = 0;
    if (applying) return;
    applying = true;
    try {
      const project = readProject();
      const shell = document.querySelector('#distanceResult > .campsite-mission-shell');
      if (!project || project.source !== 'bridge' || !(shell instanceof HTMLElement)) return;

      const state = derive(project);
      const lamps = Array.from(shell.querySelectorAll('.campsite-mission-lamp'));
      [state.mission1, state.mission2, state.mission3, state.mission4, state.mission5]
        .forEach((value, index) => setLamp(lamps[index], value, index));

      shell.dataset.mission1State = state.mission1;
      shell.dataset.mission2State = state.mission2;
      shell.dataset.mission3State = state.mission3;
      shell.dataset.mission4State = state.mission4;
      shell.dataset.mission5State = state.mission5;
      shell.dataset.missionStateVersion = '1';

      const goal = shell.querySelector('.campsite-goal');
      if (goal instanceof HTMLElement) {
        goal.dataset.ready = state.mission5 === 'green' ? 'true' : 'false';
        const title = goal.querySelector('.campsite-goal-title');
        const note = goal.querySelector('.campsite-goal-note');
        if (state.mission5 === 'green') {
          if (title) title.textContent = '🟢 準備完了！';
          if (note) note.textContent = '必要な確認がすべて揃いました。';
        } else if (state.mission5 === 'red') {
          if (title) title.textContent = '🔴 修正・再確認が必要です';
          if (note) note.textContent = state.stale
            ? '設計が変更されています。距離チェックを再実行してください。'
            : '重複POIの修正候補を確認してください。';
        } else if (state.mission5 === 'yellow') {
          if (title) title.textContent = '🟡 確認が残っています';
          if (note) note.textContent = '黄色のMISSIONを確認してください。';
        } else {
          if (title) title.textContent = '⚪ 準備中';
          if (note) note.textContent = '未着手のMISSIONを確認してください。';
        }
      }
    } finally {
      applying = false;
    }
  }

  function schedule(delay = 60) {
    clearTimeout(timer);
    timer = window.setTimeout(apply, delay);
  }

  function boot() {
    if (new URLSearchParams(location.search).get('campsiteProject') !== 'bridge') return;
    const distance = document.getElementById('distance');
    if (distance instanceof HTMLElement) {
      new MutationObserver(() => schedule()).observe(distance, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    window.addEventListener('pageshow', () => schedule(80));
    window.CampsiteMissionState = Object.freeze({ getState: () => derive(readProject()), refresh: apply });
    schedule(760);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
