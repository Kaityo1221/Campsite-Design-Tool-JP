import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Real PC parser/classifier/acquisition/zone + real Android coordinator.
// All Wayfarer network/map calls are synthetic; source semantics stay unverified.
const files = [
  'bridge-pc/wayfarer-acquisition-engine.js',
  'bridge-pc/poi-parser.js',
  'bridge-pc/poi-classifier.js',
  'bridge-pc/wayfarer-observation-zone.js',
  'bridge-android-n4/wayfarer-acquisition-coordinator.js'
];

const polygon = [
  [35.680,139.760],[35.680,139.770],[35.690,139.770],[35.690,139.760]
];
const gmo = (entity, status) => [{entity, status, gameBrand:'HOLOHOLO'}];
const fixture = {
  results:[{ pois:[
    {poiId:'active-1', lat:35.684, lng:139.764, title:'Active stop', gmo:gmo('POKESTOP','ACTIVE')},
    {poiId:'inactive-1', lat:35.686, lng:139.766, title:'Inactive power', gmo:gmo('POWERSPOT','INACTIVE')},
    {poiId:'reference-1', lat:35.6904, lng:139.764, title:'Outside 100m', gmo:gmo('GYM','ACTIVE')},
    {poiId:'reserve-1', lat:35.6913, lng:139.764, title:'Reserve', gmo:gmo('POWERSPOT','INACTIVE')},
    {poiId:'not-in-game', lat:35.685, lng:139.765, title:'Other', gmo:[]}
  ]}]
};

function harness(options={}) {
  const handlers=new Map();
  const events=[];
  let requests=0, invalidSent=false, viewRestore=0;
  const failFirst=options.failFirst === true;
  const map={
    getCenter:()=>({lat:()=>35.68,lng:()=>139.77}),
    getZoom:()=>14,
    setCenter:()=>{viewRestore++;},
    setZoom:()=>{viewRestore++;},
    fitBounds(bounds) {
      requests++;
      const bodyText=failFirst && !invalidSent ? '<html>unauthorized</html>' : JSON.stringify(options.empty ? { results:[{pois:[]}] } : fixture);
      if(failFirst && !invalidSent) invalidSent=true;
      const url='https://wayfarer.scopely.com/api/v1/vault/mapview/gcs?ne=('
        +bounds.north+','+bounds.east+')&sw=('+bounds.south+','+bounds.west+')&cellLevel=14';
      Promise.resolve().then(()=>{
        if(options.editDuringFetch && requests===1){
          dispatch('campsite-bridge-android-n4:polygon-state',{
            active:true,completed:false,points:polygon
          });
        }
        dispatch('message',null,{source:window,
          data:{source:'CAMPSITE_BRIDGE_ANDROID_M24_PAGE',type:'GCS_RESPONSE',url,bodyText}});
      });
    }
  };
  // Make postMessage and event dispatch independent from browser APIs.
  const window={
    setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,300)),clearTimeout,
    addEventListener(type,cb){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(cb);},
    removeEventListener(type,cb){handlers.set(type,(handlers.get(type)||[]).filter(x=>x!==cb));},
    dispatchEvent(event){events.push(event);for(const cb of handlers.get(event.type)||[])cb(event);return true;},
    postMessage(data){events.push({type:'postMessage',data});},
    CampsiteBridgeWayfarerMapAdapter:{findMap:()=>map}
  };
  class CustomEvent{constructor(type,opts={}){this.type=type;this.detail=opts.detail;}}
  const ctx=vm.createContext({window,document:{},location:{origin:'https://wayfarer.scopely.com',
    href:'https://wayfarer.scopely.com/'},CustomEvent,URL,console,Math,Number,String,
    Array,Object,Set,Promise,setTimeout,clearTimeout});
  for(const file of files)vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
  function dispatch(type, detail, extra={}){
    window.dispatchEvent({type,...extra,detail:detail?JSON.stringify(detail):undefined});
  }
  return {window,events,dispatch,counts:()=>({requests,viewRestore})};
}
const waitTurn=()=>new Promise(resolve=>setTimeout(resolve,0));

