(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const style=`<style id="cmV52ExistingNewDesignTestStyle">
      /* TEST ONLY: visual + independent existing/new placement state. No save behavior yet. */
      #cmCoordinateJumpPanel.cm-v52-design-test{
        width:min(360px,calc(100vw - 28px));
        padding:14px;
        border:1px solid rgba(93,70,48,.18);
        border-radius:20px;
        overflow:hidden;
        transition:border-color .18s ease,box-shadow .18s ease;
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

      @media(max-width:390px){
        #cmCoordinateJumpPanel.cm-v52-design-test .cm-coordinate-row{grid-template-columns:minmax(0,1fr) 124px}
        .cm-v52-mode-option.existing span{left:11%}
        .cm-v52-mode-option.new span{right:9%}
      }
    </style>`;
    if(!src.includes('id="cmV52ExistingNewDesignTestStyle"'))src=src.replace('</head>',style+'</head>');

    const runtime=`<script id="cmV52ExistingNewDesignTestRuntime">
(()=>{
  // Phase 2/3 TEST STATE
  // sourceType is deliberately independent from PokéStop / Gym / PowerSpot type.
  const placementState={sourceType:'existing'};

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

  // Test API only. Save/POI type wiring comes in later phases.
  window.CampsiteCreativePlacementState=Object.freeze({
    get sourceType(){return placementState.sourceType},
    setSourceType
  });

  function decorate(){
    const panel=document.getElementById('cmCoordinateJumpPanel');
    if(!panel)return;
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
    }

    syncVisibleToggle();
  }

  decorate();
  new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});
})();
<\/script>`;
    if(!src.includes('id="cmV52ExistingNewDesignTestRuntime"'))src=src.replace('</body>',runtime+'</body>');
    return src;
  };
})();
