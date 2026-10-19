import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

// This tests the actual October 18 Receiver and Project code, not the stale
// base-branch downstream files. Requires the pinned commit to be fetched in CI.
const PC_REF='0e73b4984fc3719f1a4ee08c35854d8f76ff3397';
const pinned=path=>execFileSync('git',['show',PC_REF+':'+path],{encoding:'utf8'});
const receiverHtml=pinned('bridge-receiver.html');
const nextFlow=pinned('js/bridge-next-flow.js');
const inactiveHelper=pinned('js/bridge-observation-inactive.js');
const exporter=fs.readFileSync('bridge-android-n4/interior-poi-export.js','utf8');

function storage() {
  const entries=new Map();
  return {
    get length(){return entries.size;},
    key(n){return [...entries.keys()][n]??null;},
    getItem(k){return entries.has(String(k))?entries.get(String(k)):null;},
    setItem(k,v){entries.set(String(k),String(v));},
    removeItem(k){entries.delete(String(k));}
  };
}
function element() {
  return {textContent:'',className:'',hidden:false,style:{},dataset:{},
    classList:{add(){},remove(){},toggle(){}},addEventListener(){}};
}
function receiver(handshake) {
  const store=storage(), cache=new Map(), listeners=new Map();
  const body=element();
  const window={opener:null,focus(){},addEventListener(t,fn){listeners.set(t,fn);},
    removeEventListener(t){listeners.delete(t);}};
  const document={body,title:'',referrer:'',getElementById(id){
    if(!cache.has(id))cache.set(id,element());
    return cache.get(id);
  }};
  const location={search:'?campsiteBridgeDev=1&handshake='+handshake,
    replace(){},href:''};
  const context={window,document,location,sessionStorage:store,URLSearchParams,URL,
    console,setTimeout:()=>1,clearTimeout(){},Map,Set,Object,Number,String,Array,
    JSON,Math,Date,Promise,Error};
  vm.createContext(context);
  vm.runInContext(inactiveHelper,context);
  const inlineScripts=[...receiverHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(inlineScripts.length,'pinned Receiver inline handler missing');
  vm.runInContext(inlineScripts.at(-1)[1],context);
  return {window,store,cache};
}
function next(adapter) {
  const store=storage();store.setItem('campsiteBridgeAdapter.v0.3',JSON.stringify(adapter));
  const context={window:{},location:{search:'?campsiteBridgeImport=1',href:''},
    sessionStorage:store,localStorage:storage(),
    document:{addEventListener(){},getElementById(){return null;}},
    URLSearchParams,console,setTimeout(){},crypto:crypto.webcrypto,
    Math,Date,JSON,Map,Object,Number,String,Array};
  vm.createContext(context);
  vm.runInContext(nextFlow,context);
  return context.window.CampsiteBridgeNextFlow;
}
const ext={window:{}};
vm.runInNewContext(exporter,ext);
const fromObservation=ext.window.CampsiteBridgeAndroidN4InteriorExporter.fromObservation;
const p=[[35.681,139.761],[35.681,139.771],[35.691,139.771],[35.691,139.761]];
const active=Array.from({length:17},(_,i)=>({
  guid:'active-'+i,title:'Active '+i,lat:35.683+i*.00001,lng:139.765,
  poiKind:'POKESTOP',gameEntity:'POKESTOP',gameStatus:'ACTIVE',
  bridgeEligible:true,provenance:['WAYFARER_PASSIVE']
}));
const inactive=Array.from({length:100},(_,i)=>({
  guid:'inactive-'+i,title:'Inactive '+i,lat:35.684,lng:139.766,
  poiKind:'NOT_IN_GAME',gameEntity:'POWERSPOT',gameStatus:'INACTIVE',
  bridgeEligible:false,referenceKind:'INACTIVE_POWERSPOT'
}));
const rawObs={
  version:'0.1.0',snapshotId:'synthetic-n4i',observedAt:'2026-10-19T00:00:00.000Z',
  polygon:p,counts:{
    interior:{pokestop:17,inactivePowerSpot:50,total:67},
    reference100:{inactivePowerSpot:40,total:40},
    reserve200:{inactivePowerSpot:10,total:10}
  },
  zones:{interior:[...active,...inactive.slice(0,50)],
    reference100:inactive.slice(50,90),reserve200:inactive.slice(90)},
  visibleTotal:107,retainedTotal:117,excludedCount:0,outsideCount:0,
  // In this synthetic contract fixture ONLY, source verification is assumed
  // to test transport. N4 real GCS NEVER asserts coverageComplete=true yet.
  canProceed:true,
  acquisition:{bufferMeters:200,referenceMeters:100,reserveMeters:200,
    cellLevel:14,tileCount:4,geometryCoverageComplete:true,
    transportComplete:true,sourceComplete:true,coverageComplete:true,
    coverageStatus:'complete',acquisitionBounds:{south:35.679,west:139.759,north:35.693,east:139.773}}
};
const unverified={...rawObs,canProceed:false,acquisition:{
  ...rawObs.acquisition,sourceComplete:null,coverageComplete:false,coverageStatus:'unverified'}};
assert.equal(fromObservation(unverified).length,0,'unverified GCS can never reach Receiver');
assert.equal(fromObservation({...rawObs,canProceed:false}).length,0);
const pois=fromObservation(rawObs);
assert.equal(pois.length,17);
assert.ok(pois.every(p=>p.gameStatus==='ACTIVE'&&p.gameEntity==='POKESTOP'));
assert.equal(pois.some(p=>p.guid.startsWith('inactive-')),false);
const payload={
  type:'CAMPSITE_BRIDGE_POI_V1',bridgeVersion:'0.3.7',bridgePlatform:'android',
  schemaVersion:'1.2',handshakeId:'synthetic-n4i-handoff',
  autoContinue:true,pois,referencePois:[],
  wayfarerObservation:rawObs
};
const rc=receiver(payload.handshakeId);
const result=rc.window.CampsiteBridgeDevReceive(payload);
assert.equal(result.accepted,true,'pinned Oct18 Receiver must accept synthetic Android payload');
assert.equal(result.count,17,'all 17 active INTERIOR POIs must be retained');
assert.equal(Number(rc.cache.get('inactivePowerSpot')?.textContent),100,'Oct18 Receiver inactive observed total');
assert.equal(Number(rc.cache.get('inactivePowerReserve')?.textContent),10,'Oct18 hidden reserve count');
const adapter=JSON.parse(rc.store.getItem('campsiteBridgeAdapter.v0.3'));
assert.equal(adapter.pois.length,17);
assert.equal(adapter.handoffId,'handshake:'+payload.handshakeId);
assert.equal(adapter.bridgePlatform,'android');
assert.equal(adapter.wayfarerObservation.zones.interior.length,67);
assert.equal(adapter.wayfarerObservation.zones.reference100.length,40);
assert.equal(adapter.wayfarerObservation.zones.reserve200.length,10);
assert.equal(adapter.pois.some(p=>p.guid.startsWith('inactive-')),false);

const api=next(adapter);
assert.ok(api?.buildProject);
const selection={version:'0.8.5',handoffId:adapter.handoffId,
  sourceCount:17,selectedCount:17,polygon:p,pois:adapter.pois};
const project=api.buildProject(selection,adapter);
assert.equal(project.currentPois.length,17);
assert.equal(project.selectedPois.length,17);
assert.equal(project.meta.bridgePlatform,'android');
assert.equal(project.meta.bridgeHandoffId,adapter.handoffId);
assert.equal(project.wayfarerObservation.snapshotId,rawObs.snapshotId);
assert.equal(project.wayfarerObservation.zones.reference100.length,40);
assert.equal(project.wayfarerObservation.zones.reserve200.length,10);
assert.equal(project.currentPois.some(p=>p.guid.startsWith('inactive-')),false);
assert.equal(project.wayfarerObservation.acquisition.sourceComplete,true);

const changedSelection={...selection,polygon:[[36,140],[36.01,140],[36.01,140.01],[36,140.01]]};
assert.equal(api.buildProject(changedSelection,adapter).wayfarerObservation,undefined,
  'observation from another polygon must not be attached');

console.log('N4-I synthetic contract end-to-end PASS: Android interior 17 => pinned 10/18 Receiver 17+inactive100/reserve10 => Adapter => Project.');
console.log('NO actual Android Firefox, live GCS semantic completeness or production SEND asserted.');
