(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const marker='function cmInstallUi(){cmAddStyle();';
    const helper=`
function cmInstallLayerPanelTopStyle(){
  if(document.getElementById('cmLayerPanelTopStyle'))return;
  const s=document.createElement('style');
  s.id='cmLayerPanelTopStyle';
  s.textContent=\`
    #layerPanel{
      top:calc(112px + env(safe-area-inset-top))!important;
      max-height:calc(100dvh - 128px - env(safe-area-inset-top) - env(safe-area-inset-bottom))!important;
      overflow-y:auto!important;
      overscroll-behavior:contain;
      -webkit-overflow-scrolling:touch;
    }
  \`;
  document.head.appendChild(s);
}
`;

    if(src.includes(marker)){
      src=src.replace(marker,helper+marker.replace('cmAddStyle();','cmAddStyle();cmInstallLayerPanelTopStyle();'));
    }else if(!src.includes('cmLayerPanelTopStyle')){
      src=src.replace('</head>',`<style id="cmLayerPanelTopStyle">#layerPanel{top:calc(112px + env(safe-area-inset-top))!important;max-height:calc(100dvh - 128px - env(safe-area-inset-top) - env(safe-area-inset-bottom))!important;overflow-y:auto!important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}</style></head>`);
    }

    return src;
  };
})();
