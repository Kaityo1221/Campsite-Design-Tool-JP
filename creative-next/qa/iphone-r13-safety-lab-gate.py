#!/usr/bin/env python3
"""Real Chromium smoke of the iPhone r13 synthetic safety UI.
No actual KMZ or production data; temporary localhost origin + browser profile.
Safari/iPhone conclusions must be recorded separately.
"""
import asyncio
import pathlib
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.async_api import async_playwright

ROOT=pathlib.Path(__file__).resolve().parents[2]
PAGE='/creative-next/phase-2-preview/iphone-safety-lab.html'

async def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),
        partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    try:
        async with async_playwright() as p:
            browser=await p.chromium.launch(headless=True,args=['--no-sandbox'])
            try:
                page=await browser.new_page()
                errors=[]
                page.on('pageerror',lambda error: errors.append(str(error)))
                url=f'http://127.0.0.1:{server.server_port}{PAGE}'
                response=await page.goto(url,wait_until='domcontentloaded',timeout=15000)
                assert response and response.status==200,response
                await page.locator('#run').click()
                await page.wait_for_function(
                  "()=>document.querySelector('#summary').textContent.includes('合格:') || document.querySelector('#summary').textContent.includes('HOLD:')",
                  timeout=25000)
                first=await page.evaluate("""() => ({
                  summary:document.querySelector('#summary').textContent,
                  result:[...document.querySelectorAll('#result li')].map(n=>n.textContent)
                })""")
                print('R13_NATIVE_INITIAL',first,flush=True)
                assert first['summary'].startswith('合格:'),first
                assert len(first['result'])==6,first
                assert all(x.startswith('PASS |') for x in first['result']),first
                await page.reload(wait_until='domcontentloaded')
                await page.locator('#reopen').click()
                await page.wait_for_function(
                  "()=>document.querySelector('#summary').textContent.includes('再開試験PASS') || document.querySelector('#summary').textContent.includes('HOLD:')",
                  timeout=15000)
                reopened=await page.evaluate("""() => ({
                  summary:document.querySelector('#summary').textContent,
                  result:[...document.querySelectorAll('#result li')].map(n=>n.textContent)
                })""")
                print('R13_NATIVE_REOPEN',reopened,flush=True)
                assert reopened['summary'].startswith('再開試験PASS'),reopened
                assert len(reopened['result'])==2,reopened
                assert all(x.startswith('PASS |') for x in reopened['result']),reopened
                assert not errors,errors
                print('PASS: r13 safety lab native browser initial + reload + reopen',flush=True)
            finally:
                await browser.close()
    finally:
        server.shutdown()

if __name__=='__main__':
    try:asyncio.run(main())
    except Exception as exc:
        print('NOT_PASS_R13_SAFETY_LAB',type(exc).__name__,str(exc)[:1000],flush=True)
        sys.exit(1)
