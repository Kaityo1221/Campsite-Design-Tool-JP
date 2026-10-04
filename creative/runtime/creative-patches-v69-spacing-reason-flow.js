(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const memoBlock="+'<div class=\"cm-field\"><label>メモ（50文字まで）</label><textarea id=\"cmMemo\" maxlength=\"50\">'+esc(r.memo||'')+'</textarea></div><div class=\"cm-actions\">";
    const reasonBlock="+'<div class=\"cm-field\"><label>メモ（50文字まで）</label><textarea id=\"cmMemo\" maxlength=\"50\">'+esc(r.memo||'')+'</textarea></div>'+(warn?'<div class=\"cm-field cm-spacing-reason\"><label>設置理由（50m未満・300文字まで）</label><textarea id=\"cmSpacingReason\" maxlength=\"300\" placeholder=\"ここに設置したい理由を入力\">'+esc(r.applicationComment||'')+'</textarea><div class=\"cm-spacing-reason-count\"><span id=\"cmSpacingReasonCount\">'+String(r.applicationComment||'').length+'</span> / 300</div></div>':'')+'<div class=\"cm-actions\">";
    if(src.includes(memoBlock))src=src.replace(memoBlock,reasonBlock);

    const bindNeedle="const name=sheet.querySelector('#cmName'),memo=sheet.querySelector('#cmMemo');name.oninput=";
    const bindReplacement="const name=sheet.querySelector('#cmName'),memo=sheet.querySelector('#cmMemo'),spacingReason=sheet.querySelector('#cmSpacingReason'),spacingReasonCount=sheet.querySelector('#cmSpacingReasonCount');if(spacingReason){spacingReason.oninput=()=>{r.applicationComment=spacingReason.value.slice(0,300);spacingReason.value=r.applicationComment;if(spacingReasonCount)spacingReasonCount.textContent=String(r.applicationComment.length);try{if(typeof jpIssueSignature==='function'){r.applicationCommentSignature=jpIssueSignature(r);r.applicationCommentNeedsReview=!String(r.applicationComment||'').trim()}}catch{}snapshot();cmPersistCurrent();try{if(typeof renderJpGuide==='function')renderJpGuide()}catch{}}};name.oninput=";
    if(src.includes(bindNeedle))src=src.replace(bindNeedle,bindReplacement);

    const style=`<style id="cmV69SpacingReasonStyle">
      .cm-spacing-reason{padding:9px 10px;border:1px solid rgba(185,101,41,.24);border-radius:12px;background:rgba(255,244,230,.78)}
      .cm-spacing-reason label{color:#8a4b23}
      .cm-spacing-reason-count{text-align:right;color:#8b7a62;font-size:10px;font-weight:800}
    </style>`;
    if(!src.includes('id="cmV69SpacingReasonStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
