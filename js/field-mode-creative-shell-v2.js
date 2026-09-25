(() => {
  'use strict';

  const STYLE_ID='fieldCreativeShellV2Style';
  const CURRENT_ID='fieldCreativeCurrentFab';
  const FLASH_ID='fieldCreativeAddFlash';
  let flashTimer=0;
  let launcherBound=null;
  let holdTimer=0;
  let longPress=false;

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      /* CREATIVE MODE v2 shell: mock-aligned cockpit without changing map logic. */
      .field-mode-entry-started .field-mode-toolbar{
        grid-template-columns:1fr 1fr!important;
        gap:0!important;
        width:min(100%,760px)!important;
        padding:0 0 env(safe-area-inset-bottom)!important;
        background:rgba(255,255,255,.97)!important;
        border-top:1px solid rgba(34,48,64,.12)!important;
        box-shadow:0 -5px 18px rgba(28,42,58,.10)!important;
      }
      .field-mode-entry-started .field-mode-scan-button{display:none!important}
      .field-mode-entry-started .field-mode-history-button{
        height:56px!important;
        border-radius:0!important;
        background:transparent!important;
        color:#17202b!important;
        font-size:14px!important;
        font-weight:900!important;
        box-shadow:none!important;
      }
      .field-mode-entry-started #fieldModeUndoButton{
        border-right:1px solid rgba(34,48,64,.11)!important;
      }
      .field-mode-entry-started .field-mode-history-button:disabled{
        opacity:.34!important;
      }

      .field-mode-entry-started .field-mode-creative-launcher,
      .field-mode-entry-started.field-creative-active .field-mode-creative-launcher{
        position:fixed!important;
        left:auto!important;
        right:16px!important;
        top:auto!important;
        bottom:calc(76px + env(safe-area-inset-bottom))!important;
        width:62px!important;
        min-width:62px!important;
        height:62px!important;
        padding:0!important;
        display:grid!important;
        place-items:center!important;
        border:3px solid #fff!important;
        border-radius:50%!important;
        background:linear-gradient(180deg,#ff9a2e 0%,#ff7d12 100%)!important;
        color:#fff!important;
        box-shadow:0 7px 18px rgba(213,102,8,.32),0 2px 7px rgba(0,0,0,.18)!important;
        font-size:39px!important;
        font-weight:400!important;
        line-height:1!important;
        z-index:1320!important;
        -webkit-tap-highlight-color:transparent!important;
        transition:transform .16s ease,box-shadow .16s ease!important;
      }
      .field-mode-entry-started .field-mode-creative-launcher:active{
        transform:scale(.94)!important;
        box-shadow:0 4px 12px rgba(213,102,8,.26),0 1px 4px rgba(0,0,0,.15)!important;
      }
      .field-mode-entry-started .field-mode-creative-launcher:disabled{
        filter:grayscale(.45)!important;
        opacity:.48!important;
      }
      .field-mode-entry-started .field-mode-launcher-label{display:none!important}

      .field-creative-add-flash{
        position:fixed;
        right:19px;
        bottom:calc(60px + env(safe-area-inset-bottom));
        z-index:1330;
        min-width:56px;
        padding:4px 9px;
        border-radius:999px;
        background:rgba(255,255,255,.97);
        color:#454b53;
        box-shadow:0 3px 10px rgba(0,0,0,.14);
        font-size:11px;
        font-weight:900;
        text-align:center;
        pointer-events:none;
        opacity:0;
        transform:translateY(-5px) scale(.96);
      }
      .field-creative-add-flash.is-visible{
        animation:fieldCreativeAddFlash 1.05s ease both;
      }
      @keyframes fieldCreativeAddFlash{
        0%{opacity:0;transform:translateY(-7px) scale(.94)}
        18%{opacity:1;transform:translateY(0) scale(1)}
        72%{opacity:1;transform:translateY(0) scale(1)}
        100%{opacity:0;transform:translateY(4px) scale(.98)}
      }

      #${CURRENT_ID}{
        position:fixed;
        right:16px;
        top:calc(72px + env(safe-area-inset-top));
        z-index:1310;
        width:54px;
        min-width:54px;
        height:58px;
        display:none;
        place-items:center;
        gap:1px;
        padding:5px 3px 4px;
        border:1px solid rgba(30,50,70,.16);
        border-radius:14px;
        background:rgba(255,255,255,.96);
        color:#17202b;
        box-shadow:0 4px 13px rgba(22,41,60,.16);
        font:inherit;
        font-weight:900;
        -webkit-tap-highlight-color:transparent;
      }
      #${CURRENT_ID} .field-current-icon{font-size:23px;line-height:1}
      #${CURRENT_ID} small{font-size:9px;line-height:1.15;font-weight:900}
      .field-mode-entry-started #${CURRENT_ID}{display:grid}
      .field-mode-entry-started.field-creative-active .field-location-badge{display:none!important}

      .field-mode-entry-started.field-creative-active .field-mode-stage{
        bottom:calc(57px + env(safe-area-inset-bottom))!important;
      }
      .field-mode-entry-started.field-creative-active .field-mode-creative-close{
        left:12px!important;
        top:12px!important;
        transform:none!important;
        max-width:46px!important;
        min-width:42px!important;
        height:42px!important;
        padding:0!important;
        overflow:hidden!important;
        border:1px solid rgba(30,50,70,.14)!important;
        border-radius:12px!important;
        background:rgba(255,255,255,.96)!important;
        color:#17202b!important;
        box-shadow:0 3px 10px rgba(22,41,60,.12)!important;
        font-size:0!important;
      }
      .field-mode-entry-started.field-creative-active .field-mode-creative-close::before{
        content:'←';
        font-size:24px;
        font-weight:700;
      }

      @media(max-width:520px){
        .field-mode-entry-started .field-mode-creative-launcher,
        .field-mode-entry-started.field-creative-active .field-mode-creative-launcher{
          right:14px!important;
          width:60px!important;
          min-width:60px!important;
          height:60px!important;
          bottom:calc(74px + env(safe-area-inset-bottom))!important;
        }
        .field-creative-add-flash{right:16px}
        #${CURRENT_ID}{right:14px;top:calc(70px + env(safe-area-inset-top))}
      }
      @media(prefers-reduced-motion:reduce){
        .field-creative-add-flash.is-visible{animation:none;opacity:1}
      }
    `;
    document.head.appendChild(style);
  }

  function enforceHistoryLabels(){
    const undo=document.getElementById('fieldModeUndoButton');
    const redo=document.getElementById('fieldModeRedoButton');
    if(undo&&undo.textContent!=='← 戻る')undo.textContent='← 戻る';
    if(redo&&redo.textContent!=='↻ やり直し')redo.textContent='↻ やり直し';
    if(undo)undo.setAttribute('aria-label','戻る');
    if(redo)redo.setAttribute('aria-label','やり直し');
  }

  function ensureCurrentFab(){
    let button=document.getElementById(CURRENT_ID);
    if(button)return button;
    button=document.createElement('button');
    button.id=CURRENT_ID;
    button.type='button';
    button.setAttribute('aria-label','現在地へ移動');
    button.innerHTML='<span class="field-current-icon">◎</span><small>現在地</small>';
    button.addEventListener('click',()=>{
      const scan=document.getElementById('fieldModeScanButton');
      if(scan&&!scan.disabled){
        scan.click();
        return;
      }
      try{
        if(typeof currentPosition!=='undefined'&&currentPosition&&typeof map!=='undefined')map.panTo(currentPosition);
      }catch(_){}
    });
    document.body.appendChild(button);
    return button;
  }

  function ensureFlash(){
    let flash=document.getElementById(FLASH_ID);
    if(flash)return flash;
    flash=document.createElement('div');
    flash.id=FLASH_ID;
    flash.className='field-creative-add-flash';
    flash.textContent='追加';
    flash.setAttribute('aria-hidden','true');
    document.body.appendChild(flash);
    return flash;
  }

  function showAddFlash(text='追加'){
    const flash=ensureFlash();
    flash.textContent=text;
    flash.classList.remove('is-visible');
    void flash.offsetWidth;
    flash.classList.add('is-visible');
    clearTimeout(flashTimer);
    flashTimer=setTimeout(()=>flash.classList.remove('is-visible'),1150);
  }

  function startAdd(){
    showAddFlash('追加');
    const api=window.FieldCreative;
    if(api?.selectTool){
      api.selectTool('poi',{collapse:true});
      return;
    }
    const poi=document.querySelector('#fieldModeCreativeHotbar [data-tool="poi"]');
    if(poi&&!poi.disabled)poi.click();
  }

  function openLegacyTools(){
    showAddFlash('道具');
    if(window.FieldCreative?.openMenu)window.FieldCreative.openMenu();
  }

  function bindLauncher(){
    const launcher=document.getElementById('fieldModeCreativeButton');
    if(!launcher)return false;
    launcher.textContent='＋';
    launcher.setAttribute('aria-label','候補地を追加');
    launcher.title='候補地を追加';
    if(launcherBound===launcher)return true;
    launcherBound=launcher;

    launcher.addEventListener('pointerdown',()=>{
      longPress=false;
      clearTimeout(holdTimer);
      holdTimer=setTimeout(()=>{
        longPress=true;
        openLegacyTools();
      },650);
    },true);
    const clearHold=()=>clearTimeout(holdTimer);
    launcher.addEventListener('pointerup',clearHold,true);
    launcher.addEventListener('pointercancel',clearHold,true);
    launcher.addEventListener('pointerleave',clearHold,true);

    launcher.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if(launcher.disabled)return;
      if(longPress){longPress=false;return;}
      startAdd();
    },true);
    return true;
  }

  function sync(){
    injectStyle();
    enforceHistoryLabels();
    ensureCurrentFab();
    bindLauncher();
  }

  const timer=setInterval(sync,80);
  setTimeout(()=>clearInterval(timer),12000);
  sync();

  const observer=new MutationObserver(sync);
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','disabled']});
})();
