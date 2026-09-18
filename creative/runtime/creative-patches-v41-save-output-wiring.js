(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // iPhone Safari: make the floppy/save entry and its menu actions deterministic.
    // Capture the visible controls before Leaflet/legacy onclick handlers can swallow the tap.
    const uiMarker='function cmInstallUi(){';
    if(src.includes(uiMarker)&&!src.includes('function cmInstallSaveOutputWiring(){')){
      const helper=`let cmSaveActionLastKey='',cmSaveActionLastAt=0,cmSaveExportBusy=false;
function cmSaveActionOnce(key){
  const now=Date.now();
  if(key===cmSaveActionLastKey&&now-cmSaveActionLastAt<550)return false;
  cmSaveActionLastKey=key;cmSaveActionLastAt=now;return true;
}
function cmStopSaveEvent(e){
  try{e.preventDefault()}catch{}
  try{e.stopPropagation()}catch{}
  try{e.stopImmediatePropagation()}catch{}
}
async function cmRunKmzExport(){
  if(cmSaveExportBusy)return;
  cmSaveExportBusy=true;
  try{
    cmCloseSaveMenu();
    await exportKmz();
    cmShowReturn();
  }catch(err){
    console.error('CREATIVE MODE KMZ export failed',err);
    msg('KMZ出力に失敗しました。もう一度お試しください',2200);
  }finally{
    cmSaveExportBusy=false;
  }
}
function cmInstallSaveOutputWiring(){
  if(document.documentElement.dataset.cmSaveOutputWiring==='41')return;
  document.documentElement.dataset.cmSaveOutputWiring='41';

  const run=e=>{
    const target=e.target;
    if(!target?.closest)return false;

    const saveButton=target.closest('#save');
    if(saveButton){
      cmStopSaveEvent(e);
      if(!cmSaveActionOnce('save'))return true;
      cmOpenSaveMenu();
      return true;
    }

    const kmzButton=target.closest('#cmKmz');
    if(kmzButton){
      cmStopSaveEvent(e);
      if(!cmSaveActionOnce('kmz'))return true;
      cmRunKmzExport();
      return true;
    }

    const coordsButton=target.closest('#cmCoords');
    if(coordsButton){
      cmStopSaveEvent(e);
      if(!cmSaveActionOnce('coords'))return true;
      cmOpenCoords();
      return true;
    }
    return false;
  };

  document.addEventListener('pointerup',e=>{
    if(e.pointerType&&e.pointerType!=='touch'&&e.pointerType!=='pen')return;
    run(e);
  },true);
  document.addEventListener('touchend',e=>run(e),{capture:true,passive:false});
  document.addEventListener('click',e=>run(e),true);
}
`;
      src=src.replace(uiMarker,helper+uiMarker.replace('{','{cmInstallSaveOutputWiring();'));
    }

    const style=`<style id="cmV41SaveOutputStyle">
      #save{pointer-events:auto!important;z-index:1550!important;touch-action:manipulation!important}
      .cm-save-menu{z-index:2600!important;pointer-events:auto!important}
      .cm-save-menu button{pointer-events:auto!important;touch-action:manipulation!important}
    </style>`;
    if(!src.includes('id="cmV41SaveOutputStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
