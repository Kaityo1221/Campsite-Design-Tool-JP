import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
import {exportNewV1Kmz} from '../core/export-kmz.mjs';
const opts={JSZip,DOMParser,XMLSerializer};
const enc=new TextEncoder();
const e=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const data=(k,v)=>`<Data name="campsite.creative.${k}"><value>${e(v)}</value></Data>`;
const udata=(k,v)=>`<Data name="thirdparty:${k}"><value>${e(v)}</value></Data>`;
function poi({id='p1',role='existing',kind='pokestop',name='名前 & 図',memo='説明 <memo>',lat='35.0123400',lng='139.0123400',alt=',0',other='',description=true,coordAttrs=''}={}){
  return `<Placemark source-custom="keep"><name>${e(name)}</name>${description?`<description>${e(memo)}</description>`:''}<ExtendedData>${[
    data('object','poi'),data('id',id),data('role',role),data('kind',kind),data('title',name),data('memo',memo),data('lat',lat),data('lng',lng),other
  ].join('')}</ExtendedData><Point ${coordAttrs}><coordinates>${lng},${lat}${alt}</coordinates></Point></Placemark>`;
}
const area='<Placemark><name>活動範囲</name><ExtendedData>'+data('object','activity-area')+data('area-id','a1')+'</ExtendedData><Polygon><outerBoundaryIs><LinearRing><coordinates>139,35,0 139.02,35,0 139.02,35.02,0 139,35,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>';
const doc = (body,more='') => `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>テスト</name><ExtendedData>${data('format','creative-mode-next')}${data('version','1')}${more}</ExtendedData>${body}</Document></kml>`;
async function staged(xml,{plain=false,extras={}}={}){
  const zip=new JSZip();zip.file('doc.kml',xml);for(const [k,v] of Object.entries(extras))zip.file(k,v);
  const bytes=plain?enc.encode(xml):await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  const s=await stageKmlInput(bytes,opts);assert.deepEqual(s.errors,[]);return s;
}
const exp=(s,edits=[])=>exportNewV1Kmz(s,{...opts,edits});
const restage=({bytes})=>stageKmlInput(bytes,opts);

