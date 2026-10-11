import {stageKmlInput} from '../phase-1b/core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../phase-1b/core/diagnose-kmz-candidate.mjs';
import {convertLegacyKasaiKmz} from '../phase-1b/core/legacy-kasai-convert.mjs';
import {previewLegacyPoiStore} from '../phase-1b/integration/legacy-poi-preview.mjs';
import {createIsolatedEditorSession} from '../phase-1b/integration/isolated-editor-session.mjs';
import {createCreativeSaveJournal} from '../phase-1b/core/journal-save.mjs';

export const NAMESPACE='campsite-creative-next-v1-r31-b3-b4';
const keys=new Set(['current','slot-a','slot-b'].map(s=>NAMESPACE+':'+s));
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const copy=x=>JSON.parse(JSON.stringify(x));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const reject=e=>({status:e.code==='CANCELLED'||e.code==='PREPARE_STALE'?'HOLD':'REJECT',changed:false,issues:[{code:e.code||'WORKSPACE_ERROR'}]});
function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);}
function unbase64(s){if(typeof s!=='string'||!s.length||s.length>12*1024*1024||s.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))fail('DRAFT_SOURCE');return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
// The only storage capability granted to this workspace: three fixed keys.
// No key enumeration, clear, deletion, migration, or legacy fallback exists.
export function scopedStorage(storage){return Object.freeze({getItem(k){if(!keys.has(k))fail('STORAGE_SCOPE');return storage.getItem(k);},setItem(k,v){if(!keys.has(k))fail('STORAGE_SCOPE');storage.setItem(k,v);}});}

