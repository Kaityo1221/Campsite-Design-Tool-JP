/* Actual original Campsite Distance HTML, JS and Leaflet in an OFFLINE browser.
 * Input is a verified, synthetic portable Project/NEW_V1 pair. Test-only.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const {chromium}=require(path.join(ROOT,'node_modules/playwright'));
const JSZip=require('jszip'),{DOMParser,XMLSerializer}=require('@xmldom/xmldom');
const {webcrypto}=require('node:crypto');
const clone=x=>JSON.parse(JSON.stringify(x));
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const match=read('index.html').match(/<section id="distance"[\s\S]*?<\/section>/);
assert(match&&match[0].includes('id="distanceResult"')&&match[0].includes('id="distanceMap"'));
const html='<!doctype html><html lang="ja"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<style>html{font:16px sans-serif;background:#121b29;color:#fff}body{margin:0}'+
 'section{padding:10px}.panel{max-width:900px;margin:auto}.step{padding:12px;margin:10px 0;border:1px solid #556}'+
 '#distanceMap{height:450px;width:100%;position:relative}.distance-warning{padding:10px}</style>'+
 '</head><body>'+match[0]+'</body></html>';
const project={
 schemaVersion:'1.0',projectId:'screen-synthetic',source:'bridge',
 polygon:[[35.700,139.800],[35.700,139.802],[35.702,139.802],[35.702,139.800]],
 meta:{projectContract:'campsiteProject.v1',bridgeHandoffId:'handoff:screen-synthetic'},
 currentPois:[
  {id:'existing-1',guid:'existing-1',role:'existing',gameEntity:'POKESTOP',gameStatus:'ACTIVE',
   title:'Synthetic Existing',lat:35.701,lng:139.801},
  {id:'gym-1',role:'added',gameEntity:'GYM',gameStatus:'UNKNOWN',title:'Synthetic Gym',
   lat:35.70115,lng:139.801},
  {id:'power-1',role:'added',gameEntity:'POWERSPOT',gameStatus:'UNKNOWN',title:'Synthetic Power',
   lat:35.70140,lng:139.801}
 ],sourcePois:[{guid:'existing-1'}],selectedPois:[{guid:'existing-1'}],
 addedPois:[{id:'gym-1'},{id:'power-1'}],deletedPois:[],edits:[],
 wayfarerObservation:{
  snapshotId:'snapshot:screen',observedAt:'2026-10-15T00:00:00Z',
  polygon:[[35.700,139.800],[35.700,139.802],[35.702,139.802],[35.702,139.800]],
  acquisition:{coverageComplete:true,bufferMeters:200,coverageStatus:'complete'},
  zones:{interior:[{guid:'existing-1',lat:35.701,lng:139.801,poiKind:'POKESTOP',
   gameEntity:'POKESTOP',gameStatus:'ACTIVE'}],
  reference100:[{guid:'external-ref',lat:35.70112,lng:139.80112,poiKind:'GYM',
   gameEntity:'GYM',gameStatus:'ACTIVE'}],
  reserve200:[{guid:'reserve-hidden',lat:35.705,lng:139.803,poiKind:'POWERSPOT',
   gameEntity:'POWERSPOT',gameStatus:'INACTIVE',referenceKind:'INACTIVE_POWERSPOT'}]}
 }
};
const area={id:'creative-31',points:Array.from({length:31},(_,i)=>[
 35.701+0.00031*Math.cos(2*Math.PI*i/31),
 139.801+0.00034*Math.sin(2*Math.PI*i/31)
])};
const records=[
 {id:'existing-1',guid:'existing-1',role:'existing',kind:'pokestop',
  title:'Synthetic Existing',lat:35.701,lng:139.801},
 {id:'gym-1',role:'new',kind:'gym',title:'Synthetic Gym',lat:35.70115,lng:139.801},
 {id:'power-1',role:'new',kind:'power',title:'Synthetic Power',lat:35.70140,lng:139.801}
];
async function stage(){
 const [{createFreshV1Kmz},{createPortableReturnBundleLab,inspectPortableReturnBundleLab},
 {inspectCampsiteDistanceReturnStageLab},
 {compileX01TypedDistanceCandidateLab}]=await Promise.all([
  import('../phase-1b/core/create-new-kmz.mjs'),
  import('../contracts/portable-return-bundle-lab.mjs'),
  import('../contracts/campsite-distance-return-stage-lab.mjs'),
  import('../contracts/x01-distance-adapter-candidate-lab.mjs')
 ]);
 const {bytes}=await createFreshV1Kmz({records,activityAreas:[area]},
  {JSZip,DOMParser,XMLSerializer,documentName:'RealCampsiteScreenLAB'});
 const d={expectedProjectId:project.projectId,expectedHandoffId:project.meta.bridgeHandoffId,
  JSZip,DOMParser,cryptoProvider:webcrypto};
 const pack=await createPortableReturnBundleLab({
  ...d,project:clone(project),activityAreas:[clone(area)],kmzBytes:bytes,revision:1
 });
 const received=await inspectPortableReturnBundleLab({bytes:pack.bytes,...d});
 const result=await inspectCampsiteDistanceReturnStageLab({
  project:received.project,activityAreas:received.activityAreas,kmzBytes:received.kmzBytes,...d
 });
 assert.equal(result.legacyDistanceCommitAllowed,false);
 assert.equal(result.legacyActivityAreaConflict,true);
 assert.equal(result.summary.currentPoiCount,3);
 const typed=compileX01TypedDistanceCandidateLab({
  distanceStage:result,selectedActivityAreaIds:[area.id],confirmed:true
 });
 assert.equal(typed.approvedMapping,false);
 assert.equal(typed.distancePreview.dataOnlyNotRuntimeBinding,true);
 assert.deepEqual(typed.distancePreview.activityAreaIds,['creative-31']);
 assert.deepEqual(typed.distancePreview.designPolygon,project.polygon);
 assert.deepEqual(typed.distancePreview.acquisitionPolygon,project.wayfarerObservation.polygon);
 return typed;
}
async function realScreen(browser,viewport,staged){
 const ctx=await browser.newContext({viewport});
 const tile=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+XloPXwAAAABJRU5ErkJggg==','base64');
 await ctx.route('**/*',r=>{
  if(r.request().url()==='https://campsite-distance-lab.invalid/screen')
   return r.fulfill({status:200,contentType:'text/html',body:html});
  return /^https:\/\/(tile\.openstreetmap\.org|server\.arcgisonline\.com)\//.test(r.request().url())
   ?r.fulfill({status:200,contentType:'image/png',body:tile}):r.abort();
 });
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('https://campsite-distance-lab.invalid/screen');
  await page.addStyleTag({path:require.resolve('leaflet/dist/leaflet.css')});
  await page.addScriptTag({path:require.resolve('leaflet/dist/leaflet.js')});
  for(const file of ['js/distance-core.js','js/distance-poi.js','js/distance-render.js',
   'js/distance-file.js','js/distance-score.js','js/distance.js','js/distance-map.js'])
   await page.addScriptTag({content:read(file)});
  await page.evaluate(d=>{
   window._layerPoints=d.groups;window._activityPolygons=d.areas.map(x=>x.points);
   window._hasPolygon=true;window._distanceSourceFile=null;
   Object.defineProperty(window,'_distanceSourceFile',{value:null,writable:false});
   window.setWorkflowStep=()=>{};
   window.sendDistanceCheckAnalytics=()=>{window.__intercepted=(window.__intercepted||0)+1};
   window.uploadCampsiteFile=()=>{throw Error('LAB_MUST_NOT_UPLOAD')};
  },{groups:staged.distancePreview.layerPoints,areas:staged.originalActivityAreas});
  await page.evaluate(()=>runDistanceCheck());
  await page.waitForFunction(()=>distanceLeafletMap!==null&&
   distancePolygonLayerGroup?.getLayers().length===1&&
   distanceLeafletLayerGroup?.getLayers().length===6);
  const state=await page.evaluate(()=>{
   const layers=distanceLeafletLayerGroup.getLayers(),area=distancePolygonLayerGroup.getLayers();
   const markers=layers.filter(x=>x instanceof L.CircleMarker);
   const lines=layers.filter(x=>x instanceof L.Polyline&&!(x instanceof L.Polygon));
   return {
    markerCount:markers.length,lineCount:lines.length,
    colors:lines.map(x=>x.options.color).sort(),
    vertices:area[0].getLatLngs()[0].map(x=>[x.lat,x.lng]),
    html:document.getElementById('distanceResult').textContent,
    map:document.getElementById('distanceMap').classList.contains('leaflet-container'),
    warningCount:latestDistanceWarnings.length,
    analytics:window.__intercepted||0,
    sessionKeys:Object.keys(sessionStorage),localKeys:Object.keys(localStorage),
    polygon:window._activityPolygons,
    popups:markers.map(x=>x.getPopup()?.getContent())
   };
  });
  assert.equal(state.markerCount,3);assert.equal(state.lineCount,3);
  assert.equal(state.warningCount,3);assert.equal(state.map,true);
  assert.deepEqual(state.vertices,area.points);assert.deepEqual(state.polygon,[area.points]);
  assert.notDeepEqual(state.vertices,project.polygon);
  assert.deepEqual(state.colors,['#ef4444','#f97316','#facc15']);
  assert.equal(state.analytics,1,'real analytics invoked but intercepted, no network');
  assert.deepEqual(state.sessionKeys,[]);assert.deepEqual(state.localKeys,[]);
  assert(state.popups.every(s=>!s.includes('external-ref')&&!s.includes('reserve-hidden')));
  assert.match(state.html,/50m未満/);
  assert.deepEqual(errors,[]);
  return {viewport,status:'PASS',actualCampsiteDistanceHtml:true,actualCampsiteDistanceCode:true,
   actualLeaflet:true,poiMarkers:3,warningLines:3,
   activityAreaVertices:31,typedX01DataOnlyCandidate:true,
   referenceOrReservePromoted:false,
   analyticsIntercepted:true,storageWrites:false,productionReady:false};
 }finally{await ctx.close()}
}
(async()=>{
 const input=await stage(),browser=await chromium.launch({headless:true}),results=[];
 try{for(const v of [{width:390,height:844},{width:393,height:852}])
  results.push(await realScreen(browser,v,input))}finally{await browser.close()}
 console.log(JSON.stringify({status:'PASS',results,phase:'HOLD',productionReady:false}));
})().catch(e=>{console.error(e);process.exitCode=1});
