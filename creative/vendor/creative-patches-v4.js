(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;
  window.applyCreativePatches=function(src){
    src=previous(src);

    const oldRender="function renderRecordCircles(){recordCircleGroup.clearLayers();records.forEach(r=>{if(r.deleted||!map.hasLayer(groups[r.layer]))return;circleVisible.forEach(radius=>L.circle(r.latlng,circleOpts(radius)).addTo(recordCircleGroup))})}";
    const newRender="function renderRecordCircles(){recordCircleGroup.clearLayers();records.forEach(r=>{if(r.deleted||!map.hasLayer(groups[r.layer]))return;circleVisible.forEach(radius=>{const custom=Number(r.customRadius),actual=radius===50&&Number.isFinite(custom)&&custom>=30&&custom<=50?custom:radius,opts=circleOpts(radius);L.circle(r.latlng,{...opts,radius:actual}).addTo(recordCircleGroup)})})}";
    if(src.includes(oldRender))src=src.replace(oldRender,newRender);

    const injected=`
<style>
#applyRadius,#applyCoordinate{width:max-content!important;max-width:100%!important;height:34px!important;padding:0 12px!important;margin:7px auto 0!important;display:block!important;font-size:12px!important}
</style>
<script>
(()=>{
  const compact=()=>{
    const ar=document.getElementById('applyRadius');
    if(!ar)return;
    const panel=ar.parentElement;
    if(panel){panel.style.setProperty('width','236px','important');panel.style.setProperty('max-width','72vw','important');}
  };
  new MutationObserver(compact).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    const btn=e.target.closest&&e.target.closest('#applyCoordinate');
    if(!btn)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const input=document.getElementById('coordinateInput');
    if(!input)return;
    const raw=input.value.trim().replace(/，/g,','),parts=raw.split(',').map(x=>Number(x.trim()));
    if(parts.length!==2||!Number.isFinite(parts[0])||!Number.isFinite(parts[1])||parts[0]<-90||parts[0]>90||parts[1]<-180||parts[1]>180){try{msg('座標は「緯度, 経度」で入力してください')}catch{}return;}
    const panel=btn.parentElement;
    if(panel)panel.style.display='none';
    const ll=[parts[0],parts[1]];
    try{map.setView(ll,map.getZoom(),{animate:false});if(draft&&draft.marker){draft.marker.setLatLng(ll);if(draft.c50)draft.c50.setLatLng(ll);if(draft.c40)draft.c40.setLatLng(ll);updateNearestHint();}msg('入力した座標へ移動しました',1200);}catch(err){console.error(err)}
  },true);
  compact();
})();
<\/script>`;
    return src.replace('</body>',injected+'</body>');
  };
})();
