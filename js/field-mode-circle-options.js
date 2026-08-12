(() => {
  'use strict';

  const selectionSection=document.querySelector('.field-mode-selection');
  if(!selectionSection)return;

  const style=document.createElement('style');
  style.textContent=`
    .field-circle-options{display:none;margin-top:10px;padding:10px 12px;border:1px solid #d2c39f;border-radius:12px;background:#fffaf0}
    .field-circle-options.active{display:block}
    .field-circle-options-title{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:900;color:#49391e}
    .field-circle-options-note{margin-top:5px;font-size:10px;line-height:1.45;color:#746957}
    .field-circle-toggle{width:100%;min-height:40px;margin-top:8px;border:1px solid #a88445;border-radius:11px;background:#fffdf7;color:#49391e;font-weight:900;font-size:12px}
    .field-circle-toggle.is-on{border-color:#a13f6a;background:#fff0f6;color:#7e294e}
  `;
  document.head.appendChild(style);

  const box=document.createElement('div');
  box.className='field-circle-options';
  box.innerHTML=`
    <div class="field-circle-options-title"><span>⭕ 距離円</span><span>40m 基本</span></div>
    <div class="field-circle-options-note">40m円は自動で保存します。30m調整円は必要な新規POIだけ追加してください。</div>
    <button id="fieldPoi30mToggle" class="field-circle-toggle" type="button">30m調整円：追加しない</button>
  `;

  const saveRow=selectionSection.querySelector('.field-save-row');
  if(saveRow)selectionSection.insertBefore(box,saveRow);
  else selectionSection.appendChild(box);

  const toggle=box.querySelector('#fieldPoi30mToggle');

  function render(){
    const active=!!selectedPoi?.added&&!!selectedPoi?.isNew&&!selectedPoi?.fieldDeleted;
    box.classList.toggle('active',active);
    if(!active){
      toggle.classList.remove('is-on');
      toggle.textContent='30m調整円：追加しない';
      return;
    }
    const on=!!selectedPoi.include30mCircle;
    toggle.classList.toggle('is-on',on);
    toggle.textContent=on?'30m調整円：追加する ✓':'30m調整円：追加しない';
  }

  toggle.addEventListener('click',()=>{
    if(!selectedPoi?.added||!selectedPoi?.isNew||selectedPoi.fieldDeleted)return;
    selectedPoi.include30mCircle=!selectedPoi.include30mCircle;
    render();
    updateSaveButton();
    modeStatus.textContent=selectedPoi.include30mCircle?'30m調整円を追加':'30m調整円を解除';
    window.FieldModeSession?.saveNow?.();
  });

  const originalSelectAddedPoi=selectAddedPoi;
  selectAddedPoi=function circleAwareSelectAddedPoi(record){
    const result=originalSelectAddedPoi(record);
    render();
    return result;
  };

  const originalResetPoiSelection=resetPoiSelection;
  resetPoiSelection=function circleAwareResetPoiSelection(...args){
    const result=originalResetPoiSelection(...args);
    render();
    return result;
  };

  render();
  window.FieldModeCircleOptions={render};
})();
