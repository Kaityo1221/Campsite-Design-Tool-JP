/* U3-B: keyed, READ-ONLY overlay for an existing Creative Leaflet map instance.
 * Never create a second map, storage, or edit history. The caller owns map
 * initialization and calls refresh() only after the engine commits a change.
 */
import {createCreativeNextReadFollower} from './creative-ui-read-follower.mjs';
const styles=Object.freeze({pokestop:'cm-v73-stop',gym:'cm-v73-gym',power:'cm-v73-power'});
export function attachCreativeNextOverlay({session,map,L}={}){
 if(!map||!L?.marker||!L?.divIcon||!L?.circle)throw new TypeError('Existing Leaflet map and primitives required');
 const markers=new Map(),rings=new Map();
 const hiddenLayers=new Set(),hiddenRadii=new Set();
 let disposed=false;
 const groupKey=p=>(p.role==='new'?'new':'existing')+'-'+p.kind;
 function setMounted(layer,visible){if(visible){if(!map.hasLayer(layer))layer.addTo(map)}else if(map.hasLayer(layer))map.removeLayer(layer)}
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
    current.role=p.role;
    setMounted(current.layer,!hiddenLayers.has(groupKey(p)));
   }else{
    if(current)drop(current.layer);
    const marker=L.marker(p.latlng,{icon:icon(p),draggable:false,keyboard:false,interactive:false});
    if(!hiddenLayers.has(groupKey(p)))marker.addTo(map);
    markers.set(p.id,{kind:p.kind,role:p.role,layer:marker});
   }
  }
  for(const [id,item] of markers)if(!active.has(id)){drop(item.layer);markers.delete(id)}
  const live=new Set();
  for(const c of data.circles){
   const id=String(c.ownerId)+'|'+c.radius;live.add(id);
   let circle=rings.get(id);
   if(circle){circle.setLatLng(c.latlng);setMounted(circle,!hiddenRadii.has(c.radius));}
   else{circle=L.circle(c.latlng,{radius:c.radius,color:'#22a3ba',weight:1.2,fillOpacity:.04,interactive:false});if(!hiddenRadii.has(c.radius))circle.addTo(map);rings.set(id,circle)}
  }
  for(const [id,layer] of rings)if(!live.has(id)){drop(layer);rings.delete(id)}
 }
 const follower=createCreativeNextReadFollower(session,{render:draw});
 return Object.freeze({refresh:()=>{if(disposed)return null;return follower.refresh()},
  setLayerVisible(key,visible){if(disposed||!/^((existing|new)-(pokestop|gym|power))$/.test(key))return false;
   if(visible)hiddenLayers.delete(key);else hiddenLayers.add(key);
   for(const p of markers.values())if(groupKey(p)===key)setMounted(p.layer,visible);
   return true;
  },
  setCircleVisible(radius,visible){if(disposed||![30,40,50].includes(radius))return false;
   if(visible)hiddenRadii.delete(radius);else hiddenRadii.add(radius);
   for(const [key,circle] of rings)if(Number(key.split('|').at(-1))===radius)setMounted(circle,visible);
   return true;
  },
  destroy(){if(disposed)return;disposed=true;follower.unsubscribe();for(const {layer} of markers.values())drop(layer);for(const layer of rings.values())drop(layer);markers.clear();rings.clear()},
  counts:()=>Object.freeze({pois:markers.size,circles:rings.size})
 });
}
