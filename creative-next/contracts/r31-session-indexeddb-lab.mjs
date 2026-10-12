/*
 * Creative Next r31 LAB-only Session <-> X01 IndexedDB integration.
 * Does NOT patch/reroute the approved UI, modify its journal, call localStorage,
 * or authorize project/NEW_V1 production schema migration.
 */
import {createLinkedPairLab} from './linked-project-kmz-lab.mjs';
import {planDesignPolygonSaveLab} from './design-polygon-save-channel-lab.mjs';

const fail=(code)=>{const e=new Error(code);e.code=code;throw e;};
const clone=x=>JSON.parse(JSON.stringify(x));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const entity=Object.freeze({pokestop:'POKESTOP',gym:'GYM',power:'POWERSPOT'});
const isId=x=>typeof x==='string'&&x.trim().length>0;
const stable=x=>String(x.guid||x.poiId||'').trim();
function ensureReady(workspace){
 const s=workspace.session.state(),w=workspace.status();
 if(!s.hasActive||s.hasPending||s.sourceIsolated!==true||w.stopped||w.busy||
    w.sessionCount!==1||s.recoveredFallback)fail('R31_LAB_SESSION_NOT_READY');
 return s;
}
function reconcile(project,records){
 if(!Array.isArray(records)||!Array.isArray(project.currentPois))fail('R31_LAB_RECORDS_INVALID');
 const originals=project.currentPois,existing=new Map(),local=new Map();
 for(const p of originals){
  if(p.role==='existing'){
   const k=stable(p);if(!k||existing.has(k))fail('R31_LAB_PROJECT_IDENTITY');existing.set(k,p);
  }else if(p.role==='added'){
   if(!isId(p.id)||local.has(p.id))fail('R31_LAB_PROJECT_IDENTITY');local.set(p.id,p);
  }else fail('R31_LAB_PROJECT_ROLE');
 }
 const seenExisting=new Set(),seenNew=new Set(),current=[],added=[];
 for(const r of records){
  if(r.deleted===true)fail('R31_LAB_DELETED_POI_HOLD'); // deletion needs explicit tombstone contract
  if(r.role==='existing'){
   const id=stable(r),p=existing.get(id);
   if(!id||seenExisting.has(id)||!p||r.kind!==Object.entries(entity).find(([,v])=>v===p.gameEntity)?.[0]||
      r.title!==p.title||r.lat!==p.lat||r.lng!==p.lng)
    fail('R31_LAB_EXISTING_READ_ONLY');
   seenExisting.add(id);current.push(clone(p));
  }else if(r.role==='new'){
   if(!isId(r.id)||seenNew.has(r.id)||!entity[r.kind]||
      r.guid!==null||r.poiId!==null)fail('R31_LAB_NEW_IDENTITY');
   seenNew.add(r.id);
   const prior=local.get(r.id);
   const p={...(prior?clone(prior):{id:r.id,role:'added',gameStatus:'UNKNOWN'}),
    id:r.id,role:'added',title:r.title,gameEntity:entity[r.kind],
    lat:r.lat,lng:r.lng,description:r.memo};
   current.push(p);added.push(clone(p));
  }else fail('R31_LAB_UNKNOWN_POI_ROLE');
 }
 if(seenExisting.size!==existing.size||seenNew.size<local.size||
    [...local.keys()].some(id=>!seenNew.has(id)))fail('R31_LAB_SOURCE_RECORD_LOSS');
 if(current.length!==records.length)fail('R31_LAB_RECORD_LOSS');
 project.currentPois=current;
 project.addedPois=added;
 // Project sourcePois/selectedPois/edits and all unknown future fields remain intact.
 return project;
}
function typedGeometry(project,areas){
 if(!Array.isArray(areas))fail('R31_LAB_ACTIVITY_AREAS');
 return [
  {kind:'project-design-polygon',projectId:project.projectId,
   handoffId:project.meta.bridgeHandoffId,basePolygon:clone(project.polygon),
   points:clone(project.polygon),deleted:false},
  ...areas.map(a=>({kind:'activity-area',id:a.id,points:clone(a.points),deleted:false}))
 ];
}
function inspectState(s){
 return JSON.stringify({records:s.records,areas:s.areas,history:s.history,sourceIsolated:s.sourceIsolated});
}
export function createR31SessionIndexedDbLab({workspace,store,JSZip,DOMParser,
 cryptoProvider=globalThis.crypto,evaluateCoverage=null}={}){
 if(!workspace?.session?.state||!workspace?.exportKmz||
    !store?.save||!store?.read||!JSZip||!DOMParser)fail('R31_LAB_CONFIG');
 let project=null,expectedProjectId=null,expectedHandoffId=null,revision=null,stopped=false,busy=false;
 const ready=()=>{if(stopped)fail('R31_LAB_STOPPED');if(busy)fail('R31_LAB_BUSY');};
 const identity=()=>({expectedProjectId,expectedHandoffId});
 function attach(input){
  const s=ensureReady(workspace);
  if(!input?.project||!isId(input.expectedProjectId)||!isId(input.expectedHandoffId))fail('R31_LAB_ATTACH_INVALID');
  if(project)fail('R31_LAB_ALREADY_ATTACHED');
  if(input.project.projectId!==input.expectedProjectId||
    input.project.meta?.bridgeHandoffId!==input.expectedHandoffId)fail('R31_LAB_IDENTITY');
  if(!Array.isArray(s.areas)||!Array.isArray(s.records))fail('R31_LAB_SESSION_STATE');
  const p=clone(input.project);
  const check=reconcile(clone(p),s.records);
  if(!same(check.currentPois,p.currentPois) || !same(check.addedPois,p.addedPois))
    fail('R31_LAB_INITIAL_PROJECT_KMZ_MISMATCH');
  if(!same(s.areas,input.activityAreas))fail('R31_LAB_INITIAL_AREA_MISMATCH');
  project=p;expectedProjectId=input.expectedProjectId;expectedHandoffId=input.expectedHandoffId;
  revision=input.revision??0;
  if(!Number.isSafeInteger(revision)||revision<0)fail('R31_LAB_REVISION');
  return Object.freeze({status:'LAB_R31_ATTACHED',productionReady:false,revision,sessionCount:1});
 }
 async function start({project:sourceProject,kmzBytes,expectedProjectId:p,expectedHandoffId:h,confirmed=false}={}){
  ready();if(project)fail('R31_LAB_ALREADY_ATTACHED');
  if(confirmed!==true)fail('R31_LAB_CONFIRM_REQUIRED');
  if(workspace.session.state().hasActive)fail('R31_LAB_ACTIVE_REPLACEMENT_HOLD');
  busy=true;
  try{
   // Verify input/Project/areas before activating a new single r31 Session.
   // Read-only preflight: parse source archive, retain original bytes, and
   // require a complete Wayfarer Project envelope in the separate source object.
   const {stageKmlInput}=await import('../phase-1b/core/stage-kmz.mjs');
   const {sourceActivityAreas}=await import('../phase-1b/core/activity-areas.mjs');
   const stage=await stageKmlInput(kmzBytes,{JSZip,DOMParser});
   if(stage.errors?.length)fail('R31_LAB_INPUT_KMZ');
   const areas=sourceActivityAreas(stage);
   await createLinkedPairLab({project:sourceProject,activityAreas:areas,kmzBytes,
    expectedProjectId:p,expectedHandoffId:h,JSZip,DOMParser,cryptoProvider});
   const review=await workspace.prepare(kmzBytes);
   if(review.status!=='REVIEW')fail('R31_LAB_IMPORT_HOLD');
   const accepted=workspace.acceptPrepared({confirmed:true});
   if(!accepted.applied)fail('R31_LAB_IMPORT_NOT_ACCEPTED');
   attach({project:sourceProject,activityAreas:areas,revision:0,
    expectedProjectId:p,expectedHandoffId:h});
   return {status:'LAB_R31_STARTED',productionReady:false,sessionCount:1};
  }finally{busy=false;}
 }
 async function attachLive({project:sourceProject,kmzBytes,revision:restoreRevision=0,
  expectedProjectId:p,expectedHandoffId:h,confirmed=false}={}){
  ready();if(project)fail('R31_LAB_ALREADY_ATTACHED');
  if(confirmed!==true)fail('R31_LAB_CONFIRM_REQUIRED');
  const state=ensureReady(workspace);
  if(state.history?.undo!==0||state.history?.redo!==0)fail('R31_LAB_ATTACH_AFTER_EDIT_HOLD');
  busy=true;
  try{
   // The confirmed r31 UI has already accepted this archive.
   // Reverify the exact source pair before binding any independent save capability.
   const {stageKmlInput}=await import('../phase-1b/core/stage-kmz.mjs');
   const {sourceActivityAreas}=await import('../phase-1b/core/activity-areas.mjs');
   const stage=await stageKmlInput(kmzBytes,{JSZip,DOMParser});
   if(stage.errors?.length)fail('R31_LAB_INPUT_KMZ');
   const activityAreas=sourceActivityAreas(stage);
   await createLinkedPairLab({project:sourceProject,activityAreas,kmzBytes,
    expectedProjectId:p,expectedHandoffId:h,JSZip,DOMParser,cryptoProvider});
   if(!same(state.records,workspace.session.state().records)||!same(state.areas,workspace.session.state().areas))
    fail('R31_LAB_SESSION_CHANGED');
   return attach({project:sourceProject,activityAreas,revision:restoreRevision,
    expectedProjectId:p,expectedHandoffId:h});
  }finally{busy=false;}
 }
 async function save({confirmed=false}={}){
  ready();if(confirmed!==true)fail('R31_LAB_CONFIRM_REQUIRED');
  if(!project)fail('R31_LAB_NOT_ATTACHED');
  const state=ensureReady(workspace),fingerprint=inspectState(state);
  busy=true;
  try{
   const sourceProject=clone(project);
   const candidate=reconcile(clone(sourceProject),state.records);
   const plan=planDesignPolygonSaveLab({
    project:candidate,...identity(),expectedBasePolygon:clone(sourceProject.polygon),
    geometryObjects:typedGeometry(sourceProject,state.areas),evaluateCoverage
   });
   if(!same(inspectState(ensureReady(workspace)),fingerprint))fail('R31_LAB_SESSION_CHANGED');
   const exported=await workspace.exportKmz();
   if(!exported?.bytes)fail('R31_LAB_EXPORT_EMPTY');
   if(inspectState(ensureReady(workspace))!==fingerprint)fail('R31_LAB_SESSION_CHANGED');
   const result=await store.save({plan,kmzBytes:exported.bytes,...identity(),expectedRevision:revision});
   const stored=await store.read(identity());
   if(!stored||stored.revision!==result.revision||
     !same(stored.project,plan.project)||!same(stored.activityAreas,plan.activityAreas)||
     !same([...stored.kmzBytes],[...exported.bytes]))fail('R31_LAB_SAVE_VERIFICATION_HOLD');
   project=clone(stored.project);revision=stored.revision;
   if(inspectState(workspace.session.state())!==fingerprint)
    return {status:'LAB_SAVED_BUT_EDITOR_CHANGED',productionReady:false,revision,sessionCount:1};
   return Object.freeze({status:'LAB_R31_SAVED',productionReady:false,revision,
    sessionCount:1,recordCount:state.records.length,areaCount:state.areas.length});
  }finally{busy=false;}
 }
 async function reopen({expectedProjectId:p,expectedHandoffId:h,confirmed=false}={}){
  ready();if(project)fail('R31_LAB_ALREADY_ATTACHED');
  if(confirmed!==true)fail('R31_LAB_CONFIRM_REQUIRED');
  if(workspace.session.state().hasActive)fail('R31_LAB_ACTIVE_REPLACEMENT_HOLD');
  busy=true;
  try{
   const stored=await store.read({expectedProjectId:p,expectedHandoffId:h});
   if(!stored)fail('R31_LAB_NO_SAVED_PAIR');
   const review=await workspace.prepare(stored.kmzBytes);
   if(review.status!=='REVIEW')fail('R31_LAB_IMPORT_HOLD');
   const accepted=workspace.acceptPrepared({confirmed:true});
   if(!accepted.applied)fail('R31_LAB_IMPORT_NOT_ACCEPTED');
   attach({project:stored.project,activityAreas:stored.activityAreas,revision:stored.revision,
    expectedProjectId:p,expectedHandoffId:h});
   return Object.freeze({status:'LAB_R31_REOPENED',productionReady:false,revision:stored.revision,
    sessionCount:1,recordCount:workspace.session.state().records.length,
    areaCount:workspace.session.state().areas.length});
  }finally{busy=false;}
 }
 return Object.freeze({start,attachLive,save,reopen,status:()=>({stopped,busy,attached:!!project,revision,productionReady:false,
  sessionCount:stopped?0:workspace.status().sessionCount}),
  dispose(){if(busy)fail('R31_LAB_BUSY');stopped=true;project=null;revision=null;}
 });
}
