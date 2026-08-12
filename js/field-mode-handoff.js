(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const handoffId = params.get('handoff');
  if (!handoffId || typeof indexedDB === 'undefined') return;

  const DB_NAME = 'campsite-field-prep';
  const DB_VERSION = 1;
  const STORE_NAME = 'state';
  const HANDOFF_KEY = `handoff:${handoffId}`;
  const HANDOFF_TIMEOUT_MS = 10000;

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('準備データを開けませんでした。'));
    });
  }

  async function loadHandoff() {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(HANDOFF_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || tx.error || new Error('準備データを読めませんでした。'));
      });
    } finally {
      db.close();
    }
  }

  async function deleteHandoff() {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(HANDOFF_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('引き継ぎデータを削除できませんでした。'));
        tx.onabort = () => reject(tx.error || new Error('引き継ぎデータの削除が中断されました。'));
      });
    } finally {
      db.close();
    }
  }

  function removeHandoffFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('handoff');
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, '', next || 'field-mode.html');
  }

  function waitForFieldLoad() {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        const text = fileStatus?.textContent || '';
        if (text.includes('件を読み込み')) {
          window.clearInterval(timer);
          resolve(true);
          return;
        }
        if (text.trim().startsWith('⚠')) {
          window.clearInterval(timer);
          reject(new Error(text.replace(/^⚠\s*/, '') || '現地モードで読み込めませんでした。'));
          return;
        }
        if (Date.now() - startedAt >= HANDOFF_TIMEOUT_MS) {
          window.clearInterval(timer);
          reject(new Error('現地モードの読み込みが完了しませんでした。'));
        }
      }, 80);
    });
  }

  function putFileIntoExistingInput(file) {
    if (typeof DataTransfer !== 'function') {
      throw new Error('このブラウザでは自動引き継ぎを利用できません。');
    }
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function run() {
    modeStatus.textContent = '準備データ読込中';
    fileStatus.textContent = '現地モード準備から引き継いでいます…';

    try {
      const handoff = await loadHandoff();
      if (!handoff?.kml) throw new Error('現地モード準備の引き継ぎデータが見つかりません。');

      const file = new File(
        [handoff.kml],
        handoff.sourceName || 'field-prep.kml',
        {
          type: 'application/vnd.google-earth.kml+xml',
          lastModified: Number(handoff.createdAt) || Date.now()
        }
      );

      putFileIntoExistingInput(file);
      await waitForFieldLoad();
      await deleteHandoff().catch(error => console.warn('field handoff cleanup failed', error));
      removeHandoffFromUrl();
      modeStatus.textContent = '準備データ読込済';
    } catch (error) {
      console.error('field mode handoff failed', error);
      modeStatus.textContent = '引き継ぎ失敗';
      fileStatus.textContent = `⚠ ${error.message || '現地モード準備から引き継げませんでした。'} KMZ / KMLを手動で選択できます。`;
    }
  }

  function startAfterPageReady() {
    if (document.readyState === 'complete') {
      window.setTimeout(run, 0);
    } else {
      window.addEventListener('load', run, { once: true });
    }
  }

  startAfterPageReady();
})();
