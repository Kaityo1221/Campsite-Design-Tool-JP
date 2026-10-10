/**
 * Phase U3-A: strictly read-only Creative Next -> original Creative map projection.
 * This does not load/patch original UI, use storage or touch user KMZ.
 * Follow engine.state() rather than maintaining a second mutable records store.
 */
const KIND=Object.freeze({pokestop:'pokestop',gym:'gym',power:'power'});
const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
function record(r){
 if(!r||typeof r.id!=='string'||!r.id||r.deleted===true)return null;
 if(!finite(r.lat,-90,90)||!finite(r.lng,-180,180))return null;
 const kind=String(r.kind||r.type||'').toLowerCase();
 if(!(kind in KIND))return null;
 return Object.freeze({
  id:r.id,
  title:String(r.title||r.name||''),
  kind:KIND[kind],
  layer:KIND[kind],
  latlng:Object.freeze([r.lat,r.lng]),
  role:r.role==='existing'?'existing':r.role==='new'?'new':'unknown',
  source:r.role==='existing',
  deleted:false
 });
}
export function projectCreativeNextState(snapshot){
 if(!snapshot||typeof snapshot!=='object')throw new TypeError('Snapshot is required');
 const records=Object.freeze((Array.isArray(snapshot.records)?snapshot.records:[]).map(record).filter(Boolean));
 const circles=Object.freeze((Array.isArray(snapshot.circles)?snapshot.circles:[])
  .filter(c=>c&&finite(c.lat,-90,90)&&finite(c.lng,-180,180)&&finite(c.radius,0.1,10000))
  .map(c=>Object.freeze({ownerId:c.ownerId,latlng:Object.freeze([c.lat,c.lng]),radius:c.radius})));
 return Object.freeze({records,circles,areas:Object.freeze(
    (Array.isArray(snapshot.areas)?snapshot.areas:[]).filter(a=>a&&!a.deleted).map(a=>structuredClone(a))),
  hasActive:snapshot.hasActive===true,
  readonly:snapshot.recoveredFallback===true,
  history:Object.freeze({undo:Math.max(0,Number(snapshot.history?.undo)||0),redo:Math.max(0,Number(snapshot.history?.redo)||0)})
 });
}
export function createCreativeNextReadFollower(session,{render}={}){
 if(!session||typeof session.state!=='function')throw new TypeError('Session state() is required');
 if(typeof render!=='function')throw new TypeError('read follower needs a renderer');
 let active=true;
 function refresh(){
  if(!active)return null;
  const projection=projectCreativeNextState(session.state());
  render(projection);
  return projection;
 }
 return Object.freeze({refresh,unsubscribe(){active=false;}});
}
