import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { stageKmlInput } from '../core/stage-kmz.mjs';
import { diagnoseKmzCandidate } from '../core/diagnose-kmz-candidate.mjs';

const opts = {JSZip, DOMParser};
const enc = new TextEncoder();
const tag=(name,value)=>`<Data name="${name}"><value>${value}</value></Data>`;
const xmlEscape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const meta=t=>`<ExtendedData>${t}</ExtendedData>`;
const docHeader=meta(tag('campsite.creative.format','creative-mode-next')+tag('campsite.creative.version','1'));
function p(id='p1',{role='existing',kind='pokestop',lat='35.123450',lng='139.123450',memo='漢字 &amp; 記号',name='名称',sourceAlt=',0'}={}){
  return `<Placemark><name>${name}</name><description>${memo}</description>${meta([
    tag('campsite.creative.object','poi'),tag('campsite.creative.id',id),tag('campsite.creative.role',role),
    tag('campsite.creative.kind',kind),tag('campsite.creative.title',name),tag('campsite.creative.memo',memo),
    tag('campsite.creative.lat',lat),tag('campsite.creative.lng',lng)].join(''))}<Point><coordinates>${lng},${lat}${sourceAlt}</coordinates></Point></Placemark>`;
}
const wrap=(body,documentData=docHeader)=>`<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>${documentData}${body}</Document></kml>`;
async function zip(files){const z=new JSZip();for(const [key,val] of Object.entries(files))z.file(key,val);return z.generateAsync({type:'uint8array',compression:'DEFLATE'});}
async function stage(input){return stageKmlInput(input,opts)}
function check(stage){return diagnoseKmzCandidate(stage)}
const plain=wrap(`<Folder><name>既存 PokéStop</name>${p()}</Folder>`);

test('real ZIP + XML are staged with no auto-apply',async()=>{
  const raw=await zip({'doc.kml':plain,'creative-icons/existing.png':Uint8Array.from([1,2,3])});
  const s=await stage(raw);assert.deepEqual(s.errors,[]);
  assert.equal(s.sourceFormat,'kmz');assert.equal(s.sourcePath,'doc.kml');assert.equal(s.audit.allObjectsCount,1);
  assert.equal(s.audit.unknownInformationPreserved,true);assert.deepEqual(s.rawSource,raw);
  assert.equal(s.places[0].sourceGeometry.coordinates,'139.123450,35.123450,0');
  assert.equal(s.places[0].description,'漢字 & 記号');
  const result=check(s);assert.equal(result.disposition,'READY');assert.equal(result.canApply,false);
});

test('plain KML is staged separately without ZIP',async()=>{
  const s=await stage(enc.encode(plain));assert.deepEqual(s.errors,[]);assert.equal(s.sourceFormat,'kml');assert.equal(check(s).disposition,'READY');
});

test('two KMLs never pick a silent winner',async()=>{
  const s=await stage(await zip({'doc.kml':plain,'extra.kml':plain}));assert.equal(s.audit.kmlCount,2);
  assert.equal(s.errors[0].code,'KML_AMBIGUOUS');assert.equal(s.places.length,0);
  assert.equal(check(s).disposition,'HOLD');
});

test('unknown extra Placemark geometry holds, not drops',async()=>{
  const kml=wrap(p()+'<Placemark><name>線</name><LineString><coordinates>139,35 139.1,35</coordinates></LineString></Placemark>');
  const s=await stage(await zip({'doc.kml':kml}));assert.equal(s.places.length,2);
  assert.equal(check(s).disposition,'HOLD');
});

test('malformed XML is held without loading any POI',async()=>{
  const s=await stage(await zip({'doc.kml':'<kml><Document><Placemark></kml>'}));
  assert.equal(s.audit.safeXml,false);assert.equal(s.places.length,0);assert.equal(check(s).disposition,'HOLD');
});

test('external DOCTYPE is forbidden and never fetched',async()=>{
  const s=await stage(await zip({'doc.kml':'<!DOCTYPE kml [<!ENTITY foo SYSTEM "file:///etc/passwd">]>'+plain}));
  assert.equal(s.errors[0].code,'XML_UNSAFE');assert.equal(check(s).disposition,'REJECT');
});

test('ZIP declared expansion too large rejects before XML parsing',async()=>{
  const huge=wrap(p())+' '.repeat(20000);
  const s=await stageKmlInput(await zip({'doc.kml':huge}),{...opts,limits:{maxExpandedBytes:1000}});
  assert.equal(s.errors[0].code,'ZIP_BOMB');assert.equal(check(s).disposition,'REJECT');
});

test('compressed input safety envelope is enforced',async()=>{
  const raw=await zip({'doc.kml':plain});
  await assert.rejects(()=>stageKmlInput(raw,{...opts,limits:{maxArchiveBytes:16}}),e=>e.code==='ARCHIVE_TOO_LARGE');
});

