(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const sheetTail="document.body.appendChild(sheet);cmSheet=sheet;cmSheetSwipe(sheet)}";
    if(src.includes(sheetTail)&&!src.includes('cmV69InstallSpacingReason')){
      const install=[
        "function cmV69InstallSpacingReason(sheet,r,warn){",
        "  if(!sheet||!r||!warn||!cmIsNew(r))return;",
        "  const actions=sheet.querySelector('.cm-actions');",
        "  if(!actions||sheet.querySelector('#cmSpacingReason'))return;",
        "  const field=document.createElement('div');",
        "  field.className='cm-field cm-spacing-reason';",
        "  const label=document.createElement('label');",
        "  label.textContent='設置理由（50m未満・300文字まで）';",
        "  const textarea=document.createElement('textarea');",
        "  textarea.id='cmSpacingReason';",
        "  textarea.maxLength=300;",
        "  textarea.placeholder='ここに設置したい理由を入力';",
        "  textarea.value=String(r.applicationComment||'');",
        "  const count=document.createElement('div');",
        "  count.className='cm-spacing-reason-count';",
        "  const countValue=document.createElement('span');",
        "  countValue.id='cmSpacingReasonCount';",
        "  countValue.textContent=String(textarea.value.length);",
        "  count.append(countValue,document.createTextNode(' / 300'));",
        "  field.append(label,textarea,count);",
        "  actions.before(field);",
        "  textarea.oninput=()=>{",
        "    r.applicationComment=textarea.value.slice(0,300);",
        "    textarea.value=r.applicationComment;",
        "    countValue.textContent=String(r.applicationComment.length);",
        "    try{if(typeof jpIssueSignature==='function'){r.applicationCommentSignature=jpIssueSignature(r);r.applicationCommentNeedsReview=!String(r.applicationComment||'').trim()}}catch{}",
        "    snapshot();cmPersistCurrent();",
        "    try{if(typeof renderJpGuide==='function')renderJpGuide()}catch{}",
        "  };",
        "}",
        ""
      ].join('\n');
      src=src.replace(sheetTail,"cmV69InstallSpacingReason(sheet,r,warn);"+sheetTail);
      const openRecordMarker='function cmOpenRecord(r){';
      if(src.includes(openRecordMarker))src=src.replace(openRecordMarker,install+openRecordMarker);
    }

    const style='<style id="cmV69SpacingReasonStyle">'+
      '.cm-spacing-reason{padding:9px 10px;border:1px solid rgba(185,101,41,.24);border-radius:12px;background:rgba(255,244,230,.78)}'+
      '.cm-spacing-reason label{color:#8a4b23}'+
      '.cm-spacing-reason-count{text-align:right;color:#8b7a62;font-size:10px;font-weight:800}'+
      '</style>';
    if(!src.includes('id="cmV69SpacingReasonStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
