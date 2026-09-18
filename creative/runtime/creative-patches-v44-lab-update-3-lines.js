(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const list='<ul><li>保存時のファイル名変更</li><li>LAB UPDATE表示</li><li>CSV / KMZ読込対応</li></ul>';
    src=src.replace(/<ul><li>保存時のファイル名変更<\/li>[\s\S]*?<\/ul><button id="labClose">閉じる<\/button>/,
      list+'<button id="labClose">閉じる</button>');

    return src;
  };
})();
