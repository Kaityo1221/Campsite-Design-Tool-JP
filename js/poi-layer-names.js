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
  const formalSet = new Set(Object.values(FORMAL));
  const isFormal = value => formalSet.has(String(value || '').trim());
  window.CampsitePoiLayerNames = Object.freeze({ FORMAL, canonicalize, isFormal });
})();
