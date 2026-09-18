(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const crossMarker='let cmPersistentCrosshair=null;';
    if(src.includes(crossMarker)){
      const helper=`let cmGuideRadius=50,cmRadiusGauge=null,cmCenterGuideCircle=null,cmKmzExported=false;
function cmInstallRadiusGauge(){
  if(cmRadiusGauge&&cmRadiusGauge.isConnected)return cmRadiusGauge;
  const style=document.createElement('style');
  style.id='cmRadiusGaugeStyle';
  style.textContent=\`
    .cm-radius-gauge{position:fixed;left:50%;bottom:calc(132px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:1510;width:178px;padding:8px 11px 7px;border:1px solid #8a6b31;border-radius:15px;background:rgba(255,253,247,.97);box-shadow:0 5px 16px rgba(0,0,0,.24);color:#382d1d;display:none}
    .cm-radius-gauge-head{display:flex;justify-content:space-between;align-items:center;font-size:10px;font-weight:900;line-height:1}.cm-radius-gauge-head strong{font-size:12px}
    .cm-radius-gauge input[type=range]{display:block;width:100%;margin:7px 0 2px;accent-color:#c69200}
    .cm-radius-gauge-labels{display:grid;grid-template-columns:repeat(3,1fr);align-items:center;font-size:9px;font-weight:900;color:#756650;text-align:center}.cm-radius-gauge-labels button{border:0;background:transparent;color:inherit;padding:2px 0;font:inherit}.cm-radius-gauge-labels button:first-child{text-align:left}.cm-radius-gauge-labels button:last-child{text-align:right}
  \`;
  if(!document.getElementById(style.id))document.head.appendChild(style);
  const d=document.createElement('div');
  d.id='cmRadiusGauge';d.className='cm-radius-gauge';
  d.innerHTML='<div class="cm-radius-gauge-head"><span>距離円</span><strong id="cmRadiusValue">50m</strong></div><input id="cmRadiusRange" type="range" min="30" max="50" step="10" value="50" aria-label="距離円"><div class="cm-radius-gauge-labels"><button type="button" data-r="30">30m</button><button type="button" data-r="40">40m</button><button type="button" data-r="50">50m</button></div>';
  document.body.appendChild(d);cmRadiusGauge=d;
  d.querySelector('#cmRadiusRange').addEventListener('input',e=>cmSetGuideRadius(Number(e.target.value)));
  d.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>cmSetGuideRadius(Number(b.dataset.r)));
  return d;
}
function cmEnsureCenterGuideCircle(){
  if(!cmAddMode)return;
  const ll=map.getCenter();
  if(!cmCenterGuideCircle){
    cmCenterGuideCircle=L.circle(ll,{radius:cmGuideRadius,color:'#d18a00',fillColor:'#d18a00',weight:1.5,fillOpacity:.025,renderer:circleRenderer,pane:'distance',interactive:false}).addTo(map);
  }else{
    cmCenterGuideCircle.setLatLng(ll);cmCenterGuideCircle.setRadius(cmGuideRadius);
    if(!map.hasLayer(cmCenterGuideCircle))cmCenterGuideCircle.addTo(map);
  }
}
function cmRemoveCenterGuideCircle(){
  if(!cmCenterGuideCircle)return;
  try{map.removeLayer(cmCenterGuideCircle)}catch{}
  cmCenterGuideCircle=null;
}
function cmSetGuideRadius(v){
  cmGuideRadius=v<=35?30:v<=45?40:50;
  const g=cmInstallRadiusGauge(),range=g.querySelector('#cmRadiusRange'),value=g.querySelector('#cmRadiusValue');
  range.value=String(cmGuideRadius);value.textContent=cmGuideRadius+'m';
  if(cmCenterGuideCircle)cmCenterGuideCircle.setRadius(cmGuideRadius);
  if(cmPreview?.circle)cmPreview.circle.setRadius(cmGuideRadius);
}
function cmShowRadiusGauge(){
  const g=cmInstallRadiusGauge();g.style.display='block';cmSetGuideRadius(cmGuideRadius);cmEnsureCenterGuideCircle();
}
function cmHideRadiusGauge(){
  if(cmRadiusGauge)cmRadiusGauge.style.display='none';cmRemoveCenterGuideCircle();
}
map.on('move',()=>{if(cmAddMode&&cmCenterGuideCircle)cmCenterGuideCircle.setLatLng(map.getCenter())});
`;
      src=src.replace(crossMarker,helper+crossMarker);
    }

    // Use the selected 30/40/50m guide radius for the touch preview circle.
    src=src.replace("const circle=L.circle(latlng,{radius:50,color:'#d18a00'","const circle=L.circle(latlng,{radius:cmGuideRadius,color:'#d18a00'");

    // Show the gauge for the full add session; hide it when add mode ends.
    const oldStart="function cmStartAdd(layer){cmEndMove();activeLayer=layer;cmAddMode=true;activeTool='add';cmCloseAddMenu();cmUpdateFab();status.classList.add('fade');renderLayerPanel();cmShowPersistentCrosshair()}";
    const newStart="function cmStartAdd(layer){cmEndMove();activeLayer=layer;cmAddMode=true;activeTool='add';cmCloseAddMenu();cmUpdateFab();status.classList.add('fade');renderLayerPanel();cmShowPersistentCrosshair();cmShowRadiusGauge()}";
    if(src.includes(oldStart))src=src.replace(oldStart,newStart);
    const oldExit="function cmExitAddMode(message=true){cmAddMode=false;cmCloseAddMenu();cmClearPreview();cmHidePersistentCrosshair();if(activeTool==='add')activeTool='';cmUpdateFab();if(message)msg('POI追加を終了しました')}";
    const newExit="function cmExitAddMode(message=true){cmAddMode=false;cmCloseAddMenu();cmClearPreview();cmHidePersistentCrosshair();cmHideRadiusGauge();if(activeTool==='add')activeTool='';cmUpdateFab();if(message)msg('POI追加を終了しました')}";
    if(src.includes(oldExit))src=src.replace(oldExit,newExit);

    // Do not place a large return button over the map after KMZ export.
    const returnStart=src.indexOf('function cmShowReturn(){');
    const saveStart=returnStart>=0?src.indexOf('function cmOpenSaveMenu(){',returnStart):-1;
    if(returnStart>=0&&saveStart>=0){
      src=src.slice(0,returnStart)+`function cmShowReturn(){cmKmzExported=true;cmCloseSaveMenu();msg('KMZを保存しました',1400)}\n`+src.slice(saveStart);
    }

    // Keep the return action inside the save menu, only after KMZ has been exported.
    const saveFnStart=src.indexOf('function cmOpenSaveMenu(){');
    const saveFnEnd=saveFnStart>=0?src.indexOf("$('save').textContent='💾'",saveFnStart):-1;
    if(saveFnStart>=0&&saveFnEnd>=0){
      const replacement=`function cmOpenSaveMenu(){
  cmCloseSaveMenu();
  const w=document.createElement('div');
  w.className='cm-save-menu';
  w.innerHTML='<button id="cmKmz">KMZで出力（Google My Maps用）</button><button id="cmCoords">座標一覧（旧提出フォーム用）</button>'+(cmKmzExported?'<button id="cmBackToMain">Campsite Design Toolに戻る</button>':'');
  document.body.appendChild(w);cmSaveMenu=w;
  w.querySelector('#cmKmz').onclick=async()=>{cmCloseSaveMenu();await exportKmz();cmShowReturn()};
  w.querySelector('#cmCoords').onclick=cmOpenCoords;
  const back=w.querySelector('#cmBackToMain');
  if(back)back.onclick=()=>{snapshot();cmPersistCurrent();location.href='https://kaityo1221.github.io/Campsite-Design-Tool-JP/'};
}
`;
      src=src.slice(0,saveFnStart)+replacement+src.slice(saveFnEnd);
    }

    return src;
  };
})();
