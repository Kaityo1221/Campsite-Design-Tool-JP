import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs=fs.readFileSync('node_modules/leaflet/dist/leaflet.js','utf8');
const leafletCss=fs.readFileSync('node_modules/leaflet/dist/leaflet.css','utf8');
const jszipJs=fs.readFileSync('node_modules/jszip/dist/jszip.min.js','utf8');

const project={
  source:'bridge',projectId:'phase5-d11-default-e2e',phase:'design',
  createdAt:'2026-09-30T12:20:00.000Z',updatedAt:'2026-09-30T12:20:00.000Z',
  circleRadii:[50,40,30],
  polygon:[[35.6808,139.7668],[35.6808,139.7692],[35.6832,139.7692],[35.6832,139.7668]],
  selectedPois:[
    {id:'e-stop',guid:'guid-stop',title:'Existing Stop',lat:35.68140,lng:139.76720,gameEntity:'POKESTOP',gameStatus:'ACTIVE',layer:'existing-pokestop',role:'existing'},
    {id:'e-gym',guid:'guid-gym',title:'Existing Gym',lat:35.68170,lng:139.76760,gameEntity:'GYM',gameStatus:'ACTIVE',layer:'existing-gym',role:'existing'},
    {id:'e-power',guid:'guid-power',title:'Existing Power',lat:35.68200,lng:139.76800,gameEntity:'POWERSPOT',gameStatus:'ACTIVE',layer:'existing-power',role:'existing'},
    {id:'e-inactive',guid:'guid-inactive',title:'Inactive Power',lat:35.68230,lng:139.76840,gameEntity:'POWERSPOT',gameStatus:'INACTIVE',layer:'existing-power',role:'existing'},
    {id:'c-stop',guid:'',title:'Candidate Stop',lat:35.68260,lng:139.76880,gameEntity:'POKESTOP',gameStatus:'UNKNOWN',layer:'new-pokestop',role:'added'}
  ]
};
project.currentPois=project.selectedPois.map(item=>({...item}));

function collectBrowserErrors(page){
  const errors=[];
  page.on('console',message=>{if(message.type()==='error')errors.push(`console: ${message.text()}`)});
  page.on('pageerror',error=>errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function seedProject(page){
  await page.addInitScript(value=>sessionStorage.setItem('campsiteProject.v1',JSON.stringify(value)),project);
}

async function expectProjectReady(page){
  await expect.poll(()=>page.evaluate(()=>window.CampsiteCreativeProject?.count||0),{timeout:15000}).toBe(5);
}

test.beforeEach(async({page})=>{
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:leafletJs}));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',route=>route.fulfill({status:200,contentType:'text/css',body:leafletCss}));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:jszipJs}));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/,route=>route.fulfill({status:204,body:''}));
  await page.route(/https:\/\/server\.arcgisonline\.com\/.*/,route=>route.fulfill({status:204,body:''}));
  await page.route(/https:\/\/(?:raw|media)\.githubusercontent\.com\/.*/,route=>route.fulfill({status:204,body:''}));
  await page.route('**/js/ca-access-bootstrap.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.CampsiteCaAccess=Object.freeze({test:true});'}));
  await seedProject(page);
});

test('Phase 5-D11 no-query Creative Mode defaults to Unified Interactive',async({page})=>{
  const browserErrors=collectBrowserErrors(page);
  await page.goto('/creative/index.html?campsiteProject=bridge');
  await expectProjectReady(page);
  await expect.poll(()=>page.evaluate(()=>window.__cmCandidateShadow?.getState?.()?.interactionOwner||''),{timeout:15000}).toBe('map-engine');

  const state=await page.evaluate(()=>window.__cmCandidateShadow.getState());
  expect(state.ready).toBe(true);
  expect(state.unifiedVisible).toBe(true);
  expect(state.interactive).toBe(true);
  expect(state.interactionOwner).toBe('map-engine');
  expect(state.rendered).toEqual({markers:5,circles50:5,circles40:5,circles30:5});

  await expect(page.locator('.cm-engine-existing-icon')).toHaveCount(4);
  await expect(page.locator('.cm-engine-candidate-icon')).toHaveCount(1);
  expect(await page.locator('.cm-engine-candidate-icon').evaluate(el=>getComputedStyle(el).pointerEvents)).toBe('auto');

  await page.locator('.cm-engine-candidate-icon').click();
  await expect(page.locator('.cm-sheet')).toBeVisible();
  await expect(page.locator('#cmMove')).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('Phase 5-D11 legacy query restores legacy visual and interaction ownership',async({page})=>{
  const browserErrors=collectBrowserErrors(page);
  await page.goto('/creative/index.html?campsiteProject=bridge&unifiedRenderer=legacy');
  await expectProjectReady(page);
  await expect.poll(()=>page.evaluate(()=>window.__cmCandidateShadow?.getState?.()?.interactionOwner||''),{timeout:15000}).toBe('legacy');

  const state=await page.evaluate(()=>window.__cmCandidateShadow.getState());
  expect(state.ready).toBe(true);
  expect(state.unifiedVisible).toBe(false);
  expect(state.interactive).toBe(false);
  expect(state.interactionOwner).toBe('legacy');

  await expect(page.locator('.cm-engine-candidate-icon')).toHaveCount(1);
  await expect(page.locator('.cm-engine-legacy-candidate')).toHaveCount(1);
  expect(await page.locator('.cm-engine-candidate-icon').evaluate(el=>getComputedStyle(el).pointerEvents)).toBe('none');
  expect(await page.locator('.cm-engine-legacy-candidate').evaluate(el=>getComputedStyle(el).pointerEvents)).not.toBe('none');

  await page.locator('.cm-engine-legacy-candidate').click();
  await expect(page.locator('.cm-sheet')).toBeVisible();
  await expect(page.locator('#cmMove')).toBeVisible();
  expect(browserErrors).toEqual([]);
});
