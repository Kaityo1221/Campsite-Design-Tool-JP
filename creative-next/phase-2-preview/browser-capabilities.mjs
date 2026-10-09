/* Creative Next non-production browser capability probe.
 * Read-only with respect to all storage: never probes, migrates, or touches
 * legacy keys, and does not claim that native writes have been tested.
 */
export function probePreviewEnvironment(env = globalThis) {
  const warnings=[];
  let storage=null;
  try {
    const proposed=env.localStorage; // Getter can throw SecurityError in Safari/private contexts.
    if(proposed && typeof proposed.getItem==='function' && typeof proposed.setItem==='function') storage=proposed;
    else warnings.push('ブラウザ内保存を利用できません。編集内容はこの画面を閉じると失われます。');
  } catch {
    warnings.push('ブラウザの保存領域へのアクセスが禁止されています。保存・再開は利用できません。');
  }
  const cryptoReady=!!(env.crypto?.subtle && typeof env.crypto.subtle.digest==='function');
  if(!cryptoReady) warnings.push('安全な検査に必要なSHA-256が利用できません。HTTPSまたはlocalhostで開いてください。');
  const kmlReady=typeof env.DOMParser==='function' && typeof env.XMLSerializer==='function';
  if(!kmlReady) warnings.push('KMLを解析する標準ブラウザ機能が不足しています。');
  const zipReady=!!(env.JSZip?.loadAsync && typeof env.JSZip.loadAsync==='function');
  if(!zipReady) warnings.push('KMZ展開ライブラリが読み込めませんでした。');
  if(!env.crypto?.randomUUID) warnings.push('一意ID作成機能がありません。新規活動範囲の追加にはHTTPSまたはlocalhostが必要です。');
  return Object.freeze({
    storage,
    cryptoReady,
    canInspect:cryptoReady && kmlReady && zipReady,
    canSave:!!storage && cryptoReady,
    canExport:cryptoReady && zipReady && kmlReady,
    hasUUID:typeof env.crypto?.randomUUID==='function',
    warnings:Object.freeze(warnings)
  });
}
