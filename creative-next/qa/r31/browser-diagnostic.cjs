// Diagnostic baseline comparison, not an r31 acceptance claim.
// Reference app executes only with synthetic bytes and memory storage in a new profile.
// Every request is fulfilled from pinned local source/assets or aborted; no network passthrough.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {ROOT,assemble}=require('./production-source.cjs');
const vm=require('node:vm');
const SELECTORS=['#cmFabWrap','#cmAddFab','.cm-bubble','#cmStyle','#cmV58StartTransition','#cmV59HelpButton','#cmV60RulesPanel','#cmRecent','#back','#mapToggle','#layerButton','#toolbox','#save','#undo','#redo'];
const readText=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const mime=file=>({'.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.png':'image/png','.json':'application/json'}[path.extname(file)]||'application/octet-stream');
function captureR30Snapshot(){
 const writes=new Map(),script=path.join(ROOT,'creative-next/qa/build-original-ui-snapshot.cjs');
 const fakeFs={readFileSync(file,encoding){return encoding==='utf8'?readText(file):fs.readFileSync(file);},mkdirSync(){},writeFileSync(file,data){writes.set(path.resolve(file),data);}};
 const ctx=vm.createContext({__dirname:path.dirname(script),console:{log(){}},require(name){
  if(name==='node:fs')return fakeFs;if(name==='node:vm')return vm;if(name==='node:path')return path;throw Error('UNEXPECTED_SNAPSHOT_DEPENDENCY');
 }});
 vm.runInContext(readText(script),ctx,{timeout:10000,filename:script});
 const output=writes.get(path.join(ROOT,'creative-next/original-ui-r30/index.html'));
 if(!output)throw Error('R30_SNAPSHOT_NOT_CAPTURED');return output;
}
async function run(){
 const original=await assemble(),candidateHtml=captureR30Snapshot();
 const {createFreshV1Kmz}=await import('../../phase-1b/core/create-new-kmz.mjs');
 const JSZip=require('jszip'),{DOMParser,XMLSerializer}=require('@xmldom/xmldom');
 const synthetic=(await createFreshV1Kmz({records:[
  {id:'r31-synthetic-existing',role:'existing',kind:'pokestop',title:'合成既存POI',memo:'',lat:35.68,lng:139.76,deleted:false},
  {id:'r31-synthetic-new',role:'new',kind:'gym',title:'合成新規POI',memo:'',lat:35.683,lng:139.763,deleted:false}
 ],activityAreas:[]},{JSZip,DOMParser,XMLSerializer})).bytes;
 const browser=await chromium.launch({channel:process.env.R31_BROWSER_CHANNEL||undefined,headless:true});
 const results=[],out=path.join(__dirname,'artifacts');
 fs.mkdirSync(out,{recursive:true});
 try{
  for(const viewport of [{width:390,height:844},{width:393,height:852},{width:1366,height:768}]){
   const contexts=[];
   try{
    const snapshots={};
    for(const kind of ['reference','r30']){
     const context=await browser.newContext({viewport,isMobile:viewport.width<500,hasTouch:viewport.width<500,serviceWorkers:'block'});
     contexts.push(context);
     await context.addInitScript(()=>{
      const accesses=[],make=()=>{
       const data=new Map();
       return{getItem(key){accesses.push(['read',key]);return data.get(String(key))??null;},
        setItem(key,value){accesses.push(['write',key]);data.set(String(key),String(value));},
        removeItem(key){accesses.push(['remove',key]);data.delete(String(key));},
        clear(){accesses.push(['clear']);data.clear();},key(i){return [...data.keys()][i]??null;},get length(){return data.size;}};
      };
      Object.defineProperty(window,'localStorage',{value:make()});
      Object.defineProperty(window,'sessionStorage',{value:make()});
      window.__r31SyntheticStorageAccesses=accesses;
      Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(_,fail){fail?.({code:1});},watchPosition(){return 0;},clearWatch(){}}});
     });
     const blocked=[];
     await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      let file=null;
      if(url.hostname==='r31.invalid'){
       if(kind==='reference'&&url.pathname==='/creative/index.html')return route.fulfill({status:200,contentType:'text/html',body:original.html});
       if(kind==='r30'&&url.pathname==='/creative-next/original-ui-r30/index.html')return route.fulfill({status:200,contentType:'text/html',body:candidateHtml});
       const decoded=decodeURIComponent(url.pathname);
       file=path.resolve(ROOT,'.'+decoded);
       if(!file.startsWith(ROOT+path.sep)){blocked.push(url.href);return route.abort();}
      }else if(url.href.includes('jszip.min.js'))file=require.resolve('jszip/dist/jszip.min.js');
      else if(url.hostname==='unpkg.com'&&url.pathname.includes('leaflet@1.9.4/dist/')){
       const name=url.pathname.split('/').pop();
       if(['leaflet.js','leaflet.css'].includes(name))file=path.join(path.dirname(require.resolve('leaflet')),name);
      }
      if(file&&fs.existsSync(file)&&fs.statSync(file).isFile()){
       const text=['.js','.mjs','.css','.html','.json'].includes(path.extname(file));
       return route.fulfill({status:200,contentType:mime(file),body:text?readText(file):fs.readFileSync(file)});
      }
      // Deterministic tiles; all external resources remain offline.
      if(/\.(?:png|jpg|jpeg)(?:\?|$)/i.test(url.href)&&(/tile\.openstreetmap|arcgisonline/.test(url.hostname)))
       return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')});
      blocked.push(url.href);return route.abort();
     });
     const page=await context.newPage(),errors=[];
     page.on('pageerror',e=>errors.push(e.message));
     page.on('dialog',d=>d.accept());
     const url=kind==='reference'?'https://r31.invalid/creative/index.html':'https://r31.invalid/creative-next/original-ui-r30/index.html';
     await page.goto(url,{waitUntil:'load'});
     if(kind==='r30')await page.waitForFunction(()=>window.creativeR30Boot==='READY');
     await page.waitForTimeout(150);
     const read=()=>page.evaluate(selectors=>Object.fromEntries(selectors.map(selector=>{
      const nodes=[...document.querySelectorAll(selector)],node=nodes[0],r=node?.getBoundingClientRect(),s=node&&getComputedStyle(node);
      return[selector,{count:nodes.length,box:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,style:s?{display:s.display,fontSize:s.fontSize,fontFamily:s.fontFamily,zIndex:s.zIndex,background:s.background,border:s.border,touchAction:s.touchAction}:null}];
     })),SELECTORS);
     const entry=await read();
     await page.screenshot({path:path.join(out,kind+'-'+viewport.width+'-entry.png'),animations:'disabled'});
     await page.locator('#entryFile').setInputFiles({name:'r31-synthetic.kmz',mimeType:'application/vnd.google-earth.kmz',buffer:Buffer.from(synthetic)});
     await page.waitForFunction(()=>!document.getElementById('startButton').disabled,{timeout:15000});
     await page.locator('#startButton').click();
     await page.waitForFunction(()=>document.getElementById('entry').classList.contains('hidden'),{timeout:15000});
     await page.waitForTimeout(1700);
     const map=await read();
     await page.screenshot({path:path.join(out,kind+'-'+viewport.width+'-map.png'),animations:'disabled'});
     let plusOpened=false,plusActionError=null;
     if(await page.locator('#cmAddFab').count()){
      try{await page.locator('#cmAddFab').click({timeout:1500});plusOpened=await page.locator('#cmFabWrap').evaluate(e=>e.classList.contains('open'));}catch(e){plusActionError=e.message.split('\n')[0];}
     }
     snapshots[kind]={entry,map,plusOpened,plusActionError,errors,blockedRequests:blocked,storageBackend:'synthetic-memory',
      storageAccesses:await page.evaluate(()=>window.__r31SyntheticStorageAccesses.length)};
    }
    const differences=[];
    for(const state of ['entry','map'])for(const selector of SELECTORS){
     const reference=snapshots.reference[state][selector],candidate=snapshots.r30[state][selector];
     if(JSON.stringify(reference)!==JSON.stringify(candidate))differences.push({state,selector,reference,candidate});
    }
    results.push({viewport,status:differences.length?'FAIL':'PASS',scope:'production-versus-existing-r30-diagnostic',differences,snapshots});
   }finally{for(const c of contexts)await c.close();}
  }
 }finally{await browser.close();}
 const report={status:results.every(x=>x.status==='PASS')?'PASS':'FAIL',r31Gate:'NOT_RUN_NO_SEPARATED_RUNTIME',
  reference:'pinned normal production transformations + JP; auth/Bridge excluded',
  candidate:'existing unmodified original-ui-r30',browser:'Chromium engine (Edge channel when configured)',
  pixelComparison:'NOT_RUN; DOM/computed-style diagnostic only',realDeviceSafari:'NOT_TESTED',results};
 fs.writeFileSync(path.join(__dirname,'browser-diagnostic.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,viewports:results.map(x=>({viewport:x.viewport,differences:x.differences.length,referenceErrors:x.snapshots.reference.errors,candidateErrors:x.snapshots.r30.errors}))}));
 return report;
}
module.exports={run};
if(require.main===module)run().then(r=>{process.exitCode=r.status==='PASS'?0:1;}).catch(e=>{console.error(e);process.exitCode=1;});
