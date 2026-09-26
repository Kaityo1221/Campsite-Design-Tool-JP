(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const style=`<style id="cmV46FieldFeedbackStyle">
      /* Aベース + C要素：中心を隠さない配置インジケーター */
      #cmSafeAddDot{width:86px!important;height:86px!important;display:grid!important;place-items:center!important;pointer-events:none!important}
      #cmSafeAddDot span{
        position:relative!important;display:block!important;width:64px!important;height:64px!important;
        border:2px solid #ff8418!important;border-radius:50%!important;background:
          linear-gradient(#ff8418,#ff8418) 6px 6px/12px 3px no-repeat,
          linear-gradient(#ff8418,#ff8418) 6px 6px/3px 12px no-repeat,
          linear-gradient(#ff8418,#ff8418) calc(100% - 6px) 6px/12px 3px no-repeat,
          linear-gradient(#ff8418,#ff8418) calc(100% - 6px) 6px/3px 12px no-repeat,
          linear-gradient(#ff8418,#ff8418) 6px calc(100% - 6px)/12px 3px no-repeat,
          linear-gradient(#ff8418,#ff8418) 6px calc(100% - 6px)/3px 12px no-repeat,
          linear-gradient(#ff8418,#ff8418) calc(100% - 6px) calc(100% - 6px)/12px 3px no-repeat,
          linear-gradient(#ff8418,#ff8418) calc(100% - 6px) calc(100% - 6px)/3px 12px no-repeat!important;
        box-shadow:0 0 0 1px rgba(255,255,255,.28),0 2px 9px rgba(0,0,0,.16)!important;
        transform:none!important;opacity:1!important
      }
      #cmSafeAddDot span:before{
        content:""!important;position:absolute!important;left:-14px!important;right:-14px!important;top:-14px!important;bottom:-14px!important;
        background:
          linear-gradient(to right,#fff 0 43%,transparent 43% 57%,#fff 57% 100%) center/100% 2px no-repeat,
          linear-gradient(to bottom,#fff 0 43%,transparent 43% 57%,#fff 57% 100%) center/2px 100% no-repeat!important;
        border:0!important;border-radius:0!important;box-shadow:none!important;transform:none!important;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))
      }
      #cmSafeAddDot span:after{
        content:""!important;position:absolute!important;left:50%!important;top:50%!important;width:12px!important;height:12px!important;
        border:2px solid rgba(255,255,255,.96)!important;border-radius:50%!important;background:transparent!important;
        box-shadow:0 1px 3px rgba(0,0,0,.28)!important;transform:translate(-50%,-50%)!important
      }

      /* 保存メニューは中央寄せ・少し細身 */
      #cmStandaloneSaveMenu{
        left:50%!important;right:auto!important;transform:translateX(-50%)!important;
        width:min(228px,calc(100vw - 44px))!important;padding:7px!important;gap:6px!important
      }
      .left-hand #cmStandaloneSaveMenu{left:50%!important;right:auto!important}
      #cmStandaloneSaveMenu button{min-height:44px!important;padding:0 12px!important}

      /* 座標一覧の提出理由 */
      .cm-v46-reason{display:grid;gap:6px;padding:10px 0 2px;border-top:1px solid #f0e6d5}
      .cm-v46-reason span{font-size:12px;font-weight:900;color:#6f604c}
      .cm-v46-reason textarea{width:100%;min-height:72px;resize:vertical;border:1px solid #d7c7a7;border-radius:11px;background:#fffdf9;color:#382d1d;padding:9px 10px;font:700 13px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-sizing:border-box}
      .cm-v46-reason textarea:focus{outline:2px solid rgba(22,119,255,.20);border-color:#7caef0}

      /* 小さな青い流れ星 */
      .cm-v46-shooting-star{position:fixed;z-index:7200;width:9px;height:9px;border-radius:50%;background:#35a7ff;box-shadow:0 0 7px #35a7ff,0 0 13px rgba(22,119,255,.72);pointer-events:none}
      .cm-v46-shooting-star:after{content:"";position:absolute;right:5px;top:50%;width:22px;height:2px;transform:translateY(-50%);transform-origin:right center;background:linear-gradient(to left,rgba(53,167,255,.82),rgba(53,167,255,0));border-radius:999px}
      #cmCount.cm-v46-count-pop{animation:cmV46CountPop .28s ease}
      @keyframes cmV46CountPop{0%{transform:scale(1)}45%{transform:scale(1.28)}100%{transform:scale(1)}}
      @media(prefers-reduced-motion:reduce){.cm-v46-shooting-star{display:none!important}#cmCount.cm-v46-count-pop{animation:none!important}}
    </style>`;
    if(!src.includes('id="cmV46FieldFeedbackStyle"'))src=src.replace('</head>',style+'</head>');

    const runtime=`<script id="cmV46FieldFeedbackRuntime">
(()=>{
  /* v45 の !important 配置と両立させ、FABドラッグ位置を復活 */
  try{
    if(typeof cmApplyFabPosition==='function'){
      cmApplyFabPosition=function(pos){
        const wrap=document.getElementById('cmFabWrap');if(!wrap||!pos)return;
        const p=typeof cmClampFabPosition==='function'?cmClampFabPosition(pos.x,pos.y):pos;
        wrap.style.setProperty('left',Number(p.x)+'px','important');
        wrap.style.setProperty('top',Number(p.y)+'px','important');
        wrap.style.setProperty('right','auto','important');
        wrap.style.setProperty('bottom','auto','important');
      };
      try{const saved=typeof cmReadFabPosition==='function'?cmReadFabPosition():null;if(saved)cmApplyFabPosition(saved)}catch(_){}
    }
  }catch(e){console.warn('[Creative v46] FAB drag restore',e)}

  /* 「追加」ヒントを、移動した＋ボタンの近くへ追従 */
  function alignAddHint(){
    const fab=document.getElementById('cmAddFab'),hint=document.getElementById('cmV45AddFlash');if(!fab||!hint)return;
    const r=fab.getBoundingClientRect();
    hint.style.right='auto';hint.style.left=Math.max(6,r.left+(r.width-52)/2)+'px';
  }
  function bindHint(){const fab=document.getElementById('cmAddFab');if(!fab||fab.dataset.cmV46Hint==='1')return;fab.dataset.cmV46Hint='1';fab.addEventListener('click',()=>setTimeout(alignAddHint,0));}

  function flyStarToCount(record){
    try{
      if(!record||!Array.isArray(record.latlng)||!window.matchMedia('(prefers-reduced-motion: reduce)').matches===false)return;
    }catch(_){}
    try{
      const target=document.getElementById('cmCount');if(!target||!map)return;
      const container=map.getContainer(),mr=container.getBoundingClientRect(),p=map.latLngToContainerPoint(record.latlng),tr=target.getBoundingClientRect();
      const sx=mr.left+p.x,sy=mr.top+p.y,ex=tr.left+tr.width/2,ey=tr.top+tr.height/2;
      const star=document.createElement('div');star.className='cm-v46-shooting-star';star.style.left=sx+'px';star.style.top=sy+'px';document.body.appendChild(star);
      const dx=ex-sx,dy=ey-sy,angle=Math.atan2(dy,dx)*180/Math.PI;
      star.style.transform='translate(-50%,-50%) rotate('+angle+'deg)';
      const anim=star.animate([
        {left:sx+'px',top:sy+'px',opacity:0,offset:0},
        {left:(sx+dx*.12)+'px',top:(sy+dy*.12)+'px',opacity:1,offset:.16},
        {left:ex+'px',top:ey+'px',opacity:.18,offset:1}
      ],{duration:430,easing:'cubic-bezier(.22,.72,.24,1)',fill:'forwards'});
      anim.onfinish=()=>{star.remove();target.classList.remove('cm-v46-count-pop');void target.offsetWidth;target.classList.add('cm-v46-count-pop');setTimeout(()=>target.classList.remove('cm-v46-count-pop'),320)};
    }catch(e){console.warn('[Creative v46] star animation',e)}
  }

  /* 候補地の追加成功時だけ小さな流れ星を飛ばす */
  try{
    if(typeof cmPlace==='function'&&!cmPlace.__cmV46Wrapped){
      const basePlace=cmPlace;
      const wrapped=function(latlng){
        let before=0;try{before=typeof cmActiveNew==='function'?cmActiveNew().length:0}catch(_){}
        const result=basePlace(latlng);
        try{
          const items=typeof cmActiveNew==='function'?cmActiveNew():[];
          if(items.length>before)flyStarToCount(items[items.length-1]);
        }catch(_){}
        return result;
      };
      wrapped.__cmV46Wrapped=true;cmPlace=wrapped;
    }
  }catch(e){console.warn('[Creative v46] cmPlace wrap',e)}

  /* 座標一覧カードの経度の下に、提出用の理由欄を追加 */
  function enhanceCoords(){
    const view=document.querySelector('.cm-coords');if(!view||view.dataset.cmV46Reasons==='1')return;
    const cards=[...view.querySelectorAll('.cm-coord-card')];
    let items=[];try{items=typeof cmActiveNew==='function'?cmActiveNew():[]}catch(_){}
    cards.forEach((card,i)=>{
      if(card.querySelector('.cm-v46-reason'))return;
      const r=items[i];if(!r)return;
      const label=document.createElement('label');label.className='cm-v46-reason';
      const title=document.createElement('span');title.textContent='理由';
      const ta=document.createElement('textarea');ta.placeholder='この候補地を選んだ理由を入力';ta.value=String(r.memo||'');
      ta.addEventListener('input',()=>{r.memo=ta.value;try{snapshot()}catch(_){}try{cmPersistCurrent()}catch(_){}});
      label.append(title,ta);card.appendChild(label);
    });
    view.dataset.cmV46Reasons='1';
  }

  bindHint();enhanceCoords();
  new MutationObserver(()=>{bindHint();enhanceCoords()}).observe(document.body,{childList:true,subtree:true});
})();
</script>`;
    if(!src.includes('id="cmV46FieldFeedbackRuntime"'))src=src.replace('</body>',runtime+'</body>');

    return src;
  };
})();
