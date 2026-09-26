(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const style=`<style id="cmV47FieldFeedbackFollowupStyle">
      /* ＋が移動できる分、道具箱は右下へ寄せる */
      .toolbox{bottom:calc(82px + env(safe-area-inset-bottom))!important}
      .toolmenu{bottom:calc(142px + env(safe-area-inset-bottom))!important}

      /* 保存メニュー自体は従来位置へ戻し、文字だけ中央寄せ */
      #cmStandaloneSaveMenu{
        left:10px!important;right:auto!important;transform:none!important;
        width:min(260px,calc(100vw - 20px))!important;padding:8px!important;gap:7px!important
      }
      .left-hand #cmStandaloneSaveMenu{left:auto!important;right:10px!important;transform:none!important}
      #cmStandaloneSaveMenu button{text-align:center!important;padding:0 14px!important}

      /* 座標一覧では保存ボタンを下へ退避。閉じれば元位置へ戻る */
      #cmStandaloneSaveButton{transition:transform .2s ease!important}
      body:has(.cm-coords) #cmStandaloneSaveButton{transform:translateY(92px)!important}
      .cm-coords>div:last-child{padding-bottom:24px!important}
    </style>`;
    if(!src.includes('id="cmV47FieldFeedbackFollowupStyle"'))src=src.replace('</head>',style+'</head>');

    const runtime=`<script id="cmV47FieldFeedbackFollowupRuntime">
(()=>{
  /* ＋をもう一度押して追加メニューを閉じる時は「追加」を出さない */
  let cmV47FabWasOpen=false;
  const rememberFabState=e=>{
    const t=e.target&&e.target.closest?e.target.closest('#cmAddFab'):null;
    if(!t)return;
    try{cmV47FabWasOpen=typeof cmAddMenuOpen!=='undefined'&&!!cmAddMenuOpen}catch(_){cmV47FabWasOpen=false}
  };
  const suppressCloseHint=e=>{
    const t=e.target&&e.target.closest?e.target.closest('#cmAddFab'):null;
    if(!t)return;
    if(!cmV47FabWasOpen)return;
    setTimeout(()=>{
      const hint=document.getElementById('cmV45AddFlash');
      if(hint)hint.classList.remove('show');
    },0);
  };
  document.addEventListener('pointerdown',rememberFabState,true);
  document.addEventListener('touchstart',rememberFabState,{capture:true,passive:true});
  document.addEventListener('click',suppressCloseHint,true);
})();
</script>`;
    if(!src.includes('id="cmV47FieldFeedbackFollowupRuntime"'))src=src.replace('</body>',runtime+'</body>');

    return src;
  };
})();
