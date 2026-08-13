(() => {
  'use strict';

  const selectionSection=document.querySelector('.field-mode-selection');
  if(!selectionSection)return;

  const DB_NAME='campsite-field-session';
  const DB_VERSION=1;
  const SOURCE_STORE='source';
  const STATE_STORE='state';
  const CURRENT_KEY='current';
  const CIRCLE_KEY='circle-options-v1';
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
    <div class="field-circle-options-title"><span>⭕ 距離円</span><span>40m 基本</span></div>
    <div class="field-circle-options-note">40m円は自動で保存します。30m調整円は必要な新規POIだけ追加してください。</div>
    <button id="fieldPoi30mToggle" class="field-circle-toggle" type="button">30m調整円：追加しない</button>
  `;

  const saveRow=selectionSection.querySelector('.field-save-row');
  if(saveRow)selectionSection.insertBefore(box,saveRow);
  else selectionSection.appendChild(box);
  const toggle=box.querySelector('#fieldPoi30mToggle');

  function openDb(){
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(SOURCE_STORE))db.createObjectStore(SOURCE_STORE);
        if(!db.objectStoreNames.contains(STATE_STORE))db.createObjectStore(STATE_STORE);
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('30m調整円の端末保存を開けませんでした。'));
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
    if(!storedPayload||storedPayload.sourceSignature!==currentSourceSignature)return{};
    return storedPayload.selections||{};
  }

  function applySavedToRecord(record){
    if(!record?.isNew)return;
    const selections=selectionsForCurrentSource();
    record.include30mCircle=!!selections[recordKey(record)];
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
      const payload=await readStore(STATE_STORE,CIRCLE_KEY);
      if(generation!==loadGeneration)return;
      storedPayload=payload?.version===1?payload:null;
      applySavedToRecords();
      render();
    }catch(error){
      if(generation!==loadGeneration)return;
      console.warn('field 30m option restore failed',error);
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
      console.warn('field 30m session restore sync failed',error);
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

  async function saveCurrentSelections(){
    if(!currentSourceSignature)return;
    const selections={};
    poiRecords.filter(record=>record?.isNew&&!record.fieldDeleted).forEach(record=>{
      if(record.include30mCircle)selections[recordKey(record)]=true;
    });
    storedPayload={version:1,sourceSignature:currentSourceSignature,selections,savedAt:Date.now()};
    try{await writePayload(storedPayload);}catch(error){console.warn('field 30m option save failed',error);}
  }

  function render(){
    applySavedToRecord(selectedPoi);
    const active=!!selectedPoi?.added&&!!selectedPoi?.isNew&&!selectedPoi?.fieldDeleted;
    box.classList.toggle('active',active);
    if(!active){
      toggle.classList.remove('is-on');
      toggle.textContent='30m調整円：追加しない';
      return;
    }
    const on=!!selectedPoi.include30mCircle;
    toggle.classList.toggle('is-on',on);
    toggle.textContent=on?'30m調整円：追加する ✓':'30m調整円：追加しない';
  }

  toggle.addEventListener('click',()=>{
    if(!selectedPoi?.added||!selectedPoi?.isNew||selectedPoi.fieldDeleted)return;
    selectedPoi.include30mCircle=!selectedPoi.include30mCircle;
    const selections=selectionsForCurrentSource();
    if(selectedPoi.include30mCircle)selections[recordKey(selectedPoi)]=true;
    else delete selections[recordKey(selectedPoi)];
    storedPayload={version:1,sourceSignature:currentSourceSignature,selections,savedAt:Date.now()};
    render();
    updateSaveButton();
    modeStatus.textContent=selectedPoi.include30mCircle?'30m調整円を追加':'30m調整円を解除';
    saveCurrentSelections();
  });

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
    .catch(error=>console.warn('field 30m source restore failed',error));

  bindResumeHooksWhenReady();

  render();
  window.FieldModeCircleOptions={render,saveNow:saveCurrentSelections,applySavedToRecords,refreshAfterSessionRestore};
})();
