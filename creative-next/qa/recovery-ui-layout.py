"""Chromium DOM/layout-only smoke, NOT an origin or storage test."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]/'phase-2-preview'
html=(root/'index.html').read_text()
import re
html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.DOTALL|re.IGNORECASE)
html=re.sub(r'<link\b[^>]*>','',html,flags=re.IGNORECASE)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844})
 page.set_content(html)
 page.add_style_tag(content=(root/'preview.css').read_text())
 assert page.locator('#recovery-review').is_hidden()
 page.evaluate("document.getElementById('recovery-review').hidden=false")
 page.locator('#recovery-choice').select_option('')
 page.locator('#recovery-choice').evaluate("el=>el.add(new Option('第1世代 · 保存枠A · SHA256 0123456789ab…','a'))")
 assert page.locator('#recovery-apply').is_disabled()
 assert page.locator('#recovery-cancel').is_visible()
 assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'), 'Recovery form overflows phone width'
 print('PASS: Chromium 390px recovery UI layout (no modules, localStorage, Leaflet or network)')
 b.close()
