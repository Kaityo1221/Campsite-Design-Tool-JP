(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const uiMarker='function cmInstallUi(){';
    if(src.includes(uiMarker)&&!src.includes('function cmInstallStandaloneSave(){')){
      const helper=`let cmStandaloneSaveMenu=null,cmStandaloneSaveBusy=false;
function cmCloseStandaloneSave(){
  if(cmStandaloneSaveMenu){cmStandaloneSaveMenu.remove();cmStandaloneSaveMenu=null}
}
function cmOpenStandaloneSave(){
  cmCloseStandaloneSave();
  try{cmCloseSaveMenu()}catch{}
  const w=document.createElement('div');
  w.id='cmStandaloneSaveMenu';
  w.innerHTML='<button id="cmStandaloneKmz" type="button">KMZで出力</button><button id="cmStandaloneCoords" type="button">座標一覧</button><button id="cmStandaloneClose" type="button">×</button>';
  document.body.appendChild(w);
  cmStandaloneSaveMenu=w;

  const stop=e=>{try{e.preventDefault()}catch{}try{e.stopPropagation()}catch{}try{e.stopImmediatePropagation()}catch{}};
  const kmz=w.querySelector('#cmStandaloneKmz');
  const coords=w.querySelector('#cmStandaloneCoords');
  const close=w.querySelector('#cmStandaloneClose');

  const runKmz=async e=>{
    stop(e);if(cmStandaloneSaveBusy)return;cmStandaloneSaveBusy=true;
    try{cmCloseStandaloneSave();await exportKmz()}catch(err){console.error(err);msg('KMZ出力に失敗しました',2200)}finally{cmStandaloneSaveBusy=false}
  };
  const runCoords=e=>{stop(e);cmCloseStandaloneSave();cmOpenCoords()};
  const runClose=e=>{stop(e);cmCloseStandaloneSave()};

  ['pointerup','touchend','click'].forEach(type=>kmz.addEventListener(type,runKmz,{capture:true,passive:false}));
  ['pointerup','touchend','click'].forEach(type=>coords.addEventListener(type,runCoords,{capture:true,passive:false}));
  ['pointerup','touchend','click'].forEach(type=>close.addEventListener(type,runClose,{capture:true,passive:false}));
}
function cmInstallStandaloneSave(){
  const old=document.getElementById('save');
  if(old)old.style.display='none';
  if(document.getElementById('cmStandaloneSaveButton'))return;

  const b=document.createElement('button');
  b.id='cmStandaloneSaveButton';
  b.type='button';
  b.textContent='💾';
  b.setAttribute('aria-label','保存・出力');
  b.title='保存・出力';
  document.body.appendChild(b);

  let last=0;
  const fire=e=>{
    const now=Date.now();
    try{e.preventDefault()}catch{}try{e.stopPropagation()}catch{}try{e.stopImmediatePropagation()}catch{}
    if(now-last<650)return;last=now;
    cmOpenStandaloneSave();
  };
  b.addEventListener('pointerup',fire,{capture:true,passive:false});
  b.addEventListener('touchend',fire,{capture:true,passive:false});
  b.addEventListener('click',fire,true);
}
`;
      src=src.replace(uiMarker,helper+uiMarker.replace('{','{cmInstallStandaloneSave();'));
    }

    const style=`<style id="cmV43StandaloneSaveStyle">
      #save{display:none!important}
      #cmStandaloneSaveButton{position:fixed;left:10px;bottom:calc(72px + env(safe-area-inset-bottom));z-index:6000;width:52px;height:52px;padding:0;border:1px solid var(--edge);border-radius:14px;background:#fffdf7;color:#382d1d;font-size:23px;font-weight:900;box-shadow:0 4px 14px rgba(0,0,0,.18);pointer-events:auto!important;touch-action:manipulation!important;-webkit-user-select:none;user-select:none}
      .left-hand #cmStandaloneSaveButton{left:auto;right:10px}
      body.cm-placement-docked #cmStandaloneSaveButton{display:none!important}
      body:has(.cm-sheet) #cmStandaloneSaveButton{display:none!important}
      #cmStandaloneSaveMenu{position:fixed;left:10px;bottom:calc(132px + env(safe-area-inset-bottom));z-index:6500;display:grid;grid-template-columns:1fr;gap:7px;width:min(260px,calc(100vw - 20px));padding:8px;border-radius:14px;background:rgba(48,40,29,.96);box-shadow:0 8px 24px rgba(0,0,0,.28);pointer-events:auto!important}
      .left-hand #cmStandaloneSaveMenu{left:auto;right:10px}
      #cmStandaloneSaveMenu button{min-height:46px;border:1px solid #b89a57;border-radius:11px;background:#fff8e6;color:#382d1d;padding:0 14px;font-weight:900;text-align:left;pointer-events:auto!important;touch-action:manipulation!important}
      #cmStandaloneSaveMenu #cmStandaloneClose{text-align:center;font-size:20px}
    </style>`;
    if(!src.includes('id="cmV43StandaloneSaveStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
