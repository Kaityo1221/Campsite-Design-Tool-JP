/*
 * Creative Next Phase 1-B: isolated export of already-audited NEW_V1 KML/KMZ.
 * Never writes to the application, storage, or browser UI. No legacy auto-upgrade.
 * This is a fail-closed source-preserving exporter, not the Creative editor.
 */
import { diagnoseKmzCandidate } from './diagnose-kmz-candidate.mjs';
import { stageKmlInput } from './stage-kmz.mjs';
import {indexDependentCircles,circleRingAt} from './dependent-circles.mjs';

const KML = 'http://www.opengis.net/kml/2.2';
const PREFIX='campsite.creative.';
const NEW_LIMIT=Object.freeze({pokestop:12,gym:8,power:5});
const FOLDER_LABEL={
  'existing-pokestop':'既存 PokéStop','existing-gym':'既存 Gym','existing-power':'既存 PowerSpot',
  'new-pokestop':'新規 PokéStop','new-gym':'新規 Gym','new-power':'新規 PowerSpot'
};
function stop(code,message){const e=new Error(message);e.code=code;throw e}
function direct(parent,name){return Array.from(parent?.childNodes||[]).filter(x=>x.nodeType===1&&x.namespaceURI===KML&&x.localName===name)}
function one(parent,name){return direct(parent,name)[0]||null}
function meta(parent,name){
  const found=[];
  for(const e of direct(parent,'ExtendedData'))for(const d of direct(e,'Data'))if(d.getAttribute('name')===PREFIX+name)found.push(direct(d,'value')[0]?.textContent??'');
  return found.length===1?found[0]:null;
}
function setMeta(doc,pm,name,value){
  const ext=one(pm,'ExtendedData');
  if(!ext)stop('EXPORT_SCHEMA','Expected existing ExtendedData for '+name);
  const entries=direct(ext,'Data').filter(d=>d.getAttribute('name')===PREFIX+name);
  if(entries.length!==1)stop('EXPORT_SCHEMA','Missing/duplicate '+name);
  const d=entries[0],v=one(d,'value');
  if(!v)stop('EXPORT_SCHEMA','Missing Data value for '+name);
  v.textContent=String(value);
}
function setDirectText(parent,name,value){
  const el=one(parent,name);
  if(!el)stop('EXPORT_SCHEMA','Expected <'+name+'>');
  el.textContent=String(value);
}
function decimal(value){
  if(typeof value==='number'){
    if(!Number.isFinite(value))stop('EXPORT_POSITION','Nonfinite coordinate');
    return String(value);
  }
  if(typeof value!=='string'||!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()))stop('EXPORT_POSITION','Invalid decimal coordinate');
  if(!Number.isFinite(Number(value)))stop('EXPORT_POSITION','Coordinate out of range');
  return value.trim();
}
function pointCoordinate(place){
  const source=String(place.sourceGeometry?.coordinates??'').trim();
  const parts=source.split(',');
  if(parts.length<2||parts.length>3)stop('EXPORT_POSITION','Original coordinate invalid');
  return parts;
}
function asEditList(edits){
  if(!Array.isArray(edits))stop('EXPORT_EDITS','Edits must be an array');
  const map=new Map();
  for(const e of edits){
    if(!e||typeof e!=='object'||Array.isArray(e)||typeof e.id!=='string'||!e.id||map.has(e.id))stop('EXPORT_EDITS','Bad or repeated edit id');
    for(const k of Object.keys(e))if(!['id','title','memo','kind','lat','lng','deleted'].includes(k))stop('EXPORT_EDITS','Unsupported edit field '+k);
    if(('lat' in e)!==('lng' in e))stop('EXPORT_EDITS','New positions require both lat and lng');
    map.set(e.id,e);
  }
  return map;
}
function element(doc,parent,name,value){
  const e=doc.createElementNS(KML,name);if(value!==undefined)e.textContent=String(value);
  parent.appendChild(e);return e;
}
function putData(doc,ext,key,value){const d=element(doc,ext,'Data');d.setAttribute('name',PREFIX+key);element(doc,d,'value',value);}
function directDocument(xml){
  const documents=Array.from(xml.getElementsByTagNameNS(KML,'Document'));
  if(documents.length!==1)return stop('EXPORT_STRUCTURE','One source Document is required');
  return documents[0];
}
function existingFolder(doc,label){
  const folders=direct(doc,'Folder').filter(f=>one(f,'name')?.textContent===label);
  if(folders.length>1)stop('EXPORT_FOLDER_AMBIGUOUS','Repeated layer folder '+label);
  return folders[0]||null;
}
function ensureFolder(xml,doc,label){
  let f=existingFolder(doc,label);
  if(!f){f=element(xml,doc,'Folder');element(xml,f,'name',label)}
  return f;
}
function legacyLayer(pm){
  const items=direct(one(pm,'ExtendedData'),'Data').filter(d=>d.getAttribute('name')==='nextlab-layer');
  if(items.length>1)stop('EXPORT_LAYER','Repeated legacy layer');
  if(!items.length)return null;
  if(direct(items[0],'value').length!==1)stop('EXPORT_LAYER','Invalid legacy layer');
  return {value:one(items[0],'value')?.textContent,node:one(items[0],'value')};
}
function verifiedStyle(doc,layer){
  const styles=direct(doc,'Style').filter(x=>x.getAttribute('id')==='creative-'+layer);
  if(styles.length!==1)stop('EXPORT_STYLE_HOLD','Target old-style icon is not uniquely defined');
  return '#creative-'+layer;
}
function validateAdditions(additions,originalIds){
  if(!Array.isArray(additions))stop('EXPORT_ADD','Additions must be an array');
  const ids=new Set();
  for(const p of additions){
    if(!p||typeof p!=='object'||Array.isArray(p)||
       Object.keys(p).some(k=>!['id','role','kind','title','memo','lat','lng','deleted','guid','poiId','metadata'].includes(k))||
       typeof p.id!=='string'||!p.id||originalIds.has(p.id)||ids.has(p.id)||
       p.role!=='new'||!Object.hasOwn(NEW_LIMIT,p.kind)||
       typeof p.title!=='string'||!p.title.trim()||typeof p.memo!=='string'||
       p.deleted!==false||p.guid!==null||p.poiId!==null||
       !p.metadata||typeof p.metadata!=='object'||Array.isArray(p.metadata)||Object.keys(p.metadata).length||
       typeof p.lat!=='number'||!Number.isFinite(p.lat)||Math.abs(p.lat)>90||
       typeof p.lng!=='number'||!Number.isFinite(p.lng)||Math.abs(p.lng)>180)
      stop('EXPORT_ADD','New POI must be canonical, active, source-free and within coordinate bounds');
    // A POI circle is generated for every new addition. Avoid unsupported
    // high-latitude circles crossing the world coordinate seam.
    circleRingAt(p.lat,p.lng,50);
    ids.add(p.id);
  }
  return additions;
}
function plannedKindMove(doc,pm,role,kind){
  const currentLayer=role+'-'+meta(pm,'kind'),targetLayer=role+'-'+kind;
  const originalFolder=existingFolder(doc,FOLDER_LABEL[currentLayer]);
  const targetFolder=existingFolder(doc,FOLDER_LABEL[targetLayer]);
  const oldLayer=legacyLayer(pm);
  if(!oldLayer&&pm.parentNode===doc&&!originalFolder){
    if(one(pm,'styleUrl')?.textContent?.startsWith('#creative-'))stop('EXPORT_STYLE_HOLD','Unrecognized old icon reference');
    return null;
  }
  if(!originalFolder||pm.parentNode!==originalFolder||!targetFolder)
    stop('EXPORT_FOLDER_HOLD','Cannot prove matching original and destination folders');
  if(oldLayer){
    if(oldLayer.value!==currentLayer||one(pm,'styleUrl')?.textContent!=='#creative-'+currentLayer)
      stop('EXPORT_LAYER_HOLD','Original legacy layer and style conflict');
    verifiedStyle(doc,targetLayer);
  }else if(one(pm,'styleUrl')?.textContent?.startsWith('#creative-'))
    stop('EXPORT_STYLE_HOLD','Unrecognized old icon reference');
  return {pm,folder:targetFolder,targetLayer,oldLayer};
}

