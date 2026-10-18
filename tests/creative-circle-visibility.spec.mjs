import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs = fs.readFileSync('node_modules/leaflet/dist/leaflet.js', 'utf8');
const leafletCss = fs.readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');
const jszipJs = fs.readFileSync('node_modules/jszip/dist/jszip.min.js', 'utf8');
const project = {
  source: 'bridge', projectId: 'circle-visibility-regression', phase: 'design',
  circleRadii: [50, 40, 30],
  polygon: [[35.681,139.767],[35.681,139.770],[35.684,139.770],[35.684,139.767]],
  selectedPois: [
    {id:'existing-stop',guid:'existing-stop',title:'Existing stop',lat:35.6816,lng:139.7676,gameEntity:'POKESTOP',gameStatus:'ACTIVE',layer:'existing-pokestop',role:'existing'},
    {id:'candidate-stop',title:'Candidate stop',lat:35.6822,lng:139.7682,gameEntity:'POKESTOP',layer:'new-pokestop',role:'added'}
  ]
};
project.currentPois = structuredClone(project.selectedPois);
project.wayfarerObservation = {
  version:'0.2.0', snapshotId:'circle-reference-snapshot', observedAt:'2026-10-18T00:00:00.000Z',
  acquisition:{bufferMeters:200,coverageComplete:false}, polygon:structuredClone(project.polygon),
  zones:{
    interior:[{guid:'observed-inside',title:'Observed gym',lat:35.683,lng:139.769,poiKind:'GYM',gameEntity:'GYM',gameStatus:'ACTIVE'}],
    reference100:[{guid:'observed-outer',title:'Observed outer stop',lat:35.6843,lng:139.769,poiKind:'POKESTOP',gameEntity:'POKESTOP',gameStatus:'ACTIVE'}],
    reserve200:[]
  }, counts:{interior:{total:1},reference100:{total:1},reserve200:{total:0}}
};

async function prepare(page, seed = project) {
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', route => route.fulfill({contentType:'application/javascript',body:leafletJs+'\n;L.Map.addInitHook(function(){window.__circleTestMap=this});'}));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', route => route.fulfill({contentType:'text/css',body:leafletCss}));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', route => route.fulfill({contentType:'application/javascript',body:jszipJs}));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/, route => route.fulfill({status:204,body:''}));
  await page.route(/https:\/\/server\.arcgisonline\.com\/.*/, route => route.fulfill({status:204,body:''}));
  await page.route(/https:\/\/(?:raw|media)\.githubusercontent\.com\/.*/, route => route.fulfill({status:204,body:''}));
  await page.route('**/js/ca-access-bootstrap.js*', route => route.fulfill({contentType:'application/javascript',body:'window.CampsiteCaAccess=Object.freeze({test:true});'}));
  await page.addInitScript(value => sessionStorage.setItem('campsiteProject.v1',JSON.stringify(value)), seed);
}

async function circles(page) {
  return page.evaluate(() => {
    const counts = {50:0,40:0,30:0};
    if (!window.__circleTestMap) return null;
    window.__circleTestMap.eachLayer(layer => {
      if (layer instanceof L.Circle && layer.options.pane==='distance' && layer.options.opacity!==0) {
        const radius = layer.getRadius();
        if (radius in counts) counts[radius]++;
      }
    });
    return counts;
  });
}

const layerToggle = (page, radius) => page.locator('#layerRows button').filter({hasText:new RegExp('^'+radius+'m円$')});
const state = page => page.evaluate(() => window.__cmCandidateShadow.getState());
async function design(page) {
  return page.evaluate(() => {
    const workspace = window.CampsiteCreativeWorkspace.getSnapshot();
    const stored = JSON.parse(sessionStorage.getItem('campsiteProject.v1'));
    return {records:workspace.records,polygons:workspace.polygons,polygonVisible:workspace.polygonVisible,
      currentPois:stored.currentPois,polygon:stored.polygon,observation:stored.wayfarerObservation};
  });
}

