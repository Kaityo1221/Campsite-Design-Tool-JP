/* Frozen r31 HTML in iframe + external LAB controls: actual Chromium integration. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const {chromium}=require(path.join(ROOT,'node_modules/playwright'));
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
async function run(){
 const browser=await chromium.launch({headless:true});const result=[];
 const bytes=Buffer.from(await makeKmz());
 try{
  for(const viewport of [{width:390,height:844},{width:393,height:852}]){
   const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block'}),errors=[];
   await context.addInitScript(()=>{
    localStorage.setItem('next-lab-creative-v7','ORIGINAL');
    localStorage.setItem('campsite-creative-next-v1-r31-review-10:current','R31_OLD_JOURNAL');
   });
   await context.route('**/*',async route=>{
    const u=new URL(route.request().url());let file=null;
    if(u.hostname==='r31.invalid')file=path.resolve(ROOT,'.'+decodeURIComponent(u.pathname));
    else if(u.hostname==='unpkg.com'&&/leaflet@1.9.4\/dist\/(leaflet.js|leaflet.css)$/.test(u.pathname))
     file=path.join(path.dirname(require.resolve('leaflet')),path.basename(u.pathname));
    if(file&&file.startsWith(ROOT+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())
     return route.fulfill({status:200,contentType:mime(file),body:fs.readFileSync(file)});
    if(u.hostname.includes('tile.openstreetmap')||u.hostname.includes('arcgisonline'))
     return route.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(path.join(ROOT,'creative-next/qa/r31/fixtures/blue-dot.png'))});
    return route.abort();
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   const decisions=[];page.on('dialog',d=>{decisions.push(d.message());d.accept();});
   try{
    await page.goto(ENTRY_URL);
    await page.waitForFunction(()=>!!document.querySelector('#r31-frame')?.contentWindow?.creativeR31Workspace);
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
        return stage.errors.map(({code})=>code);
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
    await page.waitForFunction(()=>__r31ProjectSaveLabStatus().revision===1&&
      document.querySelector('#r31-frame')?.contentWindow?.creativeR31Workspace?.workspace?.session?.state()?.records?.length===2);
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
    result.push({viewport,status:'PASS',explicitConsent:true,saveAndReopen:true,legacyKeysIntact:true,singleSession:true});
   }finally{await context.close();}
  }
 }finally{await browser.close();}
 console.log(JSON.stringify({status:result.length===2?'PASS':'HOLD',results:result,safariRealDevice:'NOT_TESTED',productionReady:false}));
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
