import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreativeSaveJournal} from '../core/journal-save.mjs';
class MemoryStorage {
  constructor(){this.data=new Map();this.writes=[];this.interceptor=null}
  getItem(key){return this.data.has(key)?this.data.get(key):null}
  setItem(key,value){if(this.interceptor)this.interceptor(key,value,this);this.data.set(key,String(value));this.writes.push(key)}
  removeItem(key){this.data.delete(key)}
}
function record(id='poi-1',role='existing'){return {id,role,kind:'pokestop',title:'名称 '+id,lat:35.123,lng:139.234,memo:'☘️'}}
function snapshot(extra={}){return {records:[record()],activityAreas:[{id:'activity-1',points:[[35,139],[35.1,139],[35,139.1]]}],view:{center:[35,139],zoom:15,layers:{existing:true}},...extra}}
const make=s=>createCreativeSaveJournal({storage:s});

test('first verified save can be reopened from the same storage',async()=>{
  const storage=new MemoryStorage();const journal=make(storage);
  assert.equal((await journal.load()).status,'EMPTY');
  assert.deepEqual(await journal.save(snapshot()),{status:'SAVED',revision:1,slot:'a'});
  assert.equal((await make(storage).load()).status,'READY');
  assert.deepEqual((await make(storage).load()).snapshot,snapshot());
});
test('two generations rotate; previous good version always remains intact',async()=>{
  const st=new MemoryStorage(),j=make(st);
  await j.save(snapshot());const previous=st.getItem(j.keys.slotA);
  await j.save(snapshot({records:[record(),record('poi-2','new')]}),{expectedRevision:1});
  assert.equal(st.getItem(j.keys.slotA),previous);
  assert.equal((await j.load()).snapshot.records.length,2);
  assert.equal((await j.load()).revision,2);
});
test('recovery from corrupt current slot uses the last healthy generation without rewriting it',async()=>{
  const st=new MemoryStorage(),j=make(st);await j.save(snapshot());await j.save(snapshot({records:[record(),record('new','new')]}));
  const ptr=st.getItem(j.keys.pointer),slotA=st.getItem(j.keys.slotA);
  st.setItem(j.keys.slotB,'{tampered}');const r=await j.load();
  assert.equal(r.status,'FALLBACK');assert.equal(r.revision,1);
  assert.equal(st.getItem(j.keys.pointer),ptr);assert.equal(st.getItem(j.keys.slotA),slotA);
});
test('pointer corruption returns valid fallback; no storage is auto-repaired',async()=>{
  const st=new MemoryStorage(),j=make(st);await j.save(snapshot());
  st.setItem(j.keys.pointer,'BROKEN');const before=st.data.size;
  const x=await j.load();assert.equal(x.status,'FALLBACK');assert.equal(x.snapshot.records.length,1);assert.equal(st.data.size,before);
});
test('two valid generations but no pointer chooses highest and warns instead of adopting silently',async()=>{
  const st=new MemoryStorage(),j=make(st);await j.save(snapshot());await j.save(snapshot({records:[record(),record('other','new')]}));
  st.removeItem(j.keys.pointer);const x=await j.load();assert.equal(x.status,'FALLBACK');assert.equal(x.revision,2);
});
test('corrupt both snapshots yields CORRUPT, no data wiped',async()=>{
  const st=new MemoryStorage(),j=make(st);await j.save(snapshot());
  st.setItem(j.keys.slotA,'invalid');const before=new Map(st.data);
  assert.equal((await j.load()).status,'CORRUPT');assert.deepEqual(st.data,before);
});
test('save rejected while corrupted generations need explicit recovery',async()=>{
  const st=new MemoryStorage(),j=make(st);await j.save(snapshot());
  st.setItem(j.keys.pointer,'broken');await assert.rejects(()=>j.save(snapshot()),e=>e.code==='SAVE_RECOVERY_REQUIRED');
});
test('failed inactive-slot write preserves previous committed generation',async()=>{
  const st=new MemoryStorage(),j=make(st);await j.save(snapshot());
  st.interceptor=(key)=>{if(key===j.keys.slotB)throw Error('quota exceeded')};
  await assert.rejects(()=>j.save(snapshot({records:[record(),record('new','new')]})),/quota exceeded/);
  assert.equal((await j.load()).status,'READY');assert.equal((await j.load()).snapshot.records[0].id,'poi-1');
});
test('failed pointer write preserves old generation while new slot is left uncommitted',async()=>{
  const st=new MemoryStorage(),j=make(st);await j.save(snapshot());
  st.interceptor=(key)=>{if(key===j.keys.pointer)throw Error('pointer quota exceeded')};
  await assert.rejects(()=>j.save(snapshot({records:[record(),record('new','new')]})),/pointer quota exceeded/);
  assert.equal((await j.load()).status,'READY');assert.equal((await j.load()).revision,1);
  assert.equal(st.getItem(j.keys.slotB)!==null,true);
});
test('silently discarded slot write is discovered on readback',async()=>{
  const st=new MemoryStorage(),j=make(st);await j.save(snapshot());
  st.interceptor=(key,value,store)=>{if(key===j.keys.slotB)throw Error('ignored write')};
  await assert.rejects(()=>j.save(snapshot({records:[record(),record('new','new')]})),/ignored write/);
  assert.equal((await j.load()).revision,1);
});
test('overwritten pointer not equal to expected revision flags version conflict',async()=>{
  const st=new MemoryStorage(),j=make(st);await j.save(snapshot());
  await assert.rejects(()=>j.save(snapshot({records:[record(),record('new','new')]}),{expectedRevision:0}),e=>e.code==='SAVE_CONFLICT');
  assert.equal((await j.load()).revision,1);
});
test('pointer modified before switch prevents committing staged generation',async()=>{
  const st=new MemoryStorage(),j=make(st);await j.save(snapshot());
  const old=st.getItem(j.keys.pointer);
  st.interceptor=(key,_,store)=>{if(key===j.keys.slotB){store.data.set(j.keys.pointer,'OTHER_TAB_CHANGED');store.interceptor=null}};
  await assert.rejects(()=>j.save(snapshot({records:[record(),record('new','new')]})),e=>e.code==='SAVE_CONFLICT');
  assert.notEqual(st.getItem(j.keys.pointer),old);assert.equal((await j.load()).status,'FALLBACK');
});
test('old Creative key is never read, overwritten or deleted',async()=>{
  const st=new MemoryStorage();st.setItem('next-lab-creative-v7','重要な既存データ');const j=make(st);
  await j.save(snapshot());await j.load();await j.save(snapshot());
  assert.equal(st.getItem('next-lab-creative-v7'),'重要な既存データ');
  assert.equal(st.writes.filter(k=>k==='next-lab-creative-v7').length,1);
});
test('invalid user data, duplicate POI ids, illegal coordinates are rejected before writing',async()=>{
  const st=new MemoryStorage(),j=make(st);
  for(const sn of [snapshot({records:[record(),record()]}),snapshot({records:[{...record(),lat:NaN}]}),snapshot({records:[{...record(),role:'added'}]}),snapshot({records:[{...record(),lng:190}]}),snapshot({activityAreas:[{id:'bad',points:[[35,139],[35,139]]}]})])
    await assert.rejects(()=>j.save(sn),e=>e.code==='SAVE_INVALID');
  assert.equal(st.data.size,0);
});
test('existing 701 active is refused, but new 26 is safe to store',async()=>{
  const st=new MemoryStorage(),j=make(st);
  const bad=snapshot({records:Array.from({length:701},(_,i)=>record('p'+i))});
  await assert.rejects(()=>j.save(bad),e=>e.code==='SAVE_INVALID');
  const allowed=snapshot({records:Array.from({length:26},(_,i)=>record('new'+i,'new'))});
  await j.save(allowed);assert.equal((await j.load()).snapshot.records.length,26);
});
test('deleted existing is preserved as tombstone; does not contribute to live 700 cap',async()=>{
  const st=new MemoryStorage(),j=make(st);
  const sn=snapshot({records:[...Array.from({length:700},(_,i)=>record('p'+i)),{...record('old-deleted'),deleted:true}]});
  await j.save(sn);assert.equal((await j.load()).snapshot.records.length,701);assert.equal((await j.load()).snapshot.records.at(-1).deleted,true);
});
test('non-JSON values cannot be silently stringified away',async()=>{
  const st=new MemoryStorage(),j=make(st);
  const weird=snapshot({unserializable:()=>true});
  await assert.rejects(()=>j.save(weird),e=>e.code==='SAVE_INVALID');
  assert.equal(st.data.size,0);
});
test('constructor explicitly rejects legacy namespace',()=>{
  const st=new MemoryStorage();assert.throws(()=>createCreativeSaveJournal({storage:st,namespace:'next-lab-creative-v7'}),e=>e.code==='SAVE_CONFIG');
});

