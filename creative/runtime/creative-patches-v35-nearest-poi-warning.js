(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const installMarker='function cmSafeInstallAddBar(){';
    if(src.includes(installMarker)){
      const helper=`let cmSafeNearestWarning=null;
function cmSafeEnsureNearestWarning(){
  if(cmSafeNearestWarning&&cmSafeNearestWarning.isConnected)return cmSafeNearestWarning;
  const d=document.createElement('div');
  d.id='cmSafeNearestWarning';
  d.className='cm-safe-nearest-warning';
  d.setAttribute('aria-live','polite');
  document.body.appendChild(d);
  cmSafeNearestWarning=d;
  return d;
}
function cmSafeUpdateNearestWarning(){
  if(!cmAddMode&&!cmMoveSession){
    if(cmSafeNearestWarning)cmSafeNearestWarning.style.display='none';
    return;
  }
  const d=cmSafeEnsureNearestWarning();
  const c=map.getCenter();
  const excludeId=cmMoveSession?.r?.id;
  const n=cmNearest([c.lat,c.lng],excludeId);
  if(!n||!Number.isFinite(Number(n.distance))){d.style.display='none';return}
  const m=Number(n.distance);
  d.style.display='block';
  d.classList.toggle('danger',m<50);
  d.classList.toggle('safe',m>=50);
  d.textContent=(m<50?'⚠ ':'✓ ')+'最短POI '+m.toFixed(1)+'m';
}
function cmSafeRemoveNearestWarning(){
  if(cmSafeNearestWarning?.isConnected)cmSafeNearestWarning.remove();
  cmSafeNearestWarning=null;
}
`;
      src=src.replace(installMarker,helper+installMarker);
    }

    src=src.replace(
      'cmSafeBindAddLever();cmSafeSetAddRadius(50);',
      'cmSafeBindAddLever();cmSafeSetAddRadius(50);cmSafeEnsureNearestWarning();cmSafeUpdateNearestWarning();'
    );

    src=src.replace(
      'function cmSafeRemoveAddBar(){if(cmSafeAddBar?.isConnected)cmSafeAddBar.remove();cmSafeAddBar=null;cmSafeUnlockAddSurface()}',
      'function cmSafeRemoveAddBar(){if(cmSafeAddBar?.isConnected)cmSafeAddBar.remove();cmSafeAddBar=null;cmSafeRemoveNearestWarning();cmSafeUnlockAddSurface()}'
    );

    src=src.replace(
      "map.on('move',()=>{if(cmAddMode&&cmSafeAddCircle)cmSafeAddCircle.setLatLng(map.getCenter())});",
      "map.on('move',()=>{if(cmAddMode&&cmSafeAddCircle){cmSafeAddCircle.setLatLng(map.getCenter());cmSafeUpdateNearestWarning()}});"
    );

    src=src.replace(
      'cmBindMoveLever();cmMoveSetRadius(50);',
      'cmBindMoveLever();cmMoveSetRadius(50);cmSafeEnsureNearestWarning();cmSafeUpdateNearestWarning();'
    );

    src=src.replace(
      'function cmRemoveMoveUi(){if(cmMoveUi?.isConnected)cmMoveUi.remove();cmMoveUi=null;cmMoveUnlockSurface()}',
      'function cmRemoveMoveUi(){if(cmMoveUi?.isConnected)cmMoveUi.remove();cmMoveUi=null;cmSafeRemoveNearestWarning();cmMoveUnlockSurface()}'
    );

    src=src.replace(
      "const onMapMove=()=>{if(cmMoveSession?.r===r)circle.setLatLng(map.getCenter())};",
      "const onMapMove=()=>{if(cmMoveSession?.r===r){circle.setLatLng(map.getCenter());cmSafeUpdateNearestWarning()}};"
    );

    const style=`<style id="cmV35NearestPoiWarningStyle">
      .cm-safe-nearest-warning{position:fixed;left:50%;bottom:calc(222px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:1570;display:none;max-width:min(84vw,360px);padding:7px 12px;border-radius:999px;font-size:12px;font-weight:950;white-space:nowrap;pointer-events:none;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 2px 8px rgba(0,0,0,.12)}
      .cm-safe-nearest-warning.danger{background:rgba(255,238,220,.92);border:1px solid rgba(185,101,41,.45);color:#8a3f12}
      .cm-safe-nearest-warning.safe{background:rgba(245,252,239,.90);border:1px solid rgba(87,126,69,.34);color:#49623f}
    </style>`;
    if(!src.includes('id="cmV35NearestPoiWarningStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
