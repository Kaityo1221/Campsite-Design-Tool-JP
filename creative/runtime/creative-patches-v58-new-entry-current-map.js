(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const style=`<style id="cmV58NewEntryStyle">
      .entry{
        overflow:auto!important;
        -webkit-overflow-scrolling:touch;
        color:#fff8e8!important;
        background:
          linear-gradient(180deg,rgba(11,9,6,.42) 0%,rgba(11,9,6,.10) 20%,rgba(11,9,6,.04) 45%,rgba(11,9,6,.18) 66%,rgba(11,9,6,.82) 100%),
          url('../assets/creative-mode-opening-final.webp') top center/100% auto no-repeat,
          #17130f!important;
      }
      .entry:before{
        content:"";
        position:fixed;
        inset:0;
        z-index:0;
        pointer-events:none;
        background:
          radial-gradient(ellipse at 50% 28%,rgba(255,244,205,.08) 0%,rgba(0,0,0,0) 42%),
          linear-gradient(90deg,rgba(0,0,0,.12),transparent 16%,transparent 84%,rgba(0,0,0,.14));
      }
      .entry-inner{
        position:relative;
        z-index:1;
        width:min(100%,760px)!important;
        min-height:100dvh!important;
        height:auto!important;
        margin:0 auto!important;
        padding:calc(24px + env(safe-area-inset-top)) 22px calc(24px + env(safe-area-inset-bottom))!important;
        text-align:center!important;
      }
      .entry-title{
        margin:0!important;
        color:#fffaf0!important;
        font-size:clamp(36px,10.5vw,62px)!important;
        font-weight:950!important;
        line-height:1.01!important;
        letter-spacing:.085em!important;
        text-shadow:0 7px 10px rgba(0,0,0,.68),0 2px 2px rgba(0,0,0,.9),0 0 18px rgba(255,255,255,.12)!important;
      }
      .entry-copy{
        margin:14px 0 0!important;
        color:#f7dfaa!important;
        font-size:clamp(19px,5.2vw,29px)!important;
        font-weight:900!important;
        letter-spacing:.04em!important;
        text-shadow:0 4px 10px rgba(0,0,0,.78),0 1px 1px rgba(0,0,0,.95),0 0 10px rgba(245,210,135,.16)!important;
      }
      .entry-panel{
        width:min(100%,620px)!important;
        margin:6px auto 0!important;
        display:grid!important;
        gap:9px!important;
      }
      .entry .handed,
      .entry #cmRecent,
      .entry .cm-recent,
      .entry .entry-note,
      .entry .rain-dev-entry,
      .entry #labPill,
      .entry #labModal{
        display:none!important;
      }
      .entry .start{
        order:2;
        width:100%!important;
        min-height:58px!important;
        margin:0!important;
        border:1px solid rgba(255,239,200,.5)!important;
        border-radius:22px!important;
        background:rgba(46,39,29,.74)!important;
        color:rgba(255,248,232,.64)!important;
        box-shadow:0 10px 28px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.08)!important;
        backdrop-filter:blur(9px);
        -webkit-backdrop-filter:blur(9px);
        font-size:16px!important;
        font-weight:950!important;
        letter-spacing:.04em!important;
      }
      .entry .start.ready{
        background:linear-gradient(180deg,#f3d77f 0%,#ddb13e 52%,#c58c1f 100%)!important;
        color:#37270c!important;
        border-color:#fff0b1!important;
        box-shadow:0 0 0 1px rgba(255,244,197,.68),0 0 34px rgba(237,190,73,.78),0 12px 28px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.5)!important;
        animation:cmV58EntryGlow 1.7s ease-in-out infinite;
      }
      .entry .start.ready:before{
        content:"✣";
        margin-right:10px;
        color:#fff8df;
        text-shadow:0 1px 3px rgba(0,0,0,.2);
      }
      @keyframes cmV58EntryGlow{
        50%{box-shadow:0 0 0 1px rgba(255,244,197,.76),0 0 46px rgba(237,190,73,.96),0 12px 28px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.55)!important}
      }
      .entry .filebar{
        order:1;
        position:relative!important;
        display:grid!important;
        grid-template-columns:auto 1fr auto!important;
        align-items:center!important;
        gap:10px!important;
        width:100%!important;
        min-height:54px!important;
        margin:2px auto 0!important;
        padding:9px 12px!important;
        border:1px solid rgba(255,239,200,.48)!important;
        border-radius:18px!important;
        background:linear-gradient(180deg,rgba(53,47,35,.84),rgba(38,33,25,.80))!important;
        color:#fff8e8!important;
        text-align:left!important;
        box-shadow:0 9px 24px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.06)!important;
        backdrop-filter:blur(10px);
        -webkit-backdrop-filter:blur(10px);
      }
      .entry .filebar>span:first-child{font-size:25px!important;line-height:1!important;opacity:.95}
      .entry .filebar strong{font-size:12px!important;font-weight:900!important;line-height:1.25!important;text-shadow:0 2px 6px rgba(0,0,0,.45)}
      .entry .filename{max-width:38vw!important;font-size:11px!important;font-weight:850!important;color:#f7dfaa!important}
      .entry .resume{
        order:3;
        min-height:42px!important;
        border:1px solid rgba(255,239,200,.4)!important;
        border-radius:14px!important;
        background:rgba(35,31,25,.82)!important;
        color:#f7dfaa!important;
        font-weight:900!important;
      }
      .entry .entry-state{
        order:4;
        min-height:0!important;
        margin-top:0!important;
        color:rgba(255,248,232,.86)!important;
        font-size:11px!important;
        line-height:1.35!important;
        text-shadow:0 2px 8px rgba(0,0,0,.95)!important;
      }
      #cmV58StartTransition{
        position:fixed;
        inset:0;
        z-index:7000;
        display:none;
        place-items:center;
        background:#17130f url('../assets/creative-mode-start-transition.webp') center center/cover no-repeat;
        opacity:0;
        pointer-events:none;
      }
      .entry.cm-v58-starting #cmV58StartTransition{
        display:grid;
        animation:cmV58EntryStart 1.55s cubic-bezier(.22,.7,.2,1) forwards;
      }
      @keyframes cmV58EntryStart{
        0%{opacity:0;transform:scale(.985)}
        16%{opacity:1;transform:scale(.995)}
        28%{opacity:1;transform:scale(1)}
        70%{opacity:1;transform:scale(1.006)}
        86%{opacity:.96;transform:scale(1.01)}
        100%{opacity:0;transform:scale(1.015)}
      }
      @media(max-width:520px){
        .entry-inner{padding:calc(20px + env(safe-area-inset-top)) 18px calc(20px + env(safe-area-inset-bottom))!important}
        .entry-title{font-size:clamp(36px,12vw,50px)!important}
        .entry-copy{font-size:clamp(18px,6vw,24px)!important;margin-top:12px!important}
      }
      @media(max-width:340px),(max-height:620px){
        .entry-inner{padding-top:calc(12px + env(safe-area-inset-top))!important}
        .entry-title{font-size:30px!important}
        .entry-copy{margin-top:5px!important;font-size:15px!important}
        .entry .start{min-height:46px!important}
        .entry .filebar{min-height:46px!important}
      }
      @media(prefers-reduced-motion:reduce){
        .entry .start.ready{animation:none}
        .entry.cm-v58-starting #cmV58StartTransition{animation:none;opacity:1}
      }
    </style>`;
    if(!src.includes('id="cmV58NewEntryStyle"'))src=src.replace('</head>',style+'</head>');

    const helper=`function cmV58NewEntryTransition(done){
  if(entry.classList.contains('hidden')){done();return}
  entry.classList.add('cm-v58-starting');
  start.disabled=true;
  window.setTimeout(()=>{
    try{done()}finally{entry.classList.remove('cm-v58-starting')}
  },1550)
}
`;
    if(!src.includes('function cmV58NewEntryTransition(')&&src.includes('function beginEditor(){')){
      src=src.replace('function beginEditor(){',helper+'function beginEditor(){');
    }

    src=src.replace(
      "snapshot();beginEditor()}catch(e){$('entryState').textContent=e.message||'読み込み失敗'}",
      "snapshot();cmV58NewEntryTransition(beginEditor)}catch(e){$('entryState').textContent=e.message||'読み込み失敗'}"
    );
    src=src.replace(
      "resume.onclick=()=>{if(restore()){beginEditor();msg('前回作業を復元しました')}};",
      "resume.onclick=()=>{if(restore()){cmV58NewEntryTransition(beginEditor);msg('前回作業を復元しました')}};"
    );

    const runtime=`<script id="cmV58NewEntryRuntime">
(()=>{
  const entry=document.getElementById('entry');
  if(!entry)return;
  entry.classList.add('cm-v58-new-entry');

  const title=entry.querySelector('.entry-title');
  const copy=entry.querySelector('.entry-copy');
  const start=document.getElementById('startButton');
  const filebar=entry.querySelector('.filebar');
  const filename=document.getElementById('entryFileName');
  const state=document.getElementById('entryState');
  const resume=document.getElementById('resumeButton');

  if(title)title.textContent='CREATIVE MODE';
  if(copy)copy.textContent='新しい世界の幕開けへ。';
  if(start)start.textContent='創作をはじめる';
  if(filebar){
    const icon=filebar.querySelector(':scope > span:first-child');
    const label=filebar.querySelector('strong');
    if(icon)icon.textContent='▱';
    if(label)label.textContent='地図データ（KMZ）を選択';
  }
  if(filename&&!filename.textContent.trim())filename.textContent='未選択';
  if(state){
    const current=String(state.textContent||'');
    if(current==='編集するCSV / KMZを選択してください。'||current==='ファイルを選択してください。'){
      state.textContent='先にCSV / KMZを選択してください';
    }
  }
  if(resume)resume.textContent='前回のデータから再開';

  if(!document.getElementById('cmV58StartTransition')){
    const transition=document.createElement('div');
    transition.id='cmV58StartTransition';
    transition.setAttribute('aria-hidden','true');
    entry.appendChild(transition);
  }
})();
</script>`;
    if(!src.includes('id="cmV58NewEntryRuntime"'))src=src.replace('</body>',runtime+'</body>');

    return src;
  };
})();