// This synchronous preflight prevents the UI from accepting a kind edit which
// the source-preserving exporter will reject later. The exporter checks again.
export function assertSafeKindEdit(stage,{DOMParser},id,kind){
  if(typeof DOMParser!=='function'||!stage?.sourceKml||!['pokestop','gym','power'].includes(kind))
    stop('EXPORT_KIND','Verified source and known kind required');
  const xml=new DOMParser().parseFromString(stage.sourceKml,'application/xml');
  const doc=directDocument(xml),placemarks=Array.from(xml.getElementsByTagNameNS(KML,'Placemark'));
  if(placemarks.length!==stage.places.length)stop('EXPORT_SOURCE','Source object count changed');
  const index=stage.places.findIndex(p=>p.geometry==='Point'&&p.data.some(d=>d.name===PREFIX+'id'&&d.value===id));
  if(index<0)stop('EXPORT_SOURCE','Source POI not found for kind edit');
  const pm=placemarks[index],role=meta(pm,'role');
  if(kind!==meta(pm,'kind'))plannedKindMove(doc,pm,role,kind);
  return true;
}

/**
 * Full-write using source XML preservation and explicit new-v1 metadata edits.
 * Every export is re-staged and re-diagnosed before returning bytes.
 * @returns {{bytes: Uint8Array, verification: object}}
 */
