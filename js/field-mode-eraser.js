(() => {
  'use strict';

  const DB_NAME='campsite-field-session';
  const DB_VERSION=1;
  const DB_STORE='state';
  const AREA_DB_KEY='field-areas-v1';
  let active=false;
  let selectedTarget=null;
  let controls=null;
  let initialized=false;
  let originalSelectAddedPoi=null;
  const boundAreaLayers=new WeakSet();

  function areaRecords(){return window.FieldModeArea?.getRecords?.()||[];}
  function isEditablePoi(record){return !!record?.added&&!record.fieldDeleted;}
  function isEditableArea(record){return !!record?.layer&&!record.deleted;}

  function setPoiStyle(record,selected){
    if(!record?.marker?.setStyle)return;
    record.marker.setStyle(selected
      ? {radius:13,weight:5,color:'#a52222',fillColor:'#ff8a7d',fillOpacity:1}
      : {radius:9,weight:3,color:'#d58b00',fillColor:'#ffd35c',fillOpacity:.9});
  }

  function setAreaStyle(record,selected){
    if(!record?.layer?.setStyle)return;
    record.layer.setStyle(selected
      ? {color:'#b51f1f',weight:6,opacity:1,fillColor:'#ff6f61',fillOpacity:.24}
      : {color:'#e06b2d',weight:4,opacity:.95,fillColor:'#f3a35b',fillOpacity:.16});
  }

  function clearTarget(){
    if(selectedTarget?.type==='poi')setPoiStyle(selectedTarget.record,false);
    if(selectedTarget?.type==='area')setAreaStyle(selectedTarget.record,false);
    selectedTarget=null;
    refreshControls();
  }

  function choosePoi(record){
    if(!active||!isEditablePoi(record))return false;
    clearTarget();
    selectedTarget={type:'poi',record};
    setPoiStyle(record,true);
    try{record.marker?.closePopup?.();}catch(_){}
    refreshControls();
    modeStatus.textContent='消去対象を選択';
    return true;
  }

  function chooseArea(record){
    if(!active||!isEditableArea(record))return false;
    clearTarget();
    selectedTarget={type:'area',record};
    setAreaStyle(record,true);
    try{record.layer?.closePopup?.();}catch(_){}
    refreshControls();
    modeStatus.textContent='消去対象を選択';
    return true;
  }

  function ensureControls(){
    if(controls)return controls;
    controls=document.createElement('div');
    controls.id='fieldModeEraserActions';
    Object.assign(controls.style,{display:'none',position:'fixed',left:'50%',bottom:'var(--field-action-bottom)',transform:'translateX(-50%)',width:'min(calc(100% - 24px), 520px)',gridTemplateColumns:'1.4fr 1fr',gap:'8px',padding:'8px',border:'1px solid rgba(73,57,30,.24)',borderRadius:'16px',background:'rgba(59,49,37,.94)',boxShadow:'0 5px 16px rgba(0,0,0,.22)',backdropFilter:'blur(8px)',zIndex:'1200'});
    controls.innerHTML=`
      <button type="button" data-eraser-action="delete">🗑 削除する</button>
      <button type="button" data-eraser-action="clear">× 選択解除</button>`;
    controls.querySelectorAll('button').forEach(button=>Object.assign(button.style,{minHeight:'46px',border:'1px solid #b89a57',borderRadius:'12px',background:'rgba(255,248,230,.97)',color:'#49391e',fontWeight:'900'}));
    controls.querySelector('[data-eraser-action="delete"]').style.background='rgba(255,231,227,.98)';
    controls.querySelector('[data-eraser-action="delete"]').style.color='#9a3028';
    controls.addEventListener('click',event=>{
      const action=event.target.closest('[data-eraser-action]')?.dataset.eraserAction;
      if(action==='delete')deleteSelected();
      if(action==='clear')clearTarget();
    });
    document.body.appendChild(controls);
    return controls;
  }

  function refreshControls(){
    if(!controls)return;
    const deleteButton=controls.querySelector('[data-eraser-action="delete"]');
    deleteButton.disabled=!selectedTarget;
    if(!active)return;
    if(!selectedTarget){
      selectionTitle.textContent='🧽 消しゴム';
      selectionDetail.textContent='消したい追加POIまたは活動範囲を地図上でタップしてください。元KMZの背景パーツは削除しません。';
    }else{
      const label=selectedTarget.type==='poi'?'POI':'活動範囲';
      selectionTitle.textContent=`削除候補：${selectedTarget.record.name||label}`;
      selectionDetail.textContent=`${label}を赤く選択中です。「🗑 削除する」で確定します。削除後も「戻る」で復元できます。`;
    }
  }

  function openDb(){
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('IndexedDBを開けませんでした。'));
      request.onblocked=()=>reject(new Error('IndexedDBが使用中です。'));
    });
  }

  async function persistAreaSnapshot(){
    if(!window.FieldModeArea?.snapshot)return;
    try{
      const db=await openDb();
      try{
        const current=await new Promise((resolve,reject)=>{
          const tx=db.transaction(DB_STORE,'readonly'),request=tx.objectStore(DB_STORE).get(AREA_DB_KEY);
          request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error||tx.error);
        });
        if(!current)return;
        current.records=window.FieldModeArea.snapshot();
        current.savedAt=Date.now();
        await new Promise((resolve,reject)=>{
          const tx=db.transaction(DB_STORE,'readwrite'),request=tx.objectStore(DB_STORE).put(current,AREA_DB_KEY);
          request.onerror=()=>reject(request.error||tx.error);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
        });
      }finally{db.close();}
    }catch(error){console.warn('field eraser area autosave failed',error);}
  }

  function deletePoi(record){
    record.fieldDeleted=true;
    if(record.marker&&dataLayer.hasLayer(record.marker))dataLayer.removeLayer(record.marker);
    if(record.rangeCircle&&dataLayer.hasLayer(record.rangeCircle))dataLayer.removeLayer(record.rangeCircle);
    undoStack.push({kind:'delete',record});
    redoStack.length=0;
    if(typeof selectedPoi!=='undefined'&&selectedPoi===record)resetPoiSelection();
    updateHistoryButtons();updateSaveButton();
    window.FieldModeSession?.saveNow?.();
    modeStatus.textContent='POI削除';
  }

  function deleteArea(record){
    record.deleted=true;
    if(record.layer&&dataLayer.hasLayer(record.layer))dataLayer.removeLayer(record.layer);
    undoStack.push({kind:'area-delete',areaRecord:record});
    redoStack.length=0;
    updateHistoryButtons();updateSaveButton();persistAreaSnapshot();
    modeStatus.textContent='活動範囲削除';
  }

  function deleteSelected(){
    if(!selectedTarget)return;
    const target=selectedTarget;
    clearTarget();
    if(target.type==='poi')deletePoi(target.record);
    if(target.type==='area')deleteArea(target.record);
    refreshControls();
  }

  function undoAreaDelete(event){
    const action=undoStack[undoStack.length-1];
    if(action?.kind!=='area-delete')return;
    event.preventDefault();event.stopImmediatePropagation();
    undoStack.pop();
    action.areaRecord.deleted=false;
    if(action.areaRecord.layer&&!dataLayer.hasLayer(action.areaRecord.layer))action.areaRecord.layer.addTo(dataLayer);
    redoStack.push(action);
    updateHistoryButtons();updateSaveButton();persistAreaSnapshot();
    modeStatus.textContent='範囲削除を戻しました';
    if(active)bindAreaTargets();
  }

  function redoAreaDelete(event){
    const action=redoStack[redoStack.length-1];
    if(action?.kind!=='area-delete')return;
    event.preventDefault();event.stopImmediatePropagation();
    redoStack.pop();
    action.areaRecord.deleted=true;
    if(action.areaRecord.layer&&dataLayer.hasLayer(action.areaRecord.layer))dataLayer.removeLayer(action.areaRecord.layer);
    undoStack.push(action);
    updateHistoryButtons();updateSaveButton();persistAreaSnapshot();
    modeStatus.textContent='範囲削除をやり直しました';
  }

  function bindAreaTargets(){
    for(const record of areaRecords()){
      if(!record.layer||boundAreaLayers.has(record.layer))continue;
      boundAreaLayers.add(record.layer);
      record.layer.on('click',()=>{if(active)chooseArea(record);});
    }
  }

  function begin(){
    if(!fileLoaded)return;
    active=true;
    clearTarget();
    window.FieldCreative?.selectTool('eraser',{collapse:false});
    window.FieldCreative?.closeMenu();
    ensureControls().style.display='grid';
    bindAreaTargets();
    modeStatus.textContent='消しゴム';
    refreshControls();
  }

  function cancel(){
    if(!active)return;
    active=false;
    clearTarget();
    if(controls)controls.style.display='none';
    document.body.classList.remove('field-creative-tool-eraser');
  }

  function init(){
    if(initialized||!window.FieldCreative)return false;
    const hotbar=document.getElementById('fieldModeCreativeHotbar');
    if(!hotbar)return false;
    initialized=true;
    const button=document.createElement('button');
    button.type='button';button.className='field-mode-creative-tool';button.dataset.tool='eraser';
    button.innerHTML='<span>🧽</span><small>消去</small>';
    button.title='追加POI・活動範囲を地図から削除';
    const distance=hotbar.querySelector('[data-tool="distance"]');
    hotbar.insertBefore(button,distance||null);
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();begin();});

    originalSelectAddedPoi=selectAddedPoi;
    selectAddedPoi=function eraserAwareSelectPoi(record){
      if(active&&isEditablePoi(record)){choosePoi(record);return;}
      return originalSelectAddedPoi(record);
    };
    return true;
  }

  undoButton.addEventListener('click',undoAreaDelete,true);
  redoButton.addEventListener('click',redoAreaDelete,true);
  window.addEventListener('fieldcreativecancel',cancel);
  document.addEventListener('click',event=>{
    if(!active)return;
    const tool=event.target.closest?.('#fieldModeCreativeHotbar [data-tool]');
    if(tool&&tool.dataset.tool!=='eraser')cancel();
  },true);

  const timer=setInterval(()=>{if(init())clearInterval(timer);},0);
  setTimeout(()=>clearInterval(timer),5000);

  window.FieldModeEraser={begin,cancel,isActive:()=>active};
})();
