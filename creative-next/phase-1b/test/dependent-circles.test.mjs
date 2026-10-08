import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {circleRingAt,indexDependentCircles,circleOverlay} from '../core/dependent-circles.mjs';
import {createFreshV1Kmz} from '../core/create-new-kmz.mjs';
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
import {createIsolatedEditorSession} from '../integration/isolated-editor-session.mjs';
const deps={JSZip,DOMParser,XMLSerializer};
const NS='http://www.opengis.net/kml/2.2';
const rec=(id,role='new',lat=35.643,lng=139.857)=>({id,role,kind:'pokestop',title:id,memo:'m',lat,lng,deleted:false});
const text=(doc,name,value)=>{const node=doc.createElementNS(NS,name);node.textContent=String(value);return node};
async function source(withOwners=['n1','e1']){
 const records=[rec('n1'),rec('e1','existing',35.642,139.856)];
 const orig=await createFreshV1Kmz({records,activityAreas:[]},deps);
 const zip=await JSZip.loadAsync(orig.bytes);
 const doc=new DOMParser().parseFromString(await zip.file('doc.kml').async('text'),'application/xml');
 const document=doc.getElementsByTagNameNS(NS,'Document')[0];
 for(const id of withOwners){
  const owner=records.find(p=>p.id===id);const pm=doc.createElementNS(NS,'Placemark');
  pm.appendChild(text(doc,'name','50m '+id));
  const ext=doc.createElementNS(NS,'ExtendedData');
  for(const [name,value] of [['object','distance-circle'],['circle-owner-id',id],['circle-radius','50']]){
   const data=doc.createElementNS(NS,'Data');data.setAttribute('name','campsite.creative.'+name);
   data.appendChild(text(doc,'value',value));ext.appendChild(data);
  }
  pm.appendChild(ext);
  const poly=doc.createElementNS(NS,'Polygon'),outer=doc.createElementNS(NS,'outerBoundaryIs'),ring=doc.createElementNS(NS,'LinearRing');
  ring.appendChild(text(doc,'coordinates',circleRingAt(owner.lat,owner.lng,50)));
  outer.appendChild(ring);poly.appendChild(outer);pm.appendChild(poly);document.appendChild(pm);
 }
 zip.file('doc.kml',new XMLSerializer().serializeToString(doc));
 return zip.generateAsync({type:'uint8array'});
}
async function audited(bytes){const stage=await stageKmlInput(bytes,deps),r=diagnoseKmzCandidate(stage);assert.equal(r.disposition,'READY',JSON.stringify(r.issues));return stage;}
async function session(bytes,storage=null){const s=createIsolatedEditorSession({...deps,storage});assert.equal((await s.prepare(bytes)).status,'REVIEW');assert.equal(s.acceptPrepared({confirmed:true}).applied,true);return s;}
const circles=stage=>stage.places.filter(p=>p.geometry==='Polygon'&&p.data.some(d=>d.value==='distance-circle'));
const get=(p,k)=>p.data.find(d=>d.name==='campsite.creative.'+k)?.value;
const store=()=>{const m=new Map([['next-lab-creative-v7','DO_NOT_TOUCH']]);return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};

