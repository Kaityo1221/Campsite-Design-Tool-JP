/*
 * Creative Next Phase 1-B: isolated two-generation snapshot journal.
 * Caller injects a storage-like object. NEVER reads/writes the old v7 save key.
 * No UI or live-store changes. Not an atomic multi-key localStorage transaction.
 */
const DEFAULT_NS='campsite-creative-next-v1';
const MAX_BYTES=8*1024*1024; // Provisional isolated safety envelope, not a device-tested limit.
const TYPES=new Set(['pokestop','gym','power']);
const ROLES=new Set(['existing','new']);
function fail(code,message){const e=new Error(message);e.code=code;return e}
function plainJSON(value,seen=new WeakSet(),depth=0){
  if(depth>70)throw fail('SAVE_INVALID','Excessive JSON nesting');
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='number'&&Number.isFinite(value))return;
  if(typeof value!=='object')throw fail('SAVE_INVALID','Unserializable state');
  if(seen.has(value))throw fail('SAVE_INVALID','Cyclic/reused object references not accepted');
  if(ArrayBuffer.isView(value)||value instanceof Date)throw fail('SAVE_INVALID','Non-JSON object');
  if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)
    throw fail('SAVE_INVALID','Unsupported object prototype');
  seen.add(value);
  if(Array.isArray(value)&&Object.keys(value).filter(k=>/^(0|[1-9]\d*)$/.test(k)).length!==value.length)
    throw fail('SAVE_INVALID','Sparse JSON arrays would lose information');
  for(const [key,item] of Object.entries(value)){
    if(key==='__proto__'||key==='constructor'||key==='prototype')throw fail('SAVE_INVALID','Unsafe object property');
    plainJSON(item,seen,depth+1);
  }
  seen.delete(value);
}
function validateSnapshot(snapshot){
  plainJSON(snapshot);
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||!Array.isArray(snapshot.records)||!Array.isArray(snapshot.activityAreas))
    throw fail('SAVE_INVALID','Missing records or activityAreas');
  const ids=new Set();let existing=0;
  for(const r of snapshot.records){
    if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.id!=='string'||!r.id||ids.has(r.id)||
       !ROLES.has(r.role)||!TYPES.has(r.kind)||typeof r.title!=='string'||!r.title||
       typeof r.lat!=='number'||typeof r.lng!=='number'||!Number.isFinite(r.lat)||!Number.isFinite(r.lng)||
       Math.abs(r.lat)>90||Math.abs(r.lng)>180||
       (r.deleted!==undefined&&typeof r.deleted!=='boolean')||
       (r.memo!==undefined&&typeof r.memo!=='string'))throw fail('SAVE_INVALID','Invalid or duplicate POI');
    ids.add(r.id);if(r.role==='existing'&&r.deleted!==true)existing++;
  }
  if(existing>700)throw fail('SAVE_INVALID','701+ existing active records');
  const areaIds=new Set();
  for(const a of snapshot.activityAreas){
    if(!a||typeof a!=='object'||typeof a.id!=='string'||!a.id||areaIds.has(a.id)||
      !Array.isArray(a.points)||a.points.length<3||!a.points.every(p=>Array.isArray(p)&&p.length===2&&
        typeof p[0]==='number'&&Number.isFinite(p[0])&&Math.abs(p[0])<=90&&
        typeof p[1]==='number'&&Number.isFinite(p[1])&&Math.abs(p[1])<=180))
      throw fail('SAVE_INVALID','Invalid activity-area vertices');
    areaIds.add(a.id);
  }
  return true;
}
function stringOf(object){try{return JSON.stringify(object)}catch{throw fail('SAVE_INVALID','Cannot stringify save')}}
const encoder=new TextEncoder();
function shaBytes(array){return Array.from(array,b=>b.toString(16).padStart(2,'0')).join('')}
async function hash(value,subtle){
  if(!subtle||typeof subtle.digest!=='function')throw fail('SAVE_CRYPTO','SHA-256 digest support is required');
  return shaBytes(new Uint8Array(await subtle.digest('SHA-256',encoder.encode(value))));
}
function tryParse(value){try{return JSON.parse(value)}catch{return null}}
export function createCreativeSaveJournal({storage,namespace=DEFAULT_NS,subtle=globalThis.crypto?.subtle}={}){
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw fail('SAVE_CONFIG','Storage object required');
  if(typeof namespace!=='string'||!/^campsite-creative-next-v\d+(?:-[\w-]+)?$/.test(namespace)||namespace==='next-lab-creative-v7')
    throw fail('SAVE_CONFIG','Use an isolated Creative Next namespace');
  const key=(suffix)=>namespace+':'+suffix;
  const readKey=(suffix)=>storage.getItem(key(suffix));
  const writeKey=(suffix,value)=>storage.setItem(key(suffix),value);
  async function inspect(slot){
    const raw=readKey('slot-'+slot);
    if(raw===null)return {slot,state:'EMPTY'};
    const content=tryParse(raw);
    if(!content||content.version!==1||!Number.isSafeInteger(content.seq)||content.seq<1||
      typeof content.checksum!=='string'||typeof content.body!=='string'||content.body.length>MAX_BYTES)
      return {slot,state:'INVALID'};
    if((await hash(content.body,subtle))!==content.checksum)return {slot,state:'INVALID'};
    const snapshot=tryParse(content.body);
    try{validateSnapshot(snapshot)}catch{return {slot,state:'INVALID'}}
    return {slot,state:'VALID',seq:content.seq,checksum:content.checksum,snapshot};
  }
  async function load(){
    const rawPointer=readKey('current');
    const pointer=rawPointer===null?null:tryParse(rawPointer);
    const slots=[await inspect('a'),await inspect('b')];
    const valid=slots.filter(s=>s.state==='VALID').sort((a,b)=>b.seq-a.seq);
    if(rawPointer===null&&slots.every(s=>s.state==='EMPTY'))return {status:'EMPTY',snapshot:null,revision:null};
    const pointed=valid.find(s=>s.slot===pointer?.slot&&s.seq===pointer?.seq&&s.checksum===pointer?.checksum);
    if(pointed)return {status:'READY',snapshot:pointed.snapshot,revision:pointed.seq,slot:pointed.slot};
    if(valid.length)return {status:'FALLBACK',snapshot:valid[0].snapshot,revision:valid[0].seq,slot:valid[0].slot,reason:'Pointer invalid/missing, inspected intact generation only; no automatic repairs performed'};
    return {status:'CORRUPT',snapshot:null,revision:null,reason:'No valid generation; original storage not changed'};
  }
  async function save(snapshot,{expectedRevision,restoreDeletedIds=[]}={}){
    if(!Array.isArray(restoreDeletedIds)||restoreDeletedIds.some(x=>typeof x!=='string'))
      throw fail('SAVE_INVALID','Explicit undo-restoration IDs must be strings');
    const restored=new Set(restoreDeletedIds);
    validateSnapshot(snapshot);
    const body=stringOf(snapshot);
    if(encoder.encode(body).byteLength>MAX_BYTES)throw fail('SAVE_LIMIT','Snapshot exceeds isolated safety envelope');
    const initialPointer=readKey('current');
    const baseline=await load();
    if(baseline.status==='CORRUPT'||baseline.status==='FALLBACK')throw fail('SAVE_RECOVERY_REQUIRED','Existing save requires explicit recovery before writing');
    if(expectedRevision!==undefined&&expectedRevision!==baseline.revision)throw fail('SAVE_CONFLICT','Save version changed in another tab');
    // Enforce existing-location immutability and preserve tombstones across edits.
    // A full dataset replacement needs a distinct, user-confirmed import commit gate.
    if(baseline.status==='READY'){
      const nextById=new Map(snapshot.records.map(r=>[r.id,r]));
      for(const old of baseline.snapshot.records){
        const current=nextById.get(old.id);
        if(!current)throw fail('SAVE_EXISTING_REMOVED','POI removed without a tombstone; use a verified replacement workflow');
        if(current.role!==old.role)throw fail('SAVE_ROLE_CHANGED','POI role is immutable after first save');
        if(old.role==='existing'&&(current.lat!==old.lat||current.lng!==old.lng))
          throw fail('SAVE_EXISTING_MOVED','An existing POI cannot move');
        if(old.deleted===true&&current.deleted!==true&&!restored.has(old.id))
          throw fail('SAVE_TOMBSTONE_REVIVED','Deleted POI may be restored only through an authorized undo workflow');
      }
    }
    const seq=(baseline.revision||0)+1;
    const slot=baseline.status==='EMPTY'?'a':(baseline.slot==='a'?'b':'a');
    const checksum=await hash(body,subtle);
    const slotContent=stringOf({version:1,seq,checksum,body});
    // Check for another writer before touching the inactive generation.
    if(readKey('current')!==initialPointer)throw fail('SAVE_CONFLICT','Pointer changed while preparing snapshot');
    writeKey('slot-'+slot,slotContent);
    const verified=await inspect(slot);
    if(verified.state!=='VALID'||verified.seq!==seq||verified.checksum!==checksum)
      throw fail('SAVE_VERIFY','Snapshot failed immediate read-back verification');
    if(readKey('current')!==initialPointer)throw fail('SAVE_CONFLICT','Another writer changed pointer before commit');
    const nextPointer=stringOf({version:1,slot,seq,checksum});
    writeKey('current',nextPointer);
    if(readKey('current')!==nextPointer)throw fail('SAVE_VERIFY','Commit pointer could not be read back');
    const published=await load();
    if(published.status!=='READY'||published.slot!==slot||published.revision!==seq)
      throw fail('SAVE_VERIFY','Published snapshot failed final validation');
    return {status:'SAVED',revision:seq,slot};
  }
  return Object.freeze({load,save,keys:Object.freeze({pointer:key('current'),slotA:key('slot-a'),slotB:key('slot-b')})});
}