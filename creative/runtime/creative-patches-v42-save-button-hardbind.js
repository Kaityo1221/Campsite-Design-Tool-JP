(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const uiMarker='function cmInstallUi(){';
    if(src.includes(uiMarker)&&!src.includes('function cmHardBindSaveButton(){')){
      const helper=`function cmHardBindSaveButton(){
  const old=document.getElementById('save');
  if(!old||old.dataset.cmHardSave==='42')return;

  const b=old.cloneNode(true);
  b.dataset.cmHardSave='42';
  b.style.pointerEvents='auto';
  b.style.touchAction='manipulation';
  b.style.zIndex='3000';
  old.replaceWith(b);

  let firedAt=0;
  const fire=e=>{
    const now=Date.now();
    if(now-firedAt<650){
      try{e.preventDefault()}catch{}
      try{e.stopPropagation()}catch{}
      return;
    }
    firedAt=now;
    try{e.preventDefault()}catch{}
    try{e.stopPropagation()}catch{}
    try{e.stopImmediatePropagation()}catch{}
    cmOpenSaveMenu();
  };

  b.addEventListener('touchstart',fire,{capture:true,passive:false});
  b.addEventListener('pointerdown',e=>{if(!e.pointerType||e.pointerType==='touch'||e.pointerType==='pen')fire(e)},true);
  b.addEventListener('click',fire,true);
}
`;
      src=src.replace(uiMarker,helper+uiMarker.replace('{','{cmHardBindSaveButton();'));
    }

    const style=`<style id="cmV42HardSaveStyle">
      #save{pointer-events:auto!important;touch-action:manipulation!important;z-index:3000!important;-webkit-user-select:none!important;user-select:none!important}
    </style>`;
    if(!src.includes('id="cmV42HardSaveStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
