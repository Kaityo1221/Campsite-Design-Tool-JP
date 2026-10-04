(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // Preview-only asset base: generated Creative HTML lives under /creative-preview-312/.
    src=src.split('./assets/').join('../creative/assets/');

    // Preview-only: replace the legacy double-ring existing marker renderer with the
    // current visual contract. New candidates remain owned by Creative's candidate UI.
    const iconStart=src.indexOf('function recordIcon(r){');
    const iconEnd=iconStart>=0?src.indexOf('\nfunction drawRecord(r){',iconStart):-1;
    if(iconStart>=0&&iconEnd>iconStart){
      const replacement=`function recordIcon(r){
  const layer=String(r?.layer||'').toLowerCase();
  if(layer.startsWith('new-')){
    const pin={
      'new-pokestop':'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
      'new-gym':'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
      'new-power':'https://maps.google.com/mapfiles/ms/icons/purple-dot.png'
    }[layer];
    if(pin)return L.icon({iconUrl:pin,iconSize:[32,32],iconAnchor:[16,32],popupAnchor:[0,-30]});
  }
  const inactive=layer==='existing-power'&&String(r?.gameStatus||'').toUpperCase()==='INACTIVE';
  let shape='cm-v72-stop';
  if(layer.includes('gym'))shape='cm-v72-gym';
  else if(layer.includes('power'))shape=inactive?'cm-v72-inactive':'cm-v72-power';
  return L.divIcon({
    className:'cm-v72-map-icon',
    html:'<div class="cm-v72-icon-wrap"><span class="'+shape+'"></span></div>',
    iconSize:[34,34],
    iconAnchor:[17,17],
    popupAnchor:[0,-17]
  });
}`;
      src=src.slice(0,iconStart)+replacement+src.slice(iconEnd);
    }

    // Preview-only save chooser sizing and help collision guard.
    src=src.replace(
      "function closeSaveChooser(){if(saveChooser){saveChooser.remove();saveChooser=null}}",
      "function closeSaveChooser(){if(saveChooser){saveChooser.remove();saveChooser=null}try{document.body.classList.remove('cm-save-chooser-open')}catch{}}"
    );
    src=src.replace(
      "function showSaveChooser(blob,filename){closeSaveChooser();const wrap=document.createElement('div'),choose=document.createElement('button'),download=document.createElement('button'),close=document.createElement('button');",
      "function showSaveChooser(blob,filename){closeSaveChooser();try{document.body.classList.add('cm-save-chooser-open')}catch{}const wrap=document.createElement('div'),choose=document.createElement('button'),download=document.createElement('button'),close=document.createElement('button');wrap.id='cmV72SaveChooser';"
    );
    src=src.replace(
      "gap:'8px',alignItems:'center',padding:'8px',borderRadius:'16px'",
      "gap:'7px',alignItems:'center',padding:'7px',borderRadius:'14px'"
    );
    src=src.replace(
      "minWidth:'168px',height:'52px',padding:'0 16px'",
      "minWidth:'143px',height:'44px',padding:'0 14px'"
    );
    src=src.replace("fontWeight:'950',fontSize:'16px'","fontWeight:'950',fontSize:'14px'");
    src=src.replace(
      "width:'112px',height:'46px',border:'2px solid #8a6b31',borderRadius:'14px',background:'rgba(255,253,247,.96)',color:'#5d4630',fontWeight:'950',fontSize:'14px',whiteSpace:'nowrap',boxSizing:'border-box',padding:'0 10px'",
      "width:'96px',height:'44px',border:'2px solid #8a6b31',borderRadius:'12px',background:'rgba(255,253,247,.96)',color:'#5d4630',fontWeight:'950',fontSize:'12px',whiteSpace:'nowrap',boxSizing:'border-box',padding:'0 8px'"
    );
    src=src.replace(
      "width:'46px',height:'46px',border:'2px solid #8a6b31',borderRadius:'14px',background:'rgba(255,253,247,.96)',color:'#5d4630',fontWeight:'950',fontSize:'24px'",
      "width:'44px',height:'44px',border:'2px solid #8a6b31',borderRadius:'12px',background:'rgba(255,253,247,.96)',color:'#5d4630',fontWeight:'950',fontSize:'20px'"
    );

    const style=`<style id="cmV72PreviewVisualStyle">
      :root{--cm-v72-blue:#1677ff;--cm-v72-red:#ef4444;--cm-v72-purple:#8b35e8;--cm-v72-pink:#f3a8c9}

      /* Existing POI visual contract: no legacy double ring. */
      .cm-v72-map-icon{background:transparent!important;border:0!important}
      .cm-v72-icon-wrap{width:34px;height:34px;display:grid;place-items:center;filter:drop-shadow(0 2px 3px rgba(0,0,0,.24))}
      .cm-v72-stop{width:18px;height:18px;border-radius:50%;background:var(--cm-v72-blue);border:3px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.20)}
      .cm-v72-gym{position:relative;width:25px;height:25px;display:grid;place-items:center;clip-path:polygon(25% 4%,75% 4%,100% 50%,75% 96%,25% 96%,0 50%);background:#fff}
      .cm-v72-gym:after{content:"";width:20px;height:20px;clip-path:inherit;background:var(--cm-v72-red)}
      .cm-v72-power,.cm-v72-inactive{width:20px;height:20px;transform:rotate(45deg);border:3px solid #fff;border-radius:3px;box-shadow:0 2px 4px rgba(0,0,0,.20)}
      .cm-v72-power{background:var(--cm-v72-purple)}
      .cm-v72-inactive{background:var(--cm-v72-pink)}

      /* Unified renderer uses the v45 shape classes. Align them to the same contract. */
      .cm-v45-stop{background:var(--cm-v72-blue)!important;box-shadow:0 2px 4px rgba(0,0,0,.20)!important}
      .cm-v45-power{background:var(--cm-v72-purple)!important;box-shadow:0 2px 4px rgba(0,0,0,.20)!important}
      .cm-v45-inactive{background:var(--cm-v72-pink)!important;box-shadow:0 2px 4px rgba(0,0,0,.20)!important}

      /* About 15% visual reduction for floating editor UI. */
      #back{transform:scale(.85)!important;transform-origin:top left!important}
      #mapToggle,#layerButton{transform:scale(.85)!important;transform-origin:top right!important}
      #cmV59HelpButton,#cmStandaloneSaveButton{
        width:44px!important;height:44px!important;border-radius:12px!important;font-size:20px!important
      }
      .toolbox{width:46px!important;height:46px!important;border-radius:12px!important;font-size:20px!important}
      .cm-fab-wrap{width:48px!important;height:48px!important}
      .cm-add-fab{font-size:30px!important}
      .cm-bubble{left:4px!important;top:4px!important;width:40px!important;height:40px!important}
      .cm-bubble img{width:29px!important;height:29px!important}
      .cm-fab-wrap.open .cm-bubble[data-layer="new-pokestop"]{transform:translate(-49px,-49px) scale(1)!important}
      .cm-fab-wrap.open .cm-bubble[data-layer="new-gym"]{transform:translate(0,-66px) scale(1)!important}
      .cm-fab-wrap.open .cm-bubble[data-layer="new-power"]{transform:translate(49px,-49px) scale(1)!important}
      .cm-selected-type{width:22px!important;height:22px!important}
      .cm-selected-type img{width:18px!important;height:18px!important}
      .bottom-bar button{min-height:48px!important;font-size:85%!important}
      #cmStandaloneSaveMenu{transform:scale(.85)!important;transform-origin:bottom left!important}
      .left-hand #cmStandaloneSaveMenu{transform-origin:bottom right!important}
      body.cm-save-chooser-open #cmV59HelpButton{display:none!important}
      #cmV72SaveChooser{max-width:calc(100vw - 20px)!important}
    </style>`;
    if(!src.includes('id="cmV72PreviewVisualStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
