(() => {
  'use strict';
  const FORMAL = Object.freeze({
    existingPokestop: '既存 PokéStop',
    existingGym: '既存 Gym',
    existingPowerSpot: '既存 PowerSpot',
    newPokestop: '新規 PokéStop',
    newGym: '新規 Gym',
    newPowerSpot: '新規 PowerSpot'
  });
  const aliases = new Map([
    ['既存 PokéStop', FORMAL.existingPokestop],
    ['既存 Gym', FORMAL.existingGym],
    ['既存 PowerSpot', FORMAL.existingPowerSpot],
    ['新規 PokéStop', FORMAL.newPokestop],
    ['新規 Gym', FORMAL.newGym],
    ['新規 PowerSpot', FORMAL.newPowerSpot],
    ['既存のポケストップ', FORMAL.existingPokestop],
    ['既存のジム', FORMAL.existingGym],
    ['既存のパワースポット', FORMAL.existingPowerSpot],
    ['追加希望ポケスト', FORMAL.newPokestop],
    ['追加希望ジム', FORMAL.newGym],
    ['追加希望パワスポ', FORMAL.newPowerSpot],
    ['追加希望のポケストップ候補', FORMAL.newPokestop],
    ['追加希望のジム候補', FORMAL.newGym],
    ['追加希望のパワースポット候補', FORMAL.newPowerSpot],
    ['追加希望ポケストップ候補', FORMAL.newPokestop],
    ['追加希望ジム候補', FORMAL.newGym],
    ['追加希望パワースポット候補', FORMAL.newPowerSpot],
    ['追加 PokéStop', FORMAL.newPokestop],
    ['追加 Gym', FORMAL.newGym],
    ['追加 PowerSpot', FORMAL.newPowerSpot]
  ]);
  const norm = value => String(value || '').normalize('NFKC').trim().toLowerCase().replace(/[\s　_＿\-－ー]+/g, '');
  const normalized = new Map();
  aliases.forEach((canonical, alias) => normalized.set(norm(alias), canonical));
  const canonicalize = value => {
    const raw = String(value || '').trim();
    return aliases.get(raw) || normalized.get(norm(raw)) || raw;
  };
  const formalNames = Object.values(FORMAL);
  const formalSet = new Set(formalNames);
  const newFormalSet = new Set([FORMAL.newPokestop, FORMAL.newGym, FORMAL.newPowerSpot]);
  const isFormal = value => formalSet.has(String(value || '').trim());
  const isFormalNew = value => newFormalSet.has(String(value || '').trim());
  window.CampsitePoiLayerNames = Object.freeze({ FORMAL, canonicalize, isFormal, isFormalNew, formalNames: Object.freeze([...formalNames]) });

  const layerNames = () => typeof window.getPreSubmitLayerNames === 'function'
    ? window.getPreSubmitLayerNames()
    : Object.keys(window._layerPoints || {});

  const isPoiLayer = name => {
    if (typeof window.isAuxiliaryLayer === 'function' && window.isAuxiliaryLayer(name)) return false;
    if (isFormal(name) || canonicalize(name) !== name) return true;
    if (typeof window.getPoiTypeFromLayerName === 'function') return Boolean(window.getPoiTypeFromLayerName(name));
    return /(pok[eé]?stop|gym|powerspot|power|ポケスト|ジム|パワー)/i.test(String(name || ''));
  };

  window.getPreSubmitAddedPoiCount = function getPreSubmitAddedPoiCount() {
    const points = window._layerPoints || {};
    return Object.entries(points).reduce((sum, [name, list]) => {
      if (!isFormalNew(canonicalize(name))) return sum;
      return sum + (Array.isArray(list) ? list.length : 0);
    }, 0);
  };

  // 旧レイヤー名は互換性のためNGにせず、正式名称への変更を警告する。
  window.getPreSubmitLayerState = function getPreSubmitLayerState() {
    const names = layerNames();
    if (!names.length) return { state: 'warn', detail: '完成KMZを読み込むと自動確認します。' };
    const poiNames = names.filter(isPoiLayer);
    if (!poiNames.length) return { state: 'warn', detail: 'POIレイヤーを確認できませんでした。レイヤー名を確認してください。' };
    const legacy = poiNames.filter(name => !isFormal(name));
    if (legacy.length) {
      const recommendations = legacy.map(name => `${name} → ${canonicalize(name)}`).join(' / ');
      return { state: 'warn', detail: `旧名称または非正式名称のPOIレイヤーがあります。正式名称への変更を推奨します：${recommendations}` };
    }
    return { state: 'ok', detail: 'POIレイヤーは正式な6レイヤー名で認識しています。' };
  };

  window.getPreSubmitAutoItems = function getPreSubmitAutoItems() {
    const names = layerNames();
    const hasData = names.length > 0;
    const newPoiCount = window.getPreSubmitAddedPoiCount();
    return [
      {
        id: 'addedLimit',
        label: '新規POIは25個以内に収まっている',
        state: !hasData ? 'warn' : (newPoiCount <= 25 ? 'ok' : 'ng'),
        detail: !hasData ? '完成KMZを読み込むと自動確認します。' : `新規POI：${newPoiCount}件 / 最大25件`
      },
      {
        id: 'layers',
        label: '既存POIと新規POIのレイヤー名を確認している',
        ...window.getPreSubmitLayerState()
      },
      {
        id: 'polygon',
        label: '活動範囲ポリゴンを設定している',
        state: !hasData ? 'warn' : (window._hasPolygon ? 'ok' : 'ng'),
        detail: !hasData ? '完成KMZを読み込むと自動確認します。' : (window._hasPolygon ? `活動範囲を検出しました（${window._activityPolygons?.length || 0}件）。` : '活動範囲ポリゴンが見つかりません。')
      },
      {
        id: 'distanceRun',
        label: '完成KMZで距離チェックを実施している',
        ...(typeof window.getPreSubmitDistanceRunState === 'function' ? window.getPreSubmitDistanceRunState() : { state: 'warn', detail: '完成KMZで距離チェックを実施してください。' })
      },
      {
        id: 'duplicate',
        label: '重複POI候補を確認している',
        ...(typeof window.getPreSubmitDuplicateState === 'function' ? window.getPreSubmitDuplicateState() : { state: 'warn', detail: '距離チェック実施後に確認できます。' })
      }
    ];
  };

  window.getDistancePoiLayerNameWarnings = function getDistancePoiLayerNameWarnings(names = []) {
    return Array.from(new Set(names.map(name => String(name || '').trim())))
      .filter(Boolean)
      .filter(name => isPoiLayer(name) && !isFormal(name))
      .map(name => ({ current: name, recommended: canonicalize(name) }));
  };
})();
