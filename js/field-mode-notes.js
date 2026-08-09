(() => {
  'use strict';

  const selectionSection = document.querySelector('.field-mode-selection');
  if (!selectionSection) return;

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
    <div class="field-poi-meta-note">写真とメモはサーバーへ送信せず、KMZ保存時に端末へ持ち帰ります。</div>
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

  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    photoPreview.removeAttribute('src');
    photoPreview.classList.remove('active');
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
      photoName.textContent = selectedPoi.fieldPhoto.name || '現地写真';
      photoRemove.classList.add('active');
      previewUrl = URL.createObjectURL(selectedPoi.fieldPhoto.blob);
      photoPreview.src = previewUrl;
      photoPreview.classList.add('active');
    } else {
      photoName.textContent = '写真なし';
      photoRemove.classList.remove('active');
    }
  }

  const originalSelectAddedPoi = selectAddedPoi;
  selectAddedPoi = function patchedSelectAddedPoi(record) {
    originalSelectAddedPoi(record);
    renderMeta();
  };

  const originalResetPoiSelection = resetPoiSelection;
  resetPoiSelection = function patchedResetPoiSelection() {
    originalResetPoiSelection();
    renderMeta();
  };

  const baseChangedRecords = changedRecords;
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

  photoInput.addEventListener('change', () => {
    if (!selectedPoi?.added) return;
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    selectedPoi.fieldPhoto = {
      name: file.name || `photo_${Date.now()}.jpg`,
      type: file.type || 'image/jpeg',
      blob: file
    };
    selectedPoi.fieldPhotoDirty = true;
    photoInput.value = '';
    renderMeta();
    updateSaveButton();
  });

  photoRemove.addEventListener('click', () => {
    if (!selectedPoi?.added) return;
    selectedPoi.fieldPhoto = null;
    selectedPoi.fieldPhotoDirty = true;
    renderMeta();
    updateSaveButton();
  });

  // 既存POI読込時にフィールド用属性を初期化する。
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
  };

  renderMeta();
})();
