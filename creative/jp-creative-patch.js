(() => {
  'use strict';

  window.applyCreativeJpPatch = function(html) {
    if (typeof html !== 'string') return html;

    // JP-only small entry on the opening screen.
    html=html.replace('</style>', '.rain-dev-entry{position:absolute;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:3;padding:7px 10px;border:1px solid rgba(158,207,255,.45);border-radius:999px;background:rgba(20,31,43,.55);color:rgba(220,239,255,.84);font-size:10px;font-weight:950;letter-spacing:.06em;text-decoration:none;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}.rain-dev-entry:active{transform:scale(.97)}</style>');
    html=html.replace('<div id="entry" class="entry">','<div id="entry" class="entry"><a class="rain-dev-entry" href="./rain-dev.html" aria-label="開発中の雨雲チェック">☔ 開発中</a>');

    // Japan CA design support.
    const helperNeedle='function snapshot(){';
    const helpers=`const JP_MAX_ADDITIONAL=25;
function jpAdditionalRecords(){return records.filter(r=>r&&!r.deleted&&isNew(r.layer))}
function jpIssueSignature(r){if(!r||r.deleted||!isNew(r.layer))return'';const near=nearestRecord(r.latlng,r.id);if(!near||!Number.isFinite(near.distance)||near.distance>=50)return'';return String(near.record?.id||'')+'|'+near.distance.toFixed(1)}
function jpRefreshReviews(){jpAdditionalRecords().forEach(r=>{const sig=jpIssueSignature(r),reason=String(r.applicationComment||'').trim();if(!sig){r.applicationCommentNeedsReview=false;return}r.applicationCommentNeedsReview=!reason||String(r.applicationCommentSignature||'')!==sig})}
function ensureJpGuide(){let box=document.getElementById('jpCreativeGuide');if(box)return box;box=document.createElement('div');box.id='jpCreativeGuide';box.style.cssText='margin-top:10px;padding:9px;border:1px solid rgba(240,204,123,.55);border-radius:12px;background:rgba(255,248,230,.10);color:#fff8e8;font-size:10px;line-height:1.55';box.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px;font-weight:900"><span>設計チェック</span><span id="jpCreativeCount">0 / 25</span></div><div style="display:flex;justify-content:space-between;gap:8px;margin-top:4px"><span>50m未満</span><span id="jpCreativeUnder50">0</span></div><div style="display:flex;justify-content:space-between;gap:8px"><span>理由の再確認</span><span id="jpCreativeReview">0</span></div><details style="margin-top:7px"><summary style="cursor:pointer;font-weight:900">日本CA向け設計ガイド</summary><div style="margin-top:6px">・50mを基本とし、50m未満は自動NGにせず要確認として扱います。<br>・ゲームスポットを一箇所へ集中させず、公園内を自然に移動できる配置を考えます。<br>・入口や狭い通路への滞留、本来の利用者と衝突しやすい場所への集中を避けます。<br>・活動範囲はミートアップで想定される移動範囲として確認します。<br>・30m / 40mは例外確認の参考表示です。</div></details>';circlePanel.appendChild(box);return box}
function renderJpGuide(){jpRefreshReviews();const box=ensureJpGuide(),adds=jpAdditionalRecords(),under=adds.filter(r=>!!jpIssueSignature(r)),review=under.filter(r=>r.applicationCommentNeedsReview);const c=box.querySelector('#jpCreativeCount'),u=box.querySelector('#jpCreativeUnder50'),v=box.querySelector('#jpCreativeReview');if(c){c.textContent=adds.length+' / '+JP_MAX_ADDITIONAL;c.style.color=adds.length>JP_MAX_ADDITIONAL?'#ffb4a8':'#fff8e8'}if(u)u.textContent=String(under.length);if(v){v.textContent=String(review.length);v.style.color=review.length?'#ffd27d':'#bde3b9'}}
`;
    if(html.includes(helperNeedle))html=html.replace(helperNeedle,helpers+helperNeedle);

    const addNeedle="if(helperRadius!==50)r.customRadius=helperRadius;records.push(r);drawRecord(r);";
    const addReplacement="if(helperRadius!==50)r.customRadius=helperRadius;if(isNew(r.layer)&&jpAdditionalRecords().length>=JP_MAX_ADDITIONAL){msg('追加ゲームスポットは最大25個です',1800);renderJpGuide();return}records.push(r);drawRecord(r);";
    if(html.includes(addNeedle))html=html.replace(addNeedle,addReplacement);

    const legacyAddNeedle="const r={id:crypto.randomUUID?.()||String(Date.now()),layer:activeLayer,latlng:[ll.lat,ll.lng],title:layerDefs.find(x=>x[0]===activeLayer)?.[1]||'新規スポット',memo:'',deleted:false};records.push(r);drawRecord(r);";
    const legacyAddReplacement="const r={id:crypto.randomUUID?.()||String(Date.now()),layer:activeLayer,latlng:[ll.lat,ll.lng],title:layerDefs.find(x=>x[0]===activeLayer)?.[1]||'新規スポット',memo:'',deleted:false};if(isNew(r.layer)&&jpAdditionalRecords().length>=JP_MAX_ADDITIONAL){msg('追加ゲームスポットは最大25個です',1800);renderJpGuide();return}records.push(r);drawRecord(r);";
    html=html.split(legacyAddNeedle).join(legacyAddReplacement);

    const commentNeedle="ft.oninput=()=>{r.applicationComment=ft.value.slice(0,300);if(ct)ct.textContent=r.applicationComment.length+' / 300';snapshot()}";
    const commentReplacement="ft.oninput=()=>{r.applicationComment=ft.value.slice(0,300);r.applicationCommentSignature=jpIssueSignature(r);r.applicationCommentNeedsReview=false;if(ct)ct.textContent=r.applicationComment.length+' / 300';snapshot();renderJpGuide()}";
    if(html.includes(commentNeedle))html=html.replace(commentNeedle,commentReplacement);

    const moveNeedle="clearDraft();r.latlng=to;pushHistory({type:'move',id:r.id,from:old,to});drawAll();snapshot();msg('位置を調整しました')";
    const moveReplacement="const oldSig=jpIssueSignature(r);clearDraft();r.latlng=to;const newSig=jpIssueSignature(r);if(isNew(r.layer)&&String(r.applicationComment||'').trim()&&oldSig!==newSig)r.applicationCommentNeedsReview=true;pushHistory({type:'move',id:r.id,from:old,to});drawAll();snapshot();renderJpGuide();msg(r.applicationCommentNeedsReview?'位置を調整しました。50m未満の理由を再確認してください':'位置を調整しました',1800)";
    if(html.includes(moveNeedle))html=html.replace(moveNeedle,moveReplacement);

    const beginNeedle="function beginEditor(){entry.classList.add('hidden');setTimeout(()=>map.invalidateSize(),50)}";
    const beginReplacement="function beginEditor(){entry.classList.add('hidden');ensureJpGuide();renderJpGuide();setTimeout(()=>map.invalidateSize(),50)}";
    if(html.includes(beginNeedle))html=html.replace(beginNeedle,beginReplacement);

    const drawNeedle="function drawAll(){layerDefs.forEach(([k])=>groups[k].clearLayers());polygonGroup.clearLayers();records.forEach(drawRecord);polygons.forEach(p=>{if(!p.deleted)p.layerObj=L.polygon(p.points,{pane:'polygon',color:'#5a8b5f',weight:3,fillColor:'#6ea979',fillOpacity:.09,interactive:false}).addTo(polygonGroup)});if(polygonVisible){if(!map.hasLayer(polygonGroup))polygonGroup.addTo(map)}else if(map.hasLayer(polygonGroup))map.removeLayer(polygonGroup);renderRecordCircles()}";
    if(html.includes(drawNeedle))html=html.replace(drawNeedle,drawNeedle.slice(0,-1)+";renderJpGuide()}");

    // The legacy exporter always writes the canonical 50m folder once. The
    // current circle-layer UI also keeps 50 in circleExtras, so exclude only
    // that duplicate during export while preserving 50/40/30 map visibility.
    const circleExportNeedle="appendDistanceFolder(xml,doc,50);circleExtras.slice().sort((a,b)=>b-a).forEach(radius=>appendDistanceFolder(xml,doc,radius));";
    const circleExportReplacement="appendDistanceFolder(xml,doc,50);circleExtras.slice().filter(radius=>Number(radius)!==50).sort((a,b)=>b-a).forEach(radius=>appendDistanceFolder(xml,doc,radius));";
    if(html.includes(circleExportNeedle))html=html.replace(circleExportNeedle,circleExportReplacement);

    // iPhone Safari can emit pointerup/touchend/click for one tap. Keep the coordinate view singleton.
    const coordsNeedle="function cmOpenCoords(){cmCloseSaveMenu();";
    const coordsReplacement="function cmOpenCoords(){if(cmCoordView?.isConnected)return;cmCloseSaveMenu();";
    if(html.includes(coordsNeedle))html=html.replace(coordsNeedle,coordsReplacement);

    html=html.replace("$('back').onclick=()=>history.back();","$('back').onclick=()=>location.href='../lab.html';");
    html=html.replace('<title>CREATIVE MODE | Next Lab</title>','<title>CREATIVE MODE | Campsite Lab</title>');

    // Field-test follow-up: keep controls out of the way while retaining the new visual language.
    const followupStyle=`<style id="cmJpFieldFollowupStyle">
      .toolbox{bottom:calc(82px + env(safe-area-inset-bottom))!important}
      .toolmenu{bottom:calc(142px + env(safe-area-inset-bottom))!important}
      #cmStandaloneSaveMenu{left:10px!important;right:auto!important;transform:none!important;width:min(260px,calc(100vw - 20px))!important;padding:8px!important;gap:7px!important}
      .left-hand #cmStandaloneSaveMenu{left:auto!important;right:10px!important;transform:none!important}
      #cmStandaloneSaveMenu button{text-align:center!important;padding:0 14px!important}
      #cmStandaloneSaveButton{transition:transform .2s ease!important}
      body:has(.cm-coords) #cmStandaloneSaveButton{transform:translateY(48px)!important}
      .cm-coords>div:last-child{padding-bottom:72px!important}

      .cm-jp-comet{position:fixed;left:0;top:0;width:1px;height:1px;z-index:7900;pointer-events:none;will-change:transform,opacity;filter:drop-shadow(0 0 5px rgba(80,190,255,.95))}
      .cm-jp-comet-head{position:absolute;left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;background:radial-gradient(circle at 38% 35%,#fff 0 22%,#e8fbff 23% 43%,#7de0ff 44% 67%,#168cff 68% 100%);box-shadow:0 0 5px #fff,0 0 11px #75dcff,0 0 17px rgba(24,135,255,.88)}
      .cm-jp-comet-tail{position:absolute;left:-48px;top:-2px;width:48px;height:4px;border-radius:999px;background:linear-gradient(90deg,rgba(38,130,255,0) 0%,rgba(49,170,255,.15) 18%,rgba(83,207,255,.66) 64%,rgba(232,252,255,.98) 100%);box-shadow:0 0 5px rgba(70,194,255,.55)}
      .cm-jp-comet-tail2{position:absolute;left:-32px;top:2px;width:32px;height:2px;border-radius:999px;background:linear-gradient(90deg,rgba(34,119,255,0),rgba(72,195,255,.58),rgba(255,255,255,.88));opacity:.82}
      .cm-jp-comet-spark{position:absolute;left:-18px;top:-5px;width:3px;height:3px;border-radius:50%;background:#eaffff;box-shadow:-9px 7px 0 rgba(76,190,255,.68),-18px 2px 0 rgba(76,190,255,.34)}
      #cmCount.cm-jp-count-pop{animation:cmJpCountPop .34s ease}
      @keyframes cmJpCountPop{0%{transform:scale(1);text-shadow:none}42%{transform:scale(1.28);text-shadow:0 0 8px #fff,0 0 15px #69d7ff}100%{transform:scale(1);text-shadow:none}}
      @media(prefers-reduced-motion:reduce){.cm-jp-comet{display:none!important}#cmCount.cm-jp-count-pop{animation:none!important}}
    </style>`;
    if(!html.includes('id="cmJpFieldFollowupStyle"'))html=html.replace('</head>',followupStyle+'</head>');

    const followupRuntime=`<script id="cmJpFieldFollowupRuntime">
(()=>{
  let fabWasOpen=false;
  const remember=e=>{
    const fab=e.target&&e.target.closest?e.target.closest('#cmAddFab'):null;if(!fab)return;
    try{fabWasOpen=typeof cmAddMenuOpen!=='undefined'&&!!cmAddMenuOpen}catch(_){fabWasOpen=false}
  };
  const suppress=e=>{
    const fab=e.target&&e.target.closest?e.target.closest('#cmAddFab'):null;if(!fab||!fabWasOpen)return;
    setTimeout(()=>{const hint=document.getElementById('cmV45AddFlash');if(hint)hint.classList.remove('show')},0);
  };
  document.addEventListener('pointerdown',remember,true);
  document.addEventListener('touchstart',remember,{capture:true,passive:true});
  document.addEventListener('click',suppress,true);

  try{
    cmV46FlyStarToCount=function(r){
      try{
        if(!r||!Array.isArray(r.latlng))return;
        if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
        const target=document.getElementById('cmCount');if(!target)return;
        const container=map.getContainer(),mr=container.getBoundingClientRect();
        const p=map.latLngToContainerPoint(L.latLng(r.latlng[0],r.latlng[1])),tr=target.getBoundingClientRect();
        const sx=mr.left+p.x,sy=mr.top+p.y,ex=tr.left+tr.width/2,ey=tr.top+tr.height/2;
        const dx=ex-sx,dy=ey-sy,angle=Math.atan2(dy,dx)*180/Math.PI;
        const comet=document.createElement('div');comet.className='cm-jp-comet';
        comet.innerHTML='<i class="cm-jp-comet-tail"></i><i class="cm-jp-comet-tail2"></i><i class="cm-jp-comet-spark"></i><i class="cm-jp-comet-head"></i>';
        document.body.appendChild(comet);
        const tf=(x,y,s)=>'translate3d('+x+'px,'+y+'px,0) rotate('+angle+'deg) scale('+s+')';
        const anim=comet.animate([
          {transform:tf(sx,sy,.78),opacity:.18,offset:0},
          {transform:tf(sx+dx*.12,sy+dy*.12,1),opacity:1,offset:.16},
          {transform:tf(sx+dx*.84,sy+dy*.84,.96),opacity:1,offset:.84},
          {transform:tf(ex,ey,.58),opacity:0,offset:1}
        ],{duration:540,easing:'cubic-bezier(.18,.72,.22,1)',fill:'forwards'});
        anim.onfinish=()=>{
          comet.remove();
          target.classList.remove('cm-jp-count-pop');void target.offsetWidth;target.classList.add('cm-jp-count-pop');
          setTimeout(()=>target.classList.remove('cm-jp-count-pop'),380);
        };
      }catch(err){console.warn('[Creative JP] comet animation',err)}
    };
  }catch(err){console.warn('[Creative JP] comet override unavailable',err)}
})();
<\/script>`;
    if(!html.includes('id="cmJpFieldFollowupRuntime"'))html=html.replace('</body>',followupRuntime+'</body>');

    return html;
  };
})();
