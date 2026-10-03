(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const style=`<style id="cmV61SavedSessionHintStyle">
      .entry .resume.show{
        position:relative!important;
        margin-top:44px!important;
      }
      .entry .resume.show::before{
        content:"↓ 前回のデータがあるみたい";
        position:absolute;
        left:50%;
        bottom:calc(100% + 8px);
        transform:translateX(-50%);
        display:block;
        width:max-content;
        max-width:calc(100vw - 52px);
        box-sizing:border-box;
        padding:8px 14px;
        border:1px solid rgba(255,232,128,.9);
        border-radius:999px;
        background:linear-gradient(180deg,rgba(109,78,10,.96),rgba(58,42,9,.96));
        color:#fff2a8;
        font-size:14px;
        font-weight:950;
        line-height:1.2;
        letter-spacing:.03em;
        text-align:center;
        white-space:nowrap;
        text-shadow:0 2px 7px rgba(0,0,0,.9);
        box-shadow:0 0 0 1px rgba(255,244,176,.22),0 0 24px rgba(245,197,53,.72),0 8px 20px rgba(0,0,0,.34);
        pointer-events:none;
        animation:cmV61SavedDataNudge 1.65s ease-in-out infinite;
      }
      @keyframes cmV61SavedDataNudge{
        0%,100%{transform:translate(-50%,0)}
        50%{transform:translate(-50%,3px);box-shadow:0 0 0 1px rgba(255,244,176,.28),0 0 34px rgba(245,197,53,.9),0 8px 20px rgba(0,0,0,.34)}
      }
      @media(max-width:520px){
        .entry .resume.show{margin-top:42px!important}
        .entry .resume.show::before{padding:8px 12px;font-size:13px}
      }
      @media(prefers-reduced-motion:reduce){
        .entry .resume.show::before{animation:none}
      }
    </style>`;
    if(!src.includes('id="cmV61SavedSessionHintStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
