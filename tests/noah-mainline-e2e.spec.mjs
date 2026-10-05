import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs=fs.readFileSync('node_modules/leaflet/dist/leaflet.js','utf8');
const leafletCss=fs.readFileSync('node_modules/leaflet/dist/leaflet.css','utf8');
const jszipJs=fs.readFileSync('node_modules/jszip/dist/jszip.min.js','utf8');

const project={
  schemaVersion:'1.0', source:'bridge', projectId:'noah-mainline-e2e',
  phase:'design', createdAt:'2026-10-05T14:00:00.000Z', updatedAt:'2026-10-05T14:00:00.000Z',
  circleRadii:[50,40,30],
  polygon:[[35.6808,139.7668],[35.6808,139.7692],[35.6832,139.7692],[35.6832,139.7668]],
  sourcePois:[{id:'e-stop',guid:'noah-guid-stop',title:'Noah Existing Stop',lat:35.6814,lng:139.7672,gameEntity:'POKESTOP',gameStatus:'ACTIVE',layer:'existing-pokestop',role:'existing'}],
  selectedPois:[{id:'e-stop',guid:'noah-guid-stop',title:'Noah Existing Stop',lat:35.6814,lng:139.7672,gameEntity:'POKESTOP',gameStatus:'ACTIVE',layer:'existing-pokestop',role:'existing'}],
  currentPois:[
    {id:'e-stop',guid:'noah-guid-stop',title:'Noah Existing Stop',lat:35.6814,lng:139.7672,gameEntity:'POKESTOP',gameStatus:'ACTIVE',layer:'existing-pokestop',role:'existing'},
    {id:'c-stop',guid:'',title:'Noah Candidate Stop',lat:35.6822,lng:139.7682,gameEntity:'POKESTOP',gameStatus:'UNKNOWN',layer:'new-pokestop',role:'added',description:'Noah N1 candidate'}
  ],
  addedPois:[{id:'c-stop',guid:'',title:'Noah Candidate Stop',lat:35.6822,lng:139.7682,gameEntity:'POKESTOP',gameStatus:'UNKNOWN',layer:'new-pokestop',role:'added',description:'Noah N1 candidate'}],
  deletedPois:[], edits:[], distanceResult:null,
  meta:{projectContract:'campsiteProject.v1',flowMode:'next',preview:false}
};

async function install(page){
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:leafletJs}));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',r=>r.fulfill({status:200,contentType:'text/css',body:leafletCss}));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:jszipJs}));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/,r=>r.fulfill({status:204,body:''}));
  await page.route(/https:\/\/server\.arcgisonline\.com\/.*/,r=>r.fulfill({status:204,body:''}));
  await page.route(/https:\/\/(?:raw|media)\.githubusercontent\.com\/.*/,r=>r.fulfill({status:204,body:''}));
  await page.route('**/js/ca-access-bootstrap.js*',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.CampsiteCaAccess=Object.freeze({test:true});'}));
  await page.addInitScript(value=>sessionStorage.setItem('campsiteProject.v1',JSON.stringify(value)),project);
}

async function record(page,id){
  return page.evaluate(recordId=>{
    const item=window.CampsiteCreativeWorkspace?.getSnapshot?.()?.records?.find(x=>x?.id===recordId);
    if(!item)return null;
    return {id:item.id,deleted:item.deleted===true,latlng:Array.isArray(item.latlng)?item.latlng.map(v=>Number(Number(v).toFixed(6))):null};
  },id);
}

test('N1 hidden Noah mainline reaches completed Creative and preserves project state',async({page})=>{
  await install(page);
  await page.goto('/creative/index.html?campsiteProject=bridge');

  await expect.poll(()=>page.evaluate(()=>window.CampsiteCreativeProject?.projectId||''),{timeout:15000}).toBe(project.projectId);
  await expect.poll(()=>page.evaluate(()=>window.__cmCandidateShadow?.getState?.()?.interactionOwner||''),{timeout:15000}).toBe('map-engine');
  await expect.poll(()=>page.evaluate(()=>typeof window.CampsiteCreativeWorkspace?.getSnapshot==='function'),{timeout:15000}).toBe(true);

  await expect(page.locator('.cm-engine-existing-icon')).toHaveCount(1);
  await expect(page.locator('.cm-engine-candidate-icon')).toHaveCount(1);
  const state=await page.evaluate(()=>window.__cmCandidateShadow.getState());
  expect(state.rendered).toEqual({markers:2,circles50:2,circles40:2,circles30:2});

  const before=await record(page,'c-stop');
  expect(before).toBeTruthy();

  const candidate=page.locator('.cm-engine-candidate-icon');
  await candidate.click();
  await expect(page.locator('#cmMove')).toBeVisible();
  await page.locator('#cmMove').click();

  const map=page.locator('.leaflet-container').first();
  const box=await map.boundingBox(); expect(box).toBeTruthy();
  const x=box.x+box.width*.5,y=box.y+box.height*.45;
  await page.mouse.move(x,y); await page.mouse.down();
  await page.mouse.move(x+24,y-18,{steps:8}); await page.mouse.up();
  await page.locator('#cmMoveConfirm').click();

  const moved=await record(page,'c-stop');
  expect(moved.latlng).not.toEqual(before.latlng);
  await page.locator('#undo').click();
  await expect.poll(async()=>(await record(page,'c-stop'))?.latlng).toEqual(before.latlng);
  await page.locator('#redo').click();
  await expect.poll(async()=>(await record(page,'c-stop'))?.latlng).toEqual(moved.latlng);

  const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('campsiteProject.v1')||'null'));
  expect(saved.projectId).toBe(project.projectId);
  expect(saved.polygon).toEqual(project.polygon);
  expect(saved.currentPois.some(p=>p.id==='e-stop')).toBe(true);
  expect(saved.currentPois.some(p=>p.id==='c-stop')).toBe(true);
  const savedCandidate=saved.currentPois.find(p=>p.id==='c-stop');
  expect([Number(savedCandidate.lat),Number(savedCandidate.lng)].map(v=>Number(v.toFixed(6)))).toEqual(moved.latlng);
});
