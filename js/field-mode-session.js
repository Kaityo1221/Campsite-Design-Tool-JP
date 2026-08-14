(() => {
  'use strict';

  const DB_NAME='campsite-field-session';
  const DB_VERSION=1;
  const KEY='current';
  const STATE_DEBOUNCE_MS=350;
  const SOURCE_STORE='source';
  const STATE_STORE='state';
  const VIEW_STORE='view';

  const intro=document.querySelector('.field-mode-intro');
  if(!intro||typeof indexedDB==='undefined')return;

  let currentSourceFile=null;
  let currentSourceId='';
  let sourceReady=Promise.resolve(true);
  let dbPromise=null;
  let restoring=false;
  let stateTimer=0;
  let newIdSeq=0;

  const style=document.createElement('style');
  style.textContent=`
    .field-session-panel{display:none;margin-top:10px;padding:11px;border:1px solid #bda56e;border-radius:14px;background:#fff8e6;color:#49391e;box-shadow:0 2px 8px rgba(73,57,30,.08)}
    .field-session-panel.active{display:block}
    .field-session-panel strong{display:block;font-size:13px}
    .field-session-panel small{display:block;margin-top:4px;color:#746957;line-height:1.45}
    .field-session-actions{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:9px}
    .field-session-actions button{min-height:38px;border-radius:11px;font-weight:900;font-size:12px}
    .field-session-resume{border:1px solid #8a6b31;background:#d8b766;color:#34260e}
    .field-session-discard{border:1px solid #c9b993;background:#fffdf7;color:#746957;padding:0 12px}
    .field-session-status{margin-top:7px;min-height:16px;font-size:10px;color:#6f765d}
    .field-session-status.warn{color:#a24b3d}
  `;
  document.head.appendChild(style);

  const panel=document.createElement('div');
  panel.id='fieldModeResumePanel';
  panel.className='field-session-panel';
  panel.innerHTML=`
    <strong>💾 前回の現地作業があります</strong>
    <small id="fieldModeResumeDetail"></small>
    <div class="field-session-actions">
      <button id="fieldModeResumeButton" class="field-session-resume" type="button">▶ 続きから再開</button>
      <button id="fieldModeDiscardSessionButton" class="field-session-discard" type="button">🗑 破棄</button>
    </div>
  `;
  const status=document.createElement('div');
  status.id='fieldModeSessionStatus';
  status.className='field-session-status';
  status.textContent='自動保存：待機中';
  intro.append(panel,status);

  const resumeDetail=panel.querySelector('#fieldModeResumeDetail');
  const resumeButton=panel.querySelector('#fieldModeResumeButton');
  const discardButton=panel.querySelector('#fieldModeDiscardSessionButton');

  function setStatus(text,warn=false){
    status.textContent=text;
    status.classList.toggle('warn',warn);
  }

  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{
        const db=request.result;
        for(const storeName of [SOURCE_STORE,STATE_STORE,VIEW_STORE]){
          if(!db.objectStoreNames.contains(storeName))db.createObjectStore(storeName);
        }
      };
      request.onsuccess=()=>{
        const db=request.result;
        db.onversionchange=()=>{
          db.close();
          dbPromise=null;
        };
        resolve(db);
      };
      request.onerror=()=>{
        const error=request.error||new Error('IndexedDBを開けませんでした。');
        dbPromise=null;
        reject(error);
      };
      request.onblocked=()=>console.warn('field session IndexedDB open blocked');
    });
    return dbPromise;
  }

  function idbError(prefix,request,tx){
    return request?.error||tx?.error||new Error(prefix);
  }

  async function storePut(storeName,value){
    const db=await openDb();
    await new Promise((resolve,reject)=>{
      let settled=false;
      let tx;
      let request;
      const finish=(fn,value)=>{
        if(settled)return;
        settled=true;
        fn(value);
      };
      try{
        tx=db.transaction(storeName,'readwrite');
        request=tx.objectStore(storeName).put(value,KEY);
      }catch(error){
        reject(error);
        return;
      }
      request.onerror=event=>{
        console.error(`field session ${storeName} put failed`,request.error);
        event.preventDefault?.();
        try{tx.abort();}catch(_){}
        finish(reject,idbError('端末保存に失敗しました。',request,tx));
      };
      tx.oncomplete=()=>finish(resolve);
      tx.onerror=()=>finish(reject,idbError('端末保存に失敗しました。',request,tx));
      tx.onabort=()=>finish(reject,idbError('端末保存が中断されました。',request,tx));
    });
  }

  async function storeGet(storeName){
    const db=await openDb();
    return await new Promise((resolve,reject)=>{
      let tx;
      let request;
      try{
        tx=db.transaction(storeName,'readonly');
        request=tx.objectStore(storeName).get(KEY);
      }catch(error){
        reject(error);
        return;
      }
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error||tx.error||new Error('端末データを読めませんでした。'));
    });
  }

  async function storeDelete(storeName){
    const db=await openDb();
    await new Promise((resolve,reject)=>{
      let tx;
      try{
        tx=db.transaction(storeName,'readwrite');
        tx.objectStore(storeName).delete(KEY);
      }catch(error){
        reject(error);
        return;
      }
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error('端末データを削除できませんでした。'));
      tx.onabort=()=>reject(tx.error||new Error('端末データの削除が中断されました。'));
    });
  }

  async function clearAll(){
    await Promise.all([SOURCE_STORE,STATE_STORE,VIEW_STORE].map(storeDelete));
  }

  function makeSourceId(file){
    const random=globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2);
    return `${Date.now().toString(36)}-${file.size}-${random}`;
  }

  function normalizedLastModified(value){
    const number=Number(value);
    return Number.isFinite(number)&&number>=0?number:0;
  }

  async function saveSource(file,sourceId){
    if(!file||!sourceId)return false;
    const bytes=await file.arrayBuffer();
    await storePut(SOURCE_STORE,{
      version:2,
      sourceId,
      name:file.name||'field-data.kmz',
      type:file.type||'application/octet-stream',
      lastModified:normalizedLastModified(file.lastModified),
      bytes
    });
    return true;
  }

  function ensureRecordIds(){
    poiRecords.forEach((record,index)=>{
      if(record.fieldSessionId)return;
      if(record.isNew){
        newIdSeq+=1;
        record.fieldSessionId=`new:${Date.now().toString(36)}:${newIdSeq}`;
      }else{
        record.fieldSessionId=`orig:${index}`;
      }
    });
  }

  async function serializePhoto(photo){
    if(!photo?.blob)return null;
    const bytes=await photo.blob.arrayBuffer();
    return {
      name:photo.name||'photo.jpg',
      type:photo.type||photo.blob.type||'image/jpeg',
      bytes,
      originalBytes:Number(photo.originalBytes)||0,
      width:Number(photo.width)||0,
      height:Number(photo.height)||0
    };
  }

  function restorePhoto(photo){
    if(!photo)return null;
    if(photo.blob)return photo;
    if(!photo.bytes)return null;
    const type=photo.type||'image/jpeg';
    return {
      name:photo.name||'photo.jpg',
      type,
      blob:new Blob([photo.bytes],{type}),
      originalBytes:Number(photo.originalBytes)||0,
      width:Number(photo.width)||0,
      height:Number(photo.height)||0
    };
  }

  async function serializeRecord(record){
    return {
      id:record.fieldSessionId,
      name:record.name||'',
      description:record.description||'',
      folder:record.folder||'',
      latlng:[...record.latlng],
      originalLatlng:[...record.originalLatlng],
      added:!!record.added,
      isNew:!!record.isNew,
      poiType:record.poiType||'',
      fieldMemo:record.fieldMemo||'',
      fieldMemoDirty:!!record.fieldMemoDirty,
      fieldPhoto:await serializePhoto(record.fieldPhoto),
      fieldPhotoDirty:!!record.fieldPhotoDirty,
      fieldDeleted:!!record.fieldDeleted,
      include30mCircle:!!record.include30mCircle,
      include40mCircle:!!record.include40mCircle
    };
  }

  function serializeAction(action){
    if(!action?.record)return null;
    if(!action.record.fieldSessionId){
      newIdSeq+=1;
      action.record.fieldSessionId=`new:${Date.now().toString(36)}:${newIdSeq}`;
    }
    const out={kind:action.kind,recordId:action.record.fieldSessionId};
    if(Array.isArray(action.from))out.from=[...action.from];
    if(Array.isArray(action.to))out.to=[...action.to];
    return out;
  }

  async function makeState(){
    ensureRecordIds();
    const records=[];
    for(const record of poiRecords.filter(item=>item.added||item.isNew)){
      records.push(await serializeRecord(record));
    }
    return {
      version:2,
      sourceId:currentSourceId,
      sourceName:currentSourceFile?.name||sourceFileName||'field-data',
      savedAt:Date.now(),
      records,
      undo:undoStack.map(serializeAction).filter(Boolean),
      redo:redoStack.map(serializeAction).filter(Boolean),
      selectedId:selectedPoi?.fieldSessionId||''
    };
  }

  async function persistStateNow(){
    if(restoring||!fileLoaded||!currentSourceFile||!currentSourceId)return false;
    clearTimeout(stateTimer);
    try{
      const sourceSaved=await sourceReady;
      if(!sourceSaved){
        setStatus('⚠ 元ファイルを端末保存できないため、自動復元は利用できません。',true);
        return false;
      }
      const state=await makeState();
      await storePut(STATE_STORE,state);
      const stamp=new Date(state.savedAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
      setStatus(`💾 自動保存済み ${stamp}`);
      return true;
    }catch(error){
      console.error('field session autosave failed',error);
      setStatus(`⚠ 自動保存できません：${error.message||'端末保存エラー'}`,true);
      return false;
    }
  }

  function scheduleStateSave(){
    if(restoring||!fileLoaded||!currentSourceFile||!currentSourceId)return;
    clearTimeout(stateTimer);
    stateTimer=setTimeout(()=>{persistStateNow();},STATE_DEBOUNCE_MS);
  }

  async function persistView(){
    if(restoring||!fileLoaded||!currentSourceId)return false;
    try{
      const sourceSaved=await sourceReady;
      if(!sourceSaved)return false;
      const center=map.getCenter();
      await storePut(VIEW_STORE,{
        version:1,
        sourceId:currentSourceId,
        center:[center.lat,center.lng],
        zoom:map.getZoom(),
        savedAt:Date.now()
      });
      return true;
    }catch(error){
      console.warn('field session view save failed',error);
      return false;
    }
  }

  function typeLabel(value){
    if(value==='gym')return'ジム';
    if(value==='power_spot')return'パワースポット';
    return'ポケストップ';
  }

  function createRestoredNewRecord(snapshot){
    const latlng=[...snapshot.latlng];
    const rangeCircle=L.circle(latlng,{pane:'fieldBackgroundPane',radius:window.CampsitePoiSpacingPolicy.targetMeters,color:'#d58b00',weight:2,opacity:.7,fillColor:'#ffd35c',fillOpacity:.035,interactive:false,dashArray:'6 5'});
    const marker=L.circleMarker(latlng,{pane:'fieldPoiPane',radius:9,weight:3,color:'#d58b00',fillColor:'#ffd35c',fillOpacity:.9});
    const record={
      marker,rangeCircle,
      name:snapshot.name||`${typeLabel(snapshot.poiType)} 復元`,
      description:snapshot.description||'',
      folder:snapshot.folder||'追加希望POI',
      latlng,
      originalLatlng:Array.isArray(snapshot.originalLatlng)?[...snapshot.originalLatlng]:[...latlng],
      added:true,
      isNew:true,
      poiType:snapshot.poiType||'pokestop',
      fieldMemo:snapshot.fieldMemo||'',
      fieldMemoDirty:!!snapshot.fieldMemoDirty,
      fieldPhoto:restorePhoto(snapshot.fieldPhoto),
      fieldPhotoDirty:!!snapshot.fieldPhotoDirty,
      fieldDeleted:!!snapshot.fieldDeleted,
      include30mCircle:!!snapshot.include30mCircle,
      include40mCircle:!!snapshot.include40mCircle,
      fieldSessionId:snapshot.id
    };
    marker.bindPopup(`<strong>${record.name}</strong><br><small>${typeLabel(record.poiType)}</small><br><b>新規追加POI</b>`);
    marker.on('click',()=>selectAddedPoi(record));
    if(!record.fieldDeleted){
      rangeCircle.addTo(dataLayer);
      marker.addTo(dataLayer);
    }
    poiRecords.push(record);
    return record;
  }

  function applySnapshot(record,snapshot){
    record.fieldSessionId=snapshot.id;
    record.latlng=[...snapshot.latlng];
    record.marker.setLatLng(record.latlng);
    if(record.rangeCircle)record.rangeCircle.setLatLng(record.latlng);
    record.poiType=snapshot.poiType||record.poiType||'';
    record.fieldMemo=snapshot.fieldMemo||'';
    record.fieldMemoDirty=!!snapshot.fieldMemoDirty;
    record.fieldPhoto=restorePhoto(snapshot.fieldPhoto);
    record.fieldPhotoDirty=!!snapshot.fieldPhotoDirty;
    record.fieldDeleted=!!snapshot.fieldDeleted;
    record.include30mCircle=!!snapshot.include30mCircle;
    record.include40mCircle=!!snapshot.include40mCircle;
    if(record.fieldDeleted){
      if(dataLayer.hasLayer(record.marker))dataLayer.removeLayer(record.marker);
      if(record.rangeCircle&&dataLayer.hasLayer(record.rangeCircle))dataLayer.removeLayer(record.rangeCircle);
    }
  }

  function deserializeAction(snapshot,recordMap){
    const record=recordMap.get(snapshot.recordId);
    if(!record)return null;
    const action={kind:snapshot.kind,record};
    if(Array.isArray(snapshot.from))action.from=[...snapshot.from];
    if(Array.isArray(snapshot.to))action.to=[...snapshot.to];
    return action;
  }

  async function sourceToFile(source){
    if(source.bytes){
      return new File([source.bytes],source.name,{type:source.type||'application/octet-stream',lastModified:normalizedLastModified(source.lastModified)});
    }
    if(source.blob){
      return source.blob instanceof File
        ? source.blob
        : new File([source.blob],source.name,{type:source.type||'application/octet-stream',lastModified:normalizedLastModified(source.lastModified)});
    }
    throw new Error('前回の元ファイルが端末内にありません。');
  }

  async function restoreSession(source,state,view){
    restoring=true;
    resumeButton.disabled=true;
    discardButton.disabled=true;
    setStatus('💾 前回の作業を復元中…');
    try{
      const file=await sourceToFile(source);
      currentSourceFile=file;
      currentSourceId=source.sourceId;
      sourceReady=Promise.resolve(true);
      sourceFileName=file.name;
      window.FieldModeExport?.setSourceFile?.(file);
      const kmlText=await readKmlText(file);
      fileStatus.textContent=`前回の現地作業を復元：${file.name}`;
      renderKml(kmlText);
      ensureRecordIds();

      const recordMap=new Map(poiRecords.map(record=>[record.fieldSessionId,record]));
      for(const snapshot of state.records||[]){
        if(snapshot.isNew){
          const record=createRestoredNewRecord(snapshot);
          recordMap.set(record.fieldSessionId,record);
        }else{
          const record=recordMap.get(snapshot.id);
          if(record)applySnapshot(record,snapshot);
        }
      }

      undoStack.length=0;
      redoStack.length=0;
      for(const action of state.undo||[]){const restored=deserializeAction(action,recordMap);if(restored)undoStack.push(restored);}
      for(const action of state.redo||[]){const restored=deserializeAction(action,recordMap);if(restored)redoStack.push(restored);}

      const selected=state.selectedId?recordMap.get(state.selectedId):null;
      if(selected&&!selected.fieldDeleted)selectAddedPoi(selected);
      else resetPoiSelection();

      if(view?.sourceId===currentSourceId&&Array.isArray(view.center)&&Number.isFinite(view.zoom)){
        map.setView(view.center,view.zoom,{animate:false});
      }
      updateHistoryButtons();
      updateSaveButton();
      updateNewPoiButton();
      updateDistanceStatus(selected?.latlng||currentPosition,selected||null);
      placeholder.style.display='none';
      fileLoaded=true;
      modeStatus.textContent='前回作業を復元';
      panel.classList.remove('active');
      setStatus(`💾 前回の作業を復元しました ${new Date(state.savedAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}`);
    }catch(error){
      console.error('field session restore failed',error);
      setStatus(`⚠ 復元できません：${error.message||'復元エラー'}`,true);
      modeStatus.textContent='復元失敗';
    }finally{
      restoring=false;
      resumeButton.disabled=false;
      discardButton.disabled=false;
      if(fileLoaded)await persistStateNow();
    }
  }

  async function findResumeCandidate(){
    try{
      const [source,state,view]=await Promise.all([storeGet(SOURCE_STORE),storeGet(STATE_STORE),storeGet(VIEW_STORE)]);
      if(!source||!state||!source.sourceId||source.sourceId!==state.sourceId)return null;
      return{source,state,view};
    }catch(error){
      console.warn('field session lookup failed',error);
      setStatus('⚠ このブラウザでは現地作業の自動保存を利用できません。',true);
      return null;
    }
  }

  function showResume(candidate){
    const stamp=new Date(candidate.state.savedAt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
    resumeDetail.textContent=`${candidate.source.name} ／ ${stamp} 保存。確定済みのPOI・移動・削除・メモ・写真・戻る/進む履歴を復元します。`;
    panel.classList.add('active');
    resumeButton.onclick=()=>restoreSession(candidate.source,candidate.state,candidate.view);
    discardButton.onclick=async()=>{
      if(!window.confirm('前回の現地作業データを端末から破棄しますか？'))return;
      try{
        await clearAll();
        panel.classList.remove('active');
        setStatus('自動保存：前回データを破棄しました');
      }catch(error){
        console.error(error);
        setStatus('⚠ 前回データを破棄できませんでした。',true);
      }
    };
  }

  const originalRenderKml=renderKml;
  renderKml=function sessionAwareRenderKml(kmlText){
    const result=originalRenderKml(kmlText);
    ensureRecordIds();
    scheduleStateSave();
    return result;
  };

  const originalUpdateSaveButton=updateSaveButton;
  updateSaveButton=function sessionAwareUpdateSaveButton(...args){
    const result=originalUpdateSaveButton(...args);
    scheduleStateSave();
    return result;
  };

  const originalSelectAddedPoi=selectAddedPoi;
  selectAddedPoi=function sessionAwareSelectAddedPoi(record){
    const result=originalSelectAddedPoi(record);
    scheduleStateSave();
    return result;
  };

  const originalResetPoiSelection=resetPoiSelection;
  resetPoiSelection=function sessionAwareResetPoiSelection(...args){
    const result=originalResetPoiSelection(...args);
    scheduleStateSave();
    return result;
  };

  fileInput.addEventListener('change',()=>{
    const file=fileInput.files&&fileInput.files[0];
    if(!file)return;
    currentSourceFile=file;
    currentSourceId=makeSourceId(file);
    panel.classList.remove('active');
    setStatus('💾 現地作業の自動保存を開始します');
    sourceReady=saveSource(file,currentSourceId).then(()=>true).catch(error=>{
      console.error('field session source save failed',error);
      setStatus(`⚠ 元ファイルを端末保存できません：${error.message||'保存エラー'}`,true);
      return false;
    });
  });

  map.on('moveend',()=>{persistView();});
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'){
      persistStateNow();
      persistView();
    }
  });

  findResumeCandidate().then(candidate=>{if(candidate)showResume(candidate);});

  window.FieldModeSession={
    saveNow:persistStateNow,
    clear:clearAll,
    hasSource:()=>!!currentSourceFile
  };
})();
