/*
 * NON-PRODUCTION: explicit-consent, source-bearing Creative Next editor session.
 * No legacy storage access and no automatic application or persistence.
 * Map/UI binding remains a separate, isolated preview step.
 */
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
import {convertLegacyKasaiKmz} from '../core/legacy-kasai-convert.mjs';
import {previewLegacyPoiStore} from './legacy-poi-preview.mjs';
import {exportNewV1Kmz,assertSafeKindEdit} from '../core/export-kmz.mjs';
import {createCreativeSaveJournal} from '../core/journal-save.mjs';
import {indexDependentCircles,circleOverlay,circleRingAt} from '../core/dependent-circles.mjs';
import {sourceActivityAreas,planActivityChange,planActivityMembership,plannedAreaOperations,editableAreaGeometry} from '../core/activity-areas.mjs';
const PREFIX='campsite.creative.';
function error(code,message){let e=new Error(message);e.code=code;return e;}
function b64(bytes){let str='';for(let i=0;i<bytes.length;i+=32768)str+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(str);}
function from64(value){if(typeof value!=='string'||!value||!/^[A-Za-z0-9+/]+={0,2}$/.test(value)||value.length%4!==0)throw error('DRAFT_SOURCE','Invalid source archive encoding');let s=atob(value),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a;}
function get(p,key){const values=p.data?.filter(d=>d.name===PREFIX+key)||[];return values.length===1?values[0].value:null;}
function circles(stage){return new Set(indexDependentCircles(stage).keys());}
function areas(stage){return sourceActivityAreas(stage);}
function editableDiff(stage,records){
 const originals=new Map(stage.places.filter(p=>p.geometry==='Point').map(p=>[get(p,'id'),p]));
 const recordIds=new Set(records.map(r=>r.id));
 if(recordIds.size!==records.length||[...originals.keys()].some(id=>!recordIds.has(id)))
   throw error('SOURCE_MISMATCH','Original source POIs cannot be replaced, merged, or dropped');
 const edits=[],additions=[];
 for(const r of records){
  const p=originals.get(r.id);
  if(!p){
   if(r.role!=='new'||r.guid!==null||r.poiId!==null||!r.metadata||Object.keys(r.metadata).length)
     throw error('SOURCE_ADD_HOLD','Only fresh, source-free new POIs can be inserted');
   if(!r.deleted)additions.push(r);
   continue;
  }
  if(r.role!==get(p,'role'))throw error('ROLE_CHANGED','POI identity cannot change');
  const edit={id:r.id};let changed=false;
  if(r.title!==get(p,'title')){edit.title=r.title;changed=true;}
  if(r.memo!==get(p,'memo')){edit.memo=r.memo;changed=true;}
  if(r.kind!==get(p,'kind')){edit.kind=r.kind;changed=true;}
  if(r.lat!==Number(get(p,'lat'))||r.lng!==Number(get(p,'lng'))){
   edit.lat=r.lat;edit.lng=r.lng;changed=true;
  }
  if(r.deleted){
   edit.deleted=true;changed=true;
  }
  if(changed)edits.push(edit);
 }
 return {edits,additions};
}
export function createIsolatedEditorSession({JSZip,DOMParser,XMLSerializer,storage=null,cryptoProvider=globalThis.crypto,namespace='campsite-creative-next-v1-preview',locks=globalThis.navigator?.locks,requireSaveLock=false}={}){
 const deps={JSZip,DOMParser,XMLSerializer,cryptoProvider};
 const journal=storage?createCreativeSaveJournal({storage,namespace,subtle:cryptoProvider?.subtle,locks,requireLock:requireSaveLock}):null;
 let pending=null,active=null,revision=null,recoveredFallback=false,prepareGeneration=0;
 let timelineUndo=[],timelineRedo=[];
 const cloneAreas=items=>items.map(a=>({id:a.id,points:a.points.map(p=>[...p])}));
 const view=()=>active?.store.snapshot()??null;
 const state=()=>{
  const records=view()?.records??[];
  const visibleCircles=active?[
   ...circleOverlay(active.stage,records),
   ...records.filter(p=>p.role==='new'&&!p.deleted&&!active.sourceIds.has(p.id))
     .map(p=>({ownerId:p.id,lat:p.lat,lng:p.lng,radius:50}))
  ]:[];
  return {hasPending:!!pending,hasActive:!!active,counts:view()?.counts??null,history:active?{undo:timelineUndo.length,redo:timelineRedo.length}:null,records,
    circles:visibleCircles,shapes:active?{...active.report.counts,circles:visibleCircles.length}:null,
    areas:active?cloneAreas(active.shapeAreas):[],hasUnsavedSource:!!active?.stage,revision,sourceIsolated:true,recoveredFallback};
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
  const next={...pending,store:pending.preview.store,report:pending.preview.report,
    sourceIds:new Set(pending.preview.records.map(p=>p.id)),areaUsed:new Set(pending.shapeAreas.map(a=>a.id))};
  active=next;pending=null;prepareGeneration++;revision=null;recoveredFallback=false;timelineUndo=[];timelineRedo=[];
  return {ok:true,applied:true,counts:active.report.counts,history:active.store.snapshot().history};
 }
 function command(value,{confirmed=false}={}){
  if(!active)throw error('NO_EDITOR','No confirmed editor session');
  if(recoveredFallback)throw error('SAVE_RECOVERY_REQUIRED','Fallback recovery is read-only');
  if(confirmed!==true)return {ok:true,changed:false,cancelled:true};
  if(value?.type==='add'&&value?.poi&&(
      value.poi.guid!=null||value.poi.poiId!=null||
      (value.poi.metadata&&Object.keys(value.poi.metadata).length)))
    throw error('SOURCE_ADD_HOLD','A new POI must not claim unverified source metadata or external IDs');
  if(value?.type==='add'&&value.poi&&Number.isFinite(value.poi.lat)&&Number.isFinite(value.poi.lng))
    circleRingAt(value.poi.lat,value.poi.lng,50);
  const snap=active.store.snapshot(),poi=value?.type==='add'?null:snap.records.find(p=>p.id===value?.id);
  if(!poi&&value?.type!=='add')throw error('POI_NOT_FOUND','POI not found');
  const changingLocation=value.type==='move'||(value.type==='edit'&&('lat' in (value.patch||{})||'lng' in (value.patch||{})));
  if(changingLocation&&circles(active.stage).has(poi.id)){
    const original=active.stage.places.find(p=>get(p,'id')===poi.id);
    if(poi.role==='existing')throw error('EXISTING_POSITION_LOCKED','Existing POIs cannot move');
    const raw=String(original?.sourceGeometry?.coordinates||'').trim().split(',');
    if(raw.length===3&&Number(raw[2])!==0||original?.sourceGeometry?.altitudeMode||original?.sourceGeometry?.extrude)
      throw error('CIRCLE_ALTITUDE_HOLD','Circle/POI position with meaningful altitude cannot move');
  }
  // Source-bearing kind changes are allowed only if the exporter can prove a
  // coherent folder/legacy-layer/style migration before save or download.
  const changeKind=value?.type==='change-kind'?value.kind:value?.type==='edit'?value.patch?.kind:undefined;
  if(poi&&changeKind!==undefined&&changeKind!==poi.kind&&active.sourceIds.has(poi.id))
    assertSafeKindEdit(active.stage,deps,poi.id,changeKind);
  const result=active.store.execute(value,{confirmed:true});
  if(result.ok&&result.changed){try{editableDiff(active.stage,active.store.snapshot().records)}catch(e){active.store.undo();throw e;}timelineUndo.push({kind:'poi'});timelineRedo=[];}
  return result;
 }
 function commandArea(value,{confirmed=false}={}){
  if(!active)throw error('NO_EDITOR','No confirmed editor session');
  if(confirmed!==true)return {ok:true,changed:false,cancelled:true};
  if(recoveredFallback)throw error('SAVE_RECOVERY_REQUIRED','Fallback recovery is read-only');
  const membership=value?.type==='area-create'||value?.type==='area-remove';
  const plan=membership?planActivityMembership(active.shapeAreas,value,{reservedIds:[...active.areaUsed]}):planActivityChange(active.shapeAreas,value);
  if(!plan.changed)return {ok:true,changed:false};
  // Fail before accepting edits to unsupported source structures or altitude modes.
  const isSource=areas(active.stage).some(a=>a.id===plan.id);
  if(isSource){
    const xml=new deps.DOMParser().parseFromString(active.stage.sourceKml,'application/xml');
    editableAreaGeometry(active.stage,xml,{id:plan.id,points:plan.after??plan.before});
  }
  const proposed=cloneAreas(active.shapeAreas),index=proposed.findIndex(a=>a.id===plan.id);
  if(plan.kind==='area-membership'){
    if(plan.before===null)proposed.push({id:plan.id,points:plan.after});
    else proposed.splice(index,1);
  }else proposed[index].points=plan.after;
  plannedAreaOperations(areas(active.stage),proposed);
  active.shapeAreas=proposed;
  if(plan.kind==='area-membership'&&plan.before===null)active.areaUsed.add(plan.id);
  timelineUndo.push(plan);timelineRedo=[];
  return {ok:true,changed:true,id:plan.id};
 }
 function historyStep(direction){
  if(!active)throw error('NO_EDITOR','No editor');
  const source=direction==='undo'?timelineUndo:timelineRedo;
  const dest=direction==='undo'?timelineRedo:timelineUndo;
  if(!source.length)return {ok:true,changed:false};
  const step=source.at(-1);
  if(step.kind==='poi'){
    const result=active.store[direction]();
    if(result.ok&&result.changed){dest.push(source.pop());}
    return result;
  }
  const area=active.shapeAreas.find(a=>a.id===step.id);
  const expected=direction==='undo'?step.after:step.before;
  const target=direction==='undo'?step.before:step.after;
  if(expected===null?!!area:!area||JSON.stringify(area.points)!==JSON.stringify(expected))throw error('HISTORY_CONFLICT','Activity area differs from history');
  const next=cloneAreas(active.shapeAreas),index=next.findIndex(a=>a.id===step.id);
  if(target===null)next.splice(index,1);
  else if(index<0)next.push({id:step.id,points:target.map(p=>[...p])});
  else next[index].points=target.map(p=>[...p]);
  plannedAreaOperations(areas(active.stage),next);
  active.shapeAreas=next;dest.push(source.pop());
  return {ok:true,changed:true};
 }
 const undo=()=>historyStep('undo');
 const redo=()=>historyStep('redo');
 async function exportKmz({signal}={}){
  if(!active)throw error('NO_EDITOR','No confirmed editor');
  const changes=editableDiff(active.stage,active.store.snapshot().records);
  const areaOperations=plannedAreaOperations(areas(active.stage),active.shapeAreas);
  return exportNewV1Kmz(active.stage,{...deps,...changes,...areaOperations,signal});
 }
 async function saveDraft(){
  if(!journal||!active)throw error('SAVE_UNAVAILABLE','No initialized draft journal or editor');
  if(recoveredFallback)throw error('SAVE_RECOVERY_REQUIRED','Recovery is read-only until a separate verified repair workflow');
  const records=active.store.snapshot().records;
  const shapeAreas=cloneAreas(active.shapeAreas);
  // Refuse to save edits which cannot be safely exported; source bytes retained in the journal.
  const changes=editableDiff(active.stage,records);
  const areaOperations=plannedAreaOperations(areas(active.stage),shapeAreas);
  await exportNewV1Kmz(active.stage,{...deps,...changes,...areaOperations});
  const draft={records,activityAreas:shapeAreas,sourceArchiveBase64:b64(active.stage.rawSource),
    sourcePath:active.stage.sourcePath,sourceFormat:active.stage.sourceFormat,reviewOnly:true};
  const result=await journal.save(draft,{expectedRevision:revision});
  revision=result.revision;return result;
 }
 async function inspectDraft(){if(!journal)throw error('SAVE_UNAVAILABLE','No journal');return journal.load();}
 async function inspectRecovery(){
  if(!journal)throw error('SAVE_UNAVAILABLE','No journal');
  return journal.inspectRecovery(); // Read-only, including a damaged pointer.
 }
 async function recoverDraft({report,candidate,confirmed=false}={}){
  if(!journal)throw error('SAVE_UNAVAILABLE','No journal');
  if(confirmed!==true)throw error('SAVE_CONFIRM_REQUIRED','Choose a verified generation and confirm recovery');
  if(!report||report.status!=='FALLBACK'||!Array.isArray(report.candidates)||
     !report.candidates.some(c=>c.slot===candidate?.slot&&c.revision===candidate?.revision&&c.checksum===candidate?.checksum))
    throw error('SAVE_RECOVERY_INVALID','Select a generation from the current inspected fallback');
  const restored=await journal.recover({confirmed:true,observedPointer:report.observedPointer,
    slot:candidate.slot,revision:candidate.revision,checksum:candidate.checksum});
  const reloaded=await resumeDraft({confirmed:true});
  if(reloaded.status!=='READY'||!reloaded.applied||reloaded.revision!==restored.revision)
    throw error('SAVE_VERIFY','Pointer repaired, but editor resume failed; inspect again before editing');
  return Object.freeze({...restored,applied:true,readonlyRecovery:false});
 }
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
  const areaOperations=plannedAreaOperations(shapeAreas,s.activityAreas);
  await exportNewV1Kmz(stage,{...deps,...areaOperations});
  const sourceIds=new Set(preview.records.map(x=>x.id));
  if(!Array.isArray(s.records)||s.records.length<sourceIds.size||
    [...sourceIds].some(id=>!s.records.some(x=>x.id===id)))throw error('DRAFT_POI','Draft lost original POIs');
  const previewStore=preview.store;
  const applied=previewStore.replace(s.records);
  if(!applied.ok)throw error('DRAFT_POI','Draft conflicts with original protected POIs');
  const changes=editableDiff(stage,previewStore.snapshot().records);
  await exportNewV1Kmz(stage,{...deps,...changes,...areaOperations});
  active={stage,store:previewStore,shapeAreas:cloneAreas(s.activityAreas),report:preview.report,converted:false,sourceIds,areaUsed:new Set([...shapeAreas,...s.activityAreas].map(a=>a.id))};pending=null;timelineUndo=[];timelineRedo=[];
  revision=saved.revision;recoveredFallback=saved.status==='FALLBACK';
  return {status:saved.status,applied:true,readonlyRecovery:recoveredFallback,revision};
 }
 return Object.freeze({prepare,discardPending,acceptPrepared,command,commandArea,undo,redo,exportKmz,saveDraft,inspectDraft,inspectRecovery,recoverDraft,resumeDraft,state});
}
