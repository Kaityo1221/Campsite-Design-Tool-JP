(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const style=`<style id="cmV51AddCancelSpacingStyle">
      .cm-safe-add-bar{
        grid-template-columns:64px 40px 64px 42px!important;
        column-gap:6px!important;
        padding-right:7px!important;
      }
      .cm-safe-add-confirm{
        margin-right:8px!important;
      }
      .cm-safe-add-cancel{
        width:34px!important;
        height:34px!important;
        margin-left:8px!important;
        border:1px solid rgba(93,70,48,.18)!important;
        border-radius:50%!important;
        background:rgba(238,229,212,.58)!important;
        color:#5d4630!important;
        font-size:20px!important;
        font-weight:900!important;
        line-height:1!important;
        display:grid!important;
        place-items:center!important;
        padding:0!important;
      }
    </style>`;
    if(!src.includes('id="cmV51AddCancelSpacingStyle"'))src=src.replace('</head>',style+'</head>');
    return src;
  };
})();
