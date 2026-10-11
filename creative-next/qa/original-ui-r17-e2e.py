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
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    await page.goto(f'http://127.0.0.1:{srv.server_port}/creative-next/original-ui-r17/index.html',wait_until='domcontentloaded')
    await page.wait_for_function('Boolean(window.creativeR17)')
    assert await page.locator('#undo').is_disabled()
    await page.evaluate('window.creativeR17.enableForTest()')
    await page.evaluate("document.getElementById('undo').click();document.getElementById('redo').click()")
    counts=await page.evaluate('window.creativeR17.counters')
    assert counts=={'undo':1,'redo':1},counts
    assert not errors,errors
    print('PASS r17 original UI DOM with isolated Undo/Redo, no old handlers',counts)
   finally:await browser.close()
 finally:srv.shutdown()
asyncio.run(main())
