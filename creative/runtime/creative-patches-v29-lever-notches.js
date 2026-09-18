(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // CREATIVE MODE v29: make the radius control feel like a real 3-stop vertical lever.
    // 50m = top, 40m = middle, 30m = bottom. Keep the thin bar itself compact.
    src=src.replace(
      "return ((50-r)/20)*24-12;",
      "return ((50-r)/20)*44-22;"
    );

    const style=`<style id="cmV29LeverNotchStyle">
      .cm-radius-gauge{
        overflow:visible!important;
        padding-left:46px!important;
      }
      .cm-radius-gauge-head.cm-radius-gauge-compact{
        position:relative!important;
        grid-template-columns:40px 62px 16px!important;
        gap:4px!important;
      }
      .cm-radius-hint{
        position:absolute!important;
        left:-82px!important;
        top:50%!important;
        width:74px!important;
        height:96px!important;
        transform:translateY(-50%)!important;
        border:0!important;
        border-radius:20px!important;
        background:transparent!important;
        box-shadow:none!important;
        opacity:1!important;
        display:block!important;
        padding:0!important;
        overflow:visible!important;
        touch-action:none!important;
        cursor:ns-resize!important;
        z-index:5!important;
      }
      .cm-radius-hint::before{
        content:''!important;
        position:absolute!important;
        left:42px!important;
        top:50%!important;
        width:5px!important;
        height:58px!important;
        transform:translate(-50%,-50%)!important;
        border-radius:999px!important;
        background:
          linear-gradient(to bottom,
            rgba(93,81,65,.20) 0,
            rgba(93,81,65,.20) 100%)!important;
        box-shadow:
          0 -22px 0 -1px rgba(93,81,65,.42),
          0 0 0 -1px rgba(93,81,65,.42),
          0 22px 0 -1px rgba(93,81,65,.42),
          inset 0 0 0 1px rgba(93,81,65,.08),
          0 1px 3px rgba(255,255,255,.38)!important;
        pointer-events:none!important;
      }
      .cm-radius-hint::after{
        content:'50\A 40\A 30'!important;
        white-space:pre!important;
        position:absolute!important;
        left:0!important;
        top:12px!important;
        width:24px!important;
        height:72px!important;
        color:rgba(83,70,49,.68)!important;
        font-size:10px!important;
        font-weight:900!important;
        line-height:24px!important;
        text-align:right!important;
        letter-spacing:-.2px!important;
        pointer-events:none!important;
      }
      .cm-radius-hint>span{
        position:absolute!important;
        left:42px!important;
        top:50%!important;
        width:36px!important;
        height:36px!important;
        margin:-18px 0 0 -18px!important;
        border-radius:50%!important;
        background:rgba(255,253,247,.98)!important;
        border:2px solid rgba(138,107,49,.28)!important;
        box-shadow:
          0 4px 10px rgba(0,0,0,.20),
          inset 0 0 0 7px rgba(216,183,102,.13)!important;
        transform:translateY(var(--cm-lever-y,-22px))!important;
        transition:transform .13s cubic-bezier(.2,.8,.25,1),box-shadow .12s ease,background .12s ease!important;
        pointer-events:none!important;
      }
      .cm-radius-hint.dragging{
        transform:translateY(-50%)!important;
        background:transparent!important;
      }
      .cm-radius-hint.dragging>span{
        transition:none!important;
        background:#fffdf7!important;
        box-shadow:
          0 5px 14px rgba(0,0,0,.28),
          0 0 0 5px rgba(216,183,102,.18),
          inset 0 0 0 7px rgba(216,183,102,.16)!important;
      }
    </style>`;
    if(!src.includes('id="cmV29LeverNotchStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
