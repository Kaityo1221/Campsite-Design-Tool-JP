const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../../..');
const mime=p=>({'.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png'}[path.extname(p)]||'application/octet-stream');
async function run(){
 const browser=await chromium.launch({headless:true}),results=[];
 try{
 for(const viewport of [{width:390,height:844},{width:393,height:852}]){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,acceptDownloads:true,serviceWorkers:'block'});
  const errors=[];
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());let file=null;
   if(u.hostname==='r31.invalid')file=path.resolve(ROOT,'.'+decodeURIComponent(u.pathname));
   if(u.hostname==='unpkg.com'&&/leaflet@1.9.4\/dist\/(leaflet.js|leaflet.css)$/.test(u.pathname))
    file=path.join(path.dirname(require.resolve('leaflet')),path.basename(u.pathname));
   if(u.hostname==='maps.google.com'&&/\/(blue|yellow|purple)-dot.png$/.test(u.pathname))
    file=path.join(ROOT,'creative-next/qa/r31/fixtures/blue-dot.png');
   if(file&&file.startsWith(ROOT+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())
    return route.fulfill({status:200,contentType:mime(file),body:fs.readFileSync(file)});
   if(/tile\.openstreetmap|arcgisonline/.test(u.hostname))
    return route.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(path.join(ROOT,'creative-next/qa/r31/fixtures/blue-dot.png'))});
   return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
  try{
   await page.goto('https://r31.invalid/creative-next/original-ui-r31-b3-b4/index.html');
   await page.waitForFunction(()=>!!window.creativeR31Workspace,{timeout:15000});
   const buf=Buffer.from(await page.evaluate(async()=>{
    const {createFreshV1Kmz}=await import('/creative-next/phase-1b/core/create-new-kmz.mjs');
    const bytes=(await createFreshV1Kmz({records:[{id:'original',role:'existing',kind:'pokestop',title:'既存A',memo:'元のまま',lat:35.7,lng:139.8}],activityAreas:[{id:'area-source-original',points:[[35.7,139.8],[35.702,139.8],[35.702,139.802]]}]},{JSZip,DOMParser,XMLSerializer})).bytes;
    return Array.from(bytes);
   }));
   await page.locator('#entryFile').setInputFiles({name:'review.kmz',mimeType:'application/vnd.google-earth.kmz',buffer:buf});
   await page.waitForFunction(()=>!document.getElementById('startButton').disabled);
   await page.locator('#startButton').tap();await page.waitForFunction(()=>document.getElementById('entry').classList.contains('hidden'));
   const baseline=await page.evaluate(()=>creativeR31Workspace.workspace.session.state());
   await page.locator('#cmAddFab').tap();
   await page.locator('.cm-bubble[data-layer="new-gym"]').tap();
   await page.locator('#cmSafeAddConfirm').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>creativeR31.status().ui.layer),'new-gym');
   await page.evaluate(()=>creativeR31.setCamera({center:[35.706,139.806],zoom:18}));
   await page.locator('#cmSafeAddConfirm').tap();
   assert.equal((await page.evaluate(()=>creativeR31Workspace.workspace.session.state().records.filter(p=>p.role==='new'&&p.kind==='gym'))).length,1);
   await page.locator('#layerButton').tap();
   assert.equal(await page.locator('#layerRows button', {hasText:'活動範囲'}).count(),0);
   await page.locator('#layerButton').tap();
   await page.locator('#cmStandaloneSaveButton').tap();
   assert.equal(await page.locator('#cmR31DraftSave').count(),0);
   await page.locator('#cmStandaloneKmz').tap();
   assert.equal(await page.locator('#cmV73SaveChooser button').count(),2);
   assert.equal(await page.locator('#cmV73SaveChooser button', {hasText:'保存先を選ぶ'}).count(),0);
   const downloadEvent=page.waitForEvent('download');
   await page.locator('#cmV73SaveChooser button', {hasText:'ダウンロード'}).tap();
   const download=await downloadEvent;assert.equal(download.suggestedFilename(),'creative-next-r31-edited.kmz');
   assert(fs.statSync(await download.path()).size>200);
   await page.locator('#toolbox').tap();await page.locator('#toolMenu button[data-tool="ruler"]').tap();
   assert.equal(await page.evaluate(()=>creativeR31.status().ui.tool),'ruler');
   await page.evaluate(()=>creativeR31.openSheet('original'));
   assert.equal(await page.locator('.cm-sheet').count(),1);
   // Simulate a true Leaflet POI click: marker should act as a ruler tap, not reopen the details.
   await page.evaluate(()=>{document.querySelector('.cm-sheet-close').click();});
   await page.locator('.leaflet-marker-icon').first().tap();
   assert.equal(await page.locator('.cm-sheet').count(),0);
   assert.equal(await page.evaluate(()=>creativeR31.status().ui.tool),'ruler');
   await page.locator('#cmRulerExit').tap().catch(async()=>{await page.locator('#toolbox').tap();});
   await page.locator('#toolbox').tap();await page.locator('#toolMenu button[data-tool="polygon"]').tap();
   await page.locator('button', {hasText:'描き直す'}).last().tap();
   assert.deepEqual(await page.evaluate(()=>creativeR31Workspace.workspace.session.state().areas),baseline.areas);
   assert.equal(await page.evaluate(()=>creativeR31.status().ui.tool),'polygon');
   // The X control cancels only the draft. It may not delete the source area.
   await page.locator('#cmR31AreaCancel').tap();
   assert.deepEqual(await page.evaluate(()=>creativeR31Workspace.workspace.session.state().areas),baseline.areas);
   assert.equal(await page.evaluate(()=>creativeR31.status().ui.tool),'');
   await page.locator('#toolbox').tap();await page.locator('#toolMenu button[data-tool="polygon"]').tap();
   await page.locator('button', {hasText:'削除する'}).last().tap();
   await page.locator('button', {hasText:'削除をキャンセル'}).tap();
   assert.deepEqual(await page.evaluate(()=>creativeR31Workspace.workspace.session.state().areas),baseline.areas);
   assert.equal(await page.evaluate(()=>creativeR31.status().ui.tool),'');
   assert.deepEqual(errors,[],'browser errors: '+JSON.stringify(errors));
   results.push({viewport,status:'PASS'});
  }finally{await context.close();}
 }
 }finally{await browser.close();}
 console.log(JSON.stringify({status:'PASS',results}));
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