const ok=harness();
const result=await ok.window.CampsiteBridgeAndroidN4Acquisition.acquire(polygon);
const obs=ok.window.CampsiteBridgeAndroidN4Acquisition.getObservation();
assert.ok(ok.counts().requests>1,'200m buffered region MUST be split into <=500m tiles');
assert.equal(ok.window.CampsiteBridgeAndroidN4Acquisition.maxTileMeters,500);
assert.equal(result.acquisition.sourceComplete,null);
assert.equal(result.acquisition.transportComplete,true);
assert.equal(result.acquisition.coverageComplete,false,'unknown GCS source must not become complete');
assert.equal(result.acquisition.coverageStatus,'unverified');
assert.equal(obs.canProceed,false,'an unverified observation may NOT be sent');
assert.equal(obs.counts.interior.pokestop,1);
assert.equal(obs.counts.interior.inactivePowerSpot,1);
assert.equal(obs.counts.reference100.gym,1);
assert.equal(obs.counts.reserve200.inactivePowerSpot,1);
assert.equal(obs.excludedCount,1,'unrelated NOT_IN_GAME should be excluded');
assert.equal(result.parserStats.parsedCount,5,'all-tile GUID dedup');
assert.ok(result.parserStats.duplicateCount>0,'multiple tile payloads should dedup');
assert.equal(obs.acquisition.tileCount,ok.counts().requests);
for(const key of ['engineVersion','acquisitionBounds','geometryCoverageComplete',
 'transportComplete','sourceComplete','coverageComplete','coverageStatus','referenceMeters','reserveMeters']){
 assert.ok(Object.hasOwn(obs.acquisition,key),key+' must be preserved');
}
assert.equal(ok.counts().viewRestore,2,'map view must be restored');
assert.equal(JSON.stringify(result).includes('sourceGameObjects'),false,'do not retain raw source POIs');
assert.equal(ok.events.filter(e=>e.type==='postMessage'&&e.data?.type==='WAYFARER_OBSERVATION').at(-1).data.observation.canProceed,false);

const empty=harness({empty:true});
await empty.window.CampsiteBridgeAndroidN4Acquisition.acquire(polygon);
const emptyObservation=empty.window.CampsiteBridgeAndroidN4Acquisition.getObservation();
assert.equal(emptyObservation.visibleTotal,0,'empty source should not fabricate POIs');
assert.equal(emptyObservation.canProceed,false,'empty observation must block sending');

const fail=harness({failFirst:true});
await assert.rejects(()=>fail.window.CampsiteBridgeAndroidN4Acquisition.acquire(polygon),/全タイル/);
assert.equal(fail.window.CampsiteBridgeAndroidN4Acquisition.getObservation(),null);
assert.equal(fail.counts().viewRestore,2);
await fail.window.CampsiteBridgeAndroidN4Acquisition.acquire(polygon);
assert.equal(fail.window.CampsiteBridgeAndroidN4Acquisition.getObservation().canProceed,false,
 'retry remains unverified until source semantics established');

const retry=harness({failFirst:true});
const evt={completed:true,active:false,points:polygon};
retry.dispatch('campsite-bridge-android-n4:polygon-state',evt);
for(let i=0;i<4;i++)await waitTurn();
const firstCount=retry.counts().requests;
retry.dispatch('campsite-bridge-android-n4:polygon-state',evt);
for(let i=0;i<4;i++)await waitTurn();
assert.ok(retry.counts().requests>firstCount,'same polygon should retry after failure');
assert.ok(retry.window.CampsiteBridgeAndroidN4Acquisition.getObservation());

const edited=harness({editDuringFetch:true});
await assert.rejects(()=>edited.window.CampsiteBridgeAndroidN4Acquisition.acquire(polygon),/範囲が変わりました/);
assert.equal(edited.window.CampsiteBridgeAndroidN4Acquisition.getObservation(),null,'no stale observation from active edit');

const huge=harness();
await assert.rejects(()=>huge.window.CampsiteBridgeAndroidN4Acquisition.acquire([
  [35.0,139.0],[35.0,139.12],[35.12,139.12],[35.12,139.0]
]),/範囲が大きすぎます/);
assert.equal(huge.counts().requests,0,'tile cap before network');

console.log('N4-H safety regression PASS: multi-tile, true GUID aggregation, inactive zones, fail-closed source, empty/invalid, retry, edit invalidation, map restore, tile cap.');
console.log('Still HOLD: authentic GCS source completeness + Android Firefox physical device proof are NOT available.');
