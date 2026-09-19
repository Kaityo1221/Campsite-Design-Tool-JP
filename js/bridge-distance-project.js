(() => {
  'use strict';

  const PROJECT_KEY = 'campsiteProject.v1';
  const FORMAL = {
    existing: {
      POKESTOP: '既存 PokéStop',
      GYM: '既存 Gym',
      POWERSPOT: '既存 PowerSpot'
    },
    added: {
      POKESTOP: '新規 PokéStop',
      GYM: '新規 Gym',
      POWERSPOT: '新規 PowerSpot'
    }
  };

  function readProject() {
    try { return JSON.parse(sessionStorage.getItem(PROJECT_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function writeProject(project) {
    project.updatedAt = new Date().toISOString();
    sessionStorage.setItem(PROJECT_KEY, JSON.stringify(project));
  }

  function entityOf(poi) {
    const raw = String(poi?.gameEntity || poi?.type || '').toUpperCase();
    if (raw === 'GYM' || raw === 'POWERSPOT') return raw;
    return 'POKESTOP';
  }

  function roleOf(poi) {
    if (poi?.role === 'added') return 'added';
    if (String(poi?.layer || '').startsWith('new-')) return 'added';
    return 'existing';
  }

  function toDistancePoint(poi) {
    const lat = Number(poi?.lat);
    const lng = Number(poi?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      id: String(poi?.id || poi?.guid || ''),
      guid: String(poi?.guid || ''),
      name: String(poi?.title || poi?.name || '名称なし'),
      title: String(poi?.title || poi?.name || '名称なし'),
      lat,
      lng,
      gameEntity: entityOf(poi),
      gameStatus: String(poi?.gameStatus || 'UNKNOWN'),
      sponsored: poi?.sponsored === true,
      smr: poi?.smr === true ? true : poi?.smr === false ? false : null,
      provenance: Array.isArray(poi?.provenance) ? poi.provenance.slice() : []
    };
  }

  function buildLayerPoints(project) {
    const groups = {};
    const current = Array.isArray(project?.currentPois) && project.currentPois.length
      ? project.currentPois
      : (Array.isArray(project?.selectedPois) ? project.selectedPois : []);

    current.forEach(raw => {
      const point = toDistancePoint(raw);
      if (!point) return;
      const role = roleOf(raw);
      const layer = FORMAL[role][point.gameEntity];
      (groups[layer] ||= []).push(point);
    });
    return groups;
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

  function buildDistanceSnapshot(project) {
    const pois = Array.isArray(project?.currentPois) ? project.currentPois.map(toDistancePoint).filter(Boolean) : [];
    const under50 = [];
    const under30 = [];
    const duplicates = [];
    let minDistance = null;
    for (let i = 0; i < pois.length; i++) {
      for (let j = i + 1; j < pois.length; j++) {
        const d = distanceMeters(pois[i], pois[j]);
        if (minDistance === null || d < minDistance) minDistance = d;
        const pair = {
          a: pois[i].guid || pois[i].id,
          b: pois[j].guid || pois[j].id,
          distance: Math.round(d * 10) / 10
        };
        if (d < 50) under50.push(pair);
        if (d < 30) under30.push(pair);
        if (d < 1) duplicates.push(pair);
      }
    }
    return {
      checkedAt: new Date().toISOString(),
      targetMeters: 50,
      poiCount: pois.length,
      addedCount: Array.isArray(project?.addedPois) ? project.addedPois.length : 0,
      under50Pairs: under50,
      under30Pairs: under30,
      duplicatePairs: duplicates,
      minDistance
    };
  }

  function renderProjectSourceNotice(project, groups) {
    const section = document.getElementById('distance');
    const panel = section?.querySelector('.panel');
    if (!panel) return;

    const title = panel.querySelector(':scope > h2');
    if (title) title.textContent = 'CREATIVE MODEの設計を距離チェック';
    const lead = title?.nextElementSibling;
    if (lead?.matches('p')) {
      lead.innerHTML = 'CREATIVE MODEで編集した現在のPOIと活動範囲を、そのまま距離チェックへ引き継いでいます。';
    }

    const fileInput = document.getElementById('distanceFile');
    const fileStep = fileInput?.closest('.step');
    if (fileStep) {
      const heading = fileStep.querySelector('h3');
      if (heading) heading.textContent = 'Campsite Projectを受け取り';
      const guide = fileStep.querySelector('.distance-file-guide');
      if (guide) guide.textContent = 'ファイル選択は不要です。CREATIVE MODEの設計結果を直接読み込んでいます。';
      if (fileInput) fileInput.style.display = 'none';
      const meta = fileStep.querySelector('.distance-file-meta');
      if (meta) meta.style.display = 'none';
      let badge = fileStep.querySelector('.campsite-project-distance-source');
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'campsite-project-distance-source';
        badge.style.cssText = 'margin:12px 0;padding:12px 14px;border:1px solid rgba(34,197,94,.38);border-radius:12px;background:rgba(34,197,94,.09);color:#dcfce7;font-size:13px;line-height:1.7';
        const slot = fileStep.querySelector('.distance-file-slot') || fileStep;
        slot.insertAdjacentElement('afterend', badge);
      }
      const count = Object.values(groups).reduce((sum, list) => sum + list.length, 0);
      badge.textContent = `✅ Campsite Project ${String(project.projectId || '').slice(0, 8)} · ${count}件のPOIを読み込み済み`;
    }
  }

  function populateDistanceUi(project, groups) {
    window._layerPoints = groups;
    window._activityPolygons = Array.isArray(project?.polygon) && project.polygon.length >= 3 ? [project.polygon] : [];
    window._hasPolygon = window._activityPolygons.length > 0;
    window._inputType = 'project';
    window._distanceSourceFile = null;
    window._distanceLayerNameWarnings = [];

    const list = document.getElementById('distanceLayerList');
    if (list && typeof window.renderLayerSelector === 'function') {
      list.innerHTML = '';
      window.renderLayerSelector(Object.keys(groups), list);
    }

    const summary = document.getElementById('distancePoiSummary');
    if (summary) {
      if (typeof window.countPoiTypesFromLayers === 'function' && typeof window.renderDistancePrecheckCompactHtml === 'function') {
        summary.innerHTML = window.renderDistancePrecheckCompactHtml(window.countPoiTypesFromLayers(groups));
      } else {
        const count = Object.values(groups).reduce((sum, values) => sum + values.length, 0);
        summary.textContent = `${count}件のPOIをCampsite Projectから読み込みました。`;
      }
    }

    renderProjectSourceNotice(project, groups);
  }

  function wrapDistanceCheck(project) {
    if (typeof window.runDistanceCheck !== 'function' || window.runDistanceCheck.__campsiteProjectWrapped) return;
    const original = window.runDistanceCheck;
    const wrapped = async function(...args) {
      const result = await original.apply(this, args);
      try {
        const latest = readProject() || project;
        latest.distanceResult = buildDistanceSnapshot(latest);
        latest.phase = 'distance';
        writeProject(latest);
      } catch (error) {
        console.warn('[Campsite Project] distance result persist failed', error);
      }
      setTimeout(() => installReworkAction(readProject() || project), 80);
      return result;
    };
    wrapped.__campsiteProjectWrapped = true;
    window.runDistanceCheck = wrapped;
  }

  function installReworkAction(project) {
    const result = document.getElementById('distanceResult');
    if (!result || !result.textContent.trim() || document.querySelector('[data-project-rework]')) return;

    const wrap = document.createElement('div');
    wrap.className = 'campsite-project-rework';
    wrap.style.cssText = 'margin:18px 0 6px;padding:14px;border:1px solid rgba(245,158,11,.38);border-radius:14px;background:rgba(245,158,11,.08)';
    wrap.innerHTML = '<button type="button" data-project-rework style="width:100%;min-height:48px;padding:12px 16px;border:1px solid rgba(245,158,11,.55);border-radius:12px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#1f1300;font-size:15px;font-weight:950;cursor:pointer">💾 保存して作り直す</button><div style="margin-top:8px;color:#fde68a;font-size:12px;line-height:1.6;text-align:center">現在の設計と距離チェック結果を保持してCREATIVE MODEへ戻ります。</div>';

    wrap.querySelector('[data-project-rework]')?.addEventListener('click', () => {
      const latest = readProject() || project;
      latest.phase = 'design';
      latest.rework = {
        requestedAt: new Date().toISOString(),
        source: 'distance'
      };
      writeProject(latest);
      location.href = './creative/index.html?campsiteProject=bridge';
    });

    const guide = document.querySelector('#distance .distance-checklist-guide');
    if (guide) guide.insertAdjacentElement('afterend', wrap);
    else result.insertAdjacentElement('afterend', wrap);
  }

  function installChecklistTracking(project) {
    document.addEventListener('click', event => {
      const button = event.target.closest?.('[data-go-pre-submit]');
      if (!button) return;
      try {
        const latest = readProject() || project;
        latest.phase = 'pre-submit';
        latest.preSubmit = {
          openedAt: new Date().toISOString(),
          source: 'campsiteProject.v1'
        };
        writeProject(latest);
      } catch (_) {}
    }, true);
  }

  function boot() {
    const params = new URLSearchParams(location.search);
    if (params.get('campsiteProject') !== 'bridge') return;
    const project = readProject();
    if (!project || project.source !== 'bridge') {
      location.replace('./index.html');
      return;
    }

    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      const section = document.getElementById('distance');
      if (!section || typeof window.runDistanceCheck !== 'function') {
        if (attempts >= 100) clearInterval(timer);
        return;
      }
      clearInterval(timer);
      const groups = buildLayerPoints(project);
      populateDistanceUi(project, groups);
      wrapDistanceCheck(project);
      installChecklistTracking(project);
      try { window.setWorkflowStep?.('distance'); } catch (_) {}
      try { window.openTab?.('distance'); } catch (_) { section.classList.add('active'); }
      setTimeout(() => renderProjectSourceNotice(project, groups), 250);
      window.CampsiteDistanceProject = Object.freeze({
        projectId: String(project.projectId || ''),
        source: 'bridge',
        poiCount: Object.values(groups).reduce((sum, list) => sum + list.length, 0),
        polygonCount: window._activityPolygons.length
      });
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
