import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs = fs.readFileSync('node_modules/leaflet/dist/leaflet.js', 'utf8');
const leafletCss = fs.readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');
const jszipJs = fs.readFileSync('node_modules/jszip/dist/jszip.min.js', 'utf8');

const project = {
  source: 'bridge',
  projectId: 'wm3c-reference-browser-gate',
  phase: 'design',
  createdAt: '2026-10-02T06:10:00.000Z',
  updatedAt: '2026-10-02T06:10:00.000Z',
  circleRadii: [50, 40, 30],
  polygon: [
    [35.6810, 139.7670],
    [35.6810, 139.7690],
    [35.6830, 139.7690],
    [35.6830, 139.7670]
  ],
  selectedPois: [
    { id:'e-stop', guid:'guid-stop', title:'Editable Stop', lat:35.6815, lng:139.7675, gameEntity:'POKESTOP', gameStatus:'ACTIVE', layer:'existing-pokestop', role:'existing' },
    { id:'c-stop', guid:'', title:'Candidate Stop', lat:35.6820, lng:139.7680, gameEntity:'POKESTOP', gameStatus:'UNKNOWN', layer:'new-pokestop', role:'added' }
  ],
  wayfarerObservation: {
    version: '0.2.0',
    snapshotId: 'wm5b2a-browser-gate',
    observedAt: '2026-10-02T06:09:00.000Z',
    acquisition: { bufferMeters:200, coverageComplete:false },
    polygon: [
      [35.6810, 139.7670],
      [35.6810, 139.7690],
      [35.6830, 139.7690],
      [35.6830, 139.7670]
    ],
    zones: {
      interior: [
        { guid:'guid-stop', title:'Duplicate Editable Stop', lat:35.6815, lng:139.7675, poiKind:'POKESTOP', gameEntity:'POKESTOP', gameStatus:'ACTIVE' },
        { guid:'observed-inside', title:'Observed Inside Gym', lat:35.6824, lng:139.7684, poiKind:'GYM', gameEntity:'GYM', gameStatus:'ACTIVE' }
      ],
      reference100: [
        { guid:'observed-outer', title:'Observed Outer Stop', lat:35.6834, lng:139.7686, poiKind:'POKESTOP', gameEntity:'POKESTOP', gameStatus:'ACTIVE' }
      ],
      reserve200: [
        { guid:'observed-reserve', title:'Reserve Power', lat:35.6840, lng:139.7690, poiKind:'POWERSPOT', gameEntity:'POWERSPOT', gameStatus:'ACTIVE' }
      ]
    },
    counts: {
      interior: { total:2 },
      reference100: { total:1 },
      reserve200: { total:1 }
    }
  }
};
project.currentPois = project.selectedPois.map(item => ({ ...item }));

function collectBrowserErrors(page) {
  const browserErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
  return browserErrors;
}

async function installRoutes(page) {
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', route => route.fulfill({ status:200, contentType:'application/javascript', body:leafletJs }));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', route => route.fulfill({ status:200, contentType:'text/css', body:leafletCss }));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', route => route.fulfill({ status:200, contentType:'application/javascript', body:jszipJs }));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/, route => route.fulfill({ status:204, body:'' }));
  await page.route(/https:\/\/server\.arcgisonline\.com\/.*/, route => route.fulfill({ status:204, body:'' }));
  await page.route('https://maps.google.com/mapfiles/ms/icons/blue-dot.png', route => route.fulfill({
    status:200, contentType:'image/svg+xml',
    body:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="8" fill="#3b82f6"/></svg>'
  }));
  await page.route(/https:\/\/(?:raw|media)\.githubusercontent\.com\/.*/, route => route.fulfill({ status:204, body:'' }));
  await page.route('**/js/ca-access-bootstrap.js*', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'window.CampsiteCaAccess=Object.freeze({test:true});'
  }));
  await page.addInitScript(value => {
    sessionStorage.setItem('campsiteProject.v1', JSON.stringify(value));
  }, project);
}

