(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);
    src=src.replace(
      '<button data-tool="polygon">ポリゴン</button>',
      '<button data-tool="polygon">活動範囲</button>'
    );
    return src;
  };
})();
