/*
 * Three-function boundary, LAB only:
 * Actual WM3 extension/observation modules in the pseudo relay
 * -> actual Bridge exporter
 * -> synthetic Project/NEW_V1 pair imported via real frozen r31 iframe UI
 * -> edited Session -> isolated IndexedDB -> verified Project/KMZ return pair.
 *
 * This is NOT real Wayfarer GCS, a real Bridge receiver UI, Campsite production
 * Project persistence, Android/iPhone real-device, or production approval.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../..');
const SERVE_ROOT=process.env.R31_LAB_STATIC_ROOT?path.resolve(process.env.R31_LAB_STATIC_ROOT):ROOT;
const {chromium}=require(path.join(ROOT,'node_modules/playwright'));
const JSZip=require('jszip');
const {DOMParser,XMLSerializer}=require('@xmldom/xmldom');
const {webcrypto}=require('node:crypto');
const fixtureImage=fs.readFileSync(path.join(ROOT,'creative-next/qa/r31/fixtures/blue-dot.png'));
const ENTRY_URL='https://r31-three-function.invalid/creative-next/qa/r31-project-save-lab/index.html';
const DB='campsite-creative-next-x01-idb-lab-r31-save-ui-20261012';
const PROJECT_ID='r31-three-function-browser-lab';
const HANDOFF_ID='handoff:three-function-browser-lab';
const clone=v=>JSON.parse(JSON.stringify(v));
const mime=p=>({'.mjs':'application/javascript','.js':'application/javascript','.css':'text/css',
 '.html':'text/html','.png':'image/png'}[path.extname(p)]||'application/octet-stream');
function loadBridgeExporter(){
 const sandbox={window:{},console,Object,Array,String,Number,Boolean,JSON,Math,Map,Set,Infinity,Error};
 vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(path.join(ROOT,'bridge-pc/bridge-v1-exporter.js'),'utf8'),sandbox);
 return sandbox.window.CampsiteBridgeV1Exporter;
}
async function makeObservedInput(){
 const [{createHarness,makeProject},{createFreshV1Kmz}]=await Promise.all([
  import('../../scripts/wm3b2d-pseudo-harness.mjs'),
  import('../phase-1b/core/create-new-kmz.mjs')]);
 const base=makeProject();
 base.projectId=PROJECT_ID;
 base.meta={...base.meta,projectContract:'campsiteProject.v1',bridgeHandoffId:HANDOFF_ID};
 const test=createHarness({project:base});
 assert.equal((await test.connect()).status,'success');
 assert.equal((await test.observe()).status,'success');
 const observed=test.sessionStorage.dump();
 assert.equal(observed.wayfarerObservation?.acquisition?.coverageComplete,true);
 assert.equal(observed.wayfarerObservation.zones.interior.length,1);
 assert.equal(observed.wayfarerObservation.zones.reference100.length,1);
 assert.equal(observed.wayfarerObservation.zones.reserve200.length,1);
 const exporter=loadBridgeExporter();
 const payload=exporter.makePayload({enginePois:observed.wayfarerObservation.zones.interior,
  polygon:observed.polygon,wayfarerObservation:observed.wayfarerObservation},HANDOFF_ID);
 assert.equal(payload.type,'CAMPSITE_BRIDGE_POI_V1');
 assert.equal(payload.pois.length,1);
 assert.equal(payload.wayfarerObservation.snapshotId,observed.wayfarerObservation.snapshotId);
 // Controlled synthetic handoff only. This mapping is a TEST FIXTURE,
 // not the approved live WM4 receiver/Project importer.
 const project=clone(observed);
 project.currentPois=payload.pois.map(x=>({
  id:x.guid,guid:x.guid,role:'existing',gameEntity:x.gameEntity,gameStatus:x.gameStatus,
  title:x.title,lat:x.lat,lng:x.lng}));
 project.sourcePois=clone(project.currentPois);
 project.selectedPois=clone(project.currentPois);
 project.addedPois=[];project.deletedPois=[];project.edits=[];
 project.meta={...project.meta,projectContract:'campsiteProject.v1',bridgeHandoffId:HANDOFF_ID};
 project.syntheticUnknownFuture={keep:'do-not-drop',nested:{numbers:[1,2,3]}};
 const records=project.currentPois.map(x=>({
  id:'kmz-source-'+x.guid,role:'existing',guid:x.guid,kind:'pokestop',
  title:x.title,lat:x.lat,lng:x.lng,memo:'synthetic-only'}));
 const {bytes}=await createFreshV1Kmz({records,activityAreas:[]},
  {JSZip,DOMParser,XMLSerializer,documentName:'synthetic-wm3-r31'});
 return {project,bytes:Buffer.from(bytes),payload,snapshot:clone(observed.wayfarerObservation)};
}
function routeLocal(context){
 return context.route('**/*',async r=>{
  const u=new URL(r.request().url());
  let file=null;
  if(['r31-three-function.invalid','r31-recipient.invalid'].includes(u.hostname))file=path.resolve(SERVE_ROOT,'.'+decodeURIComponent(u.pathname));
  else if(u.hostname==='unpkg.com'&&/leaflet@1.9.4\/dist\/(leaflet.js|leaflet.css)$/.test(u.pathname))
   file=path.join(path.dirname(require.resolve('leaflet')),path.basename(u.pathname));
  if(file&&(file.startsWith(SERVE_ROOT+path.sep)||file.startsWith(ROOT+'/node_modules/'))&&fs.existsSync(file)&&fs.statSync(file).isFile())
   return r.fulfill({status:200,contentType:mime(file),body:fs.readFileSync(file)});
  if(u.hostname.includes('tile.openstreetmap')||u.hostname.includes('arcgisonline'))
   return r.fulfill({status:200,contentType:'image/png',body:fixtureImage});
  return r.abort();
 });
}
async function fromDatabase(page){
 return page.evaluate(async ({dbName,projectId,handoffId})=>{
  const db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open(dbName);
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  try{
   return await new Promise((resolve,reject)=>{
    const req=db.transaction('verified-pairs','readonly')
      .objectStore('verified-pairs').get(JSON.stringify([projectId,handoffId]));
    req.onsuccess=()=>{
     const x=req.result;
     if(!x)return reject(new Error('NO_SAVED_PAIR'));
     resolve({revision:x.revision,manifest:x.manifest,
      kmzBytes:Array.from(x.kmzBytes)});
    };
    req.onerror=()=>reject(req.error);
   });
  }finally{db.close();}
 },{dbName:DB,projectId:PROJECT_ID,handoffId:HANDOFF_ID});
}
async function main(){
 const [{createLinkedPairLab,reopenLinkedPairLab},input]=await Promise.all([
  import('../contracts/linked-project-kmz-lab.mjs'),makeObservedInput()]);
 const cryptoProvider=webcrypto,options={JSZip,DOMParser,cryptoProvider};
 // Confirm that the WM3-derived synthetic pair is independently valid.
 const original=await createLinkedPairLab({...options,project:input.project,
  activityAreas:[],kmzBytes:new Uint8Array(input.bytes),
  expectedProjectId:PROJECT_ID,expectedHandoffId:HANDOFF_ID});
 assert.equal(original.productionReady,false);
 const browser=await chromium.launch({headless:true});
 const results=[];
 try{
  for(const viewport of [{width:390,height:844},{width:393,height:852}]){
   const ctx=await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block'});
   await routeLocal(ctx);
   await ctx.addInitScript(()=>{
    localStorage.setItem('next-lab-creative-v7','THREE_FLOW_LEGACY_STAYS');
    localStorage.setItem('campsite-creative-next-v1-r31-review-10:current','THREE_FLOW_JOURNAL_STAYS');
   });
   const page=await ctx.newPage(),jsErrors=[];
   page.on('dialog',d=>d.accept());page.on('pageerror',e=>jsErrors.push(e.message));
   try{
    await page.goto(ENTRY_URL);
    await page.waitForFunction(()=>!!document.querySelector('#r31-frame')?.contentWindow?.creativeR31Workspace);
    await page.locator('#lab-open').tap();
    await page.locator('#lab-project').setInputFiles({
     name:'wm3-observed-project.json',mimeType:'application/json',
     buffer:Buffer.from(JSON.stringify(input.project))});
    await page.locator('#lab-kmz').setInputFiles({
     name:'wm3-synthetic-new-v1.kmz',mimeType:'application/vnd.google-earth.kmz',buffer:input.bytes});
    await page.locator('#lab-import').tap();
    await page.waitForFunction(()=>__r31ProjectSaveLabStatus?.().attached||
     document.getElementById('lab-status')?.dataset.kind==='error',{timeout:15000});
    const attached=await page.evaluate(()=>({
     status:__r31ProjectSaveLabStatus(),
     message:document.getElementById('lab-status').textContent,
     records:document.getElementById('r31-frame').contentWindow.creativeR31Workspace.workspace.session.state().records
    }));
    assert.equal(attached.status.attached,true,JSON.stringify({message:attached.message,errors:jsErrors}));
    assert.equal(attached.records.length,1);
    assert.equal(attached.records[0].guid,'inside');
    assert.equal(attached.records.some(p=>p.guid==='outer'||p.guid==='reserve'),false,
     'reference and reserve must never enter editable r31 records');
    await page.locator('#lab-close').tap();
    const r31=page.frameLocator('#r31-frame');
    await r31.locator('#cmAddFab').tap();
    await r31.locator('.cm-bubble[data-layer="new-gym"]').tap();
    await r31.locator('#cmSafeAddConfirm').tap();
    await page.waitForFunction(()=>document.getElementById('r31-frame').contentWindow.creativeR31Workspace.workspace.session.state().records.length===2);
    await page.locator('#lab-open').tap();
    await page.locator('#lab-save').tap();
    await page.waitForFunction(()=>__r31ProjectSaveLabStatus().revision===1||
     document.getElementById('lab-status').dataset.kind==='error');
    const ui=await page.evaluate(()=>({
     status:document.getElementById('lab-status').textContent,
     revision:__r31ProjectSaveLabStatus().revision}));
    assert.equal(ui.revision,1,ui.status);
    const raw=await fromDatabase(page);
    // The IDB schema deliberately stores the canonical linked-pair manifest,
    // not unverified top-level project or activityAreas fields. Verify hashes
    // and identities with the actual project/NEW_V1 contract before inspecting.
    const verified=await reopenLinkedPairLab({...options,
      pair:{manifest:raw.manifest,kmzBytes:Uint8Array.from(raw.kmzBytes)},
      expectedProjectId:PROJECT_ID,expectedHandoffId:HANDOFF_ID});
    const row={revision:raw.revision,project:verified.project,
      activityAreas:verified.activityAreas,kmzBytes:raw.kmzBytes};
    assert.equal(row.revision,1);assert.equal(row.project.projectId,PROJECT_ID);
    assert.equal(row.project.meta.bridgeHandoffId,HANDOFF_ID);
    assert.deepEqual(row.project.wayfarerObservation,input.snapshot,
     'accepted Wayfarer snapshot and all 3 zone arrays stay byte-equivalent');
    assert.deepEqual(row.project.polygon,input.project.polygon);
    assert.deepEqual(row.project.selectedPois,input.project.selectedPois);
    assert.deepEqual(row.project.sourcePois,input.project.sourcePois);
    assert.deepEqual(row.project.syntheticUnknownFuture,input.project.syntheticUnknownFuture);
    assert.equal(row.project.currentPois.length,2);
    assert.equal(row.project.addedPois.length,1);
    assert.equal(row.project.currentPois.some(p=>p.guid==='outer'||p.guid==='reserve'),false);
    assert.equal(row.activityAreas.length,0);
    assert.deepEqual(Buffer.from(input.bytes),Buffer.from(original.kmzBytes),'source KMZ protected');
    assert.equal(await page.evaluate(()=>localStorage.getItem('next-lab-creative-v7')),
     'THREE_FLOW_LEGACY_STAYS');
    assert.equal(await page.evaluate(()=>localStorage.getItem('campsite-creative-next-v1-r31-review-10:current')),
     'THREE_FLOW_JOURNAL_STAYS');
    // Return-channel candidate: re-verify complete Project/NEW_V1 pair outside
    // browser with real existing contracts; NOT the live Campsite receiver.
    const paired=await createLinkedPairLab({...options,project:row.project,
      activityAreas:row.activityAreas,kmzBytes:Uint8Array.from(row.kmzBytes),
      expectedProjectId:PROJECT_ID,expectedHandoffId:HANDOFF_ID});
    const back=await reopenLinkedPairLab({...options,pair:paired,
      expectedProjectId:PROJECT_ID,expectedHandoffId:HANDOFF_ID});
    assert.equal(back.status,'LAB_PAIR_VERIFIED');
    assert.equal(back.productionReady,false);
    assert.deepEqual(back.project.wayfarerObservation,input.snapshot);
    assert.equal(back.project.addedPois.length,1);
    // Genuine browser navigation from a live edited r31 Session into a
    // separate dedicated Campsite Return UI on the SAME isolated origin.
    // No legacy receiver or production Project key is written.
    await page.goto('https://r31-three-function.invalid/creative-next/qa/campsite-return-lab/index.html');
    await page.locator('#return-project-id').fill(PROJECT_ID);
    await page.locator('#return-handoff-id').fill(HANDOFF_ID);
    await page.locator('#return-verify').tap();
    await page.waitForFunction(()=>document.querySelector('#return-status')?.dataset.kind==='ok'||
      document.querySelector('#return-status')?.dataset.kind==='error');
    const returnState=await page.evaluate(()=>({
      kind:document.getElementById('return-status').dataset.kind,
      message:document.getElementById('return-status').textContent,
      items:Object.fromEntries([...document.querySelectorAll('#return-details dt')].map(dt=>[
        dt.textContent,dt.nextElementSibling?.textContent
      ])),
      old:localStorage.getItem('next-lab-creative-v7'),
      journal:localStorage.getItem('campsite-creative-next-v1-r31-review-10:current'),
      productionProject:sessionStorage.getItem('campsiteProject.v1')
    }));
    assert.equal(returnState.kind,'ok',returnState.message);
    assert.match(returnState.message,/世代 1/);
    assert.equal(returnState.items['Creative追加POI'],'1');
    assert.equal(returnState.items['外側100mの参照'],'1');
    assert.equal(returnState.items['予備100〜200m'],'1');
    assert.equal(returnState.items['従来Bridgeへの送信'],'HOLD（形式未承認）');
    assert.equal(returnState.old,'THREE_FLOW_LEGACY_STAYS');
    assert.equal(returnState.journal,'THREE_FLOW_JOURNAL_STAYS');
    assert.equal(returnState.productionProject,null);
    // Fail closed for a wrong Handoff, then read the original saved row again.
    await page.locator('#return-handoff-id').fill('handoff:wrong-project');
    await page.locator('#return-verify').tap();
    await page.waitForFunction(()=>document.getElementById('return-status')?.dataset.kind==='error');
    assert.match(await page.locator('#return-status').textContent(),/RETURN_SAVED_PROJECT_NOT_FOUND/);
    await page.locator('#return-handoff-id').fill(HANDOFF_ID);
    await page.locator('#return-verify').tap();
    await page.waitForFunction(()=>document.getElementById('return-status')?.dataset.kind==='ok');
    // Explicit user download; nothing is sent over network. The receiving
    // browser has a DIFFERENT HTTP origin and no sender IndexedDB access.
    assert.equal(await page.locator('#return-download').isVisible(),true);
    const pendingDownload=page.waitForEvent('download');
    await page.locator('#return-download').tap();
    const downloaded=await pendingDownload;
    assert.equal(downloaded.suggestedFilename(),'campsite-return-test-only.zip');
    const chunks=[];
    for await(const chunk of await downloaded.createReadStream())chunks.push(chunk);
    const transferred=Buffer.concat(chunks);
    assert(transferred.length>100);
    const recipient=await ctx.newPage();
    try{
      await recipient.goto('https://r31-recipient.invalid/creative-next/qa/campsite-return-lab/index.html');
      assert.equal(await recipient.evaluate(async db=>{
        const names=await indexedDB.databases();
        return names.some(x=>x.name===db);
      },DB),false,'other origin must not contain the sender IndexedDB');
      await recipient.locator('#return-project-id').fill(PROJECT_ID);
      await recipient.locator('#return-handoff-id').fill(HANDOFF_ID);
      // Do not click the local-store read button on the recipient: opening an
      // absent IndexedDB would create an empty schema, defeating the assertion
      // that portable import itself never touches recipient storage.
      await recipient.locator('#return-file').setInputFiles({
        name:'campsite-return-test-only.zip',mimeType:'application/zip',buffer:transferred});
      // Distinct origin import from selected file (read-only, no prior database).
      await recipient.locator('#return-upload-verify').tap();
      await recipient.waitForFunction(()=>document.querySelector('#return-status')?.dataset.kind==='ok'||
        document.querySelector('#return-status')?.dataset.kind==='error');
      const received=await recipient.evaluate(async db=>({
        message:document.getElementById('return-status').textContent,
        kind:document.getElementById('return-status').dataset.kind,
        items:Object.fromEntries([...document.querySelectorAll('#return-details dt')]
         .map(dt=>[dt.textContent,dt.nextElementSibling?.textContent])),
        productionProject:sessionStorage.getItem('campsiteProject.v1'),
        senderDbExists:(await indexedDB.databases()).some(x=>x.name===db)
      }),DB);
      assert.equal(received.kind,'ok',received.message);
      assert.equal(received.items['Creative追加POI'],'1');
      assert.equal(received.items['保存世代'],'1');
      assert.equal(received.items['設計範囲内の観測POI'],'1');
      assert.equal(received.items['外側100mの参照'],'1');
      assert.equal(received.items['予備100〜200m'],'1');
      assert.equal(received.productionProject,null);
      assert.equal(received.senderDbExists,false,
        'receiving a portable bundle must not create or modify any IndexedDB');
      await recipient.locator('#return-handoff-id').fill('handoff:wrong');
      await recipient.locator('#return-upload-verify').tap();
      await recipient.waitForFunction(()=>document.querySelector('#return-status')?.dataset.kind==='error');
      assert.match(await recipient.locator('#return-status').textContent(),/PORTABLE_IDENTITY_MISMATCH/);
    }finally{await recipient.close();}
    assert.deepEqual(jsErrors,[]);
    results.push({viewport,status:'PASS',wayfarerPseudoRelay:true,bridgeExporter:true,
     actualR31Ui:true,newPoiUi:true,isolatedIndexedDB:true,returnPairVerified:true,
     returnLabBrowserUiVerified:true,returnWrongHandoffHold:true,
     portableManualExport:true,crossOriginFileReceiver:true,crossOriginReceiverReadOnly:true,
     productionReceiverUiTested:false,realWayfarer:false,productionReady:false});
   }finally{await ctx.close();}
  }
 }finally{await browser.close();}
 console.log(JSON.stringify({status:'PASS',results,phase:'HOLD',productionReady:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
