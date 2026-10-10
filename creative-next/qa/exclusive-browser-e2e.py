import asyncio,pathlib
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.async_api import async_playwright
async def main():
 root=pathlib.Path(__file__).resolve().parents[2]
 srv=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root)))
 Thread(target=srv.serve_forever,daemon=True).start()
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch(headless=True,args=['--no-sandbox'])
   try:
    page=await browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
    await page.goto(f'http://127.0.0.1:{srv.server_port}/creative-next/qa/exclusive-browser/index.html')
    await page.wait_for_function('Boolean(window.__creativeE2E)')
    await page.locator('#undo').click()
    await page.locator('#redo').click()
    result=await page.evaluate('window.__creativeE2E.counts')
    assert result=={'legacy':0,'newUndo':1,'newRedo':1},result
    print('PASS browser: zero legacy calls; one isolated undo and redo',result)
   finally: await browser.close()
 finally:srv.shutdown()
asyncio.run(main())
