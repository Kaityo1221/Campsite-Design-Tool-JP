/*
 * Isolated NEW_V1 => Phase 1-A in-memory POI store preview.
 * Requires an already verified converted KMZ. This is NOT a live import,
 * autosave migration, UI connector, or confirmation mechanism.
 */
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
import {createPoiStore} from '../../phase-1a/core/poi-store.mjs';
const P='campsite.creative.';
function stop(message){const e=new Error(message);e.code='PREVIEW_HOLD';throw e;}
function field(p,key){const a=p.data?.filter(d=>d.name===P+key)||[];if(a.length!==1)stop('Missing or repeated '+key);return a[0].value;}
function optional(p,key){const a=p.data?.filter(d=>d.name===P+key)||[];if(a.length>1)stop('Repeated '+key);return a.length?a[0].value:null;}
export function previewLegacyPoiStore(verifiedStage){
  const before=diagnoseKmzCandidate(verifiedStage);
  if(before.disposition!=='READY'||before.profile!=='NEW_V1'||before.canApply!==false||verifiedStage.errors?.length||
     !(verifiedStage.rawSource instanceof Uint8Array)||!verifiedStage.sourceKml)
      stop('Audited converted source is required');
  const records=[];
  for(let i=0;i<verifiedStage.places.length;i++){
    const p=verifiedStage.places[i];if(p.geometry!=='Point')continue;
    const rawCoords=String(p.coordinates||'').trim().split(',');
    const id=field(p,'id'),role=field(p,'role'),kind=field(p,'kind'),title=field(p,'title'),memo=field(p,'memo');
    const lat=Number(field(p,'lat')),lng=Number(field(p,'lng'));
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||!['existing','new'].includes(role)||!['pokestop','gym','power'].includes(kind)||!id||!title)stop('Invalid canonical POI');
    const record={id,role,kind,title,memo,lat,lng,deleted:false,guid:optional(p,'guid'),poiId:optional(p,'poiId'),
      metadata:{
        origin:'NEW_V1_FROM_VERIFIED_KMZ',sourceIndex:i,sourceKmlPath:verifiedStage.sourcePath,
        originalPointCoordinates:p.coordinates,
        originalDescription:optional(p,'legacy-description')??p.description??null,
        originalLayer:p.data.filter(d=>d.name==='nextlab-layer').map(d=>d.value),
        rawData:p.data.map(d=>({name:d.name,value:d.value})),
        sourceFolderPath:[...p.folderPath],sourceStyleUrl:p.styleUrl??null,
        altitudeMode:p.sourceGeometry?.altitudeMode??null,extrude:p.sourceGeometry?.extrude??null
      }
    };
    // Source byte payload is referenced separately and never serialized per POI.
    records.push(record);
  }
  const store=createPoiStore(records);
  const snap=store.snapshot();
  if(snap.records.length!==before.counts.existing+before.counts.newTotal||
    snap.counts.existing.count!==before.counts.existing||snap.counts.new.count!==before.counts.newTotal)
    stop('Canonical preview lost POIs or changed roles');
  return Object.freeze({store,records:snap.records,report:before,canApply:false,
    source:verifiedStage,sourceBytesUnchanged:true});
}
