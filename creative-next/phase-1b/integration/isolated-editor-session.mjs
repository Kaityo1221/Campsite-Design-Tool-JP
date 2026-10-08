/*
 * NON-PRODUCTION: explicit-consent, source-bearing Creative Next editor session.
 * No legacy storage access and no automatic application or persistence.
 * Map/UI binding remains a separate, isolated preview step.
 */
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
import {convertLegacyKasaiKmz} from '../core/legacy-kasai-convert.mjs';
import {previewLegacyPoiStore} from './legacy-poi-preview.mjs';
import {exportNewV1Kmz} from '../core/export-kmz.mjs';
import {createCreativeSaveJournal} from '../core/journal-save.mjs';
import {indexDependentCircles,circleOverlay} from '../core/dependent-circles.mjs';
const PREFIX='campsite.creative.';
function error(code,message){let e=new Error(message);e.code=code;return e;}
function b64(bytes){let str='';for(let i=0;i<bytes.length;i+=32768)str+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(str);}
function from64(value){if(typeof value!=='string'||!value||!/^[A-Za-z0-9+/]+={0,2}$/.test(value)||value.length%4!==0)throw error('DRAFT_SOURCE','Invalid source archive encoding');let s=atob(value),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a;}
function get(p,key){const values=p.data?.filter(d=>d.name===PREFIX+key)||[];return values.length===1?values[0].value:null;}
function circles(stage){return new Set(indexDependentCircles(stage).keys());}
function areas(stage){return stage.places.filter(p=>get(p,'object')==='activity-area').map(p=>{
 const pts=p.polygonGeometry?.points;
 if(!Array.isArray(pts)||pts.length<4||!p.polygonValid)throw error('AREA_UNVERIFIED','Unverified activity-area geometry');
 const points=pts.slice(0,-1).map(x=>[x[1],x[0]]);
 return {id:get(p,'area-id'),points};
});}
function editableDiff(stage,records){
 const originals=new Map(stage.places.filter(p=>p.geometry==='Point').map(p=>[get(p,'id'),p]));
 if(originals.size!==records.length)throw error('SOURCE_MISMATCH','Record count diverges from original source; additions require a separate export contract');
 const owned=circles(stage), edits=[];
 for(const r of records){
  const p=originals.get(r.id);if(!p)throw error('SOURCE_MISMATCH','POI missing from original source');
  if(r.role!==get(p,'role'))throw error('ROLE_CHANGED','POI identity cannot change');
  const edit={id:r.id};let changed=false;
  if(r.title!==get(p,'title')){edit.title=r.title;changed=true;}
  if(r.memo!==get(p,'memo')){edit.memo=r.memo;changed=true;}
  if(r.kind!==get(p,'kind')){
   if(p.data.some(d=>d.name==='nextlab-layer'))throw error('LAYER_MIGRATION_HOLD','Old layer kind changes are not supported safely');
   edit.kind=r.kind;changed=true;
  }
  if(r.lat!==Number(get(p,'lat'))||r.lng!==Number(get(p,'lng'))){
   edit.lat=r.lat;edit.lng=r.lng;changed=true;
  }
  if(r.deleted){
   edit.deleted=true;changed=true;
  }
  if(changed)edits.push(edit);
 }
 return edits;
}
export function createIsolatedEditorSession({JSZip,DOMParser,XMLSerializer,storage=null,cryptoProvider=globalThis.crypto,namespace='campsite-creative-next-v1-preview'}={}){
 const deps={JSZip,DOMParser,XMLSerializer,cryptoProvider};
 const journal=storage?createCreativeSaveJournal({storage,namespace,subtle:cryptoProvider?.subtle}):null;
 let pending=null,active=null,revision=null,recoveredFallback=false,prepareGeneration=0;
 const view=()=>active?.store.snapshot()??null;
 const state=()=>{
  const records=view()?.records??[];
  const visibleCircles=active?circleOverlay(active.stage,records):[];
  return {hasPending:!!pending,hasActive:!!active,counts:view()?.counts??null,history:view()?.history??null,records,
    circles:visibleCircles,shapes:active?{...active.report.counts,circles:visibleCircles.length}:null,
    areas:active?.shapeAreas??[],hasUnsavedSource:!!active?.stage,revision,sourceIsolated:true,recoveredFallback};
 };
 async function audited(stage){const diagnosis=diagnoseKmzCandidate(stage);if(stage.errors?.length||diagnosis.disposition!=='READY'||diagnosis.profile!=='NEW_V1')throw error('IMPORT_HOLD','Staged source cannot be safely used for the isolated editor');return {stage,diagnosis};}
 async function prepare(input,{signal}={}){
  const ticket=++prepareGeneration;pending=null; // Never preserve an older candidate after selection.
  const current=()=>{if(ticket!==prepareGeneration)throw error('PREPARE_STALE','A newer file selection or cancellation superseded this request');};
  const first=await stageKmlInput(input,{...deps,signal});current();const initial=diagnoseKmzCandidate(first);
  if(first.errors?.length||initial.disposition==='REJECT')return {status:'REJECT',issues:[...first.errors,...initial.issues],canApply:false};
  let converted=false;let next=first;
  if(initial.profile==='LEGACY_CREATIVE_KASAI_CANDIDATE'&&initial.disposition==='HOLD'){
    try{const candidate=await convertLegacyKasaiKmz(first,{...deps,signal});next=await stageKmlInput(candidate.bytes,{...deps,signal});current();converted=true;}
    catch(e){return {status:'HOLD',issues:[{code:e.code||'LEGACY_HOLD',message:e.message},...initial.issues],canApply:false};}
  } else if(initial.disposition!=='READY'||initial.profile!=='NEW_V1')return {status:'HOLD',issues:initial.issues,canApply:false};
  try {await audited(next);current();const preview=previewLegacyPoiStore(next);const shapeAreas=areas(next);pending={stage:next,preview,shapeAreas,converted};
    return {status:'REVIEW',counts:preview.report.counts,converted,canApply:false,message:'No changes applied; explicit user confirmation is required'};
  } catch(e){return {status:'HOLD',issues:[{code:e.code||'IMPORT_HOLD',message:e.message}],canApply:false};}
 }
 function discardPending(){prepareGeneration++;pending=null;return {ok:true,applied:false};}
 function acceptPrepared({confirmed=false}={}){
  if(!pending)throw error('IMPORT_NOT_READY','No verified import pending');
  if(confirmed!==true)return {ok:false,applied:false};
  const next={...pending,store:pending.preview.store,report:pending.preview.report};
  active=next;pending=null;prepareGeneration++;revision=null;recoveredFallback=false;
  return {ok:true,applied:true,counts:active.report.counts,history:active.store.snapshot().history};
 }
 function command(value,{confirmed=false}={}){
  if(!active)throw error('NO_EDITOR','No confirmed editor session');
  if(confirmed!==true)return {ok:true,changed:false,cancelled:true};
  if(value?.type==='add')throw error('SOURCE_ADD_HOLD','Adding POIs to an imported KMZ requires source-aware geometry insertion');
  const snap=active.store.snapshot(),poi=snap.records.find(p=>p.id===value?.id);
  if(!poi)throw error('POI_NOT_FOUND','POI not found');
  const changingLocation=value.type==='move'||(value.type==='edit'&&('lat' in (value.patch||{})||'lng' in (value.patch||{})));
  if(changingLocation&&circles(active.stage).has(poi.id)){
    const original=active.stage.places.find(p=>get(p,'id')===poi.id);
    if(poi.role==='existing')throw error('EXISTING_POSITION_LOCKED','Existing POIs cannot move');
    const raw=String(original?.sourceGeometry?.coordinates||'').trim().split(',');
    if(raw.length===3&&Number(raw[2])!==0||original?.sourceGeometry?.altitudeMode||original?.sourceGeometry?.extrude)
      throw error('CIRCLE_ALTITUDE_HOLD','Circle/POI position with meaningful altitude cannot move');
  }
  if((value.type==='change-kind'||(value.type==='edit'&&'kind' in (value.patch||{})))&&poi.metadata.originalLayer?.length){
    const newKind=value.type==='change-kind'?value.kind:value.patch.kind;
    if(newKind!==poi.kind)throw error('LAYER_MIGRATION_HOLD','Legacy layer changes need synchronized folder/style migration');
  }
  const result=active.store.execute(value,{confirmed:true});
  if(result.ok&&result.changed){try{editableDiff(active.stage,active.store.snapshot().records)}catch(e){active.store.undo();throw e;}}
  return result;
 }
 const undo=()=>{if(!active)throw error('NO_EDITOR','No editor');return active.store.undo();};
 const redo=()=>{if(!active)throw error('NO_EDITOR','No editor');return active.store.redo();};
 async function exportKmz({signal}={}){
  if(!active)throw error('NO_EDITOR','No confirmed editor');
  const edits=editableDiff(active.stage,active.store.snapshot().records);
  return exportNewV1Kmz(active.stage,{...deps,edits,signal});
 }
 async function saveDraft(){
  if(!journal||!active)throw error('SAVE_UNAVAILABLE','No initialized draft journal or editor');
  if(recoveredFallback)throw error('SAVE_RECOVERY_REQUIRED','Recovery is read-only until a separate verified repair workflow');
  const records=active.store.snapshot().records;
  // Refuse to save edits which cannot be safely exported; source bytes retained in the journal.
  const edits=editableDiff(active.stage,records);
  await exportNewV1Kmz(active.stage,{...deps,edits});
  const draft={records,activityAreas:active.shapeAreas,sourceArchiveBase64:b64(active.stage.rawSource),
    sourcePath:active.stage.sourcePath,sourceFormat:active.stage.sourceFormat,reviewOnly:true};
  const result=await journal.save(draft,{expectedRevision:revision===null?undefined:revision});
  revision=result.revision;return result;
 }
 async function inspectDraft(){if(!journal)throw error('SAVE_UNAVAILABLE','No journal');return journal.load();}
 async function resumeDraft({confirmed=false}={}){
  if(!journal)throw error('SAVE_UNAVAILABLE','No journal');
  const saved=await journal.load();
  if(!['READY','FALLBACK'].includes(saved.status)||confirmed!==true)return {status:saved.status,applied:false,requiresConfirmation:saved.status==='FALLBACK'||saved.status==='READY'};
  const s=saved.snapshot;
  if(s.reviewOnly!==true)throw error('DRAFT_MISMATCH','Not a verified isolated editor draft');
  const input=from64(s.sourceArchiveBase64);
  const stage=await stageKmlInput(input,deps);await audited(stage);
  if(stage.sourcePath!==s.sourcePath||stage.sourceFormat!==s.sourceFormat)throw error('DRAFT_SOURCE','Source archive does not match its saved path and format');
  const preview=previewLegacyPoiStore(stage),shapeAreas=areas(stage);
  if(JSON.stringify(shapeAreas)!==JSON.stringify(s.activityAreas))throw error('DRAFT_AREA','Saved area boundaries differ from original source');
  const sourceIds=new Set(preview.records.map(x=>x.id));
  if(s.records.length!==sourceIds.size||s.records.some(x=>!sourceIds.has(x.id)))throw error('DRAFT_POI','Draft lost source POIs');
  const previewStore=preview.store;
  const applied=previewStore.replace(s.records);
  if(!applied.ok)throw error('DRAFT_POI','Draft conflicts with original protected POIs');
  const edits=editableDiff(stage,previewStore.snapshot().records);
  await exportNewV1Kmz(stage,{...deps,edits});
  active={stage,store:previewStore,shapeAreas,report:preview.report,converted:false};pending=null;
  revision=saved.revision;recoveredFallback=saved.status==='FALLBACK';
  return {status:saved.status,applied:true,readonlyRecovery:recoveredFallback,revision};
 }
 return Object.freeze({prepare,discardPending,acceptPrepared,command,undo,redo,exportKmz,saveDraft,inspectDraft,resumeDraft,state});
}