test('previously saved existing coordinates cannot be changed by a later save',async()=>{
  const st=new MemoryStorage(),j=make(st);await j.save(snapshot());
  await assert.rejects(()=>j.save(snapshot({records:[{...record(),lat:35.888}]})),e=>e.code==='SAVE_EXISTING_MOVED');
  assert.equal((await j.load()).snapshot.records[0].lat,35.123);
});
test('previously saved role cannot be switched by rewriting ID',async()=>{
  const st=new MemoryStorage(),j=make(st);await j.save(snapshot());
  await assert.rejects(()=>j.save(snapshot({records:[record('poi-1','new')]})),e=>e.code==='SAVE_ROLE_CHANGED');
});
test('POI disappears without tombstone is blocked to avoid silent loss',async()=>{
  const st=new MemoryStorage(),j=make(st);await j.save(snapshot());
  await assert.rejects(()=>j.save(snapshot({records:[]})),e=>e.code==='SAVE_EXISTING_REMOVED');
});
test('explicit tombstone saves and can be reopened',async()=>{
  const st=new MemoryStorage(),j=make(st);await j.save(snapshot());
  await j.save(snapshot({records:[{...record(),deleted:true}]}));
  assert.equal((await j.load()).snapshot.records[0].deleted,true);
});
test('an unapproved tombstone revival is blocked',async()=>{
  const st=new MemoryStorage(),j=make(st);await j.save(snapshot({records:[{...record(),deleted:true}]}));
  await assert.rejects(()=>j.save(snapshot()),e=>e.code==='SAVE_TOMBSTONE_REVIVED');
});
test('sparse arrays are rejected rather than replaced with null',async()=>{
  const st=new MemoryStorage(),j=make(st);const sparse=[record()];sparse.length=2;
  await assert.rejects(()=>j.save(snapshot({records:sparse})),e=>e.code==='SAVE_INVALID');
});

