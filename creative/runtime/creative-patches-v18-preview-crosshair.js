(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const clearStart=src.indexOf('function cmClearPreview(){');
    const previewStart=src.indexOf('function cmPreviewAt(latlng){',clearStart);
    const nextStart=src.indexOf('function cmAnimateMarker(',previewStart);
    if(clearStart<0||previewStart<0||nextStart<0)return src;

    const replacement=`function cmClearPreview(){
  if(!cmPreview)return;
  try{
    if(cmPreview.marker)map.removeLayer(cmPreview.marker);
    if(cmPreview.circle)map.removeLayer(cmPreview.circle);
    if(cmPreview.aim)map.removeLayer(cmPreview.aim);
  }catch{}
  cmPreview=null;
}
function cmPreviewAimIcon(){
  return L.divIcon({
    className:'preview-touch',
    html:'<div style="position:relative;width:54px;height:54px;pointer-events:none"><div style="position:absolute;left:50%;top:50%;width:46px;height:3px;background:#fff;box-shadow:0 0 0 1px rgba(56,45,29,.55),0 1px 4px rgba(0,0,0,.35);transform:translate(-50%,-50%);border-radius:2px"></div><div style="position:absolute;left:50%;top:50%;width:3px;height:46px;background:#fff;box-shadow:0 0 0 1px rgba(56,45,29,.55),0 1px 4px rgba(0,0,0,.35);transform:translate(-50%,-50%);border-radius:2px"></div><div style="position:absolute;left:50%;top:50%;width:8px;height:8px;background:#d8b766;border:2px solid #fff;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 1px 4px rgba(0,0,0,.35)"></div></div>',
    iconSize:[54,54],
    iconAnchor:[27,27]
  });
}
function cmPreviewAt(latlng){
  if(!cmAddMode)return;
  cmClearPreview();
  const fake={layer:activeLayer,latlng:[latlng.lat,latlng.lng],memo:'',deleted:false,id:'__preview__'};
  const aim=L.marker(latlng,{icon:cmPreviewAimIcon(),pane:'placement',interactive:false,zIndexOffset:2400}).addTo(map);
  const marker=L.marker(latlng,{icon:cmRecordIcon(fake,true),pane:'placement',interactive:false,zIndexOffset:2500}).addTo(map);
  const circle=L.circle(latlng,{radius:50,color:'#d18a00',fillColor:'#d18a00',weight:1.5,fillOpacity:.035,renderer:circleRenderer,pane:'distance',interactive:false}).addTo(map);
  const near=cmNearest([latlng.lat,latlng.lng]);
  if(near&&near.distance<50)marker.bindTooltip('⚠️ '+near.distance.toFixed(1)+'m',{permanent:true,direction:'top',className:'distance-hint',opacity:.9}).openTooltip();
  cmPreview={marker,circle,aim};
}
`;

    src=src.slice(0,clearStart)+replacement+src.slice(nextStart);
    return src;
  };
})();
