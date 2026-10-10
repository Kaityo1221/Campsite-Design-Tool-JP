/* U3-B: keyed, READ-ONLY overlay for an existing Creative Leaflet map instance.
 * Never create a second map, storage, or edit history. The caller owns map
 * initialization and calls refresh() only after the engine commits a change.
 */
import {createCreativeNextReadFollower} from './creative-ui-read-follower.mjs';
const styles=Object.freeze({pokestop:'cm-v73-stop',gym:'cm-v73-gym',power:'cm-v73-power'});
export function attachCreativeNextOverlay({session,map,L}={}){
 if(!map||!L?.marker||!L?.divIcon||!L?.circle)throw new TypeError('Existing Leaflet map and primitives required');
 const markers=new Map(),rings=new Map();
 let disposed=false;
 function drop(layer){if(layer)map.removeLayer(layer)}
 function icon(p){
  const css=styles[p.kind];
  return L.divIcon({className:'cm-v73-map-icon',
   html:'<span class="cm-v73-icon-wrap"><span class="'+css+'"></span></span>',
   iconSize:[34,34],iconAnchor:[17,17]});
 }
 function draw(data){
  if(disposed)return;
  const active=new Set();
  for(const p of data.records){
   active.add(p.id);
   const current=markers.get(p.id);
   if(current&&current.kind===p.kind){
    current.layer.setLatLng(p.latlng);
   }else{
    if(current)drop(current.layer);
    const marker=L.marker(p.latlng,{icon:icon(p),draggable:false,keyboard:false,interactive:false});
    marker.addTo(map);
    markers.set(p.id,{kind:p.kind,layer:marker});
   }
  }
  for(const [id,item] of markers)if(!active.has(id)){drop(item.layer);markers.delete(id)}
  const live=new Set();
  for(const c of data.circles){
   const id=String(c.ownerId)+'|'+c.radius;live.add(id);
   let circle=rings.get(id);
   if(circle)circle.setLatLng(c.latlng);
   else{circle=L.circle(c.latlng,{radius:c.radius,color:'#22a3ba',weight:1.2,fillOpacity:.04,interactive:false}).addTo(map);rings.set(id,circle)}
  }
  for(const [id,layer] of rings)if(!live.has(id)){drop(layer);rings.delete(id)}
 }
 const follower=createCreativeNextReadFollower(session,{render:draw});
 return Object.freeze({refresh:()=>{if(disposed)return null;return follower.refresh()},
  destroy(){if(disposed)return;disposed=true;follower.unsubscribe();for(const {layer} of markers.values())drop(layer);for(const layer of rings.values())drop(layer);markers.clear();rings.clear()},
  counts:()=>Object.freeze({pois:markers.size,circles:rings.size})
 });
}
