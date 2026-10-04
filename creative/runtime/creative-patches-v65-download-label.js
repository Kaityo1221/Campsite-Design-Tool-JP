(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    src=src.replace(
      "download.textContent='⬇';download.title='通常ダウンロード';Object.assign(download.style,{width:'46px',height:'46px'",
      "download.textContent='ダウンロード';download.title='ダウンロード';Object.assign(download.style,{width:'112px',height:'46px'"
    );

    return src;
  };
})();
