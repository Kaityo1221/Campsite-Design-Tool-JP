(() => {
  'use strict';

  const fileInput = document.getElementById('fieldPrepFiles');
  const analyzeButton = document.getElementById('fieldPrepAnalyzeButton');
  const clearButton = document.getElementById('fieldPrepClearButton');
  const status = document.getElementById('fieldPrepStatus');
  const fileList = document.getElementById('fieldPrepFileList');
  const results = document.getElementById('fieldPrepResults');
  const warnings = document.getElementById('fieldPrepWarnings');

  const output = {
    csvCount: document.getElementById('fieldPrepCsvCount'),
    rawCount: document.getElementById('fieldPrepRawCount'),
    duplicateCount: document.getElementById('fieldPrepDuplicateCount'),
    uniqueCount: document.getElementById('fieldPrepUniqueCount'),
    pokestopCount: document.getElementById('fieldPrepPokestopCount'),
    gymCount: document.getElementById('fieldPrepGymCount'),
    powerCount: document.getElementById('fieldPrepPowerCount')
  };

  const state = {
    selectedFiles: [],
    rawPoints: [],
    uniquePoints: [],
    duplicateCount: 0,
    fileResults: []
  };

  function emitChange(detail = {}) {
    window.dispatchEvent(new CustomEvent('fieldprep:datachanged', {
      detail: { ...detail, state: getState() }
    }));
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return '0 KB';
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  function splitFileNameForDisplay(fileName) {
    const fullName = String(fileName || '');
    const extensionMatch = fullName.match(/(\.[^.\s]+)$/);
    const extension = extensionMatch?.[1] || '';
    const stem = extension ? fullName.slice(0, -extension.length) : fullName;

    // Wayfarer Map exports commonly end in a distinguishing number such as
    // "nearby-wayspots-2026-08-09 8.csv". Keep that number visible at all times.
    const numberedTail = stem.match(/^(.*?)([\s_-]+\d+)$/);
    if (numberedTail) {
      return {
        prefix: numberedTail[1].replace(/[\s_-]+$/, ''),
        tail: `${numberedTail[2].trim()}${extension}`
      };
    }

    // For other long names, reserve the final part instead of hiding it with ellipsis.
    const keepLength = Math.min(16, stem.length);
    return {
      prefix: stem.slice(0, Math.max(0, stem.length - keepLength)),
      tail: `${stem.slice(-keepLength)}${extension}`
    };
  }

  function makeRemoveButton(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'field-prep-file-remove';
    button.textContent = '解除';
    button.setAttribute('aria-label', `${label}を解除`);
    button.addEventListener('click', onClick);
    return button;
  }

  function makeFileItem(nameText, metaText, onRemove) {
    const item = document.createElement('div');
    item.className = 'field-prep-file-item';
    item.title = nameText;

    const copy = document.createElement('div');
    copy.className = 'field-prep-file-copy';

    const name = document.createElement('div');
    name.className = 'field-prep-file-name';
    name.setAttribute('aria-label', nameText);

    const { prefix, tail } = splitFileNameForDisplay(nameText);
    const prefixNode = document.createElement('span');
    prefixNode.className = 'field-prep-file-prefix';
    prefixNode.textContent = prefix || '';

    const tailNode = document.createElement('strong');
    tailNode.className = 'field-prep-file-tail';
    tailNode.textContent = tail;

    name.append(prefixNode, tailNode);

    const meta = document.createElement('span');
    meta.textContent = metaText;

    copy.append(name, meta);
    item.append(copy, makeRemoveButton(nameText, onRemove));
    return item;
  }

  async function removeSelectedFile(index) {
    const hadPreparedResult = !results.hidden;
    state.selectedFiles.splice(index, 1);
    resetResults();
    renderSelectedFiles();

    const hasFiles = state.selectedFiles.length > 0;
    analyzeButton.disabled = !hasFiles;
    if (clearButton) clearButton.disabled = !hasFiles;

    if (!hasFiles) {
      fileInput.value = '';
      setStatus('調査ファイルを選んでください。');
      emitChange({ cleared: true });
      return;
    }

    if (hadPreparedResult) {
      await analyzeFiles();
      return;
    }

    setStatus(`${state.selectedFiles.length}個の調査ファイルを選びました。`);
    emitChange({ selectionChanged: true });
  }

  function removeRestoredFile(sourceName) {
    state.rawPoints = state.rawPoints.filter(point => point.sourceName !== sourceName);
    state.fileResults = state.fileResults.filter(item => item.name !== sourceName);

    if (state.rawPoints.length === 0) {
      state.selectedFiles = [];
      fileInput.value = '';
      fileList.replaceChildren();
      resetResults();
      analyzeButton.disabled = true;
      if (clearButton) clearButton.disabled = true;
      setStatus('調査ファイルを選んでください。');
      emitChange({ cleared: true });
      return;
    }

    const deduplicated = window.removeDuplicate(state.rawPoints);
    state.uniquePoints = deduplicated.uniquePoints;
    state.duplicateCount = deduplicated.duplicateCount;
    renderSelectedFiles();
    renderResults();
    setStatus(`準備データを更新：${state.uniquePoints.length}件のPOIが残っています。`);
    emitChange({ restoredFileRemoved: sourceName });
  }

  function renderSelectedFiles() {
    fileList.replaceChildren();

    if (state.selectedFiles.length > 0) {
      state.selectedFiles.forEach((file, index) => {
        fileList.appendChild(makeFileItem(
          file.name,
          formatBytes(file.size),
          () => removeSelectedFile(index)
        ));
      });
      return;
    }

    state.fileResults.forEach(itemResult => {
      fileList.appendChild(makeFileItem(
        itemResult.name,
        `${itemResult.count || 0}件 / 前回`,
        () => removeRestoredFile(itemResult.name)
      ));
    });
  }

  function resetResults() {
    state.rawPoints = [];
    state.uniquePoints = [];
    state.duplicateCount = 0;
    state.fileResults = [];
    results.hidden = true;
    warnings.hidden = true;
    warnings.textContent = '';
  }

  async function clearSelection() {
    fileInput.value = '';
    state.selectedFiles = [];
    fileList.replaceChildren();
    resetResults();
    analyzeButton.disabled = true;
    if (clearButton) clearButton.disabled = true;
    setStatus('調査ファイルを選んでください。');
    emitChange({ cleared: true });
  }

  function normalizePoiType(point) {
    const source = [point?.type, point?.gameStatus]
      .map(value => String(value || '').trim().toLowerCase())
      .filter(Boolean)
      .join(' ');

    if (/power\s*spot|powerspot|power_spot|\bpower\b|パワースポット|パワスポ/.test(source)) return 'power';
    if (/\bgym\b|ジム/.test(source)) return 'gym';
    if (/pokestop|poke\s*stop|ポケストップ|ポケスト/.test(source)) return 'pokestop';

    if (typeof window.classifyType === 'function') {
      const classified = String(window.classifyType(source, point?.name || '', point?.layer || '') || '').toLowerCase();
      if (classified === 'gym') return 'gym';
      if (classified === 'power' || classified === 'power_spot') return 'power';
      if (classified === 'pokestop') return 'pokestop';
    }

    return 'pokestop';
  }

  function renderResults() {
    const counts = { pokestop: 0, gym: 0, power: 0 };

    state.uniquePoints.forEach(point => {
      counts[normalizePoiType(point)] += 1;
    });

    output.csvCount.textContent = String(state.fileResults.filter(item => !item.error).length);
    output.rawCount.textContent = String(state.rawPoints.length);
    output.duplicateCount.textContent = String(state.duplicateCount);
    output.uniqueCount.textContent = String(state.uniquePoints.length);
    output.pokestopCount.textContent = String(counts.pokestop);
    output.gymCount.textContent = String(counts.gym);
    output.powerCount.textContent = String(counts.power);

    const issues = state.fileResults.filter(item => item.error || item.count === 0);
    if (issues.length > 0) {
      warnings.hidden = false;
      warnings.textContent = issues
        .map(item => item.error
          ? `「${item.name}」は読み込めませんでした。${item.error}`
          : `「${item.name}」から位置情報のあるPOIを読み取れませんでした。`)
        .join(' ');
    } else {
      warnings.hidden = true;
      warnings.textContent = '';
    }

    results.hidden = false;
  }

  async function analyzeFiles() {
    if (state.selectedFiles.length === 0) return;

    if (typeof window.parseCSV !== 'function' || typeof window.removeDuplicate !== 'function') {
      setStatus('調査ファイルの読み込み機能を準備できませんでした。ページを再読み込みしてください。', true);
      return;
    }

    analyzeButton.disabled = true;
    if (clearButton) clearButton.disabled = true;
    resetResults();
    setStatus(`${state.selectedFiles.length}個の調査ファイルを地図に読み込んでいます…`);

    const combined = [];
    const fileResults = [];

    for (const file of state.selectedFiles) {
      try {
        const text = await file.text();
        const points = window.parseCSV(text);
        points.forEach(point => {
          combined.push({ ...point, sourceName: file.name });
        });
        fileResults.push({ name: file.name, count: points.length, error: '' });
      } catch (error) {
        fileResults.push({
          name: file.name,
          count: 0,
          error: error instanceof Error ? error.message : '不明なエラー'
        });
      }
    }

    const deduplicated = window.removeDuplicate(combined);
    state.rawPoints = combined;
    state.uniquePoints = deduplicated.uniquePoints;
    state.duplicateCount = deduplicated.duplicateCount;
    state.fileResults = fileResults;

    renderResults();
    renderSelectedFiles();

    if (combined.length === 0) {
      setStatus('地点を読み取れませんでした。Wayfarer Mapから保存した調査ファイルか確認してください。', true);
    } else {
      setStatus(`準備完了：${state.uniquePoints.length}件のPOIを地図に読み込みました。`);
    }

    analyzeButton.disabled = false;
    if (clearButton) clearButton.disabled = false;
    emitChange({ source: 'csv' });
  }

  function getState() {
    return {
      selectedFileNames: state.selectedFiles.map(file => file.name),
      rawPoints: state.rawPoints.map(point => ({ ...point })),
      uniquePoints: state.uniquePoints.map(point => ({ ...point })),
      duplicateCount: state.duplicateCount,
      fileResults: state.fileResults.map(item => ({ ...item }))
    };
  }

  function restorePreparedData(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.uniquePoints) || snapshot.uniquePoints.length === 0) {
      return false;
    }

    state.selectedFiles = [];
    state.rawPoints = Array.isArray(snapshot.rawPoints)
      ? snapshot.rawPoints.map(point => ({ ...point }))
      : snapshot.uniquePoints.map(point => ({ ...point }));
    state.uniquePoints = snapshot.uniquePoints.map(point => ({ ...point }));
    state.duplicateCount = Number(snapshot.duplicateCount) || 0;
    state.fileResults = Array.isArray(snapshot.fileResults)
      ? snapshot.fileResults.map(item => ({ ...item }))
      : [];

    fileInput.value = '';
    renderSelectedFiles();
    renderResults();
    analyzeButton.disabled = true;
    if (clearButton) clearButton.disabled = false;
    setStatus(`前回の準備データ ${state.uniquePoints.length}件を復元しました。`);
    return true;
  }

  fileInput.addEventListener('change', () => {
    resetResults();
    state.selectedFiles = Array.from(fileInput.files || [])
      .filter(file => file.name.toLowerCase().endsWith('.csv'));

    renderSelectedFiles();

    const hasFiles = state.selectedFiles.length > 0;
    analyzeButton.disabled = !hasFiles;
    if (clearButton) clearButton.disabled = !hasFiles;

    if (hasFiles) {
      setStatus(`${state.selectedFiles.length}個の調査ファイルを選びました。`);
    } else {
      setStatus('調査ファイルを選んでください。');
    }
  });

  analyzeButton.addEventListener('click', analyzeFiles);
  clearButton?.addEventListener('click', clearSelection);

  window.FieldPrep = {
    getState,
    restorePreparedData,
    normalizePoiType,
    clear: clearSelection
  };
})();