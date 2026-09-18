(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // CREATIVE MODEでCampsiteを設計する際に必要なチェックだけを追加する。
    // 提出ZIP生成や現地向け機能は含めない。
    const helperNeedle='function snapshot(){';
    const helpers=`const CREATIVE_MAX_ADDITIONAL=25;
function creativeAdditionalRecords(){return records.filter(r=>r&&!r.deleted&&isNew(r.layer))}
function creativeUnder50Signature(r){if(!r||r.deleted||!isNew(r.layer))return'';const near=nearestRecord(r.latlng,r.id);if(!near||!Number.isFinite(near.distance)||near.distance>=50)return'';return String(near.record?.id||'')+'|'+near.distance.toFixed(1)}
function creativeRefreshDesignReviews(){creativeAdditionalRecords().forEach(r=>{const sig=creativeUnder50Signature(r),reason=String(r.applicationComment||'').trim();if(!sig){r.applicationCommentNeedsReview=false;return}if(reason&&String(r.applicationCommentSignature||'')===sig)r.applicationCommentNeedsReview=false;else if(reason)r.applicationCommentNeedsReview=true})}
function ensureCreativeDesignCheck(){let box=document.getElementById('creativeDesignCheck');if(box)return box;box=document.createElement('div');box.id='creativeDesignCheck';box.style.cssText='margin-top:10px;padding:9px;border:1px solid rgba(240,204,123,.55);border-radius:12px;background:rgba(255,248,230,.10);color:#fff8e8;font-size:10px;line-height:1.55';box.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px;font-weight:900"><span>設計チェック</span><span id="creativeDesignCount">0 / 25</span></div><div style="display:flex;justify-content:space-between;gap:8px;margin-top:4px"><span>50m未満</span><span id="creativeDesignUnder50">0</span></div><div style="display:flex;justify-content:space-between;gap:8px"><span>要再確認</span><span id="creativeDesignReview">0</span></div><details style="margin-top:7px"><summary style="cursor:pointer;font-weight:900">設計の目安</summary><div style="margin-top:6px">50mを基本とします。50m未満は自動NGではなく、配置理由を確認します。30m / 40mは参考表示です。</div></details>';circlePanel.appendChild(box);return box}
function renderCreativeDesignCheck(){creativeRefreshDesignReviews();const box=ensureCreativeDesignCheck(),adds=creativeAdditionalRecords(),under=adds.filter(r=>!!creativeUnder50Signature(r)),review=under.filter(r=>r.applicationCommentNeedsReview);const c=box.querySelector('#creativeDesignCount'),u=box.querySelector('#creativeDesignUnder50'),v=box.querySelector('#creativeDesignReview');if(c){c.textContent=adds.length+' / '+CREATIVE_MAX_ADDITIONAL;c.style.color=adds.length>CREATIVE_MAX_ADDITIONAL?'#ffb4a8':'#fff8e8'}if(u)u.textContent=String(under.length);if(v){v.textContent=String(review.length);v.style.color=review.length?'#ffd27d':'#bde3b9'}}
`;
    if(src.includes(helperNeedle))src=src.replace(helperNeedle,helpers+helperNeedle);

    // 追加ゲームスポットはPokéStop / Gym / Power Spotの合計25件まで。
    // 読み込み済みデータは壊さず、新規追加だけを止める。
    const addNeedle="if(helperRadius!==50)r.customRadius=helperRadius;records.push(r);drawRecord(r);";
    const addReplacement="if(helperRadius!==50)r.customRadius=helperRadius;if(isNew(r.layer)&&creativeAdditionalRecords().length>=CREATIVE_MAX_ADDITIONAL){msg('追加ゲームスポットは最大25個です',1800);renderCreativeDesignCheck();return}records.push(r);drawRecord(r);renderCreativeDesignCheck();";
    if(src.includes(addNeedle))src=src.replace(addNeedle,addReplacement);

    // 旧追加フローが残っている場合にも同じ上限を適用する。
    const legacyAddNeedle="const r={id:crypto.randomUUID?.()||String(Date.now()),layer:activeLayer,latlng:[ll.lat,ll.lng],title:layerDefs.find(x=>x[0]===activeLayer)?.[1]||'新規スポット',memo:'',deleted:false};records.push(r);drawRecord(r);";
    const legacyAddReplacement="const r={id:crypto.randomUUID?.()||String(Date.now()),layer:activeLayer,latlng:[ll.lat,ll.lng],title:layerDefs.find(x=>x[0]===activeLayer)?.[1]||'新規スポット',memo:'',deleted:false};if(isNew(r.layer)&&creativeAdditionalRecords().length>=CREATIVE_MAX_ADDITIONAL){msg('追加ゲームスポットは最大25個です',1800);renderCreativeDesignCheck();return}records.push(r);drawRecord(r);renderCreativeDesignCheck();";
    src=src.split(legacyAddNeedle).join(legacyAddReplacement);

    // 50m未満の理由を入力した時点の距離条件を記録する。
    // 保存自体は止めず、位置や周辺条件が変わった時だけ再確認を表示する。
    const commentNeedle="ft.oninput=()=>{r.applicationComment=ft.value.slice(0,300);if(ct)ct.textContent=r.applicationComment.length+' / 300';snapshot()}";
    const commentReplacement="ft.oninput=()=>{r.applicationComment=ft.value.slice(0,300);r.applicationCommentSignature=creativeUnder50Signature(r);r.applicationCommentNeedsReview=false;if(ct)ct.textContent=r.applicationComment.length+' / 300';snapshot();renderCreativeDesignCheck()}";
    if(src.includes(commentNeedle))src=src.replace(commentNeedle,commentReplacement);

    // POI位置確定後、50m未満条件が変化していれば理由の再確認扱いにする。
    const moveNeedle="clearDraft();r.latlng=to;pushHistory({type:'move',id:r.id,from:old,to});drawAll();snapshot();msg('位置を調整しました')";
    const moveReplacement="const oldSig=creativeUnder50Signature(r);clearDraft();r.latlng=to;const newSig=creativeUnder50Signature(r);if(isNew(r.layer)&&String(r.applicationComment||'').trim()&&oldSig!==newSig)r.applicationCommentNeedsReview=true;pushHistory({type:'move',id:r.id,from:old,to});drawAll();snapshot();renderCreativeDesignCheck();msg(r.applicationCommentNeedsReview?'位置を調整しました。50m未満の理由を再確認してください':'位置を調整しました',1800)";
    if(src.includes(moveNeedle))src=src.replace(moveNeedle,moveReplacement);

    // エディタ開始時・再描画時に設計チェックを同期する。
    const beginNeedle="function beginEditor(){entry.classList.add('hidden');setTimeout(()=>map.invalidateSize(),50)}";
    const beginReplacement="function beginEditor(){entry.classList.add('hidden');ensureCreativeDesignCheck();renderCreativeDesignCheck();setTimeout(()=>map.invalidateSize(),50)}";
    if(src.includes(beginNeedle))src=src.replace(beginNeedle,beginReplacement);

    const drawNeedle="function drawAll(){layerDefs.forEach(([k])=>groups[k].clearLayers());polygonGroup.clearLayers();records.forEach(drawRecord);polygons.forEach(p=>{if(!p.deleted)p.layerObj=L.polygon(p.points,{pane:'polygon',color:'#5a8b5f',weight:3,fillColor:'#6ea979',fillOpacity:.09,interactive:false}).addTo(polygonGroup)});if(polygonVisible){if(!map.hasLayer(polygonGroup))polygonGroup.addTo(map)}else if(map.hasLayer(polygonGroup))map.removeLayer(polygonGroup);renderRecordCircles()}";
    const drawReplacement=drawNeedle.slice(0,-1)+";renderCreativeDesignCheck()}";
    if(src.includes(drawNeedle))src=src.replace(drawNeedle,drawReplacement);

    return src;
  };
})();
