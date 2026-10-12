/*
 * Isolated real r31 UI browser validation, not a release preview or UI patch.
 * The file picker and add/undo/redo use actual r31 map and B2 handlers.
 * Saving uses a separate explicit LAB call, never a visible production button.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../../..');
const mime=p=>({'.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png'}[path.extname(p)]||'application/octet-stream');
const target='https://r31.invalid/creative-next/original-ui-r31-b3-b4/index.html';
function project(){
 const polygon=[[35.7,139.8],[35.7,139.802],[35.702,139.802],[35.702,139.8]];
 return {schemaVersion:'1.0',source:'bridge',projectId:'r31-ui-browser-project',polygon,
  meta:{projectContract:'campsiteProject.v1',bridgeHandoffId:'handoff:r31-ui-browser'},
  sourcePois:[{guid:'protected-poi'}],selectedPois:[{guid:'protected-poi'}],
  currentPois:[{id:'protected-poi',guid:'protected-poi',role:'existing',gameEntity:'POKESTOP',gameStatus:'ACTIVE',title:'保護POI',lat:35.701,lng:139.801}],
  addedPois:[],deletedPois:[],edits:[],
  wayfarerObservation:{snapshotId:'obs-ui',observedAt:'2026-10-12T06:20:00Z',
   polygon,acquisition:{coverageComplete:true,bufferMeters:200},
   zones:{
    interior:[{guid:'protected-poi',lat:35.701,lng:139.801,poiKind:'POKESTOP',gameEntity:'POKESTOP',gameStatus:'ACTIVE'}],
    reference100:[{guid:'external',lat:35.701,lng:139.799,poiKind:'GYM',gameEntity:'GYM',gameStatus:'ACTIVE'}],
    reserve200:[{guid:'reserve',lat:35.701,lng:139.7986,poiKind:'NOT_IN_GAME',gameEntity:'POWERSPOT',gameStatus:'INACTIVE',referenceKind:'INACTIVE_POWERSPOT'}]
   }},
  future:{hold:['metadata']}
 };
}
async function run(){
 const browser=await chromium.launch({headless:true});
 const reports=[];
 try{
  for(const viewport of [{width:390,height:844},{width:393,height:852}]){
   const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block'}),errors=[];
   await context.addInitScript(()=>{
    localStorage.setItem('next-lab-creative-v7','ORIGINAL_SAFE');
    localStorage.setItem('campsite-creative-next-v1-r31-review-8-9:current','PRIOR_PREVIEW_SAFE');
   });
   await context.route('**/*',async route=>{
    const u=new URL(route.request().url());
    let file=null;
    if(u.hostname==='r31.invalid')file=path.resolve(ROOT,'.'+decodeURIComponent(u.pathname));
    else if(u.hostname==='unpkg.com'&&/leaflet@1.9.4\/dist\/(leaflet.js|leaflet.css)$/.test(u.pathname))
      file=path.join(path.dirname(require.resolve('leaflet')),path.basename(u.pathname));
    if(file&&file.startsWith(ROOT+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())
     return route.fulfill({status:200,contentType:mime(file),body:fs.readFileSync(file)});
    if(u.hostname.includes('tile.openstreetmap')||u.hostname.includes('arcgisonline'))
     return route.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(path.join(ROOT,'creative-next/qa/r31/fixtures/blue-dot.png'))});
    return route.abort();
   });
   const page=await context.newPage();
   page.on('pageerror',e=>errors.push(e.message));
   page.on('dialog',d=>d.accept());
   try{
    await page.goto(target);
    await page.waitForFunction(()=>!!window.creativeR31Workspace);
    const source=await page.evaluate(async()=>{
     const {createFreshV1Kmz}=await import('/creative-next/phase-1b/core/create-new-kmz.mjs');
     return Array.from((await createFreshV1Kmz({records:[
      {id:'source-record',role:'existing',guid:'protected-poi',kind:'pokestop',title:'保護POI',memo:'original',lat:35.701,lng:139.801}
     ],activityAreas:[]},{JSZip,DOMParser,XMLSerializer})).bytes);
    });
    const src=Buffer.from(source);
    await page.locator('#entryFile').setInputFiles({name:'synthetic-original.kmz',mimeType:'application/vnd.google-earth.kmz',buffer:src});
    await page.waitForFunction(()=>!document.getElementById('startButton').disabled);
    await page.locator('#startButton').tap();
    await page.waitForFunction(()=>document.getElementById('entry').classList.contains('hidden'));
    assert.equal(await page.evaluate(()=>creativeR31Workspace.workspace.status().sessionCount),1);
    const dbName='campsite-creative-next-x01-idb-lab-r31-real-ui-'+viewport.width;
    const started=await page.evaluate(async({p,source,dbName})=>{
     const {createX01IndexedDbSaveLab}=await import('/creative-next/contracts/x01-indexeddb-save-lab.mjs');
     const {createR31SessionIndexedDbLab}=await import('/creative-next/contracts/r31-session-indexeddb-lab.mjs');
     window.__uiLabStore=createX01IndexedDbSaveLab({indexedDB,dbName,JSZip,DOMParser,cryptoProvider:crypto});
     window.__uiLab=createR31SessionIndexedDbLab({workspace:creativeR31Workspace.workspace,store:__uiLabStore,
      JSZip,DOMParser,cryptoProvider:crypto});
     return __uiLab.attachLive({project:p,kmzBytes:new Uint8Array(source),expectedProjectId:p.projectId,
      expectedHandoffId:p.meta.bridgeHandoffId,revision:0,confirmed:true});
    },{p:project(),source,dbName});
    assert.equal(started.status,'LAB_R31_ATTACHED');
    await page.evaluate(()=>creativeR31.setCamera({center:[35.7012,139.8013],zoom:17}));
    await page.locator('#cmAddFab').tap();
    await page.locator('.cm-bubble[data-layer="new-gym"]').tap();
    await page.locator('#cmSafeAddConfirm').tap();
    await page.waitForFunction(()=>creativeR31Workspace.workspace.session.state().records.some(x=>x.role==='new'));
    const before=await page.evaluate(()=>creativeR31Workspace.workspace.session.state());
    await page.locator('#undo').tap();
    await page.locator('#redo').tap();
    assert.deepEqual(await page.evaluate(()=>creativeR31Workspace.workspace.session.state()),before,'UI undo redo actual Session history');
    const result=await page.evaluate(()=>__uiLab.save({confirmed:true}));
    assert.equal(result.status,'LAB_R31_SAVED');
    assert.equal(result.revision,1);
    const stored=await page.evaluate(async()=>{const s=await __uiLabStore.read({expectedProjectId:'r31-ui-browser-project',expectedHandoffId:'handoff:r31-ui-browser'});return {
     kmz:Array.from(s.kmzBytes),project:s.project,areas:s.activityAreas,revision:s.revision
    };});
    assert.equal(stored.project.currentPois.length,2);
    assert.equal(stored.project.polygon.length,4);
    assert.equal(stored.project.wayfarerObservation.zones.reserve200[0].gameStatus,'INACTIVE');
    await page.evaluate(()=>{__uiLab.dispose();creativeR31Workspace.dispose();});
    await page.reload();
    await page.waitForFunction(()=>!!window.creativeR31Workspace);
    assert.equal(await page.evaluate(()=>creativeR31Workspace.workspace.session.state().hasActive),false);
    await page.locator('#entryFile').setInputFiles({name:'synthetic-reopened.kmz',mimeType:'application/vnd.google-earth.kmz',buffer:Buffer.from(stored.kmz)});
    await page.waitForFunction(()=>!document.getElementById('startButton').disabled);
    await page.locator('#startButton').tap();
    await page.waitForFunction(()=>document.getElementById('entry').classList.contains('hidden'));
    const reopened=await page.evaluate(async({stored,dbName})=>{
     const {createX01IndexedDbSaveLab}=await import('/creative-next/contracts/x01-indexeddb-save-lab.mjs');
     const {createR31SessionIndexedDbLab}=await import('/creative-next/contracts/r31-session-indexeddb-lab.mjs');
     const store=createX01IndexedDbSaveLab({indexedDB,dbName,JSZip,DOMParser,cryptoProvider:crypto});
     window.__uiLab=createR31SessionIndexedDbLab({workspace:creativeR31Workspace.workspace,store,JSZip,DOMParser,cryptoProvider:crypto});
     await __uiLab.attachLive({project:stored.project,kmzBytes:new Uint8Array(stored.kmz),
      expectedProjectId:stored.project.projectId,expectedHandoffId:stored.project.meta.bridgeHandoffId,
      revision:stored.revision,confirmed:true});
     const s=creativeR31Workspace.workspace.session.state();
     return {records:s.records.map(x=>({role:x.role,title:x.title})),areas:s.areas.length,
      history:s.history,count:creativeR31Workspace.workspace.status().sessionCount,
      previous:localStorage.getItem('next-lab-creative-v7'),
      older:localStorage.getItem('campsite-creative-next-v1-r31-review-8-9:current')};
    },{stored,dbName});
    assert.equal(reopened.records.length,2);
    assert(reopened.records.some(p=>p.role==='new'));
    assert.deepEqual(reopened.history,{undo:0,redo:0});
    assert.equal(reopened.count,1);
    assert.equal(reopened.previous,'ORIGINAL_SAFE');
    assert.equal(reopened.older,'PRIOR_PREVIEW_SAFE');
    assert.deepEqual(errors,[]);
    reports.push({viewport,status:'PASS',realUiImport:true,actualUiAddUndoRedo:true,idbSaveReload:true,singleSession:true});
   }finally{await context.close();}
  }
 }finally{await browser.close();}
 const result={status:reports.length===2?'PASS':'HOLD',reports,safariRealDevice:'NOT_TESTED',productionReady:false};
 console.log(JSON.stringify(result));return result;
}
if(require.main===module)run().then(x=>process.exitCode=x.status==='PASS'?0:1).catch(e=>{console.error(e);process.exitCode=1;});
