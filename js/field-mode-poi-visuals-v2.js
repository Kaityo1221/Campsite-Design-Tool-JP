(() => {
  'use strict';

  const STYLE_ID='fieldPoiVisualV2Style';
  const VISUAL_KEY='__fieldPoiVisualV2Kind';

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .field-poi-v2-icon{
        background:transparent!important;
        border:0!important;
      }
      .field-poi-v2-wrap{
        width:28px;
        height:28px;
        display:grid;
        place-items:center;
        filter:drop-shadow(0 2px 3px rgba(0,0,0,.28));
        pointer-events:none;
      }
      .field-poi-v2-stop{
        width:19px;
        height:19px;
        border:3px solid #fff;
        border-radius:50%;
        background:#1677ff;
        box-shadow:0 0 0 2px #0b5ed7;
      }
      .field-poi-v2-gym{
        position:relative;
        width:24px;
        height:24px;
        display:grid;
        place-items:center;
        clip-path:polygon(25% 4%,75% 4%,100% 50%,75% 96%,25% 96%,0 50%);
        background:#fff;
      }
      .field-poi-v2-gym::after{
        content:"";
        width:19px;
        height:19px;
        clip-path:inherit;
        background:#ef4444;
      }
      .field-poi-v2-power,
      .field-poi-v2-inactive{
        position:relative;
        width:21px;
        height:21px;
        transform:rotate(45deg);
        border:3px solid #fff;
        border-radius:3px;
      }
      .field-poi-v2-power{
        background:#8b35e8;
        box-shadow:0 0 0 2px #681fc1;
      }
      .field-poi-v2-inactive{
        background:#f8bfd8;
        box-shadow:0 0 0 2px #ee7fb0;
        opacity:.72;
      }
    `;
    document.head.appendChild(style);
  }

  function canonicalFolder(record){
    const raw=String(record?.folder||'').trim();
    const api=window.CampsitePoiLayerNames;
    if(api?.canonicalize)return api.canonicalize(raw);
    return raw;
  }

  function kindFor(record){
    if(!record||record.added)return null;
    if(record.bridgeReferenceKind==='INACTIVE_POWERSPOT'||record.gameStatus==='INACTIVE')return'inactive';
    const folder=canonicalFolder(record);
    if(/gym|ジム/i.test(folder))return'gym';
    if(/powerspot|power|パワー/i.test(folder))return'power';
    if(/pok[eé]?stop|ポケスト/i.test(folder))return'stop';
    return'stop';
  }

  function iconFor(kind){
    const className={stop:'field-poi-v2-stop',gym:'field-poi-v2-gym',power:'field-poi-v2-power',inactive:'field-poi-v2-inactive'}[kind]||'field-poi-v2-stop';
    return L.divIcon({
      className:'field-poi-v2-icon',
      html:`<span class="field-poi-v2-wrap"><span class="${className}"></span></span>`,
      iconSize:[28,28],
      iconAnchor:[14,14],
      popupAnchor:[0,-16]
    });
  }

  function restyleRangeCircle(record,kind){
    if(!record?.rangeCircle?.setStyle)return;
    const color={stop:'#1677ff',gym:'#ef4444',power:'#8b35e8',inactive:'#ee7fb0'}[kind]||'#1677ff';
    record.rangeCircle.setStyle({
      color,
      weight:1.5,
      opacity:.34,
      fillColor:color,
      fillOpacity:.018
    });
  }

  function replaceMarker(record,kind){
    if(!record?.marker||record[VISUAL_KEY]===kind)return;
    const old=record.marker;
    const latlng=Array.isArray(record.latlng)?record.latlng:old.getLatLng?.();
    if(!latlng)return;
    const popup=old.getPopup?.()||null;
    try{if(typeof dataLayer!=='undefined'&&dataLayer.hasLayer(old))dataLayer.removeLayer(old);}catch(_){}
    const marker=L.marker(latlng,{
      pane:'fieldPoiPane',
      icon:iconFor(kind),
      keyboard:false,
      riseOnHover:true,
      title:String(record.name||'')
    });
    if(popup)marker.bindPopup(popup);
    try{if(typeof dataLayer!=='undefined')marker.addTo(dataLayer);else marker.addTo(map);}catch(_){return;}
    record.marker=marker;
    record[VISUAL_KEY]=kind;
    restyleRangeCircle(record,kind);
  }

  function apply(){
    injectStyle();
    try{
      if(typeof poiRecords==='undefined'||!Array.isArray(poiRecords))return false;
      poiRecords.forEach(record=>{
        const kind=kindFor(record);
        if(kind)replaceMarker(record,kind);
      });
      return true;
    }catch(error){
      console.warn('Creative Mode POI visual refresh skipped',error);
      return false;
    }
  }

  const fileStatus=document.getElementById('fieldModeFileStatus');
  if(fileStatus){
    new MutationObserver(()=>requestAnimationFrame(apply)).observe(fileStatus,{childList:true,subtree:true,characterData:true});
  }
  window.addEventListener('fieldmodevisualrefresh',apply);
  window.FieldPoiVisualsV2=Object.freeze({apply,kindFor});

  const timer=setInterval(()=>{
    if(apply()&&typeof fileLoaded!=='undefined'&&fileLoaded)clearInterval(timer);
  },120);
  setTimeout(()=>clearInterval(timer),12000);
})();
