/*
 * Creative Next experiment: independent, strictly durable IndexedDB checkpoints.
 * ISOLATED ONLY. Not attached to the production Creative Mode or legacy v7 key.
 * IndexedDB strict durability is a user-agent hint, never an fsync guarantee.
 */
const DB_NAME='campsite-creative-next-v1-strict-checkpoints';
const STORE='checkpoints';
const DEFAULT_NAMESPACE='campsite-creative-next-v1-preview';
const MAX_SIZE=8*1024*1024;
const enc=new TextEncoder();
function failure(code,detail){const err=new Error(detail);err.code=code;return err}
function digest(hexBytes){return [...hexBytes].map(x=>x.toString(16).padStart(2,'0')).join('')}
function parseBody(s){try{return JSON.parse(s)}catch{return null}}
function checkedRevision(value){return value===null||(Number.isSafeInteger(value)&&value>=1)}
function promiseTransaction(db,mode,actor){
 return new Promise((resolve,reject)=>{
  let tx;try{tx=db.transaction(STORE,mode,mode==='readwrite'?{durability:'strict'}:undefined)}
  catch(error){reject(failure('IDB_TRANSACTION',String(error)));return}
  if(mode==='readwrite'&&tx.durability!==undefined&&tx.durability!=='strict'){
   try{tx.abort()}catch{}reject(failure('IDB_DURABILITY','Browser did not accept strict durability'));return;
  }
  let value,abortReason=null;
  tx.oncomplete=()=>resolve(value);
  tx.onabort=()=>reject(abortReason||failure('IDB_ABORT',tx.error?.message||'Checkpoint transaction aborted'));
  tx.onerror=()=>{}; // abort event is the sole rejection path
  try{actor(tx.objectStore(STORE),v=>{value=v},e=>{abortReason=e;try{tx.abort()}catch{}})}
  catch(err){abortReason=err;try{tx.abort()}catch{} }
 });
}
function openStore(indexedDB){
 return new Promise((resolve,reject)=>{
  let req;try{req=indexedDB.open(DB_NAME,1)}catch(e){reject(failure('IDB_OPEN',String(e)));return}
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};
  req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>db.close();resolve(db)};
  req.onerror=()=>reject(failure('IDB_OPEN',req.error?.message||'IndexedDB open failed'));
  req.onblocked=()=>reject(failure('IDB_BLOCKED','IndexedDB upgrade blocked by another tab'));
 });
}
export function createStrictIndexedCheckpoint({indexedDB=globalThis.indexedDB,subtle=globalThis.crypto?.subtle,namespace=DEFAULT_NAMESPACE}={}){
 if(!indexedDB?.open||!subtle?.digest)throw failure('IDB_UNAVAILABLE','IndexedDB and SHA-256 are required');
 if(typeof namespace!=='string'||!/^campsite-creative-next-v\d+(?:-[\w-]+)?$/.test(namespace))
  throw failure('IDB_NAMESPACE','Checkpoint must use an isolated Creative Next namespace');
 let dbPromise=null;
 const open=()=>dbPromise??=openStore(indexedDB).catch(e=>{dbPromise=null;throw e});
 async function readRaw(){const db=await open();return promiseTransaction(db,'readonly',(store,resolve)=>{
  const req=store.get(namespace);req.onsuccess=()=>resolve(req.result??null);
 })}
 async function verify(entry){
  if(!entry||!Number.isSafeInteger(entry.revision)||entry.revision<1||typeof entry.body!=='string'||
     typeof entry.checksum!=='string'||!/^[0-9a-f]{64}$/.test(entry.checksum)||enc.encode(entry.body).length>MAX_SIZE)
   return null;
  const result=digest(new Uint8Array(await subtle.digest('SHA-256',enc.encode(entry.body))));
  if(result!==entry.checksum)return null;
  const snapshot=parseBody(entry.body);
  if(!snapshot||!Array.isArray(snapshot.records)||!Array.isArray(snapshot.activityAreas))return null;
  return {revision:entry.revision,snapshot};
 }
 async function inspectRaw(raw){
  if(raw===null)return {status:'EMPTY',revision:null,snapshot:null};
  if(raw.version!==1||!raw.current)return {status:'CORRUPT',revision:null,snapshot:null};
  const current=await verify(raw.current);
  if(current)return {status:'READY',...current,strictRequested:true};
  const previous=await verify(raw.previous);
  if(previous)return {status:'FALLBACK',...previous,strictRequested:true};
  return {status:'CORRUPT',revision:null,snapshot:null};
 }
 async function inspect(){return inspectRaw(await readRaw())}
 function sameStoredEnvelope(a,b){
  try{return JSON.stringify(a)===JSON.stringify(b)}catch{return false}
 }
 async function save(snapshot,{expectedRevision}={}){
  if(!checkedRevision(expectedRevision))throw failure('IDB_REVISION_REQUIRED','Expected revision must be null or positive integer');
  if(expectedRevision===undefined)throw failure('IDB_REVISION_REQUIRED','Expected revision must be supplied');
  if(!snapshot||!Array.isArray(snapshot.records)||!Array.isArray(snapshot.activityAreas))
   throw failure('IDB_INVALID','Invalid checkpoint document');
  const body=JSON.stringify(snapshot);
  if(typeof body!=='string'||enc.encode(body).length>MAX_SIZE)throw failure('IDB_LIMIT','Checkpoint too large');
  const checksum=digest(new Uint8Array(await subtle.digest('SHA-256',enc.encode(body))));
  const observedEnvelope=await readRaw();
  const prior=await inspectRaw(observedEnvelope);
  if(prior.status==='CORRUPT'||prior.status==='FALLBACK')throw failure('IDB_RECOVERY_REQUIRED','Checkpoint needs inspection before another write');
  const db=await open();
  const committed=await promiseTransaction(db,'readwrite',(store,resolve,abort)=>{
   const got=store.get(namespace);
   got.onerror=()=>abort(failure('IDB_READ','Unable to read current checkpoint'));
   got.onsuccess=()=>{
    const original=got.result??null;
    // Between preflight checksum inspection and the transaction, another tab
    // may rewrite the same revision. Refuse ANY changed IDB envelope, even if
    // its revision is unchanged, rather than silently erasing corrupt data.
    if(!sameStoredEnvelope(original,observedEnvelope))
     return abort(failure('IDB_CONFLICT','Checkpoint changed after checksum inspection'));
    // Never overwrite a corrupted record: only explicit recovery can decide.
    if(original&&(!original.current||!Number.isSafeInteger(original.current.revision)))
     return abort(failure('IDB_RECOVERY_REQUIRED','Corrupt checkpoint must be inspected'));
    const revision=original?.current?.revision??null;
    if(revision!==expectedRevision)return abort(failure('IDB_CONFLICT','Stale checkpoint revision'));
    const next=(revision??0)+1;
    const envelope={version:1,current:{revision:next,body,checksum},previous:original?.current??null};
    const put=store.put(envelope,namespace);
    put.onerror=()=>abort(failure('IDB_WRITE',put.error?.message||'Write failed'));
    put.onsuccess=()=>resolve({revision:next,strictRequested:true});
   };
  });
  const observed=await inspect();
  if(observed.status!=='READY'||observed.revision!==committed.revision||
     JSON.stringify(observed.snapshot)!==body)
    throw failure('IDB_VERIFY','Checkpoint did not pass read-after-commit validation');
  return {status:'CHECKPOINTED',...committed};
 }
 async function close(){if(dbPromise){(await dbPromise).close();dbPromise=null}}
 return Object.freeze({inspect,save,close});
}
