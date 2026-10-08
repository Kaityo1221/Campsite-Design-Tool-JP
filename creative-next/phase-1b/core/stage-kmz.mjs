/*
 * Creative Next Phase 1-B: non-mutating KMZ/KML structural staging reader.
 * Requires caller-supplied JSZip and DOMParser. No DOM insertion, fetching,
 * localStorage, or writes to a Creative Mode store. Never imports automatically.
 * WIP: unknown source content is retained in rawSource, NOT yet roundtrip exported.
 */
const DEFAULT_LIMITS = Object.freeze({
  maxArchiveBytes: 8 * 1024 * 1024,
  maxExpandedBytes: 32 * 1024 * 1024,
  maxKmlBytes: 16 * 1024 * 1024,
  maxEntries: 1500,
  maxPlacemarks: 4000
});
const KML_NS = 'http://www.opengis.net/kml/2.2';
const GEOMETRIES = new Set(['Point', 'Polygon', 'LineString', 'MultiGeometry', 'Model', 'Track', 'MultiTrack']);

function failure(code, message) {
  const e = new Error(message); e.code = code; return e;
}
function cancelled(signal) {
  if (signal?.aborted) throw failure('CANCELLED', 'Staging cancelled. Existing state was not touched.');
}
function maxSafetyValue(requested, hard) {
  // Optional overrides can only tighten this WIP safety envelope.
  return Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, hard) : hard;
}
function bounds(options = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_LIMITS).map(([key, hard]) => [key, maxSafetyValue(options[key], hard)]));
}
function bytesOf(source, limit) {
  if (source instanceof Uint8Array) {
    if (source.byteLength > limit) throw failure('ARCHIVE_TOO_LARGE', 'Compressed input exceeds provisional safety envelope');
    return Promise.resolve(source.slice());
  }
  if (source instanceof ArrayBuffer) return bytesOf(new Uint8Array(source), limit);
  if (source && typeof source.arrayBuffer === 'function') {
    if (typeof source.size !== 'number' || source.size > limit || source.size < 0) throw failure('ARCHIVE_TOO_LARGE', 'Unsafe File size');
    return source.arrayBuffer().then(b => bytesOf(b, limit));
  }
  throw failure('INPUT_INVALID', 'Uint8Array, ArrayBuffer or File required');
}
function checkZipPath(name) {
  if (!name || name.length > 1024 || /[\\\u0000-\u001f]/.test(name) || /^[/\\]/.test(name) || /^[A-Za-z]:/.test(name)) return false;
  if (name.split('/').some((part, index, parts) => part === '.' || part === '..' || (part === '' && !(index === parts.length - 1 && name.endsWith('/'))))) return false;
  if (/%(?:2e|2f|5c)/i.test(name)) return false;
  return true;
}
function zipCentralDirectory(raw, limits) {
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const u16 = o => dv.getUint16(o, true), u32 = o => dv.getUint32(o, true);
  // ZIP EOCD can have an up-to-65,535-byte comment. Exclude ZIP64 and multi-disk archives.
  let eocd = -1;
  for (let i = raw.length - 22; i >= Math.max(0, raw.length - 65557); i--) {
    if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === raw.length) { eocd = i; break; }
  }
  if (eocd < 0 || u16(eocd + 4) !== 0 || u16(eocd + 6) !== 0 || u16(eocd + 8) !== u16(eocd + 10)) {
    throw failure('ZIP_INVALID', 'Missing or unsupported ZIP central directory');
  }
  const count = u16(eocd + 10), cdSize = u32(eocd + 12), cdOffset = u32(eocd + 16);
  if (count === 0xffff || count > limits.maxEntries || cdOffset === 0xffffffff || cdSize === 0xffffffff || cdOffset + cdSize > eocd) {
    throw failure('ZIP_LIMIT', 'ZIP64 or oversized/ambiguous archive');
  }
  let cursor = cdOffset, expandedTotal = 0;
  const paths = new Set(), entries = [];
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > eocd || u32(cursor) !== 0x02014b50) throw failure('ZIP_INVALID', 'Invalid central directory entry');
    const flags = u16(cursor + 8), method = u16(cursor + 10);
    const compressedSize = u32(cursor + 20), expandedSize = u32(cursor + 24);
    const nameLen = u16(cursor + 28), extraLen = u16(cursor + 30), commentLen = u16(cursor + 32);
    const localOffset = u32(cursor + 42);
    const end = cursor + 46 + nameLen + extraLen + commentLen;
    if (end > cdOffset + cdSize || (flags & 1) || (flags & 0x40) || ![0, 8].includes(method) ||
        compressedSize === 0xffffffff || expandedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw failure('ZIP_UNSUPPORTED', 'Unsupported ZIP entry or encryption');
    }
    // Conservative: require UTF-8 for non-ASCII paths; standard ASCII paths are fine.
    const nameBytes = raw.subarray(cursor + 46, cursor + 46 + nameLen);
    let path;
    try { path = decoder.decode(nameBytes); } catch { throw failure('ZIP_PATH', 'Invalid UTF-8 ZIP path'); }
    if (!checkZipPath(path)) throw failure('ZIP_PATH', 'Potential ZIP path traversal or reserved characters');
    const key = path.toLocaleLowerCase('en-US');
    if (paths.has(key)) throw failure('ZIP_DUPLICATE', 'Duplicate or case-colliding ZIP path');
    paths.add(key);
    if (localOffset + 30 > cdOffset || u32(localOffset) !== 0x04034b50) throw failure('ZIP_INVALID', 'Invalid local ZIP header');
    const localNameLength = u16(localOffset + 26), localExtraLength = u16(localOffset + 28);
    const localNameBytes=raw.subarray(localOffset + 30,localOffset + 30 + localNameLength);
    if (localNameLength !== nameLen || localNameBytes.some((v,j) => v !== nameBytes[j]) ||
        u16(localOffset + 8) !== method || u16(localOffset + 6) !== flags) {
      throw failure('ZIP_INVALID', 'Local ZIP header differs from central directory');
    }
    if (localOffset + 30 + localNameLength + localExtraLength + compressedSize > cdOffset) {
      throw failure('ZIP_INVALID', 'Entry data outside ZIP archive');
    }
    expandedTotal += expandedSize;
    if (!Number.isSafeInteger(expandedTotal) || expandedTotal > limits.maxExpandedBytes) throw failure('ZIP_BOMB', 'Declared expanded ZIP size exceeds provisional safety envelope');
    entries.push({ path, compressedSize, expandedSize, crc32:u32(cursor + 16), isDirectory: path.endsWith('/') });
    cursor = end;
  }
  if (cursor !== cdOffset + cdSize) throw failure('ZIP_INVALID', 'Central directory size mismatch');
  return entries;
}
function elements(parent) {
  return Array.from(parent?.childNodes || []).filter(e => e.nodeType === 1);
}
function direct(parent, name) { return elements(parent).filter(e => e.localName === name && e.namespaceURI === KML_NS); }
function one(parent, name) { return direct(parent, name)[0] || null; }
function value(parent, name) { const node = one(parent, name); return node ? node.textContent : undefined; }
function metadata(parent) {
  const entries = [];
  for (const ext of direct(parent, 'ExtendedData')) {
    for (const d of direct(ext, 'Data')) entries.push({name:d.getAttribute('name') ?? '',value:value(d,'value') ?? ''});
  }
  return entries;
}
function coordinatesRing(polygon) {
  const outers = direct(polygon,'outerBoundaryIs');
  if (outers.length !== 1 || direct(polygon,'innerBoundaryIs').length > 0) return { valid:false, raw:null, points:[] };
  const rings = direct(outers[0],'LinearRing');
  const raw = rings.length === 1 ? value(rings[0],'coordinates') : undefined;
  if (raw === undefined) return {valid:false,raw:null,points:[]};
  const tuples = raw.trim().split(/\s+/);
  const decimals = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  const points = tuples.map(t => t.split(',')).map(parts => {
    if (![2,3].includes(parts.length) || !parts.every(x => decimals.test(x.trim()))) return null;
    const point=parts.map(Number);
    if (!point.every(Number.isFinite) || Math.abs(point[0])>180 || Math.abs(point[1])>90) return null;
    return point;
  });
  const valid = points.length >= 4 && points.every(Boolean) && points[0].length === points.at(-1).length &&
    points[0].every((v,i) => v === points.at(-1)[i]) &&
    new Set(points.slice(0,-1).map(p=>p[0]+','+p[1])).size >= 3;
  return {valid,raw,points};
}
function legacyPolygonEvidence(place, ring) {
  if (!ring.valid) return {};
  const area = place.folder === 'ポリゴン' && /^ポリゴン\s+\d+$/.test(place.name) && ring.points.length >= 4;
  if (area) return {legacyShape:'activity-area',legacyShapeVerified:true};
  const radius = /^([345]0)m サークル$/.exec(place.folder);
  if (!radius || place.name === undefined || !new RegExp('^'+radius[1]+'m\\s+\\d+$').test(place.name) || ring.points.length !== 49) return {};
  const points=ring.points;
  const lat=points.slice(0,-1).reduce((v,p)=>v+p[1],0)/48;
  const lng=points.slice(0,-1).reduce((v,p)=>v+p[0],0)/48;
  // Center inferred from ring is not exact enough to reconstruct seven-digit points.
  // Verify radius and evenly-spaced radial segments conservatively, not source identity.
  const meters=points.slice(0,-1).map(p=>{
    const x=(p[0]-lng)*Math.cos(lat*Math.PI/180)*111320;
    const y=(p[1]-lat)*111320;
    return Math.hypot(x,y);
  });
  const target=Number(radius[1]);
  const radians=points.slice(0,-1).map(p=>{
    const x=(p[0]-lng)*Math.cos(lat*Math.PI/180), y=p[1]-lat;
    const angle=Math.atan2(x,y);
    return (angle+2*Math.PI)%(2*Math.PI);
  });
  const angular=(angle,expected)=>Math.abs((angle-expected+3*Math.PI)%(2*Math.PI)-Math.PI);
  if (meters.every(m=>Math.abs(m-target)<1.5) &&
      radians.every((v,i)=>angular(v,i*2*Math.PI/48)<0.055)) {
    return {legacyShape:'distance-circle',legacyShapeVerified:true,
      legacyCircle:{radius:target,center:{lat,lng}}};
  }
  return {};
}
function buildPlaces(doc, maxPlacemarks) {
  const pms = Array.from(doc.getElementsByTagNameNS(KML_NS, 'Placemark'));
  if (pms.length > maxPlacemarks) throw failure('POI_LIMIT', 'Too many Placemarks for isolated staging');
  return pms.map(pm => {
    const folderPath=[];
    for (let node=pm.parentNode;node;node=node.parentNode) if (node.nodeType===1 && node.localName==='Folder' && node.namespaceURI===KML_NS) {
      folderPath.unshift(value(node,'name') ?? '');
    }
    const geometryNodes = Array.from(pm.getElementsByTagName('*')).filter(e=> GEOMETRIES.has(e.localName));
    const geom = geometryNodes.length === 1 ? geometryNodes[0] : null;
    const place={
      name:value(pm,'name'), description:value(pm,'description'), data:metadata(pm), styleUrl:value(pm,'styleUrl'),
      folder:folderPath.at(-1)||'',folderPath,geometry:geom?.localName || 'unknown',geometryCount:geometryNodes.length,
      sourcePlacemarkXml:null
    };
    if (geom?.localName === 'Point' && geometryNodes.length === 1) {
      const coords=direct(geom,'coordinates');
      place.coordinates=coords.length===1 ? coords[0].textContent : undefined;
      place.sourceGeometry={coordinates:place.coordinates,altitudeMode:value(geom,'altitudeMode'),extrude:value(geom,'extrude')};
    } else if (geom?.localName === 'Polygon' && geometryNodes.length === 1) {
      const ring = coordinatesRing(geom);
      place.polygonValid=ring.valid;
      place.polygonGeometry={raw:ring.raw,points:ring.points,hasHoles:direct(geom,'innerBoundaryIs').length>0};
      Object.assign(place,legacyPolygonEvidence(place,ring));
      // New-format circle polygons require dedicated verification at the O-07 gate.
      place.circleValid=false;
    }
    return place;
  });
}
function parseKml(kml, options) {
  if (/<!(?:DOCTYPE|ENTITY|\[CDATA\[\s*<!DOCTYPE)/i.test(kml)) throw failure('XML_UNSAFE', 'DTD and entity declarations are forbidden');
  const XMLParser=options.DOMParser;
  if (typeof XMLParser !== 'function') throw failure('CONFIG_INVALID', 'A DOMParser constructor must be injected');
  const errors=[];
  // Browsers report parsererror as XML nodes; xmldom reports errors via callbacks.
  let dom;
  try { dom=new XMLParser({errorHandler:{warning:msg=>errors.push(msg),error:msg=>errors.push(msg),fatalError:msg=>errors.push(msg)}}).parseFromString(kml,'application/xml'); }
  catch { dom=new XMLParser().parseFromString(kml,'application/xml'); }
  if (!dom?.documentElement || dom.documentElement.localName!=='kml' || dom.documentElement.namespaceURI !== KML_NS ||
      dom.getElementsByTagName('parsererror').length || errors.length) throw failure('XML_INVALID', 'Invalid KML XML');
  const documents=Array.from(dom.getElementsByTagNameNS(KML_NS,'Document'));
  if (documents.length!==1) throw failure('KML_DOCUMENT', 'Exactly one KML Document required');
  const unhandledFeatures=['NetworkLink','GroundOverlay','ScreenOverlay','PhotoOverlay','Tour','NetworkLinkControl']
    .reduce((sum,name)=>sum+dom.getElementsByTagNameNS('*',name).length,0);
  return { documentData:metadata(documents[0]), places:buildPlaces(dom,options.limits.maxPlacemarks),unhandledFeatures };
}
function baseStage(raw, inputType) {
  return {rawSource:raw,sourceKml:null,sourceFormat:inputType,sourcePath:null,
    audit:{zipValid:false,boundedExtraction:false,safePaths:false,safeXml:false,kmlCount:0,allObjectsCount:0,unknownInformationPreserved:false,unhandledFeatures:0},
    documentData:[],places:[],errors:[]};
}
const CRC_TABLE=Uint32Array.from({length:256},(_,i)=>{
  let c=i;
  for(let j=0;j<8;j++)c=(c>>>1)^(c&1?0xedb88320:0);
  return c>>>0;
});
function crc32Of(bytes, value=0xffffffff) {
  let crc=value;
  for(const byte of bytes)crc=(crc>>>8)^CRC_TABLE[(crc^byte)&255];
  return crc>>>0;
}
async function unzipBounded(entry, maxSize, signal, keepData=true) {
  const chunks=[];let n=0;let crc=0xffffffff;
  return new Promise((resolve,reject) => {
    const stream=entry.internalStream('uint8array');let settled=false;
    const fail=e=>{if(settled)return;settled=true;stream.pause?.();reject(e)};
    stream.on('data',chunk=>{
      if(settled)return;
      if(signal?.aborted) return fail(failure('CANCELLED','Cancelled while inflating'));
      n+=chunk.length;
      if(n>maxSize) return fail(failure('ZIP_BOMB','Actual decompressed KML exceeds limit'));
      crc=crc32Of(chunk,crc);
      if(keepData)chunks.push(chunk);
    });
    stream.on('error',e=>fail(failure('ZIP_INVALID','KML inflate failure: '+String(e?.message||e))));
    stream.on('end',()=>{
      if(settled)return;
      settled=true;let bytes=null;
      if(keepData){bytes=new Uint8Array(n);let p=0;for(const chunk of chunks){bytes.set(chunk,p);p+=chunk.length}}
      resolve({bytes,length:n,crc32:(~crc)>>>0});
    });
    try{stream.resume()}catch(e){fail(e)}
  });
}
function decodeKml(bytes) {
  try {return new TextDecoder('utf-8',{fatal:true}).decode(bytes)} catch {throw failure('KML_ENCODING','KML must be valid UTF-8 for this profile')}
}
export async function stageKmlInput(input,{JSZip,DOMParser,signal,limits:requestedLimits}={}) {
  const limits=bounds(requestedLimits), raw=await bytesOf(input,limits.maxArchiveBytes);
  const kmz=raw.length>=4 && raw[0]===0x50 && raw[1]===0x4b;
  const stage=baseStage(raw,kmz?'kmz':'kml');
  try {
    if (!kmz && typeof input?.name === 'string' && /\.(kmz|zip)$/i.test(input.name))
      throw failure('ZIP_INVALID', 'KMZ extension but ZIP signature is missing');
    cancelled(signal);
    let kmlBytes;
    if (kmz) {
      const entries=zipCentralDirectory(raw,limits);
      stage.audit.zipValid=true;stage.audit.safePaths=true;stage.audit.boundedExtraction=true;
      const kmlEntries=entries.filter(e=>!e.isDirectory && /\.kml$/i.test(e.path));
      stage.audit.kmlCount=kmlEntries.length;
      if(kmlEntries.length!==1) throw failure('KML_AMBIGUOUS','Expected one KML document, found '+kmlEntries.length);
      const target=kmlEntries[0];
      if(target.expandedSize>limits.maxKmlBytes) throw failure('KML_LIMIT','KML exceeds provisional size envelope');
      if(!JSZip || typeof JSZip.loadAsync!=='function') throw failure('CONFIG_INVALID','JSZip must be injected');
      const zip=await JSZip.loadAsync(raw);
      cancelled(signal);
      let actualExpanded=0;
      for(const info of entries){
        if(info.isDirectory)continue;
        cancelled(signal);
        const entry=zip.file(info.path);
        if(!entry)throw failure('ZIP_INVALID','Audited ZIP entry absent after unpacking');
        const keep=info.path===target.path;
        const inflated=await unzipBounded(entry,Math.min(limits.maxExpandedBytes-actualExpanded,keep?limits.maxKmlBytes:limits.maxExpandedBytes),signal,keep);
        actualExpanded+=inflated.length;
        if(inflated.length!==info.expandedSize || inflated.crc32!==info.crc32){
          throw failure('ZIP_INVALID','Declared and actual ZIP size/CRC differ');
        }
        if(keep)kmlBytes=inflated.bytes;
      }
      if(!kmlBytes)throw failure('ZIP_INVALID','No KML bytes could be verified');
      stage.sourcePath=target.path;
    } else {
      if(raw.length>limits.maxKmlBytes) throw failure('KML_LIMIT','Raw KML exceeds provisional size envelope');
      stage.audit.zipValid=true;stage.audit.safePaths=true;stage.audit.boundedExtraction=true;stage.audit.kmlCount=1;
      kmlBytes=raw;stage.sourcePath='doc.kml';
    }
    cancelled(signal);
    const kml=decodeKml(kmlBytes);
    const parsed=parseKml(kml,{DOMParser,limits});
    cancelled(signal);
    stage.sourceKml=kml;
    stage.documentData=parsed.documentData;
    stage.places=parsed.places;
    stage.audit.safeXml=true;
    stage.audit.allObjectsCount=stage.places.length;
    stage.audit.unhandledFeatures=parsed.unhandledFeatures;
    stage.audit.unknownInformationPreserved=true; // Exact input bytes preserved in rawSource.
  } catch (e) {
    stage.errors.push({code:e.code||'STAGING_FAILED',message:String(e.message||e)});
  }
  // Never expose an auto-apply capability. Caller must diagnose; data remains staging-only.
  return stage;
}
export { DEFAULT_LIMITS };