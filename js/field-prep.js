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

  function renderSelectedFiles() {
    fileList.replaceChildren();

    state.selectedFiles.forEach(file => {
      const item = document.createElement('div');
      item.className = 'field-prep-file-item';

      const name = document.createElement('strong');
      name.textContent = file.name;

      const size = document.createElement('span');
      size.textContent = formatBytes(file.size);

      item.append(name, size);
      fileList.appendChild(item);
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

  function clearSelection() {
    fileInput.value = '';
    state.selectedFiles = [];
    fileList.replaceChildren();
    resetResults();
    analyzeButton.disabled = true;
    clearButton.disabled = true;
    setStatus('CSVを選択してください。');
  }

  function normalizePoiType(point) {
    const source = [point?.type, point?.gameStatus, point?.name]
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .join(' ');

    if (typeof window.classifyType === 'function') {
      const classified = String(window.classifyType(source, point?.name || '', point?.layer || '') || '').toLowerCase();
      if (classified === 'gym') return 'gym';
      if (classified === 'power' || classified === 'power_spot') return 'power';
      if (classified === 'pokestop') return 'pokestop';
    }

    const lower = source.toLowerCase();
    if (/power\s*spot|powerspot|power_spot|パワースポット|パワスポ/.test(lower)) return 'power';
    if (/gym|ジム/.test(lower)) return 'gym';
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
          : `「${item.name}」から有効な緯度・経度を持つPOIを読み取れませんでした。`)
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
      setStatus('CSV解析機能を読み込めませんでした。ページを再読み込みしてください。', true);
      return;
    }

    analyzeButton.disabled = true;
    clearButton.disabled = true;
    resetResults();
    setStatus(`${state.selectedFiles.length}個のCSVを読み込んでいます…`);

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

    if (combined.length === 0) {
      setStatus('有効なPOIを読み取れませんでした。CSVの列名と緯度・経度を確認してください。', true);
    } else {
      setStatus(`準備完了：${state.uniquePoints.length}件のPOIを整理しました。`);
    }

    analyzeButton.disabled = false;
    clearButton.disabled = false;
  }

  fileInput.addEventListener('change', () => {
    resetResults();
    state.selectedFiles = Array.from(fileInput.files || [])
      .filter(file => file.name.toLowerCase().endsWith('.csv'));

    renderSelectedFiles();

    const hasFiles = state.selectedFiles.length > 0;
    analyzeButton.disabled = !hasFiles;
    clearButton.disabled = !hasFiles;

    if (hasFiles) {
      setStatus(`${state.selectedFiles.length}個のCSVを選択しました。`);
    } else {
      setStatus('CSVを選択してください。');
    }
  });

  analyzeButton.addEventListener('click', analyzeFiles);
  clearButton.addEventListener('click', clearSelection);

  window.FieldPrep = {
    getState() {
      return {
        selectedFileNames: state.selectedFiles.map(file => file.name),
        rawPoints: state.rawPoints.map(point => ({ ...point })),
        uniquePoints: state.uniquePoints.map(point => ({ ...point })),
        duplicateCount: state.duplicateCount,
        fileResults: state.fileResults.map(item => ({ ...item }))
      };
    },
    clear: clearSelection
  };
})();
