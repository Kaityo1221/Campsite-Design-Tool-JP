import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createCreativeSaveJournal} from '../core/journal-save.mjs';
class Storage {
  constructor(){this.map=new Map();this.writes=[];}
  getItem(k){return this.map.get(k)??null;}
  setItem(k,v){this.map.set(k,String(v));this.writes.push(k);}
}
class ExclusiveLocks {
  constructor(){this.queues=new Map();this.active=0;this.maxActive=0;this.requests=[];}
  request(name,options,callback){
    assert.equal(options.mode,'exclusive');
    this.requests.push(name);
    const predecessor=this.queues.get(name)||Promise.resolve();
    const run=predecessor.catch(()=>{}).then(async()=>{
      this.active++;this.maxActive=Math.max(this.active,this.maxActive);
      try {return await callback({name,mode:'exclusive'});} finally {this.active--;}
    });
    this.queues.set(name,run.then(()=>{},()=>{}));
    return run;
  }
}
function snapshot(title){return {records:[{id:'existing-1',role:'existing',kind:'pokestop',title,lat:35.1,lng:139.4}],activityAreas:[]};}
function journal(storage,locks,extra={}){return createCreativeSaveJournal({storage,locks,requireLock:true,subtle:webcrypto.subtle,...extra});}
test('browser save refuses to write when an exclusive lock is unavailable',async()=>{
 const storage=new Storage(),j=journal(storage,null);
 await assert.rejects(()=>j.save(snapshot('A')),(e)=>e.code==='SAVE_LOCK_UNAVAILABLE');
 assert.equal(storage.writes.length,0);
 assert.equal((await j.load()).status,'EMPTY');
});
test('two simultaneous first saves: exactly one expected-revision:null writer commits, no corrupt pointer',async()=>{
 const storage=new Storage(),locks=new ExclusiveLocks(),a=journal(storage,locks),b=journal(storage,locks);
 const results=await Promise.allSettled([
   a.save(snapshot('Alice'),{expectedRevision:null}),
   b.save(snapshot('Bob'),{expectedRevision:null}),
 ]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='SAVE_CONFLICT').length,1);
 const loaded=await a.load();
 assert.equal(loaded.status,'READY');assert.equal(loaded.revision,1);assert.equal(loaded.snapshot.records[0].title,'Alice');
 assert.equal(locks.maxActive,1);assert.equal(locks.requests.length,2);
 assert.equal(locks.requests[0],a.keys.pointer.replace(/:current$/,':save-lock'));
});
test('same revision, two simultaneous updates: old revision is preserved and only one writer commits',async()=>{
 const storage=new Storage(),locks=new ExclusiveLocks(),a=journal(storage,locks),b=journal(storage,locks);
 await a.save(snapshot('Baseline'),{expectedRevision:null});
 const results=await Promise.allSettled([
   a.save(snapshot('Updated Alice'),{expectedRevision:1}),
   b.save(snapshot('Updated Bob'),{expectedRevision:1}),
 ]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.code==='SAVE_CONFLICT').length,1);
 const after=await a.load();assert.equal(after.status,'READY');assert.equal(after.revision,2);
 assert.equal(after.snapshot.records[0].title,'Updated Alice');assert.equal(locks.maxActive,1);
});
test('a failed queued writer does not stall the lock queue or disturb healthy generation',async()=>{
 const storage=new Storage(),locks=new ExclusiveLocks(),a=journal(storage,locks),b=journal(storage,locks);
 await a.save(snapshot('Original'));
 const rejected=b.save({...snapshot('Bad'),records:[]},{expectedRevision:1});
 const valid=a.save(snapshot('New'),{expectedRevision:1});
 const badResult=await Promise.allSettled([rejected,valid]);
 assert.equal(badResult[0].status,'rejected');assert.equal(badResult[0].reason.code,'SAVE_EXISTING_REMOVED');
 assert.equal(badResult[1].status,'fulfilled');
 assert.equal((await a.load()).status,'READY');assert.equal((await a.load()).revision,2);
});
test('independent save namespaces use separate exclusive lock names',async()=>{
 const storage=new Storage(),locks=new ExclusiveLocks();
 const a=journal(storage,locks,{namespace:'campsite-creative-next-v1-preview'});
 const b=journal(storage,locks,{namespace:'campsite-creative-next-v1-other'});
 await Promise.all([a.save(snapshot('A')),b.save(snapshot('B'))]);
 assert.notEqual(locks.requests[0],locks.requests[1]);
 assert.equal((await a.load()).status,'READY');assert.equal((await b.load()).status,'READY');
});
