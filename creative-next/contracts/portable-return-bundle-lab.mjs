/*
 * Portable Creative Next -> Campsite Return pair transfer. EXPERIMENTAL LAB.
 * Explicit user download and file upload only. Never network-send data or
 * write to production, legacy Project keys or the receiver's IndexedDB.
 * A ZIP container is a transport candidate, NOT an approved KMZ extension.
 */
import {createLinkedPairLab,reopenLinkedPairLab} from './linked-project-kmz-lab.mjs';
import {inspectCampsiteReturnLab} from './campsite-return-receiver-lab.mjs';

const KIND='campsite-creative-next-portable-return-LAB';
const VERSION=0,PROJECT_FILE='linked-pair.json',KMZ_FILE='creative-new-v1.kmz';
const MAX_ARCHIVE=16*1024*1024,MAX_MANIFEST=9*1024*1024,MAX_KMZ=8*1024*1024;
const hold=code=>{const e=new Error(code);e.code=code;throw e;};
const validId=x=>typeof x==='string'&&x.trim().length>0&&x.length<=128;
function deps({JSZip,DOMParser,cryptoProvider}){
 if(!JSZip?.loadAsync||typeof JSZip!=='function'||!DOMParser||!cryptoProvider?.subtle?.digest)
  hold('PORTABLE_DEPS_REQUIRED');
 return {JSZip,DOMParser,cryptoProvider};
}
function checkedArchive(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<30||bytes.length>MAX_ARCHIVE)
  hold('PORTABLE_ARCHIVE_SIZE');
 return bytes;
}
function archiveEntries(zip){
 const entries=Object.entries(zip.files);
 if(entries.length!==2||entries.some(([name,f])=>f.dir||!([PROJECT_FILE,KMZ_FILE].includes(name))))
  hold('PORTABLE_FILES_INVALID');
 return zip;
}
async function readBounded(zip,name,max){
 const f=zip.file(name);
 if(!f||f.dir||typeof f._data?.uncompressedSize!=='number'||
    f._data.uncompressedSize>max)hold('PORTABLE_CONTENT_SIZE');
 let bytes;
 try{bytes=await f.async('uint8array');}
 catch{hold('PORTABLE_CONTENT_INVALID');}
 if(bytes.length>max||bytes.length===0)hold('PORTABLE_CONTENT_SIZE');
 return bytes;
}
export async function createPortableReturnBundleLab({
 project,activityAreas,kmzBytes,expectedProjectId,expectedHandoffId,
 revision,JSZip,DOMParser,cryptoProvider=globalThis.crypto
}={}){
 const d=deps({JSZip,DOMParser,cryptoProvider});
 if(!validId(expectedProjectId)||!validId(expectedHandoffId)||
    !Number.isSafeInteger(revision)||revision<1)hold('PORTABLE_IDENTITY_REQUIRED');
 if(!(kmzBytes instanceof Uint8Array)||kmzBytes.length>MAX_KMZ)
  hold('PORTABLE_CONTENT_SIZE');
 // Check the full source conservation/lineage and create canonical hash manifest
 // before a package byte is generated. No mutation of input objects/bytes.
 await inspectCampsiteReturnLab({project,activityAreas,kmzBytes,
  expectedProjectId,expectedHandoffId,...d});
 const pair=await createLinkedPairLab({project,activityAreas,kmzBytes,
  expectedProjectId,expectedHandoffId,...d});
 const envelope=JSON.stringify({kind:KIND,version:VERSION,revision,
  manifest:pair.manifest});
 if(new TextEncoder().encode(envelope).length>MAX_MANIFEST)hold('PORTABLE_CONTENT_SIZE');
 const zip=new JSZip();
 zip.file(PROJECT_FILE,envelope);
 zip.file(KMZ_FILE,new Uint8Array(pair.kmzBytes),{binary:true});
 const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE',
  compressionOptions:{level:6},streamFiles:false});
 checkedArchive(bytes);
 return Object.freeze({status:'LAB_PORTABLE_RETURN_CREATED',productionReady:false,
  writeAllowed:false,transportAuthenticated:false,producerIdentityVerified:false,
  revision,bytes:new Uint8Array(bytes)});
}
export async function inspectPortableReturnBundleLab({
 bytes,expectedProjectId,expectedHandoffId,
 JSZip,DOMParser,cryptoProvider=globalThis.crypto
}={}){
 const d=deps({JSZip,DOMParser,cryptoProvider});
 if(!validId(expectedProjectId)||!validId(expectedHandoffId))hold('PORTABLE_IDS_REQUIRED');
 checkedArchive(bytes);
 let zip;
 try{zip=await JSZip.loadAsync(bytes,{checkCRC32:true,createFolders:false});}
 catch{hold('PORTABLE_ZIP_INVALID');}
 archiveEntries(zip);
 const manifestBytes=await readBounded(zip,PROJECT_FILE,MAX_MANIFEST);
 const kmz=await readBounded(zip,KMZ_FILE,MAX_KMZ);
 let envelope;
 try{envelope=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes));}
 catch{hold('PORTABLE_MANIFEST_INVALID');}
 if(!envelope||envelope.kind!==KIND||envelope.version!==VERSION||
    !Number.isSafeInteger(envelope.revision)||envelope.revision<1||
    !envelope.manifest||typeof envelope.manifest!=='object')hold('PORTABLE_FORMAT_HOLD');
 if(envelope.manifest.projectId!==expectedProjectId||
    envelope.manifest.handoffId!==expectedHandoffId)hold('PORTABLE_IDENTITY_MISMATCH');
 const verified=await reopenLinkedPairLab({pair:{manifest:envelope.manifest,kmzBytes:kmz},
  expectedProjectId,expectedHandoffId,...d});
 const ready=await inspectCampsiteReturnLab({project:verified.project,
  activityAreas:verified.activityAreas,kmzBytes:verified.kmzBytes,
  expectedProjectId,expectedHandoffId,...d});
 return Object.freeze({status:'LAB_PORTABLE_RETURN_VERIFIED',productionReady:false,
  writeAllowed:false,transportAuthenticated:false,producerIdentityVerified:false,
  revision:envelope.revision,summary:ready.summary,
  project:ready.project,activityAreas:ready.activityAreas,kmzBytes:ready.kmzBytes});
}
