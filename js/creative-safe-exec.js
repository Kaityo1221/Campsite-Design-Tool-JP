/* Safely execute the private Creative runtime without reparsing its outer HTML shell. */
(() => {
  'use strict';

  const doc = document;
  const nativeOpen = doc.open.bind(doc);
  const nativeWrite = doc.write.bind(doc);
  const nativeClose = doc.close.bind(doc);
  let armed = true;

  const restore = () => {
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

    const start = text.indexOf('<script>');
    const end = text.lastIndexOf('</script>');
    if (start < 0 || end <= start) {
      restore();
      return nativeWrite(text);
    }

    armed = false;
    restore();

    const runtimeCode = text.slice(start + '<script>'.length, end);
    try {
      Function(runtimeCode)();
    } catch (error) {
      console.error('Creative runtime execution failed', error);
      doc.body.textContent = 'Creative Modeの実行に失敗しました。';
    }
  };

  doc.close = function (...args) {
    if (armed) return;
    return nativeClose(...args);
  };
})();
