(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);
    const oldLabel="b.innerHTML='<strong>'+(i===0?'前回':'保存 '+(i+1))+'</strong><span>'";
    const newLabel="b.innerHTML='<strong>セーブデータ'+(i+1)+'</strong><span>'";
    if(src.includes(oldLabel))src=src.replace(oldLabel,newLabel);
    return src;
  };
})();
