(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const runtime=`<script id="cmV48CometAArcRuntime">
(()=>{
  const install=()=>{
    if(document.getElementById('cmV48CometAArcStyle'))return;

    const style=document.createElement('style');
    style.id='cmV48CometAArcStyle';
    style.textContent=\`
      .cm-v48-comet{position:fixed;left:0;top:0;width:1px;height:1px;z-index:7950;pointer-events:none;will-change:transform,opacity;filter:drop-shadow(0 0 5px rgba(91,205,255,.82))}
      .cm-v48-comet-head{position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:50%;background:radial-gradient(circle,#fff 0 34%,#e9fbff 35% 58%,#75d9ff 59% 78%,rgba(37,137,255,.94) 79% 100%);box-shadow:0 0 4px #fff,0 0 9px #8de4ff,0 0 15px rgba(38,139,255,.72)}
      .cm-v48-comet-tail{position:absolute;right:3px;top:-1px;width:42px;height:2px;border-radius:999px;background:linear-gradient(90deg,rgba(36,121,255,0),rgba(49,160,255,.18) 28%,rgba(95,214,255,.62) 70%,rgba(239,253,255,.96));box-shadow:0 0 4px rgba(83,202,255,.48)}
      .cm-v48-comet-dust{position:absolute;right:26px;top:-4px;width:2px;height:2px;border-radius:50%;background:#eefdff;box-shadow:-11px 5px 0 rgba(121,220,255,.58),-23px 1px 0 rgba(92,183,255,.30)}

      .cm-v48-kiran{position:fixed;z-index:7960;width:34px;height:34px;pointer-events:none;transform:translate(-50%,-50%) scale(.35);opacity:0;animation:cmV48Kiran .30s ease-out forwards;filter:drop-shadow(0 0 4px rgba(111,220,255,.9))}
      .cm-v48-kiran:before,.cm-v48-kiran:after{content:"";position:absolute;left:50%;top:50%;border-radius:999px;background:#fff;transform:translate(-50%,-50%);box-shadow:0 0 5px #fff,0 0 9px #75ddff}
      .cm-v48-kiran:before{width:2px;height:30px}
      .cm-v48-kiran:after{width:30px;height:2px}
      .cm-v48-kiran i:before,.cm-v48-kiran i:after{content:"";position:absolute;left:50%;top:50%;width:16px;height:1.5px;border-radius:999px;background:rgba(229,252,255,.96);box-shadow:0 0 4px #7edfff}
      .cm-v48-kiran i:before{transform:translate(-50%,-50%) rotate(45deg)}
      .cm-v48-kiran i:after{transform:translate(-50%,-50%) rotate(-45deg)}
      @keyframes cmV48Kiran{0%{opacity:0;transform:translate(-50%,-50%) scale(.25)}32%{opacity:1;transform:translate(-50%,-50%) scale(1)}72%{opacity:.92;transform:translate(-50%,-50%) scale(.82)}100%{opacity:0;transform:translate(-50%,-50%) scale(.48)}}

      #cmCount.cm-v48-count-touch{animation:cmV48CountTouch .36s ease-out}
      @keyframes cmV48CountTouch{0%{transform:scale(1);text-shadow:none}35%{transform:scale(1.18);text-shadow:0 0 6px #fff,0 0 12px #78dcff}100%{transform:scale(1);text-shadow:none}}
      @media(prefers-reduced-motion:reduce){.cm-v48-comet,.cm-v48-kiran{display:none!important}#cmCount.cm-v48-count-touch{animation:none!important}}
    \`;
    document.head.appendChild(style);

    try{
      cmV46FlyStarToCount=function(r){
        try{
          if(!r||!Array.isArray(r.latlng))return;
          const target=document.getElementById('cmCount');if(!target)return;
          if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){
            target.classList.remove('cm-v48-count-touch');void target.offsetWidth;target.classList.add('cm-v48-count-touch');
            setTimeout(()=>target.classList.remove('cm-v48-count-touch'),380);return;
          }

          const container=map.getContainer(),mr=container.getBoundingClientRect();
          const p=map.latLngToContainerPoint(L.latLng(r.latlng[0],r.latlng[1])),tr=target.getBoundingClientRect();
          const sx=mr.left+p.x,sy=mr.top+p.y,ex=tr.left+tr.width/2,ey=tr.top+tr.height/2;
          const dist=Math.hypot(ex-sx,ey-sy);
          const arc=Math.min(150,Math.max(62,dist*.22));
          const cx=sx+(ex-sx)*.50;
          const cy=sy+(ey-sy)*.42-arc;

          const comet=document.createElement('div');
          comet.className='cm-v48-comet';
          comet.innerHTML='<i class="cm-v48-comet-tail"></i><i class="cm-v48-comet-dust"></i><i class="cm-v48-comet-head"></i>';
          document.body.appendChild(comet);

          const duration=1120;
          const start=performance.now();
          const ease=p=>-(Math.cos(Math.PI*p)-1)/2;
          const point=t=>{
            const u=1-t;
            return [u*u*sx+2*u*t*cx+t*t*ex,u*u*sy+2*u*t*cy+t*t*ey];
          };
          const tangent=t=>[
            2*(1-t)*(cx-sx)+2*t*(ex-cx),
            2*(1-t)*(cy-sy)+2*t*(ey-cy)
          ];

          const finish=()=>{
            comet.remove();
            const k=document.createElement('div');k.className='cm-v48-kiran';k.style.left=ex+'px';k.style.top=ey+'px';k.innerHTML='<i></i>';document.body.appendChild(k);
            setTimeout(()=>k.remove(),340);
            target.classList.remove('cm-v48-count-touch');void target.offsetWidth;target.classList.add('cm-v48-count-touch');
            setTimeout(()=>target.classList.remove('cm-v48-count-touch'),390);
          };

          const frame=now=>{
            const raw=Math.min(1,(now-start)/duration),t=ease(raw);
            const [x,y]=point(t),[tx,ty]=tangent(t);
            const angle=Math.atan2(ty,tx)*180/Math.PI;
            const fade=raw<.08?raw/.08:raw>.91?(1-raw)/.09:1;
            const scale=.82+.18*Math.sin(Math.PI*Math.min(1,raw/.38));
            comet.style.transform='translate3d('+x+'px,'+y+'px,0) rotate('+angle+'deg) scale('+scale+')';
            comet.style.opacity=String(Math.max(0,Math.min(1,fade)));
            if(raw<1)requestAnimationFrame(frame);else finish();
          };
          requestAnimationFrame(frame);
        }catch(err){console.warn('[Creative v48] curved comet',err)}
      };
    }catch(err){console.warn('[Creative v48] install comet override',err)}
  };

  // JP patch is injected after runtime patches. Install on the next task so this
  // A-style comet intentionally becomes the final animation implementation.
  setTimeout(install,0);
})();
<\/script>`;
    if(!src.includes('id="cmV48CometAArcRuntime"'))src=src.replace('</body>',runtime+'</body>');
    return src;
  };
})();
