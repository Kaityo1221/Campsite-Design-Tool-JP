/*
 * Isolated legacy Kasai Creative KMZ -> new V1 conversion candidate.
 * This is an OFFLINE converter; canApply is always false. Never writes an
 * editor store, never clears legacy localStorage, and never publishes files.
 * Only a fully diagnosed, structurally identified O-02 profile is eligible.
 */
import {stageKmlInput} from './stage-kmz.mjs';
import {diagnoseKmzCandidate} from './diagnose-kmz-candidate.mjs';
const NS='http://www.opengis.net/kml/2.2';
const PREFIX='campsite.creative.';
const FOLDERS={
 'existing-pokestop':'既存 PokéStop', 'existing-gym':'既存 Gym','existing-power':'既存 PowerSpot',
 'new-pokestop':'新規 PokéStop','new-gym':'新規 Gym','new-power':'新規 PowerSpot'
};
function stop(code,message){const e=new Error(message);e.code=code;throw e;}
function elems(parent,name){return Array.from(parent?.childNodes||[]).filter(x=>x.nodeType===1&&x.namespaceURI===NS&&(!name||x.localName===name));}
function one(p,n){return elems(p,n)[0]||null;}
function addData(doc,pm,k,v){let ext=one(pm,'ExtendedData');if(!ext){ext=doc.createElementNS(NS,'ExtendedData');pm.appendChild(ext)}const d=doc.createElementNS(NS,'Data');d.setAttribute('name',PREFIX+k);const value=doc.createElementNS(NS,'value');value.textContent=String(v);d.appendChild(value);ext.appendChild(d);}
function getData(pm,k){return elems(one(pm,'ExtendedData'),'Data').filter(d=>d.getAttribute('name')===k).map(d=>one(d,'value')?.textContent??'');}
const coordNumeric=x=>{const n=Number(x);return Number.isFinite(n)?n:null;};
function meters(a,b){return Math.hypot((a.lng-b.lng)*111320*Math.cos(a.lat*Math.PI/180),(a.lat-b.lat)*111320)}
function getPoint(p){const raw=p?.sourceGeometry?.coordinates||p?.coordinates;if(typeof raw!=='string')return null;const parts=raw.trim().split(',');if(![2,3].includes(parts.length))return null;const [lng,lat]=parts.map(coordNumeric);return Number.isFinite(lat)&&Number.isFinite(lng)?{lng,lat}:null;}
function knownGeneratedDescription(text,layer){
  if(text===undefined) return false;
  // Precisely the old export's generated strings. Any other description is
  // treated as user-authored memo; no broad text stripping is permitted.
  const m=/^説明: (POKESTOP|GYM|POWERSPOT|)<br>nextlab-layer: ([a-z-]+)$/.exec(text);
  return !!(m&&m[2]===layer);
}
function safeMemo(text,layer){
  if(text===undefined)return {memo:'',generated:false};
  if(knownGeneratedDescription(text,layer))return {memo:'',generated:true};
  if(/nextlab-layer\s*:/i.test(text)||/^説明\s*:/i.test(text))stop('LEGACY_DESCRIPTION_AMBIGUOUS','Unrecognized generated-looking description must be reviewed');
  return {memo:text,generated:false};
}
async function hashSource(bytes, cryptoProvider){
  const c=cryptoProvider||globalThis.crypto;
  if(!c?.subtle?.digest)stop('LEGACY_HASH_UNAVAILABLE','SHA-256 is required for stable legacy IDs');
  const digest=await c.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
export async function convertLegacyKasaiKmz(stage,{JSZip,DOMParser,XMLSerializer,cryptoProvider,signal}={}){
 if(signal?.aborted)stop('CANCELLED','Aborted before conversion');
 if(!JSZip||typeof DOMParser!=='function'||typeof XMLSerializer!=='function')stop('LEGACY_CONFIG','Missing ZIP/XML dependencies');
 if(!(stage?.rawSource instanceof Uint8Array)||!stage.sourceKml||stage.errors?.length)stop('LEGACY_SOURCE','Original fully staged file is required');
 const prior=diagnoseKmzCandidate(stage);
 if(prior.profile!=='LEGACY_CREATIVE_KASAI_CANDIDATE'||prior.disposition!=='HOLD'||
    prior.issues.some(x=>!['LEGACY_NOT_APPROVED_FOR_APPLY','NAME_DUPLICATE','POSITION_DUPLICATE','EXISTING_LARGE','NEW_LIMIT_EXCEEDED'].includes(x.code))||
    prior.counts.unknown||prior.counts.existing>700||!prior.counts.existing&&!prior.counts.newTotal)
   stop('LEGACY_UNSAFE','Source does not satisfy strict old Creative Kasai profile');
 const fingerprint=await hashSource(stage.rawSource,cryptoProvider);
 const xml=new DOMParser().parseFromString(stage.sourceKml,'application/xml');
 const doc=Array.from(xml.getElementsByTagNameNS(NS,'Document'));
 const placemarks=Array.from(xml.getElementsByTagNameNS(NS,'Placemark'));
 if(doc.length!==1||placemarks.length!==stage.places.length)stop('LEGACY_XML','Source differs from staged layout');
 if(getData(doc[0],PREFIX+'format').length||getData(doc[0],PREFIX+'version').length)stop('LEGACY_SCHEMA','Already has version metadata');
 if(stage.places.some(p=>(p.data||[]).some(d=>d.name.startsWith(PREFIX))))stop('LEGACY_SCHEMA','Old input contains reserved new-format POI metadata');
 const existingData=elems(doc[0],'ExtendedData');
 if(existingData.length>1)stop('LEGACY_SCHEMA','Ambiguous Document ExtendedData');
 addData(xml,doc[0],'format','creative-mode-next');addData(xml,doc[0],'version','1');
 const pois=[],circlePairs=[],other=[];
 for(let i=0;i<placemarks.length;i++){
   const p=stage.places[i],pm=placemarks[i];
   if(p.geometry==='Point'){
     const rawLayer=getData(pm,'nextlab-layer');
     if(rawLayer.length!==1||p.folder!==FOLDERS[rawLayer[0]]||p.geometryCount!==1)stop('LEGACY_LAYER','Layer/folder mismatch');
     const point=getPoint(p);if(!point)stop('LEGACY_POINT','Invalid Point');
     const layer=rawLayer[0],kind=layer.slice(layer.indexOf('-')+1),role=layer.startsWith('existing-')?'existing':'new';
     const id=`legacy-${fingerprint.slice(0,24)}-${String(i).padStart(6,'0')}`;
     const original=p.description;const {memo,generated}=safeMemo(original,layer);
     if(generated){addData(xml,pm,'legacy-description',original);const el=one(pm,'description');if(el)el.textContent=''}
     addData(xml,pm,'object','poi');addData(xml,pm,'id',id);addData(xml,pm,'role',role);addData(xml,pm,'kind',kind);
     addData(xml,pm,'title',p.name);addData(xml,pm,'memo',memo);
     // use unmodified decimal substrings; no coordinate rounding or silent shift
     const coord=p.coordinates.trim().split(',');addData(xml,pm,'lng',coord[0].trim());addData(xml,pm,'lat',coord[1].trim());
     pois.push({id,at:i,point,role,kind,title:p.name,originalDescription:original,memo,originalCoord:p.coordinates});
   } else if(p.geometry==='Polygon'&&p.legacyShapeVerified){
     other.push({at:i,pm,place:p});
   } else stop('LEGACY_GEOMETRY','Unverified Placemark must not be converted');
 }
 const ownerKeys=new Set();let circleCount=0,areaCount=0;
 for(const x of other){
   const {pm,place,at}=x;
   if(place.legacyShape==='activity-area'){
     addData(xml,pm,'object','activity-area');addData(xml,pm,'area-id',`legacy-area-${fingerprint.slice(0,24)}-${String(at).padStart(6,'0')}`);
     areaCount++;continue;
   }
   if(place.legacyShape!=='distance-circle'||!place.legacyCircle)stop('LEGACY_GEOMETRY','Unexpected legacy polygon');
   const center=place.legacyCircle.center;
   const eligible=pois.map(p=>({p,dist:meters(center,p.point)})).filter(x=>x.dist<0.2).sort((a,b)=>a.dist-b.dist);
   if(eligible.length!==1)stop('LEGACY_CIRCLE_AMBIGUOUS','Distance circle owner cannot be uniquely verified');
   const owner=eligible[0].p;const radius=place.legacyCircle.radius;const key=owner.id+'/'+radius;
   if(ownerKeys.has(key))stop('LEGACY_CIRCLE_DUPLICATE','Two circles claim the same owner/radius');
   ownerKeys.add(key);
   addData(xml,pm,'object','distance-circle');addData(xml,pm,'circle-owner-id',owner.id);addData(xml,pm,'circle-radius',radius);
   circlePairs.push({ownerId:owner.id,placemarkIndex:at,radius});circleCount++;
 }
 if(circleCount!==prior.counts.circles||areaCount!==prior.counts.activityAreas||pois.length!==prior.counts.existing+prior.counts.newTotal)
   stop('LEGACY_COUNT','Converted object count mismatch');
 if(signal?.aborted)stop('CANCELLED','Aborted before packaging');
 const xmlText=new XMLSerializer().serializeToString(xml);
 const zip=stage.sourceFormat==='kmz'?await JSZip.loadAsync(stage.rawSource,{checkCRC32:true}):new JSZip();
 zip.file(stage.sourcePath||'doc.kml',xmlText);
 const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}});
 if(signal?.aborted)stop('CANCELLED','Aborted before verification');
 const verifiedStage=await stageKmlInput(bytes,{JSZip,DOMParser,signal});
 const verification=diagnoseKmzCandidate(verifiedStage);
 if(verifiedStage.errors?.length||verification.disposition!=='READY'||verification.profile!=='NEW_V1'||
   verification.counts.existing!==prior.counts.existing||verification.counts.newTotal!==prior.counts.newTotal||
   verification.counts.circles!==circleCount||verification.counts.activityAreas!==areaCount||
   verifiedStage.places.length!==stage.places.length)stop('LEGACY_ROUNDTRIP','Re-import cannot prove complete source preservation');
 return {bytes,verification,sourceFingerprint:fingerprint,pois,circlePairs,areaCount,canApply:false};
}
