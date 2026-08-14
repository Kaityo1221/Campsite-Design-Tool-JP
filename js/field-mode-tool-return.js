(() => {
  'use strict';

  let poiCancelButton=null;
  let adjustCancelButton=null;
  let eraserCancelButton=null;

  function toolbox(){return window.FieldCreative;}
  function activeTool(){return toolbox()?.activeTool?.()||null;}

  function cancelAdjustTransient(){
    if(activeTool()!=='adjust')return;
    let tuning=false;
    try{tuning=!!fineTuneMode;}catch(_){tuning=false;}
    if(tuning){
      const button=document.getElementById('fieldModeFineTuneButton');
      button?.click();
    }
  }

  function returnToToolbox(){
    const creative=toolbox();
    if(!creative)return false;
    cancelAdjustTransient();
    creative.openMenu?.();
    return true;
  }

  function applyButtonStyle(button){
    Object.assign(button.style,{
      minHeight:'44px',
      border:'1px solid #b89a57',
      borderRadius:'12px',
      background:'rgba(255,248,230,.97)',
      color:'#49391e',
      fontWeight:'900'
    });
  }

  function ensureAdjustCancel(){
    if(adjustCancelButton?.isConnected)return;
    const actions=document.querySelector('.field-mode-adjust-actions');
    if(!actions)return;
    let button=document.getElementById('fieldModeAdjustCancel');
    if(!button){
      button=document.createElement('button');
      button.id='fieldModeAdjustCancel';
      button.type='button';
      button.textContent='× 位置調整をやめる';
      button.style.gridColumn='1 / -1';
      applyButtonStyle(button);
      button.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        returnToToolbox();
      });
      actions.appendChild(button);
    }
    adjustCancelButton=button;
  }

  function ensurePoiCancel(){
    if(poiCancelButton?.isConnected)return;
    let button=document.getElementById('fieldModePoiToolCancel');
    if(!button){
      button=document.createElement('button');
      button.id='fieldModePoiToolCancel';
      button.type='button';
      button.textContent='× 設置中止';
      Object.assign(button.style,{
        display:'none',
        position:'fixed',
        left:'12px',
        bottom:'var(--field-action-bottom)',
        width:'min(124px, calc(50% - 22px))',
        minHeight:'42px',
        zIndex:'1175',
        border:'1px solid #b89a57',
        borderRadius:'14px',
        background:'rgba(255,248,230,.97)',
        color:'#49391e',
        fontWeight:'900',
        boxShadow:'0 4px 12px rgba(0,0,0,.16)'
      });
      button.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        returnToToolbox();
      });
      document.body.appendChild(button);
    }
    poiCancelButton=button;
  }

  function ensureEraserCancel(){
    const actions=document.getElementById('fieldModeEraserActions');
    if(!actions)return;
    if(eraserCancelButton?.isConnected)return;
    let button=actions.querySelector('[data-eraser-action="exit"]');
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.dataset.eraserAction='exit';
      button.textContent='× 消去をやめる';
      button.style.gridColumn='1 / -1';
      applyButtonStyle(button);
      button.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        returnToToolbox();
      });
      actions.appendChild(button);
    }
    eraserCancelButton=button;
  }

  function normalizeAreaCancel(){
    const button=document.querySelector('[data-area-action="cancel"]');
    if(button&&button.textContent!=='× 範囲作成をやめる')button.textContent='× 範囲作成をやめる';
  }

  function sync(){
    if(!toolbox())return;
    ensureAdjustCancel();
    ensurePoiCancel();
    ensureEraserCancel();
    normalizeAreaCancel();
    if(poiCancelButton){
      const shouldShow=activeTool()==='poi'&&!document.body.classList.contains('field-creative-menu-open');
      const next=shouldShow?'block':'none';
      if(poiCancelButton.style.display!==next)poiCancelButton.style.display=next;
    }
  }

  document.addEventListener('click',event=>{
    const areaCancel=event.target.closest?.('[data-area-action="cancel"]');
    if(!areaCancel||activeTool()!=='area')return;
    event.preventDefault();
    event.stopImmediatePropagation();
    returnToToolbox();
  },true);

  const observer=new MutationObserver(sync);
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  setInterval(sync,300);
  sync();

  window.FieldModeToolReturn={toToolbox:returnToToolbox};
})();
