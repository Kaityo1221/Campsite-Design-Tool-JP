(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    src=src.replace(
      "cmSafeAddDot.style.display='grid';",
      "cmSafeAddDot.style.setProperty('display','grid','important');"
    );
    src=src.replace(
      "function cmSafeHideAddDot(){if(cmSafeAddDot)cmSafeAddDot.style.display='none'}",
      "function cmSafeHideAddDot(){if(cmSafeAddDot)cmSafeAddDot.style.setProperty('display','none','important')}"
    );

    return src;
  };
})();
