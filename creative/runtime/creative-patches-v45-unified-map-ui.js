(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const style=`<style id="cmV45UnifiedMapUiStyle">
      :root{--cm-blue:#1677ff;--cm-red:#ef4444;--cm-purple:#8b35e8;--cm-pink:#f3a8c9;--cm-orange:#ff8418;--cm-ink:#17202b}

      .topbtn,.save,.toolbox{
        border:1px solid rgba(30,50,70,.16)!important;
        background:rgba(255,255,255,.96)!important;
        color:var(--cm-ink)!important;
        box-shadow:0 4px 13px rgba(22,41,60,.15)!important;
      }
      .topbtn{border-radius:14px!important}

      .bottom-bar{
        grid-template-columns:1fr 1fr!important;
        gap:0!important;
        padding:0 0 env(safe-area-inset-bottom)!important;
        background:rgba(255,255,255,.97)!important;
        border-top:1px solid rgba(30,50,70,.12)!important;
        box-shadow:0 -5px 18px rgba(28,42,58,.10)!important;
      }
      .bottom-bar #locate{display:none!important}
      .bottom-bar button{
        min-height:56px!important;
        border:0!important;
        border-radius:0!important;
        background:transparent!important;
        color:var(--cm-ink)!important;
        font-weight:900!important;
      }
      .bottom-bar #undo{border-right:1px solid rgba(30,50,70,.11)!important}
      .bottom-bar button:disabled{opacity:.34!important}

      .right-hand .cm-fab-wrap{right:14px!important;left:auto!important}
      .left-hand .cm-fab-wrap{left:14px!important;right:auto!important}
      .cm-fab-wrap{bottom:calc(74px + env(safe-area-inset-bottom))!important}
      .cm-add-fab{
        border:3px solid #fff!important;
        background:linear-gradient(180deg,#ff9a2e 0%,var(--cm-orange) 100%)!important;
        color:#fff!important;
        box-shadow:0 7px 18px rgba(213,102,8,.32),0 2px 7px rgba(0,0,0,.18)!important;
        font-size:35px!important;
        font-weight:500!important;
      }
      .cm-add-fab:active{transform:scale(.94)!important}
      .cm-selected-type{border:2px solid #fff!important;box-shadow:0 2px 8px rgba(0,0,0,.20)!important}

      .right-hand .toolbox{right:14px!important;left:auto!important}
      .left-hand .toolbox{left:14px!important;right:auto!important}
      .toolbox{
        bottom:calc(142px + env(safe-area-inset-bottom))!important;
        width:54px!important;height:54px!important;border-radius:14px!important;
      }
      .right-hand .toolmenu{right:14px!important}
      .left-hand .toolmenu{left:14px!important}
      .toolmenu{bottom:calc(202px + env(safe-area-inset-bottom))!important}

      #cmV45LocateFab{
        position:fixed;z-index:1340;top:calc(166px + env(safe-area-inset-top));
        width:54px;height:58px;padding:4px 2px;border:1px solid rgba(30,50,70,.16);border-radius:14px;
        background:rgba(255,255,255,.96);color:var(--cm-ink);box-shadow:0 4px 13px rgba(22,41,60,.15);
        display:grid;place-items:center;align-content:center;gap:2px;font-weight:900;
      }
      .right-hand #cmV45LocateFab{right:10px}.left-hand #cmV45LocateFab{left:10px}
      #cmV45LocateFab span{font-size:23px;line-height:1}#cmV45LocateFab small{font-size:9px;line-height:1.1}

      #cmV45AddFlash{
        position:fixed;z-index:1505;bottom:calc(61px + env(safe-area-inset-bottom));
        min-width:52px;padding:4px 9px;border-radius:999px;background:rgba(255,255,255,.97);color:#49515b;
        box-shadow:0 3px 10px rgba(0,0,0,.14);font-size:11px;font-weight:900;text-align:center;
        opacity:0;pointer-events:none
      }
      .right-hand #cmV45AddFlash{right:16px}.left-hand #cmV45AddFlash{left:16px}
      #cmV45AddFlash.show{animation:cmV45AddFlash 1.05s ease both}
      @keyframes cmV45AddFlash{0%{opacity:0;transform:translateY(-7px) scale(.94)}18%{opacity:1;transform:translateY(0) scale(1)}72%{opacity:1}100%{opacity:0;transform:translateY(4px) scale(.98)}}

      .cm-v45-map-icon{background:transparent!important;border:0!important}
      .cm-v45-poi{width:30px;height:30px;display:grid;place-items:center;filter:drop-shadow(0 2px 3px rgba(0,0,0,.26))}
      .cm-v45-stop{width:19px;height:19px;border-radius:50%;background:var(--cm-blue);border:3px solid #fff;box-shadow:0 0 0 2px #0b5ed7}
      .cm-v45-gym{position:relative;width:25px;height:25px;display:grid;place-items:center;clip-path:polygon(25% 4%,75% 4%,100% 50%,75% 96%,25% 96%,0 50%);background:#fff}
      .cm-v45-gym:after{content:"";width:20px;height:20px;clip-path:inherit;background:var(--cm-red)}
      .cm-v45-power,.cm-v45-inactive{width:21px;height:21px;transform:rotate(45deg);border:3px solid #fff;border-radius:3px}
      .cm-v45-power{background:var(--cm-purple);box-shadow:0 0 0 2px #681fc1}
      .cm-v45-inactive{background:var(--cm-pink);box-shadow:0 0 0 2px #e879aa;opacity:.68}
      .cm-v45-candidate{position:relative;width:25px;height:25px;transform:rotate(-45deg);border:3px solid #fff;border-radius:50% 50% 50% 0;background:var(--cm-orange);box-shadow:0 2px 7px rgba(0,0,0,.25)}
      .cm-v45-candidate:after{content:"✓";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(45deg);color:#fff;font-size:14px;font-weight:1000;line-height:1}
      .cm-v45-icon-wrap{position:relative;width:36px;height:36px;display:grid;place-items:center}
      .cm-v45-warn{position:absolute;right:-5px;top:-7px;font-size:14px;filter:drop-shadow(0 1px 2px #fff)}
      .cm-v45-memo{position:absolute;left:-5px;bottom:-6px;font-size:11px;filter:drop-shadow(0 1px 2px #fff)}

      #cmSafeAddDot{width:42px!important;height:48px!important;place-items:center!important}
      #cmSafeAddDot span{position:relative!important;width:30px!important;height:30px!important;border-radius:50% 50% 50% 0!important;background:var(--cm-orange)!important;border:3px solid #fff!important;box-shadow:0 3px 8px rgba(0,0,0,.25)!important;transform:rotate(-45deg)!important}
      #cmSafeAddDot span:after{content:"＋";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(45deg);color:#fff;font-size:18px;font-weight:900;line-height:1}
      .cm-safe-add-confirm{background:#1677ff!important;color:#fff!important;border-color:#0b5ed7!important}

      body.cm-placement-docked #cmV45LocateFab{display:none!important}
      @media(max-width:520px){#cmV45LocateFab{top:calc(164px + env(safe-area-inset-top))}}
      @media(prefers-reduced-motion:reduce){#cmV45AddFlash.show{animation:none;opacity:1}}
    </style>`;
    if(!src.includes('id="cmV45UnifiedMapUiStyle"'))src=src.replace('</head>',style+'</head>');

    const runtime=`<script id="cmV45UnifiedMapUiRuntime">
(()=>{
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  function v45Icon(r,preview=false){
    const layer=String(r?.layer||'').toLowerCase();
    const inactive=String(r?.gameStatus||'').toUpperCase()==='INACTIVE'&&layer.includes('power');
    const isNew=layer.startsWith('new-');
    let shape='cm-v45-stop';
    if(isNew)shape='cm-v45-candidate';
    else if(inactive)shape='cm-v45-inactive';
    else if(layer.includes('gym'))shape='cm-v45-gym';
    else if(layer.includes('power'))shape='cm-v45-power';
    let warn=false,memo=false;
    try{warn=isNew&&typeof cmWarning==='function'&&!!cmWarning(r)}catch(_){}
    try{memo=isNew&&String(r?.memo||'').trim().length>0}catch(_){}
    const html='<div class="cm-v45-icon-wrap'+(preview?' cm-preview-icon':'')+'"><span class="cm-v45-poi"><span class="'+shape+'"></span></span>'+(warn?'<span class="cm-v45-warn">⚠️</span>':'')+(memo?'<span class="cm-v45-memo">📝</span>':'')+'</div>';
    return L.divIcon({className:'cm-v45-map-icon',html,iconSize:[36,36],iconAnchor:[18,18],popupAnchor:[0,-18]});
  }
  try{recordIcon=v45Icon}catch(_){}

  const undo=document.getElementById('undo'),redo=document.getElementById('redo'),locate=document.getElementById('locate');
  if(undo){undo.textContent='← 戻る';undo.setAttribute('aria-label','戻る')}
  if(redo){redo.textContent='↻ やり直し';redo.setAttribute('aria-label','やり直し')}

  if(locate&&!document.getElementById('cmV45LocateFab')){
    const b=document.createElement('button');b.id='cmV45LocateFab';b.type='button';b.setAttribute('aria-label','現在地へ移動');
    b.innerHTML='<span>◎</span><small>現在地</small>';b.onclick=()=>locate.click();document.body.appendChild(b);
  }

  let flashTimer=0;
  function flashAdd(){
    let f=document.getElementById('cmV45AddFlash');
    if(!f){f=document.createElement('div');f.id='cmV45AddFlash';f.textContent='追加';document.body.appendChild(f)}
    f.classList.remove('show');void f.offsetWidth;f.classList.add('show');clearTimeout(flashTimer);flashTimer=setTimeout(()=>f.classList.remove('show'),1150);
  }
  function bindFab(){
    const fab=document.getElementById('cmAddFab');if(!fab||fab.dataset.cmV45Bound==='1')return;
    fab.dataset.cmV45Bound='1';fab.setAttribute('aria-label','候補地を追加');fab.title='候補地を追加';fab.addEventListener('click',flashAdd);
  }
  bindFab();
  new MutationObserver(bindFab).observe(document.body,{childList:true,subtree:true});

  try{if(typeof drawAll==='function'&&Array.isArray(records)&&records.length)drawAll()}catch(_){}
})();
</script>`;
    if(!src.includes('id="cmV45UnifiedMapUiRuntime"'))src=src.replace('</body>',runtime+'</body>');

    return src;
  };
})();
