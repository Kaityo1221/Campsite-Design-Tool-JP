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
const {chromium,webkit}=require(path.join(ROOT,'node_modules/playwright'));
const ENGINE=process.env.R31_LAB_BROWSER||'chromium';
if(!['chromium','webkit'].includes(ENGINE))throw Error('R31_BROWSER_UNSUPPORTED');
const JSZip=require('jszip');
const {DOMParser,XMLSerializer}=require('@xmldom/xmldom');
const {webcrypto}=require('node:crypto');
const fixtureImage=fs.readFileSync(path.join(ROOT,'creative-next/qa/r31/fixtures/blue-dot.png'));
const ENTRY_URL='https://r31-three-function.invalid/creative-next/qa/r31-project-save-lab/index.html';
const DB='campsite-creative-next-x01-idb-lab-r31-save-ui-20261012';
const RECEIVE_DB='campsite-creative-next-x01-idb-lab-distance-receiver-20261016';
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
async function fromDatabase(page,dbName=DB){
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
 },{dbName,projectId:PROJECT_ID,handoffId:HANDOFF_ID});
}
async function main(){
 const [{createLinkedPairLab,reopenLinkedPairLab},
  {createPortableReturnBundleLab,inspectPortableReturnBundleLab},input]=await Promise.all([
  import('../contracts/linked-project-kmz-lab.mjs'),
  import('../contracts/portable-return-bundle-lab.mjs'),makeObservedInput()]);
 const cryptoProvider=webcrypto,options={JSZip,DOMParser,cryptoProvider};
 // Confirm that the WM3-derived synthetic pair is independently valid.
 const original=await createLinkedPairLab({...options,project:input.project,
  activityAreas:[],kmzBytes:new Uint8Array(input.bytes),
  expectedProjectId:PROJECT_ID,expectedHandoffId:HANDOFF_ID});
 assert.equal(original.productionReady,false);
 const browser=await (ENGINE==='webkit'?webkit:chromium).launch({headless:true});
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
    assert.equal(await page.locator('#return-distance-panel').isVisible(),true);
    assert.match(await page.locator('#return-distance-details').textContent(),/DISTANCE_LIVE_IMPORT_NOT_APPROVED/);
    assert.match(await page.locator('#return-distance-details').textContent(),/LAB計算プレビュー/);
    assert.match(await page.locator('#return-distance-details').textContent(),/外側100mの参照POIとの50m未満/);

    assert.equal(returnState.old,'THREE_FLOW_LEGACY_STAYS');
    assert.equal(returnState.journal,'THREE_FLOW_JOURNAL_STAYS');
    assert.equal(returnState.productionProject,null);
    // Fail closed for a wrong Handoff, then read the original saved row again.
    await page.locator('#return-handoff-id').fill('handoff:wrong-project');
    assert.equal(await page.locator('#return-download').isVisible(),false,
      'return download must invalidate on changed identity');
    await page.locator('#return-verify').tap();
    await page.waitForFunction(()=>document.getElementById('return-status')?.dataset.kind==='error');
    assert.match(await page.locator('#return-status').textContent(),/RETURN_SAVED_PROJECT_NOT_FOUND/);
    await page.locator('#return-handoff-id').fill(HANDOFF_ID);
    await page.locator('#return-verify').tap();
    await page.waitForFunction(()=>document.getElementById('return-status')?.dataset.kind==='ok');
    assert.equal(await page.locator('#return-download').isVisible(),true,
      'valid source must re-enable download after re-verification');
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
      assert.equal(await recipient.locator('#return-distance-panel').isVisible(),true);
      assert.match(await recipient.locator('#return-distance-details').textContent(),/HOLD（未承認）/);
      assert.match(await recipient.locator('#return-distance-details').textContent(),/LAB計算プレビュー/);
      assert.equal(received.productionProject,null);
      assert.equal(received.senderDbExists,false,
        'receiving a portable bundle must not create or modify any IndexedDB');
      await recipient.locator('#return-handoff-id').fill('handoff:wrong');
      await recipient.locator('#return-upload-verify').tap();
      await recipient.waitForFunction(()=>document.querySelector('#return-status')?.dataset.kind==='error');
      assert.match(await recipient.locator('#return-status').textContent(),/PORTABLE_IDENTITY_MISMATCH/);
      // The user-mediated Project/NEW_V1 bundle now goes to the *new*
      // isolated confirmation UI. Two actual tabs inspect the same absent
      // recipient revision; transactional CAS must reject the second save.
      const ACCEPT_URL='https://r31-recipient.invalid/creative-next/qa/campsite-distance-import-lab/index.html';
      const enter=async(tab)=>{
        await tab.goto(ACCEPT_URL);
        await tab.locator('#accept-project').fill(PROJECT_ID);
        await tab.locator('#accept-handoff').fill(HANDOFF_ID);
        await tab.locator('#accept-file').setInputFiles({
         name:'campsite-return-test-only.zip',mimeType:'application/zip',buffer:transferred});
        await tab.locator('#accept-inspect').tap();
        await tab.waitForFunction(()=>document.querySelector('#accept-status')?.dataset.kind==='ok'||
          document.querySelector('#accept-status')?.dataset.kind==='error');
        assert.equal(await tab.locator('#accept-create').isVisible(),true,
          await tab.locator('#accept-status').textContent());
        assert.match(await tab.locator('#accept-details').textContent(),/Creative追加POI/);
        assert.equal(await tab.locator('#accept-x01').isVisible(),true);
        assert.equal(await tab.locator('#accept-x01-choices input[type=checkbox]').count(),0);
        assert.equal(await tab.locator('#accept-x01-zero-label').isVisible(),true);
        await tab.locator('#accept-x01-review').tap();
        assert.match(await tab.locator('#accept-x01-status').textContent(),
          /X01_ZERO_EXPLICIT_CONFIRM_REQUIRED/);
        assert.equal(await tab.evaluate(()=>__distanceImportLabStatus().x01Reviewed),false);
        await tab.locator('#accept-x01-zero').check();
        await tab.locator('#accept-x01-review').tap();
        assert.match(await tab.locator('#accept-x01-status').textContent(),
          /0件.*HOLD/);
        assert.equal(await tab.evaluate(()=>__distanceImportLabStatus().x01Reviewed),true);
        assert.equal(await tab.evaluate(()=>sessionStorage.getItem('campsiteProject.v1')),null);
      };
      await enter(recipient);
      const stale=await ctx.newPage();
      try{
        await enter(stale);
        let cancelOnce=true;
        recipient.on('dialog',d=>{
         if(cancelOnce){cancelOnce=false;d.dismiss();}
         else d.accept();
        });
        stale.on('dialog',d=>d.accept());
        await recipient.locator('#accept-create').tap();
        assert.match(await recipient.locator('#accept-status').textContent(),/保存をキャンセルしました/);
        assert.equal(await recipient.locator('#accept-create').isVisible(),true);
        await recipient.locator('#accept-create').tap();
        await recipient.waitForFunction(()=>document.querySelector('#accept-status')?.textContent.includes('隔離保存成功'));
        assert.match(await recipient.locator('#accept-status').textContent(),/世代 1/);
        await stale.locator('#accept-create').tap();
        await stale.waitForFunction(()=>document.querySelector('#accept-status')?.dataset.kind==='error');
        assert.match(await stale.locator('#accept-status').textContent(),/IDB_LAB_REVISION_CONFLICT/);
        await stale.reload();
        await stale.locator('#accept-project').fill(PROJECT_ID);
        await stale.locator('#accept-handoff').fill(HANDOFF_ID);
        await stale.locator('#accept-reopen').tap();
        await stale.waitForFunction(()=>document.querySelector('#accept-status')?.textContent.includes('再読込・照合しました'));
        assert.match(await stale.locator('#accept-status').textContent(),/世代 1/);
        const remains=await stale.evaluate(async()=>{
          const dbs=await indexedDB.databases();
          return {production:sessionStorage.getItem('campsiteProject.v1'),
            recipientDbExists:dbs.some(x=>x.name==='campsite-creative-next-x01-idb-lab-distance-receiver-20261016'),
            old:localStorage.getItem('next-lab-creative-v7'),
            journal:localStorage.getItem('campsite-creative-next-v1-r31-review-10:current')};
        });
        assert.equal(remains.production,null);
        assert.equal(remains.recipientDbExists,true);
        assert.equal(remains.old,'THREE_FLOW_LEGACY_STAYS');
        assert.equal(remains.journal,'THREE_FLOW_JOURNAL_STAYS');
        await stale.locator('#accept-handoff').fill('handoff:wrong');
        assert.equal(await stale.locator('#accept-reedit').isVisible(),false);
        assert.equal(await stale.locator('#accept-x01').isVisible(),false);
        assert.equal(await stale.evaluate(()=>__distanceImportLabStatus().x01StageReady),false);
        await stale.locator('#accept-handoff').fill(HANDOFF_ID);
        await stale.locator('#accept-reopen').tap();
        await stale.waitForFunction(()=>document.getElementById('accept-status')
         ?.textContent.includes('再読込・照合しました'));
        const receiptBefore=await fromDatabase(stale,RECEIVE_DB);
        // After explicit verified reopen, export the original complete
        // Project+NEW_V1 pair back to the genuine frozen r31 editing screen.
        // The receiving Project row remains read-only and is not replaced.
        assert.equal(await stale.locator('#accept-reedit').isVisible(),true);
        const downloadFromStale=async(selector)=>{
         const promise=stale.waitForEvent('download');
         await stale.locator(selector).tap();
         const file=await promise,chunks=[];
         for await(const part of await file.createReadStream())chunks.push(part);
         return {name:file.suggestedFilename(),bytes:Buffer.concat(chunks)};
        };
        const reeditJson=await downloadFromStale('#accept-project-download');
        const reeditKmz=await downloadFromStale('#accept-kmz-download');
        const reeditZip=await downloadFromStale('#accept-portable-download');
        assert.equal(reeditZip.name,'distance-reedit-test-only.zip');
        const {inspectPortableReturnBundleLab:verifyZip}=await import('../contracts/portable-return-bundle-lab.mjs');
        const zipVerified=await verifyZip({...options,bytes:new Uint8Array(reeditZip.bytes),
         expectedProjectId:PROJECT_ID,expectedHandoffId:HANDOFF_ID});
        assert.deepEqual(zipVerified.project,row.project);
        assert.deepEqual(zipVerified.activityAreas,row.activityAreas);
        assert.deepEqual(Buffer.from(zipVerified.kmzBytes),Buffer.from(row.kmzBytes));
        assert.equal(zipVerified.transportAuthenticated,false);
        assert.equal(reeditJson.name,'distance-reedit-project.json');
        assert.equal(reeditKmz.name,'distance-reedit-new-v1.kmz');
        const json=JSON.parse(reeditJson.bytes.toString('utf8'));
        assert.equal(json.projectId,PROJECT_ID);
        assert.equal(json.currentPois.length,2);
        assert.deepEqual(json,row.project,'downloaded Project must retain every field');
        assert.deepEqual(reeditKmz.bytes,Buffer.from(row.kmzBytes),'NEW_V1 KMZ must be byte-equivalent');
        const editPage=await ctx.newPage();
        let cancelZipOnce=true;
        editPage.on('dialog',d=>{
         if(cancelZipOnce&&d.message().includes('LAB ZIP')){cancelZipOnce=false;d.dismiss();}
         else d.accept();
        });
        try{
         await editPage.goto('https://r31-recipient.invalid/creative-next/qa/r31-project-save-lab/index.html');
         await editPage.waitForFunction(()=>!!document.querySelector('#r31-frame')?.contentWindow?.creativeR31Workspace);
         await editPage.locator('#lab-open').tap();
         await editPage.locator('#lab-zip-project-id').fill(PROJECT_ID);
         await editPage.locator('#lab-zip-handoff-id').fill('handoff:bad');
         await editPage.locator('#lab-zip-file').setInputFiles({
          name:reeditZip.name,mimeType:'application/zip',buffer:reeditZip.bytes});
         await editPage.locator('#lab-zip-import').tap();
         await editPage.waitForFunction(()=>document.querySelector('#lab-status')?.dataset.kind==='error');
         assert.match(await editPage.locator('#lab-status').textContent(),/PORTABLE_IDENTITY_MISMATCH/);
         assert.equal(await editPage.evaluate(()=>document.querySelector('#r31-frame')
          .contentWindow.creativeR31Workspace.workspace.session.state().hasActive),false);
         await editPage.locator('#lab-zip-handoff-id').fill(HANDOFF_ID);
         await editPage.locator('#lab-zip-import').tap();
         await editPage.waitForFunction(()=>document.querySelector('#lab-status')
          ?.textContent.includes('再編集をキャンセルしました'));
         assert.equal(await editPage.evaluate(()=>document.querySelector('#r31-frame')
          .contentWindow.creativeR31Workspace.workspace.session.state().hasActive),false);
         await editPage.locator('#lab-zip-import').tap();
         await editPage.waitForFunction(()=>__r31ProjectSaveLabStatus?.().attached||
          document.getElementById('lab-status')?.dataset.kind==='error');
         const returned=await editPage.evaluate(()=>({
          kind:document.querySelector('#lab-status').dataset.kind,
          records:document.querySelector('#r31-frame')
           .contentWindow.creativeR31Workspace.workspace.session.state().records
         }));
         assert.equal(returned.kind,'ok',await editPage.locator('#lab-status').textContent());
         assert.equal(returned.records.length,2);
         assert.equal(returned.records.some(x=>x.guid==='outer'||x.guid==='reserve'),false);
         await editPage.locator('#lab-close').tap();
         const returnR31=editPage.frameLocator('#r31-frame');
         await returnR31.locator('#cmAddFab').tap();
         await returnR31.locator('.cm-bubble[data-layer="new-gym"]').tap();
         await returnR31.locator('#cmSafeAddConfirm').tap();
         await editPage.waitForFunction(()=>document.querySelector('#r31-frame')
          .contentWindow.creativeR31Workspace.workspace.session.state().records.length===3);
         await editPage.locator('#lab-open').tap();
         await editPage.locator('#lab-save').tap();
         await editPage.waitForFunction(()=>__r31ProjectSaveLabStatus?.().revision===1||
          document.querySelector('#lab-status')?.dataset.kind==='error');
         assert.equal(await editPage.evaluate(()=>__r31ProjectSaveLabStatus().revision),1,
          await editPage.locator('#lab-status').textContent());
         // Re-editing produces a new verified linked pair on the LAB-only Creative origin.
         const nextRaw=await fromDatabase(editPage);
         const successor=await reopenLinkedPairLab({...options,
          pair:{manifest:nextRaw.manifest,kmzBytes:Uint8Array.from(nextRaw.kmzBytes)},
          expectedProjectId:PROJECT_ID,expectedHandoffId:HANDOFF_ID});
         assert.equal(nextRaw.revision,1);
         assert.equal(successor.project.currentPois.length,3);
         assert.equal(successor.project.addedPois.length,2);
         assert.deepEqual(successor.project.wayfarerObservation,input.snapshot);
         assert.deepEqual(successor.project.polygon,row.project.polygon);
         assert.deepEqual(successor.project.sourcePois,row.project.sourcePois);
         assert.deepEqual(successor.project.selectedPois,row.project.selectedPois);
         assert.deepEqual(successor.project.edits,row.project.edits);
         assert.deepEqual(successor.project.syntheticUnknownFuture,row.project.syntheticUnknownFuture);
         assert.deepEqual(successor.activityAreas,row.activityAreas);
         assert.equal(successor.project.currentPois.some(x=>x.guid==='outer'||x.guid==='reserve'),false);
         const nextExport=await createPortableReturnBundleLab({...options,
          project:successor.project,activityAreas:successor.activityAreas,
          kmzBytes:successor.kmzBytes,revision:nextRaw.revision,
          expectedProjectId:PROJECT_ID,expectedHandoffId:HANDOFF_ID});
         const checked=await inspectPortableReturnBundleLab({...options,
          bytes:nextExport.bytes,expectedProjectId:PROJECT_ID,expectedHandoffId:HANDOFF_ID});
         assert.deepEqual(checked.project,successor.project);
         assert.deepEqual(checked.activityAreas,successor.activityAreas);
         assert.deepEqual(Buffer.from(checked.kmzBytes),Buffer.from(successor.kmzBytes));
         assert.equal(checked.productionReady,false);
        }finally{await editPage.close();}
        // Re-editing a separate verified Session cannot silently change
        // the confirmed Campsite receiver's source generation.
        await stale.locator('#accept-reopen').tap();
        await stale.waitForFunction(()=>document.getElementById('accept-status')
         ?.textContent.includes('再読込・照合しました'));
        assert.match(await stale.locator('#accept-status').textContent(),/世代 1/);
        assert.deepEqual(await fromDatabase(stale,RECEIVE_DB),receiptBefore,
         'Campsite-received source generation remains byte-exact');
        // An already accepted Project must remain protected from even an
        // explicit second attempted import. No destructive rollback needed.
        await recipient.goto(ACCEPT_URL);
        await recipient.locator('#accept-project').fill(PROJECT_ID);
        await recipient.locator('#accept-handoff').fill(HANDOFF_ID);
        await recipient.locator('#accept-file').setInputFiles({
         name:'campsite-return-test-only.zip',mimeType:'application/zip',buffer:transferred});
        await recipient.locator('#accept-inspect').tap();
        await recipient.waitForFunction(()=>document.querySelector('#accept-status')?.dataset.kind==='error');
        assert.match(await recipient.locator('#accept-status').textContent(),/DISTANCE_IMPORT_EXISTING_PROTECTED/);
        assert.equal(await recipient.locator('#accept-create').isVisible(),false);
      }finally{await stale.close();}
    }finally{await recipient.close();}
    assert.deepEqual(jsErrors,[]);
    results.push({viewport,status:'PASS',wayfarerPseudoRelay:true,bridgeExporter:true,
     actualR31Ui:true,newPoiUi:true,isolatedIndexedDB:true,returnPairVerified:true,
     returnLabBrowserUiVerified:true,returnWrongHandoffHold:true,
     portableManualExport:true,crossOriginFileReceiver:true,crossOriginReceiverReadOnly:true,
     strictDistancePreflightBrowser:true,
     nonauthoritativeDistanceMathPreview:true,reeditDownloadsVerified:true,
     successorPairRoundTripVerified:true,receiverRevisionUnchanged:true,
     cancelledConfirmationProtected:true,singleZipReeditVerified:true,
     singleZipWrongIdHeld:true,singleZipCancelProtected:true,
     staleReturnDownloadInvalidated:true,x01TypedZeroReviewVerified:true,
     productionReceiverUiTested:false,realWayfarer:false,productionReady:false});
   }finally{await ctx.close();}
  }
 }finally{await browser.close();}
 console.log(JSON.stringify({status:'PASS',browser:ENGINE,results,phase:'HOLD',safariRealDevice:'NOT_TESTED',productionReady:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
