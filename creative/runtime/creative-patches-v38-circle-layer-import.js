(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // Read 30/40/50m circle folders from imported KML/KMZ and reflect them in the editor.
    const parseMarker='function parse(kml){';
    if(src.includes(parseMarker)&&!src.includes('function cmReadImportedCircleLayers(')){
      const helper=`function cmReadImportedCircleLayers(doc){
  const found=new Set();
  for(const f of doc.getElementsByTagNameNS('*','Folder')){
    const name=[...f.children].find(x=>x.localName==='name')?.textContent?.trim()||'';
    const m=name.match(/(?:^|[^0-9])(30|40|50)\\s*m\\s*(?:円|サークル|circle)/i);
    if(m)found.add(Number(m[1]));
  }
  circleExtras=[];
  [50,40,30].forEach(radius=>{if(found.has(radius))circleExtras.push(radius)});
  circlePanel.querySelectorAll('[data-extra]').forEach(b=>b.classList.toggle('active',circleExtras.includes(Number(b.dataset.extra))));
}
function cmCircleLayerEnabled(radius){return circleExtras.includes(radius)}
function cmToggleCircleLayer(radius){
  const i=circleExtras.indexOf(radius);
  if(i>=0)circleExtras.splice(i,1);else circleExtras.push(radius);
  circleExtras.sort((a,b)=>b-a);
  circlePanel.querySelectorAll('[data-extra]').forEach(b=>b.classList.toggle('active',circleExtras.includes(Number(b.dataset.extra))));
  renderRecordCircles();snapshot();renderLayerPanel();
  msg((cmCircleLayerEnabled(radius)?'表示：':'非表示：')+radius+'m円',1000);
}
function cmIsCircleDummyRecord(r){
  return /レイヤー保持用のダミーポイント/.test(String(r?.memo||''));
}
`;
      src=src.replace(parseMarker,helper+parseMarker);
    }

    src=src.replace(
      "function parse(kml){records=[];polygons=[];const doc=new DOMParser().parseFromString(kml,'application/xml'),bounds=[];",
      "function parse(kml){records=[];polygons=[];circleExtras=[];const doc=new DOMParser().parseFromString(kml,'application/xml'),bounds=[];cmReadImportedCircleLayers(doc);"
    );

    // Keep the 50m visibility choice in CREATIVE MODE workspace restore as well.
    src=src.replace(
      "circleExtras=Array.isArray(w.circleExtras)?w.circleExtras.filter(x=>x===40||x===30):[];",
      "circleExtras=Array.isArray(w.circleExtras)?w.circleExtras.filter(x=>x===50||x===40||x===30):[];"
    );

    // v6 intentionally disabled record circles. Restore only the circle layers currently enabled.
    src=src.replace(
      'renderRecordCircles=function(){recordCircleGroup.clearLayers()};',
      `renderRecordCircles=function(){
  recordCircleGroup.clearLayers();
  if(!map.hasLayer(recordCircleGroup))recordCircleGroup.addTo(map);
  records.forEach(r=>{
    if(!r||r.deleted||cmIsCircleDummyRecord(r)||!map.hasLayer(groups[r.layer]))return;
    [50,40,30].forEach(radius=>{if(cmCircleLayerEnabled(radius))L.circle(r.latlng,circleOpts(radius)).addTo(recordCircleGroup)});
  });
};`
    );

    // Fallback for builds where the v6 override is absent: make the base renderer equally safe.
    src=src.replace(
      "function renderRecordCircles(){recordCircleGroup.clearLayers();records.forEach(r=>{if(r.deleted||!map.hasLayer(groups[r.layer]))return;L.circle(r.latlng,circleOpts(50)).addTo(recordCircleGroup);circleExtras.forEach(radius=>L.circle(r.latlng,circleOpts(radius)).addTo(recordCircleGroup))})}",
      "function renderRecordCircles(){recordCircleGroup.clearLayers();if(!map.hasLayer(recordCircleGroup))recordCircleGroup.addTo(map);records.forEach(r=>{if(!r||r.deleted||cmIsCircleDummyRecord(r)||!map.hasLayer(groups[r.layer]))return;[50,40,30].forEach(radius=>{if(cmCircleLayerEnabled(radius))L.circle(r.latlng,circleOpts(radius)).addTo(recordCircleGroup)})})}"
    );

    // Extend the tap-style layer menu with circle layers while preserving the existing POI/polygon behavior.
    const start=src.indexOf('function renderLayerPanel(){');
    const end=start>=0?src.indexOf('}renderLayerPanel();',start):-1;
    if(start>=0&&end>=0){
      const replacement=`function renderLayerPanel(){
  const root=$('layerRows');
  root.innerHTML='';
  layerDefs.forEach(([k,label])=>{
    const row=document.createElement('div');
    row.className='layer-row';
    const b=document.createElement('button');
    const visible=map.hasLayer(groups[k]);
    b.type='button';
    b.textContent=label;
    b.classList.toggle('active',visible);
    b.setAttribute('aria-pressed',visible?'true':'false');
    b.onclick=()=>{
      const nowVisible=map.hasLayer(groups[k]);
      if(nowVisible)map.removeLayer(groups[k]);else groups[k].addTo(map);
      renderRecordCircles();
      renderLayerPanel();
      msg((nowVisible?'非表示：':'表示：')+label);
    };
    row.append(b);
    root.append(row);
  });
  [50,40,30].forEach(radius=>{
    const row=document.createElement('div');
    row.className='layer-row cm-circle-layer-row';
    const b=document.createElement('button');
    const visible=cmCircleLayerEnabled(radius);
    b.type='button';
    b.textContent=radius+'m円';
    b.classList.toggle('active',visible);
    b.setAttribute('aria-pressed',visible?'true':'false');
    b.onclick=()=>cmToggleCircleLayer(radius);
    row.append(b);
    root.append(row);
  });
  const row=document.createElement('div');
  row.className='layer-row';
  const b=document.createElement('button');
  const count=polygons.filter(p=>!p.deleted).length;
  b.type='button';
  b.textContent=count?'ポリゴン (1)':'ポリゴン';
  b.disabled=count===0;
  b.classList.toggle('active',count>0&&polygonVisible);
  b.setAttribute('aria-pressed',count>0&&polygonVisible?'true':'false');
  b.onclick=()=>{
    if(!count)return;
    polygonVisible=!polygonVisible;
    polygonVisible?polygonGroup.addTo(map):map.removeLayer(polygonGroup);
    renderLayerPanel();
    msg((polygonVisible?'表示：':'非表示：')+'ポリゴン');
  };
  row.append(b);
  root.append(row);
}renderLayerPanel();`;
      src=src.slice(0,start)+replacement+src.slice(end+'}renderLayerPanel();'.length);
    }

    return src;
  };
})();
