(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const wording=[
      ['ポリゴン作成！','活動範囲を作成！'],
      ['ポリゴン作成をキャンセルしました','活動範囲の作成をキャンセルしました'],
      ['ポリゴンを作成しました','活動範囲を作成しました'],
      ['ポリゴン操作改善','活動範囲の操作改善'],
      ['ポリゴン1個制限','活動範囲は1個まで']
    ];
    wording.forEach(([from,to])=>{src=src.split(from).join(to)});
    src=src.split('ポリゴン').join('活動範囲');

    return src;
  };
})();
