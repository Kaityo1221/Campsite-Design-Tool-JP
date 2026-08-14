(() => {
  'use strict';

  let active=false;
  let startPoint=null;
  let startMarker=null;
  let measureLine=null;
  let controls=null;
  let badge=null;
  let initialized=false;
  const spacing=window.CampsitePoiSpacingPolicy;
  const targetDistance=spacing.targetMeters;

  function bandForDistance(distance){
    return spacing.distanceBand(distance);
  }

  function centerLatLng(){
    const center=map.getCenter();
    return [center.lat,center.lng];
  }

  function ensureUi(){
    if(!controls){
      controls=document.createElement('div');
      controls.id='fieldModeDistanceActions';
      Object.assign(controls.style,{
        display:'none',position:'fixed',left:'50%',bottom:'var(--field-action-bottom)',
        transform:'translateX(-50%)',width:'min(calc(100% - 24px), 520px)',gridTemplateColumns:'1fr',gap:'8px',
        padding:'8px',border:'1px solid rgba(73,57,30,.24)',borderRadius:'16px',background:'rgba(59,49,37,.94)',
        boxShadow:'0 5px 16px rgba(0,0,0,.22)',backdropFilter:'blur(8px)',zIndex:'1200'
      });
      controls.innerHTML=`
        <button type="button" data-distance-action="start">📍 始点を置く</button>
        <button type="button" data-distance-action="exit">× 計測をやめる</button>`;
      controls.querySelectorAll('button').forEach(button=>Object.assign(button.style,{
        minHeight:'46px',border:'1px solid #b89a57',borderRadius:'12px',background:'rgba(255,248,230,.97)',
        color:'#49391e',fontWeight:'900'
      }));
      controls.addEventListener('click',event=>{
        const action=event.target.closest('[data-distance-action]')?.dataset.distanceAction;
        if(action==='start')placeStart();
        if(action==='exit')window.FieldModeToolReturn?.toToolbox?.();
      });
      document.body.appendChild(controls);
    }

    if(!badge){
      badge=document.createElement('div');
      badge.id='fieldModeMeasureBadge';
      Object.assign(badge.style,{
        display:'none',position:'fixed',top:'calc(74px + env(safe-area-inset-top))',left:'50%',transform:'translateX(-50%)',
        minWidth:'124px',padding:'9px 14px',borderRadius:'999px',background:'rgba(255,255,255,.96)',border:'2px solid #7a8b9b',
        color:'#31404e',fontSize:'15px',fontWeight:'900',textAlign:'center',boxShadow:'0 4px 14px rgba(0,0,0,.16)',zIndex:'1210',
        pointerEvents:'none'
      });
      document.body.appendChild(badge);
    }
    return controls;
  }

  function removeMeasureLayers(){
    if(startMarker&&dataLayer.hasLayer(startMarker))dataLayer.removeLayer(startMarker);
    if(measureLine&&dataLayer.hasLayer(measureLine))dataLayer.removeLayer(measureLine);
    startMarker=null;
    measureLine=null;
  }

  function setBadge(distance){
    if(!badge)return;
    if(!Number.isFinite(distance)){
      badge.textContent='始点を置いてください';
      badge.dataset.distanceBand='waiting';
      badge.style.borderColor='#7a8b9b';
      badge.style.color='#31404e';
      badge.style.background='rgba(255,255,255,.96)';
      return;
    }
    badge.textContent=`📏 ${distance.toFixed(1)} m`;
    const band=bandForDistance(distance);
    badge.dataset.distanceBand=band;
    if(band==='danger'){
      badge.style.borderColor='#c94b43';
      badge.style.color='#8e2924';
      badge.style.background='rgba(255,235,231,.98)';
    }else if(band==='caution'){
      badge.style.borderColor='#dc881f';
      badge.style.color='#815000';
      badge.style.background='rgba(255,243,216,.98)';
    }else if(band==='near'){
      badge.style.borderColor='#d99b22';
      badge.style.color='#805500';
      badge.style.background='rgba(255,248,220,.98)';
    }else{
      badge.style.borderColor='#68a55c';
      badge.style.color='#35652e';
      badge.style.background='rgba(246,255,244,.98)';
    }
  }

  function redraw(){
    if(!active||!startPoint)return;
    const end=centerLatLng();
    const distance=map.distance(L.latLng(startPoint[0],startPoint[1]),L.latLng(end[0],end[1]));
    if(measureLine&&dataLayer.hasLayer(measureLine))dataLayer.removeLayer(measureLine);
    const color={danger:'#c94b43',caution:'#dc881f',near:'#d2aa36',ok:'#4d8f45'}[bandForDistance(distance)];
    measureLine=L.polyline([startPoint,end],{
      pane:'fieldPoiPane',color,weight:4,opacity:.9,dashArray:'8 6',interactive:false
    }).addTo(dataLayer);
    setBadge(distance);
    selectionTitle.textContent='📏 距離を計測中';
    selectionDetail.textContent=`始点から中央の十字まで ${distance.toFixed(1)}m。地図を動かすとリアルタイムで変わります。`;
  }

  function placeStart(){
    if(!active)return;
    startPoint=centerLatLng();
    removeMeasureLayers();
    startMarker=L.circleMarker(startPoint,{
      pane:'fieldPoiPane',radius:6,weight:3,color:'#4d5d6b',fillColor:'#fff',fillOpacity:1,interactive:false
    }).addTo(dataLayer);
    controls.querySelector('[data-distance-action="start"]').textContent='↻ 始点を置き直す';
    modeStatus.textContent='距離計測中';
    redraw();
  }

  function begin(){
    if(!fileLoaded)return;
    active=true;
    startPoint=null;
    removeMeasureLayers();
    resetPoiSelection();
    window.FieldCreative?.selectTool('distance',{collapse:false});
    window.FieldCreative?.closeMenu();
    crosshair.style.display='block';
    ensureUi().style.display='grid';
    badge.style.display='block';
    controls.querySelector('[data-distance-action="start"]').textContent='📍 始点を置く';
    setBadge(NaN);
    selectionTitle.textContent='📏 距離を測る';
    selectionDetail.textContent='中央の十字を始点に合わせて「📍 始点を置く」。その後は地図を動かすだけで距離が変わります。';
    modeStatus.textContent='距離ツール';
  }

  function cancel(){
    if(!active)return;
    active=false;
    startPoint=null;
    removeMeasureLayers();
    if(controls)controls.style.display='none';
    if(badge)badge.style.display='none';
    crosshair.style.display='none';
    selectionTitle.textContent='追加予定POIを選択してください';
    selectionDetail.textContent='地図上の黄色い追加予定POIをタップしてください。';
  }

  function init(){
    if(initialized||!window.FieldCreative)return false;
    const button=document.querySelector('#fieldModeCreativeHotbar [data-tool="distance"]');
    if(!button)return false;
    initialized=true;
    button.disabled=false;
    button.classList.remove('is-coming');
    button.title='始点から地図中央の十字までの距離をリアルタイム計測';
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      begin();
    });
    return true;
  }

  map.on('move',redraw);
  window.addEventListener('fieldcreativecancel',cancel);
  const timer=setInterval(()=>{if(init())clearInterval(timer);},0);
  setTimeout(()=>clearInterval(timer),5000);

  window.FieldModeDistance={begin,cancel,isActive:()=>active,bandForDistance};
})();
