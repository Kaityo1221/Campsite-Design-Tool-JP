const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../../..'),OUT=__dirname;
const mime=p=>({'.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png'}[path.extname(p)]||'application/octet-stream');
async function run(){
 const browser=await chromium.launch({channel:process.env.R31_BROWSER_CHANNEL||undefined,headless:true}),results=[];
 try{for(const viewport of [{width:390,height:844},{width:393,height:852},{width:1366,height:768}]){
  const context=await browser.newContext({viewport,isMobile:viewport.width<500,hasTouch:true,acceptDownloads:true,serviceWorkers:'block'}),errors=[],requests=[];
  await context.addInitScript(()=>{
   const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
   set.call(localStorage,'next-lab-creative-v7','ORIGINAL');set.call(localStorage,'other-preview','UNTOUCHED');
   window.__storageCalls=[];window.__mapStarts=0;
   Storage.prototype.getItem=function(k){__storageCalls.push(['get',k]);return get.call(this,k);};
   Storage.prototype.setItem=function(k,v){__storageCalls.push(['set',k]);return set.call(this,k,v);};
   window.__oldStorage=()=>[get.call(localStorage,'next-lab-creative-v7'),get.call(localStorage,'other-preview')];
  });
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());requests.push(url.href);let file;
   if(url.hostname==='r31.invalid')file=path.resolve(ROOT,'.'+decodeURIComponent(url.pathname));
   else if(url.hostname==='unpkg.com'&&/leaflet@1.9.4\/dist\/(leaflet.js|leaflet.css)$/.test(url.pathname))file=path.join(path.dirname(require.resolve('leaflet')),path.basename(url.pathname));
   else if(url.hostname==='maps.google.com'&&/\/(blue|purple|yellow)-dot.png$/.test(url.pathname))file=path.join(ROOT,'creative-next/qa/r31/fixtures',path.basename(url.pathname));
   if(file&&file.startsWith(ROOT+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
    let body=fs.readFileSync(file);if(url.pathname.endsWith('/leaflet.js'))body=Buffer.concat([body,Buffer.from('\n;(()=>{const make=L.map;L.map=(...args)=>{__mapStarts++;return make(...args)}})();')]);
    return route.fulfill({status:200,contentType:mime(file),body});
   }
   // Network is denied. These inert fixtures stand in only for presentation assets.
   if(/tile\.openstreetmap|arcgisonline/.test(url.hostname))return route.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(path.join(ROOT,'creative-next/qa/r31/fixtures/blue-dot.png'))});
   return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  try{
   await page.goto('https://r31.invalid/creative-next/original-ui-r31-b3-b4/index.html');await page.waitForFunction(()=>!!window.creativeR31Workspace);
   assert.equal(await page.locator('#startButton').isDisabled(),true);
   const input=Buffer.from(await page.evaluate(async()=>{const {createFreshV1Kmz}=await import('/creative-next/phase-1b/core/create-new-kmz.mjs');const bytes=(await createFreshV1Kmz({records:[{id:'protected',role:'existing',kind:'pokestop',title:'原本合成',memo:'変更不可',lat:35.7,lng:139.8}],activityAreas:[]},{JSZip,DOMParser,XMLSerializer})).bytes;return Array.from(bytes);}));
   await page.locator('#entryFile').setInputFiles({name:'original.kmz',mimeType:'application/vnd.google-earth.kmz',buffer:input});await page.locator('#startButton').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('startButton').disabled);
   assert.equal(await page.evaluate(()=>creativeR31Workspace.workspace.session.state().hasActive),false);
   await page.locator('#entryFile').setInputFiles([]);assert.equal(await page.locator('#startButton').isDisabled(),true);
   await page.locator('#entryFile').setInputFiles({name:'unsafe.kmz',mimeType:'application/vnd.google-earth.kmz',buffer:Buffer.from('<!DOCTYPE kml><kml/>')});await page.waitForFunction(()=>/REJECT|HOLD/.test(document.getElementById('entryState').textContent));assert.equal(await page.locator('#startButton').isDisabled(),true);
   await page.locator('#entryFile').setInputFiles({name:'original.kmz',mimeType:'application/vnd.google-earth.kmz',buffer:input});await page.waitForFunction(()=>!document.getElementById('startButton').disabled);await page.locator('#startButton').tap();await page.waitForFunction(()=>document.getElementById('entry').classList.contains('hidden'));
   await page.evaluate(()=>creativeR31.setCamera({center:[35.702,139.802],zoom:17}));
   await page.locator('#cmAddFab').tap();await page.locator('.cm-bubble[data-layer="new-gym"]').tap();
   // Frozen presentation hides Save during placement. Do not force hidden controls.
   assert.equal(await page.locator('#cmStandaloneSaveButton').isVisible(),false);
   assert.equal(await page.evaluate(()=>creativeR31Workspace.workspace.status().revision),null);
   await page.locator('#cmSafeAddConfirm').tap();const poi=await page.evaluate(()=>creativeR31Workspace.workspace.session.state().records.find(p=>p.role==='new').id);
   await page.evaluate(poi=>creativeR31.openSheet(poi),poi);await page.locator('#cmName').fill('保存された新規');await page.locator('#cmName').press('Enter');await page.locator('.cm-sheet-close').tap();
   await page.locator('#cmStandaloneSaveButton').tap();await page.locator('#cmR31DraftSave').tap();await page.waitForFunction(()=>creativeR31Workspace.workspace.status().revision===1);await page.locator('#cmStandaloneClose').tap();
   const before=await page.evaluate(()=>creativeR31Workspace.workspace.session.state());await page.locator('#undo').tap();await page.locator('#redo').tap();assert.deepEqual(await page.evaluate(()=>creativeR31Workspace.workspace.session.state()),before);
   await page.locator('#back').tap();assert.equal(await page.locator('#startButton').isEnabled(),true);await page.locator('#startButton').tap();await page.waitForFunction(()=>document.getElementById('entry').classList.contains('hidden'));assert.deepEqual(await page.evaluate(()=>creativeR31Workspace.workspace.session.state()),before);
   // Export is triggered only by an explicit new-file download; destination replacement holds.
   await page.locator('#cmStandaloneSaveButton').tap();await page.locator('#cmStandaloneKmz').tap();
   const buttons=page.locator('#cmV73SaveChooser button');assert.equal(await buttons.count(),3);
   await buttons.nth(0).tap();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('原本の上書き'));
   const event=page.waitForEvent('download');await buttons.nth(1).tap();const download=await event;
   assert.equal(download.suggestedFilename(),'creative-next-r31-edited.kmz');const output=fs.readFileSync(await download.path());
   const JSZip=require('jszip'),{DOMParser}=require('@xmldom/xmldom'),{stageKmlInput}=await import('../../phase-1b/core/stage-kmz.mjs');const stage=await stageKmlInput(new Uint8Array(output),{JSZip,DOMParser});assert.deepEqual(stage.errors,[]);assert.equal(stage.places.filter(p=>p.geometry==='Point').length,2);assert.equal(stage.places.find(p=>p.name==='原本合成').coordinates,'139.8,35.7');
   assert.deepEqual(await page.evaluate(()=>creativeR31Workspace.workspace.session.state()),before);
   // Genuine same-origin localStorage persists across navigation, unlike an in-memory UI fixture.
   await page.evaluate(()=>creativeR31Workspace.dispose());await page.reload();await page.waitForFunction(()=>!!window.creativeR31Workspace&&document.getElementById('resumeButton').style.display!=='none');assert.equal(await page.evaluate(()=>creativeR31Workspace.workspace.session.state().hasActive),false);
   await page.locator('#resumeButton').tap();await page.waitForFunction(()=>creativeR31Workspace.workspace.session.state().hasActive&&document.getElementById('entry').classList.contains('hidden'));
   const restored=await page.evaluate(()=>creativeR31Workspace.workspace.session.state());assert.deepEqual(restored.records,before.records);assert.deepEqual(restored.history,{undo:0,redo:0});
   await page.evaluate(()=>creativeR31.openSheet('protected'));await page.locator('.cm-sheet').waitFor({state:'visible'});assert.equal(await page.locator('.cm-sheet input,.cm-sheet textarea,#cmMove,#cmType,#cmDelete').count(),0);await page.locator('.cm-sheet-close').tap();
   const safe=await page.evaluate(()=>({calls:__storageCalls,old:__oldStorage(),mapStarts:__mapStarts,sessionCount:creativeR31Workspace.workspace.status().sessionCount}));assert(safe.calls.every(([,k])=>k.startsWith('campsite-creative-next-v1-r31-b3-b4:')));assert.deepEqual(safe.old,['ORIGINAL','UNTOUCHED']);assert.equal(safe.mapStarts,1);assert.equal(safe.sessionCount,1);
   await page.evaluate(()=>creativeR31Workspace.dispose());const disposed=await page.evaluate(()=>({ui:creativeR31.status(),workspace:creativeR31Workspace.status()}));assert.equal(disposed.ui.mapCount,0);assert(Object.values(disposed.ui.resources).every(n=>n===0));assert.equal(disposed.workspace.objectUrls,0);assert.equal(disposed.workspace.workspace.sessionCount,0);assert.deepEqual(errors,[]);assert(!requests.some(u=>u.includes('/creative/runtime/')||u.includes('/creative/index.html')));
   results.push({viewport,status:'PASS',singleSession:true,singleMap:true,isolatedStorage:true,downloadReimport:true,restore:true,teardown:true});
  }catch(e){results.push({viewport,status:'HOLD',error:e.stack,errors,diagnostic:await page.evaluate(()=>({entry:document.getElementById('entryState')?.textContent,message:document.getElementById('status')?.textContent,status:window.creativeR31Workspace?.status()})).catch(()=>null)});break;}
  finally{await context.close();}
 }}finally{await browser.close();}
 const report={status:results.length===3&&results.every(r=>r.status==='PASS')?'PASS':'HOLD',safariRealDevice:'NOT_TESTED',results};fs.writeFileSync(path.join(OUT,'browser-result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));return report;
}
module.exports={run};if(require.main===module)run().then(r=>process.exitCode=r.status==='PASS'?0:1).catch(e=>{console.error(e);process.exitCode=1;});