test('circleRingAt builds closed 49-point rings with exact 30/40/50 meter geometry',async()=>{
 for(const radius of [30,40,50]){const raw=circleRingAt(35.64,139.85,radius),p=raw.split(' ');assert.equal(p.length,49);assert.equal(p[0],p.at(-1));assert.ok(p.every(x=>x.split(',').length===3));}
 assert.throws(()=>circleRingAt(90,139,50),e=>e.code==='CIRCLE_POSITION');
});
test('source circles are indexed without name/coordinate merging',async()=>{
 const s=await audited(await source());const index=indexDependentCircles(s);assert.equal(index.get('n1').length,1);assert.equal(index.get('e1').length,1);
 assert.equal(circleOverlay(s,[rec('n1'),rec('e1','existing',35.642,139.856)]).length,2);
});
test('moving NEW POI regenerates only its owned ring; untouched owner ring is byte-identical',async()=>{
 const bytes=await source(),original=await audited(bytes),s=await session(bytes);
 const oldCircle=circles(original).find(p=>get(p,'circle-owner-id')==='e1').polygonGeometry.raw;
 assert.equal(s.command({type:'move',id:'n1',lat:35.644,lng:139.8575},{confirmed:true}).ok,true);
 assert.deepEqual(s.state().circles.find(x=>x.ownerId==='n1'),{ownerId:'n1',lat:35.644,lng:139.8575,radius:50});
 const next=await audited((await s.exportKmz()).bytes);
 assert.equal(next.places.filter(p=>p.geometry==='Point').length,2);assert.equal(circles(next).length,2);
 assert.equal(circles(next).find(p=>get(p,'circle-owner-id')==='e1').polygonGeometry.raw,oldCircle);
 assert.notEqual(circles(next).find(p=>get(p,'circle-owner-id')==='n1').polygonGeometry.raw,
  circles(original).find(p=>get(p,'circle-owner-id')==='n1').polygonGeometry.raw);
 const changed=next.places.find(p=>p.geometry==='Point'&&get(p,'id')==='n1');assert.equal(changed.coordinates,'139.8575,35.644');
});
test('existing owner location cannot move and dependent ring is intact',async()=>{
 const bytes=await source(),s=await session(bytes),before=s.state();
 assert.throws(()=>s.command({type:'move',id:'e1',lat:35.67,lng:139.87},{confirmed:true}),e=>e.code==='EXISTING_POSITION_LOCKED');
 assert.deepEqual(s.state().records,before.records);
 assert.equal((await audited((await s.exportKmz()).bytes)).places.length,4);
});
test('delete removes owner and circle together, undo restores exact ring, redo removes again',async()=>{
 const bytes=await source(),s=await session(bytes),prior=await audited(bytes);
 assert.equal(s.command({type:'delete',id:'n1'},{confirmed:true}).ok,true);
 let after=await audited((await s.exportKmz()).bytes);
 assert.equal(after.places.length,2);assert.equal(circles(after).length,1);
 assert.equal(s.state().circles.length,1);
 assert.equal(s.undo().ok,true);after=await audited((await s.exportKmz()).bytes);
 assert.equal(after.places.length,4);assert.equal(s.state().circles.length,2);
 assert.equal(circles(after).find(p=>get(p,'circle-owner-id')==='n1').polygonGeometry.raw,
  circles(prior).find(p=>get(p,'circle-owner-id')==='n1').polygonGeometry.raw);
 assert.equal(s.redo().ok,true);assert.equal((await audited((await s.exportKmz()).bytes)).places.length,2);
});
test('two-generation draft preserves deletion tombstone and linked circle through resume',async()=>{
 const storage=store(),bytes=await source(),s=await session(bytes,storage);
 s.command({type:'delete',id:'n1'},{confirmed:true});assert.equal((await s.saveDraft()).status,'SAVED');
 const resumed=createIsolatedEditorSession({...deps,storage});assert.equal((await resumed.resumeDraft({confirmed:true})).applied,true);
 assert.equal(resumed.state().records.find(p=>p.id==='n1').deleted,true);
 assert.equal(resumed.state().circles.length,1);
 assert.equal((await audited((await resumed.exportKmz()).bytes)).places.length,2);
 assert.equal(storage.getItem('next-lab-creative-v7'),'DO_NOT_TOUCH');
});
test('moving imported source owner with attached circles updates ring, not activity areas',async()=>{
 const bytes=await source(['n1']),s=await session(bytes);
 const after=s.command({type:'move',id:'n1',lat:35.645,lng:139.855},{confirmed:true});assert.equal(after.ok,true);
 const a=await audited((await s.exportKmz()).bytes);assert.equal(circles(a).length,1);
 assert.equal(s.state().circles[0].lat,35.645);
});
