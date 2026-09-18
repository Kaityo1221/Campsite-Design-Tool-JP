(() => {
  'use strict';

  const loader = String.raw`
const CAMPSITE_PROJECT_KEY='campsiteProject.v1';
function campsProjectLayer(entity){
  const type=String(entity||'').toUpperCase();
  if(type==='GYM')return'existing-gym';
  if(type==='POWERSPOT')return'existing-power';
  return'existing-pokestop';
}
function campsProjectEntity(layer){
  const value=String(layer||'').toLowerCase();
  if(value.includes('gym'))return'GYM';
  if(value.includes('power'))return'POWERSPOT';
  return'POKESTOP';
}
function campsProjectRole(layer){return String(layer||'').startsWith('new-')?'added':'existing'}
function campsProjectId(prefix){
  try{return crypto.randomUUID()}catch{return prefix+'-'+Date.now()+'-'+Math.random().toString(16).slice(2)}
}
function campsProjectRecordPoi(r){
  const lat=Number(r?.latlng?.[0]),lng=Number(r?.latlng?.[1]);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
  return{
    id:String(r.id||r.guid||campsProjectId('poi')),
    guid:String(r.guid||''),
    title:String(r.title||'名称なし'),
    name:String(r.title||'名称なし'),
    lat,lng,
    gameEntity:campsProjectEntity(r.layer||r.gameEntity),
    gameStatus:String(r.gameStatus||'UNKNOWN'),
    layer:String(r.layer||''),
    role:campsProjectRole(r.layer),
    sponsored:r.sponsored===true,
    smr:r.smr===true?true:r.smr===false?false:null,
    imageUrl:String(r.imageUrl||''),
    description:String(r.memo||r.description||''),
    s2L14:String(r.s2L14||''),
    s2L17:String(r.s2L17||''),
    provenance:Array.isArray(r.provenance)?r.provenance.slice():[],
    applicationComment:String(r.applicationComment||''),
    applicationCommentNeedsReview:r.applicationCommentNeedsReview===true,
    customRadius:Number.isFinite(Number(r.customRadius))?Number(r.customRadius):null,
    source:r.source===true
  };
}
function syncCampsiteProjectFromCreative(project){
  if(!project||project.source!=='bridge')return null;
  const original=new Map((Array.isArray(project.selectedPois)?project.selectedPois:[]).map(p=>[String(p.guid||p.id||''),p]));
  const current=[],added=[],deleted=[],edits=[];
  records.forEach(r=>{
    const poi=campsProjectRecordPoi(r);if(!poi)return;
    if(r.deleted){deleted.push(poi);return}
    current.push(poi);
    if(poi.role==='added')added.push(poi);
    const base=original.get(String(poi.guid||poi.id||''));
    if(base){
      const moved=Math.abs(Number(base.lat)-poi.lat)>1e-8||Math.abs(Number(base.lng)-poi.lng)>1e-8;
      const renamed=String(base.title||base.name||'')!==poi.title;
      const relayered=campsProjectEntity(base.gameEntity||base.type)!==poi.gameEntity||poi.role!=='existing';
      if(moved||renamed||relayered||poi.description!==String(base.description||'')){
        edits.push({id:poi.id,guid:poi.guid,moved,renamed,relayered,lat:poi.lat,lng:poi.lng,title:poi.title,layer:poi.layer});
      }
    }
  });
  const activePolygon=(polygons||[]).find(p=>!p.deleted&&Array.isArray(p.points)&&p.points.length>=3);
  const polygon=activePolygon?activePolygon.points.map(p=>[Number(p[0]),Number(p[1])]):Array.isArray(project.polygon)?project.polygon:[];
  project.currentPois=current;
  project.addedPois=added;
  project.deletedPois=deleted;
  project.edits=edits;
  project.polygon=polygon;
  project.circleRadii=[50,...circleExtras.filter(radius=>radius===40||radius===30)].filter((value,index,array)=>array.indexOf(value)===index).sort((a,b)=>b-a);
  project.phase='design';
  project.updatedAt=new Date().toISOString();
  project.creative={recordCount:current.length,addedCount:added.length,deletedCount:deleted.length,editCount:edits.length,savedAt:project.updatedAt};
  sessionStorage.setItem(CAMPSITE_PROJECT_KEY,JSON.stringify(project));
  return project;
}
function installCampsiteProjectNext(project){
  if(document.getElementById('campsiteProjectNext'))return;
  const btn=document.createElement('button');
  btn.id='campsiteProjectNext';btn.type='button';btn.textContent='次へ →';btn.setAttribute('aria-label','次へ：距離チェック');btn.title='距離チェックへ';
  btn.style.cssText='position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translateX(-50%);z-index:1350;min-width:92px;min-height:44px;padding:0 12px;border:1px solid #8a6b31;border-radius:13px;background:linear-gradient(180deg,#f3d77f,#c58c1f);color:#37270c;font-weight:950;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.24)'
  btn.onclick=()=>{const saved=syncCampsiteProjectFromCreative(project);if(!saved)return;location.href='../bridge-distance.html?campsiteProject=bridge'};
  document.body.appendChild(btn);
  const sync=()=>{try{syncCampsiteProjectFromCreative(project)}catch(_){}};
  window.addEventListener('pagehide',sync);
  setInterval(sync,2500);
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
    provenance:Array.isArray(poi.provenance)?poi.provenance.slice():[],
    applicationComment:String(poi.applicationComment||''),
    applicationCommentNeedsReview:poi.applicationCommentNeedsReview===true,
    customRadius:Number.isFinite(Number(poi.customRadius))?Number(poi.customRadius):undefined
  })).filter(r=>Number.isFinite(r.latlng[0])&&Number.isFinite(r.latlng[1]));
  if(!records.length)return false;
  const points=polygon.filter(p=>Array.isArray(p)&&p.length>=2).map(p=>[Number(p[0]),Number(p[1])]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
  polygons=points.length>=3?[{id:campsProjectId('activity'),points,deleted:false,source:true}]:[];
  polygonVisible=polygons.length>0;
  circleExtras=(Array.isArray(project.circleRadii)?project.circleRadii:[]).map(Number).filter(radius=>radius===40||radius===30);
  sourceZip=null;
  sourceKmlPath='doc.kml';
  sourceIsKmz=false;
  sourceText='<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document/></kml>';
  const date=String(project.createdAt||new Date().toISOString()).slice(0,10).replace(/-/g,'');
  sourceName='Campsite_Bridge_'+date;
  drawAll();
  renderLayerPanel();
  circlePanel.querySelectorAll('[data-extra]').forEach(b=>b.classList.toggle('active',circleExtras.includes(Number(b.dataset.extra))));
  const bounds=records.map(r=>r.latlng).concat(points);
  if(bounds.length)map.fitBounds(bounds,{padding:[28,28],maxZoom:18});
  snapshot();
  beginEditor();
  const backBtn=$('back');
  if(backBtn)backBtn.onclick=()=>{syncCampsiteProjectFromCreative(project);snapshot();location.href='../bridge-gateway.html?campsiteBridgeImport=1'};
  installCampsiteProjectNext(project);
  syncCampsiteProjectFromCreative(project);
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
    if (typeof src !== 'string') return src;
    let out=src;
    if(!out.includes('CAMPSITE_PROJECT_KEY')&&out.includes('function beginEditor(){')){
      out=out.replace('function beginEditor(){',loader+'function beginEditor(){');
    }
    if(!out.includes('Bridge project load failed')&&out.includes('function restore(){')){
      out=out.replace('function restore(){',autostart+'function restore(){');
    }
    return out;
  }

  window.applyCreativeBridgeProjectPatch = apply;
})();
