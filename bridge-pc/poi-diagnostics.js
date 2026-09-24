(() => {
  'use strict';

  const VERSION = '1.0.0';
  const MAX_ITEMS = 20;
  const LABELS = Object.freeze({
    MISSING_GUID: 'GUID欠損',
    INVALID_COORDINATES: '座標不正',
    INVALID_OBJECT: '入力形式不正',
    AMBIGUOUS_GAME_OBJECT: '分類不能',
    DUPLICATE_GUID: 'GUID重複'
  });

  function text(value) {
    return String(value ?? '').trim();
  }

  function number(value) {
    const result = Number(value);
    return Number.isFinite(result) && result >= 0 ? result : 0;
  }

  function emptyCounts() {
    return {
      missingGuid: 0,
      invalidCoordinates: 0,
      invalidObject: 0,
      unknown: 0,
      duplicateGuid: 0,
      total: 0
    };
  }

  function parserBucket(reason) {
    if (reason === 'MISSING_GUID') return 'missingGuid';
    if (reason === 'INVALID_COORDINATES') return 'invalidCoordinates';
    if (reason === 'INVALID_OBJECT') return 'invalidObject';
    return 'invalidObject';
  }

  function labelFor(code) {
    return LABELS[code] || '要確認';
  }

  function build(parsedResult, classifiedResult) {
    const parsed = parsedResult && typeof parsedResult === 'object' ? parsedResult : {};
    const classified = classifiedResult && typeof classifiedResult === 'object' ? classifiedResult : {};
    const counts = emptyCounts();
    const items = [];

    const parserDiagnostics = Array.isArray(parsed.diagnostics) ? parsed.diagnostics : [];
    for (const diagnostic of parserDiagnostics) {
      const code = text(diagnostic?.reason) || 'INVALID_OBJECT';
      const bucket = parserBucket(code);
      counts[bucket] += 1;
      if (items.length < MAX_ITEMS) {
        items.push({
          stage: 'parser',
          code,
          label: labelFor(code),
          guid: text(diagnostic?.guid),
          title: ''
        });
      }
    }

    const byGuid = new Map();
    for (const poi of Array.isArray(classified.pois) ? classified.pois : []) {
      const guid = text(poi?.guid);
      if (guid) byGuid.set(guid, poi);
    }

    const classificationDiagnostics = Array.isArray(classified.classificationDiagnostics)
      ? classified.classificationDiagnostics
      : [];
    for (const diagnostic of classificationDiagnostics) {
      const code = text(diagnostic?.reason) || 'AMBIGUOUS_GAME_OBJECT';
      const guid = text(diagnostic?.guid);
      const poi = byGuid.get(guid);
      counts.unknown += 1;
      if (items.length < MAX_ITEMS) {
        items.push({
          stage: 'classifier',
          code,
          label: labelFor(code),
          guid,
          title: text(poi?.title)
        });
      }
    }

    counts.duplicateGuid = number(parsed.duplicateCount);
    if (counts.duplicateGuid > 0 && items.length < MAX_ITEMS) {
      items.push({
        stage: 'parser',
        code: 'DUPLICATE_GUID',
        label: labelFor('DUPLICATE_GUID'),
        guid: '',
        title: counts.duplicateGuid + '件'
      });
    }

    counts.total =
      counts.missingGuid +
      counts.invalidCoordinates +
      counts.invalidObject +
      counts.unknown +
      counts.duplicateGuid;

    const stats = classified.diagnostics && typeof classified.diagnostics === 'object'
      ? classified.diagnostics
      : {};

    return {
      version: VERSION,
      status: counts.total > 0 ? 'warning' : 'ok',
      hasIssues: counts.total > 0,
      issueCount: counts.total,
      counts,
      items,
      truncated: parserDiagnostics.length + classificationDiagnostics.length + (counts.duplicateGuid > 0 ? 1 : 0) > items.length,
      sourceCount: number(parsed.sourceCount),
      parsedCount: number(parsed.parsedCount),
      exportCount: number(stats.exportCount),
      notInGameCount: number(stats.notInGameCount)
    };
  }

  function summary(report) {
    if (!report?.hasIssues) return '診断上の問題はありません';
    const parts = [];
    const counts = report.counts || {};
    if (counts.missingGuid) parts.push('GUID欠損 ' + counts.missingGuid);
    if (counts.invalidCoordinates) parts.push('座標不正 ' + counts.invalidCoordinates);
    if (counts.invalidObject) parts.push('入力不正 ' + counts.invalidObject);
    if (counts.unknown) parts.push('分類不能 ' + counts.unknown);
    if (counts.duplicateGuid) parts.push('重複 ' + counts.duplicateGuid);
    return parts.join(' / ');
  }

  window.CampsiteBridgePoiDiagnostics = Object.freeze({
    version: VERSION,
    labels: LABELS,
    maxItems: MAX_ITEMS,
    build,
    summary
  });
})();
