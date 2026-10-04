(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    src=src.replace(
      '<button id="cmStandaloneCoords" type="button">座標一覧</button>',
      '<button id="cmStandaloneCoords" type="button">座標一覧（Googleフォーム用）</button>'
    );
    src=src.split('座標一覧（旧提出フォーム用）').join('座標一覧（Googleフォーム用）');

    return src;
  };
})();
