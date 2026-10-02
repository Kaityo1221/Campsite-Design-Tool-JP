import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import JSZip from 'jszip';

const leafletJs=fs.readFileSync('node_modules/leaflet/dist/leaflet.js','utf8');
const leafletCss=fs.readFileSync('node_modules/leaflet/dist/leaflet.css','utf8');
const jszipJs=fs.readFileSync('node_modules/jszip/dist/jszip.min.js','utf8');
const caAccessStub=`window.CampsiteCaAccess=Object.freeze({checkAccess:async()=>({status:'approved',isApproved:true}),signInWithDiscord:async()=>{},signOut:async()=>{}});`;

function baseProject(){
  const lat=35.681236,lng=139.767125;
  const existing={id:'existing-a',guid:'existing-a',title:'既存A',name:'既存A',lat,lng,role:'existing',gameEntity:'POKESTOP',description:''};
  const added={id:'added-a',guid:'added-a',title:'新規A',name:'新規A',lat:lat+0.00105,lng,role:'added',gameEntity:'POKESTOP',description:'初回確認済み'};
  return{
    schemaVersion:'1.0',projectId:'roundtrip-presentation-e2e',workspaceId:'roundtrip-workspace-e2e',source:'bridge',phase:'design',circleRadii:[50,40,30],
    polygon:[[lat-0.002,lng-0.002],[lat-0.002,lng+0.002],[lat+0.003,lng+0.002],[lat+0.003,lng-0.002]],
    sourcePois:[existing],selectedPois:[existing],currentPois:[existing,added],addedPois:[added],deletedPois:[],edits:[],
    siteEnvironment:{traffic:'easy',plaza:true,circulation:true,waiting:true},distanceResult:null
  };
}
function powerSpotProject(){
  const project=baseProject();
  const power={id:'power-a',guid:'power-a',title:'Bridge PowerSpot',name:'Bridge PowerSpot',lat:35.6817,lng:139.7677,role:'existing',gameEntity:'POWER_SPOT',description:''};
  project.projectId='powerspot-ingress-e2e';project.workspaceId='powerspot-workspace-e2e';project.sourcePois=[power];project.selectedPois=[power];project.currentPois=[power];project.addedPois=[];
  return project;
}
async function installRoutes(page){
  await page.route(/\/js\/ca-access\.js(?:\?.*)?$/,r=>r.fulfill({status:200,contentType:'application/javascript',body:caAccessStub}));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:leafletJs}));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',r=>r.fulfill({status:200,contentType:'text/css',body:leafletCss}));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:jszipJs}));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/,r=>r.fulfill({status:204,body:''}));
}
async function seed(page,project){
  await page.addInitScript(value=>{const key='campsiteProject.v1';if(!sessionStorage.getItem(key))sessionStorage.setItem(key,JSON.stringify(value));},project);
}
async function waitForDistance(page){
  await expect.poll(()=>page.evaluate(()=>Boolean(window.CampsiteDistanceProject&&typeof window.runDistanceCheck==='function')),{timeout:15000}).toBe(true);
}
async function runDistance(page){
  await waitForDistance(page);await page.evaluate(async()=>window.runDistanceCheck());
  const shell=page.locator('.campsite-mission-shell');
  await expect(shell).toHaveCount(1,{timeout:12000});await expect(shell).toHaveAttribute('data-layout-v2','true',{timeout:12000});await expect(shell).toHaveAttribute('data-mission-state-version','1',{timeout:12000});
}
async function openMission4(page){
  const legacy=page.locator('#distanceResult > .campsite-mission-legacy');
  await expect(legacy).not.toHaveAttribute('data-map-open','true');await page.locator('[data-mission-map]').dispatchEvent('click');await expect(legacy).toHaveAttribute('data-map-open','true');
  await expect(page.locator('.campsite-mission-lamp').nth(3)).toHaveAttribute('data-state','green');await expect(page.locator('[data-v2-submit]')).toBeEnabled();
}
async function openPoi(page,title){
  await expect(page.locator('.leaflet-marker-pane .leaflet-marker-icon').first()).toBeVisible({timeout:15000});
  const markers=page.locator('.leaflet-marker-pane .leaflet-marker-icon');
  for(let i=0;i<await markers.count();i++){
    await markers.nth(i).click({force:true});const sheet=page.locator('.cm-sheet');if(!await sheet.isVisible().catch(()=>false))continue;
    const name=sheet.locator('#cmName');if(await name.isVisible().catch(()=>false)){if((await name.inputValue())===title)return;}if((await sheet.innerText()).includes(title))return;
  }
  throw new Error(`POI sheet not found: ${title}`);
}

test.beforeEach(async({page})=>installRoutes(page));

