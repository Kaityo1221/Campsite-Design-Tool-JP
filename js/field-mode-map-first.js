(() => {
  'use strict';

  const body=document.body;
  const intro=document.querySelector('.field-mode-intro');
  const fileInput=document.getElementById('fieldModeFile');
  const fileStatus=document.getElementById('fieldModeFileStatus');
  const modeStatus=document.getElementById('fieldModeStatus');
  if(!body||!intro||!fileInput)return;

  if(!document.querySelector('link[data-field-map-first-style]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='css/field-mode-map-first.css?v=1';
    link.setAttribute('data-field-map-first-style','1');
    document.head.appendChild(link);
  }

  const sourceBar=document.createElement('div');
  sourceBar.className='field-mode-source-bar';
  sourceBar.innerHTML=`<div class="field-mode-source-summary"><span>📄</span><strong id="fieldModeSourceName">現地データ</strong></div><button id="fieldModeSourceToggle" class="field-mode-source-toggle" type="button">変更</button>`;
  intro.prepend(sourceBar);

  const sourceName=sourceBar.querySelector('#fieldModeSourceName');
  const sourceToggle=sourceBar.querySelector('#fieldModeSourceToggle');

  function loaded(){
    try{return typeof fileLoaded!=='undefined'&&!!fileLoaded;}catch(_){return /件を読み込み|読み込み完了|復元/.test(fileStatus?.textContent||'');}
  }

  function currentName(){
    const picked=fileInput.files?.[0]?.name;
    if(picked)return picked;
    try{if(typeof sourceFileName!=='undefined'&&sourceFileName)return sourceFileName;}catch(_){}
    return '現地データ';
  }

  function invalidateMap(){requestAnimationFrame(()=>requestAnimationFrame(()=>{try{if(typeof map!=='undefined')map.invalidateSize();}catch(_){}}));}

  function syncReady(){
    const ready=loaded();
    body.classList.toggle('field-mode-ready',ready);
    if(ready){sourceName.textContent=currentName();sourceName.title=currentName();}
    else body.classList.remove('field-mode-source-open');
    invalidateMap();
  }

  function syncToolbox(){
    const launcher=document.getElementById('fieldModeCreativeButton');
    if(launcher){launcher.innerHTML='🧰<span class="field-mode-launcher-label">道具</span>';launcher.setAttribute('aria-label','道具');launcher.title=launcher.disabled?'先にKMZ / KMLを読み込んでください':'道具';}
    const lineTool=document.querySelector('#fieldModeCreativeHotbar [data-tool="line"]');
    if(lineTool)lineTool.style.display='none';
  }

  sourceToggle.addEventListener('click',()=>{
    const open=!body.classList.contains('field-mode-source-open');
    body.classList.toggle('field-mode-source-open',open);
    sourceToggle.textContent=open?'閉じる':'変更';
    invalidateMap();
  });

  fileInput.addEventListener('change',()=>{body.classList.remove('field-mode-source-open');sourceToggle.textContent='変更';setTimeout(()=>{syncReady();syncToolbox();},0);});
  if(fileStatus)new MutationObserver(syncReady).observe(fileStatus,{childList:true,subtree:true,characterData:true});
  if(modeStatus)new MutationObserver(()=>{syncReady();syncToolbox();}).observe(modeStatus,{childList:true,subtree:true,characterData:true});

  const toolboxTimer=setInterval(()=>{syncToolbox();if(document.getElementById('fieldModeCreativeButton'))clearInterval(toolboxTimer);},50);
  setTimeout(()=>clearInterval(toolboxTimer),5000);
  window.addEventListener('resize',()=>{if(body.classList.contains('field-mode-ready'))invalidateMap();});
  window.addEventListener('orientationchange',invalidateMap);

  syncReady();
  syncToolbox();
})();