test('unchanged NEW_V1 can be zipped and reimported with immutable ID, altitude spelling and memo',async()=>{
  const source=doc(poi({lat:'35.0123400',lng:'139.0123400',alt:',0.00'}));
  const s=await staged(source,{plain:true});const out=await exp(s);const re=await restage(out);
  assert.equal(out.verification.disposition,'READY');assert.equal(re.sourceFormat,'kmz');
  assert.equal(re.places[0].sourceGeometry.coordinates,'139.0123400,35.0123400,0.00');
  assert.equal(re.places[0].data.find(x=>x.name==='campsite.creative.id').value,'p1');
  assert.equal(re.places[0].description,'説明 <memo>');
});
test('KMZ attachments and unknown XML metadata survive rewriting byte for byte',async()=>{
  const note=Uint8Array.from([1,2,3,4,255]);
  const input=doc(poi({other:udata('memo','謎情報')}),udata('document','保存せよ'));
  const s=await staged(input,{extras:{'images/icon.png':note,'other/note.txt':'日本語'}});
  const out=await exp(s);const z=await JSZip.loadAsync(out.bytes);
  assert.deepEqual(await z.file('images/icon.png').async('uint8array'),note);
  assert.equal(await z.file('other/note.txt').async('text'),'日本語');
  const re=await restage(out);assert.equal(re.sourceKml.includes('thirdparty:memo'),true);
  assert.equal(re.sourceKml.includes('thirdparty:document'),true);
  assert.equal(re.places[0].geometry,'Point');
});
test('updates name and memo including XML metacharacters, preserving source metadata',async()=>{
  const s=await staged(doc(poi({other:udata('custom','残す')})));
  const out=await exp(s,[{id:'p1',title:'🍀 カエル <A> & B',memo:'自由文: 1 < 2 && 3'}]);const re=await restage(out);
  assert.equal(re.places[0].name,'🍀 カエル <A> & B');
  assert.equal(re.places[0].description,'自由文: 1 < 2 && 3');
  assert.equal(re.places[0].data.find(x=>x.name==='thirdparty:custom').value,'残す');
  assert.equal(re.sourceKml.includes('source-custom="keep"'),true);
});
test('existing POI coordinates cannot be changed even to the same coordinate',async()=>{
  const s=await staged(doc(poi()));
  await assert.rejects(()=>exp(s,[{id:'p1',lat:'35.0123400',lng:'139.0123400'}]),e=>e.code==='EXISTING_POSITION_LOCKED');
});
test('new POI moves only by explicit coordinate edit; original zero altitude is kept',async()=>{
  const s=await staged(doc(poi({role:'new',alt:',0'})));
  const out=await exp(s,[{id:'p1',lat:'35.87654',lng:'139.876543'}]);
  const re=await restage(out);
  assert.equal(re.places[0].sourceGeometry.coordinates,'139.876543,35.87654,0');
  assert.equal(diagnoseKmzCandidate(re).disposition,'READY');
});
test('new move with meaningful elevation refuses to falsify original altitude',async()=>{
  const s=await staged(doc(poi({role:'new',alt:',23.5'})));
  await assert.rejects(()=>exp(s,[{id:'p1',lat:'35.5',lng:'139.5'}]),e=>e.code==='EXPORT_ALTITUDE_LOCKED');
});
test('untouched meaningful altitude is retained',async()=>{
  const s=await staged(doc(poi({alt:',23.50000'})));const out=await exp(s);const re=await restage(out);
  assert.equal(re.places[0].sourceGeometry.coordinates,'139.0123400,35.0123400,23.50000');
});
test('an unknown edit field is rejected instead of silently ignored',async()=>{
  const s=await staged(doc(poi()));
  await assert.rejects(()=>exp(s,[{id:'p1',role:'new'}]),e=>e.code==='EXPORT_EDITS');
});
test('duplicate edit IDs are rejected',async()=>{
  const s=await staged(doc(poi()));
  await assert.rejects(()=>exp(s,[{id:'p1',memo:'a'},{id:'p1',memo:'b'}]),e=>e.code==='EXPORT_EDITS');
});
test('unknown edited ID is rejected',async()=>{
  const s=await staged(doc(poi()));
  await assert.rejects(()=>exp(s,[{id:'does-not-exist',memo:'a'}]),e=>e.code==='EXPORT_EDITS');
});
test('valid delete removes only target POI, keeps other POI and area',async()=>{
  const s=await staged(doc(poi()+poi({id:'p2',role:'new',name:'他'})+area));
  const out=await exp(s,[{id:'p1',deleted:true}]);const re=await restage(out);
  assert.equal(re.places.length,2);assert.equal(re.places[0].data.find(x=>x.name==='campsite.creative.id').value,'p2');
  assert.equal(re.places[1].geometry,'Polygon');assert.equal(re.places[1].polygonGeometry.raw,'139,35,0 139.02,35,0 139.02,35.02,0 139,35,0');
});
test('old Creative KMZ is HOLD and cannot be silently converted or exported',async()=>{
  const xml='<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Folder><name>既存 PokéStop</name><Placemark><name>旧</name><ExtendedData><Data name="nextlab-layer"><value>existing-pokestop</value></Data></ExtendedData><Point><coordinates>139.1,35.1</coordinates></Point></Placemark></Folder></Document></kml>';
  const s=await staged(xml);assert.equal(diagnoseKmzCandidate(s).disposition,'HOLD');
  await assert.rejects(()=>exp(s),e=>e.code==='EXPORT_HOLD');
});
test('a blocked new file cannot be written',async()=>{
  const s=await staged(doc(poi({id:'dup'})+poi({id:'dup'})));
  await assert.rejects(()=>exp(s),e=>e.code==='EXPORT_HOLD');
});
test('undo/redo layers and map view are not written to KML; no UI updates occur',async()=>{
  const s=await staged(doc(poi()));const before=s.sourceKml;
  const out=await exp(s,[{id:'p1',memo:'updated'}]);
  assert.equal(s.sourceKml,before);
  assert.equal(JSON.stringify(s).includes('undoStack'),false);
  assert.equal(new TextDecoder().decode(out.bytes.slice(0,2)),'PK');
});
test('abort is honored before any mutation',async()=>{
  const s=await staged(doc(poi()));const ac=new AbortController();ac.abort();
  await assert.rejects(()=>exportNewV1Kmz(s,{...opts,signal:ac.signal}),e=>e.code==='CANCELLED');
});
test('over-limit legitimate new POIs can still be retained and exported',async()=>{
  const xml=doc(Array.from({length:26},(_,i)=>poi({id:'n'+i,name:'新'+i,role:'new',kind:i<13?'pokestop':'gym'})).join(''));
  const s=await staged(xml);assert.equal(diagnoseKmzCandidate(s).disposition,'READY');
  const out=await exp(s);const re=await restage(out);
  assert.equal(re.places.length,26);assert.equal(diagnoseKmzCandidate(re).disposition,'READY');
  assert.equal(out.verification.counts.newTotal,26);
});
test('type change into full new category is blocked',async()=>{
  const xml=doc(Array.from({length:12},(_,i)=>poi({id:'s'+i,name:'ストップ'+i,role:'new',kind:'pokestop'})).join('')+poi({id:'g',name:'ジム',role:'new',kind:'gym'}));
  const s=await staged(xml);
  await assert.rejects(()=>exp(s,[{id:'g',kind:'pokestop'}]),e=>e.code==='NEW_KIND_LIMIT');
});
test('new type change into available category succeeds',async()=>{
  const s=await staged(doc(poi({role:'new'})));
  const out=await exp(s,[{id:'p1',kind:'gym'}]);const re=await restage(out);
  assert.equal(re.places[0].data.find(x=>x.name==='campsite.creative.kind').value,'gym');
});
test('original source archive bytes remain unchanged after export',async()=>{
  const s=await staged(doc(poi()));const before=s.rawSource.slice();
  await exp(s,[{id:'p1',memo:'changed'}]);assert.deepEqual(s.rawSource,before);
});

test('duplicate area IDs never qualify for export or roundtrip',async()=>{
  const s=await staged(doc(poi()+area+area));
  assert.equal(diagnoseKmzCandidate(s).disposition,'HOLD');
  await assert.rejects(()=>exp(s),e=>e.code==='EXPORT_HOLD');
});

test('new POI move with unknown Point extension is blocked rather than silently changing its meaning',async()=>{
  const base=doc(poi({role:'new'}));
  const xml=base.replace(' xmlns="http://www.opengis.net/kml/2.2"',' xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2"').replace('</coordinates></Point>', '</coordinates><gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode></Point>');
  const s=await staged(xml);
  await assert.rejects(()=>exp(s,[{id:'p1',lat:35.2,lng:139.2}]),e=>e.code==='EXPORT_ALTITUDE_LOCKED');
});