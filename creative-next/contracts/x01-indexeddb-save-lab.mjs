/*
 * X-01/X-04 LAB: real IndexedDB persist + explicit reload of a verified Project,
 * independently typed activity areas and untouched NEW_V1 KMZ bytes.
 *
 * Isolated database. One indexedDB readwrite transaction per complete bundle,
 * strict durability requested, one compare-and-swap revision. No migration,
 * production Project/localStorage, UI, source KMZ or r31 Session writes.
 * Strict durability is a best-effort browser hint, NOT crash-proof guarantee.
 */
import {createLinkedPairLab,reopenLinkedPairLab} from './linked-project-kmz-lab.mjs';

export const X01_LAB_DB='campsite-creative-next-x01-idb-lab-20261012';
const STORE='verified-pairs';
const ROW_KIND='campsite-x01-linked-project-kmz-LAB';
const VERSION=1;
function stop(code,cause){const e=new Error(code,{cause});e.code=code;throw e;}
const validId=v=>typeof v==='string'&&v.trim().length>0&&v.length<=128;
const keyOf=(projectId,handoffId)=>{
 if(!validId(projectId)||!validId(handoffId))stop('IDB_LAB_IDENTITY');
 return JSON.stringify([projectId,handoffId]);
};
function dbRequest(indexedDB,name){
 return new Promise((resolve,reject)=>{
  let done=false;
  const finish=(error,db)=>{
   if(done){db?.close?.();return;}
   done=true;if(error)reject(error);else resolve(db);
  };
  let request;
  try{request=indexedDB.open(name,VERSION);}catch(e){finish(Object.assign(new Error('IDB_LAB_UNAVAILABLE',{cause:e}),{code:'IDB_LAB_UNAVAILABLE'}));return;}
  request.onupgradeneeded=()=>{
   try{
    const db=request.result;
    if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});
   }catch(e){
    try{request.transaction?.abort();}catch(_){}
    finish(Object.assign(new Error('IDB_LAB_SCHEMA',{cause:e}),{code:'IDB_LAB_SCHEMA'}));
   }
  };
  request.onsuccess=()=>{
   const db=request.result;db.onversionchange=()=>db.close();
   if(!db.objectStoreNames.contains(STORE)){db.close();finish(Object.assign(new Error('IDB_LAB_SCHEMA'),{code:'IDB_LAB_SCHEMA'}));return;}
   finish(null,db);
  };
  request.onerror=()=>finish(Object.assign(new Error('IDB_LAB_OPEN_ERROR',{cause:request.error}),{code:'IDB_LAB_OPEN_ERROR'}));
  request.onblocked=()=>finish(Object.assign(new Error('IDB_LAB_BLOCKED'),{code:'IDB_LAB_BLOCKED'}));
 });
}
function rowMatches(a,b){
 if(!a||!b||a.revision!==b.revision||a.kind!==b.kind||a.version!==b.version||
   a.key!==b.key||a.projectId!==b.projectId||a.handoffId!==b.handoffId||
   JSON.stringify(a.manifest)!==JSON.stringify(b.manifest))return false;
 const x=a.kmzBytes,y=b.kmzBytes;
 if(!(x instanceof Uint8Array)||!(y instanceof Uint8Array)||x.length!==y.length)return false;
 for(let i=0;i<x.length;i++)if(x[i]!==y[i])return false;
 return true;
}
function transaction(db,mode,handler){
 return new Promise((resolve,reject)=>{
  let tx,value,failure=null,settled=false;
  const fail=(code,e)=>{
   if(!failure){failure=new Error(code,{cause:e});failure.code=code;}
   try{tx?.abort()}catch(_){}
  };
  try{
   tx=mode==='readwrite'?db.transaction(STORE,mode,{durability:'strict'}):db.transaction(STORE,mode);
   handler(tx.objectStore(STORE),(v)=>{value=v},fail);
  }catch(e){reject(Object.assign(new Error('IDB_LAB_TX_SETUP',{cause:e}),{code:'IDB_LAB_TX_SETUP'}));return;}
  tx.oncomplete=()=>{if(!settled){settled=true;resolve(value)}};
  tx.onabort=()=>{if(!settled){settled=true;reject(failure||Object.assign(new Error('IDB_LAB_ABORT',{cause:tx.error}),{code:'IDB_LAB_ABORT'}))}};
  tx.onerror=()=>{ /* onabort rejects; never claim success */ };
 });
}
async function readRow(indexedDB,dbName,key){
 const db=await dbRequest(indexedDB,dbName);
 try{return await transaction(db,'readonly',(store,set,fail)=>{
  const req=store.get(key);
  req.onsuccess=()=>set(req.result??null);
  req.onerror=()=>fail('IDB_LAB_READ_ERROR',req.error);
 });}finally{db.close();}
}
async function verifyRow(row,{expectedProjectId,expectedHandoffId,JSZip,DOMParser,cryptoProvider}){
 if(!row)return null;
 if(row.kind!==ROW_KIND||row.version!==VERSION||
   row.key!==keyOf(expectedProjectId,expectedHandoffId)||
   row.projectId!==expectedProjectId||row.handoffId!==expectedHandoffId||
   !Number.isSafeInteger(row.revision)||row.revision<1)stop('IDB_LAB_ROW_INVALID');
 let restored;
 try{
  restored=await reopenLinkedPairLab({pair:{manifest:row.manifest,kmzBytes:row.kmzBytes},
   expectedProjectId,expectedHandoffId,JSZip,DOMParser,cryptoProvider});
 }catch(e){stop('IDB_LAB_INTEGRITY_HOLD',e);}
 return Object.freeze({
  status:'LAB_STORED_PAIR_VERIFIED',productionReady:false,revision:row.revision,
  project:restored.project,activityAreas:restored.activityAreas,
  kmzBytes:new Uint8Array(restored.kmzBytes),
  diagnostics:restored.diagnostics
 });
}
export function createX01IndexedDbSaveLab({indexedDB=globalThis.indexedDB,dbName=X01_LAB_DB,
 JSZip,DOMParser,cryptoProvider=globalThis.crypto}={}){
 if(!indexedDB||typeof indexedDB.open!=='function'||!cryptoProvider?.subtle?.digest||
   !JSZip||!DOMParser)stop('IDB_LAB_CONFIG');
 // No dynamic write access to known production DBs or creative-r31 journals.
 if(typeof dbName!=='string'||!/^campsite-creative-next-x01-idb-lab(?:-[a-zA-Z0-9_-]+)?$/.test(dbName)||
   dbName.length>120)stop('IDB_LAB_NAMESPACE');
 const deps={JSZip,DOMParser,cryptoProvider};
 const read=async({expectedProjectId,expectedHandoffId})=>{
  const key=keyOf(expectedProjectId,expectedHandoffId);
  const raw=await readRow(indexedDB,dbName,key);
  return verifyRow(raw,{...deps,expectedProjectId,expectedHandoffId});
 };
 const save=async({plan,kmzBytes,expectedProjectId,expectedHandoffId,expectedRevision}={})=>{
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)stop('IDB_LAB_EXPECTED_REVISION');
  if(plan?.status!=='LAB_GEOMETRY_PLAN_READY'||plan.productionReady!==false||
     plan.projectId!==expectedProjectId||plan.handoffId!==expectedHandoffId)
   stop('IDB_LAB_UNTYPED_PLAN');
  const key=keyOf(expectedProjectId,expectedHandoffId);
  // Stage and reverify all data and source KMZ BEFORE opening any transaction.
  const pair=await createLinkedPairLab({project:plan.project,activityAreas:plan.activityAreas,
   kmzBytes,expectedProjectId,expectedHandoffId,...deps});
  const existing=expectedRevision>0
   ?await readRow(indexedDB,dbName,key)
   :null;
  if(expectedRevision>0){
   if(!existing||existing.revision!==expectedRevision)stop('IDB_LAB_REVISION_CONFLICT');
   await verifyRow(existing,{...deps,expectedProjectId,expectedHandoffId});
  }
  const row={
   key,kind:ROW_KIND,version:VERSION,
   revision:expectedRevision+1,projectId:expectedProjectId,handoffId:expectedHandoffId,
   manifest:pair.manifest,kmzBytes:new Uint8Array(pair.kmzBytes)
  };
  const db=await dbRequest(indexedDB,dbName);
  try{
   await transaction(db,'readwrite',(store,set,fail)=>{
    const request=store.get(key);
    request.onsuccess=()=>{
     try{
      const current=request.result??null;
      if(expectedRevision===0&&current)stop('IDB_LAB_REVISION_CONFLICT');
      if(expectedRevision>0&&!rowMatches(existing,current))stop('IDB_LAB_CONCURRENT_MODIFICATION');
      const put=store.put(row);
      put.onsuccess=()=>set(row.revision);
      put.onerror=()=>fail('IDB_LAB_WRITE_ERROR',put.error);
     }catch(e){fail(e?.code||'IDB_LAB_CAS_ERROR',e);}
    };
    request.onerror=()=>fail('IDB_LAB_READ_ERROR',request.error);
   });
  }finally{db.close();}
  // A commit is not an acknowledged save until the new complete bundle is
  // read back and cryptographically verified. No unsafe auto-repair or rollback.
  const verified=await read({expectedProjectId,expectedHandoffId});
  if(!verified||verified.revision!==row.revision||
    JSON.stringify(verified.project)!==pair.manifest.projectJson||
    JSON.stringify(verified.activityAreas)!==pair.manifest.activityAreasJson||
    !(verified.kmzBytes instanceof Uint8Array)||verified.kmzBytes.length!==row.kmzBytes.length||
    verified.kmzBytes.some((byte,index)=>byte!==row.kmzBytes[index]))
    stop('IDB_LAB_READBACK_HOLD');
  return Object.freeze({status:'LAB_IDB_SAVE_VERIFIED',productionReady:false,revision:verified.revision});
 };
 return Object.freeze({dbName,productionReady:false,save,read});
}
