import test from 'node:test';
import assert from 'node:assert/strict';
import {createPoiStore} from '../../phase-1a/core/poi-store.mjs';

// Based on the observed Hikarigaoka old KMZ aggregate: 199 existing and
// 12 imported new POIs, including nine gyms (one beyond the normal cap).
// Grandfathering old records must NEVER imply permission to add a tenth gym.
function existing(i){return {id:'old-'+i,role:'existing',kind:'pokestop',title:'Existing '+i,memo:'',lat:35.60+i*0.00001,lng:139.80,deleted:false,guid:null,poiId:null,metadata:{}};}
function fresh(i,kind){return {id:'new-'+i,role:'new',kind,title:kind+' '+i,memo:'',lat:35.65+i*0.00001,lng:139.82,deleted:false,guid:null,poiId:null,metadata:{}};}
function proposed(kind){return {role:'new',kind,title:'Added test',memo:'',lat:35.75,lng:139.85};}
test('199 existing and 9 gym + 3 power new POIs preserve their identities while forbidding extra gym',()=>{
 const rows=[...Array.from({length:199},(_,i)=>existing(i)),
  ...Array.from({length:9},(_,i)=>fresh(i,'gym')),
  ...Array.from({length:3},(_,i)=>fresh(i+9,'power'))];
 const store=createPoiStore(rows);
 const initial=store.snapshot();
 assert.equal(initial.counts.existing.count,199);
 assert.equal(initial.counts.new.count,12);
 assert.equal(initial.counts.new.types.gym.count,9);
 assert.equal(initial.counts.newOverLimit,true);
 assert.equal(initial.records.length,211);
 assert.equal(store.execute({type:'add',poi:proposed('gym')},{confirmed:true}).ok,false);
 assert.deepEqual(store.snapshot().records,initial.records);
 assert.equal(store.execute({type:'add',poi:proposed('pokestop')},{confirmed:false}).changed,false);
 assert.deepEqual(store.snapshot().records,initial.records);
 // A safe no-op does not silently delete or rename legacy over-limit gyms.
 assert.equal(store.snapshot().records.filter(p=>p.role==='new'&&p.kind==='gym'&&!p.deleted).length,9);
});
