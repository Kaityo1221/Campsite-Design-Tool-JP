import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
import {convertLegacyKasaiKmz} from '../core/legacy-kasai-convert.mjs';
import {exportNewV1Kmz} from '../core/export-kmz.mjs';
const dep={JSZip,DOMParser,XMLSerializer};
const E=new TextEncoder(),K='http://www.opengis.net/kml/2.2';
function ring(lat,lng,radius=50){
 const result=[],la=lat*Math.PI/180,lo=lng*Math.PI/180,d=radius/6378137;
 for(let i=0;i<=48;i++){
  const b=2*Math.PI*i/48,y=Math.asin(Math.sin(la)*Math.cos(d)+Math.cos(la)*Math.sin(d)*Math.cos(b));
  const x=lo+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(la),Math.cos(d)-Math.sin(la)*Math.sin(y));
  result.push(`${(x*180/Math.PI).toFixed(7)},${(y*180/Math.PI).toFixed(7)},0`);
 }
 return result.join(' ');
}
const x=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const LAYERS={
 'existing-pokestop':'既存 PokéStop','new-pokestop':'新規 PokéStop',
 'new-gym':'新規 Gym','new-power':'新規 PowerSpot'
};
function poi(p){
 const name=p.name??'同名の公園',layer=p.layer??'existing-pokestop',lat=p.lat??35.7,lng=p.lng??139.8;
 const desc=p.desc??`説明: POKESTOP<br>nextlab-layer: ${layer}`;
 const more=p.more??'';
 return `<Placemark><name>${x(name)}</name><description>${x(desc)}</description><ExtendedData><Data name="nextlab-layer"><value>${layer}</value></Data>${more}</ExtendedData><styleUrl>#creative-${layer}</styleUrl><Point><coordinates>${lng.toFixed(7)},${lat.toFixed(7)},0</coordinates></Point></Placemark>`;
}
function circle(lat,lng,i,r=50){return `<Placemark><name>${r}m ${i}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${ring(lat,lng,r)}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;}
function area(){return `<Placemark><name>ポリゴン 1</name><Polygon><outerBoundaryIs><LinearRing><coordinates>139.7,35.6,0 139.9,35.6,0 139.9,35.8,0 139.7,35.6,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`}
const doc=(folders)=>`<?xml version="1.0" encoding="utf-8"?><kml xmlns="${K}"><Document><name>旧キャンプサイト</name>${folders}</Document></kml>`;
async function source(points,{circles=true,areaIncluded=true,resources=true}={}){
 let xml='';const groups=new Map();for(const p of points){const layer=p.layer||'existing-pokestop';groups.set(layer,[...(groups.get(layer)||[]),p])}
 for(const [layer,group] of groups){xml+=`<Folder><name>${LAYERS[layer]}</name>${group.map(poi).join('')}</Folder>`}
 if(circles){xml+='<Folder><name>50m サークル</name>'+points.map((p,i)=>circle(p.lat??35.7,p.lng??139.8,i+1)).join('')+'</Folder>'}
 if(areaIncluded)xml+='<Folder><name>ポリゴン</name>'+area()+'</Folder>';
 const zip=new JSZip();zip.file('doc.kml',doc(xml));if(resources){zip.file('creative-icons/icon.png',Uint8Array.from([71,73,70,56,57,97,13]));zip.file('extra/notes.txt','添付保持')}
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
async function staged(bytes){return stageKmlInput(bytes,dep)}
async function converted(bytes){return convertLegacyKasaiKmz(await staged(bytes),dep)}
const meta=(p,n)=>p.data.filter(d=>d.name==='campsite.creative.'+n).map(d=>d.value);
test('old 2 POI, 2 circles and 1 activity convert to complete NEW_V1 but never auto-apply',async()=>{
 const input=await source([{lat:35.7,lng:139.8},{lat:35.701,lng:139.802,layer:'new-gym',desc:'自由メモ🏕️'}]);
 const old=await staged(input);assert.deepEqual(old.errors,[]);
 assert.equal(diagnoseKmzCandidate(old).disposition,'HOLD');
 const r=await convertLegacyKasaiKmz(old,dep),newstage=await staged(r.bytes),d=r.verification;
 assert.equal(d.disposition,'READY');assert.equal(d.canApply,false);assert.equal(r.canApply,false);
 assert.deepEqual({existing:d.counts.existing,newTotal:d.counts.newTotal,circles:d.counts.circles,areas:d.counts.activityAreas},
  {existing:1,newTotal:1,circles:2,areas:1});
 assert.equal(newstage.places.length,old.places.length);
 assert.equal(meta(newstage.places[0],'memo')[0],'');
 assert.equal(newstage.places[0].description,'');
 assert.equal(meta(newstage.places[0],'legacy-description')[0],old.places[0].description);
 assert.equal(meta(newstage.places[1],'memo')[0],'自由メモ🏕️');
 assert.equal(newstage.places[1].description,'自由メモ🏕️');
 assert.equal(meta(newstage.places[0],'id').length,1);
 assert.equal(new Set(r.pois.map(p=>p.id)).size,2);
 for(const p of newstage.places.slice(2,4)){
  assert.equal(p.circleValid,true);assert.equal(meta(p,'circle-owner-id').length,1);assert.equal(meta(p,'circle-radius')[0],'50');
 }
 const a=new JSZip(),b=await JSZip.loadAsync(r.bytes),orig=await JSZip.loadAsync(input);
 assert.deepEqual(await b.file('creative-icons/icon.png').async('uint8array'),await orig.file('creative-icons/icon.png').async('uint8array'));
 assert.equal(await b.file('extra/notes.txt').async('string'),'添付保持');
});
test('same original KMZ converted twice generates stable unique IDs',async()=>{
 const input=await source([{lat:35.7,lng:139.8},{lat:35.701,lng:139.802}]);
 const a=await converted(input),b=await converted(input);
 assert.deepEqual(a.pois.map(p=>p.id),b.pois.map(p=>p.id));
 assert.equal(a.pois[0].title,a.pois[1].title);
 assert.notEqual(a.pois[0].id,a.pois[1].id);
});
test('source byte array is not mutated',async()=>{
 const input=await source([{lat:35.7,lng:139.8}]);const before=Buffer.from(input);
 await converted(input);assert.deepEqual(Buffer.from(input),before);
});
test('generated descriptions are stored without becoming user memos',async()=>{
 const original='説明: POKESTOP<br>nextlab-layer: existing-pokestop';
 const result=await converted(await source([{desc:original}]));const s=await staged(result.bytes);
 assert.equal(s.places[0].description,'');assert.equal(meta(s.places[0],'memo')[0],'');
 assert.equal(meta(s.places[0],'legacy-description')[0],original);
});
test('ordinary HTML-looking handwritten description is preserved as memo',async()=>{
 const original='手書き: <b>楽しい</b> & 開催日';
 const result=await converted(await source([{desc:original}]));const s=await staged(result.bytes);
 assert.equal(s.places[0].description,original);assert.equal(meta(s.places[0],'memo')[0],original);
});
test('ambiguous generated-looking description is held rather than stripped',async()=>{
 const input=await source([{desc:'説明: 思い出の場所<br>参加者からのコメント'}]);
 await assert.rejects(()=>converted(input),e=>e.code==='LEGACY_DESCRIPTION_AMBIGUOUS');
});
test('duplicate locations cannot be assigned circles automatically',async()=>{
 const input=await source([{lat:35.7,lng:139.8},{lat:35.7,lng:139.8}]);
 await assert.rejects(()=>converted(input),e=>e.code==='LEGACY_CIRCLE_AMBIGUOUS');
});
test('unverified unknown polygon stops conversion',async()=>{
 const input=await source([{lat:35.7,lng:139.8}],{circles:false});
 const z=await JSZip.loadAsync(input);let k=await z.file('doc.kml').async('string');
 k=k.replace('</Document>','<Folder><name>別の場所</name>'+circle(35.7,139.8,1)+'</Folder></Document>');z.file('doc.kml',k);
 const broken=await z.generateAsync({type:'uint8array'});
 await assert.rejects(()=>converted(broken),e=>e.code==='LEGACY_UNSAFE');
});
test('unknown reserved new metadata in legacy input stops conversion',async()=>{
 const input=await source([{more:'<Data name="campsite.creative.foo"><value>unexpected</value></Data>'}]);
 await assert.rejects(()=>converted(input),e=>e.code==='LEGACY_SCHEMA');
});
test('exporting converted KMZ without edits maintains every geometry and ID',async()=>{
 const input=await source([{lat:35.7,lng:139.8},{lat:35.701,lng:139.802,layer:'new-pokestop',desc:'メモ'}]);
 const r=await converted(input),s=await staged(r.bytes);
 const re=await exportNewV1Kmz(s,{...dep});assert.equal(re.verification.disposition,'READY');
 const round=await staged(re.bytes);
 assert.equal(round.places.length,s.places.length);
 assert.deepEqual(round.places.map(p=>p.geometry),s.places.map(p=>p.geometry));
 assert.deepEqual(round.places.filter(p=>p.geometry==='Point').map(p=>meta(p,'id')[0]),r.pois.map(p=>p.id));
 assert.deepEqual(round.places.filter(p=>p.geometry==='Polygon').map(p=>p.polygonGeometry.raw),s.places.filter(p=>p.geometry==='Polygon').map(p=>p.polygonGeometry.raw));
});
test('editing a converted POI memo preserves original legacy description metadata',async()=>{
 const input=await source([{lat:35.7,lng:139.8}]);const r=await converted(input),s=await staged(r.bytes);
 const edited=await exportNewV1Kmz(s,{...dep,edits:[{id:r.pois[0].id,memo:'新しいメモ'}]});
 const z=await staged(edited.bytes);assert.equal(meta(z.places[0],'memo')[0],'新しいメモ');
 assert.equal(meta(z.places[0],'legacy-description')[0],r.pois[0].originalDescription);
 assert.equal(z.places[0].coordinates,s.places[0].coordinates);
});
test('moving an existing converted POI is blocked',async()=>{
 const r=await converted(await source([{lat:35.7,lng:139.8}]));
 const ready=await staged(r.bytes);
 await assert.rejects(()=>exportNewV1Kmz(ready,{...dep,edits:[{id:r.pois[0].id,lat:35.9,lng:139.8}]}),e=>e.code==='EXISTING_POSITION_LOCKED');
});
test('malformed old layer does not get guessed from folder',async()=>{
 const z=await JSZip.loadAsync(await source([{lat:35.7,lng:139.8}]));
 z.file('doc.kml',(await z.file('doc.kml').async('string')).replace('name="nextlab-layer"','name="arbitrary-layer"'));
 const broken=await z.generateAsync({type:'uint8array'});
 await assert.rejects(()=>converted(broken),e=>e.code==='LEGACY_UNSAFE');
});
test('old KMZ kind edit is held when destination folder or icon is missing',async()=>{
 const r=await converted(await source([{lat:35.7,lng:139.8}]));const s=await staged(r.bytes);
 await assert.rejects(()=>exportNewV1Kmz(s,{...dep,edits:[{id:r.pois[0].id,kind:'gym'}]}),e=>e.code==='EXPORT_FOLDER_HOLD');
});
