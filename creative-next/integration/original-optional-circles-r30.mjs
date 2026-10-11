/* Creative Next r30: optional 30m/40m rings copied from ORIGINAL v7 visual rules.
 * This is a read-only map decoration, never a new source circle or KMZ export edit.
 * Only 50m source-backed rings remain in creative-next-original-leaflet-overlay.
 */
const PALETTES = Object.freeze({
  30: Object.freeze({color:'#3e9b68',fillColor:'#3e9b68',weight:2,dashArray:'4 5',fillOpacity:.045}),
  40: Object.freeze({color:'#8d62c1',fillColor:'#8d62c1',weight:2,dashArray:'6 5',fillOpacity:.055})
});
const LAYERS = /^(existing|new)-(pokestop|gym|power)$/;
const validCoord = (v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function createOriginalOptionalCircleOverlay({session,map,L}={}){
 if(typeof session?.state!=='function'||typeof map?.hasLayer!=='function'||
    typeof map?.removeLayer!=='function'||typeof L?.circle!=='function')
  throw new TypeError('r30 needs isolated session and an existing Leaflet map');
 const enabled=new Set(),hidden=new Set(),rings=new Map();
 let disposed=false;
 function refresh(){
  if(disposed)return;
  const records=session.state()?.records??[];
  const active=new Set();
  for(const p of Array.isArray(records)?records:[]){
   if(!p||p.deleted===true||typeof p.id!=='string'||!p.id||
      !validCoord(p.lat,-90,90)||!validCoord(p.lng,-180,180))continue;
   const group=p.role+'-'+p.kind;
   if(!LAYERS.test(group)||hidden.has(group))continue;
   for(const radius of enabled){
    const key=p.id+'|'+radius;
    active.add(key);
    const previous=rings.get(key);
    if(previous){
     previous.setLatLng([p.lat,p.lng]);
     if(!map.hasLayer(previous))previous.addTo(map);
    }else{
     const ring=L.circle([p.lat,p.lng],{radius,...PALETTES[radius],interactive:false});
     ring.addTo(map);rings.set(key,ring);
    }
   }
  }
  for(const [key,ring] of rings){
   if(!active.has(key)){map.removeLayer(ring);rings.delete(key);}
  }
 }
 return Object.freeze({
  refresh,
  setCircleVisible(radius,visible){
   if(disposed||!(radius===30||radius===40)||typeof visible!=='boolean')return false;
   if(visible)enabled.add(radius);else enabled.delete(radius);
   refresh();return true;
  },
  setLayerVisible(key,visible){
   if(disposed||!LAYERS.test(key)||typeof visible!=='boolean')return false;
   if(visible)hidden.delete(key);else hidden.add(key);
   refresh();return true;
  },
  counts:()=>Object.freeze({extraCircles:rings.size,radii:[...enabled].sort((a,b)=>a-b)}),
  destroy(){
   if(disposed)return;
   disposed=true;
   for(const ring of rings.values())map.removeLayer(ring);
   rings.clear();enabled.clear();hidden.clear();
  }
 });
}
