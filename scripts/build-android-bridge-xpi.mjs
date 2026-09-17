import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const partsDir = 'dist/android-bridge-0.3.4';
const output = 'downloads/campsite-bridge-android-0.3.4.xpi';
const expectedSha256 = '13e57ace3468832c171df06bb92c983d66a22bc0f390c0ff15d0df3deff741b6';
const expectedBytes = 34607;

const parts = Array.from({ length: 8 }, (_, index) =>
  path.join(partsDir, `part-${String(index + 1).padStart(2, '0')}.b64`)
);

const base64 = parts.map(file => fs.readFileSync(file, 'utf8').trim()).join('');
const data = Buffer.from(base64, 'base64');
const actualSha256 = crypto.createHash('sha256').update(data).digest('hex');

if (data.length !== expectedBytes) {
  throw new Error(`Android XPI size mismatch: expected ${expectedBytes}, actual ${data.length}`);
}
if (actualSha256 !== expectedSha256) {
  throw new Error(`Android XPI SHA-256 mismatch: expected ${expectedSha256}, actual ${actualSha256}`);
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, data);

console.log(`Built Campsite Bridge Android 0.3.4: ${data.length} bytes`);
console.log(`SHA-256: ${actualSha256}`);
