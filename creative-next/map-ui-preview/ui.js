(() => {
  'use strict';
  // U2: a display-only Map First rehearsal. No user data, no hidden editing
  // session, no local/session storage, no IndexedDB and no network mutations.
  const $=id=>document.getElementById(id);
  const entry=$('entry'),workspace=$('workspace');
  let map=null,toastId=0;
  const panels=['layerPanel','toolPanel','addPanel'];
  const controller={layers:'layerPanel',toolbox:'toolPanel',add:'addPanel'};
  function toast(message){
    const el=$('toast');el.textContent=message;el.hidden=false;
    const id=++toastId;
    // Only an informational UI cue. Never claim save or data operations.
    setTimeout(()=>{if(toastId===id)el.hidden=true},2500);
  }
  function hidePanels(){
    for(const id of panels)$(id).hidden=true;
    for(const id of Object.keys(controller))$(id).setAttribute('aria-expanded','false');
  }
  function setOpen(id){
    const next=$(id).hidden;
    hidePanels();$('helpPanel').hidden=true;
    if(next){$(id).hidden=false;for(const [button,p] of Object.entries(controller))if(p===id)$(button).setAttribute('aria-expanded','true')}
  }
  function render(){
    const showMap=location.hash==='#map';
    entry.hidden=showMap;workspace.hidden=!showMap;
    hidePanels();$('helpPanel').hidden=true;
    if(showMap)setupMap();
  }
  function setupMap(){
    if(map){requestAnimationFrame(()=>map.invalidateSize());return}
    if(typeof window.L==='undefined'){
      $('mapFallback').querySelector('span').textContent='地図タイルが利用できません。オンライン時に再表示されます。';
      return;
    }
    try{
      map=L.map('leafletMap',{zoomControl:false,attributionControl:true,preferCanvas:true}).setView([35.6427,139.8607],15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
        maxZoom:19,attribution:'© OpenStreetMap contributors',crossOrigin:true
      }).addTo(map);
      $('mapFallback').hidden=true;
    }catch(error){
      console.warn('Map First preview: map unavailable',error);
      $('mapFallback').querySelector('span').textContent='地図の準備ができません。通信状態を確認してください。';
    }
  }
  $('start').addEventListener('click',()=>{location.hash='#map';});
  $('back').addEventListener('click',()=>{
    if(location.hash==='#map')location.hash='';
    else render();
  });
  window.addEventListener('hashchange',render);
  $('basemap').addEventListener('click',()=>{
    const muted=workspace.classList.toggle('map-muted');
    $('basemap').setAttribute('aria-pressed',String(muted));
    toast(muted?'地図を淡色表示にしました':'地図の通常表示に戻しました');
  });
  for(const [button,panel] of Object.entries(controller)){
    $(button).addEventListener('click',()=>setOpen(panel));
  }
  for(const close of document.querySelectorAll('[data-close]')){
    close.addEventListener('click',()=>hidePanels());
  }
  function syncHelpDots(){
    const track=$('helpCards'),cards=[...track.children],middle=track.scrollLeft+track.clientWidth/2;
    let best=0,distance=Infinity;
    cards.forEach((card,i)=>{const x=card.offsetLeft+card.offsetWidth/2;const d=Math.abs(x-middle);if(d<distance){distance=d;best=i}});
    for(const dot of document.querySelectorAll('[data-page]'))dot.setAttribute('aria-current',String(Number(dot.dataset.page)===best));
  }
  $('help').addEventListener('click',()=>{hidePanels();$('helpPanel').hidden=false;$('helpCards').scrollLeft=0;syncHelpDots();$('helpClose').focus({preventScroll:true});});
  $('helpClose').addEventListener('click',()=>{$('helpPanel').hidden=true;$('help').focus({preventScroll:true});});
  for(const dot of document.querySelectorAll('[data-page]')){
    dot.addEventListener('click',()=>{
      const card=$('helpCards').children[Number(dot.dataset.page)];
      if(card)$('helpCards').scrollTo({left:card.offsetLeft-$('helpCards').children[0].offsetLeft,behavior:'smooth'});
      for(const button of document.querySelectorAll('[data-page]'))button.setAttribute('aria-current',String(button===dot));
    });
  }
  $('helpCards').addEventListener('scroll',()=>requestAnimationFrame(syncHelpDots),{passive:true});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){$('helpPanel').hidden=true;hidePanels();}});
  render();
})();
