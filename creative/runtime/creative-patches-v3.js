(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;
  window.applyCreativePatches=function(src){
    src=previous(src);

    // 詳細パネルに専用クラスを付け、インライン指定より強くコンパクト化する
    src=src.replace("panel=document.createElement('div');let helperRadius=50;","panel=document.createElement('div');panel.className='creative-detail-panel';let helperRadius=50;");

    // 最終HTMLへ強制CSSを注入。既存のinline width:100%も!importantで上書きする
    const compactCss=`<style>
      .creative-detail-panel{width:236px!important;max-width:72vw!important;padding:9px!important;box-sizing:border-box!important}
      .creative-detail-panel #customRadiusInput,.creative-detail-panel #coordinateInput{width:100%!important;box-sizing:border-box!important}
      .creative-detail-panel #applyRadius,.creative-detail-panel #applyCoordinate{display:block!important;width:max-content!important;max-width:100%!important;min-width:0!important;height:34px!important;margin:7px auto 0!important;padding:0 12px!important;font-size:12px!important;white-space:nowrap!important}
    </style>`;
    if(src.includes('</head>'))src=src.replace('</head>',compactCss+'</head>');

    // 座標ボタンは必ず「座標へ移動」に統一
    src=src.replace(/(<button id=\"applyCoordinate\"[^>]*>)(?:この座標に追加|座標へ移動)(<\/button>)/g,'$1座標へ移動$2');

    // 座標入力は移動のみ。押したら詳細パネルを閉じ、その後で地図・仮POI・補助円を移動する
    const handler=/panel\.querySelector\('#applyCoordinate'\)\.onclick=\(\)=>\{[\s\S]*?\};add\.onclick=/;
    const replacement="panel.querySelector('#applyCoordinate').onclick=()=>{const raw=panel.querySelector('#coordinateInput').value.trim().replace(/，/g,','),parts=raw.split(',').map(x=>Number(x.trim()));if(parts.length!==2||!Number.isFinite(parts[0])||!Number.isFinite(parts[1])||parts[0]<-90||parts[0]>90||parts[1]<-180||parts[1]>180){msg('座標は「緯度, 経度」で入力してください');return}panel.style.display='none';const ll=[parts[0],parts[1]];map.setView(ll,map.getZoom(),{animate:false});marker.setLatLng(ll);draft.c50.setLatLng(ll);draft.c40.setLatLng(ll);updateNearestHint();msg('入力した座標へ移動しました',1200)};add.onclick=";
    if(handler.test(src))src=src.replace(handler,replacement);

    return src;
  };
})();
