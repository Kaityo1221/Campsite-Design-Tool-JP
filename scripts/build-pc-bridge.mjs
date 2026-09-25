import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const sourceDir = 'bridge-pc';
const output = 'downloads/campsite-bridge-pc-0.1.0.zip';
const sharedMapAdapter = 'js/bridge-wayfarer-map-adapter.js';
const pcMapAdapter = path.join(sourceDir, 'wayfarer-map-adapter.js');
const sharedDisplayOwner = 'js/bridge-wayfarer-display-owner.js';
const pcDisplayOwner = path.join(sourceDir, 'wayfarer-display-owner.js');
const sharedPoiColors = 'js/bridge-wayfarer-poi-colors.js';
const pcPoiColors = path.join(sourceDir, 'wayfarer-poi-colors.js');
const FIXED_DOS_TIME = 0;
const FIXED_DOS_DATE = ((2026 - 1980) << 9) | (9 << 5) | 21;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function listFiles(dir, base = dir) {
  const result = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const absolute = path.join(dir, name);
    const stat = fs.statSync(absolute);
    if (stat.isDirectory()) result.push(...listFiles(absolute, base));
    else if (stat.isFile()) result.push({
      absolute,
      relative: path.relative(base, absolute).split(path.sep).join('/')
    });
  }
  return result;
}

function localHeader(name, data, crc) {
  const filename = Buffer.from(name, 'utf8');
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(FIXED_DOS_TIME, 10);
  header.writeUInt16LE(FIXED_DOS_DATE, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(filename.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, filename]);
}

function centralHeader(name, data, crc, offset) {
  const filename = Buffer.from(name, 'utf8');
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(FIXED_DOS_TIME, 12);
  header.writeUInt16LE(FIXED_DOS_DATE, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(data.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(filename.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, filename]);
}

if (!fs.existsSync(sharedMapAdapter)) throw new Error(`Shared Wayfarer map adapter missing: ${sharedMapAdapter}`);
fs.copyFileSync(sharedMapAdapter, pcMapAdapter);
if (!fs.existsSync(sharedDisplayOwner)) throw new Error(`Shared Wayfarer display owner missing: ${sharedDisplayOwner}`);
fs.copyFileSync(sharedDisplayOwner, pcDisplayOwner);
if (!fs.existsSync(sharedPoiColors)) throw new Error(`Shared POI color overlay missing: ${sharedPoiColors}`);
fs.copyFileSync(sharedPoiColors, pcPoiColors);

const manifest = JSON.parse(fs.readFileSync(path.join(sourceDir, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3) throw new Error('PC Bridge must use Manifest V3');
if (manifest.version !== '0.1.0') throw new Error('PC Bridge manifest version must be 0.1.0');
const mainScripts = manifest.content_scripts?.find(entry => entry.world === 'MAIN')?.js || [];
if (!mainScripts.includes('wayfarer-map-adapter.js')) throw new Error('PC Bridge manifest must load wayfarer-map-adapter.js in MAIN world');
if (!mainScripts.includes('wayfarer-display-owner.js')) throw new Error('PC Bridge manifest must load wayfarer-display-owner.js in MAIN world');
if (!mainScripts.includes('wayfarer-poi-colors.js')) throw new Error('PC Bridge manifest must load wayfarer-poi-colors.js in MAIN world');
if (mainScripts.indexOf('wayfarer-map-adapter.js') > mainScripts.indexOf('wayfarer-display-owner.js')) {
  throw new Error('PC Bridge must load wayfarer-map-adapter.js before wayfarer-display-owner.js');
}
if (mainScripts.indexOf('wayfarer-display-owner.js') > mainScripts.indexOf('page-collector.js')) {
  throw new Error('PC Bridge must load wayfarer-display-owner.js before page-collector.js');
}

const files = listFiles(sourceDir);
if (!files.length) throw new Error('PC Bridge source is empty');

const locals = [];
const centrals = [];
let offset = 0;

for (const file of files) {
  const data = fs.readFileSync(file.absolute);
  const crc = crc32(data);
  const local = localHeader(file.relative, data, crc);
  locals.push(local, data);
  centrals.push(centralHeader(file.relative, data, crc, offset));
  offset += local.length + data.length;
}

const centralOffset = offset;
const central = Buffer.concat(centrals);
const body = Buffer.concat(locals);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(0, 4);
end.writeUInt16LE(0, 6);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(central.length, 12);
end.writeUInt32LE(centralOffset, 16);
end.writeUInt16LE(0, 20);

const zip = Buffer.concat([body, central, end]);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, zip);

const sha256 = crypto.createHash('sha256').update(zip).digest('hex');
console.log(`Built Campsite Bridge PC 0.1.0: ${zip.length} bytes`);
console.log(`SHA-256: ${sha256}`);
console.log(`Files: ${files.map(file => file.relative).join(', ')}`);
