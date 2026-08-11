(() => {
  'use strict';

  const body=document.body;
  const stage=document.querySelector('.field-mode-stage');
  const modeStatusEl=document.getElementById('fieldModeStatus');
  const fileInputEl=document.getElementById('fieldModeFile');
  const newPoiButtonEl=document.getElementById('fieldModeNewPoiButton');
  if(!stage)return;

  let active=false;
  let menuOpen=false;
  let activeTool=null;
  let savedScrollY=0;

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

  function refreshAvailability(){
    launcher.disabled=!canEnter();
    launcher.title=launcher.disabled?'先にKMZ / KMLを読み込んでください':'クリエイティブ道具箱';
  }

  function invalidateMap(){
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      try{if(typeof map!=='undefined')map.invalidateSize();}catch(_){}
    }));
  }

  function setBodyToolClass(tool){
    ['poi','line','area','distance'].forEach(name=>body.classList.remove(`field-creative-tool-${name}`));
    if(tool)body.classList.add(`field-creative-tool-${tool}`);
  }

  function setMenu(open){
    menuOpen=!!open;
    body.classList.toggle('field-creative-menu-open',menuOpen);
    hotbar.classList.toggle('is-open',menuOpen);
    hint.classList.toggle('is-open',menuOpen);
    launcher.setAttribute('aria-expanded',String(menuOpen));
  }

  function selectTool(tool,{collapse=true}={}){
    if(!active)enter(tool,{collapse});
    activeTool=tool;
    setBodyToolClass(tool);
    hotbar.querySelectorAll('.field-mode-creative-tool').forEach(button=>{
      button.classList.toggle('is-active',button.dataset.tool===tool);
    });
    if(tool==='poi'){
      hint.textContent='POI種類を選び、「新規設置」で位置を決めます。';
      if(collapse)setMenu(false);
    }
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
      selectTool(tool,{collapse});
    }else{
      activeTool=null;
      setBodyToolClass(null);
      hotbar.querySelectorAll('.field-mode-creative-tool').forEach(button=>button.classList.remove('is-active'));
      setMenu(true);
    }
    if(modeStatusEl&&!tool)modeStatusEl.textContent='クリエイティブ';
    invalidateMap();
    return true;
  }

  function exit({cancel=false}={}){
    if(!active)return;
    if(cancel)window.dispatchEvent(new CustomEvent('fieldcreativecancel'));
    active=false;
    activeTool=null;
    menuOpen=false;
    hotbar.classList.remove('is-open');
    hint.classList.remove('is-open');
    unlockPage();
    invalidateMap();
  }

  launcher.addEventListener('click',()=>{
    if(!active){enter();return;}
    setMenu(!menuOpen);
  });

  closeButton.addEventListener('click',()=>exit({cancel:true}));

  hotbar.addEventListener('click',event=>{
    const button=event.target.closest('[data-tool]');
    if(!button||button.disabled)return;
    selectTool(button.dataset.tool,{collapse:true});
  });

  fileInputEl?.addEventListener('change',()=>{
    launcher.disabled=true;
    setTimeout(refreshAvailability,0);
  });

  if(modeStatusEl){
    new MutationObserver(refreshAvailability).observe(modeStatusEl,{childList:true,subtree:true,characterData:true});
  }

  window.addEventListener('orientationchange',invalidateMap);
  window.addEventListener('resize',()=>{if(active)invalidateMap();});

  window.FieldCreative={
    enter,
    exit,
    selectTool,
    openMenu:()=>{if(active)setMenu(true);else enter();},
    closeMenu:()=>setMenu(false),
    isActive:()=>active,
    activeTool:()=>activeTool
  };

  refreshAvailability();
})();