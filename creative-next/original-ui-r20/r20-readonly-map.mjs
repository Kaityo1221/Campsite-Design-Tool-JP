import {attachOriginalFileReview} from '../integration/original-file-review.mjs';
import {attachCreativeNextOverlay} from '../integration/creative-next-original-leaflet-overlay.mjs';
// r20: original visual shell, isolated map with zero editing/persistence permissions.
let map=null,overlay=null;
const status=document.getElementById('entryState');
const fileReview=attachOriginalFileReview({
 document,JSZip:globalThis.JSZip,DOMParser:globalThis.DOMParser,XMLSerializer:globalThis.XMLSerializer,
 confirmReview:()=>globalThis.confirm('読み込み候補を隔離エンジンに適用し、地図へ表示しますか？ 元のファイルは変更しません。'),
 onResult(result){
  if(!result?.applied)return;
  if(!globalThis.L?.map){status.textContent='地図ライブラリを読み込めませんでした';return;}
  try{
   const entry=document.getElementById('entry');
   entry.classList.add('hidden');
   map=globalThis.L.map('map',{zoomControl:false,preferCanvas:true}).setView([35.643,139.857],15);
   globalThis.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
   overlay=attachCreativeNextOverlay({session:fileReview.engine,map,L:globalThis.L});
   const view=overlay.refresh();
   if(view?.records?.length){
    map.fitBounds(globalThis.L.latLngBounds(view.records.map(r=>r.latlng)),{padding:[24,24],maxZoom:17});
   }
   map.invalidateSize();
  }catch(error){entry.classList.remove('hidden');status.textContent='地図表示を保留しました';overlay?.destroy();map?.remove();overlay=null;map=null;}
 }
});
globalThis.creativeR20=Object.freeze({status:()=>({active:fileReview.engine.state().hasActive,count:overlay?.counts()||null}),dispose:()=>{overlay?.destroy();map?.remove();fileReview.dispose()}});
