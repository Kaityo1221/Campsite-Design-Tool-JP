(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // 7) New candidates must start with an actually empty user memo.
    src=src.replace(
      "memo:/^new-/.test(String(layer||''))?'新規ゲームスポット':'',deleted:false",
      "memo:'',deleted:false"
    );

    // 8) Keep KML/system metadata out of the user-facing memo field.
    const parseMarker='function parse(kml){';
    if(src.includes(parseMarker)&&!src.includes('function cmV71NormalizeMemo(')){
      const helper=`function cmV71NormalizeMemo(value){
  let text=String(value??'');
  if(!text)return'';
  text=text
    .replace(/<br\\s*\\/?>/gi,'\\n')
    .replace(/<\\/(?:p|div|li|tr|h[1-6])\\s*>/gi,'\\n');
  try{
    const box=document.createElement('div');
    box.innerHTML=text;
    text=box.textContent||box.innerText||text;
  }catch(_){}
  text=text.replace(/\\r\\n?/g,'\\n');
  const lines=text.split('\\n').map(line=>line.trim()).filter(Boolean);
  const cleaned=[];
  for(let line of lines){
    line=line.replace(/^(?:説明|description)\\s*[:：]\\s*/i,'').trim();
    if(!line)continue;
    if(/^(?:nextlab-layer|campsite-workspace-id)\\s*[:：]/i.test(line))continue;
    cleaned.push(line);
  }
  const result=cleaned.join('\\n').trim();
  return result==='新規ゲームスポット'?'':result;
}
`;
      src=src.replace(parseMarker,helper+parseMarker);
    }

    src=src.replace(
      "memo:child(pm,'description')||'',deleted:false",
      "memo:cmV71NormalizeMemo(child(pm,'description')||''),deleted:false"
    );
    src=src.replace(
      "records=s.records||[];",
      "records=(s.records||[]).map(r=>({...r,memo:cmV71NormalizeMemo(r?.memo||'')}));"
    );
    src=src.replace(
      "records=(w.records||[]).map(r=>({...r}));",
      "records=(w.records||[]).map(r=>({...r,memo:cmV71NormalizeMemo(r?.memo||'')}));"
    );

    // 9) The text download button must stay on one line on narrow iPhone screens.
    src=src.replace(
      "download.textContent='ダウンロード';download.title='ダウンロード';Object.assign(download.style,{width:'112px',height:'46px',border:'2px solid #8a6b31',borderRadius:'14px',background:'rgba(255,253,247,.96)',color:'#5d4630',fontWeight:'950',fontSize:'20px'});",
      "download.textContent='ダウンロード';download.title='ダウンロード';Object.assign(download.style,{width:'112px',height:'46px',border:'2px solid #8a6b31',borderRadius:'14px',background:'rgba(255,253,247,.96)',color:'#5d4630',fontWeight:'950',fontSize:'14px',whiteSpace:'nowrap',boxSizing:'border-box',padding:'0 10px'});"
    );

    // 10) Only the visible grab handle may dismiss the detail sheet by a downward swipe.
    const oldSwipe="function cmSheetSwipe(el){let sy=null;el.addEventListener('touchstart',e=>{if(e.touches.length===1)sy=e.touches[0].clientY},{passive:true});el.addEventListener('touchend',e=>{if(sy===null||e.changedTouches.length!==1)return;if(e.changedTouches[0].clientY-sy>65)cmCloseSheet();sy=null},{passive:true})}";
    const newSwipe="function cmSheetSwipe(el){const handle=el?.querySelector?.('.cm-sheet-handle');if(!handle)return;let sy=null;handle.addEventListener('touchstart',e=>{if(e.touches.length===1)sy=e.touches[0].clientY},{passive:true});handle.addEventListener('touchend',e=>{if(sy===null||e.changedTouches.length!==1){sy=null;return}if(e.changedTouches[0].clientY-sy>65)cmCloseSheet();sy=null},{passive:true});handle.addEventListener('touchcancel',()=>{sy=null},{passive:true})}";
    if(src.includes(oldSwipe))src=src.replace(oldSwipe,newSwipe);

    // 11) Long detail sheets scroll internally instead of falling off-screen.
    const style=`<style id="cmV71DetailSheetStyle">
      .cm-sheet{
        max-height:calc(100vh - 72px)!important;
        max-height:calc(100dvh - 72px)!important;
        overflow-y:auto!important;
        overscroll-behavior:contain!important;
        -webkit-overflow-scrolling:touch;
        box-sizing:border-box!important;
      }
      .cm-sheet-handle{touch-action:none}
      .cm-sheet input,.cm-sheet textarea{touch-action:auto!important}
      .cm-sheet textarea{overscroll-behavior:contain!important}
    </style>`;
    if(!src.includes('id="cmV71DetailSheetStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
