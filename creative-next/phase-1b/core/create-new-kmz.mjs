/*
 * Phase 1-B isolated writer for newly composed canonical records with no legacy
 * source payload. Existing/source-derived records containing unknown data must
 * use a provenance-preserving importer/exporter, not this fresh-document writer.
 */
import {stageKmlInput} from './stage-kmz.mjs';
import {diagnoseKmzCandidate} from './diagnose-kmz-candidate.mjs';
const NS='http://www.opengis.net/kml/2.2',P='campsite.creative.';
const LAYERS=[['existing','pokestop','既存 PokéStop'],['existing','gym','既存 Gym'],['existing','power','既存 PowerSpot'],
 ['new','pokestop','新規 PokéStop'],['new','gym','新規 Gym'],['new','power','新規 PowerSpot']];
function stop(message){const e=new Error(message);e.code='CREATE_KMZ_INVALID';throw e}
function element(doc,parent,tag,value){const node=doc.createElementNS(NS,tag);if(value!==undefined)node.textContent=String(value);parent.appendChild(node);return node}
function addData(doc,parent,name,value){const data=element(doc,parent,'Data');data.setAttribute('name',P+name);element(doc,data,'value',value)}
function addMetadata(doc,parent,data){const ext=element(doc,parent,'ExtendedData');for(const [key,val] of Object.entries(data))if(val!==undefined)addData(doc,ext,key,val)}
function validText(value){return typeof value==='string'&&value.length>0}
function validCoord(value,max){return typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=max}
export async function createFreshV1Kmz(snapshot,{JSZip,DOMParser,XMLSerializer,signal,documentName='Campsite'}={}){
  if(signal?.aborted)stop('Cancelled');
  if(!JSZip||typeof DOMParser!=='function'||typeof XMLSerializer!=='function')stop('Missing XML and ZIP dependencies');
  if(!snapshot||!Array.isArray(snapshot.records)||!Array.isArray(snapshot.activityAreas)||!validText(documentName))stop('Incomplete new project');
  const ids=new Set(),areaIds=new Set();let existing=0,live=0;
  for(const r of snapshot.records){
    if(!r||!validText(r.id)||ids.has(r.id)||!['existing','new'].includes(r.role)||
      !['pokestop','gym','power'].includes(r.kind)||!validText(r.title)||
      !validCoord(r.lat,90)||!validCoord(r.lng,180)||
      (r.memo!==undefined&&typeof r.memo!=='string')||
      (r.guid!==undefined&&typeof r.guid!=='string')||
      (r.poiId!==undefined&&typeof r.poiId!=='string')||
      (r.deleted!==undefined&&typeof r.deleted!=='boolean'))stop('Invalid or duplicate canonical record');
    if(r.sourceGeometry||r.metadata||r.sourcePlacemarkXml||r.unknownAttributes)
      stop('Source-derived data requires provenance-preserving writer');
    ids.add(r.id);if(r.deleted!==true){live++;if(r.role==='existing')existing++}
  }
  if(existing>700||live===0)stop('Existing cap reached or empty project');
  for(const a of snapshot.activityAreas){
    if(!a||!validText(a.id)||areaIds.has(a.id)||!Array.isArray(a.points)||a.points.length<3||
      !a.points.every(p=>Array.isArray(p)&&p.length===2&&validCoord(p[0],90)&&validCoord(p[1],180))||
      a.sourceGeometry||a.metadata||a.sourcePlacemarkXml)stop('Invalid or source-derived activity area');
    areaIds.add(a.id);
  }
  const xml=new DOMParser().parseFromString('<kml xmlns="'+NS+'"><Document/></kml>','application/xml');
  const doc=xml.getElementsByTagNameNS(NS,'Document')[0];if(!doc)stop('No KML document');
  element(xml,doc,'name',documentName);
  addMetadata(xml,doc,{format:'creative-mode-next',version:'1'});
  for(const [role,kind,label] of LAYERS){
    const folder=element(xml,doc,'Folder');element(xml,folder,'name',label);
    for(const r of snapshot.records.filter(x=>x.deleted!==true&&x.role===role&&x.kind===kind)){
      const pm=element(xml,folder,'Placemark');element(xml,pm,'name',r.title);
      element(xml,pm,'description',r.memo??'');
      addMetadata(xml,pm,{object:'poi',id:r.id,role:r.role,kind:r.kind,title:r.title,memo:r.memo??'',lat:r.lat,lng:r.lng,guid:r.guid,poiId:r.poiId});
      const point=element(xml,pm,'Point');element(xml,point,'coordinates',String(r.lng)+','+String(r.lat));
    }
  }
  const areas=element(xml,doc,'Folder');element(xml,areas,'name','ポリゴン');
  for(const area of snapshot.activityAreas){
    const pm=element(xml,areas,'Placemark');element(xml,pm,'name','活動範囲');
    addMetadata(xml,pm,{object:'activity-area','area-id':area.id});
    const poly=element(xml,pm,'Polygon');const outer=element(xml,poly,'outerBoundaryIs');const ring=element(xml,outer,'LinearRing');
    const pts=[...area.points,area.points[0]];
    element(xml,ring,'coordinates',pts.map(p=>String(p[1])+','+String(p[0])).join(' '));
  }
  if(signal?.aborted)stop('Cancelled');
  const zip=new JSZip();zip.file('doc.kml',new XMLSerializer().serializeToString(xml));
  const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  const re=await stageKmlInput(bytes,{JSZip,DOMParser,signal});const verification=diagnoseKmzCandidate(re);
  if(re.errors.length||verification.disposition!=='READY'||verification.profile!=='NEW_V1'||
    verification.counts.existing!==existing||verification.counts.newTotal!==live-existing||
    verification.counts.activityAreas!==snapshot.activityAreas.length)stop('Self-check failed; output discarded');
  if(signal?.aborted)stop('Cancelled');
  return {bytes,verification};
}