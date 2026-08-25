/* Creative Mode private runtime loader */
(async () => {
  'use strict';

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const status = () => document.getElementById('creativeBootStatus');
  const show = (message) => {
    const el = status();
    if (el) el.textContent = message;
  };

  try {
    show('認証システムを準備しています…');

    const deadline = Date.now() + 15000;
    while ((!window.campsiteSupabase?.auth || !window.CampsiteCaAccess) && Date.now() < deadline) {
      await wait(80);
    }

    if (!window.campsiteSupabase?.auth || !window.CampsiteCaAccess) {
      show('Creative Modeの認証システムを読み込めませんでした。');
      return;
    }

    show('Discordセッションを確認しています…');
    const { data: sessionData, error: sessionError } = await window.campsiteSupabase.auth.getSession();
    const session = sessionData?.session;
    if (sessionError || !session) {
      show('Discordでログインしてください。');
      return;
    }

    // Creative Runtime 側で Discord本人確認と approved 判定を再検証する。
    // ca-access をここでも呼ぶと共通ゲートと二重実行になり、競合するため呼ばない。
    show('Creative Modeの利用許可を確認しています…');

    const { data: bundleResult, error: bundleError } = await window.campsiteSupabase.functions.invoke('creative-runtime', {
      body: { action: 'bundle' }
    });
    if (bundleError || !bundleResult?.ok) {
      console.error('Creative runtime load failed', bundleError, bundleResult);
      show('Creative Modeの利用許可または読み込みに失敗しました。');
      return;
    }

    document.getElementById('caAccessGate')?.remove();
    show('Creative Modeを読み込んでいます…');

    const assets = bundleResult.assets || {};
    const required = [
      'base-v7.html',
      'runtime-vnext.html',
      'creative-patches-v2.js',
      'creative-patches-v3.js',
      'creative-patches-v4.js'
    ];
    if (required.some((name) => typeof assets[name] !== 'string' || !assets[name])) {
      show('Creative Modeの実行データが不足しています。');
      return;
    }

    show('Creative Modeを組み立てています…');

    let src = assets['runtime-vnext.html'];
    const baseHtml = assets['base-v7.html'];
    const baseLoader = /const res=await fetch\('\.\/base-v7\.html',\{cache:'no-store'\}\);if\(!res\.ok\)\{document\.body\.textContent='Creative Modeの読み込みに失敗しました。';return\}\s*let html=await res\.text\(\);/;
    if (!baseLoader.test(src)) {
      show('Creative Modeの基盤データを組み立てられませんでした。');
      return;
    }
    // baseHtml 内の </script> が、外側 runtime の <script> を途中終了させないように
    // JavaScript 文字列リテラル上では <\/script> として埋め込む。
    const safeBaseLiteral = JSON.stringify(baseHtml).replace(/<\/script/gi, '<\\/script');
    src = src.replace(baseLoader, 'let html=' + safeBaseLiteral + ';');

    for (const name of ['creative-patches-v2.js', 'creative-patches-v3.js', 'creative-patches-v4.js']) {
      Function(assets[name])();
    }
    if (typeof window.applyCreativePatches !== 'function') {
      show('Creative Modeの拡張機能を読み込めませんでした。');
      return;
    }
    src = window.applyCreativePatches(src);

    const helperNeedle = 'function snapshot(){';
    const helpers = `const JP_MAX_ADDITIONAL=25;
function jpAdditionalRecords(){return records.filter(r=>r&&!r.deleted&&isNew(r.layer))}
function jpIssueSignature(r){if(!r||r.deleted||!isNew(r.layer))return'';const near=nearestRecord(r.latlng,r.id);if(!near||!Number.isFinite(near.distance)||near.distance>=50)return'';return String(near.record?.id||'')+'|'+near.distance.toFixed(1)}
function jpRefreshReviews(){jpAdditionalRecords().forEach(r=>{const sig=jpIssueSignature(r),reason=String(r.applicationComment||'').trim();if(!sig){r.applicationCommentNeedsReview=false;return}r.applicationCommentNeedsReview=!reason||String(r.applicationCommentSignature||'')!==sig})}
function ensureJpGuide(){let box=document.getElementById('jpCreativeGuide');if(box)return box;box=document.createElement('div');box.id='jpCreativeGuide';box.style.cssText='margin-top:10px;padding:9px;border:1px solid rgba(240,204,123,.55);border-radius:12px;background:rgba(255,248,230,.10);color:#fff8e8;font-size:10px;line-height:1.55';box.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px;font-weight:900"><span>設計チェック</span><span id="jpCreativeCount">0 / 25</span></div><div style="display:flex;justify-content:space-between;gap:8px;margin-top:4px"><span>50m未満</span><span id="jpCreativeUnder50">0</span></div><div style="display:flex;justify-content:space-between;gap:8px"><span>理由の再確認</span><span id="jpCreativeReview">0</span></div><details style="margin-top:7px"><summary style="cursor:pointer;font-weight:900">日本CA向け設計ガイド</summary><div style="margin-top:6px">・50mを基本とし、50m未満は自動NGにせず要確認として扱います。<br>・ゲームスポットを一箇所へ集中させず、公園内を自然に移動できる配置を考えます。<br>・入口や狭い通路への滞留、本来の利用者と衝突しやすい場所への集中を避けます。<br>・活動範囲はミートアップで想定される移動範囲として確認します。<br>・30m / 40mは例外確認の参考表示です。</div></details>';circlePanel.appendChild(box);return box}
function renderJpGuide(){jpRefreshReviews();const box=ensureJpGuide(),adds=jpAdditionalRecords(),under=adds.filter(r=>!!jpIssueSignature(r)),review=under.filter(r=>r.applicationCommentNeedsReview);const c=box.querySelector('#jpCreativeCount'),u=box.querySelector('#jpCreativeUnder50'),v=box.querySelector('#jpCreativeReview');if(c){c.textContent=adds.length+' / '+JP_MAX_ADDITIONAL;c.style.color=adds.length>JP_MAX_ADDITIONAL?'#ffb4a8':'#fff8e8'}if(u)u.textContent=String(under.length);if(v){v.textContent=String(review.length);v.style.color=review.length?'#ffd27d':'#bde3b9'}}
`;
    if (src.includes(helperNeedle)) src = src.replace(helperNeedle, helpers + helperNeedle);

    const addNeedle = "if(helperRadius!==50)r.customRadius=helperRadius;records.push(r);drawRecord(r);";
    const addReplacement = "if(helperRadius!==50)r.customRadius=helperRadius;if(isNew(r.layer)&&jpAdditionalRecords().length>=JP_MAX_ADDITIONAL){msg('追加ゲームスポットは最大25個です',1800);renderJpGuide();return}records.push(r);drawRecord(r);";
    if (src.includes(addNeedle)) src = src.replace(addNeedle, addReplacement);

    const legacyAddNeedle = "const r={id:crypto.randomUUID?.()||String(Date.now()),layer:activeLayer,latlng:[ll.lat,ll.lng],title:layerDefs.find(x=>x[0]===activeLayer)?.[1]||'新規スポット',memo:'',deleted:false};records.push(r);drawRecord(r);";
    const legacyAddReplacement = "const r={id:crypto.randomUUID?.()||String(Date.now()),layer:activeLayer,latlng:[ll.lat,ll.lng],title:layerDefs.find(x=>x[0]===activeLayer)?.[1]||'新規スポット',memo:'',deleted:false};if(isNew(r.layer)&&jpAdditionalRecords().length>=JP_MAX_ADDITIONAL){msg('追加ゲームスポットは最大25個です',1800);renderJpGuide();return}records.push(r);drawRecord(r);";
    src = src.split(legacyAddNeedle).join(legacyAddReplacement);

    const commentNeedle = "ft.oninput=()=>{r.applicationComment=ft.value.slice(0,300);if(ct)ct.textContent=r.applicationComment.length+' / 300';snapshot()}";
    const commentReplacement = "ft.oninput=()=>{r.applicationComment=ft.value.slice(0,300);r.applicationCommentSignature=jpIssueSignature(r);r.applicationCommentNeedsReview=false;if(ct)ct.textContent=r.applicationComment.length+' / 300';snapshot();renderJpGuide()}";
    if (src.includes(commentNeedle)) src = src.replace(commentNeedle, commentReplacement);

    const moveNeedle = "clearDraft();r.latlng=to;pushHistory({type:'move',id:r.id,from:old,to});drawAll();snapshot();msg('位置を調整しました')";
    const moveReplacement = "const oldSig=jpIssueSignature(r);clearDraft();r.latlng=to;const newSig=jpIssueSignature(r);if(isNew(r.layer)&&String(r.applicationComment||'').trim()&&oldSig!==newSig)r.applicationCommentNeedsReview=true;pushHistory({type:'move',id:r.id,from:old,to});drawAll();snapshot();renderJpGuide();msg(r.applicationCommentNeedsReview?'位置を調整しました。50m未満の理由を再確認してください':'位置を調整しました',1800)";
    if (src.includes(moveNeedle)) src = src.replace(moveNeedle, moveReplacement);

    const beginNeedle = "function beginEditor(){entry.classList.add('hidden');setTimeout(()=>map.invalidateSize(),50)}";
    const beginReplacement = "function beginEditor(){entry.classList.add('hidden');ensureJpGuide();renderJpGuide();setTimeout(()=>map.invalidateSize(),50)}";
    if (src.includes(beginNeedle)) src = src.replace(beginNeedle, beginReplacement);

    const drawNeedle = "function drawAll(){layerDefs.forEach(([k])=>groups[k].clearLayers());polygonGroup.clearLayers();records.forEach(drawRecord);polygons.forEach(p=>{if(!p.deleted)p.layerObj=L.polygon(p.points,{pane:'polygon',color:'#5a8b5f',weight:3,fillColor:'#6ea979',fillOpacity:.09,interactive:false}).addTo(polygonGroup)});if(polygonVisible){if(!map.hasLayer(polygonGroup))polygonGroup.addTo(map)}else if(map.hasLayer(polygonGroup))map.removeLayer(polygonGroup);renderRecordCircles()}";
    if (src.includes(drawNeedle)) src = src.replace(drawNeedle, drawNeedle.slice(0, -1) + ';renderJpGuide()}');

    src = src.replace("$('back').onclick=()=>history.back();", "$('back').onclick=()=>location.href='../lab.html';");
    src = src.replace('<title>CREATIVE MODE | Next Lab</title>', '<title>CREATIVE MODE | Campsite Lab</title>');

    document.open();
    document.write(src);
    document.close();
  } catch (err) {
    console.error('Creative loader failed', err);
    show('Creative Modeの読み込みに失敗しました。');
  }
})();