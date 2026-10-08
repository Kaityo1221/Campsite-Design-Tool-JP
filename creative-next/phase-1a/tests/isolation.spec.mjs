import assert from 'node:assert/strict';

export async function runIsolationSuite(browser, baseURL, config, engine) {
  const context = await browser.newContext({ viewport: config.viewport, deviceScaleFactor: config.deviceScaleFactor, locale: config.locale, timezoneId: config.timezoneId });
  const page = await context.newPage(), requests = [], errors = [], blocked = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  page.on('dialog', dialog => dialog.accept());
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(baseURL).origin || /creative\/|bridge|supabase|auth|kmz/i.test(url.pathname)) {
      blocked.push(url.href); return route.abort();
    }
    requests.push(url.pathname); return route.continue();
  });
  await page.addInitScript(() => {
    const oldKeys = ['next-lab-creative-v7', 'next-lab-creative-current-v1', 'next-lab-creative-history-v1', 'next-lab-creative-hand', 'campsiteProject.v1'];
    const originalGet = Storage.prototype.getItem;
    for (const storage of [localStorage, sessionStorage]) for (const key of oldKeys) storage.setItem(key, 'phase1a-sentinel:' + key);
    const calls = [];
    for (const method of ['getItem', 'setItem', 'removeItem', 'clear', 'key']) {
      Storage.prototype[method] = function (...args) { calls.push({ method, key: args[0] }); throw new Error('Storage access forbidden in Phase 1-A'); };
    }
    for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource']) {
      Object.defineProperty(window, name, { configurable: true, value: function () { calls.push({ method: name }); throw new Error('Network forbidden in Phase 1-A'); } });
    }
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: function () { calls.push({ method: 'sendBeacon' }); throw new Error('Beacon forbidden'); } });
    for (const name of ['indexedDB', 'caches', 'CampsiteCreativeProject', 'CampsiteCreativePlacementCommit', 'CampsiteCaAccess']) {
      Object.defineProperty(window, name, { configurable: true, get() { calls.push({ method: name }); throw new Error('Production/global access forbidden'); } });
    }
    window.__phase1aAudit = () => ({ calls: structuredClone(calls), intact: [localStorage, sessionStorage].every(storage => oldKeys.every(key => originalGet.call(storage, key) === 'phase1a-sentinel:' + key)) });
  });

  const waitText = async (selector, text) => {
    await page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent.includes(text), { selector, text });
  };
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await waitText('#counts', '既存 1 / 700');
    assert.equal(await page.locator('#open-add').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(242, 163, 60)');
    assert.equal(await page.locator('#pois tr').count(), 2);
    await page.locator('#open-add').click();
    await page.locator('#add-title').fill('取消される仮配置');
    await page.locator('#add-cancel').click();
    await waitText('#history-count', 'Undo 0 / Redo 0');
    await page.locator('#open-add').click();
    await page.locator('#add-title').fill('画面から追加');
    await page.locator('#add-kind').selectOption('power');
    await page.locator('#add-confirm').click();
    await waitText('#counts', '新規 2 / 25');
    await page.locator('#add-cancel').click();
    await page.locator('#undo').click();
    await waitText('#counts', '新規 1 / 25');
    await page.locator('#redo').click();
    await waitText('#counts', '新規 2 / 25');

    // Existing POIs are editable but their coordinates are disabled.
    await page.locator('#pois tr').first().getByRole('button', { name: '編集', exact: true }).click();
    assert.equal(await page.locator('#edit-lat').isDisabled(), true);
    assert.equal(await page.locator('#edit-lng').isDisabled(), true);
    await page.locator('#edit-title').fill('既存の名称編集');
    await page.locator('#edit-memo').fill('日本語<&>\nメモ');
    await page.locator('#edit-kind').selectOption('gym');
    await page.locator('#edit-form').getByRole('button', { name: '編集を確定', exact: true }).click();
    await waitText('#pois', '既存の名称編集');

    await page.locator('#fixture').selectOption('over');
    await page.locator('#load').click();
    await waitText('#counts', '新規 26 / 25');
    await page.locator('#open-add').click();
    assert.equal(await page.locator('#add-form').isVisible(), true);
    assert.equal(await page.locator('#add-confirm').isDisabled(), true);
    await page.locator('#add-cancel').click();
    await page.locator('#pois tr').first().getByRole('button', { name: '編集', exact: true }).click();
    await page.locator('#delete').click();
    await waitText('#counts', '新規 25 / 25');
    await page.locator('#undo').click();
    await waitText('#counts', '新規 26 / 25');
    await page.locator('#redo').click();
    await waitText('#counts', '新規 25 / 25');

    await page.locator('#fixture').selectOption('701');
    await page.locator('#load').click();
    await waitText('#message', '既存701件以上');
    await waitText('#counts', '新規 25 / 25');
    await waitText('#history-count', 'Undo 1 / Redo 0');
    await page.locator('#fixture').selectOption('700');
    await page.locator('#load').click();
    await waitText('#counts', '既存 700 / 700');
    assert.equal(await page.locator('#pois tr').count(), 50);
    await waitText('#history-count', 'Undo 0 / Redo 0');

    await page.locator('#fixture').selectOption('legacy');
    await page.locator('#load').click();
    await waitText('#pois', '同じGUID A');
    assert.equal(await page.locator('#pois tr').count(), 3);
    const ids = await page.locator('#pois tr').evaluateAll(rows => rows.map(row => row.dataset.poiId));
    assert.equal(new Set(ids).size, 3);
    assert.equal(await page.locator('#pois').getByText('same-guid', { exact: false }).count(), 2);
    // Reload demonstrates memory-only state and empty history.
    await page.reload({ waitUntil: 'networkidle' });
    await waitText('#counts', '新規 1 / 25');
    await waitText('#history-count', 'Undo 0 / Redo 0');
    const audit = await page.evaluate(() => window.__phase1aAudit());
    assert.equal(audit.intact, true);
    assert.deepEqual(audit.calls, []);
    assert.deepEqual(blocked, []);
    assert.deepEqual(errors, []);
    assert.ok(requests.length > 0);
    assert.ok(requests.every(url => /^\/$|^\/(index\.html|bootstrap\.mjs|styles\.css|core\/|adapters\/|tests\/fixtures\/)/.test(url)));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    return { engine, passed: true, requests: [...new Set(requests)], storageCalls: audit.calls.length, sentinelsIntact: audit.intact, blocked, errors };
  } finally { await context.close(); }
}
