(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const marker='function cmPlace(latlng){';
    const start=src.indexOf(marker);
    if(start<0||src.includes('cmV53NewPoiAutoMemo'))return src;

    const nextFunction=src.indexOf('function ',start+marker.length);
    const end=nextFunction>=0?nextFunction:src.length;
    let body=src.slice(start,end);

    const needle="memo:'',deleted:false};if(helperRadius!==50)r.customRadius=helperRadius;";
    const replacement="memo:'',deleted:false};if(/^new-/.test(String(r.layer||''))&&!String(r.memo||'').trim())r.memo='新規ゲームスポット';if(helperRadius!==50)r.customRadius=helperRadius;";

    if(body.includes(needle)){
      body=body.replace(needle,replacement);
      body=body.replace(marker,marker+'/* cmV53NewPoiAutoMemo */');
      src=src.slice(0,start)+body+src.slice(end);
    }

    return src;
  };
})();
