(() => {
  'use strict';

  const WRITE_NEEDLE = '  document.open();document.write(html);document.close();';

  const loader = String.raw`
const CAMPSITE_PROJECT_KEY='campsiteProject.v1';
function campsProjectLayer(entity){
  const type=String(entity||'').toUpperCase();
  if(type==='GYM')return'existing-gym';
  if(type==='POWERSPOT')return'existing-power';
  return'existing-pokestop';
}
function campsProjectId(prefix){
  try{return crypto.randomUUID()}catch{return prefix+'-'+Date.now()+'-'+Math.random().toString(16).slice(2)}
}
function loadCampsiteBridgeProject(project){
  const selected=Array.isArray(project&&project.selectedPois)?project.selectedPois:[];
  const polygon=Array.isArray(project&&project.polygon)?project.polygon:[];
  if(!selected.length)return false;
  records=selected.map((poi,index)=>({
    id:String(poi.guid||poi.id||campsProjectId('poi-'+index)),
    layer:campsProjectLayer(poi.gameEntity||poi.type),
    latlng:[Number(poi.lat),Number(poi.lng)],
    title:String(poi.title||poi.name||'名称なし'),
    memo:String(poi.description||''),
    deleted:false,
    source:true,
    guid:String(poi.guid||''),
    gameEntity:String(poi.gameEntity||poi.type||''),
    gameStatus:String(poi.gameStatus||'UNKNOWN'),
    sponsored:poi.sponsored===true,
    smr:poi.smr===true?true:poi.smr===false?false:null,
    imageUrl:String(poi.imageUrl||''),
    s2L14:String(poi.s2L14||''),
    s2L17:String(poi.s2L17||''),
    provenance:Array.isArray(poi.provenance)?poi.provenance.slice():[]
  })).filter(r=>Number.isFinite(r.latlng[0])&&Number.isFinite(r.latlng[1]));
  if(!records.length)return false;
  const points=polygon.filter(p=>Array.isArray(p)&&p.length>=2).map(p=>[Number(p[0]),Number(p[1])]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
  polygons=points.length>=3?[{id:campsProjectId('activity'),points,deleted:false,source:true}]:[];
  polygonVisible=polygons.length>0;
  sourceZip=null;
  sourceKmlPath='doc.kml';
  sourceIsKmz=false;
  sourceText='<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document/></kml>';
  const date=String(project.createdAt||new Date().toISOString()).slice(0,10).replace(/-/g,'');
  sourceName='Campsite_Bridge_'+date;
  drawAll();
  renderLayerPanel();
  const bounds=records.map(r=>r.latlng).concat(points);
  if(bounds.length)map.fitBounds(bounds,{padding:[28,28],maxZoom:18});
  snapshot();
  beginEditor();
  const backBtn=$('back');
  if(backBtn)backBtn.onclick=()=>{snapshot();location.href='../bridge-gateway.html?campsiteBridgeImport=1'};
  window.CampsiteCreativeProject=Object.freeze({projectId:String(project.projectId||''),source:'bridge',count:records.length,polygonCount:polygons.length});
  msg('Bridgeから '+records.length+'件を読み込みました',1800);
  return true;
}
`;

  const autostart = String.raw`
setTimeout(()=>{
  try{
    const q=new URLSearchParams(location.search);
    if(q.get('campsiteProject')!=='bridge')return;
    const project=JSON.parse(sessionStorage.getItem(CAMPSITE_PROJECT_KEY)||'null');
    if(!project||project.source!=='bridge'||!loadCampsiteBridgeProject(project)){
      const state=$('entryState');
      if(state)state.textContent='Bridgeから受信したプロジェクトを確認できませんでした。';
    }
  }catch(error){
    console.error('[CREATIVE MODE] Bridge project load failed',error);
    const state=$('entryState');
    if(state)state.textContent='Bridgeプロジェクトの読み込みに失敗しました。';
  }
},0);
`;

  function apply(src) {
    if (typeof src !== 'string' || !src.includes(WRITE_NEEDLE)) return src;
    const injected = [
      `  const campsBridgeLoader=${JSON.stringify(loader)};`,
      "  html=html.replace('function beginEditor(){',campsBridgeLoader+'function beginEditor(){');",
      `  const campsBridgeAutostart=${JSON.stringify(autostart)};`,
      "  html=html.replace('function restore(){',campsBridgeAutostart+'function restore(){');"
    ].join('\n');
    return src.replace(WRITE_NEEDLE, `${injected}\n${WRITE_NEEDLE}`);
  }

  window.applyCreativeBridgeProjectPatch = apply;
})();
