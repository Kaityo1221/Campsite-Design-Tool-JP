/* I4-4 independent diagnostic: opt-in, read-only, no storage or Creative handoff. */
;(() => {
'use strict';
if (window.__cbsI44Installed) return;
window.__cbsI44Installed = true;
const engineSource = window.__cbsI44EngineSource;
delete window.__cbsI44EngineSource;
if (typeof engineSource !== 'string') throw Error('ENGINE_MISSING');
const pageInstall = function(source) {
  if (window.__cbsI44PageInstalled) return;
  window.__cbsI44PageInstalled = true;
  (0,eval)(source);
  const engine = window.CampsiteWayfarerAcquisitionEngine;
  let sid = null, polygon = null, busy = false;
  document.addEventListener('cbs-i3:evt', event => {
    let state; try { state = JSON.parse(event.detail); } catch (_) { return; }
    if (state?.type === 'map-lost') { sid = null; polygon = null; return; }
    if (state?.type !== 'state') return;
    sid = typeof state.sid === 'string' ? state.sid : null;
    polygon = sid && state.completed === true && Array.isArray(state.points)
      ? state.points.map(p => ({lat:Number(p.lat),lng:Number(p.lng)})) : null;
  });
  document.addEventListener('cbs-i44:request', async event => {
    let msg; try { msg = JSON.parse(event.detail); } catch (_) { return; }
    if (!msg || typeof msg.requestId !== 'string' || busy) return;
    const send = data => document.dispatchEvent(new CustomEvent('cbs-i44:result', {detail:JSON.stringify({requestId:msg.requestId,...data})}));
    if (!sid || sid !== msg.sid || !polygon || JSON.stringify(polygon) !== JSON.stringify(msg.polygon)) {
      send({error:'STALE_OR_UNCONFIRMED_POLYGON'}); return;
    }
    let plan;
    try {
      plan = engine.createPlan(polygon,{bufferMeters:200,maxTileMeters:500,cellLevel:14});
      if (plan.tiles.length > 64) throw Error('TILE_LIMIT_EXCEEDED');
      if (plan.tiles.some(t => { const s=engine.boundsSizeMeters(t); return s.width>501||s.height>501; })) throw Error('TILE_SIZE_EXCEEDED');
    } catch(e) { send({error:String(e.message||e)}); return; }
    busy=true;
    const started=performance.now();
    const counts=[];
    try {
      const outcome=await engine.executePlan(plan,async tile=>{
        if (sid !== msg.sid || JSON.stringify(polygon) !== JSON.stringify(msg.polygon)) throw Error('SESSION_CHANGED');
        let last;
        for(let attempt=0;attempt<2;attempt++) {
          const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),10000);
          try {
            const response=await fetch('/api/v1/vault/mapview/gcs?'+tile.query,{credentials:'include',cache:'no-store',signal:controller.signal});
            if(!response.ok) throw Error('HTTP_'+response.status);
            const json=await response.json();
            if(!json || typeof json!=='object') throw Error('INVALID_JSON_SHAPE');
            // Source schema unverified. Count only recognizable GUID records; never infer completeness.
            const ids=new Set(); const visited=new WeakSet(); let inspected=0;
            const walk=(v,depth)=>{
              if(!v||typeof v!=='object'||depth>9||inspected++>20000||visited.has(v))return;
              visited.add(v);
              if(!Array.isArray(v)) {
                const id=v.guid??v.poiId;
                if(typeof id==='string'&&id.trim())ids.add(id.trim());
              }
              for(const child of Object.values(v)) if(child&&typeof child==='object')walk(child,depth+1);
            };
            walk(json,0);
            counts.push({tile:tile.id,guidCount:ids.size,guids:[...ids]});
            return {received:true};
          } catch(e) {
            last=e;
            if(attempt===1 || (String(e.message||e).startsWith('HTTP_4')))break;
          } finally {clearTimeout(timeout);}
        }
        throw last||Error('REQUEST_FAILED');
      });
      const all=new Set(counts.flatMap(c=>c.guids));
      send({tileCount:plan.tiles.length,tiles:outcome.results.map(r=>({id:r.id,ok:r.ok,error:r.error||null})),
        uniqueGuidCount:all.size,perTile:counts.map(c=>({tile:c.tile,guidCount:c.guidCount})),
        geometryCoverageComplete:outcome.geometryCoverageComplete,transportComplete:outcome.transportComplete,
        sourceComplete:null,coverageComplete:false,coverageStatus:outcome.transportComplete?'unverified':'incomplete',
        normalizationStatus:'GUID discovery only; GCS schema unverified',elapsedMs:Math.round(performance.now()-started)});
    } catch(e) {send({error:String(e.message||e),coverageComplete:false});}
    finally {busy=false;}
  });
};
const script=document.createElement('script');
script.textContent=';('+pageInstall.toString()+')('+JSON.stringify(engineSource)+');';
(document.documentElement||document.head).appendChild(script);script.remove();
let sid=null,polygon=null,busy=false;
const button=document.createElement('button');
button.textContent='🔭 複数タイル取得';
button.style.cssText='position:fixed;right:12px;top:76px;z-index:2147483646;padding:10px;border-radius:9px;background:#123b35;color:white;border:1px solid #b4e3cf';
const output=document.createElement('pre');
output.style.cssText='display:none;position:fixed;left:12px;right:12px;top:124px;z-index:2147483646;padding:12px;background:#0f172a;color:white;border-radius:10px;white-space:pre-wrap;max-height:45vh;overflow:auto;font:12px/1.5 monospace';
const show=s=>{output.style.display='block';output.textContent=s;};
document.addEventListener('cbs-i3:evt',event=>{
 let state;try{state=JSON.parse(event.detail);}catch(_){return;}
 if(state?.type==='map-lost'){sid=null;polygon=null;return;}
 if(state?.type!=='state')return;
 sid=typeof state.sid==='string'?state.sid:null;
 polygon=sid&&state.completed===true&&Array.isArray(state.points)?state.points.map(p=>({lat:Number(p.lat),lng:Number(p.lng)})):null;
});
button.addEventListener('click',()=>{
 if(busy)return;
 if(!sid||!polygon){show('先にI3で活動範囲を確定してください。');return;}
 if(!confirm('Wayfarerへ最大64タイルを順次問い合わせます。取得データは保存・転送しません。続行しますか？'))return;
 busy=true;button.disabled=true;show('取得中。画面を閉じずにお待ちください…');
 const requestId='i44-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 const handler=e=>{
  let msg;try{msg=JSON.parse(e.detail);}catch(_){return;}
  if(msg?.requestId!==requestId)return;
  document.removeEventListener('cbs-i44:result',handler);clearTimeout(timer);
  busy=false;button.disabled=false;show(JSON.stringify(msg,null,2));
 };
 const timer=setTimeout(()=>{document.removeEventListener('cbs-i44:result',handler);busy=false;button.disabled=false;show('RESULT_TIMEOUT (取得完了は未確認)');},1500000);
 document.addEventListener('cbs-i44:result',handler);
 document.dispatchEvent(new CustomEvent('cbs-i44:request',{detail:JSON.stringify({requestId,sid,polygon})}));
});
document.documentElement.append(button,output);
})();