#!/usr/bin/env python3
"""Isolated iPhone r14 CSS smoke using desktop Chromium mobile viewports.
This is NOT iPhone Safari acceptance and it never opens real KMZ or storage.
"""
import asyncio
import pathlib
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.async_api import async_playwright

ROOT=pathlib.Path(__file__).resolve().parents[2]
PAGE='/creative-next/phase-2-preview/index.html'

async def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),
        partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    try:
        async with async_playwright() as p:
            browser=await p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            try:
                page=await browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
                resp=await page.goto(f'http://127.0.0.1:{server.server_port}{PAGE}',wait_until='domcontentloaded',timeout=15000)
                assert resp and resp.status==200,resp
                ns=await page.evaluate("""async()=> {
                    const m=await import('/creative-next/phase-2-preview/workspace-namespace.mjs');
                    return {
                        r13:m.namespaceForPreviewPath('/campsite-creative-next-preview/iphone-safety-r13/phase-2-preview/index.html'),
                        r14:m.namespaceForPreviewPath('/campsite-creative-next-preview/iphone-ui-r14/phase-2-preview/index.html'),
                        fallback:m.namespaceForPreviewPath('/creative-next/phase-2-preview/index.html')
                    }
                }""")
                assert ns['r14']=='campsite-creative-next-v1-iphone-ui-r14' and ns['r14']!=ns['r13'] and ns['r14']!=ns['fallback'],ns
                # Replace only the display-only placeholder row with a very long sample POI name.
                # This asserts layout, not an actual KMZ import or app save/restore.
                await page.evaluate("""() => {
                  const tbody=document.querySelector('#pois');
                  const tr=document.createElement('tr');
                  for(const value of ['長いPOI名称の表示試験'.repeat(18),'ポケストップ','既存']){
                    const td=document.createElement('td');td.textContent=value;tr.appendChild(td);
                  }
                  const td=document.createElement('td'),btn=document.createElement('button');
                  btn.type='button';btn.textContent='編集';td.appendChild(btn);tr.appendChild(td);
                  tbody.replaceChildren(tr);
                }""")
                for width in (375,390,430):
                    await page.set_viewport_size({'width':width,'height':844})
                    outcome=await page.evaluate("""() => {
                      const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
                      const buttons=[...document.querySelectorAll('button')].filter(visible);
                      const inputs=[...document.querySelectorAll('input:not([type=file]):not([type=checkbox]), select, textarea')].filter(visible);
                      const table=document.querySelector('.table-scroll');
                      const edit=document.querySelector('#pois button');
                      table.scrollLeft=table.scrollWidth;
                      const tr=table.getBoundingClientRect(),er=edit.getBoundingClientRect();
                      return {
                        viewport:innerWidth,docWidth:document.documentElement.scrollWidth,
                        tooShort:buttons.filter(b=>b.getBoundingClientRect().height<43.5).map(b=>b.id||b.textContent.trim()),
                        smallInputs:inputs.filter(e=>parseFloat(getComputedStyle(e).fontSize)<15.9).map(e=>e.id),
                        tableOverflow:table.scrollWidth>table.clientWidth,
                        editReachable:er.left>=tr.left-2&&er.right<=tr.right+2,
                        nameWrap:getComputedStyle(document.querySelector('#pois td')).overflowWrap
                      };
                    }""")
                    print('R14_UI_VIEWPORT',width,outcome,flush=True)
                    assert outcome['viewport']==width,outcome
                    assert outcome['docWidth']<=width+1,('page-level horizontal overflow',outcome)
                    assert not outcome['tooShort'],('touch targets below 44px',outcome)
                    assert not outcome['smallInputs'],('input Safari zoom risk',outcome)
                    assert outcome['editReachable'],('POI edit control unreachable after scrolling',outcome)
                    assert outcome['nameWrap']=='anywhere',outcome
                print('PASS: r14 CSS 375/390/430px and isolated namespace; Safari device still required',flush=True)
            finally:
                await browser.close()
    finally:
        server.shutdown()

if __name__=='__main__':
    try:asyncio.run(main())
    except Exception as error:
        print('NOT_PASS_R14_UI',type(error).__name__,str(error)[:1000],flush=True)
        sys.exit(1)
