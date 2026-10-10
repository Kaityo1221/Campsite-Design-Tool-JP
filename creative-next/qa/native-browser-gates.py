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
                # Leaflet uses its own vector Canvas under preferCanvas:true.
                # Hiding all canvases in .map-wrap made POIs, circles and areas invisible
                # while draggable vertex DOM markers still appeared on Safari.
                vectors=page.locator('#leaflet-map .leaflet-overlay-pane canvas')
                assert await vectors.count()>0,'Leaflet Canvas renderer did not mount'
                vector_state=await vectors.first.evaluate("""el => {
                    const s=getComputedStyle(el);
                    return {display:s.display,visibility:s.visibility,width:el.getBoundingClientRect().width,
                      height:el.getBoundingClientRect().height,background:s.backgroundImage};
                }""")
                assert vector_state['display']!='none' and vector_state['visibility']!='hidden' and vector_state['width']>0 and vector_state['height']>0,('Leaflet vector Canvas hidden by CSS',vector_state)
                assert vector_state['background']=='none',('Leaflet vector Canvas has fallback-only styling',vector_state)
                print('PASS: Leaflet vector Canvas (POI/circles/areas) is visible and transparent, not hidden by fallback styling',flush=True)
                await page.wait_for_function('document.getElementById("map-engine").textContent.includes("地図タイル読込済み")',timeout=30000)
                await page.locator('.leaflet-tile-loaded').first.wait_for(state='attached',timeout=30000)
                tiles=await page.locator('.leaflet-tile-loaded').count()
                assert tiles>0,'No real Leaflet map tiles loaded'
                print('PASS: real Leaflet and '+str(tiles)+' map tiles loaded, not a fallback map',flush=True)
                # Actual Leaflet click input must remain a proposal until confirmed.
                prior_counts=await page.locator('#counts').inner_text()
                await page.locator('#add-new').click()
                await page.locator('#map-place').click()
                await page.locator('#leaflet-map').click(position={'x':145,'y':115})
                assert await page.locator('#new-lat').input_value(),'Leaflet click did not populate latitude'
                assert await page.locator('#new-lng').input_value(),'Leaflet click did not populate longitude'
                assert await page.locator('#counts').inner_text()==prior_counts,'Unconfirmed click changed project'
                await page.locator('#new-cancel').click()
                print('PASS: actual Leaflet map click proposed coordinates without committing a POI',flush=True)
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
                print('PASS: localhost origin Leaflet initialized, KMZ imported, localStorage persisted/reloaded, 2 generations, explicit UI recovery',flush=True)
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
                print('PASS: native concurrent Web Locks allow exactly one first-save, second tab rejected',flush=True)

                # Real Chromium localStorage quota test. Allocate on a unique,
                # test-only namespace until Chromium itself raises QuotaExceededError.
                # This uses the native Storage object, not a fake QuotaError shim.
                quota=await page.evaluate(f'''async () => {{
                    const {{createCreativeSaveJournal}}=await import('{JS_PATH}');
                    const j=createCreativeSaveJournal({{storage:localStorage,namespace:'campsite-creative-next-v1-native-quota',locks:navigator.locks,requireLock:true}});
                    const state=(title,forceLarge=false)=>({{records:[{{id:'quota-test',role:'existing',kind:'pokestop',title,lat:35.1,lng:139.2,memo:forceLarge?'M'.repeat(256*1024):''}}],activityAreas:[]}});
                    await j.save(state('Committed'),{{expectedRevision:null}});
                    const original=localStorage.getItem(j.keys.pointer);
                    let quotaSeen=false,saveFailed=false,allocated=0,errorName='';
                    try {{
                        for(let i=0;i<220;i++){{
                            try {{localStorage.setItem('campsite-native-quota-filler-'+i,'Q'.repeat(128*1024));allocated++;}}
                            catch(e){{if(e.name!=='QuotaExceededError')throw e;quotaSeen=true;break;}}
                        }}
                        if(quotaSeen){{
                            try{{await j.save(state('AttemptedUpdate',true),{{expectedRevision:1}});}}
                            catch(e){{saveFailed=true;errorName=e.name;}}
                        }}
                        const after=await j.load();
                        return {{quotaSeen,saveFailed,errorName,allocated,
                            pointerSame:localStorage.getItem(j.keys.pointer)===original,
                            revision:after.revision,status:after.status,title:after.snapshot?.records[0]?.title}};
                    }}finally{{
                        for(let i=0;i<allocated;i++)localStorage.removeItem('campsite-native-quota-filler-'+i);
                    }}
                }}''')
                print('NATIVE_QUOTA_RESULT',quota,flush=True)
                assert quota['quotaSeen'] and quota['saveFailed'] and quota['errorName']=='QuotaExceededError',quota
                assert quota['pointerSame'] and quota['status']=='READY' and quota['revision']==1 and quota['title']=='Committed',quota
                print('PASS: native localStorage QuotaExceededError preserved committed generation; filler bytes cleaned',flush=True)

                # Real abrupt browser-process termination. Use a separate
                # persistent profile so the on-disk storage can be reopened
                # after SIGKILL, unlike ephemeral incognito new_context().
                await context.close();await browser.close()
                profile=pathlib.Path(tmp)/'chrome-crash-profile'
                crash_context=await asyncio.wait_for(
                    p.chromium.launch_persistent_context(str(profile),headless=True,
                        executable_path=chromium_bin or p.chromium.executable_path,
                        args=['--no-sandbox','--disable-dev-shm-usage']),
                    timeout=25)
                crash_page=crash_context.pages[0] if crash_context.pages else await crash_context.new_page()
                await crash_page.goto(url,wait_until='domcontentloaded',timeout=15000)
                committed=await crash_page.evaluate(f'''async () => {{
                    const {{createCreativeSaveJournal}}=await import('{JS_PATH}');
                    const j=createCreativeSaveJournal({{storage:localStorage,
                        namespace:'campsite-creative-next-v1-crash-persistent',
                        locks:navigator.locks,requireLock:true}});
                    await j.save({{records:[{{id:'persist',role:'existing',kind:'pokestop',
                      title:'CommittedBeforeCrash',lat:35,lng:139}}],activityAreas:[]}},
                      {{expectedRevision:null}});
                    const r=await j.load();
                    return {{status:r.status,revision:r.revision,title:r.snapshot?.records[0]?.title}};
                }}''')
                assert committed=={'status':'READY','revision':1,'title':'CommittedBeforeCrash'},committed
                # Chromium may batch LocalStorage LevelDB disk commits after the
                # synchronous JavaScript setter returns. Check persistence AFTER
                # a short disk-flush window; immediate SIGKILL remains a separate
                # documented durability risk, not a promised behavior.
                await asyncio.sleep(8)
                storage_dir=profile/'Default'/'Local Storage'/'leveldb'
                print('NATIVE_STORAGE_DISK_FILES',
                    [(p.name,p.stat().st_size) for p in storage_dir.glob('*') if p.is_file()][:12],
                    flush=True)
                # Identify ONLY this disposable profile's top-level Chromium PID.
                roots=[]
                profile_arg=('--user-data-dir='+str(profile)).encode()
                for process in pathlib.Path('/proc').iterdir():
                    if not process.name.isdecimal():
                        continue
                    try:
                        args=(process/'cmdline').read_bytes().split(b'\x00')
                    except (OSError,PermissionError):
                        continue
                    if profile_arg in args and not any(a.startswith(b'--type=') for a in args):
                        roots.append(int(process.name))
                assert len(roots)==1,('Cannot safely identify one disposable Chromium process',roots)
                print('NATIVE_BROWSER_SIGKILL_START',{'profile':profile.name},flush=True)
                import signal
                os.kill(roots[0],signal.SIGKILL)
                await asyncio.sleep(1)
                # Reopen the exact on-disk profile; a clean close would not
                # test crash resilience and must not substitute for SIGKILL.
                reopened_context=await asyncio.wait_for(
                    p.chromium.launch_persistent_context(str(profile),headless=True,
                        executable_path=chromium_bin or p.chromium.executable_path,
                        args=['--no-sandbox','--disable-dev-shm-usage']),
                    timeout=25)
                reopened=reopened_context.pages[0] if reopened_context.pages else await reopened_context.new_page()
                await reopened.goto(url,wait_until='domcontentloaded',timeout=15000)
                recovered=await reopened.evaluate(f'''async () => {{
                    const {{createCreativeSaveJournal}}=await import('{JS_PATH}');
                    const j=createCreativeSaveJournal({{storage:localStorage,
                        namespace:'campsite-creative-next-v1-crash-persistent',
                        locks:navigator.locks,requireLock:true}});
                    const state=await j.load();
                    return {{status:state.status,revision:state.revision,
                        title:state.snapshot?.records[0]?.title}};
                }}''')
                assert recovered=={'status':'READY','revision':1,'title':'CommittedBeforeCrash'},recovered
                print('PASS: real browser SIGKILL and fresh persistent-profile reopen preserved committed localStorage',flush=True)
                await reopened_context.close()

                return 0
        finally:server.shutdown()

if __name__=='__main__':
    try:sys.exit(asyncio.run(run()))
    except Exception as exc:print('NOT_PASS:',type(exc).__name__,repr(exc)[:1000],flush=True);sys.exit(1)
