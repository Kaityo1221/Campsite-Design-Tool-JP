(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);
    const mainTarget='https://kaityo1221.github.io/Campsite-Design-Tool-JP/';

    // 画面上部の「戻る」は CREATIVE MODE の開始画面へ戻す。
    // 現在の検証URL自身へ戻すことで、Next Labの開発トップや本体認証画面を挟まない。
    const backOld="$('back').onclick=()=>{snapshot();cmPersistCurrent();location.href='../index.html'};";
    const backNew="$('back').onclick=()=>{snapshot();cmPersistCurrent();location.href=location.origin+location.pathname};";
    if(src.includes(backOld))src=src.replace(backOld,backNew);

    // KMZ出力後の「Campsite Design Toolに戻る」だけは、本体へ戻す。
    const returnOld="b.onclick=()=>{snapshot();cmPersistCurrent();location.href='../index.html'};document.body.appendChild(b)}";
    const returnNew=`b.onclick=()=>{snapshot();cmPersistCurrent();location.href='${mainTarget}'};document.body.appendChild(b)}`;
    if(src.includes(returnOld))src=src.replace(returnOld,returnNew);

    return src;
  };
})();
