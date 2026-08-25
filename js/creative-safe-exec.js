/* Safely launch the private Creative runtime without embedding base HTML inside its script. */
(() => {
  'use strict';

  const doc = document;
  const nativeOpen = doc.open.bind(doc);
  const nativeWrite = doc.write.bind(doc);
  const nativeClose = doc.close.bind(doc);
  const nativeFetch = window.fetch.bind(window);
  let armed = true;

  const restoreDocument = () => {
    doc.open = nativeOpen;
    doc.write = nativeWrite;
    doc.close = nativeClose;
  };

  doc.open = function (...args) {
    if (armed) return doc;
    return nativeOpen(...args);
  };

  doc.write = function (...args) {
    const text = args.join('');
    const isCreativeRuntime = armed &&
      typeof text === 'string' &&
      text.includes('(async()=>{') &&
      text.includes('let html=') &&
      text.includes('CREATIVE MODE');

    if (!isCreativeRuntime) return nativeWrite(...args);

    // creative-loader は base-v7.html を JSON 文字列として一時的に埋め込んでいる。
    // その文字列だけ回収して、Runtime 本体は元の fetch 方式へ戻す。
    const embeddedBase = text.match(/let html=("(?:\\.|[^"\\])*");/s);
    if (!embeddedBase) {
      restoreDocument();
      nativeOpen();
      nativeWrite(text);
      return;
    }

    let baseHtml = '';
    try {
      baseHtml = JSON.parse(embeddedBase[1]);
    } catch (error) {
      console.error('Creative base extraction failed', error);
      restoreDocument();
      doc.body.textContent = 'Creative Modeの基盤データを復元できませんでした。';
      return;
    }

    const originalLoader = "const res=await fetch('./base-v7.html',{cache:'no-store'});if(!res.ok){document.body.textContent='Creative Modeの読み込みに失敗しました。';return}\n  let html=await res.text();";
    const cleanedRuntime = text.replace(embeddedBase[0], originalLoader);

    let served = false;
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (!served && (url === './base-v7.html' || /\/creative\/base-v7\.html(?:$|[?#])/.test(url))) {
        served = true;
        // Runtime が private base を受け取った後は通常の fetch に戻す。
        queueMicrotask(() => { window.fetch = nativeFetch; });
        return Promise.resolve(new Response(baseHtml, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
        }));
      }
      return nativeFetch(input, init);
    };

    armed = false;
    restoreDocument();

    // ここで初めて実ドキュメントを書き換える。
    // base HTML は Runtime 内へ埋め込まれていないため </script> 問題が起きない。
    nativeOpen();
    nativeWrite(cleanedRuntime);
  };

  doc.close = function (...args) {
    if (armed) return;
    return nativeClose(...args);
  };
})();
