#!/usr/bin/env python3
"""Pre-iPhone PC regression of the isolated Creative Next preview.
Synthetic KMZ only, never visits or mutates the public application/legacy v7.
Must be executed by GitHub Actions with real Chromium, CDN Leaflet, and a real localhost origin.
"""
import asyncio
import pathlib
import subprocess
import sys
import tempfile
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
PATH = '/creative-next/phase-2-preview/index.html'

async def confirm_next(page, accept=True):
    page.once('dialog', lambda d: asyncio.create_task(d.accept() if accept else d.dismiss()))

async def expect_count(page, snippet):
    await page.wait_for_function('x => document.querySelector("#counts").textContent.includes(x)', snippet, timeout=12000)

async def run():
    with tempfile.TemporaryDirectory(prefix='creative-next-pc-final-') as scratch:
        source = pathlib.Path(scratch) / 'synthetic-test-only.kmz'
        subprocess.run(['node', str(ROOT/'creative-next/qa/generate-test-kmz.mjs'), str(source)], cwd=ROOT, check=True)
        server = ThreadingHTTPServer(('127.0.0.1',0), partial(SimpleHTTPRequestHandler, directory=str(ROOT)))
        Thread(target=server.serve_forever,daemon=True).start()
        try:
            async with async_playwright() as playwright:
                chrome = '/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').exists() else None
                browser = await playwright.chromium.launch(headless=True, executable_path=chrome or playwright.chromium.executable_path, args=['--no-sandbox','--disable-dev-shm-usage'])
                context = await browser.new_context(viewport={'width':1366,'height':768},accept_downloads=True,locale='ja-JP')
                page = await context.new_page()
                errors = []
                page.on('pageerror',lambda exc: errors.append(str(exc)))
                url=f'http://127.0.0.1:{server.server_port}'+PATH
                response=await page.goto(url,wait_until='domcontentloaded',timeout=25000)
                assert response and response.status==200
                await page.wait_for_function('document.querySelector("#capability-status").textContent.indexOf("確認中") < 0',timeout=15000)
                capability = await page.evaluate('({Leaflet:!!window.L,IndexedDB:!!window.indexedDB,Locks:!!navigator.locks,Storage:!!window.localStorage})')
                assert all(capability.values()),capability
                assert '未読み込み' in await page.locator('#counts').inner_text()
                assert not await page.locator('#add-new').is_enabled()
                await page.locator('#file').set_input_files(str(source))
                await page.locator('#inspect').click()
                await page.wait_for_function('!document.querySelector("#accept").disabled',timeout=25000)
                assert '未読み込み' in await page.locator('#counts').inner_text(), 'Selection/inspection must not modify live editor'
                await confirm_next(page)
                await page.locator('#accept').click()
                await expect_count(page,'既存 1')
                await page.wait_for_function('document.querySelector("#map-engine").textContent.includes("地図タイル読込済み")',timeout=40000)
                assert await page.locator('.leaflet-tile-loaded').count()>0
                print('PASS_PC: safe staged import; real Leaflet tiles and 1 existing POI',flush=True)
                # Existing coordinates remain disabled in the actual UI.
                await page.locator('#pois button').first.click()
                assert await page.locator('#lat').is_disabled()
                assert await page.locator('#lng').is_disabled()
                await page.locator('#memo').fill('PC総合回帰チェックの編集')
                await page.locator('#editor button[type="submit"]').click()
                assert await page.locator('#undo').is_enabled()
                print('PASS_PC: existing coordinate immutability and memo editing',flush=True)
                # Add a new POI; its dependent 50m circle appears and follows delete/undo.
                await page.locator('#add-new').click()
                await page.locator('#new-title').fill('PC検証用の新規POI')
                await page.locator('#new-kind').select_option('pokestop')
                await page.locator('#new-lat').fill('35.644')
                await page.locator('#new-lng').fill('139.86')
                await page.locator('#new-poi button[type="submit"]').click()
                await expect_count(page,'新規 1 / 25')
                await expect_count(page,'距離円 1')
                await page.locator('#filter').fill('PC検証用の新規POI')
                await page.locator('#pois button').first.click()
                await confirm_next(page)
                await page.locator('#delete').click()
                await expect_count(page,'新規 0 / 25')
                await expect_count(page,'距離円 0')
                await page.locator('#undo').click()
                await expect_count(page,'新規 1 / 25')
                await expect_count(page,'距離円 1')
                print('PASS_PC: new POI, owned 50m circle, delete and Undo',flush=True)
                await page.locator('#filter').fill('')
                # An activity-area polygon is a distinct object, never counted as a radius circle.
                await page.locator('#area-create-open').click()
                await page.locator('#area-create-points').fill('35.6430,139.8580\n35.6435,139.8585\n35.6441,139.8579')
                await confirm_next(page)
                await page.locator('#area-create-form button[type="submit"]').click()
                await expect_count(page,'活動範囲 1')
                await expect_count(page,'距離円 1')
                for selector in ['#layer-poi','#layer-circles','#layer-areas']:
                    await page.locator(selector).uncheck()
                    await expect_count(page,'活動範囲 1')
                    await page.locator(selector).check()
                await confirm_next(page)
                await page.locator('#area-remove').click()
                await expect_count(page,'活動範囲 0')
                await page.locator('#undo').click()
                await expect_count(page,'活動範囲 1')
                await page.locator('#redo').click()
                await expect_count(page,'活動範囲 0')
                await page.locator('#undo').click()
                await expect_count(page,'活動範囲 1')
                print('PASS_PC: polygon create/delete/Undo/Redo; layer toggles have no data loss',flush=True)
                # Save both the versioned localStorage journal and the strict IndexedDB sidecar.
                await page.locator('#save').click()
                await page.wait_for_function('document.querySelector("#save-info").textContent.includes("IndexedDB耐久性チェックポイント")',timeout=30000)
                assert await page.evaluate("localStorage.getItem('campsite-creative-next-v1-preview:current') !== null")
                before=await page.locator('#counts').inner_text()
                assert all(k in before for k in ['既存 1','新規 1','距離円 1','活動範囲 1']),before
                # Real browser download and independent re-import of that exported KMZ.
                async with page.expect_download(timeout=30000) as download_info:
                    await page.locator('#export').click()
                download=await download_info.value
                exported=pathlib.Path(scratch)/'reexported.kmz'
                await download.save_as(exported)
                assert exported.stat().st_size>100,'KMZ must contain actual ZIP bytes'
                assert exported.read_bytes()[:4]==b'PK\x03\x04','Not a ZIP/KMZ'
                print('PASS_PC: protected save + IndexedDB sidecar and downloaded KMZ',flush=True)
                await page.reload(wait_until='domcontentloaded')
                await confirm_next(page)
                await page.locator('#resume').click()
                await expect_count(page,'既存 1')
                await expect_count(page,'新規 1')
                await expect_count(page,'活動範囲 1')
                # Different browser context with empty storage proves export is a standalone portable KMZ.
                isolated=await browser.new_context(viewport={'width':1366,'height':768},locale='ja-JP')
                independent=await isolated.new_page()
                independent.on('pageerror',lambda exc: errors.append(str(exc)))
                await independent.goto(url,wait_until='domcontentloaded',timeout=20000)
                await independent.locator('#file').set_input_files(str(exported))
                await independent.locator('#inspect').click()
                await independent.wait_for_function('!document.querySelector("#accept").disabled',timeout=25000)
                await confirm_next(independent)
                await independent.locator('#accept').click()
                await expect_count(independent,'既存 1')
                await expect_count(independent,'新規 1')
                await expect_count(independent,'距離円 1')
                await expect_count(independent,'活動範囲 1')
                print('PASS_PC: reload/resume and clean-profile exported KMZ roundtrip',flush=True)
                # Basic desktop fit/overflow and open UI accessibility.
                assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth+2'), 'PC horizontal overflow'
                assert await independent.evaluate('document.documentElement.scrollWidth <= innerWidth+2')
                assert not errors, errors
                print('PASS_PC: desktop 1366px layout, no JavaScript page errors',flush=True)
                await isolated.close(); await context.close(); await browser.close()
                return 0
        finally:
            server.shutdown()

if __name__=='__main__':
    try:
        sys.exit(asyncio.run(run()))
    except Exception as exc:
        print('NOT_PASS_PC:',type(exc).__name__,repr(exc)[:1200],flush=True)
        sys.exit(1)
