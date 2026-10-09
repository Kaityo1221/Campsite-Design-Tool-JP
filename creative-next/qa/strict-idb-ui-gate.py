#!/usr/bin/env python3
"""Isolated synthetic KMZ: browser save sidecar and explicit IDB backup recovery UI."""
import asyncio, pathlib, subprocess, tempfile, os, sys
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
URL_PATH='/creative-next/phase-2-preview/index.html'
async def run():
 with tempfile.TemporaryDirectory(prefix='creative-strict-idb-ui-') as tmp:
  fixture=pathlib.Path(tmp)/'synthetic.kmz'
  subprocess.run(['node',str(ROOT/'creative-next/qa/generate-test-kmz.mjs'),str(fixture)],check=True,cwd=ROOT)
  server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
  Thread(target=server.serve_forever,daemon=True).start()
  try:
   async with async_playwright() as p:
    bpath='/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').exists() else None
    browser=await p.chromium.launch(headless=True,executable_path=bpath or p.chromium.executable_path,args=['--no-sandbox','--disable-dev-shm-usage'])
    context=await browser.new_context(viewport={'width':390,'height':844})
    page=await context.new_page()
    url=f'http://127.0.0.1:{server.server_port}'+URL_PATH
    await page.goto(url,wait_until='domcontentloaded',timeout=15000)
    await page.locator('#file').set_input_files(str(fixture))
    await page.locator('#inspect').click()
    await page.locator('#accept').wait_for(state='visible',timeout=30000)
    await page.wait_for_function('!document.querySelector("#accept").disabled',timeout=20000)
    page.once('dialog',lambda d:asyncio.create_task(d.accept()))
    await page.locator('#accept').click()
    await page.wait_for_function('document.querySelector("#counts").textContent.includes("1")',timeout=20000)
    await page.locator('#save').click()
    await page.wait_for_function('document.querySelector("#save-info").textContent.includes("IndexedDB耐久性チェックポイント")',timeout=30000)
    state=await page.evaluate('''async()=>{
      const {createStrictIndexedCheckpoint}=await import('/creative-next/phase-2-preview/strict-idb-checkpoint.mjs');
      const b=createStrictIndexedCheckpoint({namespace:'campsite-creative-next-v1-preview'});
      const r=await b.inspect();return {status:r.status,revision:r.revision,source:r.snapshot?.sourceArchiveBase64?.length||0};
    }''')
    assert state['status']=='READY' and state['revision']==1 and state['source']>0,state
    print('PASS: actual preview save waits for strict IndexedDB checkpoint; source-bearing backup verified',flush=True)
    await page.evaluate('''()=>{for(const k of Object.keys(localStorage))if(k.startsWith('campsite-creative-next-v1-preview:'))localStorage.removeItem(k)}''')
    await page.reload(wait_until='domcontentloaded')
    await page.locator('#strict-restore').wait_for(state='visible',timeout=20000)
    # User rejects recovery: nothing should be automatically imported.
    page.once('dialog',lambda d:asyncio.create_task(d.dismiss()))
    await page.locator('#strict-restore').click()
    unchanged=await page.evaluate('''()=>({pointer:localStorage.getItem('campsite-creative-next-v1-preview:current'),count:document.querySelector('#counts').textContent})''')
    assert unchanged['pointer'] is None and '未読み込み' in unchanged['count'],unchanged
    # Explicit user confirmation: source KMZ and derived model are revalidated before writing.
    page.once('dialog',lambda d:asyncio.create_task(d.accept()))
    await page.locator('#strict-restore').click()
    await page.wait_for_function('document.querySelector("#status").textContent.includes("IndexedDBチェックポイントから復元")',timeout=25000)
    assert await page.evaluate("localStorage.getItem('campsite-creative-next-v1-preview:current') !== null")
    assert '既存 1' in await page.locator('#counts').inner_text()
    print('PASS: user rejected restore => no write; confirmed restore => validated source KMZ and recovered draft',flush=True)
    await context.close();await browser.close()
    return 0
  finally:server.shutdown()
if __name__=='__main__':
 try:sys.exit(asyncio.run(run()))
 except Exception as e:print('NOT_PASS_STRICT_IDB_UI',type(e).__name__,repr(e)[:1000],flush=True);sys.exit(1)
