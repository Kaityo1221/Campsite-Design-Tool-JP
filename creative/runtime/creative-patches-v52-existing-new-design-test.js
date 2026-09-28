(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const style=`<style id="cmV52ExistingNewDesignTestStyle">
      /* TEST ONLY: merged coordinate panel + independent existing/new state. */
      #cmCoordinateJumpPanel.cm-v52-design-test{
        width:min(360px,calc(100vw - 28px));
        padding:14px;
        border:1px solid rgba(93,70,48,.18);
        border-radius:20px;
        overflow:hidden;
        transition:border-color .18s ease,box-shadow .18s ease;
        bottom:calc(96px + env(safe-area-inset-bottom))!important;
      }
      #cmCoordinateJumpPanel.cm-v52-design-test .cm-coordinate-head{margin-bottom:8px}
      #cmCoordinateJumpPanel.cm-v52-design-test .cm-coordinate-head strong{font-size:16px;letter-spacing:.01em}
      #cmCoordinateJumpPanel.cm-v52-design-test .cm-coordinate-hint{margin-bottom:12px;font-size:11.5px;line-height:1.55}
      #cmCoordinateJumpPanel.cm-v52-design-test .cm-coordinate-row{
        display:grid;grid-template-columns:minmax(0,1fr) 132px;gap:9px;align-items:stretch;
      }
      #cmCoordinateJumpPanel.cm-v52-design-test #cmCoordinateInput{
        height:48px;border:2px solid #73baf2;border-radius:13px;background:#fff;
        box-shadow:0 0 0 3px rgba(53,167,255,.08);font-size:14px;
      }
      #cmCoordinateJumpPanel.cm-v52-design-test #cmCoordinateApply{display:none!important}

      .cm-v52-mode-switch{
        position:relative;height:48px;
        border:2px solid #78bff4;border-radius:14px;overflow:hidden;background:#fff;
        box-shadow:0 0 0 3px rgba(53,167,255,.06);isolation:isolate;
      }
      .cm-v52-mode-option{
        position:absolute;inset:0;border:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent;
        font:950 14px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        user-select:none;transition:filter .16s ease,opacity .16s ease,transform .16s ease;
      }
      .cm-v52-mode-option span{position:absolute;top:50%;transform:translateY(-50%);white-space:nowrap;pointer-events:none}
      .cm-v52-mode-option.existing{
        z-index:1;background:linear-gradient(180deg,#35a7ff 0%,#168ee8 100%);color:#fff;
        clip-path:polygon(0 0,60% 0,42% 100%,0 100%);
      }
      .cm-v52-mode-option.existing span{left:13%}
      .cm-v52-mode-option.new{
        z-index:2;background:linear-gradient(180deg,#fff1f5 0%,#ffe4ec 100%);color:#d92f67;
        clip-path:polygon(60% 0,100% 0,100% 100%,42% 100%);
      }
      .cm-v52-mode-option.new span{right:11%}
      .cm-v52-mode-option.new::before{
        content:"";position:absolute;left:50.5%;top:-8px;width:2px;height:66px;background:rgba(255,255,255,.96);
        transform:rotate(27deg);transform-origin:center;pointer-events:none;
      }
      .cm-v52-mode-icon{font-size:11px;margin-right:2px;vertical-align:1px}
      .cm-v52-mode-switch[data-mode="existing"] .cm-v52-mode-option.existing{filter:saturate(1.08) brightness(1);opacity:1}
      .cm-v52-mode-switch[data-mode="existing"] .cm-v52-mode-option.new{filter:saturate(.55) brightness(1.06);opacity:.72}
      .cm-v52-mode-switch[data-mode="new"] .cm-v52-mode-option.existing{filter:saturate(.55) brightness(1.14);opacity:.62}
      .cm-v52-mode-switch[data-mode="new"] .cm-v52-mode-option.new{filter:saturate(1.08) brightness(.99);opacity:1}
      .cm-v52-mode-switch[data-mode="existing"]{border-color:#4bacef;box-shadow:0 0 0 3px rgba(53,167,255,.10)}
      .cm-v52-mode-switch[data-mode="new"]{border-color:#f29ab7;box-shadow:0 0 0 3px rgba(230,56,112,.08)}
      .cm-v52-mode-option:active{transform:scale(.985)}

      .cm-v52-confirm-row{display:flex;justify-content:flex-end;margin-top:13px}
      .cm-v52-confirm{
        min-width:108px;height:44px;padding:0 22px;border:1px solid #176fe0;border-radius:999px;
        background:linear-gradient(180deg,#3888ff 0%,#2471ee 100%);color:#fff;
        box-shadow:0 5px 14px rgba(36,113,238,.24);font-size:14px;font-weight:950;
        -webkit-tap-highlight-color:transparent;touch-action:manipulation;
      }
      .cm-v52-confirm:active{transform:scale(.97)}

      /* When the coordinate panel is open, it replaces the separate bottom dock visually. */
      html.cm-v52-panel-open .cm-safe-add-bar{
        opacity:0!important;pointer-events:none!important;transform:translateX(-50%) translateY(16px)!important;
        transition:opacity .12s ease,transform .12s ease;
      }

      @media(max-width:390px){
        #cmCoordinateJumpPanel.cm-v52-design-test .cm-coordinate-row{grid-template-columns:minmax(0,1fr) 124px}
        .cm-v52-mode-option.existing span{left:11%}
        .cm-v52-mode-option.new span{right:9%}
        .cm-v52-confirm{min-width:104px;height:42px}
      }
    </style>`;
    if(!src.includes('id="cmV52ExistingNewDesignTestStyle"'))src=src.replace('</head>',style+'</head>');

    const runtime=`<script id="cmV52ExistingNewDesignTestRuntime">
(()=>{
  // Phase 2/3 TEST STATE
  // sourceType is deliberately independent from PokéStop / Gym / PowerSpot type.
  const placementState={sourceType:'existing'};
  let panelObserver=null;

  function normalizeSourceType(value){return value==='new'?'new':'existing'}
  function emitSourceChange(){
    try{
      window.dispatchEvent(new CustomEvent('campsite:placement-source-change',{detail:{sourceType:placementState.sourceType}}));
    }catch{}
  }
  function syncVisibleToggle(){
    const toggle=document.querySelector('.cm-v52-mode-switch');
    if(!toggle)return;
    toggle.dataset.mode=placementState.sourceType;
    toggle.setAttribute('aria-label',placementState.sourceType==='existing'?'既存を選択中':'新規を選択中');
    toggle.querySelector('.existing')?.setAttribute('aria-pressed',String(placementState.sourceType==='existing'));
    toggle.querySelector('.new')?.setAttribute('aria-pressed',String(placementState.sourceType==='new'));
    const panel=document.getElementById('cmCoordinateJumpPanel');
    if(panel)panel.dataset.placementSource=placementState.sourceType;
  }
  function setSourceType(value){
    const next=normalizeSourceType(value);
    if(placementState.sourceType===next){syncVisibleToggle();return next}
    placementState.sourceType=next;
    syncVisibleToggle();
    emitSourceChange();
    return next;
  }

  function parseCoordinate(raw){
    const normalized=String(raw||'').trim().replace(/，/g,',');
    if(!normalized)return null;
    let parts=normalized.split(',').map(v=>v.trim()).filter(Boolean);
    if(parts.length!==2)parts=normalized.split(/\\s+/).map(v=>v.trim()).filter(Boolean);
    if(parts.length!==2)return false;
    const lat=Number(parts[0]),lng=Number(parts[1]);
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)return false;
    return [lat,lng];
  }

  function syncPanelOpenState(panel){
    const open=!!panel&&!panel.hidden;
    document.documentElement.classList.toggle('cm-v52-panel-open',open);
  }

  function integratedConfirm(){
    const panel=document.getElementById('cmCoordinateJumpPanel');
    const input=panel?.querySelector('#cmCoordinateInput');
    const error=panel?.querySelector('.cm-coordinate-error');
    const parsed=parseCoordinate(input?.value);
    if(parsed===false){if(error)error.textContent='「緯度, 経度」の形式で入力してください';return}
    if(error)error.textContent='';

    if(Array.isArray(parsed)){
      const api=window.CampsiteCreativeCoordinateJump;
      if(!api||typeof api.moveTo!=='function'){
        if(error)error.textContent='地図との接続を準備できませんでした';
        return;
      }
      try{api.moveTo(parsed[0],parsed[1])}catch(err){console.error('[Creative v52] coordinate move',err);return}
    }

    const original=document.getElementById('cmSafeAddConfirm');
    if(original){
      input?.blur?.();
      setTimeout(()=>original.click(),Array.isArray(parsed)?70:0);
    }
  }

  // Test API only. Save/POI type wiring comes in later phases.
  window.CampsiteCreativePlacementState=Object.freeze({
    get sourceType(){return placementState.sourceType},
    setSourceType
  });

  function decorate(){
    const panel=document.getElementById('cmCoordinateJumpPanel');
    if(!panel){document.documentElement.classList.remove('cm-v52-panel-open');return}
    const row=panel.querySelector('.cm-coordinate-row');
    if(!row)return;

    if(panel.dataset.cmV52Design!=='1'){
      panel.dataset.cmV52Design='1';
      panel.classList.add('cm-v52-design-test');

      const apply=panel.querySelector('#cmCoordinateApply');
      if(apply)apply.hidden=true;

      const toggle=document.createElement('div');
      toggle.className='cm-v52-mode-switch';
      toggle.innerHTML='<button type="button" class="cm-v52-mode-option existing" aria-pressed="true"><span><span class="cm-v52-mode-icon">◎</span>既存</span></button><button type="button" class="cm-v52-mode-option new" aria-pressed="false"><span><span class="cm-v52-mode-icon">✦</span>新規</span></button>';
      toggle.querySelector('.existing').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setSourceType('existing')});
      toggle.querySelector('.new').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setSourceType('new')});
      row.appendChild(toggle);

      const confirmRow=document.createElement('div');
      confirmRow.className='cm-v52-confirm-row';
      confirmRow.innerHTML='<button type="button" class="cm-v52-confirm">確定</button>';
      confirmRow.querySelector('.cm-v52-confirm').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();integratedConfirm()});
      row.insertAdjacentElement('afterend',confirmRow);

      panelObserver?.disconnect?.();
      panelObserver=new MutationObserver(()=>syncPanelOpenState(panel));
      panelObserver.observe(panel,{attributes:true,attributeFilter:['hidden','style','class']});
    }

    syncVisibleToggle();
    syncPanelOpenState(panel);
  }

  decorate();
  new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});
})();
<\/script>`;
    if(!src.includes('id="cmV52ExistingNewDesignTestRuntime"'))src=src.replace('</body>',runtime+'</body>');
    return src;
  };
})();
