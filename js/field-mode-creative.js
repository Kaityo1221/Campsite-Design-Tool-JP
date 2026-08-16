(() => {
  'use strict';

  const body=document.body;
  const stage=document.querySelector('.field-mode-stage');
  const modeStatusEl=document.getElementById('fieldModeStatus');
  const fileInputEl=document.getElementById('fieldModeFile');
  const newPoiButtonEl=document.getElementById('fieldModeNewPoiButton');
  const selectionDetailEl=document.getElementById('fieldModeSelectionDetail');
  const selectionTitleEl=document.getElementById('fieldModeSelectionTitle');
  const adjustActions=document.querySelector('.field-mode-adjust-actions');
  const relocateButtonEl=document.getElementById('fieldModeRelocateButton');
  const fineTuneButtonEl=document.getElementById('fieldModeFineTuneButton');
  if(!stage)return;

  let active=false;
  let menuOpen=false;
  let activeTool=null;
  let savedScrollY=0;
  let copySyncing=false;

  if(adjustActions)adjustActions.style.display='none';

  const launcher=document.createElement('button');
  launcher.id='fieldModeCreativeButton';
  launcher.type='button';
  launcher.className='field-mode-creative-launcher';
  launcher.textContent='🧰';
  launcher.setAttribute('aria-label','クリエイティブ道具箱');
  launcher.title='クリエイティブ道具箱';

  const closeButton=document.createElement('button');
  closeButton.id='fieldModeCreativeClose';
  closeButton.type='button';
  closeButton.className='field-mode-creative-close';
  closeButton.textContent='× 閲覧へ戻る';

  const hotbar=document.createElement('div');
  hotbar.id='fieldModeCreativeHotbar';
  hotbar.className='field-mode-creative-hotbar';
  hotbar.setAttribute('role','toolbar');
  hotbar.setAttribute('aria-label','クリエイティブ道具');
  hotbar.innerHTML=`
    <button type="button" class="field-mode-creative-tool" data-tool="poi"><span>📍</span><small>POI</small></button>
    <button type="button" class="field-mode-creative-tool" data-tool="adjust"><span>🎯</span><small>位置調整</small></button>
    <button type="button" class="field-mode-creative-tool is-coming" data-tool="line" disabled><span>✏️</span><small>線</small></button>
    <button type="button" class="field-mode-creative-tool is-coming" data-tool="area" disabled><span>⬡</span><small>範囲</small></button>
    <button type="button" class="field-mode-creative-tool is-coming" data-tool="distance" disabled><span>📏</span><small>距離</small></button>
  `;

  const hint=document.createElement('div');
  hint.id='fieldModeCreativeHint';
  hint.className='field-mode-creative-hint';
  hint.textContent='道具を1つ選んで現地マップを編集します。';

  stage.append(launcher,closeButton,hotbar,hint);

  function canEnter(){
    try{return typeof fileLoaded!=='undefined'&&fileLoaded;}catch(_){return false;}
  }

  function hasAdjustTarget(){
    try{return !!selectedPoi?.added&&!selectedPoi.fieldDeleted;}catch(_){return false;}
  }

  function adjustToolButton(){return hotbar.querySelector('[data-tool="adjust"]');}

  function refreshAvailability(){
    launcher.disabled=!canEnter();
    launcher.title=launcher.disabled?'先にKMZ / KMLを読み込んでください':'クリエイティブ道具箱';
    const adjustButton=adjustToolButton();
    if(adjustButton){
      const disabled=!hasAdjustTarget();
      adjustButton.disabled=disabled;
      adjustButton.style.opacity=disabled?'.42':'';
      adjustButton.title=disabled?'先に黄色い追加予定POIを選択してください':'選択中POIの位置を調整';
    }
  }

  function invalidateMap(){
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      try{if(typeof map!=='undefined')map.invalidateSize();}catch(_){}
    }));
  }

  function setBodyToolClass(tool){
    ['poi','adjust','line','area','distance'].forEach(name=>body.classList.remove(`field-creative-tool-${name}`));
    if(tool)body.classList.add(`field-creative-tool-${tool}`);
  }

  function syncAdjustLabels(){
    if(!relocateButtonEl||!fineTuneButtonEl)return;
    let tuning=false;
    try{tuning=!!fineTuneMode;}catch(_){}
    if(tuning){
      relocateButtonEl.textContent='✓ この位置に変更';
      fineTuneButtonEl.textContent='× 微調整を取消';
      relocateButtonEl.disabled=false;
    }else{
      relocateButtonEl.textContent='📍 現在地へ';
      fineTuneButtonEl.textContent='🎯 十字で調整';
      try{relocateButtonEl.disabled=!currentPosition;}catch(_){relocateButtonEl.disabled=true;}
      fineTuneButtonEl.disabled=!hasAdjustTarget();
    }
  }

  function showAdjustControls(){
    if(!adjustActions||menuOpen)return;
    Object.assign(adjustActions.style,{
      display:'grid',
      visibility:'visible',
      position:'fixed',
      left:'50%',
      bottom:'var(--field-action-bottom)',
      transform:'translateX(-50%)',
      width:'min(calc(100% - 24px), 520px)',
      gridTemplateColumns:'1fr 1fr',
      gap:'8px',
      margin:'0',
      padding:'8px',
      border:'1px solid rgba(73,57,30,.24)',
      borderRadius:'16px',
      background:'rgba(59,49,37,.92)',
      boxShadow:'0 5px 16px rgba(0,0,0,.22)',
      backdropFilter:'blur(8px)',
      zIndex:'1180'
    });
    [relocateButtonEl,fineTuneButtonEl].forEach(button=>{
      if(!button)return;
      Object.assign(button.style,{
        minHeight:'46px',
        border:'1px solid #b89a57',
        borderRadius:'12px',
        background:'rgba(255,248,230,.97)',
        color:'#49391e',
        fontWeight:'900'
      });
    });
    syncAdjustLabels();
  }

  function hideAdjustControls(){
    if(!adjustActions)return;
    adjustActions.style.display='none';
  }

  function setMenu(open){
    menuOpen=!!open;
    body.classList.toggle('field-creative-menu-open',menuOpen);
    hotbar.classList.toggle('is-open',menuOpen);
    hint.classList.toggle('is-open',menuOpen);
    launcher.setAttribute('aria-expanded',String(menuOpen));
    if(menuOpen){
      hideAdjustControls();
      hotbar.style.display='flex';
      hotbar.style.zIndex='1300';
      hint.style.zIndex='1290';
      hint.textContent='道具を1つ選んで現地マップを編集します。';
      refreshAvailability();
    }else{
      hotbar.style.display='';
      hotbar.style.zIndex='';
      hint.style.zIndex='';
      if(activeTool==='adjust'){
        showAdjustControls();
        hint.textContent='現在地へ合わせるか、十字で位置を微調整します。';
      }
    }
  }

  function openPalette(){
    if(!active){
      enter();
      return;
    }
    window.dispatchEvent(new CustomEvent('fieldcreativecancel'));
    activeTool=null;
    setBodyToolClass(null);
    hotbar.querySelectorAll('.field-mode-creative-tool').forEach(button=>button.classList.remove('is-active'));
    hideAdjustControls();
    setMenu(true);
    if(modeStatusEl)modeStatusEl.textContent='道具を選択';
    invalidateMap();
  }

  function normalizeSelectionCopy(){
    if(!selectionDetailEl||copySyncing)return;
    const text=selectionDetailEl.textContent||'';
    let next=text;
    next=next.replace(/ここなら「ここに置く」をタップ。?/g,'位置変更は🧰「位置調整」から。');
    next=next.replace(/「ここに置く」をタップ。?/g,'🧰「位置調整」から変更できます。');
    if(next!==text){
      copySyncing=true;
      selectionDetailEl.textContent=next;
      copySyncing=false;
    }
  }

  function selectTool(tool,{collapse=true}={}){
    if(tool==='adjust'&&!hasAdjustTarget()){
      if(modeStatusEl)modeStatusEl.textContent='先にPOIを選択してください';
      setMenu(true);
      return false;
    }
    if(!active&& !enter(null,{collapse:false}))return false;
    activeTool=tool;
    setBodyToolClass(tool);
    hideAdjustControls();
    hotbar.querySelectorAll('.field-mode-creative-tool').forEach(button=>{
      button.classList.toggle('is-active',button.dataset.tool===tool);
    });
    if(tool==='poi'){
      hint.textContent='POI種類を選び、十字の位置で設置します。';
      if(collapse)setMenu(false);
    }else if(tool==='adjust'){
      hint.textContent='現在地へ合わせるか、十字で位置を微調整します。';
      try{if(typeof map!=='undefined'&&selectedPoi)map.panTo(selectedPoi.latlng);}catch(_){}
      if(collapse)setMenu(false);else showAdjustControls();
      if(modeStatusEl)modeStatusEl.textContent='位置調整';
    }
    invalidateMap();
    return true;
  }

  function lockPage(){
    savedScrollY=window.scrollY||document.documentElement.scrollTop||0;
    body.style.top=`-${savedScrollY}px`;
    body.classList.add('field-creative-active');
  }

  function unlockPage(){
    body.classList.remove('field-creative-active','field-creative-menu-open');
    setBodyToolClass(null);
    body.style.top='';
    window.scrollTo(0,savedScrollY);
  }

  function enter(tool=null,{collapse=false}={}){
    if(!canEnter()){
      if(modeStatusEl)modeStatusEl.textContent='先にKMZを読み込んでください';
      return false;
    }
    if(!active){
      active=true;
      lockPage();
    }
    if(tool){
      return selectTool(tool,{collapse});
    }
    activeTool=null;
    setBodyToolClass(null);
    hideAdjustControls();
    hotbar.querySelectorAll('.field-mode-creative-tool').forEach(button=>button.classList.remove('is-active'));
    setMenu(true);
    if(modeStatusEl)modeStatusEl.textContent='クリエイティブ';
    invalidateMap();
    return true;
  }

  function cancelTransientAdjustment(){
    let tuning=false;
    try{tuning=!!fineTuneMode;}catch(_){}
    if(tuning&&fineTuneButtonEl){
      fineTuneButtonEl.click();
    }
  }

  function exit({cancel=false}={}){
    if(!active)return;
    if(activeTool==='adjust')cancelTransientAdjustment();
    if(cancel)window.dispatchEvent(new CustomEvent('fieldcreativecancel'));
    active=false;
    activeTool=null;
    menuOpen=false;
    hotbar.classList.remove('is-open');
    hint.classList.remove('is-open');
    hotbar.style.display='';
    hotbar.style.zIndex='';
    hint.style.zIndex='';
    hideAdjustControls();
    unlockPage();
    normalizeSelectionCopy();
    invalidateMap();
  }

  launcher.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    refreshAvailability();
    if(menuOpen){
      setMenu(false);
      if(modeStatusEl)modeStatusEl.textContent='クリエイティブ';
      invalidateMap();
      return;
    }
    openPalette();
  });

  closeButton.addEventListener('click',()=>exit({cancel:true}));

  hotbar.addEventListener('click',event=>{
    const button=event.target.closest('[data-tool]');
    if(!button||button.disabled)return;
    if(button.dataset.tool==='poi'){
      selectTool('poi',{collapse:true});
      return;
    }
    selectTool(button.dataset.tool,{collapse:true});
  });

  relocateButtonEl?.addEventListener('click',()=>{
    setTimeout(()=>{
      if(activeTool==='adjust'){
        syncAdjustLabels();
        try{if(typeof map!=='undefined'&&selectedPoi&&!fineTuneMode)map.panTo(selectedPoi.latlng);}catch(_){}
      }
    },0);
  });

  fineTuneButtonEl?.addEventListener('click',()=>{
    setTimeout(()=>{if(activeTool==='adjust')syncAdjustLabels();},0);
  });

  fileInputEl?.addEventListener('change',()=>{
    launcher.disabled=true;
    setTimeout(refreshAvailability,0);
  });

  if(modeStatusEl){
    new MutationObserver(refreshAvailability).observe(modeStatusEl,{childList:true,subtree:true,characterData:true});
  }

  if(selectionDetailEl){
    new MutationObserver(()=>{
      normalizeSelectionCopy();
      refreshAvailability();
    }).observe(selectionDetailEl,{childList:true,subtree:true,characterData:true});
  }
  if(selectionTitleEl){
    new MutationObserver(refreshAvailability).observe(selectionTitleEl,{childList:true,subtree:true,characterData:true});
  }

  window.addEventListener('orientationchange',invalidateMap);
  window.addEventListener('resize',()=>{if(active)invalidateMap();});

  window.FieldCreative={
    enter,
    exit,
    selectTool,
    openMenu:openPalette,
    closeMenu:()=>setMenu(false),
    isActive:()=>active,
    activeTool:()=>activeTool,
    refreshAvailability
  };

  normalizeSelectionCopy();
  refreshAvailability();
})();
