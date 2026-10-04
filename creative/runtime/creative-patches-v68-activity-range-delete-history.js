(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    src=src.replace(
      "d.onclick=()=>{item.p.deleted=true;clearPolygonDeleteMode();",
      "d.onclick=()=>{item.p.deleted=true;pushHistory({type:'polygon-delete',id:item.p.id});clearPolygonDeleteMode();"
    );

    src=src.replace(
      "else if(a.type==='polygon-add'){const p=polygons.find(x=>x.id===a.id);if(p)p.deleted=true}redoStack.push(a);",
      "else if(a.type==='polygon-add'){const p=polygons.find(x=>x.id===a.id);if(p)p.deleted=true}else if(a.type==='polygon-delete'){const p=polygons.find(x=>x.id===a.id);if(p)p.deleted=false}redoStack.push(a);"
    );

    src=src.replace(
      "else if(a.type==='polygon-add'){const p=polygons.find(x=>x.id===a.id);if(p)p.deleted=false}undoStack.push(a);",
      "else if(a.type==='polygon-add'){const p=polygons.find(x=>x.id===a.id);if(p)p.deleted=false}else if(a.type==='polygon-delete'){const p=polygons.find(x=>x.id===a.id);if(p)p.deleted=true}undoStack.push(a);"
    );

    return src;
  };
})();
