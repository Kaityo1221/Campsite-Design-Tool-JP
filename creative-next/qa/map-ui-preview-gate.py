#!/usr/bin/env python3
"""U2 Map First browser UX gate: synthetic UI state only, zero user data."""
import asyncio
import pathlib
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.async_api import async_playwright

ROOT=pathlib.Path(__file__).resolve().parents[2]
PATH='/creative-next/map-ui-preview/index.html'
JS=(ROOT/'creative-next/map-ui-preview/ui.js').read_text(encoding='utf-8')
assert not re.search(r'\b(localStorage|sessionStorage)\s*[.\[]|\bindexedDB\s*[.\[]',JS), 'U2 shell must never access persisted app data'
assert 'createIsolatedEditorSession' not in JS and 'saveDraft(' not in JS, 'U2 must not wire editing/saving before contract approval'

async def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    try:
        async with async_playwright() as p:
            browser=await p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            try:
                for width in (375,390,430):
                    page=await browser.new_page(viewport={'width':width,'height':844},has_touch=True,is_mobile=True)
                    errors=[]
                    page.on('pageerror',lambda e:errors.append(str(e)))
                    response=await page.goto(f'http://127.0.0.1:{server.server_port}{PATH}',wait_until='domcontentloaded',timeout=15000)
                    assert response and response.status==200,response
                    print('U2_CHECK start state',width,flush=True)
                    report=await page.evaluate("""async() => {
                      const sources=[
                        '/assets/creative-mode-opening-final.webp',
                        '/assets/creative-mode-opening.png',
                        '/creative-next/map-ui-preview/assets/creative-mode-opening-final.webp'
                      ];
                      const outputs=[];
                      for(const src of sources){
                        const pic=new Image();pic.src=src;
                        try {await pic.decode()}catch(e){outputs.push({src,error:String(e)});continue}
                        const canvas=document.createElement('canvas');
                        canvas.width=20;canvas.height=30;
                        const context=canvas.getContext('2d',{willReadFrequently:true});
                        context.drawImage(pic,0,0,20,30);
                        const arr=context.getImageData(0,0,20,30).data;
                        let lum=0,alp=0,bright=0,colored=0;
                        for(let i=0;i<arr.length;i+=4){
                          const y=(arr[i]*.2126+arr[i+1]*.7152+arr[i+2]*.0722);
                          lum+=y;alp+=arr[i+3];
                          if(y>65&&arr[i+3]>100)bright++;
                          if(Math.max(arr[i],arr[i+1],arr[i+2])-Math.min(arr[i],arr[i+1],arr[i+2])>25&&arr[i+3]>100)colored++;
                        }
                        outputs.push({src,w:pic.naturalWidth,h:pic.naturalHeight,
                          avgLum:Math.round(lum/600),avgAlpha:Math.round(alp/600),
                          brightFraction:Math.round(bright/6),coloredFraction:Math.round(colored/6)});
                      }
                      return {images:outputs,cssImage:getComputedStyle(document.getElementById('entry')).backgroundImage.slice(0,350)};
                    }""")
                    print('BACKGROUND_CONTENT_DIAGNOSTIC',width,report,flush=True)
                    assert await page.locator('#entry').is_visible(),'entry hidden'
                    art=await page.locator('#entryArtwork').evaluate("""async e=>{
                      await e.decode();
                      const r=e.getBoundingClientRect(),s=getComputedStyle(e);
                      return {w:e.naturalWidth,h:e.naturalHeight,rectWidth:r.width,rectHeight:r.height,
                        opacity:s.opacity,display:s.display,objectFit:s.objectFit,
                        loaded:e.complete,src:e.currentSrc};
                    }""")
                    assert art['loaded'] and art['w']>=700 and art['h']>=1200,('PNG artwork missing',art)
                    assert art['rectWidth']>=width and art['rectHeight']>700,('PNG artwork not filling iPhone entry',art)
                    assert art['opacity']=='1' and art['display']!='none' and art['objectFit']=='cover',('Artwork visibility',art)
                    # Screenshot must have visible photographic detail, rather than the old flat dark fallback.
                    from io import BytesIO
                    from PIL import Image, ImageStat
                    screen=Image.open(BytesIO(await page.screenshot())).convert('RGB')
                    averages=[]
                    for xx in (0.15,0.50,0.85):
                        for yy in (0.38,0.55,0.70):
                            xc=int(width*xx);yc=int(844*yy)
                            box=screen.crop((max(0,xc-20),max(0,yc-20),min(width,xc+20),min(844,yc+20)))
                            averages.append(round(sum(ImageStat.Stat(box).mean)/3))
                    print('ENTRY_SCREENSHOT_LUMINANCE',width,averages,flush=True)
                    assert max(averages)>=45,('Entry still appears blank/dark despite decoded PNG',averages)

                    assert await page.locator('#workspace').is_hidden(),'workspace must be hidden before start'
                    assert await page.locator('#start').is_enabled(),'start not enabled'
                    assert await page.locator('.filebar').is_disabled(),'file chooser must be disabled'
                    assert not await page.locator('body').evaluate('(b)=>b.scrollWidth>innerWidth+1'),'entry overflow'
                    before=await page.evaluate('JSON.stringify(Object.entries(localStorage))')
                    print('U2_CHECK launch map',width,flush=True)
                    await page.locator('#start').click()
                    await page.wait_for_function("location.hash==='#map'")
                    await page.locator('#workspace').wait_for(state='visible',timeout=5000)
                    assert await page.locator('#save').is_disabled()
                    assert await page.locator('.bottom-dock button').first.is_disabled()
                    print('U2_CHECK layer panel',width,flush=True)
                    await page.locator('#layers').click()
                    assert await page.locator('#layerPanel').is_visible()
                    assert all([await control.is_disabled() for control in await page.locator('#layerPanel input').all()]),'Layer controls must not modify unconnected data'
                    await page.locator('#layers').click()
                    assert await page.locator('#layerPanel').is_hidden()
                    print('U2_CHECK POI panel',width,flush=True)
                    await page.locator('#add').click()
                    assert await page.locator('#addPanel').is_visible()
                    assert all([await button.is_disabled() for button in await page.locator('.poi-choices button').all()])
                    icons=await page.locator('.poi-choices img').evaluate_all('(els)=>els.map(x=>x.complete && x.naturalWidth>0)')
                    assert len(icons)==3 and all(icons),('original Creative POI icons failed to load',icons)
                    print('U2_CHECK tools',width,flush=True)
                    await page.locator('#toolbox').click()
                    assert await page.locator('#addPanel').is_hidden() and await page.locator('#toolPanel').is_visible()
                    print('U2_CHECK help',width,flush=True)
                    await page.locator('#help').click()
                    assert await page.locator('#helpPanel').is_visible() and await page.locator('#toolPanel').is_hidden()
                    await page.locator('[data-page="1"]').click()
                    assert await page.locator('[data-page="1"]').get_attribute('aria-current')=='true'
                    await page.keyboard.press('Escape')
                    assert await page.locator('#helpPanel').is_hidden()
                    await page.locator('#basemap').click()
                    assert await page.locator('#basemap').get_attribute('aria-pressed')=='true'
                    assert await page.evaluate('JSON.stringify(Object.entries(localStorage))')==before,'UI preview wrote to storage'
                    dimensions=await page.evaluate("""() => ({
                      viewport:innerWidth,
                      docWidth:document.documentElement.scrollWidth,
                      controls:Object.fromEntries(
                        ['back','basemap','layers','help','toolbox','add'].map(id=>[id,document.getElementById(id).getBoundingClientRect().height])
                      )
                    })""")
                    assert dimensions['docWidth']<=width+1,('map page width overflow',dimensions)
                    assert all(h>=44 for h in dimensions['controls'].values()),('tap target too small',dimensions)
                    print('U2_CHECK history',width,flush=True)
                    await page.locator('#back').click()
                    await page.locator('#entry').wait_for(state='visible',timeout=5000)
                    await page.go_forward()
                    await page.locator('#workspace').wait_for(state='visible',timeout=5000)
                    await page.go_back()
                    await page.locator('#entry').wait_for(state='visible',timeout=5000)
                    assert not errors,('JavaScript page error',errors)
                    print('PASS_MAP_FIRST_U2',width,dimensions,flush=True)
                    await page.close()
                print('PASS: Map First visual shell, controlled panels, help, history, isolated storage at 375/390/430px',flush=True)
            finally:
                await browser.close()
    finally:
        server.shutdown()

if __name__=='__main__':
    try: asyncio.run(main())
    except Exception as error:
        import traceback
        traceback.print_exc()
        print('NOT_PASS_MAP_FIRST_U2',type(error).__name__,str(error)[:1000],flush=True)
        sys.exit(1)
