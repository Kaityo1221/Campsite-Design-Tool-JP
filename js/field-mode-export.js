(() => {
  'use strict';

  const KML_NS = 'http://www.opengis.net/kml/2.2';
  let sourcePromise = Promise.resolve(null);

  function findKmlPath(zip) {
    const names = Object.keys(zip.files).filter(name => name.toLowerCase().endsWith('.kml') && !zip.files[name].dir);
    if (!names.length) throw new Error('KMZ内にKMLがありません。');
    return names.find(name => /(^|\/)doc\.kml$/i.test(name)) || names[0];
  }

  async function captureSource(file) {
    if (!file) return null;
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.kml')) return { file, zip: null, kmlPath: 'doc.kml', kmlText: await file.text() };
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const kmlPath = findKmlPath(zip);
    return { file, zip, kmlPath, kmlText: await zip.files[kmlPath].async('string') };
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    sourcePromise = captureSource(file).catch(error => {
      console.error('field export source capture failed', error);
      return null;
    });
  });

  function createElement(doc, name, text) {
    const el = doc.createElementNS(doc.documentElement.namespaceURI || KML_NS, name);
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function directName(node) {
    return Array.from(node.children || []).find(el => el.localName === 'name')?.textContent?.trim() || '';
  }

  function findFolderByName(doc, name) {
    return Array.from(doc.getElementsByTagNameNS('*', 'Folder')).find(folder => directName(folder) === name) || null;
  }

  function removeOldFieldCircleFolders(doc) {
    Array.from(doc.getElementsByTagNameNS('*', 'Folder')).forEach(folder => {
      const name = directName(folder);
      if (name === '現地モード_30m円' || name === '現地モード_40m円' || name === '現地モード_距離円') folder.remove();
    });
  }

  function destinationPoint(latDeg, lngDeg, distanceMeters, bearingDeg) {
    const radius = 6378137;
    const delta = distanceMeters / radius;
    const theta = bearingDeg * Math.PI / 180;
    const phi1 = latDeg * Math.PI / 180;
    const lambda1 = lngDeg * Math.PI / 180;
    const sinPhi2 = Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta);
    const phi2 = Math.asin(sinPhi2);
    const lambda2 = lambda1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));
    return [phi2 * 180 / Math.PI, lambda2 * 180 / Math.PI];
  }

  function circleCoordinateText(lat, lng, radiusMeters, steps = 72) {
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
      const [pLat, pLng] = destinationPoint(lat, lng, radiusMeters, 360 * i / steps);
      points.push(`${pLng.toFixed(8)},${pLat.toFixed(8)},0`);
    }
    return points.join(' ');
  }

  function folderStyleUrl(folder) {
    if (!folder) return '';
    const placemarks = Array.from(folder.children || []).filter(el => el.localName === 'Placemark');
    for (const pm of placemarks) {
      const styleUrl = Array.from(pm.children || []).find(el => el.localName === 'styleUrl');
      if (styleUrl?.textContent?.trim()) return styleUrl.textContent.trim();
    }
    return '';
  }

  function createCirclePlacemark(doc, record, radiusMeters, styleUrl) {
    const placemark = createElement(doc, 'Placemark');
    placemark.appendChild(createElement(doc, 'name', `${record.name}_${radiusMeters}m円`));
    if (styleUrl) placemark.appendChild(createElement(doc, 'styleUrl', styleUrl));
    const polygon = createElement(doc, 'Polygon');
    polygon.appendChild(createElement(doc, 'tessellate', '1'));
    polygon.appendChild(createElement(doc, 'altitudeMode', 'clampToGround'));
    const outer = createElement(doc, 'outerBoundaryIs');
    const ring = createElement(doc, 'LinearRing');
    ring.appendChild(createElement(doc, 'coordinates', circleCoordinateText(record.latlng[0], record.latlng[1], radiusMeters)));
    outer.appendChild(ring);
    polygon.appendChild(outer);
    placemark.appendChild(polygon);
    return placemark;
  }

  function ensureTargetFolder(doc, documentNode, name) {
    let folder = findFolderByName(doc, name);
    if (folder) return folder;
    folder = createElement(doc, 'Folder');
    folder.appendChild(createElement(doc, 'name', name));
    documentNode.appendChild(folder);
    return folder;
  }

  function appendGeneratedCirclesToExistingLayers(doc, documentNode, records) {
    const folder30 = ensureTargetFolder(doc, documentNode, '30m円（調整用）');
    const folder40 = ensureTargetFolder(doc, documentNode, '40m円（基本距離）');

    // 既存レイヤーの最初の円が使っているstyleUrlをそのまま流用する。
    // 添付KMZでは30m=#poly-C2185B-3000-71-nodesc、40m=#poly-000000-2000-77-nodesc。
    const style30 = folderStyleUrl(folder30) || '#poly-C2185B-3000-71-nodesc';
    const style40 = folderStyleUrl(folder40) || '#poly-000000-2000-77-nodesc';

    records.forEach(record => {
      folder30.appendChild(createCirclePlacemark(doc, record, 30, style30));
      folder40.appendChild(createCirclePlacemark(doc, record, 40, style40));
    });
  }

  function replaceMovedCoordinates(doc, changed) {
    const pointPlacemarks = Array.from(doc.getElementsByTagNameNS('*', 'Placemark')).filter(pm => !!pm.getElementsByTagNameNS('*', 'Point')[0]?.getElementsByTagNameNS('*', 'coordinates')[0]);
    changed.forEach(record => {
      const index = poiRecords.indexOf(record);
      const placemark = pointPlacemarks[index];
      if (!placemark) throw new Error(`POI「${record.name}」の元データを特定できませんでした。`);
      placemark.getElementsByTagNameNS('*', 'Point')[0].getElementsByTagNameNS('*', 'coordinates')[0].textContent = `${record.latlng[1]},${record.latlng[0]},0`;
    });
  }

  async function exportPreservedKmz() {
    const changed = changedRecords();
    if (!changed.length) return;
    const source = await sourcePromise;
    if (!source) throw new Error('元ファイルを再取得できませんでした。もう一度KMZを選択してください。');

    const doc = new DOMParser().parseFromString(source.kmlText, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('元KMLを解析できませんでした。');

    replaceMovedCoordinates(doc, changed);
    const documentNode = doc.getElementsByTagNameNS('*', 'Document')[0] || doc.documentElement;
    removeOldFieldCircleFolders(doc);

    const addedRecords = poiRecords.filter(record => record.added);
    appendGeneratedCirclesToExistingLayers(doc, documentNode, addedRecords);

    const serialized = new XMLSerializer().serializeToString(doc);
    const outZip = source.zip || new JSZip();
    outZip.file(source.kmlPath || 'doc.kml', serialized);

    const blob = await outZip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      mimeType: 'application/vnd.google-earth.kmz'
    });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = sourceFileName.replace(/\.(kmz|kml|zip)$/i, '');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}_現地調整_${stamp}.kmz`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    saveNote.textContent = `${changed.length}件の座標を更新し、追加円の色も既存30m・40m円に合わせて保存しました。`;
    modeStatus.textContent = 'KMZ保存完了';
  }

  updateSaveButton = function updateFieldKmzSaveButton() {
    const n = changedRecords().length;
    saveButton.disabled = !n;
    saveButton.textContent = n ? `変更したPOIをKMZ保存（${n}件）` : '変更したPOIをKMZ保存';
    saveNote.textContent = n
      ? `${n}件の座標を更新し、既存レイヤーの色・スタイルを引き継いで30m円・40m円を追加します。`
      : '変更するとKMZ保存できるようになります。';
  };
  updateSaveButton();

  saveButton.addEventListener('click', async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    saveButton.disabled = true;
    saveNote.textContent = '既存スタイルを引き継いだKMZを作成中…';
    try {
      await exportPreservedKmz();
    } catch (error) {
      console.error(error);
      saveNote.textContent = `⚠ ${error.message || 'KMZを保存できませんでした。'}`;
      modeStatus.textContent = '保存失敗';
    } finally {
      updateSaveButton();
    }
  }, true);
})();