async function replaceCreativePolygon(page, points) {
  await page.evaluate(() => document.querySelector('#toolMenu [data-tool="polygon"]')?.click());
  const deleteButton = page.getByRole('button', { name:'削除する' });
  await expect(deleteButton).toBeVisible();
  await deleteButton.click();

  const deleteOverlay = page.locator('.leaflet-polygon-pane path[stroke="#d6453d"].leaflet-interactive').last();
  await expect(deleteOverlay).toBeVisible();
  await deleteOverlay.evaluate(element => {
    element.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, view:window }));
  });
  const confirmDelete = page.getByRole('button', { name:'活動範囲を削除' });
  await expect(confirmDelete).toBeVisible();
  await confirmDelete.click();

  await expect.poll(() => page.evaluate(() => window.__cmWayfarerReference.getCurrentPolygon().length)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__cmWayfarerReference.getState().display)).toBe(0);

  await page.evaluate(() => document.querySelector('#toolMenu [data-tool="polygon"]')?.click());
  let action = page.getByRole('button', { name:'点を打つ' });
  await expect(action).toBeVisible();

  for (const point of points) {
    await page.evaluate(([lat,lng]) => window.CampsiteCreativeCoordinateJump.moveTo(lat,lng), point);
    action = page.getByRole('button', { name:'点を打つ' });
    await expect(action).toBeVisible();
    await action.click();
  }

  await page.evaluate(([lat,lng]) => window.CampsiteCreativeCoordinateJump.moveTo(lat,lng), points[0]);
  const finish = page.getByRole('button', { name:'活動範囲を作成！' });
  await expect(finish).toBeVisible();
  await finish.click();
  await expect.poll(() => page.evaluate(() => window.__cmWayfarerReference.getCurrentPolygon().length)).toBe(points.length);
}

async function workspaceSnapshot(page) {
  return page.evaluate(() => {
    const snapshot = window.CampsiteCreativeWorkspace?.getSnapshot?.();
    return (snapshot?.records || []).map(record => ({
      id: record.id || '',
      guid: record.guid || '',
      title: record.title || '',
      layer: record.layer || '',
      deleted: record.deleted === true,
      latlng: Array.isArray(record.latlng) ? record.latlng.map(Number) : null
    }));
  });
}

async function installWm5cSelfRelay(page) {
  await page.evaluate(() => {
    window.__wm5cOutbound = [];
    const nativePostMessage = window.postMessage.bind(window);

    window.postMessage = function(message, targetOrigin, ...rest) {
      const data = message && typeof message === 'object' ? message : {};
      if (data.type === 'CAMPSITE_CREATIVE_MAIN_TO_EXTENSION_V1') {
        const payload = data.payload && typeof data.payload === 'object' ? data.payload : {};
        window.__wm5cOutbound.push(JSON.parse(JSON.stringify(payload)));
        const relayId = String(data.relayId || '');
        const reply = nextPayload => nativePostMessage({
          type:'CAMPSITE_EXTENSION_TO_CREATIVE_MAIN_V1',
          relayId,
          payload:nextPayload
        }, location.origin);

        if (payload.type === 'CAMPSITE_WAYFARER_OBSERVE_PING_V1') {
          setTimeout(() => reply({
            type:'CAMPSITE_WAYFARER_OBSERVE_PONG_V1',
            requestId:String(payload.requestId || ''),
            mapPresent:true,
            mapTabCount:1,
            duplicateMapTabs:false,
            tabCountVerified:true
          }), 0);
        } else if (payload.type === 'CAMPSITE_WAYFARER_OBSERVE_REQUEST_V1') {
          const polygon = (payload.polygon || []).map(point => [Number(point[0]), Number(point[1])]);
          const requestId = String(payload.requestId || '');
          setTimeout(() => reply({
            type:'CAMPSITE_WAYFARER_OBSERVE_ACCEPTED_V1',
            requestId,
            accepted:true,
            observationStarted:true,
            polygonVertexCount:polygon.length
          }), 0);
          setTimeout(() => reply({
            type:'CAMPSITE_WAYFARER_OBSERVE_RESULT_V1',
            requestId,
            ok:true,
            result:{
              version:'0.4.0',
              snapshotId:'wm5c-browser-relay',
              observedAt:new Date().toISOString(),
              polygon,
              counts:{interior:{total:0},reference100:{total:0},reserve200:{total:0}},
              zones:{interior:[],reference100:[],reserve200:[]},
              visibleTotal:0,
              retainedTotal:0,
              excludedCount:0,
              outsideCount:0,
              canProceed:false,
              acquisition:{
                engineVersion:'wm5c-browser-relay',
                bufferMeters:200,
                referenceMeters:100,
                reserveMeters:200,
                cellLevel:14,
                acquisitionBounds:null,
                tileCount:1,
                geometryCoverageComplete:true,
                transportComplete:true,
                coverageComplete:true,
                coverageStatus:'complete',
                sourceComplete:true
              }
            }
          }), 24);
        }
      }
      return nativePostMessage(message, targetOrigin, ...rest);
    };
  });
}

