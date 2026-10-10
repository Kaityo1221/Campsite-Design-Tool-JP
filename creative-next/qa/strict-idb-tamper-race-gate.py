#!/usr/bin/env python3
"""Isolated native Chromium safety gate: an IDB record changes between inspection and commit.
Only a temporary browser profile and a dedicated Creative Next namespace are used.
"""
import asyncio
import pathlib
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]

async def main():
    server = ThreadingHTTPServer(
        ('127.0.0.1', 0),
        partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    )
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True, args=['--no-sandbox'])
            try:
                page = await browser.new_page()
                await page.goto(
                    f'http://127.0.0.1:{server.server_port}/creative-next/phase-2-preview/index.html',
                    wait_until='domcontentloaded',
                    timeout=15000
                )
                result = await page.evaluate("""async () => {
                    const {createStrictIndexedCheckpoint} =
                        await import('/creative-next/phase-2-preview/strict-idb-checkpoint.mjs');
                    const ns = 'campsite-creative-next-v1-idb-tamper-race-gate';
                    const mk = title => ({
                        records: [{id:'poi',role:'existing',kind:'pokestop',title,lat:35,lng:139}],
                        activityAreas:[]
                    });
                    const cp = createStrictIndexedCheckpoint({namespace:ns});
                    await cp.save(mk('known-good'),{expectedRevision:null});
                    const proto = IDBDatabase.prototype;
                    const original = proto.transaction;
                    let injected = false;
                    let mutationCompleted = false;
                    proto.transaction = function(store,mode,options) {
                        if (!injected && mode === 'readwrite' &&
                            this.name === 'campsite-creative-next-v1-strict-checkpoints') {
                            injected = true;
                            // Queue a competing transaction BEFORE the save's readwrite
                            // transaction. It preserves revision=1 but changes content.
                            const competing = original.call(this,store,'readwrite',{durability:'strict'});
                            const request = competing.objectStore('checkpoints').get(ns);
                            request.onsuccess = () => {
                                const row = request.result;
                                row.current.checksum = '0'.repeat(64);
                                competing.objectStore('checkpoints').put(row,ns);
                            };
                            competing.oncomplete = () => {mutationCompleted = true;};
                        }
                        return original.call(this,store,mode,options);
                    };
                    let attemptCode;
                    try {
                        try {
                            await cp.save(mk('should-never-overwrite'),{expectedRevision:1});
                            attemptCode = 'UNEXPECTED_SAVED';
                        } catch (error) {
                            attemptCode = error.code || error.name || 'UNKNOWN';
                        }
                    } finally {
                        proto.transaction = original;
                    }
                    const after = await cp.inspect();
                    await cp.close();
                    return {
                        injected, mutationCompleted, attemptCode,
                        afterStatus: after.status,
                        afterRevision: after.revision
                    };
                }""")
                print('IDB_TAMPER_RACE_RESULT', result, flush=True)
                assert result['injected'] and result['mutationCompleted'], result
                assert result['attemptCode'] == 'IDB_CONFLICT', result
                assert result['afterStatus'] == 'CORRUPT', result
                assert result['afterRevision'] is None, result
                print('PASS: IDB change after inspection is refused, not silently overwritten', flush=True)
            finally:
                await browser.close()
    finally:
        server.shutdown()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except Exception as exc:
        print('NOT_PASS_IDB_TAMPER_RACE:', type(exc).__name__, str(exc)[:1000], flush=True)
        sys.exit(1)
