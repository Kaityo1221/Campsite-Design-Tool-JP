(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const style=`<style id="cmV60RulesCarouselStyle">
      #cmV60RulesPanel{
        position:fixed;
        left:50%;
        bottom:calc(150px + env(safe-area-inset-bottom));
        z-index:6400;
        width:min(360px,calc(100vw - 28px));
        transform:translateX(-50%);
        border:1px solid rgba(54,46,34,.16);
        border-radius:22px;
        background:rgba(255,253,247,.98);
        color:#382d1d;
        box-shadow:0 18px 42px rgba(28,34,40,.24);
        overflow:hidden;
        pointer-events:auto;
      }
      #cmV60RulesPanel[hidden]{display:none!important}
      .cm-v60-head{display:flex;align-items:center;justify-content:space-between;padding:14px 14px 8px 18px}
      .cm-v60-head strong{font-size:17px;letter-spacing:.02em}
      #cmV60RulesClose{width:34px;height:34px;padding:0;border:0;border-radius:50%;background:#efe9dc;color:#493e2e;font-size:20px;font-weight:900;line-height:1;touch-action:manipulation}
      #cmV60RulesTrack{
        display:flex;
        gap:12px;
        overflow-x:auto;
        scroll-snap-type:x mandatory;
        scroll-behavior:smooth;
        overscroll-behavior-x:contain;
        -webkit-overflow-scrolling:touch;
        scrollbar-width:none;
        padding:4px 18px 10px;
        touch-action:pan-x;
      }
      #cmV60RulesTrack::-webkit-scrollbar{display:none}
      .cm-v60-card{
        flex:0 0 calc(100% - 42px);
        min-height:228px;
        box-sizing:border-box;
        scroll-snap-align:center;
        scroll-snap-stop:always;
        border:1px solid rgba(80,67,45,.13);
        border-radius:18px;
        background:linear-gradient(180deg,#fffdf7 0%,#fff8e7 100%);
        padding:18px;
        box-shadow:0 5px 14px rgba(45,38,27,.08);
      }
      .cm-v60-kicker{font-size:11px;font-weight:900;letter-spacing:.09em;color:#8a7042}
      .cm-v60-card h3{margin:5px 0 14px;font-size:20px;line-height:1.35}
      .cm-v60-big{font-size:38px;font-weight:1000;line-height:1;margin:4px 0 14px;color:#2d5f38}
      .cm-v60-counts{display:grid;gap:8px;margin-top:8px}
      .cm-v60-counts div{display:flex;justify-content:space-between;gap:14px;padding:8px 10px;border-radius:12px;background:rgba(62,115,70,.08);font-size:14px;font-weight:800}
      .cm-v60-counts b{font-size:15px}
      .cm-v60-rules{display:grid;gap:10px;margin:0;padding:0;list-style:none}
      .cm-v60-rules li{position:relative;padding-left:18px;font-size:14px;line-height:1.55;font-weight:750}
      .cm-v60-rules li:before{content:'•';position:absolute;left:2px;top:-1px;color:#c58a25;font-size:18px}
      .cm-v60-finish{display:grid;place-items:center;min-height:145px;text-align:center}
      .cm-v60-finish b{display:block;font-size:23px;line-height:1.45}
      .cm-v60-finish span{display:block;margin-top:10px;font-size:42px}
      #cmV60RulesDots{display:flex;justify-content:center;gap:8px;padding:2px 0 14px}
      #cmV60RulesDots button{width:8px;height:8px;padding:0;border:0;border-radius:999px;background:#cfc6b6;transition:width .18s ease,background .18s ease;touch-action:manipulation}
      #cmV60RulesDots button.is-active{width:22px;background:#4e7f56}
      body.cm-v60-rules-open #cmV59HelpButton{display:none!important}
      @media(max-height:700px){#cmV60RulesPanel{bottom:calc(126px + env(safe-area-inset-bottom))}.cm-v60-card{min-height:204px}}
      @media(prefers-reduced-motion:reduce){#cmV60RulesTrack{scroll-behavior:auto}#cmV60RulesDots button{transition:none}}
    </style>`;
    if(!src.includes('id="cmV60RulesCarouselStyle"'))src=src.replace('</head>',style+'</head>');

    const runtime=`<script id="cmV60RulesCarouselRuntime">
(()=>{
  const help=document.getElementById('cmV59HelpButton');
  if(!help||document.getElementById('cmV60RulesPanel'))return;

  const panel=document.createElement('section');
  panel.id='cmV60RulesPanel';
  panel.hidden=true;
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-modal','false');
  panel.setAttribute('aria-label','設計ルール');
  panel.innerHTML='<div class="cm-v60-head"><strong>設計ルール</strong><button id="cmV60RulesClose" type="button" aria-label="閉じる">×</button></div>'+
    '<div id="cmV60RulesTrack">'+
      '<article class="cm-v60-card" data-card="1"><div class="cm-v60-kicker">GAME SPOTS</div><h3>キャンプサイトに置けるゲームスポット</h3><div class="cm-v60-big">25個</div><div class="cm-v60-counts"><div><span>ポケストップ</span><b>12</b></div><div><span>ジム</span><b>8</b></div><div><span>パワースポット</span><b>5</b></div></div></article>'+
      '<article class="cm-v60-card" data-card="2"><div class="cm-v60-kicker">DISTANCE</div><h3>距離のルール</h3><ul class="cm-v60-rules"><li>POI間隔は原則50m</li><li>30m / 40mは参考距離</li><li>50m未満だから自動的に不合格ではない</li><li>50m未満となる場合、動線を確保するため、景色を見てほしいなど、ここに設置したい理由を書く</li></ul></article>'+
      '<article class="cm-v60-card" data-card="3"><div class="cm-v60-kicker">FINISH</div><h3>完成</h3><div class="cm-v60-finish"><div><b>完成時はKMZとして<br>保存</b><span>💾</span></div></div></article>'+
    '</div><div id="cmV60RulesDots" aria-label="カード位置"><button type="button" class="is-active" aria-label="1枚目" aria-current="true"></button><button type="button" aria-label="2枚目"></button><button type="button" aria-label="3枚目"></button></div>';
  document.body.appendChild(panel);

  const close=panel.querySelector('#cmV60RulesClose');
  const track=panel.querySelector('#cmV60RulesTrack');
  const cards=[...panel.querySelectorAll('.cm-v60-card')];
  const dots=[...panel.querySelectorAll('#cmV60RulesDots button')];
  let raf=0;

  const setActive=index=>{
    dots.forEach((dot,i)=>{
      dot.classList.toggle('is-active',i===index);
      if(i===index)dot.setAttribute('aria-current','true');else dot.removeAttribute('aria-current');
    });
  };
  const nearestIndex=()=>{
    const center=track.getBoundingClientRect().left+track.clientWidth/2;
    let best=0,dist=Infinity;
    cards.forEach((card,i)=>{const r=card.getBoundingClientRect();const d=Math.abs((r.left+r.right)/2-center);if(d<dist){dist=d;best=i}});
    return best;
  };
  const goTo=index=>{
    const card=cards[index];if(!card)return;
    setActive(index);
    const left=card.offsetLeft-(track.clientWidth-card.clientWidth)/2;
    track.scrollTo({left,behavior:'smooth'});
  };
  const open=()=>{
    panel.hidden=false;
    document.body.classList.add('cm-v60-rules-open');
    track.scrollLeft=0;
    setActive(0);
    requestAnimationFrame(()=>close.focus({preventScroll:true}));
  };
  const hide=()=>{
    panel.hidden=true;
    document.body.classList.remove('cm-v60-rules-open');
    help.focus({preventScroll:true});
  };

  help.addEventListener('click',open);
  close.addEventListener('click',hide);
  dots.forEach((dot,i)=>dot.addEventListener('click',()=>goTo(i)));
  track.addEventListener('scroll',()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>setActive(nearestIndex()));
  },{passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)hide()});
})();
</script>`;
    if(!src.includes('id="cmV60RulesCarouselRuntime"'))src=src.replace('</body>',runtime+'</body>');

    return src;
  };
})();
