(() => {
  'use strict';

  const PROJECT_KEY = 'campsiteProject.v1';
  const WRAP_FLAG = '__campsiteMissionUiWrapped';
  let renderTimer = 0;
  let rendering = false;

  function readProject() {
    try { return JSON.parse(sessionStorage.getItem(PROJECT_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function writeProject(project) {
    project.updatedAt = new Date().toISOString();
    sessionStorage.setItem(PROJECT_KEY, JSON.stringify(project));
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

  function poiName(poi) {
    return String(poi?.title || poi?.name || '名称なし').trim() || '名称なし';
  }

  function poiComment(poi) {
    return String(poi?.description || poi?.memo || '').trim();
  }

  function pointOf(poi) {
    const lat = Number(poi?.lat);
    const lng = Number(poi?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { poi, lat, lng, role: roleOf(poi), name: poiName(poi), comment: poiComment(poi) };
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
    const existing = points.filter((point) => point.role === 'existing');
    const missionPairs = [];
    const existingPairs = [];
    const duplicatePairs = [];

    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i];
        const b = points[j];
        const distance = distanceMeters(a, b);
        const pair = { a, b, distance };
        if (distance < 1) duplicatePairs.push(pair);
        if (distance >= 50) continue;
        if (a.role === 'existing' && b.role === 'existing') existingPairs.push(pair);
        else missionPairs.push(pair);
      }
    }

    const confirmedPairs = missionPairs.filter((pair) => {
      const added = [pair.a, pair.b].filter((point) => point.role === 'added');
      return added.length > 0 && added.every((point) => Boolean(point.comment));
    });
    const unresolvedPairs = missionPairs.filter((pair) => !confirmedPairs.includes(pair));

    const bands = { under20: 0, between20_30: 0, between30_50: 0 };
    existingPairs.forEach((pair) => {
      if (pair.distance < 20) bands.under20 += 1;
      else if (pair.distance < 30) bands.between20_30 += 1;
      else bands.between30_50 += 1;
    });

    return { points, existing, missionPairs, confirmedPairs, unresolvedPairs, existingPairs, duplicatePairs, bands };
  }

  function environmentOf(project) {
    const source = project?.siteEnvironment || project?.distanceSiteEnvironment || {};
    return {
      traffic: ['easy', 'narrow', 'careful'].includes(source.traffic) ? source.traffic : null,
      plaza: typeof source.plaza === 'boolean' ? source.plaza : null,
      circulation: typeof source.circulation === 'boolean' ? source.circulation : null,
      waiting: typeof source.waiting === 'boolean' ? source.waiting : null,
    };
  }

  function environmentComplete(env) {
    return Boolean(env.traffic && typeof env.plaza === 'boolean' && typeof env.circulation === 'boolean' && typeof env.waiting === 'boolean');
  }

  function syncLegacyChecks(env) {
    const traffic = document.getElementById('trafficOk');
    const plaza = document.getElementById('hasOpenSpace');
    const circulation = document.getElementById('hasLoopRoute');
    const waiting = document.getElementById('hasWaitingSpace');
    if (traffic) traffic.checked = env.traffic === 'easy';
    if (plaza) plaza.checked = env.plaza === true;
    if (circulation) circulation.checked = env.circulation === true;
    if (waiting) waiting.checked = env.waiting === true;
  }

  function persistEnvironment(key, value) {
    const project = readProject();
    if (!project) return;
    const env = environmentOf(project);
    env[key] = value;
    project.siteEnvironment = env;
    writeProject(project);
    syncLegacyChecks(env);
    scheduleRender(0);
  }

  function ensureStyles() {
    if (document.getElementById('campsiteMissionUiStyles')) return;
    const style = document.createElement('style');
    style.id = 'campsiteMissionUiStyles';
    style.textContent = `
      #distanceResult.campsite-mission-mode{margin-top:16px}
      #distanceResult .campsite-mission-legacy{display:block!important;margin:0}
      #distanceResult .campsite-mission-legacy>:not(.distance-result-map){display:none!important}
      #distanceResult .campsite-mission-legacy>.distance-result-map{display:none!important}
      #distanceResult .campsite-mission-legacy[data-map-open="true"]>.distance-result-map{display:block!important}
      .campsite-mission-shell{display:flex;flex-direction:column;gap:14px;color:#e5e7eb}
      .campsite-mission-progress{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;padding:11px;border:1px solid rgba(148,163,184,.22);border-radius:15px;background:rgba(15,23,42,.78);position:sticky;top:6px;z-index:30;backdrop-filter:blur(12px)}
      .campsite-mission-lamp{text-align:center;min-width:0}.campsite-mission-dot{width:15px;height:15px;margin:0 auto 5px;border-radius:999px;background:#475569;box-shadow:0 0 0 3px rgba(71,85,105,.18)}
      .campsite-mission-lamp[data-state="green"] .campsite-mission-dot{background:#22c55e;box-shadow:0 0 13px rgba(34,197,94,.72),0 0 0 3px rgba(34,197,94,.16)}
      .campsite-mission-lamp[data-state="yellow"] .campsite-mission-dot{background:#f59e0b;box-shadow:0 0 13px rgba(245,158,11,.65),0 0 0 3px rgba(245,158,11,.15)}
      .campsite-mission-lamp[data-state="red"] .campsite-mission-dot{background:#ef4444;box-shadow:0 0 13px rgba(239,68,68,.68),0 0 0 3px rgba(239,68,68,.15)}
      .campsite-mission-label{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cbd5e1;font-size:10px;font-weight:850}
      .campsite-mission-card{overflow:hidden;border:1px solid rgba(148,163,184,.24);border-radius:17px;background:linear-gradient(150deg,rgba(15,23,42,.92),rgba(15,23,42,.70));box-shadow:0 12px 35px rgba(2,6,23,.18)}
      .campsite-mission-head{padding:15px 16px 10px}.campsite-mission-kicker{color:#7dd3fc;font-size:10px;font-weight:950;letter-spacing:.12em}.campsite-mission-prompt{margin-top:5px;color:#cbd5e1;font-size:12px;font-weight:850;line-height:1.5}.campsite-mission-title{margin:4px 0 0;color:#f8fafc;font-size:18px;font-weight:950;line-height:1.4}.campsite-mission-body{padding:0 16px 16px}
      .campsite-mission-stat{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(148,163,184,.12);font-size:13px}.campsite-mission-stat:last-child{border-bottom:0}.campsite-mission-big{font-size:24px;font-weight:950;color:#fff}.campsite-mission-ok{color:#86efac;font-weight:900}.campsite-mission-warn{color:#fde68a;font-weight:900}
      .campsite-pair-list{margin-top:10px;display:flex;flex-direction:column;gap:8px}.campsite-pair{padding:10px 11px;border:1px solid rgba(148,163,184,.18);border-radius:11px;background:rgba(2,6,23,.28);font-size:12px;line-height:1.65}
      .campsite-density-bar{display:flex;height:14px;margin:12px 0 8px;border-radius:999px;overflow:hidden;background:rgba(148,163,184,.13)}.campsite-density-bar span:nth-child(1){background:#ef4444}.campsite-density-bar span:nth-child(2){background:#f97316}.campsite-density-bar span:nth-child(3){background:#eab308}.campsite-density-note{margin-top:10px;color:#94a3b8;font-size:11px;line-height:1.65}
      .campsite-env-row{margin-top:12px}.campsite-env-label{margin-bottom:7px;color:#e2e8f0;font-size:12px;font-weight:900}.campsite-env-options{display:flex;flex-wrap:wrap;gap:7px}.campsite-env-option{padding:8px 10px;border:1px solid rgba(148,163,184,.25);border-radius:999px;background:rgba(15,23,42,.78);color:#cbd5e1;font-size:11px;font-weight:850;cursor:pointer}.campsite-env-option[aria-pressed="true"]{border-color:rgba(34,197,94,.58);background:rgba(34,197,94,.14);color:#dcfce7;box-shadow:0 0 0 2px rgba(34,197,94,.08)}
      .campsite-chairman-sign{margin-top:14px;padding:15px 14px;border:3px solid #7c4a21;border-radius:8px;background:linear-gradient(180deg,#d6a766,#b97b38);color:#2d1808;text-align:center;box-shadow:0 9px 18px rgba(0,0,0,.24),inset 0 0 0 2px rgba(255,255,255,.17);transform:rotate(-.35deg)}.campsite-chairman-sign strong{display:block;font-size:13px}.campsite-chairman-sign b{display:block;margin-top:7px;font-size:18px;line-height:1.55}
      .campsite-advice-list{display:flex;flex-direction:column;gap:9px}.campsite-advice-item{padding:11px 12px;border:1px solid rgba(34,197,94,.22);border-radius:12px;background:rgba(34,197,94,.07);font-size:12px;line-height:1.7}.campsite-advice-cat{display:block;margin-bottom:3px;color:#86efac;font-size:10px;font-weight:950;letter-spacing:.06em}
      .campsite-final-list{display:flex;flex-direction:column;gap:7px}.campsite-final-row{display:flex;gap:8px;align-items:flex-start;padding:8px 9px;border-radius:10px;background:rgba(148,163,184,.07);font-size:12px;line-height:1.55}
      .campsite-goal{padding:18px 16px;text-align:center;border:1px solid rgba(34,197,94,.28);border-radius:17px;background:radial-gradient(circle at top,rgba(34,197,94,.14),transparent 60%),rgba(15,23,42,.82)}.campsite-goal[data-ready="false"]{border-color:rgba(148,163,184,.22);background:rgba(15,23,42,.72)}.campsite-goal-title{margin-top:5px;font-size:21px;font-weight:950;color:#f8fafc}.campsite-goal-note{margin-top:6px;color:#cbd5e1;font-size:12px;line-height:1.6}
      .campsite-duplicate-alert{padding:15px;border:2px solid rgba(239,68,68,.6);border-radius:16px;background:rgba(127,29,29,.28);color:#fee2e2}.campsite-duplicate-alert strong{font-size:17px}.campsite-duplicate-alert button,.campsite-map-card button{width:100%;margin-top:10px;padding:10px 12px;border:0;border-radius:10px;background:#ef4444;color:#fff;font-weight:900;cursor:pointer}.campsite-duplicate-alert [data-duplicate-details]{border:1px solid rgba(254,226,226,.35);background:rgba(255,255,255,.08);color:#fee2e2}.campsite-duplicate-details{display:flex;flex-direction:column;gap:7px;margin-top:10px}.campsite-duplicate-details[hidden]{display:none!important}.campsite-duplicate-pair{padding:9px 10px;border:1px solid rgba(254,226,226,.18);border-radius:10px;background:rgba(69,10,10,.28);font-size:12px;line-height:1.55}.campsite-map-card button{background:#0369a1}
      @media(max-width:520px){.campsite-mission-progress{top:4px;padding:9px 6px;gap:3px}.campsite-mission-label{font-size:9px}.campsite-mission-head{padding:13px 13px 8px}.campsite-mission-body{padding:0 13px 13px}.campsite-mission-title{font-size:17px}}
    `;
    document.head.appendChild(style);
  }

  function lamp(label, state) {
    return `<div class="campsite-mission-lamp" data-state="${state}"><div class="campsite-mission-dot"></div><span class="campsite-mission-label">${label}</span></div>`;
  }

  function pairHtml(pair) {
    const added = [pair.a, pair.b].filter((point) => point.role === 'added');
    const confirmed = added.length > 0 && added.every((point) => Boolean(point.comment));
    const comments = added.filter((point) => point.comment).map((point) => `📝 ${esc(point.name)}：${esc(point.comment)}`).join('<br>');
    const missing = added.filter((point) => !point.comment).map((point) => esc(point.name)).join(' / ');
    return `<div class="campsite-pair"><strong>${pair.distance.toFixed(1)}m</strong><br>${esc(pair.a.name)} × ${esc(pair.b.name)}<br><span class="${confirmed ? 'campsite-mission-ok' : 'campsite-mission-warn'}">${confirmed ? '✅ CA確認済み' : '⚠️ CA確認待ち'}</span>${comments ? `<div>${comments}</div>` : ''}${missing ? `<div>コメント未入力：${missing}</div>` : ''}</div>`;
  }

  function duplicatePairHtml(pair) {
    return `<div class="campsite-duplicate-pair"><strong>${pair.distance.toFixed(1)}m</strong><br>${esc(pair.a.name)} × ${esc(pair.b.name)}</div>`;
  }

  function envButton(key, value, label, current) {
    const active = current === value;
    return `<button type="button" class="campsite-env-option" data-env-key="${key}" data-env-value="${String(value)}" aria-pressed="${active ? 'true' : 'false'}">${label}</button>`;
  }

  function environmentHtml(env) {
    return `<div class="campsite-env-row"><div class="campsite-env-label">🚶 通行</div><div class="campsite-env-options">${envButton('traffic','easy','通行しやすい',env.traffic)}${envButton('traffic','narrow','一部狭い',env.traffic)}${envButton('traffic','careful','通行に配慮が必要',env.traffic)}</div></div><div class="campsite-env-row"><div class="campsite-env-label">🏞️ 広場</div><div class="campsite-env-options">${envButton('plaza',true,'あり',env.plaza)}${envButton('plaza',false,'なし',env.plaza)}</div></div><div class="campsite-env-row"><div class="campsite-env-label">🔄 回遊</div><div class="campsite-env-options">${envButton('circulation',true,'できる',env.circulation)}${envButton('circulation',false,'できない',env.circulation)}</div></div><div class="campsite-env-row"><div class="campsite-env-label">🪑 待機場所</div><div class="campsite-env-options">${envButton('waiting',true,'あり',env.waiting)}${envButton('waiting',false,'なし',env.waiting)}</div></div>`;
  }

  function decodeValue(key, raw) {
    if (key === 'traffic') return raw;
    return raw === 'true';
  }

  function densityHtml(analysis) {
    const total = analysis.existingPairs.length;
    const b = analysis.bands;
    const pct = (count) => total > 0 ? Math.round((count / total) * 100) : 0;
    const p1 = pct(b.under20); const p2 = pct(b.between20_30); const p3 = pct(b.between30_50);
    return `<div class="campsite-mission-stat"><span>既存POI</span><strong>${analysis.existing.length}</strong></div><div class="campsite-mission-stat"><span>50m以内の組み合わせ</span><strong>${total}組</strong></div><div class="campsite-density-bar"><span style="width:${p1}%"></span><span style="width:${p2}%"></span><span style="width:${p3}%"></span></div><div class="campsite-mission-stat"><span>🔴 20m未満</span><strong>${b.under20}組 · ${p1}%</strong></div><div class="campsite-mission-stat"><span>🟠 20〜30m</span><strong>${b.between20_30}組 · ${p2}%</strong></div><div class="campsite-mission-stat"><span>🟡 30〜50m</span><strong>${b.between30_50}組 · ${p3}%</strong></div><div class="campsite-density-note">距離帯は拠点の構造を理解するための表示です。密集度を点数・ランク・安全性へ変換しません。</div>`;
  }

  async function adviceHtml(project, analysis, env) {
    if (!environmentComplete(env) || !globalThis.CampsiteDistanceAdvice) return '';
    const b = analysis.bands;
    try {
      const output = await globalThis.CampsiteDistanceAdvice.evaluate({existing_poi_count:analysis.existing.length,under50_count:analysis.existingPairs.length,under20_count:b.under20,between20_30_count:b.between20_30,between30_50_count:b.between30_50,traffic:env.traffic,plaza:env.plaza,circulation:env.circulation,waiting:env.waiting,group_size:project?.distanceAdviceContext?.group_size ?? null,cluster_length_m:project?.distanceAdviceContext?.cluster_length_m ?? null,expected_stop_points:project?.distanceAdviceContext?.expected_stop_points ?? null},{seed:project?.distanceResult?.designSignature || project?.projectId || ''});
      if (output.status !== 'ready' || !output.advice.length) return '';
      const labels = {GATHERING:'🏞️ 集合',FLOW:'🔄 流れ',TRAFFIC:'🚶 通行',WAITING:'🪑 待機',ROUTE:'🗺️ ルート'};
      return `<section class="campsite-mission-card"><div class="campsite-mission-head"><div class="campsite-mission-kicker">OPERATION TIPS</div><h3 class="campsite-mission-title">🏕️ 運用のヒント</h3></div><div class="campsite-mission-body"><div class="campsite-advice-list">${output.advice.map((item)=>`<div class="campsite-advice-item"><span class="campsite-advice-cat">${labels[item.category]||item.category}</span>${esc(item.advice)}</div>`).join('')}</div></div></section>`;
    } catch (error) {
      console.warn('[Campsite Mission UI] advice load failed', error);
      return '';
    }
  }

  function attachEvents(shell) {
    shell.querySelectorAll('[data-env-key]').forEach((button)=>button.addEventListener('click',()=>persistEnvironment(button.dataset.envKey,decodeValue(button.dataset.envKey,button.dataset.envValue))));
    shell.querySelector('[data-duplicate-details]')?.addEventListener('click',(event)=>{const button=event.currentTarget;const details=shell.querySelector('[data-duplicate-list]');if(!(button instanceof HTMLElement)||!(details instanceof HTMLElement))return;const opening=details.hidden;details.hidden=!opening;button.setAttribute('aria-expanded',opening?'true':'false');button.textContent=opening?'内容を閉じる':'内容を確認する';});
    shell.querySelector('[data-mission-rework]')?.addEventListener('click',()=>{const existing=document.querySelector('[data-project-rework]');if(existing instanceof HTMLElement)existing.click();else location.href='./creative/index.html?campsiteProject=bridge';});
    shell.querySelector('[data-mission-map]')?.addEventListener('click',()=>{const result=document.getElementById('distanceResult');const legacy=result?.querySelector(':scope > .campsite-mission-legacy');const mapSection=legacy?.querySelector(':scope > .distance-result-map');if(!legacy||!mapSection)return;legacy.dataset.mapOpen='true';const mapButton=Array.from(mapSection.querySelectorAll('button')).find((button)=>(button.textContent||'').includes('地図を表示'));if(mapButton instanceof HTMLElement)mapButton.click();mapSection.scrollIntoView({behavior:'smooth',block:'start'});});
  }

  function wrapLegacy(result) {
    let legacy = result.querySelector(':scope > .campsite-mission-legacy');
    if (legacy) return legacy;
    legacy = document.createElement('div');
    legacy.className = 'campsite-mission-legacy';
    Array.from(result.childNodes).forEach((node)=>legacy.appendChild(node));
    result.appendChild(legacy);
    return legacy;
  }

  async function render() {
    if (rendering) return;
    const project = readProject();
    const result = document.getElementById('distanceResult');
    if (!project || project.source !== 'bridge' || !result || !result.textContent.trim()) return;
    rendering = true;
    try {
      ensureStyles();
      const legacy = wrapLegacy(result);
      result.classList.add('campsite-mission-mode');
      result.querySelector(':scope > .campsite-mission-shell')?.remove();
      const analysis = analyse(project);
      const env = environmentOf(project);
      syncLegacyChecks(env);
      const stale = project?.distanceResult?.stale === true;
      const mission1Done = analysis.unresolvedPairs.length === 0;
      const mission2Done = true;
      const mission3Done = environmentComplete(env);
      const duplicateBlocked = analysis.duplicatePairs.length > 0;
      const mission4Done = mission1Done && mission2Done && mission3Done && !stale && !duplicateBlocked;
      const mission5Done = mission4Done;
      const advice = await adviceHtml(project,analysis,env);
      const shell = document.createElement('div');
      shell.className = 'campsite-mission-shell';
      shell.innerHTML = `${duplicateBlocked?`<div class="campsite-duplicate-alert"><strong>🚨 修正候補</strong><div style="margin-top:6px">重複POIが${analysis.duplicatePairs.length}組見つかりました。</div><button type="button" data-duplicate-details aria-expanded="false">内容を確認する</button><div class="campsite-duplicate-details" data-duplicate-list hidden>${analysis.duplicatePairs.map(duplicatePairHtml).join('')}</div><button type="button" data-mission-rework>CREATIVE MODEに戻って修正</button></div>`:''}<div class="campsite-mission-progress">${lamp('距離',duplicateBlocked?'red':mission1Done?'green':'yellow')}${lamp('拠点',mission2Done?'green':'yellow')}${lamp('現地',mission3Done?'green':'yellow')}${lamp('最終',duplicateBlocked||stale?'red':mission4Done?'green':'yellow')}${lamp('完了',mission5Done?'green':'gray')}</div><section class="campsite-mission-card"><div class="campsite-mission-head"><div class="campsite-mission-kicker">MISSION 1</div><div class="campsite-mission-prompt">新しいPOIを確認しましょう</div><h3 class="campsite-mission-title">📏 新規POIの距離確認</h3></div><div class="campsite-mission-body"><div class="campsite-mission-stat"><span>📏 50m未満</span><strong class="campsite-mission-big">${analysis.missionPairs.length}組</strong></div><div class="campsite-mission-stat"><span>✅ CA確認済み</span><strong class="campsite-mission-ok">${analysis.confirmedPairs.length}組</strong></div><div class="campsite-mission-stat"><span>${analysis.unresolvedPairs.length?'⚠️':'✅'} 未確認</span><strong class="${analysis.unresolvedPairs.length?'campsite-mission-warn':'campsite-mission-ok'}">${analysis.unresolvedPairs.length}組</strong></div><div class="campsite-pair-list">${analysis.missionPairs.map(pairHtml).join('')||'<div class="campsite-mission-ok">✅ 50m未満の候補はありません</div>'}</div></div></section><section class="campsite-mission-card"><div class="campsite-mission-head"><div class="campsite-mission-kicker">MISSION 2</div><div class="campsite-mission-prompt">自分の拠点を理解しましょう</div><h3 class="campsite-mission-title">🏕️ 拠点の密集特性</h3></div><div class="campsite-mission-body">${densityHtml(analysis)}</div></section><section class="campsite-mission-card"><div class="campsite-mission-head"><div class="campsite-mission-kicker">MISSION 3</div><div class="campsite-mission-prompt">現地を確認しましょう</div><h3 class="campsite-mission-title">🌳 現地環境</h3></div><div class="campsite-mission-body">${environmentHtml(env)}${mission3Done?'<div style="margin-top:13px" class="campsite-mission-ok">✅ 現地環境を確認済みです</div>':'<div class="campsite-chairman-sign"><strong>【会長からのメッセージ】</strong><b>見てこないとだめだよ❗️<br>現地へGO‼️</b></div>'}</div></section>${advice}<section class="campsite-mission-card"><div class="campsite-mission-head"><div class="campsite-mission-kicker">MISSION 4</div><div class="campsite-mission-prompt">最後に確認しましょう</div><h3 class="campsite-mission-title">✅ 最終確認</h3></div><div class="campsite-mission-body"><div class="campsite-final-list"><div class="campsite-final-row"><span>${mission1Done?'✅':'⚠️'}</span><span>新規POIの距離・CA確認 ${mission1Done?'完了':'未確認あり'}</span></div><div class="campsite-final-row"><span>✅</span><span>拠点の密集特性を表示済み</span></div><div class="campsite-final-row"><span>${mission3Done?'✅':'⚠️'}</span><span>現地環境 ${mission3Done?'確認済み':'未確認あり'}</span></div><div class="campsite-final-row"><span>${stale?'⚠️':'✅'}</span><span>${stale?'CREATIVE MODE変更後の再チェックが必要です':'距離チェック結果は現在の設計です'}</span></div><div class="campsite-final-row"><span>${duplicateBlocked?'🚨':'✅'}</span><span>${duplicateBlocked?'重複POIの確認が必要です':'重複POIによるブロックなし'}</span></div></div></div></section><section class="campsite-mission-card campsite-map-card"><div class="campsite-mission-head"><div class="campsite-mission-kicker">OPTION</div><h3 class="campsite-mission-title">🗺️ 配置・マップ</h3></div><div class="campsite-mission-body"><div style="font-size:12px;line-height:1.7;color:#cbd5e1">必要なときに、既存POI・新規POI・活動範囲をもう一度確認できます。</div><button type="button" data-mission-map>地図を表示</button></div></section><div class="campsite-goal" data-ready="${mission5Done?'true':'false'}"><div class="campsite-mission-kicker">MISSION 5</div><div class="campsite-goal-title">${mission5Done?'🟢 準備完了！':'⚪ 準備中'}</div><div class="campsite-goal-note">${mission5Done?'必要な確認がすべて揃いました。':'黄色・赤のMISSIONを確認すると準備完了になります。'}</div></div>`;
      result.insertBefore(shell,legacy);
      attachEvents(shell);
    } finally { rendering = false; }
  }

  function scheduleRender(delay=100) {
    clearTimeout(renderTimer);
    renderTimer=setTimeout(()=>{void render();},delay);
  }

  function wrapDistanceCheck() {
    const fn=window.runDistanceCheck;
    if(typeof fn!=='function'||fn[WRAP_FLAG])return;
    const wrapped=async function(...args){const output=await fn.apply(this,args);scheduleRender(360);return output;};
    wrapped[WRAP_FLAG]=true;
    window.runDistanceCheck=wrapped;
  }

  function boot() {
    const params=new URLSearchParams(location.search);
    if(params.get('campsiteProject')!=='bridge')return;
    wrapDistanceCheck();
    scheduleRender(500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
