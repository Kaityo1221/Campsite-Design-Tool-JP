/*
 * R31 UI LAB only. The approved r31 UI runs unmodified in a same-origin iframe.
 * This parent provides separate explicit start/save/reopen controls. No
 * production keys, r31 journals, browser storage migrations or source overwrite.
 */
import {stageKmlInput} from '../../phase-1b/core/stage-kmz.mjs';
import {sourceActivityAreas} from '../../phase-1b/core/activity-areas.mjs';
import {createLinkedPairLab} from '../../contracts/linked-project-kmz-lab.mjs';
import {createX01IndexedDbSaveLab} from '../../contracts/x01-indexeddb-save-lab.mjs';
import {createR31SessionIndexedDbLab} from '../../contracts/r31-session-indexeddb-lab.mjs';
import {inspectPortableReturnBundleLab} from '../../contracts/portable-return-bundle-lab.mjs';

const LAB_DB='campsite-creative-next-x01-idb-lab-r31-save-ui-20261012';
const doc=document,$=id=>doc.getElementById(id),frame=$('r31-frame');
let link=null,store=null,busy=false;
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const id=x=>typeof x==='string'&&x.trim().length>0&&x.length<=128;
const setStatus=(text,kind='neutral')=>{
 $('lab-status').textContent=text;
 $('lab-status').dataset.kind=kind;
};
function controls(){
 $('lab-import').disabled=busy;
 $('lab-zip-import').disabled=busy;
 $('lab-reopen').disabled=busy;
 $('lab-save').disabled=busy||!link?.status().attached;
}
function show(open){
 $('lab-panel').hidden=!open;
 $('lab-open').setAttribute('aria-expanded',String(open));
}
$('lab-open').addEventListener('click',()=>show($('lab-panel').hidden));
$('lab-close').addEventListener('click',()=>show(false));
async function lock(work){
 if(busy)return;
 busy=true;controls();
 try{return await work();}
 catch(e){setStatus('HOLD：'+(e?.code||'LAB_ERROR')+'。現在の保存データは自動修復・削除しません。','error');}
 finally{busy=false;controls();}
}
function waitReady(){
 return new Promise((resolve,reject)=>{
  const start=Date.now();
  const check=()=>{
   try{
    const win=frame.contentWindow;
    if(win?.creativeR31Workspace&&win.JSZip&&win.DOMParser)return resolve(win);
   }catch(_){}
   if(Date.now()-start>12000)return reject(Object.assign(new Error('LAB_R31_TIMEOUT'),{code:'LAB_R31_TIMEOUT'}));
   setTimeout(check,50);
  };
  check();
 });
}
function deps(win){
 // The frozen r31 JSZip lives in the iframe realm. JSZip must receive a typed
 // array created in that realm; use a byte-for-byte copy without modifying r31.
 const JSZip={loadAsync:bytes=>win.JSZip.loadAsync(win.Uint8Array.from(bytes))};
 return {JSZip,DOMParser:globalThis.DOMParser,cryptoProvider:globalThis.crypto};
}
function storage(win){
 const base=createX01IndexedDbSaveLab({indexedDB:globalThis.indexedDB,dbName:LAB_DB,...deps(win)});
 // r31 export bytes also originate in the iframe. The IndexedDB contract must
 // receive a parent-realm byte copy so its strict input checks stay enabled.
 return Object.freeze({...base,save:input=>base.save({...input,kmzBytes:Uint8Array.from(input.kmzBytes)})});
}
async function fileBytes(input,max){
 const file=input?.files?.[0];
 if(!file||file.size===0||file.size>max)fail('LAB_FILE_REQUIRED_OR_TOO_LARGE');
 return new Uint8Array(await file.arrayBuffer());
}
async function projectFile(){
 const bytes=await fileBytes($('lab-project'),4*1024*1024);
 let p;try{p=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch(_){fail('LAB_PROJECT_INVALID_JSON');}
 if(!p||typeof p!=='object'||Array.isArray(p)||
   p.schemaVersion!=='1.0'||p.source!=='bridge'||!id(p.projectId)||
   p.meta?.projectContract!=='campsiteProject.v1'||!id(p.meta?.bridgeHandoffId))
   fail('LAB_PROJECT_FORMAT');
 return p;
}
async function verifyPair(win,project,bytes){
 const stage=await stageKmlInput(bytes,deps(win));
 if(stage.errors?.length)fail('LAB_KMZ_INVALID');
 const activityAreas=sourceActivityAreas(stage);
 await createLinkedPairLab({project,activityAreas,kmzBytes:bytes,
  expectedProjectId:project.projectId,expectedHandoffId:project.meta.bridgeHandoffId,...deps(win)});
 return activityAreas;
}
async function inUiStart(win,bytes,filename){
 const mount=win.creativeR31Workspace;
 if(!mount||mount.workspace.session.state().hasActive)fail('LAB_ACTIVE_SESSION_HOLD');
 const sourceFile=new win.File([bytes],filename,{type:'application/vnd.google-earth.kmz'});
 await mount.selectFile(sourceFile);
 const button=win.document.getElementById('startButton');
 if(!button||button.disabled)fail('LAB_R31_IMPORT_HOLD');
 button.click();
 if(!mount.workspace.session.state().hasActive)fail('LAB_R31_START_HOLD');
 if(mount.status().workspace.sessionCount!==1)fail('LAB_SESSION_COUNT');
 return mount;
}
async function bind(win,project,bytes,revision){
 const mount=win.creativeR31Workspace;
 const candidate=createR31SessionIndexedDbLab({workspace:mount.workspace,store:storage(win),...deps(win)});
 try{
  const attached=await candidate.attachLive({project,kmzBytes:bytes,
   expectedProjectId:project.projectId,expectedHandoffId:project.meta.bridgeHandoffId,
   revision,confirmed:true});
  if(attached.status!=='LAB_R31_ATTACHED')fail('LAB_ATTACH_HOLD');
  link?.dispose();
  link=candidate;store=storage(win);
  $('lab-project-id').value=project.projectId;
  $('lab-handoff-id').value=project.meta.bridgeHandoffId;
  return attached;
 }catch(e){candidate.dispose();throw e;}
}
function safeEditorState(){
 const win=frame.contentWindow,owner=win?.creativeR31Workspace;
 if(!link||!owner)fail('LAB_NO_ACTIVE_LINK');
 const status=owner.status(),ui=owner.ui?.status();
 if(status.exportBusy||status.workspace.busy||status.workspace.stopped||
    status.workspace.sessionCount!==1||status.adapter?.fault||
    status.adapter?.pendingEdits||ui?.ui?.mode||ui?.ui?.tool==='polygon')
    fail('LAB_UNCOMMITTED_UI_EDIT_HOLD');
 return owner;
}
async function freshUi(){
 const old=frame.contentWindow;
 try{link?.dispose();}catch(e){fail(e.code||'LAB_BUSY');}
 link=null;store=null;controls();
 try{old?.creativeR31Workspace?.dispose();}catch(e){fail(e.code||'LAB_WORKSPACE_BUSY');}
 const loaded=new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));
 // Reuse exactly the old unmodified r31 file; this is a TEST only page.
 frame.src='../../original-ui-r31-b3-b4/index.html?lab-session='+Date.now();
 await loaded;
 return waitReady();
}
$('lab-import').addEventListener('click',()=>lock(async()=>{
 const win=await waitReady(),owner=win.creativeR31Workspace;
 if(link||owner.workspace.session.state().hasActive)fail('LAB_ACTIVE_SESSION_HOLD');
 const project=await projectFile(),kmzFile=$('lab-kmz').files?.[0];
 // On iPhone the native Files picker may disable .kmz when accept is present.
 // The picker is intentionally unrestricted; reject all non-KMZ inputs here.
 if(!kmzFile||!/\.kmz$/i.test(kmzFile.name))fail('LAB_KMZ_EXTENSION_REQUIRED');
 const bytes=await fileBytes($('lab-kmz'),8*1024*1024);
 if(bytes.length<4||bytes[0]!==0x50||bytes[1]!==0x4b||
   bytes[2]!==0x03||bytes[3]!==0x04)fail('LAB_KMZ_INVALID');
 setStatus('Projectと元KMZを検証しています…');
 await verifyPair(win,project,bytes);
 if(!window.confirm('Project JSONとKMZを紐づけて、r31の編集を開始しますか？ 元ファイルは変更しません。')){
  setStatus('開始をキャンセルしました。');return;
 }
 await inUiStart(win,bytes,$('lab-kmz').files[0].name||'source.kmz');
 await bind(win,project,bytes,0);
 setStatus('検証済みProjectをr31の単一Sessionに紐づけました。編集後「変更をプロジェクトに保存」を押してください。','ok');
}));
$('lab-zip-import').addEventListener('click',()=>lock(async()=>{
 const win=await waitReady(),owner=win.creativeR31Workspace;
 if(link||owner.workspace.session.state().hasActive)fail('LAB_ACTIVE_SESSION_HOLD');
 const expectedProjectId=$('lab-zip-project-id').value.trim(),
  expectedHandoffId=$('lab-zip-handoff-id').value.trim();
 if(!id(expectedProjectId)||!id(expectedHandoffId))fail('LAB_ZIP_IDS_REQUIRED');
 const incoming=$('lab-zip-file').files?.[0];
 if(!incoming||!/\.zip$/i.test(incoming.name))fail('LAB_ZIP_EXTENSION_REQUIRED');
 const bytes=await fileBytes($('lab-zip-file'),16*1024*1024);
 if(!window.JSZip)fail('LAB_ZIP_PARSER_UNAVAILABLE');
 setStatus('Campsite再編集ZIPのProject・KMZ・署名されていない送信元情報を検証中…');
 const read=await inspectPortableReturnBundleLab({
  bytes,expectedProjectId,expectedHandoffId,
  JSZip:window.JSZip,DOMParser:globalThis.DOMParser,cryptoProvider:globalThis.crypto
 });
 if(read.productionReady!==false||read.writeAllowed!==false||
    read.transportAuthenticated!==false||read.producerIdentityVerified!==false)
  fail('LAB_ZIP_AUTH_GATE');
 // Reject a parallel saved Project before starting an editor with revision 0.
 const existing=await storage(win).read({expectedProjectId,expectedHandoffId});
 if(existing)fail('LAB_ZIP_EXISTING_USE_REOPEN');
 const kmzBytes=Uint8Array.from(read.kmzBytes);
 const areas=await verifyPair(win,read.project,kmzBytes);
 if(JSON.stringify(areas)!==JSON.stringify(read.activityAreas))
  fail('LAB_ZIP_ACTIVITY_AREA_MISMATCH');
 if(!window.confirm('検証済みLAB ZIPから新しいr31 Sessionで再編集しますか？\\n送信元は未認証です。本番保存は行いません。')){
  setStatus('再編集をキャンセルしました。既存データは保持されています。');return;
 }
 await inUiStart(win,kmzBytes,'distance-reedit-new-v1.kmz');
 await bind(win,read.project,kmzBytes,0);
 setStatus('LAB ZIPの照合成功。新しいr31 Sessionで再編集できます。保存先は隔離領域のみです。','ok');
}));
$('lab-save').addEventListener('click',()=>lock(async()=>{
 const owner=safeEditorState();
 if(!window.confirm('現在の編集を隔離IndexedDBへ保存しますか？\n元KMZ・既存保存・本番データは上書きしません。'))return setStatus('保存をキャンセルしました。');
 const stateBefore=JSON.stringify(owner.workspace.session.state());
 setStatus('KMZとProjectを検証して保存中…');
 const saved=await link.save({confirmed:true});
 const s=owner.workspace.session.state();
 if(JSON.stringify(s)!==stateBefore)fail('LAB_SAVE_EDITOR_CHANGED');
 if(saved.status!=='LAB_R31_SAVED')fail(saved.status||'LAB_SAVE_HOLD');
 setStatus('保存成功。世代 '+saved.revision+'。再読込で検証済み。元KMZは変更していません。','ok');
}));
$('lab-reopen').addEventListener('click',()=>lock(async()=>{
 const expectedProjectId=$('lab-project-id').value.trim(),
  expectedHandoffId=$('lab-handoff-id').value.trim();
 if(!id(expectedProjectId)||!id(expectedHandoffId))fail('LAB_REOPEN_IDS_REQUIRED');
 // Read+cryptographically verify BEFORE replacing the current Session.
 const win=await waitReady();
 const retrieved=await storage(win).read({expectedProjectId,expectedHandoffId});
 if(!retrieved)fail('LAB_SAVED_PROJECT_NOT_FOUND');
 if(!window.confirm('検証済みの世代 '+retrieved.revision+' から再開しますか？\n現在の未保存編集は失われます。')){
  setStatus('再開をキャンセルしました。既存Sessionは保持されています。');return;
 }
 const next=await freshUi();
 const bytes=new Uint8Array(retrieved.kmzBytes);
 await verifyPair(next,retrieved.project,bytes);
 await inUiStart(next,bytes,'saved-project.kmz');
 await bind(next,retrieved.project,bytes,retrieved.revision);
 const after=next.creativeR31Workspace.workspace.session.state();
 if(after.history?.undo!==0||after.history?.redo!==0||after.areas.length!==retrieved.activityAreas.length)
  fail('LAB_REOPEN_STATE_HOLD');
 setStatus('保存済みの世代 '+retrieved.revision+' を新しいr31 Sessionで開きました。Undo/Redo履歴は新規開始です。','ok');
}));
controls();
window.__r31ProjectSaveLabStatus=()=>({
 busy,attached:!!link?.status().attached,revision:link?.status().revision??null,
 sessionCount:frame.contentWindow?.creativeR31Workspace?.status().workspace.sessionCount??null,
 database:LAB_DB,
 productionReady:false
});
