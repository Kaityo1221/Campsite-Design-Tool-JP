(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const style=`<style id="cmV51CoordinateJumpStyle">
      .cm-coordinate-trigger{
        position:absolute;right:2px;top:-43px;z-index:3;
        min-width:54px;height:34px;padding:0 11px;border:1px solid rgba(93,70,48,.20);
        border-radius:999px;background:rgba(255,253,247,.94);color:#382d1d;
        box-shadow:0 3px 10px rgba(0,0,0,.12);font:900 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);touch-action:manipulation;
      }
      .cm-coordinate-trigger:active{transform:scale(.96)}
      #cmCoordinateJumpPanel{
        position:fixed;left:50%;z-index:1700;width:min(320px,calc(100vw - 28px));
        transform:translateX(-50%);padding:12px;border:1px solid rgba(93,70,48,.18);border-radius:18px;
        background:rgba(255,253,247,.98);color:#382d1d;box-shadow:0 10px 30px rgba(0,0,0,.20);
        -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-sizing:border-box;
      }
      #cmCoordinateJumpPanel[hidden]{display:none!important}
      .cm-coordinate-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
      .cm-coordinate-head strong{font-size:14px;font-weight:950}
      .cm-coordinate-close{width:30px;height:30px;border:0;border-radius:50%;background:#f0e8da;color:#5d4630;font-size:19px;font-weight:900;line-height:1;padding:0}
      .cm-coordinate-hint{margin:0 0 8px;color:#74634e;font-size:11px;font-weight:700;line-height:1.5}
      .cm-coordinate-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}
      #cmCoordinateInput{width:100%;height:42px;box-sizing:border-box;border:1px solid #d7c7a7;border-radius:11px;background:#fff;color:#382d1d;padding:0 11px;font:700 14px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #cmCoordinateInput:focus{outline:2px solid rgba(53,167,255,.20);border-color:#79bff0}
      #cmCoordinateApply{height:42px;padding:0 13px;border:1px solid rgba(138,107,49,.25);border-radius:11px;background:#fff4d8;color:#382d1d;font-size:12px;font-weight:950;white-space:nowrap}
      .cm-coordinate-error{min-height:16px;margin-top:6px;color:#b63d35;font-size:11px;font-weight:800}
      @media(max-width:390px){.cm-coordinate-row{grid-template-columns:1fr}.cm-coordinate-trigger{right:0}}
    </style>`;
    if(!src.includes('id="cmV51CoordinateJumpStyle"'))src=src.replace('</head>',style+'</head>');

    const runtime=`<script id="cmV51CoordinateJumpRuntime">
(()=>{
  let panel=null,activeBar=null;

  const toast=(text,ms=1400)=>{try{if(typeof msg==='function')msg(text,ms)}catch{}};
  const activeModeBar=()=>document.querySelector('.cm-safe-add-bar')||document.getElementById('cmMoveBar');

  function parseCoordinate(raw){
    const normalized=String(raw||'').trim().replace(/，/g,',');
    let parts=normalized.split(',').map(v=>v.trim()).filter(Boolean);
    if(parts.length!==2)parts=normalized.split(/\\s+/).map(v=>v.trim()).filter(Boolean);
    if(parts.length!==2)return null;
    const lat=Number(parts[0]),lng=Number(parts[1]);
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)return null;
    return [lat,lng];
  }

  function ensurePanel(){
    if(panel&&panel.isConnected)return panel;
    panel=document.createElement('section');
    panel.id='cmCoordinateJumpPanel';
    panel.hidden=true;
    panel.setAttribute('aria-label','座標で位置を合わせる');
    panel.innerHTML='<div class="cm-coordinate-head"><strong>座標で位置を合わせる</strong><button class="cm-coordinate-close" type="button" aria-label="閉じる">×</button></div><p class="cm-coordinate-hint">緯度, 経度 を貼り付けると、中央の位置合わせポイントをその座標へ移動します。</p><div class="cm-coordinate-row"><input id="cmCoordinateInput" inputmode="decimal" enterkeyhint="go" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="35.681236, 139.767125"><button id="cmCoordinateApply" type="button">座標へ移動</button></div><div class="cm-coordinate-error" aria-live="polite"></div>';
    document.body.appendChild(panel);
    panel.querySelector('.cm-coordinate-close').onclick=closePanel;
    panel.querySelector('#cmCoordinateApply').onclick=applyCoordinate;
    panel.querySelector('#cmCoordinateInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyCoordinate()}});
    return panel;
  }

  function positionPanel(){
    if(!panel||panel.hidden)return;
    const bar=activeBar&&activeBar.isConnected?activeBar:activeModeBar();
    const bottom=bar?Math.max(86,window.innerHeight-bar.getBoundingClientRect().top+50):170;
    panel.style.bottom=Math.min(Math.max(bottom,110),Math.max(110,window.innerHeight-210))+'px';
  }

  function openPanel(bar){
    activeBar=bar||activeModeBar();
    if(!activeBar)return;
    const p=ensurePanel();
    p.hidden=false;
    p.querySelector('.cm-coordinate-error').textContent='';
    positionPanel();
    setTimeout(()=>p.querySelector('#cmCoordinateInput')?.focus(),30);
  }

  function closePanel(){
    if(panel)panel.hidden=true;
    activeBar=null;
  }

  function applyCoordinate(){
    const bar=activeBar&&activeBar.isConnected?activeBar:activeModeBar();
    if(!bar){closePanel();return}
    const input=panel?.querySelector('#cmCoordinateInput');
    const error=panel?.querySelector('.cm-coordinate-error');
    const ll=parseCoordinate(input?.value);
    if(!ll){if(error)error.textContent='「緯度, 経度」の形式で入力してください';toast('座標は「緯度, 経度」で入力してください');return}
    try{
      map.setView(ll,map.getZoom(),{animate:false});
      closePanel();
      toast('入力した座標へ移動しました');
    }catch(err){
      console.error('[Creative v51] coordinate jump',err);
      if(error)error.textContent='座標へ移動できませんでした';
    }
  }

  function bindBar(bar){
    if(!bar||bar.dataset.cmCoordinateJump==='1')return;
    bar.dataset.cmCoordinateJump='1';
    if(getComputedStyle(bar).position==='static')bar.style.position='relative';
    const button=document.createElement('button');
    button.type='button';button.className='cm-coordinate-trigger';button.textContent='座標';button.setAttribute('aria-label','座標を入力して位置を合わせる');
    button.onclick=e=>{e.preventDefault();e.stopPropagation();openPanel(bar)};
    bar.appendChild(button);
  }

  function sync(){
    const bars=[document.querySelector('.cm-safe-add-bar'),document.getElementById('cmMoveBar')].filter(Boolean);
    bars.forEach(bindBar);
    if(panel&&!panel.hidden&&!activeModeBar())closePanel();
  }

  sync();
  new MutationObserver(sync).observe(document.body,{childList:true,subtree:true});
  addEventListener('resize',positionPanel,{passive:true});
  addEventListener('orientationchange',()=>setTimeout(positionPanel,80),{passive:true});
})();
<\\/script>`;
    if(!src.includes('id="cmV51CoordinateJumpRuntime"'))src=src.replace('</body>',runtime+'</body>');

    return src;
  };
})();
