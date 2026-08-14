(() => {
'use strict';
// The legacy filename is retained for cache-safe upgrades; this helper now persists both reference circles.
const DB='campsite-field-session',STORE='state',KEY='current';
function open(){return new Promise((ok,ng)=>{const r=indexedDB.open(DB,1);r.onsuccess=()=>ok(r.result);r.onerror=()=>ng(r.error);});}
async function state(write){const db=await open();try{return await new Promise((ok,ng)=>{const tx=db.transaction(STORE,write?'readwrite':'readonly'),s=tx.objectStore(STORE),r=s.get(KEY);r.onsuccess=()=>{const v=r.result||null;if(!write){ok(v);return;}if(!v){ok(null);return;}const records=typeof poiRecords!=='undefined'?poiRecords:[];const byId=new Map(records.map(x=>[x.fieldSessionId,x]));for(const snap of v.records||[]){const live=byId.get(snap.id);if(live&&live.isNew){snap.include30mCircle=!!live.include30mCircle;snap.include40mCircle=!!live.include40mCircle;}}s.put(v,KEY);};r.onerror=()=>ng(r.error);tx.oncomplete=()=>{if(write)ok(true);};tx.onerror=()=>ng(tx.error);});}finally{db.close();}}
async function restore(){const v=await state(false);if(!v)return false;const records=typeof poiRecords!=='undefined'?poiRecords:[],byId=new Map((v.records||[]).map(x=>[x.id,x]));let changed=false;for(const live of records){const snap=byId.get(live.fieldSessionId);if(!live.isNew||!snap)continue;for(const property of ['include30mCircle','include40mCircle']){if(!Object.prototype.hasOwnProperty.call(snap,property))continue;const next=!!snap[property];if(live[property]!==next){live[property]=next;changed=true;}}}window.FieldModeCircleOptions?.render?.();return changed;}
async function saveWithSession(){await window.FieldModeSession?.saveNow?.();return state(true);}
function wrapCircleSave(){const api=window.FieldModeCircleOptions;if(!api||api.__sessionCirclesWrapped)return !!api;const original=api.saveNow;api.saveNow=async(...args)=>{const result=await original?.(...args);await saveWithSession();return result;};api.__sessionCirclesWrapped=true;return true;}
function bind(){const el=document.getElementById('fieldModeSessionStatus');if(!el)return false;let last=el.textContent||'';new MutationObserver(()=>{const t=el.textContent||'';if(t===last)return;last=t;if(/前回の作業を復元しました/.test(t))restore().catch(console.warn);}).observe(el,{childList:true,subtree:true,characterData:true});return true;}
const started=Date.now();const timer=setInterval(()=>{const a=bind(),b=wrapCircleSave();if((a&&b)||Date.now()-started>10000)clearInterval(timer);},50);setTimeout(()=>clearInterval(timer),10000);
window.FieldModeSessionCircles={save:saveWithSession,restore};
})();
