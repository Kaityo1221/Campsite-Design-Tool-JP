(() => {
  'use strict';

  const selectionSection = document.querySelector('.field-mode-selection');
  if (!selectionSection) return;

  const TARGET_BYTES = 280 * 1024;
  const INITIAL_MAX_EDGE = 1600;
  const MIN_MAX_EDGE = 960;
  const INITIAL_QUALITY = 0.82;
  const MIN_QUALITY = 0.46;

  const style = document.createElement('style');
  style.textContent = `
    .field-poi-meta{margin-top:12px;padding-top:12px;border-top:1px dashed #cbbd9f;display:none}
    .field-poi-meta.active{display:block}
    .field-poi-meta label{display:block;font-size:12px;font-weight:900;color:#4d402f;margin-bottom:6px}
    .field-poi-note{width:100%;min-height:72px;box-sizing:border-box;border:1px solid #c9b993;border-radius:12px;padding:10px;font:inherit;font-size:13px;background:#fffdf7;color:#332b20;resize:vertical}
    .field-poi-photo-row{display:flex;gap:8px;align-items:center;margin-top:10px}
    .field-poi-photo-button{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:38px;padding:0 12px;border:1px solid #9b742b;border-radius:12px;background:#fff8e6;color:#49391e;font-weight:900;font-size:12px;cursor:pointer}
    .field-poi-photo-button input{display:none}
    .field-poi-photo-name{font-size:11px;color:#746957;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
    .field-poi-photo-remove{border:0;background:transparent;color:#a24b3d;font-size:11px;font-weight:800;padding:6px;display:none}
    .field-poi-photo-remove.active{display:block}
    .field-poi-photo-preview{margin-top:8px;max-width:150px;max-height:110px;border-radius:10px;border:1px solid #d6c7a8;display:none;object-fit:cover}
    .field-poi-photo-preview.active{display:block}
    .field-poi-meta-note{margin-top:6px;font-size:10px;color:#807563}
  `;
  document.head.appendChild(style);

  const box = document.createElement('div');
  box.className = 'field-poi-meta';
  box.innerHTML = `
    <label for="fieldPoiMemo">📝 現地メモ</label>
    <textarea id="fieldPoiMemo" class="field-poi-note" placeholder="例：入口脇の案内板。木の影で少し見えづらい。"></textarea>
    <div class="field-poi-photo-row">
      <label class="field-poi-photo-button">📷 写真を追加
        <input id="fieldPoiPhoto" type="file" accept="image/*" capture="environment">
      </label>
      <span id="fieldPoiPhotoName" class="field-poi-photo-name">写真なし</span>
      <button id="fieldPoiPhotoRemove" class="field-poi-photo-remove" type="button">削除</button>
    </div>
    <img id="fieldPoiPhotoPreview" class="field-poi-photo-preview" alt="選択した現地写真のプレビュー">
    <div class="field-poi-meta-note">写真は約280KBを目安に自動圧縮してKMZへ保存します。元写真は端末側に残ります。</div>
  `;

  const saveRow = selectionSection.querySelector('.field-save-row');
  if (saveRow) selectionSection.insertBefore(box, saveRow);
  else selectionSection.appendChild(box);

  const memo = document.getElementById('fieldPoiMemo');
  const photoInput = document.getElementById('fieldPoiPhoto');
  const photoName = document.getElementById('fieldPoiPhotoName');
  const photoRemove = document.getElementById('fieldPoiPhotoRemove');
  const photoPreview = document.getElementById('fieldPoiPhotoPreview');
  let previewUrl = '';

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return '';
    if (bytes < 1024) return `${bytes}B`;
    return `${(bytes / 1024).toFixed(bytes >= 1024 * 1024 ? 0 : 0)}KB`;
  }

  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    photoPreview.removeAttribute('src');
    photoPreview.classList.remove('active');
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('写真を読み込めませんでした。'));
      };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('写真を圧縮できませんでした。'));
      }, 'image/jpeg', quality);
    });
  }

  async function compressPhoto(file) {
    const img = await loadImage(file);
    const originalWidth = img.naturalWidth || img.width;
    const originalHeight = img.naturalHeight || img.height;
    if (!originalWidth || !originalHeight) throw new Error('写真サイズを取得できませんでした。');

    let maxEdge = Math.min(INITIAL_MAX_EDGE, Math.max(originalWidth, originalHeight));
    let bestBlob = null;
    let bestWidth = originalWidth;
    let bestHeight = originalHeight;

    for (let resizeTry = 0; resizeTry < 5; resizeTry += 1) {
      const scale = Math.min(1, maxEdge / Math.max(originalWidth, originalHeight));
      const width = Math.max(1, Math.round(originalWidth * scale));
      const height = Math.max(1, Math.round(originalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('写真圧縮を開始できませんでした。');
      ctx.drawImage(img, 0, 0, width, height);

      for (let quality = INITIAL_QUALITY; quality >= MIN_QUALITY - 0.001; quality -= 0.06) {
        const blob = await canvasToBlob(canvas, Math.max(MIN_QUALITY, quality));
        if (!bestBlob || blob.size < bestBlob.size) {
          bestBlob = blob;
          bestWidth = width;
          bestHeight = height;
        }
        if (blob.size <= TARGET_BYTES) {
          return { blob, width, height, originalBytes: file.size, targetBytes: TARGET_BYTES };
        }
      }

      if (maxEdge <= MIN_MAX_EDGE) break;
      maxEdge = Math.max(MIN_MAX_EDGE, Math.round(maxEdge * 0.84));
    }

    if (!bestBlob) throw new Error('写真を圧縮できませんでした。');
    return { blob: bestBlob, width: bestWidth, height: bestHeight, originalBytes: file.size, targetBytes: TARGET_BYTES };
  }

  function renderMeta() {
    if (!selectedPoi || !selectedPoi.added) {
      box.classList.remove('active');
      memo.value = '';
      photoName.textContent = '写真なし';
      photoRemove.classList.remove('active');
      clearPreview();
      return;
    }

    box.classList.add('active');
    memo.value = selectedPoi.fieldMemo || '';
    clearPreview();

    if (selectedPoi.fieldPhoto?.blob) {
      const size = selectedPoi.fieldPhoto.blob.size;
      photoName.textContent = `${selectedPoi.fieldPhoto.name || '現地写真'} / ${formatBytes(size)}`;
      photoRemove.classList.add('active');
      previewUrl = URL.createObjectURL(selectedPoi.fieldPhoto.blob);
      photoPreview.src = previewUrl;
      photoPreview.classList.add('active');
    } else {
      photoName.textContent = '写真なし';
      photoRemove.classList.remove('active');
    }
  }

  function applyIntuitiveLabels() {
    if (newPoiButton) newPoiButton.textContent = '＋ ここに追加';
    if (scanButton) {
      scanButton.setAttribute('aria-label', '現在地を再取得');
      const scanText = scanButton.querySelector('span:last-child');
      if (scanText) scanText.textContent = '現在地';
    }
    if (fileStatus && !fileLoaded) fileStatus.textContent = 'KMZ / KML を選ぶと、すぐ現地確認を始められます。';
    if (!selectedPoi) {
      selectionTitle.textContent = '近くの候補を選びます';
      selectionDetail.textContent = 'KMZを開くと、現在地に近い追加予定POIを自動で選びます。';
      relocateButton.textContent = '📍 ここに置く';
      fineTuneButton.textContent = '地図で微調整';
    }
  }

  function nearestAddedPoi() {
    if (!currentPosition || !poiRecords?.length) return null;
    let nearest = null;
    for (const record of poiRecords) {
      if (!record.added) continue;
      const distance = meters(currentPosition, record.latlng);
      if (!nearest || distance < nearest.distance) nearest = { record, distance };
    }
    return nearest;
  }

  function autoSelectNearestPoi() {
    if (!fileLoaded || !currentPosition || selectedPoi) return;
    const nearest = nearestAddedPoi();
    if (!nearest) return;
    selectAddedPoi(nearest.record);
    selectionTitle.textContent = `近くの候補：${nearest.record.name}`;
    selectionDetail.textContent = `現在地から ${nearest.distance.toFixed(1)}m。ここなら「ここに置く」をタップ。`;
    relocateButton.textContent = '📍 ここに置く';
    fineTuneButton.textContent = '地図で微調整';
  }

  const originalSelectAddedPoi = selectAddedPoi;
  selectAddedPoi = function patchedSelectAddedPoi(record) {
    originalSelectAddedPoi(record);
    relocateButton.textContent = '📍 ここに置く';
    fineTuneButton.textContent = '地図で微調整';
    renderMeta();
  };

  const originalResetPoiSelection = resetPoiSelection;
  resetPoiSelection = function patchedResetPoiSelection() {
    originalResetPoiSelection();
    relocateButton.textContent = '📍 ここに置く';
    fineTuneButton.textContent = '地図で微調整';
    selectionTitle.textContent = '近くの候補を選びます';
    selectionDetail.textContent = '黄色いPOIをタップするか、現在地の近くなら自動で選びます。';
    renderMeta();
  };

  changedRecords = function changedRecordsWithFieldData() {
    return poiRecords.filter(record => {
      if (!record.added) return false;
      const moved = record.isNew || meters(record.originalLatlng, record.latlng) > .05;
      return moved || !!record.fieldMemoDirty || !!record.fieldPhotoDirty;
    });
  };

  memo.addEventListener('input', () => {
    if (!selectedPoi?.added) return;
    selectedPoi.fieldMemo = memo.value;
    selectedPoi.fieldMemoDirty = true;
    updateSaveButton();
  });

  photoInput.addEventListener('change', async () => {
    if (!selectedPoi?.added) return;
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;

    const targetRecord = selectedPoi;
    photoInput.disabled = true;
    photoName.textContent = '圧縮中…';

    try {
      const compressed = await compressPhoto(file);
      targetRecord.fieldPhoto = {
        name: `${(file.name || `photo_${Date.now()}`).replace(/\.[^.]+$/, '')}.jpg`,
        type: 'image/jpeg',
        blob: compressed.blob,
        originalBytes: compressed.originalBytes,
        width: compressed.width,
        height: compressed.height
      };
      targetRecord.fieldPhotoDirty = true;
      updateSaveButton();
      if (selectedPoi === targetRecord) renderMeta();
    } catch (error) {
      console.error(error);
      if (selectedPoi === targetRecord) photoName.textContent = `⚠ ${error.message || '写真を圧縮できませんでした。'}`;
    } finally {
      photoInput.value = '';
      photoInput.disabled = false;
    }
  });

  photoRemove.addEventListener('click', () => {
    if (!selectedPoi?.added) return;
    selectedPoi.fieldPhoto = null;
    selectedPoi.fieldPhotoDirty = true;
    renderMeta();
    updateSaveButton();
  });

  const originalRenderKml = renderKml;
  renderKml = function patchedRenderKml(kmlText) {
    originalRenderKml(kmlText);
    poiRecords.forEach(record => {
      record.fieldMemo = record.fieldMemo || '';
      record.fieldMemoDirty = false;
      record.fieldPhoto = null;
      record.fieldPhotoDirty = false;
    });
    renderMeta();
    setTimeout(autoSelectNearestPoi, 0);
  };

  const originalSetCurrentPosition = setCurrentPosition;
  setCurrentPosition = function patchedSetCurrentPosition(lat, lng, accuracy, recenter = false) {
    originalSetCurrentPosition(lat, lng, accuracy, recenter);
    setTimeout(autoSelectNearestPoi, 0);
  };

  applyIntuitiveLabels();
  renderMeta();
})();