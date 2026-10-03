(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    src=src.replace(
      '<button id="cmStandaloneWorkspaceSave" type="button">💾 作業を保存</button>',
      ''
    );
    src=src.replace(
      "  const workspaceSave=w.querySelector('#cmStandaloneWorkspaceSave');\\n",
      ''
    );
    src=src.replace(
      /  const runWorkspaceSave=e=>\{[\s\S]*?\n  \};\n(?=  const runKmz=)/,
      ''
    );
    src=src.replace(
      "  ['pointerup','touchend','click'].forEach(type=>workspaceSave.addEventListener(type,runWorkspaceSave,{capture:true,passive:false}));\\n",
      ''
    );
    src=src.replace(
      '      #cmStandaloneSaveMenu #cmStandaloneWorkspaceSave{background:#f8dc83;border-color:#a9791f;text-align:center}\\n',
      ''
    );

    return src;
  };
})();