test('WM-3C real Creative renders read-only Wayfarer references without entering records', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await installRoutes(page);

  await page.goto('/creative/index.html?campsiteProject=bridge');
  await expect.poll(() => page.evaluate(() => window.CampsiteCreativeProject?.count || 0), { timeout:15000 }).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__cmCandidateShadow?.getState?.()?.interactionOwner || ''), { timeout:15000 }).toBe('map-engine');
  await expect.poll(() => page.evaluate(() => window.__cmWayfarerReference?.getState?.()?.ready === true), { timeout:15000 }).toBe(true);

  const beforeRecords = await workspaceSnapshot(page);
  expect(beforeRecords).toHaveLength(2);

  const refState = await page.evaluate(() => window.__cmWayfarerReference.getState());
  expect(refState).toMatchObject({
    ready:true,
    display:2,
    reserve:1,
    suppressed:1,
    invalid:0,
    lastError:'',
    localCanUse:true,
    localReason:'LOCAL_RECLASSIFICATION_AVAILABLE',
    coverageReason:'COVERED'
  });

  const rendererState = await page.evaluate(() => window.__cmCandidateShadow.getState());
  expect(rendererState.rendered).toEqual({ markers:4, circles50:4, circles40:2, circles30:2 });

  const referenceIcons = page.locator('.cm-engine-reference-icon');
  await expect(referenceIcons).toHaveCount(2);
  await expect(page.locator('.cm-engine-existing-icon')).toHaveCount(1);
  await expect(page.locator('.cm-engine-candidate-icon')).toHaveCount(1);
  await expect(page.locator('.cm-engine-reference-icon.leaflet-interactive')).toHaveCount(0);

  const referenceScene = await page.evaluate(() => window.__cmWayfarerReference.getScene());
  const referenceItems = referenceScene.items.filter(item => item.origin === 'reference');
  expect(referenceItems.filter(item => item.layerKey === 'marker')).toHaveLength(2);
  expect(referenceItems.filter(item => item.layerKey === 'circle-50')).toHaveLength(2);
  expect(referenceItems.some(item => String(item.ownerKey).includes('observed-reserve'))).toBe(false);
  expect(referenceItems.some(item => String(item.ownerKey).includes('guid-stop'))).toBe(false);
  expect(referenceItems.every(item => item.readOnly === true)).toBe(true);

  const insideMarker = referenceItems.find(item => item.key === 'marker:reference:observed-inside');
  const outerMarker = referenceItems.find(item => item.key === 'marker:reference:observed-outer');
  expect(insideMarker).toBeTruthy();
  expect(outerMarker).toBeTruthy();
  expect(Number(outerMarker.style.opacity)).toBeLessThan(Number(insideMarker.style.opacity));

  const afterInitialRender = await workspaceSnapshot(page);
  expect(afterInitialRender).toEqual(beforeRecords);

  const observationBeforePolygonEdit = await page.evaluate(() =>
    JSON.stringify(JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null').wayfarerObservation)
  );
  const shiftedPolygon = [
    [35.6817, 139.7670],
    [35.6817, 139.7690],
    [35.6837, 139.7690],
    [35.6837, 139.7670]
  ];
  await replaceCreativePolygon(page, shiftedPolygon);
  await expect(referenceIcons).toHaveCount(3);
  await expect.poll(() => page.evaluate(() => window.__cmWayfarerReference.getState().display)).toBe(3);
  await expect.poll(() => page.evaluate(() => window.__cmWayfarerReference.getState().reserve)).toBe(0);
  const shiftedState = await page.evaluate(() => window.__cmWayfarerReference.getState());
  expect(shiftedState.localCanUse).toBe(true);
  expect(shiftedState.coverageReason).toBe('COVERED');
  expect(shiftedState.currentPolygon).toHaveLength(shiftedPolygon.length);
  shiftedState.currentPolygon.forEach((point,index) => {
    expect(Number(point[0])).toBeCloseTo(Number(shiftedPolygon[index][0]),4);
    expect(Number(point[1])).toBeCloseTo(Number(shiftedPolygon[index][1]),4);
  });
  expect(await workspaceSnapshot(page)).toEqual(beforeRecords);
  const observationAfterPolygonEdit = await page.evaluate(() =>
    JSON.stringify(JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null').wayfarerObservation)
  );
  expect(observationAfterPolygonEdit).toBe(observationBeforePolygonEdit);

  await page.evaluate(() => {
    const current = JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null');
    current.wayfarerObservation.zones.reference100.push({
      guid:'observed-outer-2',
      title:'Observed Outer Gym 2',
      lat:35.6835,
      lng:139.7688,
      poiKind:'GYM',
      gameEntity:'GYM',
      gameStatus:'ACTIVE'
    });
    sessionStorage.setItem('campsiteProject.v1', JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('campsite:wayfarer-observation-saved', { detail:{ observedAt:'2026-10-02T06:12:00.000Z' } }));
  });

  await expect(referenceIcons).toHaveCount(4);
  await expect.poll(() => page.evaluate(() => window.__cmWayfarerReference.getState().display)).toBe(4);
  await expect.poll(() => page.evaluate(() => window.__cmCandidateShadow.getState().rendered.markers)).toBe(6);
  const afterRefreshRecords = await workspaceSnapshot(page);
  expect(afterRefreshRecords).toEqual(beforeRecords);

  // Cross two real 2500ms autosave ticks after asynchronous observation save.
  const savedAfterRefresh = await page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1')));
  await expect.poll(() => page.evaluate(previous => {
    const saved = JSON.parse(sessionStorage.getItem('campsiteProject.v1'));
    return saved.updatedAt !== previous;
  }, savedAfterRefresh.updatedAt), { timeout:6000 }).toBe(true);
  const firstTick = await page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1')));
  expect(firstTick.wayfarerObservation).toEqual(savedAfterRefresh.wayfarerObservation);
  await expect.poll(() => page.evaluate(previous => {
    const saved = JSON.parse(sessionStorage.getItem('campsiteProject.v1'));
    return saved.updatedAt !== previous;
  }, firstTick.updatedAt), { timeout:6000 }).toBe(true);
  const secondTick = await page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1')));
  expect(secondTick.wayfarerObservation).toEqual(savedAfterRefresh.wayfarerObservation);
  await expect(referenceIcons).toHaveCount(4);
  expect(await workspaceSnapshot(page)).toEqual(beforeRecords);

  expect(browserErrors).toEqual([]);
});

