// Build-time extraction of approved PRESENTATION expressions only.
// The original IIFE, functions, handlers, stores and renderer scripts are never emitted.
const fs=require('node:fs'),path=require('node:path'),acorn=require('acorn');
const {assemble,scripts,ROOT,digest}=require('./production-source.cjs');
const {analyze}=require('./source-audit.cjs');
function walk(n,visit){if(!n||!n.type)return;visit(n);for(const [k,v]of Object.entries(n)){if(['start','end','loc'].includes(k))continue;if(Array.isArray(v))v.forEach(x=>walk(x,visit));else if(v&&v.type)walk(v,visit);}}
function constant(node){
 if(node.type==='Literal')return node.value;
 if(node.type==='TemplateLiteral'&&!node.expressions.length)return node.quasis.map(q=>q.value.cooked).join('');
 if(node.type==='ArrayExpression')return node.elements.map(constant);
 if(node.type==='ObjectExpression')return Object.fromEntries(node.properties.map(p=>{
  if(p.type!=='Property'||p.computed||p.method||p.kind!=='init')throw Error('NONCONSTANT_PROPERTY');
  const key=p.key.name??p.key.value;if(['__proto__','constructor','prototype'].includes(key))throw Error('FORBIDDEN_KEY');return[key,constant(p.value)];}));
 throw Error('NOT_A_PRESENTATION_CONSTANT: '+node.type);
}
const safeSyntax=new Set(['Literal','Identifier','TemplateLiteral','TemplateElement','BinaryExpression','LogicalExpression','ConditionalExpression','MemberExpression','CallExpression','ArrowFunctionExpression','ArrayPattern','ObjectPattern','Property','ArrayExpression','ObjectExpression','UnaryExpression']);
function checkExpression(node,parameters){
 const allowed=new Set([...parameters,'Object','Math','String','esc']);
 walk(node,n=>{if(n.type==='ArrowFunctionExpression'){if(n.async||n.body.type==='BlockStatement')throw Error('NONPURE_TEMPLATE_CALLBACK');
  for(const p of n.params)walk(p,k=>{if(k.type==='Identifier')allowed.add(k.name);});}});
 walk(node,n=>{
  if(!safeSyntax.has(n.type))throw Error('FORBIDDEN_TEMPLATE_SYNTAX: '+n.type);
  if(((n.type==='Literal'&&typeof n.value==='string')||n.type==='TemplateElement')&&/<(?:script|iframe|object|embed)\b|(?:^|\s)on\w+\s*=|javascript\s*:/i.test(n.type==='TemplateElement'?n.value.cooked:n.value))throw Error('EXECUTABLE_HTML_IN_TEMPLATE');
  if(n.type==='Identifier'&&['window','document','localStorage','sessionStorage','indexedDB','records','polygons','undoStack','redoStack','eval','Function','fetch','L'].includes(n.name))throw Error('LEGACY_TEMPLATE_CAPABILITY: '+n.name);
  if(n.type==='MemberExpression'){
   const key=n.computed&&n.property.type==='Literal'?n.property.value:!n.computed?n.property.name:null;
   if(['constructor','prototype','__proto__','setItem','getItem','push','splice','pop'].includes(key))throw Error('FORBIDDEN_TEMPLATE_MEMBER: '+key);
  }
  if(n.type==='CallExpression'){
   const c=n.callee;
   if(c.type==='Identifier'&&!['esc','String'].includes(c.name))throw Error('UNREVIEWED_TEMPLATE_CALL: '+c.name);
   if(c.type==='MemberExpression'&&!['entries','map','join','max','toFixed','trim','slice'].includes(c.property.name))throw Error('UNREVIEWED_TEMPLATE_METHOD');
  }
 });
 // Lexical free identifiers, including receiver objects, must be declared inputs or pure globals.
 function visit(n,parent,key){
  if(!n||!n.type)return;
  if(n.type==='Identifier'&&!(parent?.type==='MemberExpression'&&key==='property'&&!parent.computed)&&
    !(parent?.type==='Property'&&key==='key'&&!parent.computed)&&!allowed.has(n.name))throw Error('UNBOUND_TEMPLATE_NAME: '+n.name);
  for(const [k,v]of Object.entries(n)){if(['loc','start','end'].includes(k))continue;if(Array.isArray(v))v.forEach(x=>visit(x,n,k));else if(v?.type)visit(v,n,k);}
 }
 visit(node,null,'');
}
async function compile(){
 const source=await assemble(),all=scripts(source.html);
 const core=all.find(s=>s.id==='production-core');if(!core)throw Error('PRODUCTION_CORE_MISSING');
 const parsed=analyze(core.code),proofs=[],templates={};
 const fn=name=>{const f=parsed.functions.find(f=>f.name===name);if(!f)throw Error('SOURCE_FUNCTION_MISSING: '+name);return f;};
 function expressions(name,property,operator='='){
  const f=fn(name),nodes=[];walk(f.node,n=>{if(n.type==='AssignmentExpression'&&n.operator===operator&&n.left.type==='MemberExpression'&&n.left.property.name===property)nodes.push(n.right);});
  return nodes.map(n=>({node:n,code:core.code.slice(n.start,n.end),owner:name}));
 }
 function emit(name,expression,parameters){
  checkExpression(expression.node,parameters);
  templates[name]='('+parameters.join(',')+')=>('+expression.code+')';
  proofs.push({name,sourceFunction:expression.owner,expressionSha256:digest(expression.code),parameters,
   policy:'Pure presentation expression, no assignment/mutation, no legacy/global capability, whitelisted calls only'});
 }
 let types,layerDefs;
 walk(parsed.ast,n=>{if(n.type==='VariableDeclarator'&&n.id.name==='cmTypeInfo')types=constant(n.init);if(n.type==='VariableDeclarator'&&n.id.name==='layerDefs')layerDefs=constant(n.init);});
 if(!types||!layerDefs)throw Error('VIEW_CONSTANTS_MISSING');
 emit('fab',expressions('cmInstallFab','innerHTML')[0],['cmTypeInfo']);
 const sheets=expressions('cmOpenRecord','innerHTML');
 emit('existingSheet',sheets[0],['r','typeLabel']);
 emit('newSheet',sheets[1],['r','typeLabel','warn','cmTypeInfo']);
 emit('moveBar',expressions('cmInstallMoveUi','innerHTML')[0],[]);
 emit('addBarTail',expressions('cmSafeInstallAddBar','innerHTML','+=')[0],[]);
 const selected=fn('cmPhaseCSelectedPoiHtml');let selectedReturn;
 walk(selected.node,n=>{if(n.type==='ReturnStatement')selectedReturn=n.argument;});
 emit('selectedPoi',{node:selectedReturn,code:core.code.slice(selectedReturn.start,selectedReturn.end),owner:selected.name},['meta']);
 emit('saveMenu',expressions('cmOpenSaveMenu','innerHTML')[0],['cmKmzExported']);
 emit('standaloneSave',expressions('cmOpenStandaloneSave','innerHTML')[0],[]);
 emit('list',expressions('cmOpenList','innerHTML')[0],[]);
 emit('coords',expressions('cmOpenCoords','innerHTML')[0],[]);
 const help=all.find(s=>s.id==='cmV59HelpButtonRuntime'),rules=all.find(s=>s.id==='cmV60RulesCarouselRuntime');
 let rulesExpr;walk(acorn.parse(rules.code,{ecmaVersion:'latest'}),n=>{if(n.type==='AssignmentExpression'&&n.left.property?.name==='innerHTML')rulesExpr=n.right;});
 emit('rules',{node:rulesExpr,code:rules.code.slice(rulesExpr.start,rulesExpr.end),owner:rules.id},[]);


 const recordIcon=fn('recordIcon');
 walk(recordIcon.node,n=>{
  if(n.type==='ReturnStatement'&&n.argument?.type==='CallExpression'&&n.argument.callee?.property?.name==='icon')
   emit('newIconOptions',{node:n.argument.arguments[0],code:core.code.slice(n.argument.arguments[0].start,n.argument.arguments[0].end),owner:'recordIcon'},['iconUrl']);
  if(n.type==='ReturnStatement'&&n.argument?.type==='CallExpression'&&n.argument.callee?.property?.name==='divIcon')
   emit('existingIconOptions',{node:n.argument.arguments[0],code:core.code.slice(n.argument.arguments[0].start,n.argument.arguments[0].end),owner:'recordIcon'},['shape']);
 });
 const activityRules=all.find(s=>s.id==='cmV77ActivityRuleInstall');let activityExpr;
 walk(acorn.parse(activityRules.code,{ecmaVersion:'latest'}),n=>{if(n.type==='AssignmentExpression'&&n.left.property?.name==='innerHTML')activityExpr=n.right;});
 emit('activityRule',{node:activityExpr,code:activityRules.code.slice(activityExpr.start,activityExpr.end),owner:activityRules.id},[]);


 for(const [name,owner,parameters]of [['addCircleOptions','cmSafeEnsureAddCircle',['cmSafeAddRadius','circleRenderer']],['moveCircleOptions','cmBeginMove',['circleRenderer']]]){
  const f=fn(owner);let options;
  walk(f.node,n=>{if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.object.name==='L'&&n.callee.property.name==='circle')options=n.arguments[1];});
  emit(name,{node:options,code:core.code.slice(options.start,options.end),owner},parameters);
 }
 const coordinate=scripts(source.html).find(s=>s.id==='cmV51CoordinateJumpRuntime');
 const coordinateParsed=analyze(coordinate.code),ensure=coordinateParsed.functions.find(f=>f.name==='ensurePanel');
 let coordinateHtml;walk(ensure.node,n=>{if(n.type==='AssignmentExpression'&&n.left.property?.name==='innerHTML')coordinateHtml=n.right;});
 emit('coordinatePanel',{node:coordinateHtml,code:coordinate.code.slice(coordinateHtml.start,coordinateHtml.end),owner:coordinate.id+'.ensurePanel'},[]);
 const bind=coordinateParsed.functions.find(f=>f.name==='bindBar');let coordinateButton={tag:'button',properties:{},attributes:{},sourceFunction:coordinate.id+'.bindBar'};
 walk(bind.node,n=>{
  if(n.type==='AssignmentExpression'&&n.left.object?.name==='button'&&['type','className','textContent'].includes(n.left.property.name))coordinateButton.properties[n.left.property.name]=constant(n.right);
  if(n.type==='CallExpression'&&n.callee.object?.name==='button'&&n.callee.property.name==='setAttribute')coordinateButton.attributes[constant(n.arguments[0])]=constant(n.arguments[1]);
 });


 const lever=fn('cmSafeLeverOffset');let leverReturn;
 walk(lever.node,n=>{if(n.type==='ReturnStatement')leverReturn=n.argument;});
 emit('leverOffset',{node:leverReturn,code:core.code.slice(leverReturn.start,leverReturn.end),owner:'cmSafeLeverOffset'},['r']);

 const descriptors={coordinateButton};
 for(const name of ['cmInstallFab','cmSafeAddDotElement','cmMoveCrosshairElement','cmSafeEnsureNearestWarning','cmInstallCount','cmInstallStandaloneSave']){
  const f=fn(name),created=new Map();
  walk(f.node,n=>{
   if(n.type==='VariableDeclarator'&&n.id.type==='Identifier'&&n.init?.type==='CallExpression'&&n.init.callee.property?.name==='createElement')
    created.set(n.id.name,{tag:constant(n.init.arguments[0]),properties:{},attributes:{},sourceFunction:name});
   if(n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&n.left.object.type==='Identifier'&&created.has(n.left.object.name)&&['id','className','type','textContent','title'].includes(n.left.property.name)){
    try{created.get(n.left.object.name).properties[n.left.property.name]=constant(n.right);}catch{}
   }
   if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.object.type==='Identifier'&&created.has(n.callee.object.name)&&n.callee.property.name==='setAttribute'){
    try{created.get(n.callee.object.name).attributes[constant(n.arguments[0])]=constant(n.arguments[1]);}catch{}
   }
  });
  const result=[...created.values()].find(d=>d.properties.id);if(!result)throw Error('SOURCE_DESCRIPTOR_MISSING: '+name);
  descriptors[name]=result;
 }
 emit('addDot',expressions('cmSafeAddDotElement','innerHTML')[0],[]);
 emit('moveCrosshair',expressions('cmMoveCrosshairElement','innerHTML')[0],[]);

 const dynamicStyles=[];
 for(const name of ['cmAddStyle','cmInstallLayerTapStyle']){
  const f=fn(name);let id,css;walk(f.node,n=>{
   if(n.type==='AssignmentExpression'&&n.left.property?.name==='id')id=constant(n.right);
   if(n.type==='AssignmentExpression'&&n.left.property?.name==='textContent')css=constant(n.right);
  });
  if(!id||!css)throw Error('DYNAMIC_STYLE_MISSING: '+name);
  dynamicStyles.push({id,css,sourceFunction:name,sha256:digest(css)});
 }
 const safeHtml=source.html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi,'');
 if(/<script\b|\bon\w+\s*=/i.test(safeHtml))throw Error('EXECUTABLE_SOURCE_ESCAPED');
 const templateModule="// Generated original presentation expressions only; never edit by hand.\n"+
  "export const types=Object.freeze("+JSON.stringify(types)+");\nexport const layerDefs="+JSON.stringify(layerDefs)+";\n"+
  "export const dynamicStyles="+JSON.stringify(dynamicStyles)+";\nexport const descriptors="+JSON.stringify(descriptors)+";\n"+
  "const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#039;'}[c]));\n"+
  Object.entries(templates).map(([k,v])=>'export const '+k+'='+v+';').join('\n')+'\n';
 const html=safeHtml.replace('<head>','<head><base href="../../creative/">').replace('</body>',
  '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>'+
  '<script type="module" src="../creative-next/original-ui-r31/ui-runtime.mjs"></script></body>');
 return{html,templateModule,proofs,manifest:{patchCount:source.names.length,patchOrder:source.names,documentSha256:digest(source.html),
  originalFunctionsExecuted:0,unprovenFunctionsAllowed:0,legacyScriptsEmitted:0,types,descriptors,dynamicStyles:dynamicStyles.map(({css,...rest})=>rest),templates:proofs,
  runtimeMode:'PART_A_VIEW_ONLY',partB:'NOT_CONNECTED',completeGate:'HOLD_UNTIL_FULL_RUNTIME_COMPARISON'}};
}
async function build(){
 const x=await compile(),out=path.join(ROOT,'creative-next/original-ui-r31');
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'index.html'),x.html);
 fs.writeFileSync(path.join(out,'source-templates.mjs'),x.templateModule);
 fs.writeFileSync(path.join(__dirname,'ui-extraction-manifest.json'),JSON.stringify(x.manifest,null,2)+'\n');
 console.log('Built original source UI expressions: '+x.proofs.length+', legacy/unproven functions executed: 0');
 return x;
}
module.exports={compile,build,checkExpression,constant};
if(require.main===module)build().catch(e=>{console.error(e);process.exitCode=1;});