export async function exportNewV1Kmz(stage,{JSZip,DOMParser,XMLSerializer,edits=[],additions=[],signal}={}){
  if(signal?.aborted)stop('CANCELLED','Export cancelled');
  if(!JSZip||typeof DOMParser!=='function'||typeof XMLSerializer!=='function')stop('EXPORT_CONFIG','XML and ZIP dependencies required');
  if(!stage?.sourceKml||!(stage.rawSource instanceof Uint8Array)||stage.audit?.unknownInformationPreserved!==true)stop('EXPORT_SOURCE','Original verified source unavailable');
  const before=diagnoseKmzCandidate(stage);
  if(before.disposition!=='READY'||before.profile!=='NEW_V1'||stage.errors?.length)stop('EXPORT_HOLD','Only verified NEW_V1 READY input can be exported');
  const requested=asEditList(edits);
  // The input has already passed the independently bounded XML staging parser.
  // xmldom >=0.9 rejects the older `errorHandler` constructor option.
  const xml=new DOMParser().parseFromString(stage.sourceKml,'application/xml');
  if(!xml?.documentElement||xml.documentElement.localName!=='kml'||
      xml.documentElement.namespaceURI!==KML||xml.getElementsByTagName('parsererror').length)
    stop('EXPORT_XML','Invalid source XML');
  const placemarks=Array.from(xml.getElementsByTagNameNS(KML,'Placemark'));
  if(placemarks.length!==stage.places.length)stop('EXPORT_SOURCE','Staging count differs from source XML');
  const dependents=indexDependentCircles(stage);
  const doc=directDocument(xml);
  const originalIds=new Set(stage.places.filter(p=>p.geometry==='Point').map(p=>p.data.find(d=>d.name===PREFIX+'id')?.value));
  validateAdditions(additions,originalIds);
  const count={pokestop:0,gym:0,power:0};
  const planned=[];const used=new Set();
  for(let i=0;i<placemarks.length;i++){
    const place=stage.places[i],pm=placemarks[i];
    if(place.geometry!=='Point')continue;
    const id=meta(pm,'id');
    if(!id||id!==place.data.find(d=>d.name===PREFIX+'id')?.value)stop('EXPORT_SOURCE','POI order/ID changed');
    const edit=requested.get(id)||{};
    used.add(id);
    if(edit.deleted!==undefined&&typeof edit.deleted!=='boolean')stop('EXPORT_EDITS','deleted must be boolean');
    const role=meta(pm,'role'),oldKind=meta(pm,'kind');
    if(role!=='new'&&(('lat' in edit)||('lng' in edit)))stop('EXISTING_POSITION_LOCKED','Existing POIs cannot move');
    if('kind' in edit&&(!['pokestop','gym','power'].includes(edit.kind)))stop('EXPORT_EDITS','Unknown kind');
    const kind=edit.kind??oldKind;
    if('title' in edit&&(typeof edit.title!=='string'||!edit.title.length))stop('EXPORT_EDITS','Invalid title');
    if('memo' in edit&&typeof edit.memo!=='string')stop('EXPORT_EDITS','Invalid memo');
    let lng,lat;
    if('lat' in edit){
      lat=decimal(edit.lat);lng=decimal(edit.lng);
      if(Math.abs(Number(lat))>90||Math.abs(Number(lng))>180)stop('EXPORT_POSITION','Outside geographic range');
      const parts=pointCoordinate(place);
      if((parts.length===3 && Number(parts[2])!==0)||place.sourceGeometry?.altitudeMode||place.sourceGeometry?.extrude)
        stop('EXPORT_ALTITUDE_LOCKED','Moving POI with meaningful altitude needs a separate approved conversion');
    }
    const deleted=edit.deleted===true;
    if(!deleted&&role==='new')count[kind]++;
    planned.push({pm,place,id,role,kind,edit,lat,lng,deleted});
  }
  for(const id of requested.keys())if(!used.has(id))stop('EXPORT_EDITS','Unknown POI ID '+id);
  for(const p of additions)count[p.kind]++;
  // New POI additions and reclassifications must respect all active caps.
  if(additions.length&&(Object.values(count).reduce((x,y)=>x+y,0)>25||
     Object.keys(count).some(k=>count[k]>NEW_LIMIT[k]&&additions.some(p=>p.kind===k))))
    stop('NEW_ADD_LIMIT','New POI addition exceeds a global or per-kind limit');
  for(const p of planned)if(p.role==='new'&&p.kind!==meta(p.pm,'kind')&&count[p.kind]>NEW_LIMIT[p.kind])stop('NEW_KIND_LIMIT','New POI kind has no free slot');
  const moves=[];
  for(const p of planned){
    if(p.deleted||p.kind===meta(p.pm,'kind'))continue;
    const move=plannedKindMove(doc,p.pm,p.role,p.kind);
    if(move)moves.push(move);
  }
  let removedCircles=0;
  // Source Polygon rings are only updated when their owner is explicitly moved.
  // Before mutating XML, prove all dependent polygon paths and altitudes are safe.
  const circleUpdates=[];
  for(const p of planned){
    const attached=dependents.get(p.id)||[];
    for(const c of attached){
      const circlePm=placemarks[c.index];
      if(!circlePm||meta(circlePm,'object')!=='distance-circle'||
         meta(circlePm,'circle-owner-id')!==p.id||Number(meta(circlePm,'circle-radius'))!==c.radius)
        stop('CIRCLE_SOURCE','Circle ownership changed during export');
      if(p.deleted){removedCircles++;continue;}
      if(!('lat' in p.edit))continue;
      const polygon=one(circlePm,'Polygon');
      if(!polygon||direct(polygon,'innerBoundaryIs').length!==0||direct(polygon,'outerBoundaryIs').length!==1||
         Array.from(polygon.children||[]).some(node=>node.namespaceURI!==KML||node.localName!=='outerBoundaryIs'))
        stop('CIRCLE_GEOMETRY_HOLD','Cannot safely edit a polygon with unknown or inner boundaries');
      const boundary=one(polygon,'outerBoundaryIs');
      if(direct(boundary,'LinearRing').length!==1)stop('CIRCLE_GEOMETRY_HOLD','Circle must have exactly one ring');
      const ring=one(boundary,'LinearRing');
      if(direct(ring,'coordinates').length!==1||Array.from(ring.children||[]).some(node=>node.namespaceURI!==KML||node.localName!=='coordinates'))
        stop('CIRCLE_GEOMETRY_HOLD','Unknown ring geometry cannot move');
      const coord=one(ring,'coordinates');
      const vertices=String(coord.textContent).trim().split(/\s+/);
      if(vertices.length!==49||vertices.some(x=>{
        const parts=x.split(',');return parts.length<2||parts.length>3||parts.some(v=>!Number.isFinite(Number(v)))||
          (parts.length===3&&Number(parts[2])!==0);
      }))stop('CIRCLE_ALTITUDE_HOLD','Circle has unsupported altitude or vertices');
      circleUpdates.push({coord,text:circleRingAt(Number(p.lat),Number(p.lng),c.radius)});
    }
  }
  for(const p of planned){
    if(p.deleted){
      p.pm.parentNode.removeChild(p.pm);
      for(const c of dependents.get(p.id)||[]){const related=placemarks[c.index];related.parentNode.removeChild(related)}
      continue;
    }
    if('title' in p.edit){setMeta(xml,p.pm,'title',p.edit.title);setDirectText(p.pm,'name',p.edit.title)}
    if('memo' in p.edit){setMeta(xml,p.pm,'memo',p.edit.memo);
      const desc=one(p.pm,'description');
      if(desc)desc.textContent=p.edit.memo;
      else{const node=xml.createElementNS(KML,'description');node.textContent=p.edit.memo;p.pm.insertBefore(node,one(p.pm,'ExtendedData'));}
    }
    if('kind' in p.edit)setMeta(xml,p.pm,'kind',p.kind);
    if('lat' in p.edit){
      setMeta(xml,p.pm,'lat',p.lat);setMeta(xml,p.pm,'lng',p.lng);
      const point=one(p.pm,'Point');if(!point)stop('EXPORT_SOURCE','Missing direct Point geometry');
      const unsupported=Array.from(point.childNodes||[]).some(n=>n.nodeType===1&&
        (n.namespaceURI!==KML||!['coordinates','altitudeMode','extrude'].includes(n.localName)));
      if(unsupported)stop('EXPORT_ALTITUDE_LOCKED','Point has unrecognized coordinate-related attributes; moving would be unsafe');
      const coords=one(point,'coordinates');if(!coords)stop('EXPORT_SOURCE','Missing Point coordinates');
      const old=pointCoordinate(p.place);
      coords.textContent=p.lng+','+p.lat+(old.length===3?','+old[2]:'');
    }
  }
  for(const m of moves){
    if(m.oldLayer){m.oldLayer.node.textContent=m.targetLayer;setDirectText(m.pm,'styleUrl',verifiedStyle(doc,m.targetLayer));}
    m.folder.appendChild(m.pm);
  }
  for(const p of additions){
    const layer='new-'+p.kind,folder=ensureFolder(xml,doc,FOLDER_LABEL[layer]);
    const pm=element(xml,folder,'Placemark');element(xml,pm,'name',p.title);element(xml,pm,'description',p.memo);
    const ext=element(xml,pm,'ExtendedData');
    for(const [k,v] of Object.entries({object:'poi',id:p.id,role:'new',kind:p.kind,title:p.title,memo:p.memo,lat:p.lat,lng:p.lng}))putData(xml,ext,k,v);
    const style=direct(doc,'Style').filter(x=>x.getAttribute('id')==='creative-'+layer);
    if(style.length>1)stop('EXPORT_STYLE_HOLD','Repeated target style');
    if(style.length===1){const d=element(xml,ext,'Data');d.setAttribute('name','nextlab-layer');element(xml,d,'value',layer);element(xml,pm,'styleUrl','#creative-'+layer);}
    const point=element(xml,pm,'Point');element(xml,point,'coordinates',String(p.lng)+','+String(p.lat));
    const circleFolder=ensureFolder(xml,doc,'50m サークル');
    const c=element(xml,circleFolder,'Placemark');element(xml,c,'name','50m '+p.title);
    const cext=element(xml,c,'ExtendedData');
    for(const [k,v] of Object.entries({object:'distance-circle','circle-owner-id':p.id,'circle-radius':'50'}))putData(xml,cext,k,v);
    const polygon=element(xml,c,'Polygon'),outer=element(xml,polygon,'outerBoundaryIs'),ring=element(xml,outer,'LinearRing');
    element(xml,ring,'coordinates',circleRingAt(p.lat,p.lng,50));
  }
  for(const {coord,text} of circleUpdates)coord.textContent=text;
  if(signal?.aborted)stop('CANCELLED','Export cancelled');
  const xmlText=new XMLSerializer().serializeToString(xml);
  const zip=stage.sourceFormat==='kmz' ? await JSZip.loadAsync(stage.rawSource,{checkCRC32:true}) : new JSZip();
  if(signal?.aborted)stop('CANCELLED','Export cancelled');
  zip.file(stage.sourcePath||'doc.kml',xmlText);
  const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}});
  // Do not claim success unless exactly this output can be imported safely again.
  const verified=await stageKmlInput(bytes,{JSZip,DOMParser,signal});
  const report=diagnoseKmzCandidate(verified);
  if(report.disposition!=='READY'||report.profile!=='NEW_V1'||verified.errors.length||
      report.counts.existing!==before.counts.existing-planned.filter(p=>p.deleted&&p.role==='existing').length||
      report.counts.newTotal!==planned.filter(p=>!p.deleted&&p.role==='new').length+additions.length||
      report.counts.circles!==before.counts.circles-removedCircles+additions.length||
      report.counts.activityAreas!==before.counts.activityAreas||
      verified.places.length!==stage.places.length-planned.filter(p=>p.deleted).length-removedCircles+2*additions.length)
    stop('EXPORT_ROUNDTRIP','Generated output did not pass full re-staging and diagnosis');
  if(signal?.aborted)stop('CANCELLED','Export cancelled');
  return {bytes,verification:report};
}
