(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // Keep a center crosshair visible for the whole add-mode session.
    // Tap placement remains unchanged; the tap preview only shows the selected icon + 50m circle.
    const clearStart=src.indexOf('function cmClearPreview(){');
    const nextStart=clearStart>=0?src.indexOf('function cmAnimateMarker(',clearStart):-1;
    if(clearStart>=0&&nextStart>=0){
      const replacement=`let cmPersistentCrosshair=null;
function cmCrosshairElement(){
  const d=document.createElement('div');
  d.id='cmPersistentCrosshair';
  d.innerHTML='<div style="position:absolute;left:50%;top:50%;width:46px;height:3px;background:#fff;box-shadow:0 0 0 1px rgba(56,45,29,.55),0 1px 4px rgba(0,0,0,.35);transform:translate(-50%,-50%);border-radius:2px"></div><div style="position:absolute;left:50%;top:50%;width:3px;height:46px;background:#fff;box-shadow:0 0 0 1px rgba(56,45,29,.55),0 1px 4px rgba(0,0,0,.35);transform:translate(-50%,-50%);border-radius:2px"></div><div style="position:absolute;left:50%;top:50%;width:8px;height:8px;background:#d8b766;border:2px solid #fff;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>';
  Object.assign(d.style,{position:'fixed',left:'50%',top:'50%',transform:'translate(-50%,-50%)',width:'54px',height:'54px',zIndex:'1440',pointerEvents:'none',display:'none'});
  document.body.appendChild(d);
  return d;
}
function cmShowPersistentCrosshair(){
  if(!cmPersistentCrosshair||!cmPersistentCrosshair.isConnected)cmPersistentCrosshair=cmCrosshairElement();
  cmPersistentCrosshair.style.display='block';
}
function cmHidePersistentCrosshair(){
  if(cmPersistentCrosshair)cmPersistentCrosshair.style.display='none';
}
function cmClearPreview(){
  if(!cmPreview)return;
  try{
    if(cmPreview.marker)map.removeLayer(cmPreview.marker);
    if(cmPreview.circle)map.removeLayer(cmPreview.circle);
  }catch{}
  cmPreview=null;
}
function cmPreviewAt(latlng){
  if(!cmAddMode)return;
  cmClearPreview();
  const fake={layer:activeLayer,latlng:[latlng.lat,latlng.lng],memo:'',deleted:false,id:'__preview__'};
  const marker=L.marker(latlng,{icon:cmRecordIcon(fake,true),pane:'placement',interactive:false,zIndexOffset:2500}).addTo(map);
  const circle=L.circle(latlng,{radius:50,color:'#d18a00',fillColor:'#d18a00',weight:1.5,fillOpacity:.035,renderer:circleRenderer,pane:'distance',interactive:false}).addTo(map);
  const near=cmNearest([latlng.lat,latlng.lng]);
  if(near&&near.distance<50)marker.bindTooltip('⚠️ '+near.distance.toFixed(1)+'m',{permanent:true,direction:'top',className:'distance-hint',opacity:.9}).openTooltip();
  cmPreview={marker,circle};
}
`;
      src=src.slice(0,clearStart)+replacement+src.slice(nextStart);
    }

    const startAdd=src.indexOf('function cmStartAdd(layer){');
    const openAdd=startAdd>=0?src.indexOf('function cmOpenAddMenu()',startAdd):-1;
    if(startAdd>=0&&openAdd>=0){
      const replacement=`function cmStartAdd(layer){cmEndMove();activeLayer=layer;cmAddMode=true;activeTool='add';cmCloseAddMenu();cmUpdateFab();status.classList.add('fade');renderLayerPanel();cmShowPersistentCrosshair()}
function cmExitAddMode(message=true){cmAddMode=false;cmCloseAddMenu();cmClearPreview();cmHidePersistentCrosshair();if(activeTool==='add')activeTool='';cmUpdateFab();if(message)msg('POI追加を終了しました')}
`;
      src=src.slice(0,startAdd)+replacement+src.slice(openAdd);
    }

    return src;
  };
})();
