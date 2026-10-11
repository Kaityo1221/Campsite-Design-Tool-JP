// Run the existing source-freeze gate against canonical LF text on Windows.
// Images remain byte-identical. The original gate and product files are unchanged.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {ROOT}=require('./production-source.cjs');
function verify(){
 const lines=[],processStub={exitCode:0};
 const canonicalFs={existsSync:fs.existsSync,readFileSync(file,encoding){
  if(encoding==='utf8')return fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
  const bytes=fs.readFileSync(file);
  return /\.(?:html|js|mjs|cjs|css|md)$/.test(file)?Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n')):bytes;
 }};
 const file=path.join(ROOT,'creative-next/qa/current-creative-ui-source-parity.cjs');
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{
  __dirname:path.dirname(file),Buffer,process:processStub,
  console:{log:(...args)=>lines.push(args.join(' ')),error:(...args)=>lines.push(args.join(' '))},
  require(name){if(name==='node:fs')return canonicalFs;if(['node:crypto','node:path'].includes(name))return require(name);throw Error('UNEXPECTED_FREEZE_DEPENDENCY');}
 },{filename:file,timeout:3000});
 return{status:processStub.exitCode?'FAIL':'PASS',lines,normalization:'CRLF checkout to canonical LF for text only'};
}
module.exports={verify};
if(require.main===module){const result=verify();for(const line of result.lines)console.log(line);process.exitCode=result.status==='PASS'?0:1;}
