(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const startMarker='function cmPlace(latlng){';
    const endMarker='function cmMapClick(';
    const start=src.indexOf(startMarker);
    const end=start>=0?src.indexOf(endMarker,start+startMarker.length):-1;
    if(start<0||end<0||src.includes('cmV53NewPoiAutoMemo'))return src;

    let body=src.slice(start,end);
    const needle="memo:'',deleted:false";
    const replacement="memo:/^new-/.test(String(layer||''))?'新規ゲームスポット':'',deleted:false";

    if(body.includes(needle)){
      body=body.replace(needle,replacement);
      body=body.replace(startMarker,startMarker+'/* cmV53NewPoiAutoMemo */');
      src=src.slice(0,start)+body+src.slice(end);
    }

    return src;
  };
})();