test('ZIP path traversal is detected before JSZip normalization',async()=>{
  const raw=await zip({'AA/c.kml':plain});
  const b=enc.encode('AA/c.kml'),c=enc.encode('../c.kml');
  let replacements=0;
  for(let i=0;i<raw.length-b.length;i++){
    if(b.every((v,j)=>raw[i+j]===v)){raw.set(c,i);replacements++}
  }
  assert.ok(replacements>=2);
  const s=await stage(raw);assert.equal(s.errors[0].code,'ZIP_PATH');assert.equal(check(s).disposition,'REJECT');
});

test('cancelled staging does not parse or mutate anything',async()=>{
  const ac=new AbortController();ac.abort();const s=await stageKmlInput(await zip({'doc.kml':plain}),{...opts,signal:ac.signal});
  assert.equal(s.places.length,0);assert.equal(s.errors[0].code,'CANCELLED');
});

test('legacy layer is diagnosed, never auto-imported',async()=>{
  const old=wrap('<Folder><name>既存 PokéStop</name><Placemark><name>旧スポット</name>'+meta(tag('nextlab-layer','existing-pokestop'))+'<styleUrl>#creative-existing-pokestop</styleUrl><Point><coordinates>139.1234,35.1234,0</coordinates></Point></Placemark></Folder>','');
  const s=await stage(await zip({'doc.kml':old}));const r=check(s);
  assert.equal(s.places[0].folder,'既存 PokéStop');assert.equal(r.profile,'LEGACY_CREATIVE_KASAI_CANDIDATE');assert.equal(r.disposition,'HOLD');
});

test('new-form literal repeated IDs cannot merge',async()=>{
  const s=await stage(await zip({'doc.kml':wrap(p('p1')+p('p1',{name:'別の名'}))}));
  assert.equal(s.places.length,2);assert.equal(check(s).disposition,'HOLD');
});

test('original KML, unrelated resources and Japanese unknown Data remain intact in raw bytes',async()=>{
  const extra=tag('foreign:annotation','永続情報');
  const kml=plain.replace('</ExtendedData>',extra+'</ExtendedData>');
  const raw=await zip({'doc.kml':kml,'images/annotation.txt':'重要な補足'});
  const s=await stage(raw);assert.deepEqual(s.rawSource,raw);assert.equal(s.sourceKml,kml);
  assert.equal(check(s).disposition,'READY');
});

test('bad CRC in unrelated bundled resource is also rejected',async()=>{
  const raw=await zip({'doc.kml':plain,'other/notes.txt':'original data'});
  // Flip a central-directory CRC, without breaking ZIP directory structure.
  const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
  let flipped=false;
  for(let i=0;i<raw.length-40;i++){
    if(view.getUint32(i,true)===0x02014b50){
      const length=view.getUint16(i+28,true);
      const name=new TextDecoder().decode(raw.subarray(i+46,i+46+length));
      if(name==='other/notes.txt'){raw[i+16]^=0xff;flipped=true;break;}
    }
  }
  assert.equal(flipped,true);
  const s=await stage(raw);assert.equal(s.errors[0].code,'ZIP_INVALID');assert.equal(check(s).disposition,'REJECT');
});

test('network-linked KML feature is never silently accepted',async()=>{
  const s=await stage(enc.encode(wrap(p()+'<NetworkLink><name>remote</name><Link><href>https://example.invalid/doc.kml</href></Link></NetworkLink>')));
  assert.deepEqual(s.errors,[]);assert.equal(s.audit.unhandledFeatures,1);
  assert.equal(check(s).disposition,'HOLD');
});

test('valid KML Document but no Point Placemark remains HOLD',async()=>{
  const s=await stage(enc.encode(wrap('')));assert.deepEqual(s.errors,[]);
  assert.equal(check(s).disposition,'HOLD');
});

test('wrong ZIP local filename rejects before any decompression',async()=>{
  const raw=await zip({'doc.kml':plain});
  const needle=enc.encode('doc.kml');let n=0;
  for(let i=0;i<raw.length-needle.length;i++)if(needle.every((v,j)=>raw[i+j]===v)){
    if(n++===0){raw[i]=enc.encode('b')[0];break;}
  }
  assert.ok(n>0);
  const s=await stage(raw);assert.equal(s.errors[0].code,'ZIP_INVALID');
});

test('KMZ filename cannot be bypassed with a non-ZIP payload',async()=>{
  const b=enc.encode(plain);
  const file={size:b.byteLength,name:'bad.kmz',arrayBuffer:async()=>b.buffer};
  const s=await stage(file);
  assert.equal(s.errors[0].code,'ZIP_INVALID');assert.equal(check(s).disposition,'REJECT');
});

