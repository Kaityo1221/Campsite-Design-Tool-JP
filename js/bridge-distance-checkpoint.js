(() => {
  'use strict';

  const PROJECT_KEY = 'campsiteProject.v1';
  const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

  function readProject() {
    try { return JSON.parse(sessionStorage.getItem(PROJECT_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function escapeXml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function entityOf(poi) {
    const raw = String(poi?.gameEntity || poi?.type || '').toUpperCase();
    if (raw === 'GYM' || raw === 'POWERSPOT') return raw;
    return 'POKESTOP';
  }

  function roleOf(poi) {
    if (poi?.role === 'added') return 'added';
    if (String(poi?.layer || '').toLowerCase().startsWith('new-')) return 'added';
    return 'existing';
  }

  function layerNameOf(poi) {
    const role = roleOf(poi) === 'added' ? '新規' : '既存';
    const entity = entityOf(poi);
    if (entity === 'GYM') return `${role} Gym`;
    if (entity === 'POWERSPOT') return `${role} PowerSpot`;
    return `${role} PokéStop`;
  }

  function normalizedPois(project) {
    const source = Array.isArray(project?.currentPois) && project.currentPois.length
      ? project.currentPois
      : (Array.isArray(project?.selectedPois) ? project.selectedPois : []);
    return source.map((poi, index) => {
      const lat = Number(poi?.lat);
      const lng = Number(poi?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        id: String(poi?.id || poi?.guid || `poi-${index + 1}`),
        guid: String(poi?.guid || ''),
        name: String(poi?.title || poi?.name || `POI ${index + 1}`),
        description: String(poi?.description || poi?.memo || ''),
        lat,
        lng,
        role: roleOf(poi),
        gameEntity: entityOf(poi),
        gameStatus: String(poi?.gameStatus || 'UNKNOWN'),
        sponsored: poi?.sponsored === true,
        smr: poi?.smr === true ? true : poi?.smr === false ? false : null,
        layer: layerNameOf(poi)
      };
    }).filter(Boolean);
  }

  function circleCoordinates(lat, lng, radiusMeters, segments = 36) {
    const earth = 6371008.8;
    const latRad = lat * Math.PI / 180;
    const coords = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (Math.PI * 2 * i) / segments;
      const north = Math.cos(angle) * radiusMeters;
      const east = Math.sin(angle) * radiusMeters;
      const dLat = (north / earth) * 180 / Math.PI;
      const cosLat = Math.max(0.000001, Math.cos(latRad));
      const dLng = (east / (earth * cosLat)) * 180 / Math.PI;
      coords.push(`${(lng + dLng).toFixed(7)},${(lat + dLat).toFixed(7)},0`);
    }
    return coords.join(' ');
  }

  function placemarkForPoi(poi) {
    return `
      <Placemark>
        <name>${escapeXml(poi.name)}</name>
        <description>${escapeXml(poi.description)}</description>
        <ExtendedData>
          <Data name="id"><value>${escapeXml(poi.id)}</value></Data>
          <Data name="guid"><value>${escapeXml(poi.guid)}</value></Data>
          <Data name="role"><value>${escapeXml(poi.role)}</value></Data>
          <Data name="gameEntity"><value>${escapeXml(poi.gameEntity)}</value></Data>
          <Data name="gameStatus"><value>${escapeXml(poi.gameStatus)}</value></Data>
          <Data name="sponsored"><value>${poi.sponsored ? 'true' : 'false'}</value></Data>
          <Data name="smr"><value>${poi.smr === null ? '' : String(poi.smr)}</value></Data>
        </ExtendedData>
        <Point><coordinates>${poi.lng.toFixed(7)},${poi.lat.toFixed(7)},0</coordinates></Point>
      </Placemark>`;
  }

  function buildKml(project) {
    const pois = normalizedPois(project);
    const groups = new Map();
    for (const poi of pois) {
      if (!groups.has(poi.layer)) groups.set(poi.layer, []);
      groups.get(poi.layer).push(poi);
    }

    const pointFolders = Array.from(groups.entries()).map(([name, list]) => `
      <Folder>
        <name>${escapeXml(name)}</name>
        ${list.map(placemarkForPoi).join('')}
      </Folder>`).join('');

    const polygon = (Array.isArray(project?.polygon) ? project.polygon : [])
      .map(point => Array.isArray(point) ? [Number(point[0]), Number(point[1])] : null)
      .filter(point => point && point.every(Number.isFinite));
    let polygonFolder = '';
    if (polygon.length >= 3) {
      const closed = polygon.concat([polygon[0]]);
      const coordinates = closed.map(([lat, lng]) => `${lng.toFixed(7)},${lat.toFixed(7)},0`).join(' ');
      polygonFolder = `
      <Folder>
        <name>活動範囲</name>
        <Placemark>
          <name>活動範囲</name>
          <Style><LineStyle><color>ff22aa55</color><width>3</width></LineStyle><PolyStyle><color>3322aa55</color></PolyStyle></Style>
          <Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinates}</coordinates></LinearRing></outerBoundaryIs></Polygon>
        </Placemark>
      </Folder>`;
    }

    const radii = Array.isArray(project?.circleRadii) && project.circleRadii.length
      ? project.circleRadii.map(Number).filter(radius => [50, 40, 30].includes(radius))
      : [50];
    const uniqueRadii = [50, 40, 30].filter(radius => radii.includes(radius));
    const circleFolders = uniqueRadii.map(radius => `
      <Folder>
        <name>${radius}m</name>
        ${pois.map(poi => `
          <Placemark>
            <name>${escapeXml(poi.name)} ${radius}m</name>
            <Style><LineStyle><color>${radius === 50 ? 'ff00a5ff' : radius === 40 ? 'ff9c5de5' : 'ff36a269'}</color><width>1.5</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style>
            <Polygon><outerBoundaryIs><LinearRing><coordinates>${circleCoordinates(poi.lat, poi.lng, radius)}</coordinates></LinearRing></outerBoundaryIs></Polygon>
          </Placemark>`).join('')}
      </Folder>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Campsite Backup</name>
    <ExtendedData>
      <Data name="schema"><value>campsiteProject.v1</value></Data>
      <Data name="projectId"><value>${escapeXml(project?.projectId || '')}</value></Data>
      <Data name="workspaceId"><value>${escapeXml(project?.workspaceId || '')}</value></Data>
      <Data name="savedAt"><value>${escapeXml(new Date().toISOString())}</value></Data>
      <Data name="circleRadii"><value>${escapeXml(uniqueRadii.join(','))}</value></Data>
    </ExtendedData>
    ${pointFolders}
    ${polygonFolder}
    ${circleFolders}
  </Document>
</kml>`;
  }

  function ensureJsZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-campsite-jszip]');
      if (existing) {
        existing.addEventListener('load', () => window.JSZip ? resolve(window.JSZip) : reject(new Error('JSZip unavailable')), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.dataset.campsiteJszip = '1';
      script.src = JSZIP_URL;
      script.onload = () => window.JSZip ? resolve(window.JSZip) : reject(new Error('JSZip unavailable'));
      script.onerror = () => reject(new Error('JSZip load failed'));
      document.head.appendChild(script);
    });
  }

  function backupFileName(project) {
    const now = new Date();
    const pad = value => String(value).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const id = String(project?.projectId || project?.workspaceId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 8);
    return `Campsite_Backup_${stamp}${id ? '_' + id : ''}.kmz`;
  }

  async function saveBackupKmz(status) {
    const project = readProject();
    if (!project || project.source !== 'bridge') throw new Error('Campsite Project not found');
    const JSZipCtor = await ensureJsZip();
    const zip = new JSZipCtor();
    zip.file('doc.kml', buildKml(project));
    zip.file('campsite-project.json', JSON.stringify(project, null, 2));
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      mimeType: 'application/vnd.google-earth.kmz'
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = backupFileName(project);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1800);
    if (status) status.textContent = 'バックアップKMZを端末に保存しました。';
  }

  function ensureSaveUi() {
    const result = document.getElementById('distanceResult');
    if (!result || !result.textContent.trim()) return null;

    let wrap = document.getElementById('campsiteDistanceCheckpoint');
    if (wrap) return wrap;

    wrap = document.createElement('div');
    wrap.id = 'campsiteDistanceCheckpoint';
    wrap.style.cssText = 'margin:16px 0 8px;padding:14px;border:1px solid rgba(59,130,246,.34);border-radius:14px;background:rgba(59,130,246,.08)';
    wrap.innerHTML = '<button type="button" data-distance-checkpoint-save style="width:100%;min-height:48px;padding:12px 16px;border:1px solid rgba(96,165,250,.62);border-radius:12px;background:linear-gradient(135deg,#dbeafe,#bfdbfe);color:#172554;font-size:15px;font-weight:950;cursor:pointer">💾 セーブする</button><div data-distance-checkpoint-status style="margin-top:8px;color:#bfdbfe;font-size:12px;line-height:1.6;text-align:center">必要なら、現在の設計をバックアップKMZとして端末に保存できます。</div>';

    const button = wrap.querySelector('[data-distance-checkpoint-save]');
    const status = wrap.querySelector('[data-distance-checkpoint-status]');
    button?.addEventListener('click', async () => {
      if (button.disabled) return;
      button.disabled = true;
      button.style.opacity = '.72';
      if (status) status.textContent = 'バックアップKMZを作成しています…';
      try {
        await saveBackupKmz(status);
      } catch (error) {
        console.warn('[Campsite Project] backup KMZ save failed', error);
        if (status) status.textContent = '保存できませんでした。もう一度お試しください。';
      } finally {
        button.disabled = false;
        button.style.opacity = '1';
      }
    });

    const guide = document.querySelector('#distance .distance-checklist-guide');
    if (guide) guide.insertAdjacentElement('beforebegin', wrap);
    else result.insertAdjacentElement('afterend', wrap);
    return wrap;
  }

  function install() {
    const result = document.getElementById('distanceResult');
    if (!result) return false;
    const refresh = () => setTimeout(ensureSaveUi, 140);
    const observer = new MutationObserver(refresh);
    observer.observe(result, { childList: true, subtree: true, characterData: true });
    refresh();
    window.addEventListener('pageshow', refresh);
    window.CampsiteDistanceBackup = Object.freeze({ save: saveBackupKmz });
    return true;
  }

  function boot() {
    const params = new URLSearchParams(location.search);
    if (params.get('campsiteProject') !== 'bridge') return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (install() || attempts >= 100) clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
