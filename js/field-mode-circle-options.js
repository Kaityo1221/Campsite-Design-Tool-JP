(() => {
  'use strict';

  const selectionSection=document.querySelector('.field-mode-selection');
  if(!selectionSection)return;

  const DB_NAME='campsite-field-session';
  const DB_VERSION=1;
  const SOURCE_STORE='source';
  const STATE_STORE='state';
  const CURRENT_KEY='current';
  const CIRCLE_KEY='circle-options-v2';
  const LEGACY_CIRCLE_KEY='circle-options-v1';
  let currentSourceSignature='';
  let storedPayload=null;
  let loadGeneration=0;

  const style=document.createElement('style');
  style.textContent=`
    .field-circle-options{display:none;margin-top:10px;padding:10px 12px;border:1px solid #d2c39f;border-radius:12px;background:#fffaf0}
    .field-circle-options.active{display:block}
    .field-circle-options-title{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:900;color:#49391e}
    .field-circle-options-note{margin-top:5px;font-size:10px;line-height:1.45;color:#746957}
    .field-circle-toggle{width:100%;min-height:40px;margin-top:8px;border:1px solid #a88445;border-radius:11px;background:#fffdf7;color:#49391e;font-weight:900;font-size:12px}
    .field-circle-toggle.is-on{border-color:#a13f6a;background:#fff0f6;color:#7e294e}
  `;
  document.head.appendChild(style);

  const box=document.createElement('div');
  box.className='field-circle-options';
  box.innerHTML=`
    <div class="field-circle-options-title"><span>⭕ 距離円</span><span>50m 必須</span></div>
    <div class="field-circle-options-note">50m円は自動で保存します。30m・40mは参考距離として必要な新規POIだけ追加できます。</div>
    <button id="fieldPoi40mToggle" class="field-circle-toggle" type="button">40m参考円：追加しない</button>
    <button id="fieldPoi30mToggle" class="field-circle-toggle" type="button">30m参考円：追加しない</button>
  `;

  const saveRow=selectionSection.querySelector('.field-save-row');
  if(saveRow)selectionSection.insertBefore(box,saveRow);
  else selectionSection.appendChild(box);
  const toggle40=box.querySelector('#fieldPoi40mToggle');
  const toggle30=box.querySelector('#fieldPoi30mToggle');

  function openDb(){
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(SOURCE_STORE))db.createObjectStore(SOURCE_STORE);
        if(!db.objectStoreNames.contains(STATE_STORE))db.createObjectStore(STATE_STORE);
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('参考距離円の端末保存を開けませんでした。'));
    });
  }

  async function readStore(storeName,key){
    const db=await openDb();
    try{
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(storeName,'readonly');
        const request=tx.objectStore(storeName).get(key);
        request.onsuccess=()=>resolve(request.result||null);
        request.onerror=()=>reject(request.error||tx.error);
      });
    }finally{db.close();}
  }

  async function writePayload(payload){
    const db=await openDb();
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STATE_STORE,'readwrite');
        tx.objectStore(STATE_STORE).put(payload,CIRCLE_KEY);
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error);
        tx.onabort=()=>reject(tx.error);
      });
    }finally{db.close();}
  }

  function sourceSignatureFromFile(file){
    if(!file)return'';
    return `${file.name||''}:${Number(file.size)||0}:${Number(file.lastModified)||0}`;
  }

  function sourceSignatureFromStored(source){
    if(!source)return'';
    const size=source.bytes?.byteLength??source.blob?.size??0;
    return `${source.name||''}:${Number(size)||0}:${Number(source.lastModified)||0}`;
  }

  function recordKey(record){
    const origin=Array.isArray(record?.originalLatlng)?record.originalLatlng:record?.latlng||[];
    const lat=Number(origin[0]);
    const lng=Number(origin[1]);
    return [
      String(record?.poiType||'pokestop'),
      String(record?.name||''),
      Number.isFinite(lat)?lat.toFixed(7):'',
      Number.isFinite(lng)?lng.toFixed(7):''
    ].join('|');
  }

  function selectionsForCurrentSource(){
    if(!storedPayload||storedPayload.sourceSignature!==currentSourceSignature)return null;
    return storedPayload.selections||{};
  }

  function normalizedSelection(value){
    if(value===true)return{include30mCircle:true,include40mCircle:false};
    if(!value||typeof value!=='object')return null;
    return{include30mCircle:!!value.include30mCircle,include40mCircle:!!value.include40mCircle};
  }

  function applySavedToRecord(record){
    if(!record?.isNew)return;
    const selections=selectionsForCurrentSource();
    if(!selections)return;
    const saved=normalizedSelection(selections[recordKey(record)]);
    if(!saved)return;
    record.include30mCircle=saved.include30mCircle;
    record.include40mCircle=saved.include40mCircle;
  }

  function applySavedToRecords(){
    if(!currentSourceSignature||!Array.isArray(poiRecords))return;
    poiRecords.forEach(applySavedToRecord);
  }

  async function loadForSignature(signature){
    const requestedSignature=signature||'';
    const generation=++loadGeneration;
    currentSourceSignature=requestedSignature;
    try{
      const payload=await readStore(STATE_STORE,CIRCLE_KEY)||await readStore(STATE_STORE,LEGACY_CIRCLE_KEY);
      if(generation!==loadGeneration)return;
      storedPayload=payload?.version===2?payload:payload?.version===1?{...payload,version:2}:null;
      applySavedToRecords();
      render();
    }catch(error){
      if(generation!==loadGeneration)return;
      console.warn('field reference circle option restore failed',error);
      storedPayload=null;
    }
  }

  async function refreshAfterSessionRestore(){
    try{
      const source=await readStore(SOURCE_STORE,CURRENT_KEY);
      await loadForSignature(sourceSignatureFromStored(source));
      applySavedToRecords();
      render();
    }catch(error){
      console.warn('field reference circle session restore sync failed',error);
    }
  }

  function installResumeWatcher(){
    const resumeButton=document.getElementById('fieldModeResumeButton');
    const resumePanel=document.getElementById('fieldModeResumePanel');
    if(!resumeButton||resumeButton.dataset.circleRestoreBound==='1')return Boolean(resumeButton);
    resumeButton.dataset.circleRestoreBound='1';
    resumeButton.addEventListener('click',()=>{
      const startedAt=Date.now();
      const timer=window.setInterval(()=>{
        const restored=window.FieldModeSession?.hasSource?.()&&!resumePanel?.classList.contains('active');
        if(restored){
          window.clearInterval(timer);
          refreshAfterSessionRestore();
          return;
        }
        if(Date.now()-startedAt>=10000)window.clearInterval(timer);
      },80);
    });
    return true;
  }

  function installResumePanelObserver(){
    const resumePanel=document.getElementById('fieldModeResumePanel');
    if(!resumePanel||resumePanel.dataset.circleRestoreObserved==='1')return Boolean(resumePanel);
    resumePanel.dataset.circleRestoreObserved='1';
    let wasActive=resumePanel.classList.contains('active');
    const observer=new MutationObserver(()=>{
      const active=resumePanel.classList.contains('active');
      if(wasActive&&!active&&window.FieldModeSession?.hasSource?.()){
        refreshAfterSessionRestore();
      }
      wasActive=active;
    });
    observer.observe(resumePanel,{attributes:true,attributeFilter:['class']});
    return true;
  }

  function bindResumeHooksWhenReady(){
    if(installResumeWatcher()&&installResumePanelObserver())return;
    const startedAt=Date.now();
    const timer=window.setInterval(()=>{
      const watcherReady=installResumeWatcher();
      const observerReady=installResumePanelObserver();
      if((watcherReady&&observerReady)||Date.now()-startedAt>=10000){
        window.clearInterval(timer);
      }
    },80);
  }

  function installRestoreStatusObserver(){
    const target=document.getElementById('fieldModeStatus');
    if(!target||target.dataset.circleRestoreStatusObserved==='1')return;
    target.dataset.circleRestoreStatusObserved='1';
    let lastText=target.textContent||'';
    const observer=new MutationObserver(()=>{
      const text=target.textContent||'';
      if(text!==lastText&&text.includes('前回作業を復元'))refreshAfterSessionRestore();
      lastText=text;
    });
    observer.observe(target,{childList:true,subtree:true,characterData:true});
  }

  async function saveCurrentSelections(){
    if(!currentSourceSignature)return;
    const selections={};
    poiRecords.filter(record=>record?.isNew&&!record.fieldDeleted).forEach(record=>{
      if(record.include30mCircle||record.include40mCircle){
        selections[recordKey(record)]={include30mCircle:!!record.include30mCircle,include40mCircle:!!record.include40mCircle};
      }
    });
    storedPayload={version:2,sourceSignature:currentSourceSignature,selections,savedAt:Date.now()};
    try{await writePayload(storedPayload);}catch(error){console.warn('field reference circle option save failed',error);}
  }

  function render(){
    applySavedToRecord(selectedPoi);
    const active=!!selectedPoi?.added&&!!selectedPoi?.isNew&&!selectedPoi?.fieldDeleted;
    box.classList.toggle('active',active);
    if(!active){
      toggle40.classList.remove('is-on');
      toggle30.classList.remove('is-on');
      toggle40.textContent='40m参考円：追加しない';
      toggle30.textContent='30m参考円：追加しない';
      return;
    }
    const on40=!!selectedPoi.include40mCircle,on30=!!selectedPoi.include30mCircle;
    toggle40.classList.toggle('is-on',on40);
    toggle30.classList.toggle('is-on',on30);
    toggle40.textContent=on40?'40m参考円：追加する ✓':'40m参考円：追加しない';
    toggle30.textContent=on30?'30m参考円：追加する ✓':'30m参考円：追加しない';
  }

  function toggleReferenceCircle(meters){
    if(!selectedPoi?.added||!selectedPoi?.isNew||selectedPoi.fieldDeleted)return;
    const property=meters===40?'include40mCircle':'include30mCircle';
    selectedPoi[property]=!selectedPoi[property];
    const selections=selectionsForCurrentSource()||{};
    if(selectedPoi.include30mCircle||selectedPoi.include40mCircle){
      selections[recordKey(selectedPoi)]={include30mCircle:!!selectedPoi.include30mCircle,include40mCircle:!!selectedPoi.include40mCircle};
    }else delete selections[recordKey(selectedPoi)];
    storedPayload={version:2,sourceSignature:currentSourceSignature,selections,savedAt:Date.now()};
    render();
    updateSaveButton();
    modeStatus.textContent=selectedPoi[property]?`${meters}m参考円を追加`:`${meters}m参考円を解除`;
    saveCurrentSelections();
  }

  toggle40.addEventListener('click',()=>toggleReferenceCircle(40));
  toggle30.addEventListener('click',()=>toggleReferenceCircle(30));

  const originalSelectAddedPoi=selectAddedPoi;
  selectAddedPoi=function circleAwareSelectAddedPoi(record){
    applySavedToRecord(record);
    const result=originalSelectAddedPoi(record);
    render();
    return result;
  };

  const originalResetPoiSelection=resetPoiSelection;
  resetPoiSelection=function circleAwareResetPoiSelection(...args){
    const result=originalResetPoiSelection(...args);
    render();
    return result;
  };

  const originalRenderKml=renderKml;
  renderKml=function circleAwareRenderKml(...args){
    const result=originalRenderKml(...args);
    setTimeout(()=>{
      applySavedToRecords();
      render();
    },0);
    return result;
  };

  const originalUpdateSaveButton=updateSaveButton;
  updateSaveButton=function circleAwareUpdateSaveButton(...args){
    applySavedToRecords();
    return originalUpdateSaveButton(...args);
  };

  fileInput.addEventListener('change',()=>{
    const file=fileInput.files&&fileInput.files[0];
    if(file)loadForSignature(sourceSignatureFromFile(file));
  });

  readStore(SOURCE_STORE,CURRENT_KEY)
    .then(source=>{
      if(currentSourceSignature)return;
      return loadForSignature(sourceSignatureFromStored(source));
    })
    .catch(error=>console.warn('field reference circle source restore failed',error));

  bindResumeHooksWhenReady();
  installRestoreStatusObserver();

  render();
  window.FieldModeCircleOptions={render,saveNow:saveCurrentSelections,applySavedToRecords,refreshAfterSessionRestore};
})();
