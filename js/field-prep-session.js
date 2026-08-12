(() => {
  'use strict';

  const DB_NAME = 'campsite-field-prep';
  const DB_VERSION = 1;
  const STORE_NAME = 'state';
  const KEY = 'current';
  const HANDOFF_PREFIX = 'handoff:';

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB is not available'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
    });
  }

  async function withStore(mode, callback) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        let result;
        try { result = callback(store); } catch (error) { reject(error); return; }
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
      });
    } finally {
      db.close();
    }
  }

  async function getByKey(key) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const request = transaction.objectStore(STORE_NAME).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('IndexedDB read failed'));
      });
    } finally {
      db.close();
    }
  }

  async function save(snapshot) {
    const payload = { version: 1, updatedAt: new Date().toISOString(), ...snapshot };
    await withStore('readwrite', store => store.put(payload, KEY));
    return payload;
  }

  async function load() {
    return getByKey(KEY);
  }

  async function clear() {
    await withStore('readwrite', store => store.delete(KEY));
  }

  async function createHandoff({ kml, sourceName = 'field-prep.kml', pointCount = 0 } = {}) {
    if (!String(kml || '').trim()) throw new Error('現地モードへ渡すKMLがありません。');
    const random = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const id = String(random);
    const payload = {
      version: 1,
      id,
      createdAt: Date.now(),
      sourceName,
      pointCount: Number(pointCount) || 0,
      kml: String(kml)
    };
    await withStore('readwrite', store => store.put(payload, `${HANDOFF_PREFIX}${id}`));
    return payload;
  }

  async function loadHandoff(id) {
    if (!id) return null;
    return getByKey(`${HANDOFF_PREFIX}${id}`);
  }

  async function deleteHandoff(id) {
    if (!id) return;
    await withStore('readwrite', store => store.delete(`${HANDOFF_PREFIX}${id}`));
  }

  window.FieldPrepSession = {
    save,
    load,
    clear,
    createHandoff,
    loadHandoff,
    deleteHandoff
  };
})();
