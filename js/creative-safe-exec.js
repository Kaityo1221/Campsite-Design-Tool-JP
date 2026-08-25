/* Safely launch the private Creative runtime without reparsing its outer HTML shell. */
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

  const fail = (message, error) => {
    if (error) console.error(message, error);
    restoreDocument();
    window.fetch = nativeFetch;
    doc.body.textContent = message;
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

    // creative-loader が一時的に埋め込んだ private base HTML を回収する。
    const embeddedBase = text.match(/let html=("(?:\\.|[^"\\])*");/s);
    if (!embeddedBase) {
      fail('Creative Modeの基盤データを復元できませんでした。');
      return;
    }

    let baseHtml = '';
    try {
      baseHtml = JSON.parse(embeddedBase[1]);
    } catch (error) {
      fail('Creative Modeの基盤データを復元できませんでした。', error);
      return;
    }

    // Runtime 本体は元の fetch 方式へ戻す。
    const originalLoader = "const res=await fetch('./base-v7.html',{cache:'no-store'});if(!res.ok){document.body.textContent='Creative Modeの読み込みに失敗しました。';return}\n  let html=await res.text();";
    const cleanedRuntime = text.replace(embeddedBase[0], originalLoader);

    // private base-v7.html は一度だけメモリから返す。
    let served = false;
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (!served && (url === './base-v7.html' || /\/creative\/base-v7\.html(?:$|[?#])/.test(url))) {
        served = true;
        queueMicrotask(() => { window.fetch = nativeFetch; });
        return Promise.resolve(new Response(baseHtml, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store'
          }
        }));
      }
      return nativeFetch(input, init);
    };

    // 外側HTMLを document.write すると、内部文字列中の </script> をHTMLパーサーが誤認する。
    // そのため script 本文だけを取り出して JavaScript として直接実行する。
    const start = cleanedRuntime.indexOf('<script>');
    const end = cleanedRuntime.lastIndexOf('</script>');
    if (start < 0 || end <= start) {
      fail('Creative Modeの実行データを解析できませんでした。');
      return;
    }

    const runtimeCode = cleanedRuntime.slice(start + '<script>'.length, end);

    armed = false;
    restoreDocument();

    try {
      Function(runtimeCode)();
    } catch (error) {
      fail('Creative Modeの実行に失敗しました: ' + (error?.message || 'unknown error'), error);
    }
  };

  doc.close = function (...args) {
    if (armed) return;
    return nativeClose(...args);
  };
})();
