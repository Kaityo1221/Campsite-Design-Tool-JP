import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseKmzCandidate } from '../core/diagnose-kmz-candidate.mjs';

const tag = (name, value) => ({name,value});
function poi(id='p1', role='existing', kind='pokestop', lng='139.1', lat='35.1') {
  return {
    geometry:'Point', geometryCount:1, coordinates:lng+','+lat,
    name:'名称'+id, description:'メモ'+id,
    data:[tag('campsite.creative.object','poi'),tag('campsite.creative.id',id),tag('campsite.creative.role',role),
      tag('campsite.creative.kind',kind),tag('campsite.creative.title','名称'+id),tag('campsite.creative.memo','メモ'+id),
      tag('campsite.creative.lat',lat),tag('campsite.creative.lng',lng)]
  };
}
function staged(places=[poi()]) { return { audit:{zipValid:true,boundedExtraction:true,safePaths:true,safeXml:true,kmlCount:1,allObjectsCount:places.length,unknownInformationPreserved:true},documentData:[tag('campsite.creative.format','creative-mode-next'),tag('campsite.creative.version','1')],places}; }
function legacy() { const p=poi();p.name='旧POI';p.data=[tag('nextlab-layer','existing-pokestop')];p.folder='既存 PokéStop';p.styleUrl='#creative-existing-pokestop';return p; }
function result(places) { return diagnoseKmzCandidate(staged(places)); }
const has=(r,code)=>r.issues.some(x=>x.code===code);

