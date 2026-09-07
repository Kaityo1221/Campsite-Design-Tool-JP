(()=>{
  'use strict';

  // Lightweight design backfill adapter.
  // IMPORTANT: disabled until the production Supabase receiver is explicitly approved.
  // This file never uploads KMZ/KML binary data.
  const ENABLED=false;
  const ENDPOINT='';
  const RUNTIME_WRITE_NEEDLE='document.open();document.write(html);document.close();';

  const helper=`
const CREATIVE_DESIGN_BACKFILL_ENABLED=${ENABLED};
const CREATIVE_DESIGN_BACKFILL_ENDPOINT=${JSON.stringify(ENDPOINT)};
function creativeDesignBackfillPayload(){
  const active=(records||[]).filter(r=>r&&!r.deleted);
  const polys=(polygons||[]).filter(p=>p&&!p.deleted&&Array.isArray(p.points));
  return {
    schema_version:1,
    source_type:'creative_mode',
    park_name:typeof creativeParkName==='function'?creativeParkName():String(sourceName||'campsite'),
    anonymous_device_id:typeof creativeDeviceId==='function'?creativeDeviceId():null,
    poi_count:active.length,
    existing_poi_count:active.filter(r=>String(r.layer||'').startsWith('existing-')).length,
    added_poi_count:active.filter(r=>String(r.layer||'').startsWith('new-')).length,
    pois:active.map(r=>({id:String(r.id||''),name:String(r.title||''),layer:String(r.layer||''),lat:Number(r.latlng?.[0]),lng:Number(r.latlng?.[1]),memo:String(r.memo||''),application_comment:String(r.applicationComment||'')})),
    polygons:polys.map(p=>({id:String(p.id||''),points:p.points.map(x=>({lat:Number(x[0]),lng:Number(x[1])}))})),
    saved_at:new Date().toISOString()
  };
}
async function sendCreativeDesignBackfill(){
  if(!CREATIVE_DESIGN_BACKFILL_ENABLED||!CREATIVE_DESIGN_BACKFILL_ENDPOINT)return;
  try{
    const payload=creativeDesignBackfillPayload();
    if(typeof creativeHash==='function')payload.design_fingerprint=await creativeHash(creativeCanonicalDesign());
    await fetch(CREATIVE_DESIGN_BACKFILL_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),keepalive:true});
  }catch(e){console.warn('creative design backfill skipped',e)}
}
`;

  const runtimePatch=[
    'const creativeDesignBackfillHelper='+JSON.stringify(helper)+';',
    "if(html.includes('async function exportKmz(){'))html=html.replace('async function exportKmz(){',creativeDesignBackfillHelper+'async function exportKmz(){void sendCreativeDesignBackfill();');"
  ].join('\n');

  window.applyCreativeDesignBackfillPatch=src=>{
    if(typeof src!=='string'||!src.includes(RUNTIME_WRITE_NEEDLE))return src;
    return src.replace(RUNTIME_WRITE_NEEDLE,runtimePatch+RUNTIME_WRITE_NEEDLE);
  };
})();
