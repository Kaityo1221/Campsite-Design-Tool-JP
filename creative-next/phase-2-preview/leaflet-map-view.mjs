/*
 * NON-PRODUCTION: optional Leaflet map adapter for the isolated preview only.
 * No imports or writes to legacy Creative Mode. Tile provider is independent.
 * Map render is keyed by internal ID, with owner/radius circle keys.
 */
const color=p=>p.kind==='gym'?'#cb5149':p.kind==='power'?'#8054b9':p.role==='new'?'#d18d22':'#1976bc';
const latlng=p=>[p.lat,p.lng];
export function createLeafletMapView({L,root,onSelect,tiles=true}={}){
 if(!L?.map||!L?.circleMarker||!L?.circle||!L?.polygon||!root)throw Error('Leaflet is not available');
 const map=L.map(root,{zoomControl:true,preferCanvas:true}).setView([35.643,139.857],15);
 if(tiles&&L.tileLayer)L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
 const pois=new Map(),circles=new Map(),areas=new Map();
 function reconcile(index,entries,update,create){
  const keep=new Set();
  for(const entry of entries){const key=entry.key;keep.add(key);const existing=index.get(key);
   if(existing)update(existing,entry);else index.set(key,create(entry));
  }
  for(const [key,layer] of index)if(!keep.has(key)){map.removeLayer(layer);index.delete(key)}
 }
 function render(state,{selectedId=null,fit=false}={}){
  const records=(state.records||[]).filter(p=>!p.deleted);
  reconcile(pois,records.map(p=>({...p,key:p.id})),
   (layer,p)=>{layer.setLatLng(latlng(p));layer.setStyle({color:color(p),radius:p.id===selectedId?10:6,weight:p.id===selectedId?3:1.7})},
   p=>L.circleMarker(latlng(p),{color:color(p),fillColor:color(p),fillOpacity:.86,radius:p.id===selectedId?10:6,weight:1.7})
    .addTo(map).on('click',()=>onSelect?.(p.id)));
  reconcile(circles,(state.circles||[]).map(c=>({...c,key:c.ownerId+'\0'+c.radius})),
   (layer,c)=>{layer.setLatLng(latlng(c));layer.setRadius(c.radius)},
   c=>L.circle(latlng(c),{radius:c.radius,color:'#22a3ba',weight:1.2,fillOpacity:.04,interactive:false}).addTo(map));
  reconcile(areas,(state.areas||[]).map(a=>({...a,key:a.id})),
   (layer,a)=>layer.setLatLngs(a.points),
   a=>L.polygon(a.points,{color:'#388b65',weight:2,fillOpacity:.08,interactive:false}).addTo(map));
  if(fit&&records.length){
   const coords=records.map(latlng);
   for(const a of state.areas||[])for(const p of a.points)coords.push(p);
   if(L.latLngBounds)map.fitBounds(L.latLngBounds(coords),{padding:[22,22],maxZoom:17});
  }
 }
 return Object.freeze({render,invalidateSize:()=>map.invalidateSize(),destroy:()=>map.remove()});
}
