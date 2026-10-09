#!/usr/bin/env python3
"""Isolated QA: actual Chromium IndexedDB strict commit then immediate SIGKILL.
No user data, public site, or production app is ever used.
"""
import asyncio, pathlib, tempfile, os, signal, sys
from functools import partial
from threading import Thread
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.async_api import async_playwright

ROOT=pathlib.Path(__file__).resolve().parents[2]
MODULE='/creative-next/phase-2-preview/strict-idb-checkpoint.mjs'
PAGE='/creative-next/phase-2-preview/index.html'

def browser_pid(profile):
    match=('--user-data-dir='+str(profile)).encode()
    roots=[]
    for path in pathlib.Path('/proc').iterdir():
        if not path.name.isdecimal():continue
        try:cmd=(path/'cmdline').read_bytes().split(b'\0')
        except OSError:continue
        if match in cmd and not any(x.startswith(b'--type=') for x in cmd):roots.append(int(path.name))
    if len(roots)!=1:raise RuntimeError(f'Expected precisely one disposable browser process, found {roots}')
    return roots[0]

async def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}'+PAGE
    browser_bin='/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').exists() else None
    try:
      async with async_playwright() as p:
       for i,delay in enumerate([0,0.1,1]):
        with tempfile.TemporaryDirectory(prefix=f'creative-idb-{i}-') as folder:
         profile=pathlib.Path(folder)/'profile'
         kwargs=dict(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
         if browser_bin:kwargs['executable_path']=browser_bin
         a=await asyncio.wait_for(p.chromium.launch_persistent_context(str(profile),**kwargs),timeout=25)
         page=a.pages[0] if a.pages else await a.new_page()
         await page.goto(url,wait_until='domcontentloaded',timeout=15000)
         state=await page.evaluate(f'''async (i)=>{{
           const {{createStrictIndexedCheckpoint}}=await import('{MODULE}');
           const checkpoint=createStrictIndexedCheckpoint({{namespace:'campsite-creative-next-v1-idb-native-'+i}});
           const out=await checkpoint.save({{records:[{{id:'test-id',kind:'pokestop',role:'existing',title:'Committed'+i,lat:35,lng:139}}],activityAreas:[]}},{{expectedRevision:null}});
           const now=await checkpoint.inspect();
           return {{out,nowStatus:now.status,nowRevision:now.revision,requested:now.strictRequested}};
         }}''',i)
         assert state['nowStatus']=='READY' and state['nowRevision']==1 and state['requested'] is True,state
         if delay:await asyncio.sleep(delay)
         pid=browser_pid(profile)
         os.kill(pid,signal.SIGKILL)
         await asyncio.sleep(.8)
         b=await asyncio.wait_for(p.chromium.launch_persistent_context(str(profile),**kwargs),timeout=25)
         reopened=b.pages[0] if b.pages else await b.new_page()
         await reopened.goto(url,wait_until='domcontentloaded',timeout=15000)
         result=await reopened.evaluate(f'''async(i)=>{{
            const {{createStrictIndexedCheckpoint}}=await import('{MODULE}');
            const cp=createStrictIndexedCheckpoint({{namespace:'campsite-creative-next-v1-idb-native-'+i}});
            const v=await cp.inspect();return {{status:v.status,revision:v.revision,title:v.snapshot?.records?.[0]?.title}};
         }}''',i)
         print('IDB_SIGKILL_RESULT',{'delaySeconds':delay,'saved':state,'reopened':result},flush=True)
         assert result=={'status':'READY','revision':1,'title':'Committed'+str(i)},result
         await b.close()
       print('PASS: strict IndexedDB transaction reopens after immediate browser SIGKILL (0/0.1/1 sec)',flush=True)
      return 0
    finally:server.shutdown()

if __name__=='__main__':
 try:sys.exit(asyncio.run(main()))
 except Exception as e:print('NOT_PASS_STRICT_IDB:',type(e).__name__,repr(e)[:1000],flush=True);sys.exit(1)
