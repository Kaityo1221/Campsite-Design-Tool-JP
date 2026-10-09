/* NON-PRODUCTION: keyed Leaflet preview. All map events are proposals, never writes.
 * Old Creative Mode and its storage are not accessed. A failed/cancelled edit is
 * restored on the next render; POIs themselves are never draggable.
 */
const color=p=>p.kind==='gym'?'#cb5149':p.kind==='power'?'#8054b9':p.role==='new'?'#d18d22':'#1976bc';
const latlng=p=>[p.lat,p.lng];
const validLatLng=p=>p&&typeof p.lat==='number'&&typeof p.lng==='number'&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;
export function createLeafletMapView({L,root,onSelect,onMapClick,onVertexDrop,onVertexSelect,onTilesState,tiles=true}={}){
 if(!L?.map||!L?.circleMarker||!L?.circle||!L?.polygon||!root)throw Error('Leaflet is not available');
 const map=L.map(root,{zoomControl:true,preferCanvas:true}).setView([35.643,139.857],15);
 if(tiles&&L.tileLayer){
  const tileLayer=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
   {maxZoom:19,attribution:'© OpenStreetMap contributors'});
  // Leaflet emits 'load' when *all tile requests have finished*, including
  // failed requests. A load event after a tileerror is not evidence of success.
  // Reset the failure flag only for a new loading cycle (pan/zoom/retry).
  let failedThisCycle=false;
  tileLayer.on?.('loading',()=>{failedThisCycle=false;onTilesState?.('WAITING')});
  tileLayer.on?.('tileerror',()=>{failedThisCycle=true;onTilesState?.('ERROR')});
  tileLayer.on?.('load',()=>onTilesState?.(failedThisCycle?'ERROR':'READY'));
  onTilesState?.('WAITING');
  tileLayer.addTo(map);
 }else onTilesState?.('NO_TILES');
 const pois=new Map(),circles=new Map(),areas=new Map(),vertices=new Map();
 let destroyed=false;
 const mapClicked=e=>{if(!destroyed&&validLatLng(e?.latlng))onMapClick?.({lat:e.latlng.lat,lng:e.latlng.lng})};
 map.on?.('click',mapClicked);
 function reconcile(index,entries,update,create){
  const keep=new Set();
  for(const entry of entries){const key=entry.key;keep.add(key);const layer=index.get(key);
   if(layer)update(layer,entry);else index.set(key,create(entry));
  }
  for(const [key,layer] of index)if(!keep.has(key)){map.removeLayer(layer);index.delete(key)}
 }
 function render(state,{selectedId=null,selectedAreaId=null,selectedVertexIndex=null,fit=false,visibility={},editable=true}={}){
  if(destroyed)throw Error('Leaflet view is already destroyed');
  const show={poi:visibility.poi!==false,circles:visibility.circles!==false,areas:visibility.areas!==false};
  const records=show.poi?(state.records||[]).filter(p=>!p.deleted):[];
  reconcile(pois,records.map(p=>({...p,key:p.id})),
   (layer,p)=>{layer.setLatLng(latlng(p));layer.setStyle({color:color(p),radius:p.id===selectedId?10:6,weight:p.id===selectedId?3:1.7})},
   p=>L.circleMarker(latlng(p),{color:color(p),fillColor:color(p),fillOpacity:.86,radius:p.id===selectedId?10:6,weight:1.7,bubblingMouseEvents:false})
    .addTo(map).on('click',()=>onSelect?.(p.id)));
  reconcile(circles,show.circles?(state.circles||[]).map(c=>({...c,key:c.ownerId+'\0'+c.radius})):[],
   (layer,c)=>{layer.setLatLng(latlng(c));layer.setRadius(c.radius)},
   c=>L.circle(latlng(c),{radius:c.radius,color:'#22a3ba',weight:1.2,fillOpacity:.04,interactive:false}).addTo(map));
  reconcile(areas,show.areas?(state.areas||[]).map(a=>({...a,key:a.id})):[],
   (layer,a)=>layer.setLatLngs(a.points),
   a=>L.polygon(a.points,{color:'#388b65',weight:2,fillOpacity:.08,interactive:false}).addTo(map));
  const selectedArea=show.areas&&editable?(state.areas||[]).find(a=>a.id===selectedAreaId):null;
  const handles=(selectedArea?.points||[]).map((p,index)=>({key:selectedAreaId+'\0'+index,id:selectedAreaId,index,point:p}));
  reconcile(vertices,L.marker?handles:[],
   (layer,v)=>{layer.setLatLng(v.point);layer.setOpacity?.(v.index===selectedVertexIndex?1:.75)},
   v=>{
    const options={draggable:true,keyboard:true,riseOnHover:true,bubblingMouseEvents:false};
    if(L.divIcon)options.icon=L.divIcon({className:'creative-next-vertex',html:`<span aria-hidden="true">${v.index+1}</span>`,iconSize:[24,24],iconAnchor:[12,12]});
    const marker=L.marker(v.point,options).addTo(map);
    marker.setOpacity?.(v.index===selectedVertexIndex?1:.75);
    marker.on('click',()=>onVertexSelect?.({id:v.id,index:v.index}));
    marker.on('dragend',()=>{
     const point=marker.getLatLng?.();
     if(validLatLng(point))onVertexDrop?.({id:v.id,index:v.index,lat:point.lat,lng:point.lng});
     else marker.setLatLng(v.point);
    });
    return marker;
   });
  if(fit){
   const coords=(state.records||[]).filter(p=>!p.deleted).map(latlng);
   for(const a of state.areas||[])for(const p of a.points)coords.push(p);
   if(L.latLngBounds&&coords.length)map.fitBounds(L.latLngBounds(coords),{padding:[22,22],maxZoom:17});
  }
 }
 return Object.freeze({render,invalidateSize:()=>map.invalidateSize(),destroy:()=>{
  if(destroyed)return;destroyed=true;map.off?.('click',mapClicked);map.remove();pois.clear();circles.clear();areas.clear();vertices.clear();}});
}