test('explicit undo-restoration can revive only the named POI without moving existing coordinates',async()=>{
  const st=new MemoryStorage(),j=make(st);await j.save(snapshot({records:[{...record(),deleted:true}]}));
  await j.save(snapshot(),{restoreDeletedIds:['poi-1']});
  assert.equal((await j.load()).snapshot.records[0].deleted,undefined);
});

test('third verified revision preserves its immediately preceding revision and rotates back to A',async()=>{
 const st=new MemoryStorage(),j=make(st);
 await j.save(snapshot());
 await j.save(snapshot({records:[record(),record('added','new')]}));
 const slotB=st.getItem(j.keys.slotB);
 await j.save(snapshot({records:[record(),record('added','new'),record('third','new')]}),{expectedRevision:2});
 const loaded=await j.load();assert.equal(loaded.status,'READY');assert.equal(loaded.revision,3);
 assert.equal(loaded.slot,'a');assert.equal(loaded.snapshot.records.length,3);
 assert.equal(st.getItem(j.keys.slotB),slotB);
});

test('stale tab cannot overwrite a newer revision and does not touch saved pointer',async()=>{
 const st=new MemoryStorage(),a=make(st),b=make(st);
 await a.save(snapshot());const staleRevision=(await b.load()).revision;
 await a.save(snapshot({records:[record(),record('added','new')]}));
 const latestPointer=st.getItem(a.keys.pointer),latestSlot=st.getItem(a.keys.slotB);
 await assert.rejects(()=>b.save(snapshot(),{expectedRevision:staleRevision}),e=>e.code==='SAVE_CONFLICT');
 assert.equal(st.getItem(a.keys.pointer),latestPointer);
 assert.equal(st.getItem(a.keys.slotB),latestSlot);
 assert.equal((await a.load()).snapshot.records.length,2);
});

test('quota error on initial write leaves both generations empty and legacy value intact',async()=>{
 const st=new MemoryStorage();st.setItem('next-lab-creative-v7','OLD SAFE');
 const j=make(st);
 st.interceptor=(key)=>{if(key===j.keys.slotA)throw Object.assign(new Error('Storage full'),{name:'QuotaExceededError'})};
 await assert.rejects(()=>j.save(snapshot()),e=>e.name==='QuotaExceededError');
 assert.equal((await j.load()).status,'EMPTY');
 assert.equal(st.getItem(j.keys.pointer),null);
 assert.equal(st.getItem('next-lab-creative-v7'),'OLD SAFE');
});

test('pointer corruption after valid second save stays read-only until explicit recovery',async()=>{
 const st=new MemoryStorage(),j=make(st);
 await j.save(snapshot());await j.save(snapshot({records:[record(),record('new','new')]}));
 st.setItem(j.keys.pointer,'BROKEN');
 const report=await j.load();assert.equal(report.status,'FALLBACK');assert.equal(report.revision,2);
 const unchanged=new Map(st.data);
 await assert.rejects(()=>j.save(snapshot({records:[record(),record('new','new')]})),e=>e.code==='SAVE_RECOVERY_REQUIRED');
 assert.deepEqual(st.data,unchanged);
});
