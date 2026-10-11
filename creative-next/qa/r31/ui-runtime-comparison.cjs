// Actual production-reference vs r31 presentation runtime, fully offline synthetic contexts.
// This is PART A UI testing: r31 receives a read-only synthetic view, never a Next Session.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{PNG}=require('pngjs');
const {ROOT,assemble,scripts}=require('./production-source.cjs');
const {build}=require('./source-ui-compiler.cjs');
const FIXED_TILE=(()=>{const p=new PNG({width:256,height:256});for(let i=0;i<p.data.length;i+=4){p.data[i]=230;p.data[i+1]=236;p.data[i+2]=234;p.data[i+3]=255;}return PNG.sync.write(p);})();
const FOCUS={
 entry:['.entry-title','.entry-copy','.filebar','#leftHand','#rightHand','#startButton','#resumeButton','#cmRecent','#cmV58StartTransition'],
 map:['#map','#back','#mapToggle','#layerButton','#toolbox','#cmStandaloneSaveButton','#cmCount','#cmAddFab'],
 plus:['#cmFabWrap','.cm-bubble','#cmSelectedType'],
 add:['#cmSafeAddBar','#cmSafeAddDot','#cmSafeAddLever','#cmSafeAddConfirm','#cmSafeAddCancel'],
 sheet:['.cm-sheet','#cmName','#cmMemo','#cmMove','#cmType','#cmDelete'],
 move:['#cmMoveBar','#cmMoveCrosshair','#cmMoveLever','#cmMoveConfirm','#cmMoveCancel'],
 help:['#cmV59HelpButton','#cmV60RulesPanel','#cmV60RulesTrack','#cmV60RulesDots'],
 save:['#cmStandaloneSaveButton','#cmStandaloneSaveMenu','#cmStandaloneKmz','#cmStandaloneCoords']
};
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const mime=file=>({'.js':'application/javascript','.mjs':'application/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.webp':'image/webp'}[path.extname(file)]||'application/octet-stream');
function instrumentReference(html){
 const core=scripts(html).find(s=>s.id==='production-core'),end=core.code.lastIndexOf('})();');
 if(end<0)throw Error('REFERENCE_PROBE_TARGET_MISSING');
 const probe="window.__r31ReferenceProbe={view:()=>({pois:records.filter(r=>!r.deleted).map(r=>({id:r.id,role:cmIsNew(r)?'new':'existing',kind:r.layer.includes('gym')?'gym':r.layer.includes('power')?'power':'pokestop',title:r.title||'',memo:r.memo||'',lat:r.latlng[0],lng:r.latlng[1],deleted:false})),circles:circleExtras.map(radius=>({radius})),areas:polygons.filter(p=>!p.deleted).map(p=>({id:p.id,points:p.points})),history:{undo:undoStack.length,redo:redoStack.length}}),openSheet:id=>cmOpenRecord(records.find(r=>r.id===id)),setHand:h=>setHand(h),camera:()=>({center:[map.getCenter().lat,map.getCenter().lng],zoom:map.getZoom()}),setCamera:c=>map.setView(c.center,c.zoom,{animate:false,reset:true}),chooser:()=>showSaveChooser(null,'synthetic.kmz'),transition:()=>{entry.classList.remove('hidden');cmV58NewEntryTransition(beginEditor)},feedback:p=>cmV46FlyStarToCount({latlng:[p.lat,p.lng]}),fixtureArea:points=>{polygons=points.length?[{id:'qa-area',points,deleted:false}]:[];polygonVisible=!!points.length;drawAll();renderLayerPanel()},layoutState:()=>({centerCached:!!map._lastCenter}),toolState:()=>({tool:activeTool,radii:circleExtras,points:polyDraft,closing:polyClosing,dragging:map.dragging.enabled(),touchZoom:map.touchZoom.enabled()})};\n";
 return html.replace(core.code,core.code.slice(0,end)+probe+core.code.slice(end));
}
async function contextFor(browser,viewport,kind,reference){
 const context=await browser.newContext({viewport,isMobile:viewport.width<500,hasTouch:true,serviceWorkers:'block'});
 await context.addInitScript(({referenceOnly})=>{
  const accesses=[],make=()=>{const data=new Map();return{getItem(k){accesses.push(['get',k]);return data.get(k)??null;},setItem(k,v){accesses.push(['set',k]);data.set(k,String(v));},removeItem(k){accesses.push(['remove',k]);data.delete(k);},clear(){accesses.push(['clear']);data.clear();},key(i){return [...data.keys()][i]??null;},get length(){return data.size;}};};
  Object.defineProperty(window,'localStorage',{value:make()});Object.defineProperty(window,'sessionStorage',{value:make()});
  window.__r31Storage=accesses;window.__r31Requests=[];
  window.__r31MapStarts=0;
  if(!referenceOnly){
   const active=[],add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
   EventTarget.prototype.addEventListener=function(type,fn,options){const capture=typeof options==='boolean'?options:!!options?.capture;if(new Error().stack.includes('/original-ui-r31/ui-runtime.mjs')&&!active.some(x=>x.target===this&&x.type===type&&x.fn===fn&&x.capture===capture))active.push({target:this,type,fn,capture});return add.call(this,type,fn,options);};
   EventTarget.prototype.removeEventListener=function(type,fn,options){const capture=typeof options==='boolean'?options:!!options?.capture;const i=active.findIndex(x=>x.target===this&&x.type===type&&x.fn===fn&&x.capture===capture);if(i>=0)active.splice(i,1);return remove.call(this,type,fn,options);};
   window.__r31LiveListeners=()=>active.map(x=>({type:x.type,target:x.target.id||x.target.nodeName||'window'}));
  }
  window.__r31Clipboard=[];Object.defineProperty(navigator,'clipboard',{value:{async writeText(text){window.__r31Clipboard.push(text);}}});
  // Reference-only initial saved-state fixture is EMPTY; suppress the two legacy autosave intervals.
  if(referenceOnly){const nativeInterval=window.setInterval.bind(window);window.setInterval=(fn,ms,...args)=>['snapshot','cmPersistCurrent'].includes(fn?.name)?0:nativeInterval(fn,ms,...args);}
  Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(_,fail){fail?.({code:1});},watchPosition(){return 0;},clearWatch(){}}});
 },{referenceOnly:kind==='reference'});
 const trace=[];
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());trace.push(url.href);
  let file;
  if(url.hostname==='r31.invalid'){
   if(kind==='reference'&&url.pathname==='/creative/index.html')return route.fulfill({status:200,contentType:'text/html',body:reference});
   file=path.resolve(ROOT,'.'+decodeURIComponent(url.pathname));
   if(!file.startsWith(ROOT+path.sep))return route.abort();
   if(kind==='candidate'&&url.pathname.includes('/creative/runtime/'))return route.abort();
  }else if(url.hostname==='cdnjs.cloudflare.com'&&url.pathname.endsWith('/jszip.min.js'))file=require.resolve('jszip/dist/jszip.min.js');
  else if(url.hostname==='unpkg.com'&&/leaflet@1.9.4\/dist\/(leaflet.js|leaflet.css)$/.test(url.pathname))file=path.join(path.dirname(require.resolve('leaflet')),url.pathname.split('/').pop());
  else if(url.hostname==='maps.google.com'&&/^\/mapfiles\/ms\/icons\/(blue|yellow|purple)-dot.png$/.test(url.pathname))file=path.join(__dirname,'fixtures',path.basename(url.pathname));
  if(file&&fs.existsSync(file)&&fs.statSync(file).isFile()){let body=/\.(?:js|mjs|html|css)$/.test(file)?read(file):fs.readFileSync(file);if(url.pathname.endsWith('/leaflet.js'))body+='\n;(()=>{const make=L.map;L.map=(...args)=>{window.__r31MapStarts++;return make(...args)}})();';return route.fulfill({status:200,contentType:mime(file),body});}
  if(/tile\.openstreetmap|arcgisonline/.test(url.hostname))return route.fulfill({status:200,contentType:'image/png',body:FIXED_TILE});
  return route.abort();
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());const coverage=await context.newCDPSession(page);await coverage.send('Profiler.enable');await coverage.send('Profiler.startPreciseCoverage',{callCount:true,detailed:true});
 await page.goto(kind==='reference'?'https://r31.invalid/creative/index.html':'https://r31.invalid/creative-next/original-ui-r31/index.html',{waitUntil:'load'});
 if(kind==='candidate')await page.waitForFunction(()=>Boolean(window.creativeR31));
 await page.waitForTimeout(150);
 return{context,page,errors,trace,coverage};
}
async function snapshot(page,selectors){
 return page.evaluate(selectors=>Object.fromEntries(selectors.map(selector=>{
  const nodes=[...document.querySelectorAll(selector)];
  const describe=n=>{
   const r=n.getBoundingClientRect(),s=getComputedStyle(n);
   // Map backend DOM includes reference-only hidden legacy layers. Compare the
   // whole visible map image and its controls; compare geometry separately below.
   const structure=(selector==='#map'?[]:[...n.querySelectorAll('*')]).map(x=>({tag:x.tagName,id:x.id,classes:x.className,
    text:x.children.length?null:x.textContent,value:x.value??null,maxLength:x.maxLength??null,
    box:JSON.stringify(x.getBoundingClientRect().toJSON()),attributes:Object.fromEntries(['d','stroke','fill','stroke-width','stroke-dasharray','opacity','fill-opacity','inputmode','aria-pressed','hidden'].filter(k=>x.hasAttribute(k)).map(k=>[k,x.getAttribute(k)])),styles:Object.fromEntries(['fontFamily','fontSize','transform','filter','outline','background','width','height','objectFit'].map(k=>[k,getComputedStyle(x)[k]]))}));
   return{tag:n.tagName,count:nodes.length,id:n.id,classes:n.className,text:n.children.length?null:n.textContent,
    box:Object.fromEntries(['x','y','width','height'].map(k=>[k,Math.round(r[k]*100)/100])),
    styles:Object.fromEntries(['display','position','fontSize','fontFamily','fontWeight','color','background','border','borderRadius','zIndex','touchAction','transform','opacity','animationName'].map(k=>[k,s[k]])),structure};
  };
  return[selector,nodes.map(describe)];
 })),selectors);
}
function pixelDifference(a,b){
 const x=PNG.sync.read(a),y=PNG.sync.read(b);
 if(x.width!==y.width||x.height!==y.height)return{same:false,dimensions:[x.width,x.height,y.width,y.height],differentPixels:null};
 let count=0;
 for(let i=0;i<x.data.length;i+=4)if([0,1,2,3].some(k=>Math.abs(x.data[i+k]-y.data[i+k])>2))count++;
 return{same:count===0,differentPixels:count,totalPixels:x.width*x.height};
}
async function compareScene(pair,name,selectors,folder){
 await Promise.all(pair.map(x=>x.page.waitForTimeout(300)));
 // Smooth card scrolling changes the active dot again mid-scroll, restarting its
 // width/color transition. A fixed delay can sample different phases on CI even
 // when the eventual screenshot is identical. Wait for actual scroll quiescence
 // and all finite panel transitions to finish before reading either DOM or pixels.
 if(selectors.includes('#cmV60RulesPanel'))await Promise.all(pair.map(x=>x.page.evaluate(async()=>{
  const panel=document.getElementById('cmV60RulesPanel'),track=document.getElementById('cmV60RulesTrack');
  if(panel.hidden)return;
  const deadline=performance.now()+3500;let last=track.scrollLeft,quietSince=performance.now();
  while(performance.now()<deadline){
   const now=performance.now(),position=track.scrollLeft;
   const moving=panel.getAnimations({subtree:true}).some(a=>a.effect?.getTiming().iterations!==Infinity&&a.playState==='running');
   if(position!==last||moving){last=position;quietSince=now;}
   else if(now-quietSince>=100)return;
   await new Promise(resolve=>setTimeout(resolve,32));
  }
  throw Error('RULES_SCROLL_OR_TRANSITION_DID_NOT_SETTLE');
 })));
 const notifications=await Promise.all(pair.map(x=>x.page.evaluate(()=>({text:document.getElementById('status').textContent,opacity:getComputedStyle(document.getElementById('status')).opacity}))));
 // Translucent layer panels overlap transient notifications. Capture their steady
 // frame after BOTH real fade transitions finish, and retain the preceding text/phase.
 const overlaySettles=selectors.includes('#layerPanel')||(selectors.includes('#cmV60RulesPanel')&&await pair[0].page.evaluate(()=>{const p=document.getElementById('cmV60RulesPanel').getBoundingClientRect(),s=document.getElementById('status').getBoundingClientRect();return p.top<s.bottom&&p.bottom>s.top;}));
 if(overlaySettles||name==='map-right')await Promise.all(pair.map(x=>x.page.waitForFunction(()=>getComputedStyle(document.getElementById('status')).opacity==='0',null,{timeout:3500})));
 // Lock variable animation phase for image comparison; transition/gesture behavior has separate checks.
 for(const x of pair)await x.page.evaluate(()=>document.getAnimations().forEach(a=>{if(a.effect?.getTiming().iterations===Infinity){a.pause();a.currentTime=0;}}));
 const snapshots=await Promise.all(pair.map(x=>snapshot(x.page,selectors))),differences=[];
 for(const selector of selectors)if(JSON.stringify(snapshots[0][selector])!==JSON.stringify(snapshots[1][selector]))
  differences.push({selector,reference:snapshots[0][selector],candidate:snapshots[1][selector]});
 const pixels=[];
 const full=[];for(const x of pair){await x.page.bringToFront();await x.page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});full.push(PNG.sync.read(await x.page.screenshot()));}
 if(['map-right','rules-open'].includes(name))for(let i=0;i<2;i++)fs.writeFileSync(path.join(folder,name+'-full-'+i+'.png'),PNG.sync.write(full[i]));
 const crop=(png,box)=>{const x=Math.max(0,Math.floor(box.x)),y=Math.max(0,Math.floor(box.y)),width=Math.min(png.width,Math.ceil(box.x+box.width))-x,height=Math.min(png.height,Math.ceil(box.y+box.height))-y;if(width<=0||height<=0)throw Error('EMPTY_VISIBLE_CAPTURE');const out=new PNG({width,height});PNG.bitblt(png,out,x,y,width,height,0,0);return PNG.sync.write(out);};
 for(const selector of selectors){
  const locators=pair.map(x=>x.page.locator(selector).first());
  const geometry=selector.includes('.leaflet-')&&(/-pane\b|svg/.test(selector));
  const boxes=await Promise.all(locators.map(async loc=>geometry?loc.evaluate(root=>{const shapes=[...root.querySelectorAll('path,.leaflet-marker-icon')].map(n=>{const b=n.getBoundingClientRect(),padding=Number(n.getAttribute('stroke-width')||0)/2+2;return{x:b.left-padding,y:b.top-padding,right:b.right+padding,bottom:b.bottom+padding};});if(!shapes.length)return null;const x=Math.min(...shapes.map(s=>s.x)),y=Math.min(...shapes.map(s=>s.y));return{x,y,width:Math.max(...shapes.map(s=>s.right))-x,height:Math.max(...shapes.map(s=>s.bottom))-y};}):await loc.count()?loc.boundingBox():null));
  if(boxes[0]&&boxes[1]&&(geometry||await locators[0].isVisible()&&await locators[1].isVisible())){
   const buffers=[];for(let i=0;i<pair.length;i++)buffers.push(crop(full[i],boxes[i]));
   const diff=pixelDifference(...buffers);pixels.push({selector,...diff});
   if(!diff.same){const safe=selector.replace(/[^\w]/g,'_');fs.writeFileSync(path.join(folder,name+'-'+safe+'-reference.png'),buffers[0]);fs.writeFileSync(path.join(folder,name+'-'+safe+'-r31.png'),buffers[1]);}
  }
 }
 const state=await Promise.all(pair.map(x=>x.page.evaluate(()=>({camera:window.__r31ReferenceProbe?.camera()||window.creativeR31?.status().camera,mapVisible:document.getElementById('entry').classList.contains('hidden'),focus:document.activeElement?.outerHTML,scroll:[scrollX,scrollY],fonts:document.fonts.status}))));
 if(state.every(s=>s.mapVisible)&&JSON.stringify(state[0].camera)!==JSON.stringify(state[1].camera))differences.push({selector:'map.camera',reference:state[0].camera,candidate:state[1].camera});
 if(overlaySettles&&notifications[0].text!==notifications[1].text)differences.push({selector:'#status.text',reference:notifications[0].text,candidate:notifications[1].text});
 return{name,status:differences.length||pixels.some(p=>!p.same)?'FAIL':'PASS',differences,pixels,state,notifications};
}
async function run(){
 await build();
 const {html}=await assemble(),reference=instrumentReference(html);
 const {createFreshV1Kmz}=await import('../../phase-1b/core/create-new-kmz.mjs');
 const {DOMParser,XMLSerializer}=require('@xmldom/xmldom'),JSZip=require('jszip');
 const bytes=(await createFreshV1Kmz({records:[
  {id:'r31-old',role:'existing',kind:'pokestop',title:'既存 PokéStop',memo:'',lat:35.68,lng:139.76,deleted:false},
  {id:'r31-new',role:'new',kind:'gym',title:'Gym 1',memo:'',lat:35.684,lng:139.764,deleted:false}
 ],activityAreas:[]},{JSZip,DOMParser,XMLSerializer})).bytes;
 const browser=await chromium.launch({channel:process.env.R31_BROWSER_CHANNEL||undefined,headless:true}),results=[];
 const root=path.join(__dirname,'artifacts','resume');fs.mkdirSync(root,{recursive:true});
 try{
  for(const viewport of [{width:390,height:844},{width:393,height:852},{width:1366,height:768}].filter(v=>!process.env.R31_WIDTH||v.width===Number(process.env.R31_WIDTH))){
   const pair=[],scenes=[],actionErrors=[],folder=path.join(root,String(viewport.width));fs.mkdirSync(folder,{recursive:true});
   try{
    pair.push(await contextFor(browser,viewport,'reference',reference));pair.push(await contextFor(browser,viewport,'candidate',reference));
    const both=async(selector)=>{for(const x of pair)await x.page.locator(selector).click({timeout:3000});};
    const capture=(name,focus)=>compareScene(pair,name,FOCUS[focus],folder).then(x=>scenes.push(x));
    await capture('entry-right','entry');
    // Production v58 hides handedness controls; test the display-setting boundary without force-clicking hidden controls.
    await pair[0].page.evaluate(()=>__r31ReferenceProbe.setHand('left'));await pair[1].page.evaluate(()=>creativeR31.setHand('left'));await capture('entry-left','entry');
    await pair[0].page.evaluate(()=>__r31ReferenceProbe.setHand('right'));await pair[1].page.evaluate(()=>creativeR31.setHand('right'));
    await pair[0].page.locator('#entryFile').setInputFiles({name:'r31-synthetic.kmz',mimeType:'application/vnd.google-earth.kmz',buffer:Buffer.from(bytes)});
    await pair[0].page.locator('#startButton').click();
    await pair[0].page.waitForFunction(()=>document.getElementById('entry').classList.contains('hidden'),{timeout:15000});
    await pair[0].page.bringToFront();
    await pair[0].page.waitForFunction(()=>!__r31ReferenceProbe.layoutState().centerCached,null,{timeout:5000}); // source beginEditor invalidateSize must actually finish
    const view=await pair[0].page.evaluate(()=>window.__r31ReferenceProbe.view());
    const before=JSON.stringify(view),camera=await pair[0].page.evaluate(()=>__r31ReferenceProbe.camera());
    await pair[1].page.evaluate(view=>{
     const frozen=JSON.parse(JSON.stringify(view));window.__r31Fixture=frozen;
     creativeR31.onRequest((action,result)=>window.__r31Requests.push({action,result}));
     creativeR31.setViewReader(()=>window.__r31Fixture);creativeR31.showMap();
    },view);
    await pair[1].page.evaluate(camera=>creativeR31.setCamera(camera),camera);
    await capture('map-right','map');
    await both('#cmAddFab');await capture('plus-open','plus');
    for(const kind of ['new-pokestop','new-power']){
     for(const x of pair)await x.page.locator('.cm-bubble[data-layer="'+kind+'"]').click({timeout:3000});
     await capture('add-'+kind,'add');await both('#cmSafeAddCancel');await both('#cmAddFab');
    }
    for(const x of pair)await x.page.locator('.cm-bubble[data-layer="new-gym"]').click({timeout:3000});
    await capture('add-gym','add');await both('#cmSafeAddCancel');
    await both('#cmV59HelpButton');await capture('rules-open','help');await both('#cmV60RulesClose');
    await both('#cmStandaloneSaveButton');await capture('save-open','save');await both('#cmStandaloneClose');
    const fresh=view.pois.find(p=>p.role==='new'),old=view.pois.find(p=>p.role==='existing');
    if(!fresh||!old)throw Error('REFERENCE_ROLE_FIXTURE_INVALID');
    await pair[0].page.evaluate(id=>__r31ReferenceProbe.openSheet(id),fresh.id);
    await pair[1].page.evaluate(id=>creativeR31.openSheet(id),fresh.id);
    await capture('new-sheet','sheet');
    await both('#cmMove');await capture('move-new','move');await both('#cmMoveCancel');
    await pair[0].page.evaluate(id=>__r31ReferenceProbe.openSheet(id),old.id);
    await pair[1].page.evaluate(id=>creativeR31.openSheet(id),old.id);
    const existingReadOnly=await pair[1].page.locator('.cm-sheet input,.cm-sheet textarea,#cmMove,#cmDelete,#cmType').count()===0;
    await capture('existing-sheet','sheet');await both('.cm-sheet-close');
    const operations=await require('./part-a-operations.cjs').exercise({pair,view,camera,folder,compareScene,both,onScene:s=>scenes.push(s)});
    // Exercise disconnected data requests with ordinary clicks, after visual comparisons.
    const duplicateMountRejected=await pair[1].page.evaluate(async()=>{
     const {mountCreativeUi}=await import('/creative-next/original-ui-r31/ui-runtime.mjs');
     try{mountCreativeUi();return false;}catch(e){return e.message==='UI_ALREADY_MOUNTED';}
    });
    if(!duplicateMountRejected)throw Error('DUPLICATE_UI_OWNER_NOT_REJECTED');
    await pair[1].page.locator('#cmAddFab').click();
    await pair[1].page.locator('.cm-bubble[data-layer="new-pokestop"]').click();
    await pair[1].page.locator('#cmSafeAddConfirm').click();await pair[1].page.locator('#cmSafeAddCancel').click();
    await pair[1].page.evaluate(id=>creativeR31.openSheet(id),fresh.id);
    await pair[1].page.locator('#cmName').fill('Synthetic proposed title');
    await pair[1].page.locator('#cmMemo').fill('Synthetic proposed memo');
    await pair[1].page.locator('#cmDelete').click();
    await pair[1].page.locator('#cmMove').click();await pair[1].page.locator('#cmMoveConfirm').click();await pair[1].page.locator('#cmMoveCancel').click();
    // KMZ remains a denied request, with no generated file or persistence.

    await pair[1].page.locator('#cmStandaloneSaveButton').click();
    await pair[1].page.locator('#cmStandaloneKmz').click();
    const candidateChecks=await pair[1].page.evaluate(()=>({status:creativeR31.status(),storage:__r31Storage,mapStarts:__r31MapStarts,legacyCapabilities:typeof window.bridgeMapLab_createMapRenderer==='function'||typeof window.CampsiteCreativeWorkspace==='object',
     proposals:__r31Requests,fixture:JSON.stringify(__r31Fixture)}));
    if(candidateChecks.fixture!==before)throw Error('UI_MUTATED_READ_VIEW');
    if(candidateChecks.proposals.length<6||candidateChecks.proposals.some(p=>p.result.status!=='HOLD'||p.result.changed!==false))throw Error('DATA_REQUEST_ESCAPED_HOLD');
    if(candidateChecks.status.mapCount!==1)throw Error('SINGLE_UI_MAP_VIOLATION');
    const markup=await pair[1].page.content();
    const hiddenLegacyRequests=pair[1].trace.filter(u=>u.includes('/creative/runtime/')||/creative-next\/(phase-1|integration)/.test(u));
    const executed=await pair[1].coverage.send('Profiler.takePreciseCoverage');const legacyCoverage=executed.result.filter(s=>/\/creative\/runtime\/|\/creative\/index.html|creative-next\/(phase-1|integration)/.test(s.url));
    const originalFunctionsExecuted=legacyCoverage.reduce((sum,s)=>sum+s.functions.reduce((n,f)=>n+f.ranges.reduce((n,r)=>n+r.count,0),0),0);
    await pair[1].page.evaluate(()=>{creativeR31.dispose();creativeR31.dispose();creativeR31.setHand('left');creativeR31.transition();});
    const disposed=await pair[1].page.evaluate(()=>({status:creativeR31.status(),independentListeners:__r31LiveListeners(),ownedControls:document.querySelectorAll('#cmFabWrap,#cmV59HelpButton,#cmV60RulesPanel,#cmStandaloneSaveButton,.cm-sheet').length}));
    results.push({viewport,status:scenes.every(s=>s.status==='PASS')&&operations.checks.every(x=>x.pass)&&pair.every(x=>x.errors.length===0)&&candidateChecks.storage.length===0&&candidateChecks.mapStarts===1&&!candidateChecks.legacyCapabilities&&originalFunctionsExecuted===0&&hiddenLegacyRequests.length===0&&existingReadOnly&&disposed.ownedControls===0&&disposed.independentListeners.length===0?'PASS':'HOLD',
     scenes,operations:operations.checks,originalFunctionsExecuted,legacyCoverage,actionErrors,existingReadOnly,duplicateMountRejected,candidateChecks:{...candidateChecks,fixture:undefined},hiddenLegacyRequests,disposed,errors:pair.map(x=>x.errors),
     renderedMode:'read-only synthetic view; no r31 data import or editor Session'});
   }catch(error){
    actionErrors.push(error.message.slice(0,2400));
    results.push({viewport,status:'HOLD',scenes,operations:pair[1]?.operationChecks||[],actionErrors,errors:pair.map(x=>x.errors)});
   }finally{for(const x of pair)await x.context.close();}
  }
 }finally{await browser.close();}
 const report={fingerprint:require('./evidence.cjs').fingerprint(),status:results.every(x=>x.status==='PASS')&&results.length===3?'PASS':'HOLD',
  partA:'MEASURED_BY_PART_A_GATE',partB:'NOT_STARTED',scope:'Seven PART A groups: display, normal input, HOLD and teardown',
  browser:{channel:process.env.R31_BROWSER_CHANNEL||'chromium',version:browser.version(),platform:process.platform},safariRealDevice:'NOT_TESTED',forceClicksUsed:0,referenceAutosaveIntervals:'two legacy save intervals suppressed for fixed EMPTY initial saved-state fixture',
  fixture:'synthetic NEW_V1; reference memory storage; candidate read-only view and HOLD requests',results};
 fs.writeFileSync(path.join(__dirname,'ui-runtime-comparison.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,partA:report.partA,results:results.map(x=>({width:x.viewport.width,status:x.status,actions:x.actionErrors,scenes:x.scenes.map(s=>({name:s.name,status:s.status,dom:s.differences.length,pixels:s.pixels.filter(p=>!p.same).length}))}))}));
 return report;
}
module.exports={run,pixelDifference,instrumentReference};
if(require.main===module)run().then(r=>{process.exitCode=r.status==='PASS'?0:2;}).catch(e=>{console.error(e);process.exitCode=1;});
