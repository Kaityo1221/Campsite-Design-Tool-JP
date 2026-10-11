const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const guard=fs.readFileSync(path.join(__dirname,'../original-ui-r26/r26-ios-tap-guard.js'),'utf8');
function harness(){
 let clock=1000;
 const registry=new Map();
 const document={
  addEventListener(type,fn,options){registry.set(type,{fn,options})},
  removeEventListener(type,fn){if(registry.get(type)?.fn===fn)registry.delete(type)}
 };
 const window={};
 class Clock extends Date {static now(){return clock}}
 vm.runInNewContext(guard,{window,document,Date:Clock,Math,Object}, {filename:'r26-ios-tap-guard.js'});
 const control={disabled:false,closest:()=>control};
 const another={disabled:false,closest:()=>another};
 function emit(type,el,x=80,y=150){
  const touch={clientX:x,clientY:y};
  const e={target:el,cancelable:true,touches:type==='touchstart'||type==='touchmove'?[touch]:[],
   changedTouches:type==='touchend'?[touch]:[],prevented:false,preventDefault(){this.prevented=true}};
  registry.get(type).fn(e);
  return e;
 }
 return {registry,window,control,another,emit,advance(ms){clock+=ms}};
}
test('iOS second tap on same original control is cancelled before Safari smart zoom',()=>{
 const h=harness();
 assert.equal(h.registry.get('touchstart').options.passive,false);
 assert.equal(h.registry.get('touchend').options.passive,false);
 assert.equal(h.emit('touchstart',h.control).prevented,false);
 assert.equal(h.emit('touchend',h.control).prevented,false);
 h.advance(180);
 assert.equal(h.emit('touchstart',h.control).prevented,true);
 assert.equal(h.emit('touchend',h.control).prevented,true);
 assert.equal(h.window.creativeR26TapGuard.status().secondTapsBlocked,1);
});
test('different map control, far away or slow follow-up are not swallowed',()=>{
 for(const mode of ['other','far','slow']){
  const h=harness();
  h.emit('touchstart',h.control);h.emit('touchend',h.control);
  h.advance(mode==='slow'?550:150);
  const next=h.emit('touchstart',mode==='other'?h.another:h.control,mode==='far'?180:80);
  assert.equal(next.prevented,false,mode);
 }
});
test('a drag and disposal do not leave stuck touch handlers',()=>{
 const h=harness();
 h.emit('touchstart',h.control);
 h.emit('touchmove',h.control,180,150);
 h.emit('touchend',h.control,180,150);
 h.advance(100);
 assert.equal(h.emit('touchstart',h.control).prevented,false);
 h.window.creativeR26TapGuard.dispose();
 assert.equal(h.registry.size,0);
});