test('CREATIVE往復で実編集→stale→再チェック→セーブ→提出前チェックまで同じProjectを保つ',async({page})=>{
  const original=baseProject();await seed(page,original);await page.goto('/bridge-distance.html?campsiteProject=bridge');await runDistance(page);await openMission4(page);
  const initialResult=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('campsiteProject.v1')||'null')?.distanceResult||null);expect(initialResult?.stale).toBe(false);

  await page.locator('[data-v2-rework]').click();await expect(page).toHaveURL(/\/creative\/index\.html\?campsiteProject=bridge/,{timeout:15000});
  await expect.poll(()=>page.evaluate(()=>window.CampsiteCreativeProject?.projectId||''),{timeout:20000}).toBe(original.projectId);

  await openPoi(page,'新規A');await page.locator('#cmName').fill('新規A 発表版');await page.locator('#cmMemo').fill('現地確認済み・発表用コメント');
  await expect.poll(()=>page.evaluate(()=>{const p=JSON.parse(sessionStorage.getItem('campsiteProject.v1')||'null');const x=p?.currentPois?.find(v=>v.guid==='added-a');return[x?.title,x?.description]})).toEqual(['新規A 発表版','現地確認済み・発表用コメント']);
  await page.locator('#cmType').click();await page.locator('#cmTypePicker button[data-layer="new-power"]').click();await openPoi(page,'新規A 発表版');
  await page.locator('#cmMove').click();await expect(page.locator('#cmMoveBar')).toBeVisible({timeout:5000});await page.locator('.cm-coordinate-trigger').click();
  await page.locator('#cmCoordinateInput').fill('35.683000, 139.768500');await page.locator('#cmCoordinateInput').press('Enter');await expect(page.locator('#cmCoordinateJumpPanel')).toBeHidden();await page.locator('#cmMoveConfirm').click();

  await page.locator('#campsiteProjectNext').click();await expect(page).toHaveURL(/\/bridge-distance\.html\?campsiteProject=bridge/,{timeout:15000});await waitForDistance(page);
  const staleProject=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('campsiteProject.v1')||'null'));
  expect(staleProject.projectId).toBe(original.projectId);expect(staleProject.workspaceId).toBe(original.workspaceId);expect(staleProject.distanceResult?.stale).toBe(true);expect(staleProject.distanceResult?.staleReason).toBe('creative-design-changed');
  expect(staleProject.circleRadii).toEqual([50,40,30]);expect(staleProject.polygon).toEqual(original.polygon);
  const edited=staleProject.currentPois.find(p=>p.guid==='added-a');expect(edited?.title).toBe('新規A 発表版');expect(edited?.description).toBe('現地確認済み・発表用コメント');expect(edited?.gameEntity).toBe('POWERSPOT');
  expect(Math.abs(Number(edited?.lat)-35.683)).toBeLessThan(0.00003);expect(Math.abs(Number(edited?.lng)-139.7685)).toBeLessThan(0.00003);

  await page.evaluate(async()=>window.runDistanceCheck());const shell=page.locator('.campsite-mission-shell');await expect(shell).toHaveAttribute('data-layout-v2','true',{timeout:12000});
  await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('campsiteProject.v1')||'null')?.distanceResult?.stale)).toBe(false);await expect(page.locator('.campsite-mission-lamp').nth(3)).toHaveAttribute('data-state','gray');await openMission4(page);

  const[download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-v2-save]').click()]);const path=await download.path();expect(path).toBeTruthy();
  const zip=await JSZip.loadAsync(fs.readFileSync(path));const saved=JSON.parse(await zip.file('campsite-project.json').async('string'));expect(saved.projectId).toBe(original.projectId);expect(saved.workspaceId).toBe(original.workspaceId);
  const savedEdited=saved.currentPois.find(p=>p.guid==='added-a');expect(savedEdited?.gameEntity).toBe('POWERSPOT');expect(savedEdited?.title).toBe('新規A 発表版');
  await page.locator('[data-v2-submit]').click();await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('campsiteProject.v1')||'null')?.phase||null)).toBe('pre-submit');
  const finalProject=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('campsiteProject.v1')||'null'));expect(finalProject.projectId).toBe(original.projectId);expect(finalProject.workspaceId).toBe(original.workspaceId);expect(finalProject.preSubmit?.source).toBe('campsiteProject.v1');
});

test('BridgeのPOWER_SPOTをCREATIVEのPowerSpotレイヤーへ受け入れ、現行オープニングを端末幅で維持する',async({page})=>{
  const project=powerSpotProject();await seed(page,project);await page.goto('/creative/index.html?campsiteProject=bridge');await expect.poll(()=>page.evaluate(()=>window.CampsiteCreativeProject?.projectId||''),{timeout:20000}).toBe(project.projectId);
  const normalized=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('campsiteProject.v1')||'null'));expect(normalized.currentPois[0].gameEntity).toBe('POWERSPOT');expect(normalized.selectedPois[0].gameEntity).toBe('POWERSPOT');
  const layers=page.getByRole('button',{name:/レイヤー/});await layers.click();const row=page.locator('.layer-row').filter({hasText:'既存 PowerSpot'}).first();await expect(row).toBeVisible();const button=row.locator('button').first();
  await expect(button).toHaveAttribute('aria-pressed','true');await button.click();await expect(button).toHaveAttribute('aria-pressed','false');await button.click();await expect(button).toHaveAttribute('aria-pressed','true');await layers.click();await openPoi(page,'Bridge PowerSpot');
  const bg=()=>page.locator('.entry').evaluate(el=>getComputedStyle(el).backgroundImage);for(const size of [{width:393,height:852},{width:412,height:915},{width:1280,height:800}]){await page.setViewportSize(size);await expect.poll(bg).toContain('creative-mode-opening.png');}const background=await bg();expect(background).not.toContain('campsite-top-mobile.png');expect(background).not.toContain('campsite-top-desktop.png');
});
