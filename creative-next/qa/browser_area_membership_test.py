"""Isolated Chromium 390px DOM/UI test with in-memory storage and crypto hash provider.
This is NOT a real URL-origin, tile or Safari acceptance test.
"""
from pathlib import Path
import hashlib,re
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parent.parent
root=base/'creative-next'/'phase-2-preview'
html=re.sub(r'<script[^>]*></script>','',(root/'index.html').read_text())
html=re.sub(r'<link rel="stylesheet"[^>]*>','',html)
kmz=Path('/mnt/data/葛西臨海公園【キャンプサイト用】_creative_creative_creative(1).kmz')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':844})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.expose_function('sha256_for_qa',lambda raw:list(hashlib.sha256(bytes(raw)).digest()))
 page.set_content(html)
 page.add_style_tag(content=(root/'preview.css').read_text())
 page.evaluate('''() => {const m=new Map([['next-lab-creative-v7','PRESERVE_OLD']]);window.__qaMemory=m;let i=0;Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v))}});Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=>`cde00000-0000-4000-8000-${String(++i).padStart(12,'0')}`,subtle:{digest:async(_,v)=>new Uint8Array(await window.sha256_for_qa(Array.from(new Uint8Array(v)))).buffer}}});}''')
 page.add_script_tag(content=(root/'vendor/jszip.min.js').read_text())
 page.add_script_tag(content=(base/'qa'/'MEMBERSHIP_BROWSER_BUNDLE.js').read_text())
 page.locator('#file').set_input_files(str(kmz));page.locator('#inspect').click();page.wait_for_function('!document.getElementById("inspect").disabled',timeout=35000)
 assert page.locator('#accept').is_enabled(),page.locator('#candidate').inner_text()
 page.once('dialog',lambda d:d.accept());page.locator('#accept').click()
 assert '活動範囲 1' in page.locator('#counts').inner_text()
 page.locator('#area-create-open').click()
 assert page.locator('#area-create-form').is_visible()
 page.locator('#area-create-points').fill('35.640,139.850\n35.640,139.860\n35.650,139.860\n35.650,139.850')
 page.once('dialog',lambda d:d.accept());page.locator('#area-create-form button[type=submit]').click()
 assert '活動範囲 2' in page.locator('#counts').inner_text(),page.locator('#counts').inner_text()
 assert page.locator('#area-select option').count()==2
 page.once('dialog',lambda d:d.accept());page.locator('#area-remove').click()
 assert '活動範囲 1' in page.locator('#counts').inner_text()
 page.locator('#undo').click()
 assert '活動範囲 2' in page.locator('#counts').inner_text()
 page.locator('#redo').click()
 assert '活動範囲 1' in page.locator('#counts').inner_text()
 page.locator('#save').click();page.wait_for_function('!document.getElementById("save").disabled',timeout=35000)
 assert '保存確認完了' in page.locator('#save-info').inner_text(),page.locator('#status').inner_text()
 assert page.evaluate('window.__qaMemory.get("next-lab-creative-v7")')=='PRESERVE_OLD'
 assert not errors,errors
 print('CHROMIUM_390_AREA_MEMBERSHIP_UI PASS: original KMZ, form add, confirm remove, Undo/Redo, journal save, legacy key safe; simulated origin/crypto, canvas fallback; not native Leaflet/tiles or Safari')
 browser.close()
