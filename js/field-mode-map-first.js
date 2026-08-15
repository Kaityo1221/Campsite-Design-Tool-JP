(() => {
  'use strict';

  const body=document.body;
  const intro=document.querySelector('.field-mode-intro');
  const fileInput=document.getElementById('fieldModeFile');
  const fileStatus=document.getElementById('fieldModeFileStatus');
  const modeStatus=document.getElementById('fieldModeStatus');
  const undoButton=document.getElementById('fieldModeUndoButton');
  const redoButton=document.getElementById('fieldModeRedoButton');
  const scanButton=document.getElementById('fieldModeScanButton');
  const locationBadge=document.getElementById('fieldModeLocationBadge');
  const newPoiButton=document.getElementById('fieldModeNewPoiButton');
  if(!body||!intro||!fileInput)return;

  function ensureStyle(href,attr){
    if(document.querySelector(`link[${attr}]`))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    link.setAttribute(attr,'1');
    document.head.appendChild(link);
  }
  ensureStyle('css/field-mode-map-first.css?v=1','data-field-map-first-style');
  ensureStyle('css/field-mode-entry.css?v=1','data-field-entry-style');

  function loaded(){
    try{return typeof fileLoaded!=='undefined'&&!!fileLoaded;}catch(_){return /件を読み込み|読み込み完了|読込済|復元/.test(fileStatus?.textContent||'');}
  }
  function currentName(){
    const picked=fileInput.files?.[0]?.name;
    if(picked)return picked;
    try{if(typeof sourceFileName!=='undefined'&&sourceFileName)return sourceFileName;}catch(_){}
    return '現地データ';
  }
  function invalidateMap(){requestAnimationFrame(()=>requestAnimationFrame(()=>{try{if(typeof map!=='undefined')map.invalidateSize();}catch(_){}}));}

  const entry=document.createElement('section');
  entry.id='fieldModeEntry';
  entry.className='field-mode-entry-shell';
  entry.setAttribute('aria-label','CREATIVE MODE 開始画面');
  entry.innerHTML=`
    <div class="field-mode-entry-inner">
      <div class="field-mode-entry-kicker">CREATIVE MODE</div>
      <p class="field-mode-entry-copy">新しい世界の幕開けへ。</p>
      <div class="field-mode-entry-card">
        <label class="field-mode-entry-file-label">設計KMZ／KMLを選択<div id="fieldModeEntryFileSlot"></div></label>
        <div id="fieldModeEntryFileState" class="field-mode-entry-file-state">KMZ / KML / ZIP を選択してください。</div>
        <button id="fieldModeEntryStart" class="field-mode-entry-start" type="button" disabled>創作をはじめる</button>
        <div id="fieldModeEntryHint" class="field-mode-entry-hint">先に設計KMZを選択してください</div>
      </div>
      <a class="field-mode-entry-main-link" href="index.html">メインツールへ</a>
    </div>
    <div class="field-mode-entry-transition" aria-hidden="true">CREATIVE MODE START</div>`;
  body.prepend(entry);

  const slot=entry.querySelector('#fieldModeEntryFileSlot');
  const state=entry.querySelector('#fieldModeEntryFileState');
  const startButton=entry.querySelector('#fieldModeEntryStart');
  const hint=entry.querySelector('#fieldModeEntryHint');
  slot.appendChild(fileInput);

  function syncEntry(){
    const text=(fileStatus?.textContent||'').trim();
    const ready=loaded();
    const failed=/^⚠|失敗|エラー/.test(text)||/失敗|エラー/.test(modeStatus?.textContent||'');
    state.classList.toggle('is-ready',ready&&!failed);
    state.classList.toggle('is-error',failed);
    if(failed){
      state.textContent=text||'ファイルを読み込めませんでした。';
      startButton.disabled=true;
      startButton.classList.remove('is-ready');
      hint.textContent='ファイルを確認して、もう一度選択してください';
      return;
    }
    if(ready){
      const name=currentName();
      state.textContent=`✓ 読み込み完了：${name}`;
      startButton.disabled=false;
      startButton.classList.add('is-ready');
      hint.textContent='準備完了。創作を始められます';
      return;
    }
    state.textContent=text&&text!=='KMZ / KML / ZIP を選択してください。'?text:'KMZ / KML / ZIP を選択してください。';
    startButton.disabled=true;
    startButton.classList.remove('is-ready');
    hint.textContent='先に設計KMZを選択してください';
  }

  function syncToolbox(){
    const launcher=document.getElementById('fieldModeCreativeButton');
    if(launcher){launcher.innerHTML='🧰<span class="field-mode-launcher-label">道具</span>';launcher.setAttribute('aria-label','道具');launcher.title=launcher.disabled?'先にKMZ / KMLを読み込んでください':'道具';}
    const lineTool=document.querySelector('#fieldModeCreativeHotbar [data-tool="line"]');
    if(lineTool)lineTool.style.display='none';
  }

  function polishMapUi(){
    body.classList.add('field-mode-entry-started');
    if(undoButton){undoButton.textContent='↶ 元に戻す';undoButton.setAttribute('aria-label','元に戻す');}
    if(redoButton){redoButton.textContent='やり直す ↷';redoButton.setAttribute('aria-label','やり直す');}
    if(newPoiButton)newPoiButton.style.display='none';
    if(locationBadge&&!locationBadge.dataset.recenterBound){
      locationBadge.dataset.recenterBound='1';
      locationBadge.setAttribute('role','button');
      locationBadge.setAttribute('tabindex','0');
      locationBadge.setAttribute('aria-label','現在地を再取得して地図を現在地へ戻す');
      const recenter=()=>{if(scanButton&&!scanButton.disabled)scanButton.click();};
      locationBadge.addEventListener('click',recenter);
      locationBadge.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();recenter();}});
    }
    syncToolbox();
  }

  function enterCreativeMap(){
    polishMapUi();
    entry.classList.add('is-starting');
    startButton.disabled=true;
    window.setTimeout(()=>{
      entry.hidden=true;
      entry.classList.remove('is-starting');
      if(window.FieldCreative){
        window.FieldCreative.enter();
        window.FieldCreative.closeMenu();
      }
      invalidateMap();
      window.setTimeout(invalidateMap,120);
    },620);
  }

  startButton.addEventListener('click',()=>{if(loaded())enterCreativeMap();});
  fileInput.addEventListener('change',()=>{syncEntry();setTimeout(syncEntry,0);});
  if(fileStatus)new MutationObserver(syncEntry).observe(fileStatus,{childList:true,subtree:true,characterData:true});
  if(modeStatus)new MutationObserver(()=>{syncEntry();syncToolbox();}).observe(modeStatus,{childList:true,subtree:true,characterData:true});

  const toolboxTimer=setInterval(()=>{syncToolbox();if(document.getElementById('fieldModeCreativeButton'))clearInterval(toolboxTimer);},50);
  setTimeout(()=>clearInterval(toolboxTimer),5000);
  window.addEventListener('resize',()=>{if(entry.hidden)invalidateMap();});
  window.addEventListener('orientationchange',()=>{if(entry.hidden)invalidateMap();});

  syncEntry();
  syncToolbox();
})();
