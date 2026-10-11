const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {ROOT}=require('./production-source.cjs');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function fingerprint(){
 const files=[...walk(path.join(ROOT,'creative-next/original-ui-r31')),...walk(__dirname).filter(f=>/\.(cjs|png)$/.test(f)&&!f.includes(path.sep+'artifacts'+path.sep)),...walk(path.join(ROOT,'creative-next/phase-1a/tests')),...walk(path.join(ROOT,'creative-next/phase-1b/test')),...fs.readdirSync(path.join(ROOT,'creative-next/qa')).filter(f=>/\.test\.(mjs|cjs)$/.test(f)).map(f=>path.join(ROOT,'creative-next/qa',f))].filter(f=>!f.endsWith('README.md'));
 const result=files.sort().map(file=>{const bytes=fs.readFileSync(file),canonical=/\.(cjs|mjs|html)$/.test(file)?bytes.toString('utf8').replace(/\r\n/g,'\n'):bytes;return[file.slice(ROOT.length+1).replace(/\\/g,'/'),hash(canonical)];});
 return hash(JSON.stringify(result));
}
module.exports={fingerprint,hash};
