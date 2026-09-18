(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const marker=/function cmRenderRecent\(\)\{[\s\S]*?\}\nfunction cmMigrateLegacyStore/;
    if(marker.test(src)){
      const replacement=`function cmRecentDisplayName(w){
  const raw=String(w?.sourceName||'').trim();
  if(!raw)return '作業データ';
  const base=raw.split(/[\\/\\\\]/).pop()||raw;
  return base.replace(/\\.(kmz|kml|csv|zip)$/i,'')||base;
}
function cmRenderRecent(){
  const box=document.getElementById('cmRecent');
  if(!box)return;
  const items=cmRecentItems();
  box.innerHTML='';
  if(!items.length){box.style.display='none';return}
  box.style.display='grid';
  const title=document.createElement('div');
  title.className='cm-recent-title';
  title.textContent='最近の作業';
  box.appendChild(title);
  items.forEach(w=>{
    const b=document.createElement('button');
    const count=(w.records||[]).filter(r=>r&&!r.deleted&&/^new-/.test(r.layer)).length;
    b.type='button';
    b.className='cm-recent-item';
    const strong=document.createElement('strong');
    strong.textContent=cmRecentDisplayName(w);
    const span=document.createElement('span');
    span.textContent=cmJst(w.createdAt||w.updatedAt||Date.now())+'　'+count+'件';
    b.append(strong,span);
    b.onclick=()=>cmLoadWorkspace(w);
    box.appendChild(b);
  });
}
function cmMigrateLegacyStore`;
      src=src.replace(marker,replacement);
    }

    return src;
  };
})();
