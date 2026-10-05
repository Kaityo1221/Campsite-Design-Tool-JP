(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    src=src.replace(
      "function beginAnotherPolygon(){closePolygonToolMenu();clearPolygonDeleteMode();activeTool='polygon';clearDraft();clearRuler();beginCrosshairPolygon();renderTools();msg('追加する活動範囲を描いてください',2200)}",
      "function beginAnotherPolygon(){closePolygonToolMenu();clearPolygonDeleteMode();toolMenu.classList.remove('open');activeTool='polygon';clearDraft();clearRuler();beginCrosshairPolygon();renderTools();msg('活動範囲を描いてください',2200)}"
    );

    src=src.replace(
      "function openPolygonChoice(){closeMenus();closePolygonToolMenu();clearPolygonDeleteMode();const count=polygons.filter(p=>!p.deleted).length;if(!count){beginAnotherPolygon();return}const w=document.createElement('div'),a=document.createElement('button'),d=document.createElement('button'),c=document.createElement('button');",
      "function openPolygonChoice(){closeMenus();toolMenu.classList.remove('open');closePolygonToolMenu();clearPolygonDeleteMode();const list=polygons.filter(p=>!p.deleted);if(!list.length){beginAnotherPolygon();return}const w=document.createElement('div'),a=document.createElement('button'),d=document.createElement('button'),c=document.createElement('button');"
    );

    src=src.replace(
      "a.textContent='＋ 活動範囲を追加';d.textContent='削除する';c.textContent='キャンセル';",
      "a.textContent='描き直す';d.textContent='削除する';c.textContent='キャンセル';"
    );

    src=src.replace(
      "a.onclick=beginAnotherPolygon;d.onclick=beginPolygonDeleteMode;c.onclick=closePolygonToolMenu;",
      "a.onclick=()=>{const p=polygons.find(x=>!x.deleted);if(p){p.deleted=true;pushHistory({type:'polygon-delete',id:p.id});drawAll();renderLayerPanel();snapshot()}beginAnotherPolygon()};d.onclick=beginPolygonDeleteMode;c.onclick=closePolygonToolMenu;"
    );

    src=src.replace(
      "toolMenu.querySelectorAll('button').forEach(b=>b.onclick=()=>b.dataset.tool==='polygon'?openPolygonChoice():selectTool(b.dataset.tool));",
      "toolMenu.querySelectorAll('button').forEach(b=>b.onclick=()=>{toolMenu.classList.remove('open');b.dataset.tool==='polygon'?openPolygonChoice():selectTool(b.dataset.tool)});"
    );

    src=src.replace(
      "function clearRuler(){if(!ruler)return;if(ruler.onClick)map.off('click',ruler.onClick);if(ruler.line)map.removeLayer(ruler.line);if(ruler.start)map.removeLayer(ruler.start);if(ruler.end)map.removeLayer(ruler.end);ruler=null;status.classList.add('fade')}",
      "function clearRuler(){const exit=document.getElementById('cmRulerExit');if(exit)exit.remove();if(!ruler)return;if(ruler.onClick)map.off('click',ruler.onClick);if(ruler.line)map.removeLayer(ruler.line);if(ruler.start)map.removeLayer(ruler.start);if(ruler.end)map.removeLayer(ruler.end);ruler=null;status.classList.add('fade')}"
    );

    src=src.replace(
      "msg(\`距離 \${map.distance(startLl,ll).toFixed(1)}m\`,0)};ruler={start:null,end:null,line:null,onClick};",
      "msg(\`距離 \${map.distance(startLl,ll).toFixed(1)}m\`,0);let exit=document.getElementById('cmRulerExit');if(!exit){exit=document.createElement('button');exit.id='cmRulerExit';exit.type='button';exit.textContent='× 終了';Object.assign(exit.style,{position:'fixed',left:'50%',transform:'translateX(-50%)',bottom:'calc(132px + env(safe-area-inset-bottom))',zIndex:'1700',height:'46px',padding:'0 22px',border:'1px solid rgba(30,50,70,.18)',borderRadius:'14px',background:'rgba(255,255,255,.97)',color:'#17202b',fontWeight:'900',boxShadow:'0 4px 13px rgba(22,41,60,.15)'});exit.onclick=()=>{clearRuler();activeTool='';renderTools();msg('物差しを終了しました',1000)};document.body.appendChild(exit)}};ruler={start:null,end:null,line:null,onClick};"
    );

    return src;
  };
})();
