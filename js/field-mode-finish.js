(() => {
  'use strict';

  const body=document.body;
  const saveRow=document.querySelector('.field-save-row');
  const saveButton=document.getElementById('fieldModeSaveButton');
  const saveNote=document.getElementById('fieldModeSaveNote');
  if(!body||!saveRow||!saveButton)return;

  const style=document.createElement('style');
  style.textContent=`
    .field-mode-finish-ready .field-save-row{
      position:fixed;
      left:10px;
      right:10px;
      bottom:var(--field-action-bottom);
      z-index:1080;
      width:min(calc(100% - 20px),540px);
      margin:0 auto;
      padding:8px;
      border:1px solid rgba(73,57,30,.24);
      border-radius:16px;
      background:rgba(255,250,240,.94);
      box-shadow:0 7px 22px rgba(47,42,34,.22);
      backdrop-filter:blur(12px);
      -webkit-backdrop-filter:blur(12px);
    }
    .field-mode-finish-ready .field-save-button{
      min-height:48px;
      border-color:#47725c;
      background:#47725c;
      color:#fff;
      font-size:14px;
      box-shadow:0 3px 10px rgba(49,83,64,.22);
    }
    .field-mode-finish-ready .field-save-note{margin:5px 4px 0;font-size:10px}
    .field-creative-active .field-save-row{display:none!important}
  `;
  document.head.appendChild(style);

  function sync(){
    const ready=!saveButton.disabled;
    body.classList.toggle('field-mode-finish-ready',ready);
    saveButton.textContent='完成KMZを保存';
    saveButton.setAttribute('aria-label','完成KMZを端末へ保存');
    if(saveNote){
      saveNote.textContent=ready
        ?'現地での変更をまとめて端末に保存します。'
        :'変更があると完成KMZを保存できます。';
    }
  }

  new MutationObserver(sync).observe(saveButton,{attributes:true,attributeFilter:['disabled']});
  sync();

  window.FieldModeFinish={sync};
})();
