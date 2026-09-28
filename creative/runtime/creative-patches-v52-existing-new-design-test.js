(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const style=`<style id="cmV52ExistingNewDesignTestStyle">
      /* TEST ONLY: existing/new visual prototype. No state/save behavior yet. */
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
        position:relative;display:grid;grid-template-columns:1fr 1fr;height:48px;
        border:2px solid #78bff4;border-radius:14px;overflow:hidden;background:#fff;
        box-shadow:0 0 0 3px rgba(53,167,255,.06);isolation:isolate;
      }
      .cm-v52-mode-switch::after{
        content:"";position:absolute;left:50%;top:-8px;width:2px;height:64px;background:#fff;
        transform:rotate(38deg);transform-origin:center;z-index:3;pointer-events:none;
        box-shadow:0 0 0 1px rgba(255,255,255,.35);
      }
      .cm-v52-mode-option{
        position:relative;display:grid;place-items:center;border:0;padding:0 4px;
        font:950 14px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        pointer-events:none;user-select:none;
      }
      .cm-v52-mode-option.existing{background:linear-gradient(180deg,#35a7ff 0%,#168ee8 100%);color:#fff}
      .cm-v52-mode-option.new{background:linear-gradient(180deg,#fff1f5 0%,#ffe4ec 100%);color:#d92f67}
      .cm-v52-mode-icon{font-size:11px;margin-right:2px;vertical-align:1px}

      @media(max-width:390px){
        #cmCoordinateJumpPanel.cm-v52-design-test .cm-coordinate-row{grid-template-columns:minmax(0,1fr) 124px}
      }
    </style>`;
    if(!src.includes('id="cmV52ExistingNewDesignTestStyle"'))src=src.replace('</head>',style+'</head>');

    const runtime=`<script id="cmV52ExistingNewDesignTestRuntime">
(()=>{
  function decorate(){
    const panel=document.getElementById('cmCoordinateJumpPanel');
    if(!panel||panel.dataset.cmV52Design==='1')return;
    const row=panel.querySelector('.cm-coordinate-row');
    if(!row)return;
    panel.dataset.cmV52Design='1';
    panel.classList.add('cm-v52-design-test');

    const apply=panel.querySelector('#cmCoordinateApply');
    if(apply)apply.hidden=true;

    const toggle=document.createElement('div');
    toggle.className='cm-v52-mode-switch';
    toggle.setAttribute('aria-label','既存・新規 デザイン確認用');
    toggle.innerHTML='<div class="cm-v52-mode-option existing"><span><span class="cm-v52-mode-icon">◎</span>既存</span></div><div class="cm-v52-mode-option new"><span><span class="cm-v52-mode-icon">✦</span>新規</span></div>';
    row.appendChild(toggle);
  }

  decorate();
  new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});
})();
<\/script>`;
    if(!src.includes('id="cmV52ExistingNewDesignTestRuntime"'))src=src.replace('</body>',runtime+'</body>');
    return src;
  };
})();