for (const observed of [false, true]) {
test(`50m OFF/ON and repaint with observation=${observed}`, async ({ page, browser }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const seed = structuredClone(project);
  if (!observed) delete seed.wayfarerObservation;
  await prepare(page, seed);
  await page.goto('/creative/index.html?campsiteProject=bridge');
  await expect.poll(()=>page.evaluate(()=>window.CampsiteCreativeProject?.count||0)).toBe(2);
  const initial = {50:observed?4:2,40:2,30:2};
  await expect.poll(()=>circles(page)).toEqual(initial);
  const before = await design(page);
  await page.locator('#layerButton').click();
  const toggle = layerToggle(page, 50);
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await expect.poll(()=>circles(page)).toEqual({50:0,40:2,30:2});
  const markers = (await state(page)).rendered.markers;
  expect(markers).toBe(initial[50]);
  await page.screenshot({path:testInfo.outputPath('50m-off.png')});

  // Repaint and observation refresh must not resurrect the orange circles.
  await page.evaluate(() => {
    window.__circleTestMap.panBy([40,20],{animate:false});
    window.__circleTestMap.setZoom(window.__circleTestMap.getZoom()-1,{animate:false});
    window.__cmCandidateShadow.refresh();
    window.dispatchEvent(new Event('campsite:wayfarer-observation-saved'));
  });
  await expect.poll(()=>circles(page)).toEqual({50:0,40:2,30:2});
  // Cross a real autosave tick; only the display preference may change.
  const savedAt = await page.evaluate(()=>JSON.parse(localStorage.getItem('next-lab-creative-current-v1')||'null')?.updatedAt||0);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('next-lab-creative-current-v1')||'null')?.updatedAt||0),{timeout:7000}).toBeGreaterThan(savedAt);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('next-lab-creative-current-v1')).circleExtras.includes(50))).toBe(false);
  expect(await design(page)).toEqual(before);
  expect((await state(page)).rendered.markers).toBe(markers);

  // 40m/30m retain independent controls and are not created for reference POI.
  for (const radius of [40,30]) await layerToggle(page,radius).click();
  await expect.poll(()=>circles(page)).toEqual({50:0,40:0,30:0});
  for (let repeat=0;repeat<3;repeat++) {
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed','true');
    await expect.poll(()=>circles(page)).toEqual({50:initial[50],40:0,30:0});
    await toggle.click();
    await expect.poll(()=>circles(page)).toEqual({50:0,40:0,30:0});
  }
  expect(await design(page)).toEqual(before);
  expect(errors).toEqual([]);
  await testInfo.attach('chrome-evidence', {body:JSON.stringify({browser:browser.version(),viewport:page.viewportSize(),initial,off:await circles(page),markers}),contentType:'application/json'});
});
}

test('dense observation with no candidate leaves no 50m circles when OFF', async ({ page }) => {
  const seed = structuredClone(project);
  seed.selectedPois = seed.selectedPois.filter(p=>p.role==='existing');
  seed.currentPois = structuredClone(seed.selectedPois);
  seed.wayfarerObservation.zones.interior = Array.from({length:300},(_,i)=>({
    guid:'dense-'+i,title:'Observed '+i,lat:35.6813+(i%20)*0.00012,lng:139.7672+Math.floor(i/20)*0.00016,
    poiKind:['POKESTOP','GYM','POWERSPOT'][i%3],gameEntity:['POKESTOP','GYM','POWERSPOT'][i%3],
    gameStatus:i%3===2&&i%2===0?'INACTIVE':'ACTIVE',referenceKind:i%3===2&&i%2===0?'INACTIVE_POWERSPOT':''
  }));
  seed.wayfarerObservation.counts.interior.total=300;
  await prepare(page,seed);
  await page.goto('/creative/index.html?campsiteProject=bridge');
  await expect.poll(()=>circles(page)).toEqual({50:302,40:1,30:1});
  await page.locator('#layerButton').click();
  await layerToggle(page,50).click();
  await expect.poll(()=>circles(page)).toEqual({50:0,40:1,30:1});
  expect((await state(page)).rendered.markers).toBe(302);
});

test('50m OFF preserves the reference distance warning', async ({ page }) => {
  const seed = structuredClone(project);
  const candidate = seed.selectedPois.find(p=>p.role==='added');
  candidate.lat=35.68415;
  candidate.lng=139.769;
  seed.currentPois=structuredClone(seed.selectedPois);
  await prepare(page,seed);
  await page.goto('/creative/index.html?campsiteProject=bridge');
  await expect.poll(()=>circles(page)).toEqual({50:4,40:2,30:2});
  await page.locator('.cm-engine-candidate-icon').click();
  await expect(page.locator('#cmWm6DistanceWarning')).toBeVisible();
  const before = await page.evaluate(()=>window.__cmWayfarerReferenceDistance.getState());
  expect(before.sourceType).toBe('REFERENCE_100');
  expect(before.distanceMeters).toBeLessThan(50);
  await page.locator('.cm-sheet-close').click();
  await page.locator('#layerButton').click();
  await layerToggle(page,50).click();
  await expect.poll(()=>circles(page)).toEqual({50:0,40:2,30:2});
  await page.locator('#layerButton').click();
  await page.locator('.cm-engine-candidate-icon').click();
  await expect(page.locator('#cmWm6DistanceWarning')).toBeVisible();
  expect(await page.evaluate(()=>window.__cmWayfarerReferenceDistance.getState())).toEqual(before);
});