test('WM-5C outside-reserve edit shows reacquisition CTA and sends latest Creative polygon', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await installRoutes(page);
  await page.goto('/creative/index.html?campsiteProject=bridge');
  await installWm5cSelfRelay(page);
  await expect.poll(() => page.evaluate(() => window.CampsiteCreativeProject?.count || 0), { timeout:15000 }).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__cmWayfarerReference?.getState?.()?.ready === true), { timeout:15000 }).toBe(true);

  const beforeRecords = await workspaceSnapshot(page);
  const outsidePolygon = [
    [35.6822, 139.7670],
    [35.6822, 139.7690],
    [35.6842, 139.7690],
    [35.6842, 139.7670]
  ];
  await replaceCreativePolygon(page, outsidePolygon);

  await expect.poll(() => page.evaluate(() => window.__cmWayfarerReference.getState().localReason)).toBe('REACQUIRE_REQUIRED');
  await expect.poll(() => page.evaluate(() => window.CampsiteCreativeWayfarerLink.getState().reacquireRequired)).toBe(true);
  await expect(page.locator('.cm-engine-reference-icon')).toHaveCount(0);

  const reacquireButton = page.locator('#campsiteWayfarerObserveButton');
  await expect(reacquireButton).toHaveText('Wayfarerで再取得');
  await expect(reacquireButton).toHaveAttribute('data-reacquire', '1');
  await reacquireButton.evaluate(element => element.click());
  await expect(page.locator('#campsiteWayfarerObserveOverlay')).toBeVisible();
  await expect(page.locator('#campsiteWayfarerObserveRun')).toHaveText('Wayfarerで再取得');

  const connection = await page.evaluate(async () => {
    const current = JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null');
    return window.CampsiteCreativeWayfarerLink.checkConnection(current);
  });
  expect(connection.connected).toBe(true);

  const latestPolygon = await page.evaluate(() => window.__cmWayfarerReference.getCurrentPolygon());
  const observationState = await page.evaluate(async () => {
    const current = JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null');
    return window.CampsiteCreativeWayfarerLink.startObservation(current);
  });
  expect(observationState.status).toBe('success');

  const observeRequest = await page.evaluate(() =>
    (window.__wm5cOutbound || []).find(item => item?.type === 'CAMPSITE_WAYFARER_OBSERVE_REQUEST_V1') || null
  );
  expect(observeRequest).toBeTruthy();
  expect(observeRequest.polygon).toEqual(latestPolygon);

  await expect.poll(() => page.evaluate(() => window.__cmWayfarerReference.getState().localCanUse)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.CampsiteCreativeWayfarerLink.getState().reacquireRequired)).toBe(false);
  await expect(reacquireButton).toHaveAttribute('data-reacquire', '0');
  await expect(reacquireButton).toHaveText('🔭 Wayfarer観察');

  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null'));
  expect(saved.wayfarerObservation.snapshotId).toBe('wm5c-browser-relay');
  expect(saved.wayfarerObservation.polygon).toEqual(latestPolygon);
  expect(await workspaceSnapshot(page)).toEqual(beforeRecords);
  expect(browserErrors).toEqual([]);
});

