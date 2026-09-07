(()=>{
  'use strict';

  const RUNTIME_WRITE_NEEDLE='document.open();document.write(html);document.close();';
  const TRACK_URL='https://azkshxjgsbtjgwbapcfw.supabase.co/rest/v1/rpc/record_campsite_design_event';
  const TRACK_KEY='sb_publishable_rWbeIqdWJJHHBtphER8bdg__CaS_xGK';

  const helpers=`
const CREATIVE_TRACK_URL='${TRACK_URL}';
const CREATIVE_TRACK_KEY='${TRACK_KEY}';
function creativeDeviceId(){try{const k='campsite-anonymous-device-id';let v=localStorage.getItem(k);if(!v){v=crypto.randomUUID?.()||('dev-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));localStorage.setItem(k,v)}return v}catch{return null}}
function creativeParkName(){return String(sourceName||'campsite').replace(/\\.(kmz|kml|csv)$/i,'').replace(/(?:_creative)+$/i,'').trim()||'campsite'}
function creativeCenter(){const activePolys=(polygons||[]).filter(p=>p&&!p.deleted&&Array.isArray(p.points)&&p.points.length);if(activePolys.length){const pts=activePolys.flatMap(p=>p.points).filter(x=>Array.isArray(x)&&Number.isFinite(Number(x[0]))&&Number.isFinite(Number(x[1])));if(pts.length)return{lat:pts.reduce((s,x)=>s+Number(x[0]),0)/pts.length,lng:pts.reduce((s,x)=>s+Number(x[1]),0)/pts.length,source:'polygon'}}const pts=(records||[]).filter(r=>r&&!r.deleted&&Array.isArray(r.latlng)&&Number.isFinite(Number(r.latlng[0]))&&Number.isFinite(Number(r.latlng[1])));if(pts.length)return{lat:pts.reduce((s,r)=>s+Number(r.latlng[0]),0)/pts.length,lng:pts.reduce((s,r)=>s+Number(r.latlng[1]),0)/pts.length,source:'poi_centroid'};return{lat:null,lng:null,source:null}}
function creativeProjectKey(park,center){const n=String(park||'campsite').normalize('NFKC').toLowerCase().replace(/\\s+/g,' ').trim();const lat=Number.isFinite(center.lat)?center.lat.toFixed(3):'na',lng=Number.isFinite(center.lng)?center.lng.toFixed(3):'na';return n+'|'+lat+','+lng}
function creativeCanonicalDesign(){const poi=(records||[]).filter(r=>r&&!r.deleted&&Array.isArray(r.latlng)).map(r=>[String(r.layer||''),String(r.title||''),Number(r.latlng[0]).toFixed(6),Number(r.latlng[1]).toFixed(6),String(r.applicationComment||'')].join('|')).sort();const poly=(polygons||[]).filter(p=>p&&!p.deleted&&Array.isArray(p.points)&&p.points.length).map(p=>p.points.map(x=>Number(x[0]).toFixed(6)+','+Number(x[1]).toFixed(6)).join('|')).sort();return JSON.stringify({poi,poly})}
async function creativeHash(text){try{if(crypto.subtle){const bytes=new TextEncoder().encode(text),buf=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(buf),b=>b.toString(16).padStart(2,'0')).join('')}}catch{}let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return'fnv1a-'+(h>>>0).toString(16).padStart(8,'0')}
async function trackCreative(eventType){try{const center=creativeCenter(),park=creativeParkName(),projectKey=creativeProjectKey(park,center),fingerprint=await creativeHash(creativeCanonicalDesign()),active=(records||[]).filter(r=>r&&!r.deleted),existing=active.filter(r=>String(r.layer||'').startsWith('existing-')).length,added=active.filter(r=>String(r.layer||'').startsWith('new-')).length,polygonCount=(polygons||[]).filter(p=>p&&!p.deleted).length;await fetch(CREATIVE_TRACK_URL,{method:'POST',headers:{'Content-Type':'application/json','apikey':CREATIVE_TRACK_KEY},body:JSON.stringify({p_project_key:projectKey,p_park_name:park,p_center_lat:center.lat,p_center_lng:center.lng,p_center_source:center.source,p_anonymous_device_id:creativeDeviceId(),p_design_fingerprint:fingerprint,p_source_type:'creative_mode',p_event_type:String(eventType||'creative_unknown').slice(0,80),p_poi_count:active.length,p_existing_poi_count:existing,p_added_poi_count:added,p_polygon_count:polygonCount}),keepalive:true})}catch{}}
`;

  const runtimePatch=[
    'const creativeTrackingHelpers='+JSON.stringify(helpers)+';',
    "if(html.includes('function beginEditor(){'))html=html.replace('function beginEditor(){',creativeTrackingHelpers+'function beginEditor(){void trackCreative(\\\"creative_mode_open\\\");');",
    "if(html.includes('async function exportKmz(){'))html=html.replace('async function exportKmz(){','async function exportKmz(){void trackCreative(\\\"creative_mode_save\\\");');",
    "if(html.includes('function pushHistory(a){undoStack.push(a);'))html=html.replace('function pushHistory(a){undoStack.push(a);','function pushHistory(a){void trackCreative(\\\"history_\\\"+String(a?.type||\\\"unknown\\\"));undoStack.push(a);');",
    "if(html.includes('function undo(){'))html=html.replace('function undo(){','function undo(){void trackCreative(\\\"undo\\\");');",
    "if(html.includes('function redo(){'))html=html.replace('function redo(){','function redo(){void trackCreative(\\\"redo\\\");');",
    "if(html.includes(\"$('mapToggle').onclick=()=>{\"))html=html.replace(\"$('mapToggle').onclick=()=>{\",\"$('mapToggle').onclick=()=>{void trackCreative('map_toggle');\");",
    "if(html.includes(\"circlePanel.querySelectorAll('[data-extra]').forEach(b=>b.onclick=()=>{\"))html=html.replace(\"circlePanel.querySelectorAll('[data-extra]').forEach(b=>b.onclick=()=>{\",\"circlePanel.querySelectorAll('[data-extra]').forEach(b=>b.onclick=()=>{void trackCreative('distance_circle_toggle');\");",
    "if(html.includes('function addPolygonPoint(){'))html=html.replace('function addPolygonPoint(){','function addPolygonPoint(){void trackCreative(\\\"polygon_point_add\\\");');",
    "if(html.includes('function beginPolygonDeleteMode(){'))html=html.replace('function beginPolygonDeleteMode(){','function beginPolygonDeleteMode(){void trackCreative(\\\"polygon_delete_mode\\\");');",
    "if(html.includes(\"p.deleted=true;clearPolygonDeleteMode();drawAll();renderLayerPanel();snapshot();msg('ポリゴンを削除しました')\"))html=html.replace(\"p.deleted=true;clearPolygonDeleteMode();drawAll();renderLayerPanel();snapshot();msg('ポリゴンを削除しました')\",\"p.deleted=true;void trackCreative('polygon_delete');clearPolygonDeleteMode();drawAll();renderLayerPanel();snapshot();msg('ポリゴンを削除しました')\");"
  ].join('\n');

  window.applyCreativeTrackingPatch=src=>{
    if(typeof src!=='string'||!src.includes(RUNTIME_WRITE_NEEDLE))return src;
    return src.replace(RUNTIME_WRITE_NEEDLE,runtimePatch+RUNTIME_WRITE_NEEDLE);
  };
})();
