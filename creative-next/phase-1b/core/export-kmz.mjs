/*
 * Creative Next Phase 1-B: isolated export of already-audited NEW_V1 KML/KMZ.
 * Never writes to the application, storage, or browser UI. No legacy auto-upgrade.
 * This is a fail-closed source-preserving exporter, not the Creative editor.
 */
import { diagnoseKmzCandidate } from './diagnose-kmz-candidate.mjs';
import { stageKmlInput } from './stage-kmz.mjs';

const KML = 'http://www.opengis.net/kml/2.2';
const PREFIX='campsite.creative.';
const NEW_LIMIT=Object.freeze({pokestop:12,gym:8,power:5});
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

/**
 * Full-write using source XML preservation and explicit new-v1 metadata edits.
 * Every export is re-staged and re-diagnosed before returning bytes.
 * @returns {{bytes: Uint8Array, verification: object}}
 */
export async function exportNewV1Kmz(stage,{JSZip,DOMParser,XMLSerializer,edits=[],signal}={}){
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
    // A migrated old KMZ still has legacy nextlab-layer, folder and style.
    // Until the layer relocation/export contract is implemented, a kind edit
    // must not create contradictory metadata while claiming success.
    if ('kind' in edit && edit.kind!==oldKind &&
      Array.from(one(pm,'ExtendedData')?.childNodes||[]).some(n=>
        n.nodeType===1 && n.localName==='Data' && n.getAttribute('name')==='nextlab-layer'))
      stop('LEGACY_LAYER_EDIT_UNSUPPORTED','Changing old KMZ POI kind requires synchronized legacy folder/style/layer migration');
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
  // No creation or reclassification of new POIs outside available type caps.
  for(const p of planned)if(p.role==='new'&&p.kind!==meta(p.pm,'kind')&&count[p.kind]>NEW_LIMIT[p.kind])stop('NEW_KIND_LIMIT','New POI kind has no free slot');
  for(const p of planned){
    if(p.deleted){p.pm.parentNode.removeChild(p.pm);continue}
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
      report.counts.newTotal!==planned.filter(p=>!p.deleted&&p.role==='new').length)
    stop('EXPORT_ROUNDTRIP','Generated output did not pass full re-staging and diagnosis');
  if(signal?.aborted)stop('CANCELLED','Export cancelled');
  return {bytes,verification:report};
}
