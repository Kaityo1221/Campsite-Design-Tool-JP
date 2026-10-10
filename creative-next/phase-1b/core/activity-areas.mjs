/* Creative Next O-07. Isolated, fail-closed activity-area vertex editor.
 * POI distance-circle polygons are never eligible here.
 * Output contains no writes and does not change the imported source.
 */
const PREFIX='campsite.creative.';
function stop(code,message){const e=new Error(message);e.code=code;throw e;}
const own=(place,key)=>place?.data?.filter(d=>d.name===PREFIX+key).map(d=>d.value)??[];
const pt=p=>`${p[0]},${p[1]}`;
function intersection(a,b,c,d){
 const cross=(p,q,r)=>(q[1]-p[1])*(r[0]-p[0])-(q[0]-p[0])*(r[1]-p[1]);
 const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);
 const between=(x,a,b)=>x>=Math.min(a,b)&&x<=Math.max(a,b);
 const on=(a,b,p)=>cross(a,b,p)===0&&between(p[0],a[0],b[0])&&between(p[1],a[1],b[1]);
 return (ab1===0&&on(a,b,c))||(ab2===0&&on(a,b,d))||(cd1===0&&on(c,d,a))||(cd2===0&&on(c,d,b))||((ab1>0)!==(ab2>0)&&(cd1>0)!==(cd2>0));
}
export function validateActivityPoints(points){
 if(!Array.isArray(points)||points.length<3||points.length>512)stop('AREA_VERTEX_COUNT','活動範囲の頂点は3〜512件です');
 const seen=new Set();let minLng=Infinity,maxLng=-Infinity;
 for(const p of points){
  if(!Array.isArray(p)||p.length!==2||p.some(x=>typeof x!=='number'||!Number.isFinite(x))||Math.abs(p[0])>90||Math.abs(p[1])>180)stop('AREA_COORD','頂点の緯度・経度が不正です');
  const key=pt(p);if(seen.has(key))stop('AREA_DUPLICATE','頂点の重複はできません');seen.add(key);
  minLng=Math.min(minLng,p[1]);maxLng=Math.max(maxLng,p[1]);
 }
 if(maxLng-minLng>=180)stop('AREA_DATELINE','日付変更線をまたぐ活動範囲は保留します');
 let area2=0;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];area2+=a[1]*b[0]-b[1]*a[0];
 }
 if(Math.abs(area2)<1e-13)stop('AREA_DEGENERATE','面積が極端に小さい、またはゼロです');
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
  if(j===i+1||(i===0&&j===points.length-1))continue;
  if(intersection(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))stop('AREA_INTERSECTION','活動範囲の辺が交差しています');
 }
 return points.map(p=>[...p]);
}
export function sourceActivityAreas(stage){
 const areas=stage?.places?.filter(p=>own(p,'object').length===1&&own(p,'object')[0]==='activity-area')??[];
 const ids=new Set();return areas.map(p=>{
  const id=own(p,'area-id');const ring=p.polygonGeometry?.points;
  if(id.length!==1||!id[0]||ids.has(id[0])||p.geometry!=='Polygon'||p.geometryCount!==1||p.polygonValid!==true||!Array.isArray(ring)||ring.length<4||p.polygonGeometry?.hasHoles)stop('AREA_SOURCE','元の活動範囲が未検証です');
  ids.add(id[0]);const points=ring.slice(0,-1).map(p=>[p[1],p[0]]);
  return {id:id[0],points};
 });
}
export function planActivityChange(areas,command){
 if(!Array.isArray(areas)||!command||typeof command!=='object'||!['area-move-vertex','area-add-vertex','area-delete-vertex'].includes(command.type))stop('AREA_COMMAND','不明な活動範囲編集です');
 const index=areas.findIndex(x=>x.id===command.id);if(index<0)stop('AREA_NOT_FOUND','活動範囲がありません');
 const before=areas[index].points.map(p=>[...p]);
 if(!Number.isSafeInteger(command.index)||command.index<0||command.index>=before.length)stop('AREA_VERTEX_INDEX','頂点番号が不正です');
 const after=before.map(p=>[...p]);
 if(command.type==='area-delete-vertex'){
  if(after.length<=3)stop('AREA_VERTEX_COUNT','少なくとも3頂点が必要です');after.splice(command.index,1);
 }else{
  const {lat,lng}=command;
  if(typeof lat!=='number'||typeof lng!=='number'||!Number.isFinite(lat)||!Number.isFinite(lng))stop('AREA_COORD','緯度・経度が不正です');
  if(command.type==='area-move-vertex')after[command.index]=[lat,lng];
  else after.splice(command.index+1,0,[lat,lng]);
 }
 validateActivityPoints(after);
 return {kind:'area',id:command.id,before,after,changed:JSON.stringify(before)!==JSON.stringify(after)};
}
export function plannedAreaEdits(source,active){
 if(!Array.isArray(source)||!Array.isArray(active)||source.length!==active.length)stop('AREA_SOURCE','活動範囲が削除・追加されました');
 const map=new Map();for(const a of active){if(!a||typeof a.id!=='string'||map.has(a.id))stop('AREA_ID','重複した活動範囲ID');map.set(a.id,a);}
 return source.flatMap(a=>{
  const b=map.get(a.id);if(!b)stop('AREA_SOURCE','活動範囲IDが変更されました');
  validateActivityPoints(b.points);
  return JSON.stringify(a.points)===JSON.stringify(b.points)?[]:[{id:a.id,points:b.points.map(p=>[...p])}];
 });
}
// Membership changes are explicit. A source area can be removed, but its
// original bytes remain in the journal; a fresh area cannot impersonate it.
// Old callers still use plannedAreaEdits() with its strict membership guard.
export function plannedAreaOperations(source,active){
 if(!Array.isArray(source)||!Array.isArray(active)||active.length>64)stop('AREA_LIMIT','活動範囲は最大64件です');
 const original=new Map(),current=new Map();
 for(const a of source){if(!a||typeof a.id!=='string'||!a.id||original.has(a.id))stop('AREA_SOURCE','元の活動範囲IDが不正です');original.set(a.id,a);}
 for(const a of active){
  if(!a||typeof a.id!=='string'||!a.id||a.id.length>128||current.has(a.id))stop('AREA_ID','活動範囲IDが不正または重複しています');
  if(!original.has(a.id)&&!/^area-[a-zA-Z0-9_-]+$/.test(a.id))stop('AREA_ID','新規ID形式が不正です');
  validateActivityPoints(a.points);current.set(a.id,a);
 }
 const areaEdits=[],areaAdditions=[],areaDeletions=[];
 for(const a of source){
  const b=current.get(a.id);
  if(!b){areaDeletions.push(a.id);continue;}
  if(JSON.stringify(a.points)!==JSON.stringify(b.points))areaEdits.push({id:a.id,points:b.points.map(p=>[...p])});
 }
 for(const a of active)if(!original.has(a.id))areaAdditions.push({id:a.id,points:a.points.map(p=>[...p])});
 return {areaEdits,areaAdditions,areaDeletions};
}
export function planActivityMembership(areas,command,{reservedIds=[]}={}){
 if(!Array.isArray(areas)||!command||typeof command!=='object')stop('AREA_COMMAND','活動範囲操作が不正です');
 if(command.type==='area-create'){
  if(typeof command.id!=='string'||!/^area-[a-zA-Z0-9_-]+$/.test(command.id)||command.id.length>128||reservedIds.includes(command.id)||areas.some(a=>a.id===command.id))stop('AREA_ID','新しい活動範囲IDが重複または不正です');
  const points=validateActivityPoints(command.points);
  if(areas.length>=64)stop('AREA_LIMIT','活動範囲は最大64件です');
  return {kind:'area-membership',id:command.id,before:null,after:points,changed:true};
 }
 if(command.type==='area-remove'){
  const a=areas.find(a=>a.id===command.id);
  if(!a)stop('AREA_NOT_FOUND','削除する活動範囲がありません');
  return {kind:'area-membership',id:a.id,before:a.points.map(p=>[...p]),after:null,changed:true};
 }
 stop('AREA_COMMAND','活動範囲操作が不正です');
}
function coordAttributes(node){return !!node?.attributes?.length;}
export function editableAreaGeometry(stage,xmlDoc,edit){
 const KML='http://www.opengis.net/kml/2.2';const elems=(node,name)=>Array.from(node?.childNodes??[]).filter(x=>x.nodeType===1&&x.namespaceURI===KML&&(!name||x.localName===name));
 const one=(p,n)=>elems(p,n)[0];
 const areas=sourceActivityAreas(stage),area=areas.find(a=>a.id===edit.id);
 if(!area)stop('AREA_NOT_FOUND','元データ内の活動範囲がありません');
 // Source placemark indices become stale when the exporter appends new POIs
 // to earlier KML folders. Bind to the immutable area ID in the *current* XML.
 const sourceMatches=stage.places.filter(p=>own(p,'area-id').length===1&&own(p,'area-id')[0]===edit.id);
 if(sourceMatches.length!==1||own(sourceMatches[0],'object').length!==1||own(sourceMatches[0],'object')[0]!=='activity-area')
   stop('AREA_SOURCE','元データの活動範囲IDが不正です');
 const dataValues=(pm,key)=>elems(pm,'ExtendedData').flatMap(ext=>elems(ext,'Data'))
   .filter(d=>d.getAttribute('name')===PREFIX+key)
   .map(d=>elems(d,'value')[0]?.textContent??'');
 const candidates=Array.from(xmlDoc.getElementsByTagNameNS(KML,'Placemark'))
   .filter(pm=>dataValues(pm,'area-id').includes(edit.id));
 if(candidates.length!==1)stop('AREA_SOURCE','活動範囲IDが見つからないか重複しています');
 const pm=candidates[0];
 if(dataValues(pm,'area-id').length!==1||dataValues(pm,'object').length!==1||
    dataValues(pm,'object')[0]!=='activity-area')
   stop('AREA_SOURCE','編集対象の活動範囲メタデータが不正です');
 const polys=elems(pm,'Polygon');if(polys.length!==1)stop('AREA_STRUCTURE','単一Polygon以外は編集できません');
 const poly=polys[0];
 const children=node=>Array.from(node?.childNodes??[]).filter(x=>x.nodeType===1);
 const extras=children(poly).filter(x=>x.namespaceURI!==KML||x.localName!=='outerBoundaryIs');
 if(extras.length||elems(poly,'outerBoundaryIs').length!==1||poly.attributes?.length)stop('AREA_UNSUPPORTED','元ポリゴンの特殊な構造は編集できません');
 const outer=one(poly,'outerBoundaryIs'),ring=one(outer,'LinearRing');
 if(children(outer).length!==1||elems(outer,'LinearRing').length!==1||children(ring).length!==1||elems(ring,'coordinates').length!==1||ring.attributes?.length||coordAttributes(one(ring,'coordinates')))stop('AREA_UNSUPPORTED','特殊な境界データは編集できません');
 const coord=one(ring,'coordinates');
 const raw=String(coord?.textContent||'').trim().split(/\s+/).map(x=>x.split(','));
 const dimension=raw[0]?.length;
 if(![2,3].includes(dimension)||raw.some(x=>x.length!==dimension||(dimension===3&&(Number(x[2])!==0||x[2]!==raw[0][2]))))stop('AREA_ALTITUDE_HOLD','標高付きの特殊な活動範囲は保留します');
 const points=validateActivityPoints(edit.points);
 const output=[...points,points[0]].map(([lat,lng])=>`${lng},${lat}${dimension===3?','+raw[0][2]:''}`).join(' ');
 return {coordinates:coord,text:output,points};
}
