/* Frozen r31 HTML in iframe + external LAB controls: actual Chromium integration. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const SERVE_ROOT=process.env.R31_LAB_STATIC_ROOT?path.resolve(process.env.R31_LAB_STATIC_ROOT):ROOT;
const {chromium,webkit}=require(path.join(ROOT,'node_modules/playwright'));
const ENGINE=process.env.R31_LAB_BROWSER||'chromium';
if(!['chromium','webkit'].includes(ENGINE))throw Error('UNSUPPORTED_LAB_BROWSER');
const JSZip=require('jszip');
const {DOMParser,XMLSerializer}=require('@xmldom/xmldom');
const mime=p=>({'.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png'}[path.extname(p)]||'application/octet-stream');
const ENTRY_URL='https://r31.invalid/creative-next/qa/r31-project-save-lab/index.html';
const base='campsite-creative-next-x01-idb-lab-r31-save-ui-20261012';
const expectedPolygon=[[35.7,139.8],[35.7,139.802],[35.702,139.802],[35.702,139.8]];
const project=()=>({
 schemaVersion:'1.0',source:'bridge',projectId:'r31-ui-lab-project',polygon:expectedPolygon,
 meta:{projectContract:'campsiteProject.v1',bridgeHandoffId:'handoff:r31-ui-lab'},
 selectedPois:[{guid:'existing-guid'}],sourcePois:[{guid:'existing-guid'}],
 currentPois:[{id:'existing-guid',guid:'existing-guid',role:'existing',gameEntity:'POKESTOP',gameStatus:'ACTIVE',title:'元のPOI',lat:35.701,lng:139.801}],
 addedPois:[],deletedPois:[],edits:[],
 wayfarerObservation:{snapshotId:'snapshot:r31-ui-lab',observedAt:'2026-10-12T06:40:00Z',
  polygon:expectedPolygon,acquisition:{coverageComplete:true,bufferMeters:200},
  zones:{
   interior:[{guid:'existing-guid',lat:35.701,lng:139.801,poiKind:'POKESTOP',gameEntity:'POKESTOP',gameStatus:'ACTIVE'}],
   reference100:[{guid:'outside-guid',lat:35.701,lng:139.799,poiKind:'GYM',gameEntity:'GYM',gameStatus:'ACTIVE'}],
   reserve200:[{guid:'reserve-guid',lat:35.701,lng:139.7986,poiKind:'NOT_IN_GAME',gameEntity:'POWERSPOT',gameStatus:'INACTIVE',referenceKind:'INACTIVE_POWERSPOT'}]
  }
 },future:{unknown:{preserve:true}}
});
async function makeKmz(){
 const {createFreshV1Kmz}=await import('../phase-1b/core/create-new-kmz.mjs');
 return (await createFreshV1Kmz({records:[{id:'original-record',role:'existing',guid:'existing-guid',kind:'pokestop',title:'元のPOI',memo:'Original',lat:35.701,lng:139.801}],activityAreas:[]},
 {JSZip,DOMParser,XMLSerializer})).bytes;
}
// Reject invalid pairs before creating any r31 Session or changing test storage.
async function rejectImport(context,kmz,p,expected,{dismiss=false,kmzName='invalid-case.kmz'}={}){
 const probe=await context.newPage(),errors=[];
 probe.on('pageerror',e=>errors.push(e.message));
 probe.on('dialog',d=>dismiss?d.dismiss():d.accept());
 try{
  await probe.goto(ENTRY_URL);
  await probe.waitForFunction(()=>!!document.querySelector('#r31-frame')?.contentWindow?.creativeR31Workspace);
  await probe.locator('#lab-open').tap();
  await probe.locator('#lab-project').setInputFiles({
    name:'invalid-case-project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
  await probe.locator('#lab-kmz').setInputFiles({
    name:kmzName,mimeType:'application/vnd.google-earth.kmz',buffer:kmz});
  await probe.locator('#lab-import').tap();
  await probe.waitForFunction(code=>document.getElementById('lab-status').textContent.includes(code),expected);
  const state=await probe.evaluate(()=>{
    const win=document.querySelector('#r31-frame').contentWindow;
    return {active:win.creativeR31Workspace.workspace.session.state().hasActive,
      linked:__r31ProjectSaveLabStatus().attached,
      revision:__r31ProjectSaveLabStatus().revision,
      saveEnabled:!document.getElementById('lab-save').disabled,
      status:document.getElementById('lab-status').textContent,
      old:localStorage.getItem('next-lab-creative-v7'),
      journal:localStorage.getItem('campsite-creative-next-v1-r31-review-10:current')};
  });
  assert.equal(state.active,false,JSON.stringify(state));
  assert.equal(state.linked,false);
  assert.equal(state.revision,null);
  assert.equal(state.saveEnabled,false);
  assert.equal(state.old,'ORIGINAL');
  assert.equal(state.journal,'R31_OLD_JOURNAL');
  assert.deepEqual(errors,[]);
  return expected;
 }finally{await probe.close();}
}
async function run(){
 const browser=await (ENGINE==='webkit'?webkit:chromium).launch({headless:true});const result=[];
 const bytes=Buffer.from(await makeKmz());
 try{
  if(process.env.R31_LAB_STATIC_ROOT){
   const fixtures=path.join(SERVE_ROOT,'creative-next/qa/r31-project-save-lab/fixtures');
   assert.deepEqual(JSON.parse(fs.readFileSync(path.join(fixtures,'demo-only-project.json'),'utf8')),project());
   // ZIP entry timestamps can differ across host/timezone/second; compare
   // canonical KML payload, not volatile ZIP DOS timestamps.
   const built=await JSZip.loadAsync(bytes);
   const sample=await JSZip.loadAsync(fs.readFileSync(path.join(fixtures,'demo-only-new-v1.kmz')));
   assert.deepEqual(Object.keys(built.files).sort(),Object.keys(sample.files).sort());
   for(const name of Object.keys(built.files)){
    assert.deepEqual(await built.file(name).async('uint8array'),
      await sample.file(name).async('uint8array'),'fixture KML contents: '+name);
   }
  }
  for(const viewport of [{width:390,height:844},{width:393,height:852}]){
   const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block'}),errors=[];
   await context.addInitScript(()=>{
    localStorage.setItem('next-lab-creative-v7','ORIGINAL');
    localStorage.setItem('campsite-creative-next-v1-r31-review-10:current','R31_OLD_JOURNAL');
   });
   await context.route('**/*',async route=>{
    const u=new URL(route.request().url());let file=null;
    if(u.hostname==='r31.invalid')file=path.resolve(SERVE_ROOT,'.'+decodeURIComponent(u.pathname));
    else if(u.hostname==='unpkg.com'&&/leaflet@1.9.4\/dist\/(leaflet.js|leaflet.css)$/.test(u.pathname))
     file=path.join(path.dirname(require.resolve('leaflet')),path.basename(u.pathname));
    if(file&&(file.startsWith(SERVE_ROOT+path.sep)||file.startsWith(ROOT+'/node_modules/'))&&fs.existsSync(file)&&fs.statSync(file).isFile())
     return route.fulfill({status:200,contentType:mime(file),body:fs.readFileSync(file)});
    if(u.hostname.includes('tile.openstreetmap')||u.hostname.includes('arcgisonline'))
     return route.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(path.join(ROOT,'creative-next/qa/r31/fixtures/blue-dot.png'))});
    return route.abort();
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   let denyDialog=null;const decisions=[];page.on('dialog',d=>{decisions.push(d.message());if(denyDialog?.test(d.message())){denyDialog=null;d.dismiss();}else d.accept();});
   try{
    await page.goto(ENTRY_URL);
    await page.waitForFunction(()=>!!document.querySelector('#r31-frame')?.contentWindow?.creativeR31Workspace);
    // iOS Files greys out .kmz when native accept filters are provided.
    // Keep picker unrestricted, while the controller rejects wrong extensions/ZIPs.
    assert.equal(await page.locator('#lab-kmz').getAttribute('accept'),null);
    await page.locator('#lab-open').tap();
    await page.locator('#lab-project').setInputFiles({name:'synthetic-project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project()))});
    await page.locator('#lab-kmz').setInputFiles({name:'synthetic.kmz',mimeType:'application/vnd.google-earth.kmz',buffer:bytes});
    await page.locator('#lab-import').tap();
    await page.waitForFunction(()=>window.__r31ProjectSaveLabStatus?.().attached ||
      document.getElementById('lab-status')?.dataset.kind==='error',null,{timeout:15000});
    const importDiagnostics=await page.evaluate(()=>({
      kind:document.getElementById('lab-status').dataset.kind,
      message:document.getElementById('lab-status').textContent,
      entry:document.getElementById('r31-frame').contentWindow.document.getElementById('entryState')?.textContent,
      attached:__r31ProjectSaveLabStatus().attached
    }));
    if(importDiagnostics.kind==='error'){
      const stageErrors=await page.evaluate(async payload=>{
        const {stageKmlInput}=await import('/creative-next/phase-1b/core/stage-kmz.mjs');
        const win=document.querySelector('#r31-frame').contentWindow;
        const stage=await stageKmlInput(Uint8Array.from(payload),{JSZip:win.JSZip,DOMParser:win.DOMParser});
        return stage.errors.map(({code,message})=>({code,message}));
      },Array.from(bytes));
      throw Error(JSON.stringify({importDiagnostics,stageErrors,errors}));
    }
    assert.equal(importDiagnostics.kind,'ok',JSON.stringify({importDiagnostics,errors}));
    assert.equal(importDiagnostics.attached,true);
    const initial=await page.evaluate(()=>({
     status:__r31ProjectSaveLabStatus(),
     active:document.querySelector('#r31-frame').contentWindow.creativeR31Workspace.workspace.session.state().hasActive
    }));
    assert.equal(initial.status.productionReady,false);
    assert.equal(initial.status.sessionCount,1);
    assert.equal(initial.active,true);
    assert.equal(initial.status.revision,0);
    await page.locator('#lab-close').tap();
    const frame=page.frameLocator('#r31-frame');
    await frame.locator('#cmAddFab').tap();
    await frame.locator('.cm-bubble[data-layer="new-gym"]').tap();
    await frame.locator('#cmSafeAddConfirm').tap();
    await page.waitForFunction(()=>document.querySelector('#r31-frame').contentWindow.creativeR31Workspace.workspace.session.state().records.length===2);
    const before=await page.evaluate(()=>document.querySelector('#r31-frame').contentWindow.creativeR31Workspace.workspace.session.state());
    await frame.locator('#undo').tap();await frame.locator('#redo').tap();
    assert.deepEqual(await page.evaluate(()=>document.querySelector('#r31-frame').contentWindow.creativeR31Workspace.workspace.session.state()),before);
    await page.locator('#lab-open').tap();
    await page.locator('#lab-save').tap();
    await page.waitForFunction(()=>__r31ProjectSaveLabStatus().revision===1);
    const saved=await page.evaluate(async()=>{
      const idb=indexedDB,opened=await new Promise((resolve,reject)=>{const r=idb.open('campsite-creative-next-x01-idb-lab-r31-save-ui-20261012');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
      try{return await new Promise((resolve,reject)=>{
        const tx=opened.transaction('verified-pairs','readonly'),req=tx.objectStore('verified-pairs').get(JSON.stringify(['r31-ui-lab-project','handoff:r31-ui-lab']));
        req.onsuccess=()=>resolve({revision:req.result.revision,kmz:Array.from(req.result.kmzBytes)});
        req.onerror=()=>reject(req.error);
      })}finally{opened.close()}
    });
    assert.equal(saved.revision,1);
    assert(bytes.length>100);
    const afterSave=await page.evaluate(()=>({
     old:localStorage.getItem('next-lab-creative-v7'),
     journal:localStorage.getItem('campsite-creative-next-v1-r31-review-10:current'),
     status:__r31ProjectSaveLabStatus()
    }));
    assert.equal(afterSave.old,'ORIGINAL');
    assert.equal(afterSave.journal,'R31_OLD_JOURNAL');
    assert.equal(afterSave.status.sessionCount,1);
    // Explicit reopen requires a fresh verified pair, destroys only the prior
    // test iframe Session, starts another one with the saved archive.
    await page.locator('#lab-reopen').tap();
    // The old Session already has revision 1 and two POIs. Do not mistake it
    // for the reopened Session while its asynchronous IDB verification runs.
    await page.waitForFunction(()=>{
      const status=document.getElementById('lab-status');
      return status?.dataset.kind==='error' ||
        (status?.dataset.kind==='ok' && status.textContent.includes('Undo/Redo履歴は新規開始です。') &&
         !window.__r31ProjectSaveLabStatus?.().busy);
    });
    const reopenStatus=await page.evaluate(()=>({
      kind:document.getElementById('lab-status').dataset.kind,
      message:document.getElementById('lab-status').textContent
    }));
    assert.equal(reopenStatus.kind,'ok',JSON.stringify({reopenStatus,errors}));
    const restored=await page.evaluate(()=>{
     const inner=document.querySelector('#r31-frame').contentWindow;
     const r=inner.creativeR31Workspace.workspace.session.state();
     return {records:r.records.map(x=>({title:x.title,role:x.role})),areas:r.areas.length,
      history:r.history,sessionCount:inner.creativeR31Workspace.workspace.status().sessionCount,
      message:document.getElementById('lab-status').textContent,
      old:localStorage.getItem('next-lab-creative-v7'),
      journal:localStorage.getItem('campsite-creative-next-v1-r31-review-10:current')};
    });
    assert.deepEqual(restored.history,{undo:0,redo:0});
    assert.equal(restored.sessionCount,1);
    assert(restored.records.some(x=>x.role==='new'));
    assert(restored.message.includes('世代 1'));
    assert.equal(restored.old,'ORIGINAL');
    assert.equal(restored.journal,'R31_OLD_JOURNAL');
    assert.equal(errors.length,0,errors.join(';'));
    assert(decisions.length>=3);
    // Full top-level browser refresh: in-memory Session disappears, while only
    // the user-confirmed isolated IndexedDB generation remains available.
    const inputBytes=await page.locator('#lab-kmz').evaluate(async input=>Array.from(new Uint8Array(await input.files[0].arrayBuffer())));
    assert.deepEqual(Buffer.from(inputBytes),bytes);
    const beforeHardReload=await page.evaluate(()=>document.querySelector('#r31-frame').contentWindow.creativeR31Workspace.workspace.session.state().records
      .filter(p=>p.role==='new').map(p=>({id:p.id,kind:p.kind,title:p.title,lat:p.lat,lng:p.lng,deleted:p.deleted})));
    assert.equal(beforeHardReload.length,1);
    await page.reload();
    await page.waitForFunction(()=>!!document.querySelector('#r31-frame')?.contentWindow?.creativeR31Workspace);
    assert.equal(await page.evaluate(()=>window.__r31ProjectSaveLabStatus().attached),false);
    assert.equal(await page.evaluate(()=>document.querySelector('#r31-frame').contentWindow.creativeR31Workspace.workspace.session.state().hasActive),false);
    await page.locator('#lab-open').tap();
    await page.locator('#lab-project-id').fill('r31-ui-lab-project');
    await page.locator('#lab-handoff-id').fill('handoff:r31-ui-lab');
    await page.locator('#lab-reopen').tap();
    await page.waitForFunction(()=>document.getElementById('lab-status')?.textContent.includes('Undo/Redo履歴は新規開始です。'),null,{timeout:15000});
    const afterHardReload=await page.evaluate(()=>{
      const w=document.querySelector('#r31-frame').contentWindow.creativeR31Workspace.workspace;
      const state=w.session.state();
      return {pois:state.records.filter(p=>p.role==='new').map(p=>({id:p.id,kind:p.kind,title:p.title,lat:p.lat,lng:p.lng,deleted:p.deleted})),
        history:state.history,sessionCount:w.status().sessionCount,revision:__r31ProjectSaveLabStatus().revision,
        old:localStorage.getItem('next-lab-creative-v7'),
        journal:localStorage.getItem('campsite-creative-next-v1-r31-review-10:current')};
    });
    assert.deepEqual(afterHardReload.pois,beforeHardReload);
    assert.deepEqual(afterHardReload.history,{undo:0,redo:0});
    assert.equal(afterHardReload.revision,1);
    assert.equal(afterHardReload.sessionCount,1);
    assert.equal(afterHardReload.old,'ORIGINAL');
    assert.equal(afterHardReload.journal,'R31_OLD_JOURNAL');
    assert.equal(errors.length,0,errors.join(';'));
    // UI negative cases: unknown IDs and cancellation must preserve the live Session.
    await page.evaluate(()=>{window.__r31ProtectedSession=document.querySelector('#r31-frame').contentWindow.creativeR31Workspace});
    await page.locator('#lab-project-id').fill('wrong-project');
    await page.locator('#lab-reopen').tap();
    await page.waitForFunction(()=>document.getElementById('lab-status').textContent.includes('LAB_SAVED_PROJECT_NOT_FOUND'));
    assert.equal(await page.evaluate(()=>document.querySelector('#r31-frame').contentWindow.creativeR31Workspace===window.__r31ProtectedSession),true);
    await page.locator('#lab-project-id').fill('r31-ui-lab-project');
    await page.locator('#lab-handoff-id').fill('handoff:incorrect');
    await page.locator('#lab-reopen').tap();
    await page.waitForFunction(()=>document.getElementById('lab-status').textContent.includes('LAB_SAVED_PROJECT_NOT_FOUND'));
    assert.equal(await page.evaluate(()=>document.querySelector('#r31-frame').contentWindow.creativeR31Workspace===window.__r31ProtectedSession),true);
    await page.locator('#lab-handoff-id').fill('handoff:r31-ui-lab');
    denyDialog=/検証済みの世代/;
    await page.locator('#lab-reopen').tap();
    await page.waitForFunction(()=>document.getElementById('lab-status').textContent.includes('再開をキャンセルしました'));
    assert.equal(await page.evaluate(()=>document.querySelector('#r31-frame').contentWindow.creativeR31Workspace===window.__r31ProtectedSession),true);
    denyDialog=/隔離IndexedDBへ保存/;
    await page.locator('#lab-save').tap();
    await page.waitForFunction(()=>document.getElementById('lab-status').textContent.includes('保存をキャンセルしました'));
    assert.equal(await page.evaluate(()=>__r31ProjectSaveLabStatus().revision),1);
    // A second live tab holds revision=1 while the first advances to revision=2.
    const peer=await context.newPage();
    peer.on('dialog',d=>d.accept());
    try{
      await peer.goto(ENTRY_URL);
      await peer.waitForFunction(()=>!!document.querySelector('#r31-frame')?.contentWindow?.creativeR31Workspace);
      await peer.locator('#lab-open').tap();
      await peer.locator('#lab-project-id').fill('r31-ui-lab-project');
      await peer.locator('#lab-handoff-id').fill('handoff:r31-ui-lab');
      await peer.locator('#lab-reopen').tap();
      await peer.waitForFunction(()=>document.getElementById('lab-status').textContent.includes('Undo/Redo履歴は新規開始です。'));
      assert.equal(await peer.evaluate(()=>__r31ProjectSaveLabStatus().revision),1);
      await page.locator('#lab-save').tap();
      await page.waitForFunction(()=>__r31ProjectSaveLabStatus().revision===2);
      await peer.locator('#lab-save').tap();
      await peer.waitForFunction(()=>document.getElementById('lab-status').textContent.includes('IDB_LAB_REVISION_CONFLICT'));
      assert.equal(await peer.evaluate(()=>__r31ProjectSaveLabStatus().revision),1);
      assert.equal(await page.evaluate(()=>__r31ProjectSaveLabStatus().revision),2);
    }finally{await peer.close();}
    // Delete an already-saved new POI: tombstone representation is unapproved, so HOLD.
    const deletion=await page.evaluate(()=>{
      const inner=document.querySelector('#r31-frame').contentWindow;
      const w=inner.creativeR31Workspace.workspace;
      const p=w.session.state().records.find(r=>r.role==='new');
      // The engine rejects parent-realm command objects by design.
      // Construct the command in its own frozen r31 iframe realm.
      const command=inner.JSON.parse(JSON.stringify({type:'delete',id:p.id}));
      return w.session.command(command,{confirmed:true});
    });
    assert.equal(deletion.changed,true,JSON.stringify(deletion));
    await page.locator('#lab-save').tap();
    await page.waitForFunction(()=>document.getElementById('lab-status').textContent.includes('R31_LAB_DELETED_POI_HOLD'));
    assert.equal(await page.evaluate(()=>__r31ProjectSaveLabStatus().revision),2);
    assert.equal(await page.evaluate(()=>document.querySelector('#r31-frame').contentWindow.creativeR31Workspace.workspace.session.undo().changed),true);
    // Native file-input selection clears on full reload by browser design.
    // The original KMZ bytes were verified before reload above; persisted
    // project data and historic localStorage remain protected afterward.
    assert.equal(await page.evaluate(()=>localStorage.getItem('next-lab-creative-v7')),'ORIGINAL');
    assert.equal(await page.evaluate(()=>localStorage.getItem('campsite-creative-next-v1-r31-review-10:current')),'R31_OLD_JOURNAL');
    // Malformed or mismatched source data never activates an editor.
    const corrupt=Buffer.from(bytes);corrupt[0]^=0xff;
    await rejectImport(context,corrupt,project(),'LAB_KMZ_INVALID');
    await rejectImport(context,bytes,project(),'LAB_KMZ_EXTENSION_REQUIRED',{kmzName:'demo-only-new-v1.txt'});
    const mismatch=project();mismatch.currentPois[0].title='別の元POI';
    await rejectImport(context,bytes,mismatch,'PAIR_POI_MISMATCH');
    const incomplete=project();incomplete.wayfarerObservation.acquisition.coverageComplete=false;
    await rejectImport(context,bytes,incomplete,'PAIR_PROJECT_PREFLIGHT_HOLD');
    await rejectImport(context,bytes,project(),'開始をキャンセルしました',{dismiss:true});
    assert.equal(await page.evaluate(()=>__r31ProjectSaveLabStatus().revision),2);
    result.push({viewport,status:'PASS',explicitConsent:true,saveAndReopen:true,hardReloadReopen:true,legacyKeysIntact:true,
      singleSession:true,wrongIdHold:true,wrongHandoffHold:true,cancelSaveReopen:true,staleRevisionHold:true,deletedPoiHold:true,
      malformedKmzHold:true,poiMismatchHold:true,incompleteObservationHold:true,cancelImport:true});
   }finally{await context.close();}
  }
 }finally{await browser.close();}
 console.log(JSON.stringify({status:result.length===2?'PASS':'HOLD',browser:ENGINE,results:result,safariRealDevice:'NOT_TESTED',productionReady:false}));
}
module.exports={project,makeKmz};
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
