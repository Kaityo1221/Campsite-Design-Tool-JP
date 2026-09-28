(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);
    if(src.includes('cmV54CoordMemoReason'))return src;

    const old=`const cmV46Near=nearestRecord(r.latlng,r.id);if(cmV46Near&&cmV46Near.distance<50){const reason=document.createElement('label');reason.className='cm-v46-reason';reason.innerHTML='<span>理由</span><textarea class="cm-v46-reason-input" placeholder="この候補地を選んだ理由を入力"></textarea>';const reasonInput=reason.querySelector('textarea');reasonInput.value=String(r.memo||'');reasonInput.oninput=()=>{r.memo=reasonInput.value;snapshot();cmPersistCurrent()};card.appendChild(reason)}root.appendChild(card)});if(!cmActiveNew().length`;

    const replacement=`/* cmV54CoordMemoReason */const cmV54Memo=String(r.memo||'').trim();if(cmV54Memo){const memoLine=document.createElement('div');memoLine.className='cm-v54-memo';memoLine.innerHTML='<strong>メモ</strong><span>'+esc(cmV54Memo)+'</span>';card.appendChild(memoLine)}const cmV46Near=nearestRecord(r.latlng,r.id);if(cmV46Near&&cmV46Near.distance<50){const reason=document.createElement('label');reason.className='cm-v46-reason';reason.innerHTML='<span>理由</span><textarea class="cm-v46-reason-input" placeholder="この候補地を選んだ理由を入力"></textarea>';const reasonInput=reason.querySelector('textarea');reasonInput.value=String(r.applicationComment||'');reasonInput.oninput=()=>{r.applicationComment=reasonInput.value.slice(0,300);try{if(typeof jpIssueSignature==='function'){r.applicationCommentSignature=jpIssueSignature(r);r.applicationCommentNeedsReview=false}}catch{}snapshot();cmPersistCurrent();try{if(typeof renderJpGuide==='function')renderJpGuide()}catch{}};card.appendChild(reason)}root.appendChild(card)});if(!cmActiveNew().length`;

    if(src.includes(old))src=src.replace(old,replacement);

    const style=`<style id="cmV54CoordMemoReasonStyle">
      .cm-v54-memo{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:start;padding:9px 0;border-top:1px solid #f0e6d5;font-size:12px;line-height:1.5}
      .cm-v54-memo strong{color:#6f604c;font-weight:900}
      .cm-v54-memo span{color:#382d1d;font-weight:800;word-break:break-word}
    </style>`;
    if(!src.includes('id="cmV54CoordMemoReasonStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
