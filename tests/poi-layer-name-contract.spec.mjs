import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('POI layer name contract keeps formal output and legacy read aliases', async () => {
  const shared = fs.readFileSync('js/poi-layer-names.js', 'utf8');
  for (const name of ['既存 PokéStop','既存 Gym','既存 PowerSpot','新規 PokéStop','新規 Gym','新規 PowerSpot']) expect(shared).toContain(name);
  for (const legacy of ['既存のポケストップ','既存のジム','既存のパワースポット','追加希望ポケスト','追加希望ジム','追加希望パワスポ']) expect(shared).toContain(legacy);

  const kmz = fs.readFileSync('js/kmz.js', 'utf8');
  expect(kmz).toContain('既存 PokéStop');
  expect(kmz).toContain('新規 PokéStop');

  const field = fs.readFileSync('js/field-mode-export.js', 'utf8');
  expect(field).toContain("pokestop:'新規 PokéStop'");

  const distancePoi = fs.readFileSync('js/distance-poi.js', 'utf8');
  expect(distancePoi).toContain('originalName.includes("新規")');
  expect(distancePoi).toContain('originalName.includes("追加")');
  expect(distancePoi).toContain('"追加希望"');
  expect(distancePoi).toContain('<small>新規POI</small>');

  const distanceFile = fs.readFileSync('js/distance-file.js', 'utf8');
  expect(distanceFile).toContain('<strong>${escapeDistanceHtml(name)}</strong>');
  expect(distanceFile).not.toContain('<strong>${escapeDistanceHtml(cleanLayerName(name))}</strong>');
});
