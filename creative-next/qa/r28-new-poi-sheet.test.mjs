import test from 'node:test';
import assert from 'node:assert/strict';
import {createOriginalNewPoiSheet} from '../integration/creative-next-original-new-poi-sheet.mjs';
function node(tag){
 const el={tagName:tag,className:'',id:'',textContent:'',value:'',maxLength:0,title:'',type:'',dataset:{},events:{},children:[],removed:false,
  classList:{values:new Set(),add(key){this.values.add(key)},remove(key){this.values.delete(key)},toggle(key){if(this.values.has(key)){this.values.delete(key);return false;}this.values.add(key);return true;}},
  setAttribute(k,v){this[k]=v},
  append(...els){this.children.push(...els);for(const item of els)item.parentNode=this},
  remove(){this.removed=true;},
  addEventListener(type,fn){this.events[type]=fn},
  click(){this.events.click?.()},
  querySelector(selector){if(selector[0]==='.')return find(this,x=>x.className.split(/\\s+/).includes(selector.slice(1)));return null;}
 };
 return el;
}
function find(el,predicate){if(predicate(el))return el;for(const x of el.children){const result=find(x,predicate);if(result)return result;}return null;}
function byId(el,id){return find(el,x=>x.id===id)}
function mkPoi({id='n1',role='new',kind='pokestop'}={}){return {id,role,kind,title:'PokéStop 10',memo:'',deleted:false,lat:35.7,lng:139.8}}
function harness(poi=mkPoi()){
 const body=node('body'),commands=[],messages=[],moves=[];
 const records=[poi];let redraws=0;
 const session={state:()=>({records}),command(command,{confirmed}){
  commands.push({command,confirmed});
  if(!confirmed)return {ok:false,changed:false};
  const p=records.find(r=>r.id===command.id);
  if(!p)return {ok:false,changed:false};
  if(command.type==='edit')Object.assign(p,command.patch);
  if(command.type==='delete')p.deleted=true;
  if(command.type==='change-kind')p.kind=command.kind;
  return {ok:true,changed:true};
 }};
 const document={body,createElement:node};
 const sheet=createOriginalNewPoiSheet({document,map:{},session,onChanged(){redraws++},onMessage:s=>messages.push(s),onMoveRequest:id=>moves.push(id),confirm:()=>true});
 return {body,records,commands,messages,moves,sheet,get redraws(){return redraws},get panel(){return body.children.filter(n=>!n.removed).at(-1)}};
}
test('new POI uses production lower sheet with 30/50 maxlength and exactly three actions',()=>{
 const h=harness();assert.equal(h.sheet.show('n1'),true);
 const s=h.panel;assert.equal(s.className,'cm-sheet');
 assert.equal(byId(s,'cmName').maxLength,30);assert.equal(byId(s,'cmMemo').maxLength,50);
 assert.equal(s.children.some(x=>x.className==='cm-actions'),true);
 const actions=s.children.find(x=>x.className==='cm-actions');
 assert.deepEqual(actions.children.map(x=>x.textContent),['移動','種類変更','削除']);
 assert.equal(h.commands.length,0);
});
test('existing POIs render as read-only and never dispatch edit',()=>{
 const h=harness(mkPoi({id:'old',role:'existing'}));assert.equal(h.sheet.show('old'),true);
 assert.equal(byId(h.panel,'cmName'),null);
 assert.equal(byId(h.panel,'cmDelete'),null);
 assert.equal(find(h.panel,x=>x.className==='cm-existing-readonly').textContent,'既存POI（閲覧のみ）');
 assert.equal(h.sheet.close(),true);assert.equal(h.commands.length,0);
});
test('closing after name and memo inputs records only one undoable edit command',()=>{
 const h=harness();h.sheet.show('n1');
 byId(h.panel,'cmName').value='新規スポット';byId(h.panel,'cmMemo').value='メモ更新';
 assert.equal(h.commands.length,0);
 assert.equal(h.sheet.close(),true);
 assert.equal(h.commands.length,1);
 assert.deepEqual(h.commands[0],{command:{type:'edit',id:'n1',patch:{title:'新規スポット',memo:'メモ更新'}},confirmed:true});
 assert.equal(h.redraws,1);
});
test('moving a new POI commits draft first, then enters map move tool',()=>{
 const h=harness();h.sheet.show('n1');
 byId(h.panel,'cmName').value='移動テスト';
 const panel=h.panel,move=find(panel,x=>x.textContent==='移動'&&x.tagName==='button');
 move.click();assert.equal(h.commands.length,1);assert.deepEqual(h.moves,['n1']);assert.equal(panel.removed,true);
});
test('kind change and deletion stay exclusively on new POI commands',()=>{
 const h=harness();h.sheet.show('n1');
 find(h.panel,x=>x.textContent==='種類変更'&&x.tagName==='button').click();
 const picker=byId(h.panel,'cmTypePicker');
 assert.equal(picker.classList.values.has('open'),true);
 const gym=picker.children.find(x=>x.dataset.layer==='new-gym');gym.click();
 assert.equal(h.records[0].kind,'gym');
 assert.equal(h.commands.at(-1).command.type,'change-kind');
 const del=find(h.panel,x=>x.textContent==='削除'&&x.tagName==='button');
 del.click();assert.equal(h.records[0].deleted,true);assert.equal(h.commands.at(-1).command.type,'delete');
});
