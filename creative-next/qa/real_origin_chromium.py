"""Creative Next isolated real-origin browser acceptance preflight.

Never runs against production. No legacy storage key access. Browser context is
in-memory; closes without persisting its profile. Private KMZ is read by browser
only from the explicit local file path, and never copied into source artifacts.

Usage:
  python qa/real_origin_chromium.py --root /path/to/repo --kmz /private/kasai.kmz
When navigation is blocked by sandbox policy, report BLOCKED (not PASS).
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import sys
from playwright.sync_api import sync_playwright


def run(root, kmz, executable):
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f'http://127.0.0.1:{server.server_port}/creative-next/phase-2-preview/index.html'
    browser = None
    try:
        with sync_playwright() as p:
            opts = {'headless': True}
            if executable:
                opts['executable_path'] = executable
                opts['args'] = ['--no-sandbox', '--disable-dev-shm-usage']
            browser = p.chromium.launch(**opts)
            ctx = browser.new_context(viewport={'width': 390, 'height': 844})
            page = ctx.new_page()
            page.on('dialog', lambda d: d.accept())
            try:
                page.goto(url, wait_until='domcontentloaded', timeout=12000)
            except Exception as e:
                if 'ERR_BLOCKED_BY_ADMINISTRATOR' in str(e):
                    print('BLOCKED: browser navigation prohibited by environment; no real-origin claims')
                    browser.close()
                    browser = None
                    return 2
                raise
            page.wait_for_timeout(1000)
            readiness = page.evaluate('''() => ({
               secure: !!globalThis.isSecureContext,
               crypto: !!globalThis.crypto?.subtle?.digest,
               storage: (() => {try {return !!localStorage} catch {return false}})(),
               locks: !!globalThis.navigator?.locks?.request,
               zip: !!globalThis.JSZip?.loadAsync,
               leaflet: !!globalThis.L?.map,
               mapStatus: document.getElementById('map-engine')?.textContent,
               diagnostics: document.getElementById('capability-status')?.textContent
            })''')
            print('CAPABILITIES:', readiness)
            if not (readiness['secure'] and readiness['crypto'] and readiness['storage'] and readiness['locks'] and readiness['zip']):
                print('INCOMPLETE: required native browser capabilities missing')
                browser.close()
                browser = None
                return 3
            if kmz:
                page.locator('#file').set_input_files(str(kmz))
                page.locator('#inspect').click()
                page.wait_for_function("document.querySelector('#accept').disabled === false",timeout=30000)
                page.locator('#accept').click()
                page.wait_for_function("document.querySelector('#counts').textContent.includes('既存 188')",timeout=30000)
                assert '距離円 213' in page.locator('#counts').inner_text()
                # A second stale tab must never overwrite the first tab's initial save.
                stale = ctx.new_page()
                stale.on('dialog', lambda d: d.accept())
                stale.goto(url, wait_until='domcontentloaded', timeout=12000)
                stale.locator('#file').set_input_files(str(kmz))
                stale.locator('#inspect').click()
                stale.wait_for_function("document.querySelector('#accept').disabled === false",timeout=30000)
                stale.locator('#accept').click()
                stale.wait_for_function("document.querySelector('#counts').textContent.includes('既存 188')",timeout=30000)
                page.locator('#save').click()
                page.wait_for_function("document.querySelector('#save-info').textContent.includes('保存確認完了')",timeout=30000)
                stale.locator('#save').click()
                stale.wait_for_function("document.querySelector('#status').textContent.includes('SAVE_CONFLICT')",timeout=30000)
                assert '保存確認完了' not in stale.locator('#save-info').inner_text()
                print('NATIVE_ORIGIN_STALE_TAB: PASS (second unsaved tab refused)')
                stale.close()
                page.reload(wait_until='domcontentloaded')
                page.locator('#resume').click()
                page.wait_for_function("document.querySelector('#counts').textContent.includes('既存 188')",timeout=30000)
                assert '距離円 213' in page.locator('#counts').inner_text()
                print('NATIVE_ORIGIN_KASAI_SAVE_RELOAD: PASS (isolated ephemeral Chromium context)')
            else:
                print('NATIVE_ORIGIN_START: PASS; Kasai KMZ flow SKIPPED (no --kmz)')
            ctx.close()
            browser.close()
            browser = None
            return 0
    finally:
        server.shutdown()
        server.server_close()

if __name__ == '__main__':
    cli = argparse.ArgumentParser()
    cli.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    cli.add_argument('--kmz', type=Path)
    cli.add_argument('--chromium', type=str, default='/usr/bin/chromium')
    args = cli.parse_args()
    try:
        sys.exit(run(args.root.resolve(), args.kmz.resolve() if args.kmz else None, args.chromium))
    except Exception as e:
        print('FAIL:', type(e).__name__, str(e)[:400])
        sys.exit(1)