test('new v1 valid ready but never auto-applies',()=>{const r=result([poi()]);assert.equal(r.disposition,'READY');assert.equal(r.canApply,false);assert.equal(r.counts.existing,1)});
test('diagnostic does not mutate staged input',()=>{const s=staged();const old=JSON.stringify(s);diagnoseKmzCandidate(s);assert.equal(JSON.stringify(s),old)});
test('same name is warned but separate',()=>{const a=poi('1'),b=poi('2');b.name=a.name;b.data.find(x=>x.name.endsWith('.title')).value=a.name;const r=result([a,b]);assert.equal(r.disposition,'READY');assert.ok(has(r,'NAME_DUPLICATE'))});
test('duplicate internal ID holds',()=>{const r=result([poi('dup'),poi('dup')]);assert.equal(r.disposition,'HOLD');assert.ok(has(r,'ID_COLLISION'))});
test('trailing zero coordinates are semantically identical',()=>{const p=poi();p.coordinates='139.100,35.1000,0';assert.equal(result([p]).disposition,'READY')});
test('coordinate difference holds',()=>{const p=poi();p.coordinates='139.100001,35.1';assert.equal(result([p]).disposition,'HOLD')});
test('missing coordinate altitude rejected if comma remains',()=>{const p=poi();p.coordinates='139.1,35.1,';assert.equal(result([p]).disposition,'HOLD')});
test('latitude out of bounds holds',()=>{const p=poi();p.coordinates='139.1,91';assert.equal(result([p]).disposition,'HOLD')});
test('incomplete document marker never falls back',()=>{const s=staged();s.documentData.pop();const r=diagnoseKmzCandidate(s);assert.equal(r.disposition,'HOLD');assert.equal(r.profile,'NEW_V1')});
test('unknown version holds',()=>{const s=staged();s.documentData[1].value='2';assert.equal(diagnoseKmzCandidate(s).disposition,'HOLD')});
test('duplicated required key holds',()=>{const p=poi();p.data.push(tag('campsite.creative.role','existing'));assert.equal(result([p]).disposition,'HOLD')});
test('memo mismatch holds',()=>{const p=poi();p.description='別メモ';assert.equal(result([p]).disposition,'HOLD')});
test('missing description warns, retains dedicated memo',()=>{const p=poi();delete p.description;const r=result([p]);assert.equal(r.disposition,'READY');assert.ok(has(r,'DESCRIPTION_ABSENT'))});
test('500 existing warns',()=>{const r=result(Array.from({length:500},(_,i)=>poi(String(i))));assert.equal(r.disposition,'READY');assert.ok(has(r,'EXISTING_LARGE'))});
test('700 existing can continue',()=>{const r=result(Array.from({length:700},(_,i)=>poi(String(i))));assert.equal(r.disposition,'READY')});
test('701 existing rejects all',()=>{const r=result(Array.from({length:701},(_,i)=>poi(String(i))));assert.equal(r.disposition,'REJECT');assert.ok(has(r,'EXISTING_OVER_700'))});
test('26 new warns but does not reject',()=>{const r=result(Array.from({length:26},(_,i)=>poi(String(i),'new','pokestop')));assert.equal(r.disposition,'READY');assert.ok(has(r,'NEW_LIMIT_EXCEEDED'))});
test('bad archive rejects',()=>{const s=staged();s.audit.zipValid=false;assert.equal(diagnoseKmzCandidate(s).disposition,'REJECT')});
test('more than one KML holds',()=>{const s=staged();s.audit.kmlCount=2;assert.equal(diagnoseKmzCandidate(s).disposition,'HOLD')});
test('unknown geometry holds',()=>{const r=result([poi(),{geometry:'LineString'}]);assert.equal(r.disposition,'HOLD');assert.equal(r.counts.unknown,1)});
test('no silent Placemark drop',()=>{const s=staged();s.audit.allObjectsCount=2;assert.equal(diagnoseKmzCandidate(s).disposition,'HOLD')});
test('legacy profile remains HOLD until actual verification',()=>{const s=staged([legacy()]);s.documentData=[];const r=diagnoseKmzCandidate(s);assert.equal(r.disposition,'HOLD');assert.equal(r.profile,'LEGACY_CREATIVE_KASAI_CANDIDATE');assert.equal(r.counts.existing,1)});
test('legacy without nextlab-layer holds',()=>{const s=staged([legacy()]);s.documentData=[];s.places[0].data=[];assert.equal(diagnoseKmzCandidate(s).disposition,'HOLD')});
test('verified activity polygon not counted as POI',()=>{const s=staged([poi(),{geometry:'Polygon',polygonValid:true,data:[tag('campsite.creative.object','activity-area'),tag('campsite.creative.area-id','area1')]}]);const r=diagnoseKmzCandidate(s);assert.equal(r.disposition,'READY');assert.equal(r.counts.activityAreas,1);assert.equal(r.counts.existing,1)});
test('synthetic Kasai-shaped manifest: 213 POI, 213 circles, one area remains HOLD',()=>{
  const groups=[['existing-pokestop','既存 PokéStop',127],['existing-gym','既存 Gym',25],['existing-power','既存 PowerSpot',36],['new-pokestop','新規 PokéStop',12],['new-gym','新規 Gym',8],['new-power','新規 PowerSpot',5]];
  const places=[];
  for(const [layer,folder,count] of groups){
    for(let i=0;i<count;i++){
      const p=legacy();
      p.name=folder+' '+i;p.folder=folder;p.styleUrl='#creative-'+layer;
      p.data=[tag('nextlab-layer',layer)];
      p.coordinates=(139+places.length/10000).toFixed(7)+','+(35+places.length/10000).toFixed(7);
      places.push(p);
    }
  }
  for(let i=0;i<213;i++)places.push({geometry:'Polygon',legacyShapeVerified:true,legacyShape:'distance-circle'});
  places.push({geometry:'Polygon',legacyShapeVerified:true,legacyShape:'activity-area'});
  const s=staged(places);s.documentData=[];
  const r=diagnoseKmzCandidate(s);
  assert.equal(places.length,427);assert.equal(r.profile,'LEGACY_CREATIVE_KASAI_CANDIDATE');
  assert.equal(r.disposition,'HOLD');assert.equal(r.counts.existing,188);assert.equal(r.counts.newTotal,25);
  assert.deepEqual(r.counts.newByKind,{pokestop:12,gym:8,power:5});
  assert.equal(r.counts.circles,213);assert.equal(r.counts.activityAreas,1);
});
test('same external GUID with different internal IDs is a warning, not a merge',()=>{
  const a=poi('a'),b=poi('b');
  a.data.push(tag('campsite.creative.guid','external-1'));
  b.data.push(tag('campsite.creative.guid','external-1'));
  const r=result([a,b]);assert.equal(r.disposition,'READY');assert.equal(r.counts.existing,2);assert.ok(has(r,'GUID_DUPLICATE'));
});
test('unknown polygon is never silently dropped',()=>{
  const r=result([poi(),{geometry:'Polygon',data:[]}]);
  assert.equal(r.disposition,'HOLD');assert.equal(r.counts.unknown,1);assert.ok(has(r,'GEOMETRY_UNKNOWN'));
});
test('existing 701 is REJECT even with other BLOCK issues',()=>{
  const s=staged(Array.from({length:701},(_,i)=>poi(String(i))));s.audit.kmlCount=2;
  assert.equal(diagnoseKmzCandidate(s).disposition,'REJECT');
});