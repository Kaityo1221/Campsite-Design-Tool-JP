(() => {
  'use strict';
  const PK='campsiteProject.v1', MK='campsiteDistanceMission4Viewed.v1';
  let timer=0, busy=false;
  const read=()=>{try{return JSON.parse(sessionStorage.getItem(PK)||'null')}catch(_){return null}};
  const token=p=>String(p?.distanceResult?.designSignature||p?.distanceResult?.checkedAt||'');
  const viewed=p=>{if(!p||p?.distanceResult?.stale===true)return false;try{return !!token(p)&&sessionStorage.getItem(MK)===token(p)}catch(_){return false}};
  const mark=p=>{try{if(token(p))sessionStorage.setItem(MK,token(p))}catch(_){}};
  const text=(root,sel,value)=>{const n=root?.querySelector(sel);if(n)n.textContent=value};
  const directCards=s=>Array.from(s.querySelectorAll(':scope > .campsite-mission-card'));
  const byKick=(s,k)=>directCards(s).find(c=>String(c.querySelector('.campsite-mission-kicker')?.textContent||'').trim()===k)||null;

  function css(){
    if(document.getElementById('campsiteMissionLayoutV2Styles'))return;
    const l=document.createElement('link');l.id='campsiteMissionLayoutV2Styles';l.rel='stylesheet';l.href='./css/bridge-distance-mission-layout-v2.css?v=1';document.head.appendChild(l);
  }

  function mission1(card,p){
    const list=card?.querySelector('.campsite-pair-list');
    if(!(list instanceof HTMLElement)||card.querySelector('[data-v3-pairs]')||!list.children.length)return;
    const added=new Set((Array.isArray(p?.currentPois)?p.currentPois:[]).filter(x=>x?.role==='added'||String(x?.layer||'').toLowerCase().startsWith('new-')).map(x=>String(x?.title||x?.name||'').trim()));
    list.querySelectorAll('.campsite-pair').forEach(pair=>{if(pair.querySelector('.campsite-v2-pair-type'))return;const line=String(pair.innerText||'').split('\n').map(x=>x.trim()).find(x=>x.includes(' × '));if(!line)return;const names=line.split(' × ').map(x=>x.trim()),count=names.filter(x=>added.has(x)).length;const tag=document.createElement('div');tag.className='campsite-v2-pair-type';tag.style.cssText='margin-top:5px;color:#bae6fd;font-size:10px;font-weight:900';tag.textContent=count>=2?'新規 × 新規':'新規 × 既存';pair.appendChild(tag)});
    list.dataset.v2Collapsed='true';
    const b=document.createElement('button');b.type='button';b.className='campsite-v2-toggle';b.dataset.v3Pairs='1';b.textContent='詳細を見る';b.setAttribute('aria-expanded','false');list.before(b);
    b.onclick=()=>{const open=list.dataset.v2Collapsed==='true';list.dataset.v2Collapsed=open?'false':'true';b.textContent=open?'詳細を閉じる':'詳細を見る';b.setAttribute('aria-expanded',open?'true':'false')};
  }

  function envState(p){
    const e=p?.siteEnvironment||p?.distanceSiteEnvironment||{};
    const t=['easy','narrow','careful'].includes(e.traffic)?e.traffic:null;
    return {e,t,complete:Boolean(t&&typeof e.plaza==='boolean'&&typeof e.circulation==='boolean'&&typeof e.waiting==='boolean')};
  }
  function envValue(kind,value){
    if(value===null||typeof value==='undefined')return '未確認';
    if(kind==='traffic')return value==='easy'?'スムーズ':'⚠️ 注意';
    if(kind==='circulation')return value?'できる':'できない';
    return value?'あり':'なし';
  }
  function mission3(card,p){
    if(!(card instanceof HTMLElement))return;
    text(card,'.campsite-mission-prompt','現地の使い方を確認しましょう');
    const body=card.querySelector('.campsite-mission-body');if(!(body instanceof HTMLElement))return;
    let editor=body.querySelector(':scope > .campsite-env-editor');
    if(!(editor instanceof HTMLElement)){
      const rows=Array.from(body.querySelectorAll(':scope > .campsite-env-row'));if(!rows.length)return;
      editor=document.createElement('div');editor.className='campsite-env-editor';rows[0].before(editor);rows.forEach(r=>editor.appendChild(r));
    }
    editor.dataset.v2Collapsed='true';
    body.querySelector(':scope > .campsite-env-summary')?.remove();body.querySelector(':scope > [data-v3-env]')?.remove();
    const {e,t,complete}=envState(p);
    body.insertAdjacentHTML('afterbegin',`<div class="campsite-env-summary"><div class="campsite-env-summary-row"><span>🚶 通行</span><strong>${envValue('traffic',t)}</strong></div><div class="campsite-env-summary-row"><span>🏞 広場</span><strong>${envValue('bool',e.plaza)}</strong></div><div class="campsite-env-summary-row"><span>🔄 回遊</span><strong>${envValue('circulation',e.circulation)}</strong></div><div class="campsite-env-summary-row"><span>🪑 待機</span><strong>${envValue('bool',e.waiting)}</strong></div></div>`);
    const b=document.createElement('button');b.type='button';b.className='campsite-v2-toggle';b.dataset.v3Env='1';b.textContent=complete?'確認内容を編集':'現地確認を入力';body.querySelector(':scope > .campsite-env-summary')?.after(b);
    b.onclick=()=>{const open=editor.dataset.v2Collapsed==='true';editor.dataset.v2Collapsed=open?'false':'true';b.textContent=open?'閉じる':(complete?'確認内容を編集':'現地確認を入力')};
    const sign=body.querySelector('.campsite-chairman-sign');if(sign&&!complete)sign.textContent='⚠️ 現地環境の確認が残っています。現地で状況を確認して入力してください。';
  }

  function cards(shell){
    const map=shell.querySelector(':scope > .campsite-map-card');
    let final=shell.querySelector(':scope > [data-v3-role="final"]');
    if(!final)final=directCards(shell).find(c=>c!==map&&String(c.querySelector('.campsite-mission-kicker')?.textContent||'').trim()==='MISSION 4')||null;
    if(map instanceof HTMLElement){map.dataset.v3Role='map';text(map,'.campsite-mission-kicker','MISSION 4');let p=map.querySelector('.campsite-mission-prompt');if(!p){p=document.createElement('div');p.className='campsite-mission-prompt';map.querySelector('.campsite-mission-kicker')?.after(p)}p.textContent='配置を地図で見てみましょう';text(map,'.campsite-mission-title','🗺️ 配置・マップ');const d=map.querySelector('.campsite-mission-body > div');if(d)d.textContent='既存POI・新規POI・活動範囲を確認します。地図はボタンを押した時だけ読み込みます。'}
    if(final instanceof HTMLElement){final.dataset.v3Role='final';text(final,'.campsite-mission-kicker','MISSION 5');text(final,'.campsite-mission-prompt','最後に確認して準備完了');text(final,'.campsite-mission-title','✅ 最終確認');if(map instanceof HTMLElement&&map.nextElementSibling!==final)shell.insertBefore(map,final)}
    return {map,final};
  }

  function finalGoal(shell,final,p){
    if(!(final instanceof HTMLElement))return null;const body=final.querySelector('.campsite-mission-body');if(!(body instanceof HTMLElement))return null;
    let goal=shell.querySelector(':scope > .campsite-goal')||body.querySelector(':scope > .campsite-goal');if(goal instanceof HTMLElement&&goal.parentElement!==body)body.appendChild(goal);
    const list=body.querySelector('.campsite-final-list');if(list instanceof HTMLElement){Array.from(list.querySelectorAll('.campsite-final-row')).forEach(r=>{if(String(r.textContent||'').includes('重複POIによるブロックなし'))r.remove()});let row=list.querySelector('[data-v3-map-final]');if(!row){row=document.createElement('div');row.className='campsite-final-row';row.dataset.v3MapFinal='1';list.appendChild(row)}const done=viewed(p);row.innerHTML=`<span>${done?'✅':'⚪️'}</span><span>配置・マップ ${done?'確認済み':'未確認'}</span>`}
    if(!body.querySelector('.campsite-v2-final-note')){const n=document.createElement('div');n.className='campsite-v2-final-note';n.textContent='この下の「セーブする」「CREATIVE MODEに戻って修正」「提出前チェック」から次の操作へ進めます。';body.insertBefore(n,goal||null)}
    return goal;
  }

  function progress(shell,p,goal){
    const lamps=Array.from(shell.querySelectorAll('.campsite-mission-lamp'));if(lamps.length<5)return;
    ['新規POI','拠点','現地','マップ','最終'].forEach((v,i)=>text(lamps[i],'.campsite-mission-label',v));
    const stale=p?.distanceResult?.stale===true,dup=Boolean(shell.querySelector('.campsite-duplicate-alert')),mapDone=viewed(p);if(goal instanceof HTMLElement&&!goal.dataset.v3BaseReady)goal.dataset.v3BaseReady=goal.dataset.ready||'false';const base=goal?.dataset.v3BaseReady==='true';
    lamps[3].dataset.state=stale?'gray':mapDone?'green':'gray';lamps[4].dataset.state=(stale||dup)?'red':(base&&mapDone)?'green':'yellow';
    if(goal instanceof HTMLElement&&base&&!stale&&!dup){const title=goal.querySelector('.campsite-goal-title'),note=goal.querySelector('.campsite-goal-note');if(title)title.textContent=mapDone?'🟢 準備完了！':'⚪ 配置・マップを確認';if(note)note.textContent=mapDone?'必要な確認がすべて揃いました。':'MISSION 4の地図を表示して配置を確認してください。'}
  }

  function patch(){
    if(busy)return;busy=true;
    try{
      const p=read();if(!p||p.source!=='bridge')return;const shell=document.querySelector('#distanceResult > .campsite-mission-shell');if(!(shell instanceof HTMLElement))return;
      shell.dataset.layoutV2='true';document.body.classList.add('campsite-mission-layout-v2');mission1(byKick(shell,'MISSION 1'),p);mission3(byKick(shell,'MISSION 3'),p);
      const advice=byKick(shell,'OPERATION TIPS');if(advice instanceof HTMLElement)advice.dataset.v2Hidden='true';
      const {map,final}=cards(shell),goal=finalGoal(shell,final,p);progress(shell,p,goal);
      const mb=map?.querySelector('[data-mission-map]');if(mb instanceof HTMLElement&&mb.dataset.v3Hooked!=='1'){mb.dataset.v3Hooked='1';mb.addEventListener('click',()=>{const latest=read();if(latest?.source==='bridge')mark(latest);setTimeout(()=>schedule(0),80)})}
    }finally{busy=false}
  }
  function focus4(){const s=document.querySelector('#distanceResult > .campsite-mission-shell'),c=s?.querySelector(':scope > .campsite-map-card');if(!(c instanceof HTMLElement))return;c.scrollIntoView({behavior:'smooth',block:'center'});c.classList.remove('campsite-v2-focus');requestAnimationFrame(()=>c.classList.add('campsite-v2-focus'))}
  function gate(e){if(!e.target?.closest?.('[data-go-pre-submit]'))return;const p=read();if(!p||p.source!=='bridge'||p?.distanceResult?.stale===true||viewed(p))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();focus4()}
  function schedule(d=120){clearTimeout(timer);timer=setTimeout(patch,d)}
  function boot(){if(new URLSearchParams(location.search).get('campsiteProject')!=='bridge')return;css();document.addEventListener('click',gate,true);const d=document.getElementById('distance');if(d instanceof HTMLElement)new MutationObserver(()=>schedule()).observe(d,{childList:true,subtree:true,characterData:true});window.addEventListener('pageshow',()=>schedule(80));schedule(650)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
