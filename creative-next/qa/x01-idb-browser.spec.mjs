import {test,expect} from '@playwright/test';
const url='/creative-next/qa/x01-idb-browser.html';
const database=(s)=>'campsite-creative-next-x01-idb-lab-browser-'+s;
test('real Chromium IndexedDB survives reload with Project/areas/KMZ intact',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await expect(page.locator('body')).toHaveAttribute('data-ready','yes');
 const save=await page.evaluate(async()=>X01_BROWSER_LAB.save(''+'campsite-creative-next-x01-idb-lab-browser-reload'));
 expect(save.revision).toBe(1);
 await page.reload();await expect(page.locator('body')).toHaveAttribute('data-ready','yes');
 const result=await page.evaluate(()=>X01_BROWSER_LAB.read('campsite-creative-next-x01-idb-lab-browser-reload'));
 expect(result.revision).toBe(1);
 expect(result.productionReady).toBe(false);
 expect(result.projectPolygon).toHaveLength(4);
 expect(result.acquisitionPolygon).toHaveLength(4);
 expect(result.areaCounts).toEqual([31]);
 expect(result.referenceGuids).toEqual(['external']);
 expect(result.reserveStatuses).toEqual(['INACTIVE']);
 expect(result.unknown).toEqual({preserve:['unknown',42]});
 expect(result.kmzBytesLength).toBeGreaterThan(100);
 expect(errors).toEqual([]);
});
test('real IndexedDB revision CAS blocks stale write, keeps two activity areas',async({page})=>{
 await page.goto(url);await expect(page.locator('body')).toHaveAttribute('data-ready','yes');
 const db=database('stale');
 expect((await page.evaluate(d=>X01_BROWSER_LAB.save(d,0),db)).revision).toBe(1);
 expect((await page.evaluate(d=>X01_BROWSER_LAB.save(d,1,2),db)).revision).toBe(2);
 const stale=await page.evaluate(d=>X01_BROWSER_LAB.saveError(d,1),db);
 expect(stale.code).toBe('IDB_LAB_REVISION_CONFLICT');
 const again=await page.evaluate(d=>X01_BROWSER_LAB.read(d),db);
 expect(again.revision).toBe(2);
 expect(again.areaCounts).toEqual([31,4]);
 expect(again.projectPolygon).toHaveLength(4);
});
test('real IndexedDB corrupt KMZ aborts verification instead of reporting saved',async({page})=>{
 await page.goto(url);await expect(page.locator('body')).toHaveAttribute('data-ready','yes');
 const db=database('tamper');
 await page.evaluate(d=>X01_BROWSER_LAB.save(d,0),db);
 await page.evaluate(d=>X01_BROWSER_LAB.mutate(d,'kmz'),db);
 const outcome=await page.evaluate(d=>X01_BROWSER_LAB.readError(d),db);
 expect(outcome.code).toBe('IDB_LAB_INTEGRITY_HOLD');
 const save=await page.evaluate(d=>X01_BROWSER_LAB.saveError(d,1),db);
 expect(save.code).toBe('IDB_LAB_INTEGRITY_HOLD');
});
test('real IndexedDB concurrent tab write yields exactly one accepted revision',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 try{
  const pages=await Promise.all([context.newPage(),context.newPage()]);
  await Promise.all(pages.map(p=>p.goto(url)));
  await Promise.all(pages.map(p=>expect(p.locator('body')).toHaveAttribute('data-ready','yes')));
  const db=database('parallel');
  const results=await Promise.all(pages.map(p=>p.evaluate(d=>X01_BROWSER_LAB.saveError(d,0),db)));
  expect(results.filter(x=>x.unexpected?.status==='LAB_IDB_SAVE_VERIFIED')).toHaveLength(1);
  expect(results.filter(x=>x.code==='IDB_LAB_REVISION_CONFLICT')).toHaveLength(1);
  const row=await pages[0].evaluate(d=>X01_BROWSER_LAB.read(d),db);
  expect(row.revision).toBe(1);
 }finally{await context.close();}
});
