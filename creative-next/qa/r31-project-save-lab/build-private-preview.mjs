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
import {createRequire} from 'node:module';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const dest=path.resolve(process.argv[2]||'');
// Vercel requires outputDirectory inside the checkout. Allow precisely one
// clean, dedicated target and ONLY for a non-production preview build.
// CI and other callers must continue building outside the repository.
const allowedVercelTarget=dest===path.join(repo,'preview-dist')&&
 process.env.VERCEL_ENV==='preview'&&process.env.VERCEL==='1';
if(!process.argv[2]||dest===repo||
   (dest.startsWith(repo+path.sep)&&!allowedVercelTarget)||
   dest===os.homedir()||dest===path.parse(dest).root)
 throw Error('PREVIEW_DESTINATION_OUTSIDE_REPOSITORY_REQUIRED');
if(fs.existsSync(dest))throw Error('PREVIEW_DESTINATION_MUST_BE_NEW');

const entries=[
 'creative-next/qa/r31-project-save-lab/index.html',
 'creative-next/qa/r31-project-save-lab/controller.mjs',
 'creative-next/qa/campsite-return-lab/index.html',
 'creative-next/qa/campsite-return-lab/controller.mjs',
 'creative-next/qa/campsite-distance-import-lab/index.html',
 'creative-next/qa/campsite-distance-import-lab/controller.mjs',
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
// The pair is intentionally synthetic. Never put member or real Wayfarer
// source data into a downloadable GitHub Actions artifact.
const {project,makeKmz}=createRequire(import.meta.url)('../r31-project-save-lab-browser.cjs');
const fixtureDir=path.join(dest,'creative-next/qa/r31-project-save-lab/fixtures');
fs.mkdirSync(fixtureDir,{recursive:true});
const demoProject=Buffer.from(JSON.stringify(project(),null,2)+'\n');
const demoKmz=Buffer.from(await makeKmz());
if(!demoKmz.length||!demoProject.length)throw Error('PREVIEW_SAMPLE_PAIR_EMPTY');
fs.writeFileSync(path.join(fixtureDir,'demo-only-project.json'),demoProject);
fs.writeFileSync(path.join(fixtureDir,'demo-only-new-v1.kmz'),demoKmz);
const landing=`<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Creative Next | PRIVATE LAB</title>
<style>html{font:16px -apple-system,BlinkMacSystemFont,sans-serif;background:#17130f;color:#fff8e7}
body{margin:0 auto;padding:30px 18px;max-width:600px;line-height:1.6}
h1{font-size:24px}a{display:block;margin:12px 0;padding:14px;background:#f7e5b4;color:#342719;
text-align:center;font-weight:800;border-radius:12px;text-decoration:none}
small{color:#ddd2b5}strong{color:#ffde85}</style>
</head><body><h1>🧪 Creative Next 隔離プレビュー</h1>
<p><strong>試験専用・本番保存ではありません。</strong> ここにあるデータは架空のPOIです。個人情報や本物のWayfarerデータをアップロードしないでください。</p>
<p>① サンプルの2ファイルを端末の「ファイル」に保存し、② LABを開いてファイルを選択してください。</p>
<a download="demo-only-project.json" href="./creative-next/qa/r31-project-save-lab/fixtures/demo-only-project.json">①-1 サンプルProject JSON</a>
<a download="demo-only-new-v1.kmz" href="./creative-next/qa/r31-project-save-lab/fixtures/demo-only-new-v1.kmz">①-2 サンプルNEW_V1 KMZ</a>
<a href="./creative-next/qa/r31-project-save-lab/index.html">② r31プロジェクト保存LABへ</a>
<a href="./creative-next/qa/campsite-return-lab/index.html">③ Campsite Project 帰還受信LAB（読取専用）</a>
<a href="./creative-next/qa/campsite-distance-import-lab/index.html">④ Campsite 距離チェック隔離受信（確認・保存・再開 LAB）</a>
<small>保存先はこの試験サイトのIndexedDBだけです。専用オリジンかつアクセス制限のあるテストサイトに配置してください。実機Safari未検証。</small>
</body></html>`;
fs.writeFileSync(path.join(dest,'index.html'),landing,'utf8');
const manifest={
 kind:'r31-project-save-private-preview',productionReady:false,
 requiresDedicatedOrigin:true,requiresAccessProtection:true,autoDeploy:false,
 index:'creative-next/qa/r31-project-save-lab/index.html',
 syntheticFixtures:[{path:'creative-next/qa/r31-project-save-lab/fixtures/demo-only-project.json',bytes:demoProject.length,sha256:sha(demoProject)},{path:'creative-next/qa/r31-project-save-lab/fixtures/demo-only-new-v1.kmz',bytes:demoKmz.length,sha256:sha(demoKmz)}],
 files:[...assets].sort().map(name=>({path:name,bytes:fs.statSync(source(name)).size,sha256:sha(fs.readFileSync(source(name)))}))
};
fs.writeFileSync(path.join(dest,'PREVIEW-MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(JSON.stringify({status:'PASS',kind:manifest.kind,files:manifest.files.length,
  totalBytes:manifest.files.reduce((n,f)=>n+f.bytes,0),productionReady:false,
  requiresDedicatedOrigin:true,requiresAccessProtection:true,autoDeploy:false}));
