/*
 * NON-PRODUCTION: source-verified distance-circle dependencies.
 * Pure geometry, no storage, UI, POI IDs or source KML mutations.
 */
const PREFIX='campsite.creative.';
const R=6378137;
function stop(code,message){const e=new Error(message);e.code=code;throw e;}
const value=(place,name)=>{
  const matches=(place.data||[]).filter(d=>d.name===PREFIX+name);
  return matches.length===1?matches[0].value:null;
};
function finite(v,lo,hi){return Number.isFinite(v)&&v>=lo&&v<=hi;}

/* Return a full, checked index of circle dependencies. Absence is not assumed.
 * Every circle must have one known owner and a verified ring.
 */
export function indexDependentCircles(stage){
  if(!stage?.places||!Array.isArray(stage.places))stop('CIRCLE_SOURCE','Verified staged source required');
  const owners=new Map();
  for(const p of stage.places){
    if(p.geometry!=='Point')continue;
    const id=value(p,'id');if(!id||owners.has(id))stop('CIRCLE_OWNER','Unresolvable point identity');
    owners.set(id,p);
  }
  const result=new Map(),unique=new Set();
  for(let i=0;i<stage.places.length;i++){
    const p=stage.places[i];if(value(p,'object')!=='distance-circle')continue;
    const id=value(p,'circle-owner-id'),radius=Number(value(p,'circle-radius'));
    if(!id||!owners.has(id)||![30,40,50].includes(radius)||p.geometry!=='Polygon'||p.circleValid!==true||
       p.polygonValid!==true||p.polygonGeometry?.hasHoles===true||p.polygonGeometry?.points?.length!==49)
      stop('CIRCLE_SOURCE','Circle geometry or owner is not verified');
    const key=id+'\0'+radius;
    if(unique.has(key))stop('CIRCLE_DUPLICATE','Repeated owner/radius circle');
    unique.add(key);
    const item={index:i,ownerId:id,radius,place:p};
    result.set(id,[...(result.get(id)||[]),item]);
  }
  return result;
}

/* Regenerate a circular ring with the very same spherical construction as
 * legacy Creative Mode. Keep unchanged rings as-is elsewhere; this routine
 * is only called for explicitly moved owners. Altitude-bearing sources HOLD.
 */
export function circleRingAt(lat,lng,radius){
  if(!finite(lat,-90,90)||!finite(lng,-180,180)||![30,40,50].includes(radius)||Math.abs(lat)>89.9)
    stop('CIRCLE_POSITION','The requested circle centre is not safely representable');
  const phi=lat*Math.PI/180,lambda=lng*Math.PI/180,d=radius/R;
  const pts=[];
  for(let i=0;i<=48;i++){
    const bearing=2*Math.PI*i/48;
    const a=Math.asin(Math.sin(phi)*Math.cos(d)+Math.cos(phi)*Math.sin(d)*Math.cos(bearing));
    const b=lambda+Math.atan2(Math.sin(bearing)*Math.sin(d)*Math.cos(phi),Math.cos(d)-Math.sin(phi)*Math.sin(a));
    const coord=[b*180/Math.PI,a*180/Math.PI];
    if(!finite(coord[0],-180,180)||!finite(coord[1],-90,90))stop('CIRCLE_POSITION','Circle crosses world coordinate bounds');
    pts.push(`${coord[0].toFixed(7)},${coord[1].toFixed(7)},0`);
  }
  // Exact coordinate-string closure, not merely numerical equality.
  pts[48]=pts[0];
  return pts.join(' ');
}

export function circleOverlay(stage,records){
  const byId=new Map(records.map(r=>[r.id,r]));
  const idx=indexDependentCircles(stage);const out=[];
  for(const [id,items] of idx){
    const owner=byId.get(id);if(!owner)stop('CIRCLE_OWNER','Circle owner missing in active POI store');
    if(owner.deleted)continue;
    if(!finite(owner.lat,-90,90)||!finite(owner.lng,-180,180))stop('CIRCLE_POSITION','Invalid owner position');
    for(const {radius} of items)out.push({ownerId:id,lat:owner.lat,lng:owner.lng,radius});
  }
  return out;
}
