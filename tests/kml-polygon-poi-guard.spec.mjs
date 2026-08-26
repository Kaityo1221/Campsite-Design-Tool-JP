import { test, expect } from '@playwright/test';

const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <name>既存 PokéStop</name>
      <Placemark>
        <name>本物のPOI</name>
        <description>pokestop</description>
        <Point><coordinates>139.850000,35.640000,0</coordinates></Point>
      </Placemark>
    </Folder>
    <Folder>
      <name>50m</name>
      <Placemark>
        <name>50m 1</name>
        <Polygon>
          <outerBoundaryIs><LinearRing><coordinates>
            139.850000,35.640450,0 139.850500,35.640000,0 139.850000,35.639550,0 139.849500,35.640000,0 139.850000,35.640450,0
          </coordinates></LinearRing></outerBoundaryIs>
        </Polygon>
      </Placemark>
    </Folder>
  </Document>
</kml>`;

test('円ポリゴンをPOIとして読み込まない', async ({ page }) => {
  await page.goto('/');

  const points = await page.evaluate(source => parseKmlPoints(source), kml);

  expect(points).toHaveLength(1);
  expect(points[0].name).toBe('本物のPOI');
  expect(points[0].lat).toBeCloseTo(35.64, 6);
  expect(points[0].lng).toBeCloseTo(139.85, 6);
});
