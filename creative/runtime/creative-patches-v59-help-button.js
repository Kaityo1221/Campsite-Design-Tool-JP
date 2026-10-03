(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const style=`<style id="cmV59HelpButtonStyle">
      #cmV59HelpButton{
        position:fixed;
        left:10px;
        bottom:calc(132px + env(safe-area-inset-bottom));
        z-index:6000;
        width:52px;
        height:52px;
        padding:0;
        border:1px solid var(--edge);
        border-radius:14px;
        background:#fffdf7;
        color:#382d1d;
        font-size:24px;
        font-weight:950;
        line-height:1;
        box-shadow:0 4px 14px rgba(0,0,0,.18);
        pointer-events:auto!important;
        touch-action:manipulation!important;
        -webkit-user-select:none;
        user-select:none;
      }
      .left-hand #cmV59HelpButton{left:auto;right:10px}
      body.cm-placement-docked #cmV59HelpButton{display:none!important}
      body:has(.cm-sheet) #cmV59HelpButton{display:none!important}
      body:has(#cmStandaloneSaveMenu) #cmV59HelpButton{display:none!important}
    </style>`;
    if(!src.includes('id="cmV59HelpButtonStyle"'))src=src.replace('</head>',style+'</head>');

    const runtime=`<script id="cmV59HelpButtonRuntime">
(()=>{
  if(document.getElementById('cmV59HelpButton'))return;
  const b=document.createElement('button');
  b.id='cmV59HelpButton';
  b.type='button';
  b.textContent='?';
  b.setAttribute('aria-label','設計ルール');
  b.title='設計ルール';
  document.body.appendChild(b);
})();
</script>`;
    if(!src.includes('id="cmV59HelpButtonRuntime"'))src=src.replace('</body>',runtime+'</body>');

    return src;
  };
})();
