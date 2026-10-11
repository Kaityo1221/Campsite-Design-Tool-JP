// QA only: assemble the exact NORMAL production document, without executing its app.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../../..');
const digest=text=>crypto.createHash('sha256').update(text).digest('hex');
// Match canonical Git-served text; Windows checkout CRLF is not product drift.
const readSource=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
function patchOrder(root=ROOT){
 const entry=readSource(path.join(root,'creative/index.html'));
 const match=entry.match(/const PATCH_FILES=(\[[^;]+\]);/);
 if(!match)throw Error('PATCH_FILES_NOT_FOUND');
 const names=JSON.parse(match[1]);
 if(!Array.isArray(names)||new Set(names).size!==names.length||names.some(n=>!/^creative-patches-[\w-]+\.js$/.test(n)))throw Error('INVALID_PATCH_ORDER');
 return names;
}
async function assemble(root=ROOT){
 const stages=[],inputs=[],names=patchOrder(root);
 let registered=s=>s,registering='';
 const window={};
 Object.defineProperty(window,'applyCreativePatches',{
  get:()=>registered,set(fn){
   if(typeof fn!=='function')throw Error('INVALID_PATCH_REGISTRAR');
   const source=registering;
   registered=src=>{const result=fn(src);if(typeof result!=='string')throw Error('INVALID_TRANSFORMATION');
    stages.push({source,html:result});return result;};
  }
 });
 const sandbox=vm.createContext({window,console:{warn(){},log(){},error(){}}});
 for(const name of names){
  const relative='creative/runtime/'+name;
  const code=readSource(path.join(root,relative));
  inputs.push({source:relative,sha256:digest(code)});
  registering=relative;
  vm.runInContext(code,sandbox,{filename:relative,timeout:3000});
 }
 const jp='creative/jp-creative-patch.js',jpSource=readSource(path.join(root,jp));
 inputs.push({source:jp,sha256:digest(jpSource)});
 vm.runInContext(jpSource,sandbox,{filename:jp,timeout:3000});
 if(typeof window.applyCreativeJpPatch!=='function')throw Error('JP_REGISTRAR_MISSING');
 const base='creative/base-v7.html',runtime='creative/runtime/runtime-vnext.html';
 const baseHtml=readSource(path.join(root,base)),runtimeHtml=readSource(path.join(root,runtime));
 for(const [source,code] of [[base,baseHtml],[runtime,runtimeHtml],['creative/index.html',readSource(path.join(root,'creative/index.html'))]])
  inputs.push({source,sha256:digest(code)});
 const script=runtimeHtml.match(/<body><script>([\s\S]*)<\/script><\/body>/)?.[1];
 if(!script)throw Error('RUNTIME_TRANSFORM_NOT_FOUND');
 stages.push({source:base,html:baseHtml});
 let output=null,fetches=0;
 const context=vm.createContext({
  fetch:async url=>{if(url!=='./base-v7.html')throw Error('UNEXPECTED_BUILD_FETCH');fetches++;return{ok:true,text:async()=>baseHtml};},
  document:{open(){},close(){},body:{set textContent(value){throw Error('RUNTIME_ASSEMBLY_FAILED: '+value);}},
   write(html){
    stages.push({source:runtime,html});
    html=window.applyCreativePatches(html);
    html=window.applyCreativeJpPatch(html);
    stages.push({source:jp,html});
    // Normal path in creative/index.html; Bridge hooks are deliberately absent.
    const oldMain='https://raw.githubusercontent.com/Kaityo1221/campsite-design-tool-adv-lab/main/creative/runtime/assets/creative-mode-opening.png';
    const oldPinned='https://raw.githubusercontent.com/Kaityo1221/campsite-design-tool-adv-lab/1c27ca3ef14f423688f755d350ecc602bee1c573/creative/runtime/assets/creative-mode-opening.png';
    const stable='https://media.githubusercontent.com/media/Kaityo1221/campsite-design-tool-adv-lab/1c27ca3ef14f423688f755d350ecc602bee1c573/creative/runtime/assets/creative-mode-opening.png';
    html=html.split(oldMain).join(stable).split(oldPinned).join(stable);
    html=html.replace(/<input\b[^>]*\bid=["']entryFile["'][^>]*>/i,m=>m.replace(/\saccept\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i,''));
    html=html.replace('entryFile.onchange=()=>{',"entryFile.removeAttribute('accept');entryFile.accept='';entryFile.onchange=()=>{");
    output=html;
   }
  }
 });
 await vm.runInContext(script,context,{filename:runtime,timeout:3000});
 if(fetches!==1||typeof output!=='string')throw Error('ASSEMBLY_NOT_CAPTURED');
 return{html:output,names,inputs,stages};
}
function scripts(html){
 return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map((m,i)=>({
  index:i,id:m[1].match(/\bid=["']([^"']+)/)?.[1]||(m[2].includes('const STORE=')?'production-core':'anonymous-'+digest(m[2].trim().slice(0,120)).slice(0,12)),
  src:m[1].match(/\bsrc=["']([^"']+)/)?.[1]||null,code:m[2],
  htmlLine:html.slice(0,m.index).split('\n').length
 }));
}
module.exports={ROOT,digest,patchOrder,assemble,scripts};
