// Conservative dependency audit. A clean audit is NOT a UI equivalence proof.
const fs=require('node:fs'),path=require('node:path'),acorn=require('acorn');
const {ROOT,assemble,scripts,digest}=require('./production-source.cjs');
function walk(node,visit){
 if(!node||typeof node.type!=='string')return;visit(node);
 for(const [key,value] of Object.entries(node)){
  if(['loc','start','end'].includes(key))continue;
  if(Array.isArray(value)){for(const child of value)walk(child,visit);}
  else if(value&&typeof value.type==='string')walk(value,visit);
 }
}
function textName(node){
 if(!node)return'';
 if(node.type==='Identifier')return node.name;
 if(node.type==='MemberExpression')return textName(node.object)+'.'+(node.computed?'*':textName(node.property));
 return'';
}
function analyze(code){
 const ast=acorn.parse(code,{ecmaVersion:'latest',sourceType:'script',locations:true});
 const functions=[];
 walk(ast,node=>{
  if(node.type==='FunctionDeclaration'&&node.id)functions.push({name:node.id.name,node,code:code.slice(node.start,node.end)});
  if(node.type==='AssignmentExpression'&&['FunctionExpression','ArrowFunctionExpression'].includes(node.right.type))
   functions.push({name:textName(node.left)||'anonymous-assignment',node:node.right,code:code.slice(node.right.start,node.right.end)});
 });
 return{ast,functions};
}
function effects(fn){
 const reasons=new Set(),calls=new Set(),ui=new Set();
 walk(fn.node,node=>{
  if(node.type==='CallExpression'||node.type==='NewExpression'){
   const name=textName(node.callee);
   if(name)calls.add(name);
   if(/(?:^|\.)(?:localStorage|sessionStorage|indexedDB)(?:\.|$)/.test(name))reasons.add('LEGACY_PERSISTENCE');
   if(/^(?:snapshot|restore|cmPersistCurrent|cmReadCurrent|cmReadHistory|cmArchive\w*|cmMigrateLegacyStore|cmLoadWorkspace)$/.test(name))reasons.add('LEGACY_PERSISTENCE');
   if(/^(?:pushHistory|undo|redo|hist)$/.test(name))reasons.add('LEGACY_HISTORY');
   if(/^(?:parse|readFile|loadCsvFiles|buildMyMapsKml|exportKmz)$/.test(name))reasons.add('LEGACY_KMZ');
   if(/^(?:drawAll|drawRecord|renderRecordCircles|drawPolygons|refresh)$/.test(name)||/^L\.(?:map|marker|circle|polygon|layerGroup|tileLayer)$/.test(name))reasons.add('LEGACY_MAP_RENDER');
   if(/(?:^|\.)(?:setInterval|setTimeout)$/.test(name))reasons.add('TIMER_REQUIRES_TEARDOWN');
   if(/(?:^|\.)(?:addEventListener|observe)$/.test(name)||/MutationObserver$/.test(name))reasons.add('LISTENER_REQUIRES_TEARDOWN');
   if(/^(?:records|polygons|undoStack|redoStack)\.(?:push|splice|pop|shift|unshift)$/.test(name))reasons.add('LEGACY_DATA_WRITE');
   if(/(?:^|\.)(?:createElement|append|appendChild|insertBefore)$/.test(name))ui.add('DYNAMIC_DOM');
  }
  if(['AssignmentExpression','UpdateExpression'].includes(node.type)){
   const name=textName(node.left||node.argument);
   if(/^(?:records|polygons|undoStack|redoStack)(?:\.|$)/.test(name)||/\.(?:title|memo|deleted|layer|latlng|points|creativeSeq|autoName|applicationComment|applicationCommentNeedsReview)$/.test(name))reasons.add('LEGACY_DATA_WRITE');
   if(/\.(?:innerHTML|textContent|className|id)$/.test(name))ui.add('DOM_OR_STYLE_WRITE');
  }
 });
 return{reasons:[...reasons].sort(),calls:[...calls].sort(),ui:[...ui].sort()};
}
async function audit(){
 const source=await assemble(),provenance=new Map(),versions=new Map();
 // Registration wrappers report the actual transformation outputs in production order.
 for(const stage of source.stages){
  for(const script of scripts(stage.html).filter(s=>!s.src&&s.code.trim())){
   const parsed=analyze(script.code);
   for(const fn of parsed.functions){
    const key=script.id+':'+fn.name,hash=digest(fn.code);
    if(versions.get(key)!==hash){versions.set(key,hash);provenance.set(key,stage.source);}
   }
  }
 }
 const definitions=[],externalScripts=[];
 for(const script of scripts(source.html)){
  if(script.src){externalScripts.push({scriptId:script.id,src:script.src});continue;}
  if(!script.code.trim())continue;
  for(const fn of analyze(script.code).functions){
   const e=effects(fn);
   definitions.push({name:fn.name,scriptId:script.id,line:fn.node.loc.start.line,htmlLine:script.htmlLine+fn.node.loc.start.line-1,
    source:provenance.get(script.id+':'+fn.name)||'creative/base-v7.html',sha256:digest(fn.code),...e});
  }
 }
 const byName=new Map();
 for(const d of definitions){if(!byName.has(d.name))byName.set(d.name,[]);byName.get(d.name).push(d);}
 for(const d of definitions){
  const visited=new Set(),pending=[d],transitive=new Set(d.reasons);
  while(pending.length){const next=pending.pop();if(visited.has(next))continue;visited.add(next);
   for(const reason of next.reasons)transitive.add(reason);
   for(const name of next.calls)pending.push(...(byName.get(name)||[]));
  }
  d.transitiveReasons=[...transitive].sort();
  d.classification=d.ui.length&&d.transitiveReasons.length?'MIXED_UI_REQUIRES_SEPARATION':d.transitiveReasons.length?'EFFECTFUL_REQUIRES_REVIEW':'UNPROVEN';
 }
 const mixed=definitions.filter(d=>d.classification==='MIXED_UI_REQUIRES_SEPARATION');
 return{status:'HOLD',partA:'NOT_PASSED',partB:'NOT_STARTED',baseline:'2d9f0c472a0263fd4b68044b76bb2a80bb265289',
  patchCount:source.names.length,patchOrder:source.names,inputs:source.inputs,
  documentSha256:digest(source.html),definitions,externalScripts,
  blockers:mixed.map(d=>({name:d.name,source:d.source,scriptId:d.scriptId,line:d.line,reasons:d.transitiveReasons})),
  limitations:['Conservative static analysis; aliases, closure side effects and dynamic calls require manual review.',
   'UNPROVEN does not authorize execution; no UI-only compiler or r31 runtime has been approved by this gate.',
   'No application script is executed by this audit. No browser storage or user data is accessed.',
   'Production authentication and all Bridge-only registrars are excluded.']
 };
}
module.exports={audit,analyze,effects};
if(require.main===module)audit().then(result=>{
 const output=path.join(ROOT,'creative-next/qa/r31/source-inventory.json');
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:result.status,patches:result.patchCount,definitions:result.definitions.length,mixed:result.blockers.length,output}));
 process.exitCode=2;
}).catch(error=>{console.error(error);process.exitCode=1});
