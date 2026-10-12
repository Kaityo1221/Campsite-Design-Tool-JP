/*
 * Builds a deployable STATIC LAB snapshot, with an allowlisted dependency
 * closure and no repo-root/public-site files. NEVER deploy this automatically.
 * For a dedicated origin protected by the preview host, not the prod origin.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const dest=path.resolve(process.argv[2]||'');
if(!process.argv[2]||dest===repo||dest.startsWith(repo+path.sep)||
   dest===os.homedir()||dest===path.parse(dest).root)
 throw Error('PREVIEW_DESTINATION_OUTSIDE_REPOSITORY_REQUIRED');
if(fs.existsSync(dest))throw Error('PREVIEW_DESTINATION_MUST_BE_NEW');

const entries=[
 'creative-next/qa/r31-project-save-lab/index.html',
 'creative-next/qa/r31-project-save-lab/controller.mjs',
 'creative-next/original-ui-r31-b3-b4/index.html',
 'creative-next/original-ui-r31-b3-b4/bootstrap.mjs',
 'creative-next/phase-2-preview/vendor/jszip.min.js',
 'creative/assets/pokestop.png','creative/assets/gym.png','creative/assets/powerspot.png'
];
const assets=new Set(entries),visited=new Set();
const sha=data=>createHash('sha256').update(data).digest('hex');
const normalize=p=>p.split(path.sep).join('/');
const allowed=p=>p.startsWith('creative-next/')||
  ['creative/assets/pokestop.png','creative/assets/gym.png','creative/assets/powerspot.png'].includes(p);
function source(name){
 if(!allowed(name)||name.includes('..')||path.posix.isAbsolute(name))
  throw Error('PREVIEW_SOURCE_NOT_ALLOWLISTED:'+name);
 const full=path.resolve(repo,name);
 if(!full.startsWith(repo+path.sep))throw Error('PREVIEW_TRAVERSAL');
 const stat=fs.lstatSync(full);
 if(!stat.isFile()||stat.isSymbolicLink())throw Error('PREVIEW_SOURCE_NOT_REGULAR_FILE:'+name);
 return full;
}
function visit(name){
 name=normalize(name);
 if(visited.has(name))return;
 visited.add(name);
 const full=source(name);
 const ext=path.extname(name);
 if(!['.js','.mjs'].includes(ext))return;
 const text=fs.readFileSync(full,'utf8');
 const re=/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"]((?:\.\/|\.\.\/)[^'"?#]+)['"]/g;
 for(const match of text.matchAll(re)){
  const imported=match[1];
  const relative=path.posix.normalize(path.posix.join(path.posix.dirname(name),imported));
  if(!relative.startsWith('creative-next/'))throw Error('PREVIEW_IMPORT_OUTSIDE_SCOPE:'+name+' '+relative);
  if(!['.mjs','.js','.json','.css'].includes(path.extname(relative)))
   throw Error('PREVIEW_UNSUPPORTED_IMPORT:'+relative);
  assets.add(relative);
  visit(relative);
 }
}
entries.forEach(visit);
for(const file of [...assets].sort()){
 const full=source(file),target=path.join(dest,file);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.copyFileSync(full,target);
}
const landing=`<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta http-equiv="refresh" content="0;url=./creative-next/qa/r31-project-save-lab/index.html">
<title>Creative Next isolated LAB</title></head><body>
<p>本番とは別の試験用サイトです。<a href="./creative-next/qa/r31-project-save-lab/index.html">隔離LABへ進む</a></p>
</body></html>`;
fs.writeFileSync(path.join(dest,'index.html'),landing,'utf8');
const manifest={
 kind:'r31-project-save-private-preview',productionReady:false,
 requiresDedicatedOrigin:true,requiresAccessProtection:true,autoDeploy:false,
 index:'creative-next/qa/r31-project-save-lab/index.html',
 files:[...assets].sort().map(name=>({path:name,bytes:fs.statSync(source(name)).size,sha256:sha(fs.readFileSync(source(name)))}))
};
fs.writeFileSync(path.join(dest,'PREVIEW-MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(JSON.stringify({status:'PASS',kind:manifest.kind,files:manifest.files.length,
  totalBytes:manifest.files.reduce((n,f)=>n+f.bytes,0),productionReady:false,
  requiresDedicatedOrigin:true,requiresAccessProtection:true,autoDeploy:false}));