export function createWorkspace({JSZip,DOMParser,XMLSerializer,cryptoProvider=globalThis.crypto,storage=null,locks=null}={}){
 const deps={JSZip,DOMParser,XMLSerializer,cryptoProvider};
 const safeStorage=storage?scopedStorage(storage):null;
 const journal=safeStorage?createCreativeSaveJournal({storage:safeStorage,namespace:NAMESPACE,subtle:cryptoProvider?.subtle,locks,requireLock:true}):null;
 // Exactly one engine Session. Its journal is used for verified resume only.
 let engine=createIsolatedEditorSession({...deps,storage:safeStorage,namespace:NAMESPACE,locks,requireSaveLock:true});
 let stopped=false,busy=false,generation=0,candidate=null,source=null,originals=null,revision=null,lastSaved=null;
 const revived=new Set();
 const live=()=>{if(stopped)fail('WORKSPACE_STOPPED');};
 const idle=()=>{live();if(busy)fail('WORKSPACE_BUSY');};
 function immutable(records,baseline){
  if(!Array.isArray(records))fail('DRAFT_POI');
  const byId=new Map(records.map(p=>[p.id,p]));
  if(byId.size!==records.length)fail('DRAFT_POI');
  for(const p of baseline){const next=byId.get(p.id);if(!next)fail('DRAFT_SOURCE_POI_REMOVED');
   if(p.role==='existing'&&!same(p,next))fail('EXISTING_POI_READ_ONLY');
   if(p.role!==next.role||!same(p.metadata,next.metadata)||p.guid!==next.guid||p.poiId!==next.poiId)fail('DRAFT_SOURCE_IDENTITY');
  }
  const ids=new Set(baseline.map(p=>p.id));
  for(const p of records)if(!ids.has(p.id)&&(p.role!=='new'||p.guid!==null||p.poiId!==null||!p.metadata||Object.keys(p.metadata).length))fail('SOURCE_ADD_HOLD');
 }
 async function verified(input,{signal,allowLegacy=false}={}){
  let stage=await stageKmlInput(input,{...deps,signal});
  if(stage.errors.length){const e=new Error();e.code=stage.errors[0].code;throw e;}
  let diagnosis=diagnoseKmzCandidate(stage),converted=false;
  if(allowLegacy&&diagnosis.profile==='LEGACY_CREATIVE_KASAI_CANDIDATE'){
   // Strict converter rejects zero/multiple owners with LEGACY_CIRCLE_AMBIGUOUS.
   // No nearest-POI choice, relinking, coordinate correction or salvage path.
   const result=await convertLegacyKasaiKmz(stage,{...deps,signal});
   stage=await stageKmlInput(result.bytes,{...deps,signal});diagnosis=diagnoseKmzCandidate(stage);converted=true;
  }
  if(stage.errors.length||diagnosis.disposition!=='READY'||diagnosis.profile!=='NEW_V1')fail('IMPORT_HOLD');
  return {stage,baseline:previewLegacyPoiStore(stage).records,converted};
 }
 async function prepare(input,{signal}={}){
  idle();if(engine.state().hasActive)return {status:'HOLD',changed:false,issues:[{code:'ACTIVE_SESSION_REPLACEMENT_HOLD'}]};
  const ticket=++generation;candidate=null;engine.discardPending();
  try{const result=await verified(input,{signal,allowLegacy:true});
   if(stopped||ticket!==generation||signal?.aborted)fail('PREPARE_STALE');
   const review=await engine.prepare(result.stage.rawSource,{signal});
   if(stopped||ticket!==generation||signal?.aborted){if(ticket===generation)engine.discardPending();fail('PREPARE_STALE');}
   if(review.status!=='REVIEW')fail('IMPORT_HOLD');candidate=result;
   return {...review,converted:result.converted};
  }catch(e){if(ticket===generation){candidate=null;engine.discardPending();}const r=reject(e);if(['LEGACY_CIRCLE_AMBIGUOUS','IMPORT_HOLD','LEGACY_UNSAFE'].includes(e.code))r.status='HOLD';return r;}
 }
 function discardPending(){idle();generation++;candidate=null;return engine.discardPending();}
 function acceptPrepared({confirmed=false}={}){
  idle();if(confirmed!==true)return {status:'HOLD',changed:false,reason:'EXPLICIT_CONFIRM_REQUIRED'};
  if(!candidate||engine.state().hasActive)fail('IMPORT_NOT_READY');
  const result=engine.acceptPrepared({confirmed:true});source=candidate.stage;originals=copy(candidate.baseline);candidate=null;generation++;
  return result;
 }
 function edit(method,value,options){
  idle();if(!engine.state().hasActive)fail('NO_EDITOR');
  if(method==='command'&&value?.type==='add'&&value.poi?.role!=='new')fail('SOURCE_ADD_HOLD');
  if(method==='command'&&value?.type!=='add'){
   const target=engine.state().records.find(p=>p.id===value?.id);
   if(!target||target.role!=='new')fail('EXISTING_POI_READ_ONLY');
  }
  const before=engine.state().records,result=engine[method](value,options);
  if(result.changed){const after=engine.state().records;
   // Only an actual Session history undo/redo can authorize a saved tombstone revival.
   if(method==='undo'||method==='redo')for(const old of lastSaved?.records||[])if(old.deleted&&after.some(p=>p.id===old.id&&!p.deleted)&&!before.some(p=>p.id===old.id&&!p.deleted))revived.add(old.id);
  }
  return result;
 }
 // B2 sees a verified baseline revision; persistence versions are owned here.
 // Saving never changes editing state or invalidates B2's external-change guard.
 const session=Object.freeze({state(){live();const s=engine.state();return {...s,revision:null};},command:(v,o)=>edit('command',v,o),commandArea:(v,o)=>edit('commandArea',v,o),undo:()=>edit('undo'),redo:()=>edit('redo')});
 async function exclusive(fn){idle();if(!journal)fail('SAVE_UNAVAILABLE');if(!locks?.request)fail('SAVE_LOCK_UNAVAILABLE');busy=true;
  try{return await locks.request(NAMESPACE+':save-lock',{mode:'exclusive'},fn);}finally{busy=false;}
 }
 async function exportKmz(){idle();if(!engine.state().hasActive)fail('NO_EDITOR');busy=true;
  try{immutable(engine.state().records,originals);const result=await engine.exportKmz();await verified(result.bytes);live();return result;}finally{busy=false;}
 }
 async function saveDraft({confirmed=false}={}){
  idle();if(confirmed!==true)fail('SAVE_CONFIRM_REQUIRED');if(!journal)fail('SAVE_UNAVAILABLE');if(!locks?.request)fail('SAVE_LOCK_UNAVAILABLE');
  if(!source||!engine.state().hasActive)fail('NO_EDITOR');busy=true;
  try{const state=engine.state();immutable(state.records,originals);await engine.exportKmz();live();
   const records=copy(state.records),present=new Set(records.map(p=>p.id));
   // Undo of a fresh addition removes it from the Store; keep previously saved IDs reserved as tombstones.
   for(const old of lastSaved?.records||[])if(!present.has(old.id)){if(old.role!=='new')fail('EXISTING_POI_READ_ONLY');records.push({...copy(old),deleted:true});}
   const snapshot={records,activityAreas:copy(state.areas),sourceArchiveBase64:base64(source.rawSource),sourcePath:source.sourcePath,sourceFormat:source.sourceFormat,reviewOnly:true};
   const result=await journal.save(snapshot,{expectedRevision:revision,restoreDeletedIds:[...revived]});
   live();revision=result.revision;lastSaved=snapshot;revived.clear();return result;
  }finally{busy=false;}
 }
 async function inspectDraft(){idle();if(!journal)fail('SAVE_UNAVAILABLE');return journal.load().then(s=>({status:s.status,revision:s.revision,requiresConfirmation:s.status==='READY'}));}
 async function resumeDraft({confirmed=false}={}){
  if(confirmed!==true)return {status:'HOLD',applied:false,reason:'SAVE_CONFIRM_REQUIRED'};
  return exclusive(async()=>{
   if(engine.state().hasActive||candidate)fail('SAVE_ACTIVE');generation++;engine.discardPending();
   const saved=await journal.load();if(saved.status!=='READY')return {status:'HOLD',applied:false,reason:saved.status==='FALLBACK'?'SAVE_RECOVERY_REQUIRED':saved.status};
   const s=saved.snapshot;if(s.reviewOnly!==true)fail('DRAFT_MISMATCH');
   const result=await verified(unbase64(s.sourceArchiveBase64));
   if(result.stage.sourcePath!==s.sourcePath||result.stage.sourceFormat!==s.sourceFormat)fail('DRAFT_SOURCE');
   immutable(s.records,result.baseline);live();
   // Frozen engine validates record schema, polygons, source edits and full export before replacing state.
   const resumed=await engine.resumeDraft({confirmed:true});
   if(resumed.status!=='READY'||!resumed.applied||resumed.revision!==saved.revision)fail('SAVE_CONFLICT');
   source=result.stage;originals=copy(result.baseline);revision=saved.revision;lastSaved=copy(s);return resumed;
  });
 }
 return Object.freeze({session,prepare,discardPending,acceptPrepared,exportKmz,saveDraft,inspectDraft,resumeDraft,
  status:()=>({stopped,busy,revision,hasCandidate:!!candidate,sessionCount:stopped?0:1,history:engine?.state().history??null}),
  dispose(){if(busy)fail('WORKSPACE_BUSY');if(stopped)return;stopped=true;generation++;candidate=null;source=null;originals=null;lastSaved=null;revived.clear();engine.discardPending();engine=null;}
 });
}
