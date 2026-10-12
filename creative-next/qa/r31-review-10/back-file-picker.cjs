const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../../..');
const mime=p=>({'.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png'}[path.extname(p)]||'application/octet-stream');
async function run(){
 const browser=await chromium.launch({headless:true}),results=[];
 try{
  for(const viewport of [{width:390,height:844},{width:393,height:852}]){
   const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block'}),errors=[];
   await context.addInitScript(()=>{
    localStorage.setItem('next-lab-creative-v7','ORIGINAL');
    window.__starts=0;
    window.__oldData=()=>localStorage.getItem('next-lab-creative-v7');
   });
   await context.route('**/*',async route=>{
    const u=new URL(route.request().url());let file=null;
    if(u.hostname==='r31.invalid')file=path.resolve(ROOT,'.'+decodeURIComponent(u.pathname));
    else if(u.hostname==='unpkg.com'&&u.pathname.includes('/leaflet@1.9.4/dist/')&&(u.pathname.endsWith('/leaflet.js')||u.pathname.endsWith('/leaflet.css')))
     file=path.join(path.dirname(require.resolve('leaflet')),path.basename(u.pathname));
    else if(u.hostname==='maps.google.com'&&['blue-dot.png','yellow-dot.png','purple-dot.png'].some(x=>u.pathname.endsWith('/'+x)))
     file=path.join(ROOT,'creative-next/qa/r31/fixtures/blue-dot.png');
    if(file&&file.startsWith(ROOT+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
     let body=fs.readFileSync(file);
     if(u.pathname.endsWith('/leaflet.js'))
      body=Buffer.concat([body,Buffer.from('\n;(()=>{const f=L.map;L.map=(...a)=>{__starts++;return f(...a);}})();')]);
     return route.fulfill({status:200,contentType:mime(file),body});
    }
    if(u.hostname.includes('tile.openstreetmap')||u.hostname.includes('arcgisonline'))
     return route.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(path.join(ROOT,'creative-next/qa/r31/fixtures/blue-dot.png'))});
    return route.abort();
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   let acceptSwitch=false,confirmCount=0;
   page.on('dialog',async d=>{confirmCount++;if(acceptSwitch)await d.accept();else await d.dismiss();});
   try{
    await page.goto('https://r31.invalid/creative-next/original-ui-r31-b3-b4/index.html');
    await page.waitForFunction(()=>!!window.creativeR31Workspace);
    const files=await page.evaluate(async()=>{
     const {createFreshV1Kmz}=await import('/creative-next/phase-1b/core/create-new-kmz.mjs');
     const make=async(id,title)=>{
      const bytes=(await createFreshV1Kmz({records:[{id,role:'existing',kind:'pokestop',title,memo:'保護',lat:35.7,lng:139.8}],activityAreas:[]},{JSZip,DOMParser,XMLSerializer})).bytes;
      return Array.from(bytes);
     };
     return [await make('old-poi','元の編集'),await make('new-poi','別の編集')];
    });
    const asFile=(name,bytes)=>({name,mimeType:'application/vnd.google-earth.kmz',buffer:Buffer.from(bytes)});
    await page.locator('#entryFile').setInputFiles(asFile('old.kmz',files[0]));
    await page.waitForFunction(()=>!document.getElementById('startButton').disabled);
    await page.locator('#startButton').tap();
    await page.waitForFunction(()=>document.getElementById('entry').classList.contains('hidden'));
    await page.evaluate(()=>window.__oldMount=creativeR31Workspace);
    const original=await page.evaluate(()=>creativeR31Workspace.workspace.session.state());
    assert.equal(original.records[0].id,'old-poi');

    // Return to the entry. The picker must be tappable and Continue must still work.
    await page.locator('#back').tap();
    assert.equal(await page.locator('#entryFile').isEnabled(),true,'file picker stays usable on return');
    assert.equal(await page.locator('#startButton').isEnabled(),true);
    await page.locator('#entryFile').setInputFiles(asFile('new.kmz',files[1]));
    assert.equal(confirmCount,1);
    assert.deepEqual(await page.evaluate(()=>creativeR31Workspace.workspace.session.state()),original,'cancel preserves active state');
    assert.equal(await page.evaluate(()=>creativeR31Workspace===__oldMount),true,'cancel preserves same workspace');
    await page.locator('#startButton').tap();
    await page.waitForFunction(()=>document.getElementById('entry').classList.contains('hidden'));
    assert.deepEqual(await page.evaluate(()=>creativeR31Workspace.workspace.session.state()),original);
    await page.locator('#back').tap();

    // A second choice must fire even after cancelling the first dialog.
    acceptSwitch=true;
    await page.locator('#entryFile').setInputFiles(asFile('new.kmz',files[1]));
    await page.waitForFunction(()=>creativeR31Workspace!==__oldMount);
    await page.waitForFunction(()=>document.getElementById('startButton').disabled===false);
    assert.equal(confirmCount,2);
    const state=await page.evaluate(()=>({
     oldStopped:__oldMount.status().workspace.stopped,
     oldMap:__oldMount.ui.status().mapCount,
     newSessionCount:creativeR31Workspace.status().workspace.sessionCount,
     newHasActive:creativeR31Workspace.workspace.session.state().hasActive,
     filename:document.getElementById('entryFileName').textContent,
     starts:__starts,oldData:__oldData()
    }));
    assert.equal(state.oldStopped,true);
    assert.equal(state.oldMap,0);
    assert.equal(state.newSessionCount,1);
    assert.equal(state.newHasActive,false,'new file must not auto-accept');
    assert.equal(state.filename,'new.kmz');
    assert.equal(state.starts,2,'one map per workspace, sequentially');
    assert.equal(state.oldData,'ORIGINAL','legacy storage unchanged');

    await page.locator('#startButton').tap();
    await page.waitForFunction(()=>document.getElementById('entry').classList.contains('hidden'));
    const next=await page.evaluate(()=>creativeR31Workspace.workspace.session.state());
    assert.equal(next.records[0].id,'new-poi');
    assert.equal(next.records.some(p=>p.id==='old-poi'),false);
    assert.deepEqual(errors,[]);
    results.push({viewport,status:'PASS',cancelPreserves:true,freshSession:true,singleLiveMap:true});
   }finally{await context.close();}
  }
 }finally{await browser.close();}
 console.log(JSON.stringify({status:'PASS',results}));
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
