(()=>{
  'use strict';
  const PK='campsiteProject.v1',MK='campsiteDistanceMission4Viewed.v1';
  let timer=0,busy=false;
  const read=()=>{try{return JSON.parse(sessionStorage.getItem(PK)||'null')}catch(_){return null}};
  const role=p=>p?.role==='added'||String(p?.layer||'').toLowerCase().startsWith('new-')?'added':'existing';
  const point=p=>{const lat=Number(p?.lat),lng=Number(p?.lng);return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng,role:role(p),comment:String(p?.description||p?.memo||'').trim()}:null};
  const dist=(a,b)=>{const R=6371000,l1=a.lat*Math.PI/180,l2=b.lat*Math.PI/180,dl=(b.lat-a.lat)*Math.PI/180,dg=(b.lng-a.lng)*Math.PI/180,q=Math.sin(dl/2)**2+Math.cos(l1)*Math.cos(l2)*Math.sin(dg/2)**2;return R*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))};
  function pairs(p){
    const ps=(p?.currentPois||[]).map(point).filter(Boolean);let unresolved=0,duplicates=0;
    for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){
      const a=ps[i],b=ps[j],d=dist(a,b);if(d<1)duplicates++;if(d>=50||(a.role==='existing'&&b.role==='existing'))continue;
      const added=[a,b].filter(x=>x.role==='added');if(!added.length||added.some(x=>!x.comment))unresolved++;
    }
    return{unresolved,duplicates};
  }
  function environment(p){
    const e=p?.siteEnvironment||p?.distanceSiteEnvironment||{},t=['easy','narrow','careful'].includes(e.traffic)?e.traffic:null,values=[t,typeof e.plaza==='boolean'?e.plaza:null,typeof e.circulation==='boolean'?e.circulation:null,typeof e.waiting==='boolean'?e.waiting:null],entered=values.filter(v=>v!==null).length;
    return{entered,complete:entered===4};
  }
  const mapToken=p=>String(p?.distanceResult?.designSignature||p?.distanceResult?.checkedAt||'');
  const mapViewed=p=>{if(!p||p?.distanceResult?.stale===true||!mapToken(p))return false;try{return sessionStorage.getItem(MK)===mapToken(p)}catch(_){return false}};
  function derive(p){
    const stale=p?.distanceResult?.stale===true,ps=pairs(p),env=environment(p),mapDone=mapViewed(p),mission1=stale?'yellow':ps.unresolved?'yellow':'green',mission2=stale?'yellow':'green',mission3=env.complete?'green':env.entered?'yellow':'gray',mission4=stale?'gray':mapDone?'green':'gray';
    let mission5='gray';if(stale||ps.duplicates)mission5='red';else if([mission1,mission2,mission3,mission4].every(x=>x==='green'))mission5='green';else if([mission1,mission2,mission3,mission4].some(x=>x==='yellow'))mission5='yellow';
    return{mission1,mission2,mission3,mission4,mission5,stale,duplicateCount:ps.duplicates,unresolvedPairCount:ps.unresolved,environmentEntered:env.entered,environmentComplete:env.complete,mapViewed:mapDone};
  }
  const txt=(n,v)=>{if(n&&n.textContent!==v)n.textContent=v};
  const data=(n,k,v)=>{if(n instanceof HTMLElement&&n.dataset[k]!==v)n.dataset[k]=v};
  function lamp(n,s,i){
    if(!(n instanceof HTMLElement))return;data(n,'state',s);const m={green:'完了',yellow:'要確認',red:'修正が必要',gray:'未着手'},label=String(n.querySelector('.campsite-mission-label')?.textContent||`MISSION ${i+1}`).trim(),aria=`${label}：${m[s]}`;
    if(n.getAttribute('aria-label')!==aria)n.setAttribute('aria-label',aria);if(n.title!==m[s])n.title=m[s];
  }
  function apply(){
    timer=0;if(busy)return;busy=true;
    try{
      const p=read(),shell=document.querySelector('#distanceResult > .campsite-mission-shell');if(!p||p.source!=='bridge'||!(shell instanceof HTMLElement))return;
      const s=derive(p),ls=Array.from(shell.querySelectorAll('.campsite-mission-lamp'));[s.mission1,s.mission2,s.mission3,s.mission4,s.mission5].forEach((v,i)=>lamp(ls[i],v,i));
      ['mission1','mission2','mission3','mission4','mission5'].forEach(k=>data(shell,`${k}State`,s[k]));data(shell,'missionStateVersion','1');
      const g=shell.querySelector('.campsite-goal');if(g instanceof HTMLElement){
        data(g,'ready',s.mission5==='green'?'true':'false');let title='⚪ 準備中',note='未着手のMISSIONを確認してください。';
        if(s.mission5==='green'){title='🟢 準備完了！';note='必要な確認がすべて揃いました。'}else if(s.mission5==='red'){title='🔴 修正・再確認が必要です';note=s.stale?'設計が変更されています。距離チェックを再実行してください。':'重複POIの修正候補を確認してください。'}else if(s.mission5==='yellow'){title='🟡 確認が残っています';note='黄色のMISSIONを確認してください。'}
        txt(g.querySelector('.campsite-goal-title'),title);txt(g.querySelector('.campsite-goal-note'),note);
      }
    }finally{busy=false}
  }
  function markMapViewedFromClick(e){
    if(!e.target?.closest?.('[data-mission-map]'))return;
    const p=read(),token=mapToken(p);if(!p||p.source!=='bridge'||p?.distanceResult?.stale===true||!token)return;
    try{sessionStorage.setItem(MK,token)}catch(_){}
    apply();
  }
  function schedule(d=60){clearTimeout(timer);timer=setTimeout(apply,d)}
  function boot(){
    if(new URLSearchParams(location.search).get('campsiteProject')!=='bridge')return;
    const d=document.getElementById('distance');if(d instanceof HTMLElement)new MutationObserver(()=>apply()).observe(d,{childList:true,subtree:true,characterData:true});
    document.addEventListener('click',markMapViewedFromClick,true);
    window.addEventListener('pageshow',()=>schedule(80));window.CampsiteMissionState=Object.freeze({getState:()=>derive(read()),refresh:apply});schedule(760);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
