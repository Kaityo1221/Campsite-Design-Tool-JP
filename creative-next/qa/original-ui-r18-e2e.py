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
    await page.goto(f'http://127.0.0.1:{srv.server_port}/creative-next/original-ui-r18/index.html',wait_until='domcontentloaded')
    await page.wait_for_function('Boolean(window.creativeR18)',timeout=20000)
    assert await page.locator('#undo').is_disabled()
    assert (await page.evaluate('creativeR18.loadSynthetic({confirm:false})'))['status']=='CANCELLED'
    result=await page.evaluate('creativeR18.loadSynthetic({confirm:true})')
    assert result['applied']==True,result
    result=await page.evaluate("creativeR18.changeMemo('変更')")
    assert result['changed']==True,result
    await page.evaluate("document.getElementById('undo').click()")
    assert await page.evaluate('creativeR18.state().records[0].memo')=='初期'
    await page.evaluate("document.getElementById('redo').click()")
    assert await page.evaluate('creativeR18.state().records[0].memo')=='変更'
    assert not errors,errors
    print('PASS r18: real isolated source-backed session + original DOM undo/redo, no storage')
   finally:await browser.close()
 finally:srv.shutdown()
asyncio.run(main())
