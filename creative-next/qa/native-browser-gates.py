#!/usr/bin/env python3
"""Private QA only. Runs against localhost on an unrestricted Chromium browser.
No production URL or old v7 storage is ever touched. A blocked launch is NOT PASS.
Requires Python Playwright and Chromium; Leaflet 1.9.4 CDN network must be available.
"""
import asyncio, pathlib, subprocess, tempfile, sys, os
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.async_api import async_playwright

ROOT=pathlib.Path(__file__).resolve().parents[2]
URL_PATH='/creative-next/phase-2-preview/index.html'
JS_PATH='/creative-next/phase-1b/core/journal-save.mjs'

async def run():
    with tempfile.TemporaryDirectory(prefix='creative-next-browser-') as tmp:
        fixture=pathlib.Path(tmp)/'synthetic.kmz'
        subprocess.run(['node',str(ROOT/'creative-next/qa/generate-test-kmz.mjs'),str(fixture)],check=True,cwd=ROOT)
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
        Thread(target=server.serve_forever,daemon=True).start()
        url=f'http://127.0.0.1:{server.server_port}'+URL_PATH
        try:
            async with async_playwright() as p:
                chromium_bin=os.environ.get('CREATIVE_NEXT_CHROMIUM_BIN')
                if not chromium_bin and pathlib.Path('/usr/bin/chromium').exists(): chromium_bin='/usr/bin/chromium'
                browser=await p.chromium.launch(headless=True,executable_path=chromium_bin or p.chromium.executable_path,args=['--no-sandbox','--disable-dev-shm-usage'])
                context=await browser.new_context(viewport={'width':390,'height':844},accept_downloads=True)
                page=await context.new_page()
                try:
                    response=await page.goto(url,wait_until='domcontentloaded',timeout=12000)
                except Exception as e:
                    print('NOT_PASS: browser navigation to isolated localhost is blocked:',str(e).splitlines()[0]);await browser.close();return 2
                assert response and response.status==200
                await page.wait_for_function('Boolean(document.querySelector("#capability-status")) && !document.querySelector("#capability-status").textContent.includes("確認中")',timeout=10000)
                readiness=await page.evaluate('({secure:isSecureContext, webLocks:!!navigator.locks, storage:!!localStorage, subtle:!!crypto.subtle, JSZip:!!window.JSZip, leaflet:!!window.L})')
                print('BROWSER_FEATURES',readiness)
                assert all(readiness.values()),'Actual Leaflet, Web Locks, storage, JSZip and crypto required (no mocks)'
                await page.locator('#file').set_input_files(str(fixture))
                await page.locator('#inspect').click()
                await page.locator('#accept').wait_for(state='visible',timeout=25000)
                await page.wait_for_function('!document.querySelector("#accept").disabled',timeout=25000)
                page.once('dialog',lambda dialog:asyncio.create_task(dialog.accept()))
                await page.locator('#accept').click()
                await page.wait_for_function('document.querySelector("#counts").textContent.includes("1")',timeout=25000)
                assert await page.locator('.leaflet-container').count()==1
                assert await page.locator('.leaflet-marker-pane').count()==1
                await page.wait_for_function('document.getElementById("map-engine").textContent.includes("地図タイル読込済み")',timeout=30000)
                await page.locator('.leaflet-tile-loaded').first.wait_for(state='attached',timeout=30000)
                tiles=await page.locator('.leaflet-tile-loaded').count()
                assert tiles>0,'No real Leaflet map tiles loaded'
                print('PASS: real Leaflet and '+str(tiles)+' map tiles loaded, not a fallback map')
                await page.locator('#save').click()
                await page.wait_for_function('document.querySelector("#save-info").textContent.includes("第1世代")',timeout=15000)
                pointer='campsite-creative-next-v1-preview:current'
                before=await page.evaluate('(k)=>localStorage.getItem(k)',pointer)
                assert before is not None
                await page.reload(wait_until='domcontentloaded')
                page.once('dialog',lambda dialog:asyncio.create_task(dialog.accept()))
                await page.locator('#resume').click()
                await page.wait_for_function('document.querySelector("#counts").textContent.includes("1")',timeout=15000)
                # Make second revision using a real editor command via UI.
                await page.locator('#pois button').first.click()
                await page.locator('#memo').fill('復旧時の新メモ')
                await page.locator('#editor button[type="submit"]').click()
                await page.locator('#save').click()
                await page.wait_for_function('document.querySelector("#save-info").textContent.includes("第2世代")',timeout=15000)
                await page.evaluate('(k)=>localStorage.setItem(k,"BROKEN")',pointer)
                await page.reload(wait_until='domcontentloaded')
                await page.locator('#recovery-inspect').click()
                await page.wait_for_function('!document.querySelector("#recovery-review").hidden',timeout=15000)
                options=await page.locator('#recovery-choice option').all_text_contents()
                assert len(options)==3,options
                await page.locator('#recovery-choice').select_option(index=1)
                page.once('dialog',lambda dialog:asyncio.create_task(dialog.accept()))
                await page.locator('#recovery-apply').click()
                await page.wait_for_function('document.querySelector("#save-info").textContent.includes("復旧")',timeout=20000)
                assert await page.evaluate('(k)=>localStorage.getItem(k)!="BROKEN"',pointer)
                print('PASS: localhost origin Leaflet initialized, KMZ imported, localStorage persisted/reloaded, 2 generations, explicit UI recovery')
                # Native, origin-shared tab conflict on a separate test-only namespace
                tab2=await context.new_page()
                await tab2.goto(url,wait_until='domcontentloaded')
                save_js=f'''async (name) => {{
                    const {{createCreativeSaveJournal}}=await import('{JS_PATH}');
                    const journal=createCreativeSaveJournal({{storage:localStorage,namespace:'campsite-creative-next-v1-browser-gate',locks:navigator.locks,requireLock:true}});
                    try{{return {{ok:true,result:await journal.save({{records:[{{id:'test',role:'existing',kind:'pokestop',title:name,lat:35,lng:139}}],activityAreas:[]}},{{expectedRevision:null}})}};}}
                    catch(e){{return {{ok:false,code:e.code}}}}
                }}'''
                r1,r2=await asyncio.gather(page.evaluate(save_js,'tab1'),tab2.evaluate(save_js,'tab2'))
                assert sum(r['ok'] for r in [r1,r2])==1 and any(r.get('code')=='SAVE_CONFLICT' for r in [r1,r2]),(r1,r2)
                print('PASS: native concurrent Web Locks allow exactly one first-save, second tab rejected')
                await context.close();await browser.close()
                return 0
        finally:server.shutdown()

if __name__=='__main__':
    try:sys.exit(asyncio.run(run()))
    except Exception as exc:print('NOT_PASS:',str(exc)[:1000]);sys.exit(1)
