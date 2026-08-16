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
    const old=document.querySelector(`link[${attr}]`);
    if(old){
      if(old.getAttribute('href')!==href)old.setAttribute('href',href);
      return;
    }
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    link.setAttribute(attr,'1');
    document.head.appendChild(link);
  }
  ensureStyle('css/field-mode-map-first.css?v=1','data-field-map-first-style');
  ensureStyle('css/field-mode-entry.css?v=6','data-field-entry-style');
  ensureStyle('css/field-mode-entry-position.css?v=4','data-field-entry-position-style');
  ensureStyle('css/field-mode-entry-transition.css?v=1','data-field-entry-transition-style');

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
      <button id="fieldModeEntryStart" class="field-mode-entry-start" type="button" disabled>創作をはじめる</button>
      <label class="field-mode-entry-filebar" for="fieldModeFile">
        <span class="field-mode-entry-fileicon">▱</span>
        <span class="field-mode-entry-filelabel">ゲームスポット元データを選択</span>
        <span id="fieldModeEntryFileName" class="field-mode-entry-filename">未選択 ›</span>
        <span id="fieldModeEntryFileSlot" class="field-mode-entry-file-slot"></span>
      </label>
      <div id="fieldModeEntryFileState" class="field-mode-entry-file-state" aria-live="polite"></div>
      <div id="fieldModeEntryHint" class="field-mode-entry-hint">先に設計KMZを選択してください</div>
      <div id="fieldModeEntryResumeSlot" class="field-mode-entry-resume-slot"></div>
      <a class="field-mode-entry-main-link" href="index.html">メインツールへ</a>
    </div>
    <div class="field-mode-entry-transition" aria-hidden="true">CREATIVE MODE START</div>`;
  body.prepend(entry);

  const slot=entry.querySelector('#fieldModeEntryFileSlot');
  const resumeSlot=entry.querySelector('#fieldModeEntryResumeSlot');
  const state=entry.querySelector('#fieldModeEntryFileState');
  const startButton=entry.querySelector('#fieldModeEntryStart');
  const hint=entry.querySelector('#fieldModeEntryHint');
  const fileName=entry.querySelector('#fieldModeEntryFileName');
  slot.appendChild(fileInput);

  function adoptSessionUi(){
    const panel=document.getElementById('fieldModeResumePanel');
    const sessionStatus=document.getElementById('fieldModeSessionStatus');
    if(panel&&panel.parentElement!==resumeSlot)resumeSlot.appendChild(panel);
    if(sessionStatus&&sessionStatus.parentElement!==resumeSlot)resumeSlot.appendChild(sessionStatus);
    return !!panel;
  }

  function syncEntry(){
    const text=(fileStatus?.textContent||'').trim();
    const ready=loaded();
    const failed=/^⚠|失敗|エラー/.test(text)||/失敗|エラー/.test(modeStatus?.textContent||'');
    state.classList.toggle('is-error',failed);
    if(failed){
      state.textContent=text||'ファイルを読み込めませんでした。';
      fileName.textContent='読み込み失敗 ›';
      startButton.disabled=true;
      startButton.classList.remove('is-ready');
      hint.textContent='ファイルを確認して、もう一度選択してください';
      return;
    }
    state.textContent='';
    if(ready){
      fileName.textContent=`${currentName()} ✓`;
      startButton.disabled=false;
      startButton.classList.add('is-ready');
      hint.textContent='';
      return;
    }
    fileName.textContent='未選択 ›';
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
    if(newPoiButton)newPoiButton.style.display='';
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
    },1550);
  }

  startButton.addEventListener('click',()=>{if(loaded())enterCreativeMap();});
  fileInput.addEventListener('change',()=>{syncEntry();setTimeout(syncEntry,0);});
  if(fileStatus)new MutationObserver(syncEntry).observe(fileStatus,{childList:true,subtree:true,characterData:true});
  if(modeStatus)new MutationObserver(()=>{syncEntry();syncToolbox();}).observe(modeStatus,{childList:true,subtree:true,characterData:true});

  const toolboxTimer=setInterval(()=>{syncToolbox();if(document.getElementById('fieldModeCreativeButton'))clearInterval(toolboxTimer);},50);
  setTimeout(()=>clearInterval(toolboxTimer),5000);
  const sessionUiTimer=setInterval(()=>{if(adoptSessionUi())clearInterval(sessionUiTimer);},50);
  setTimeout(()=>clearInterval(sessionUiTimer),5000);
  window.addEventListener('resize',()=>{if(entry.hidden)invalidateMap();});
  window.addEventListener('orientationchange',()=>{if(entry.hidden)invalidateMap();});

  adoptSessionUi();
  syncEntry();
  syncToolbox();
})();