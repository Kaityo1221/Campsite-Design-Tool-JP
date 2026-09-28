(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const startMarker='function cmPlace(latlng){';
    const endMarker='function cmMapClick(';
    const start=src.indexOf(startMarker);
    const end=start>=0?src.indexOf(endMarker,start+startMarker.length):-1;

    if(start>=0&&end>=0&&!src.includes('cmV53NewPoiAutoMemo')){
      let body=src.slice(start,end);
      const needle="memo:'',deleted:false";
      const replacement="memo:/^new-/.test(String(layer||''))?'新規ゲームスポット':'',deleted:false";

      if(body.includes(needle)){
        body=body.replace(needle,replacement);
        body=body.replace(startMarker,startMarker+'/* cmV53NewPoiAutoMemo */');
        src=src.slice(0,start)+body+src.slice(end);
      }
    }

    const keyboardRuntime=`<script id="cmV53DefaultTextKeyboardRuntime">
(()=>{
  function useNormalKeyboard(){
    const panel=document.getElementById('cmCoordinateJumpPanel');
    const input=panel?.querySelector('#cmCoordinateInput');
    const button=panel?.querySelector('.cm-v52-keyboard-toggle');
    if(!input)return;
    if(input.dataset.cmV53DefaultKeyboard==='1')return;
    input.dataset.cmV53DefaultKeyboard='1';
    input.setAttribute('inputmode','text');
    input.dataset.cmKeyboardMode='text';
    if(button){
      button.dataset.keyboard='text';
      button.textContent='⌨︎ 123';
      button.setAttribute('aria-label','テンキーに切り替える');
    }
  }
  useNormalKeyboard();
  new MutationObserver(()=>setTimeout(useNormalKeyboard,0)).observe(document.body,{childList:true,subtree:true});
})();
<\/script>`;
    if(!src.includes('id="cmV53DefaultTextKeyboardRuntime"'))src=src.replace('</body>',keyboardRuntime+'</body>');

    return src;
  };
})();
