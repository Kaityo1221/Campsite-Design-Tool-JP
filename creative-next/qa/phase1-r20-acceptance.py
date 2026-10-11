import asyncio,pathlib
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.async_api import async_playwright
async def main():
 root=pathlib.Path(__file__).resolve().parents[2]
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root)))
 Thread(target=server.serve_forever,daemon=True).start()
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch(headless=True,args=['--no-sandbox'])
   try:
    page=await browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    await page.goto(f'http://127.0.0.1:{server.server_port}/creative-next/original-ui-r20/index.html',wait_until='domcontentloaded')
    await page.wait_for_function('window.creativeR20 && window.JSZip && window.L',timeout=25000)
    assert await page.locator('#entry').is_visible()
    assert await page.locator('#startButton').is_disabled()
    page.on('dialog',lambda d:asyncio.create_task(d.accept()))
    await page.locator('#entryFile').set_input_files('/tmp/creative-next-phase1-check.kmz')
    await page.wait_for_function("!document.getElementById('startButton').disabled",timeout=25000)
    assert (await page.evaluate('creativeR20.status()'))['active']==False
    await page.locator('#startButton').click()
    await page.wait_for_function("creativeR20.status().count?.pois===1",timeout=25000)
    state=await page.evaluate('creativeR20.status()')
    assert state['active'] and state['count']['pois']==1,state
    assert await page.locator('#entry').is_hidden()
    assert await page.locator('#map').is_visible()
    assert not errors,errors
    print('PASS r20 original UI / real KMZ / consent / mapped POI with browser')
   finally:await browser.close()
 finally:server.shutdown()
asyncio.run(main())