test('legacy radius circle is recognized only with structural and shape evidence',async()=>{
  const coords=[];const lat=35.1,lng=139.2;
  for(let i=0;i<=48;i++){
    const R=6378137,d=50/R,la=lat*Math.PI/180,lo=lng*Math.PI/180,b=2*Math.PI*i/48;
    const y=Math.asin(Math.sin(la)*Math.cos(d)+Math.cos(la)*Math.sin(d)*Math.cos(b));
    const x=lo+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(la),Math.cos(d)-Math.sin(la)*Math.sin(y));
    coords.push(`${(x*180/Math.PI).toFixed(7)},${(y*180/Math.PI).toFixed(7)},0`);
  }
  const oldPoint='<Folder><name>既存 PokéStop</name><Placemark><name>旧POI</name>'+meta(tag('nextlab-layer','existing-pokestop'))+'<Point><coordinates>139.2,35.1,0</coordinates></Point></Placemark></Folder>';
  const circle=`<Folder><name>50m サークル</name><Placemark><name>50m 1</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords.join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Folder>`;
  const s=await stage(await zip({'doc.kml':wrap(oldPoint+circle,'')}));
  assert.deepEqual(s.errors,[]);assert.equal(s.places.length,2);
  assert.equal(s.places[1].legacyShapeVerified,true);assert.equal(s.places[1].legacyShape,'distance-circle');
  const r=check(s);assert.equal(r.counts.circles,1);assert.equal(r.disposition,'HOLD');
  // Mere circle-like folder names without proof of radius remain unknown.
  const changed=wrap(oldPoint+circle.replaceAll('50m 1','50m suspected'),'');
  const s2=await stage(await zip({'doc.kml':changed}));
  assert.equal(s2.places[1].legacyShapeVerified,undefined);assert.equal(check(s2).counts.unknown,1);
});

test('synthetic 427-Placemark old Creative KMZ: full ZIP/XML read preserves all 213 POIs and 214 polygons',async()=>{
  const groups=[['existing-pokestop','既存 PokéStop',127],['existing-gym','既存 Gym',25],
    ['existing-power','既存 PowerSpot',36],['new-pokestop','新規 PokéStop',12],
    ['new-gym','新規 Gym',8],['new-power','新規 PowerSpot',5]];
  let next=0;
  const pois=[];
  let folders='';
  for(const [layer,folder,count] of groups){
    let body='';
    for(let i=0;i<count;i++){
      const lat=35.6+next*0.00013,lng=139.7+next*0.00014;
      pois.push([lat,lng]);
      body+=`<Placemark><name>${folder} ${i}</name><description>説明: POKESTOP</description>${meta(tag('nextlab-layer',layer))}<styleUrl>#creative-${layer}</styleUrl><Point><coordinates>${lng.toFixed(7)},${lat.toFixed(7)},0</coordinates></Point></Placemark>`;
      next++;
    }
    folders+=`<Folder><name>${folder}</name>${body}</Folder>`;
  }
  assert.equal(pois.length,213);
  let circles='';
  for(let i=0;i<213;i++){
    const [lat,lng]=pois[i],coords=[];
    for(let step=0;step<=48;step++){
      const la=lat*Math.PI/180,lo=lng*Math.PI/180,d=50/6378137,b=2*Math.PI*step/48;
      const y=Math.asin(Math.sin(la)*Math.cos(d)+Math.cos(la)*Math.sin(d)*Math.cos(b));
      const x=lo+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(la),Math.cos(d)-Math.sin(la)*Math.sin(y));
      coords.push(`${(x*180/Math.PI).toFixed(7)},${(y*180/Math.PI).toFixed(7)},0`);
    }
    circles+=`<Placemark><name>50m ${i+1}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords.join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
  }
  folders+=`<Folder><name>50m サークル</name>${circles}</Folder>`;
  const poly=['139.65,35.5,0','139.75,35.5,0','139.75,35.7,0','139.65,35.7,0','139.65,35.5,0'].join(' ');
  folders+=`<Folder><name>ポリゴン</name><Placemark><name>ポリゴン 1</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${poly}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Folder>`;
  const raw=await zip({'doc.kml':wrap(folders,''),'creative-icons/a.png':Uint8Array.from([137,80,78,71])});
  const s=await stage(raw),r=check(s);
  assert.deepEqual(s.errors,[]);
  assert.equal(s.places.length,427);assert.equal(s.audit.allObjectsCount,427);
  assert.equal(s.places.filter(p=>p.legacyShapeVerified===true).length,214);
  assert.equal(r.profile,'LEGACY_CREATIVE_KASAI_CANDIDATE');assert.equal(r.disposition,'HOLD');
  assert.equal(r.counts.existing,188);assert.equal(r.counts.newTotal,25);
  assert.deepEqual(r.counts.newByKind,{pokestop:12,gym:8,power:5});
  assert.equal(r.counts.circles,213);assert.equal(r.counts.activityAreas,1);
  assert.equal(r.counts.unknown,0);assert.equal(r.canApply,false);
});