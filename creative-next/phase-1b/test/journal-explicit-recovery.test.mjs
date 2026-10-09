import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createCreativeSaveJournal} from '../core/journal-save.mjs';

class Storage {
  constructor(){this.data=new Map();this.writes=[];this.rejectPointer=false;}
  getItem(k){return this.data.get(k)??null;}
  setItem(k,v){if(this.rejectPointer&&k.endsWith(':current'))throw new Error('quota failure');this.data.set(k,String(v));this.writes.push(k);}
  removeItem(k){this.data.delete(k);}
}
class Locks {
  constructor(){this.queue=Promise.resolve();}
  request(_key,opts,cb){
    assert.equal(opts.mode,'exclusive');
    const p=this.queue.then(()=>cb());
    this.queue=p.catch(()=>{});
    return p;
  }
}
const snap=(title)=>({records:[{id:'kept',kind:'pokestop',role:'existing',title,lat:35,lng:139}],activityAreas:[]});
const make=(storage,locks)=>createCreativeSaveJournal({storage,locks,subtle:webcrypto.subtle,requireLock:true});
async function twoRevisions(){
  const storage=new Storage(),locks=new Locks(),journal=make(storage,locks);
  await journal.save(snap('First'),{expectedRevision:null});
  await journal.save(snap('Second'),{expectedRevision:1});
  return {storage,locks,journal};
}
test('inspection lists verified generations without changing either slot or pointer',async()=>{
  const {storage,journal}=await twoRevisions();
  storage.setItem(journal.keys.pointer,'BROKEN');
  const before=new Map(storage.data);
  const r=await journal.inspectRecovery();
  assert.equal(r.status,'FALLBACK');
  assert.deepEqual(r.candidates.map(c=>c.revision).sort(),[1,2]);
  assert.deepEqual(storage.data,before);
  assert.deepEqual(Object.keys(r.candidates[0]).sort(),['checksum','revision','slot']);
});
test('explicit recovery may select older intact generation without altering either saved slot',async()=>{
  const {storage,journal}=await twoRevisions();
  storage.setItem('next-lab-creative-v7','existing data, protected');
  storage.setItem(journal.keys.pointer,'BROKEN');
  const slotA=storage.getItem(journal.keys.slotA),slotB=storage.getItem(journal.keys.slotB);
  const report=await journal.inspectRecovery(),choice=report.candidates.find(c=>c.revision===1);
  const result=await journal.recover({...choice,observedPointer:report.observedPointer,confirmed:true});
  assert.deepEqual(result,{status:'RECOVERED',slot:'a',revision:1});
  assert.equal((await journal.load()).snapshot.records[0].title,'First');
  assert.equal(storage.getItem(journal.keys.slotA),slotA);
  assert.equal(storage.getItem(journal.keys.slotB),slotB);
  assert.equal(storage.getItem('next-lab-creative-v7'),'existing data, protected');
  await journal.save(snap('Third'),{expectedRevision:1});
  assert.equal((await journal.load()).revision,2);
});
test('recovery refuses without explicit confirmation or selected valid fingerprint',async()=>{
  const {storage,journal}=await twoRevisions();
  storage.removeItem(journal.keys.pointer);
  const report=await journal.inspectRecovery(),choice=report.candidates[0];
  const before=new Map(storage.data);
  await assert.rejects(()=>journal.recover({...choice,observedPointer:report.observedPointer}),e=>e.code==='SAVE_CONFIRM_REQUIRED');
  await assert.rejects(()=>journal.recover({...choice,checksum:'0'.repeat(64),observedPointer:report.observedPointer,confirmed:true}),e=>e.code==='SAVE_CONFLICT');
  assert.deepEqual(storage.data,before);
});
test('recovery rejects a stale diagnostic after another tab repairs the pointer',async()=>{
  const {storage,journal}=await twoRevisions();
  storage.setItem(journal.keys.pointer,'broken');
  const report=await journal.inspectRecovery(),choice=report.candidates[0];
  storage.setItem(journal.keys.pointer,'other-tab-write');
  const before=new Map(storage.data);
  await assert.rejects(()=>journal.recover({...choice,observedPointer:report.observedPointer,confirmed:true}),e=>e.code==='SAVE_CONFLICT');
  assert.deepEqual(storage.data,before);
});
test('healthy, empty or fully corrupt journals do not permit recovery',async()=>{
  const {storage,journal}=await twoRevisions();
  const healthy=await journal.inspectRecovery();
  await assert.rejects(()=>journal.recover({...healthy.candidates[0],observedPointer:healthy.observedPointer,confirmed:true}),e=>e.code==='SAVE_RECOVERY_INVALID');
  storage.setItem(journal.keys.pointer,'broken');
  storage.setItem(journal.keys.slotA,'corrupt');storage.setItem(journal.keys.slotB,'corrupt');
  const broken=await journal.inspectRecovery();assert.equal(broken.status,'CORRUPT');
  await assert.rejects(()=>journal.recover({slot:'a',revision:1,checksum:'0'.repeat(64),observedPointer:broken.observedPointer,confirmed:true}),e=>e.code==='SAVE_RECOVERY_INVALID');
  const empty=make(new Storage(),new Locks());const rep=await empty.inspectRecovery();
  assert.equal(rep.status,'EMPTY');
  await assert.rejects(()=>empty.recover({slot:'a',revision:1,checksum:'0'.repeat(64),observedPointer:rep.observedPointer,confirmed:true}),e=>e.code==='SAVE_RECOVERY_INVALID');
});
test('recovery requires a cross-tab lock; no fallback to unprotected writes',async()=>{
  const {storage,journal}=await twoRevisions();storage.setItem(journal.keys.pointer,'BROKEN');
  const report=await journal.inspectRecovery();const choice=report.candidates[0];
  const noLock=make(storage,null),before=new Map(storage.data);
  await assert.rejects(()=>noLock.recover({...choice,observedPointer:report.observedPointer,confirmed:true}),e=>e.code==='SAVE_LOCK_UNAVAILABLE');
  assert.deepEqual(storage.data,before);
});
test('failed pointer write preserves candidate data and remains read-only',async()=>{
  const {storage,journal}=await twoRevisions();storage.setItem(journal.keys.pointer,'BROKEN');
  const report=await journal.inspectRecovery(),choice=report.candidates[0],before=new Map(storage.data);
  storage.rejectPointer=true;
  await assert.rejects(()=>journal.recover({...choice,observedPointer:report.observedPointer,confirmed:true}),/quota failure/);
  assert.deepEqual(storage.data,before);
  assert.equal((await journal.load()).status,'FALLBACK');
});
test('recovery reports version change if chosen slot is corrupted after inspection',async()=>{
  const {storage,journal}=await twoRevisions();storage.setItem(journal.keys.pointer,'BROKEN');
  const report=await journal.inspectRecovery();const choice=report.candidates.find(c=>c.slot==='a');
  storage.setItem(journal.keys.slotA,'bad');const before=new Map(storage.data);
  await assert.rejects(()=>journal.recover({...choice,observedPointer:report.observedPointer,confirmed:true}),e=>e.code==='SAVE_CONFLICT');
  assert.deepEqual(storage.data,before);
});
