const fs=require('node:fs'),path=require('node:path');
const {ROOT}=require('./production-source.cjs');
const groups={
 '起動・表示設定':['msg','setHand','cmStampWorkspaceId','cmRenderRecent','cmInstallEntryHistory','start.onclick'],
 'POI追加':['addDraft','openDraftForm','cmShowUndo','cmSafeInstallAddBar','cmInstallFab','setKeyboardMode','integratedConfirm','decorate'],
 'POI編集・移動':['recordPopup','beginMove','cmV69InstallSpacingReason','textarea.oninput','cmOpenRecord','cmInstallMoveUi'],
 '活動範囲・地図':['renderLayerPanel','renderCreativeDesignCheck','renderJpGuide','ensurePolyAction','updatePolyPreview','beginRuler','showPolygonDeleteConfirm','openPolygonChoice'],
 '保存・KMZ':['buildMyMapsKml','downloadKmzBlob','showSaveChooser','cmOpenSaveMenu','cmOpenStandaloneSave','cmInstallStandaloneSave'],
 '一覧・座標・補助':['cmRenderListPage','cmOpenList','cmCopy','cmOpenCoords','ensurePanel','openPanel','applyCoordinate','bindBar'],
 'アニメーション・操作':['flashAdd','cmV46FlyStarToCount']
};
function groupOf(d){
 for(const [name,members]of Object.entries(groups))if(members.includes(d.name))return name;
 if(/Save|Kmz|Kml|Export|snapshot|restore|Archive|Workspace|Persist|readFile|parse|loadCsv/i.test(d.name))return '保存・KMZ';
 if(/Move|Record|Sheet|Spacing|Memo|Type/i.test(d.name))return 'POI編集・移動';
 if(/Add|Fab|Place|Preview|Lever|Radius|GuideCircle|Crosshair/i.test(d.name))return 'POI追加';
 if(/Poly|Area|Circle|Map|Layer|Scene|Renderer|Geometry|Ruler|Nearest|Distance/i.test(d.name))return '活動範囲・地図';
 if(/List|Coord|Copy|Jst|Recent|Row/i.test(d.name))return '一覧・座標・補助';
 if(/Anim|Comet|Star|Flash|Touch|Tap|Gesture|Haptic|Hint/i.test(d.name))return 'アニメーション・操作';
 return '起動・表示設定';
}
function classify(inventory){
 const byName=new Map();for(const d of inventory.definitions){if(!byName.has(d.name))byName.set(d.name,[]);byName.get(d.name).push(d);}
 const definitions=inventory.definitions.map((d,index)=>{
  const reachable=new Set(),queue=[d],visited=new Set(),ambiguous=[];
  while(queue.length){const n=queue.pop();if(visited.has(n))continue;visited.add(n);
   for(const c of n.calls){const candidates=byName.get(c)||[];if(candidates.length>1)ambiguous.push(c);
    if(candidates.length){reachable.add(c);queue.push(...candidates);}}
  }
  return{...d,key:d.scriptId+':'+d.name+':'+d.line,index,group:groupOf(d),execution:'DENIED_ORIGINAL_FUNCTION',
   dependencies:{ui:d.ui,stateReads:d.calls.filter(c=>/records|polygons|cmActive|cmType|state|layer|Nearest/i.test(c)),
    events:d.transitiveReasons.includes('LISTENER_REQUIRES_TEARDOWN'),dataChanges:d.transitiveReasons.includes('LEGACY_DATA_WRITE'),
    persistence:d.transitiveReasons.includes('LEGACY_PERSISTENCE'),history:d.transitiveReasons.includes('LEGACY_HISTORY'),
    kmz:d.transitiveReasons.includes('LEGACY_KMZ'),timers:d.transitiveReasons.includes('TIMER_REQUIRES_TEARDOWN')},
   reachable:[...reachable].sort(),ambiguousCalls:[...new Set(ambiguous)].sort(),review:'Original function excluded; only independently checked template/style expressions may be emitted.'};
 });
 return{baselineAuditCommit:'b312c83907a6c696f595e694ff6854f4a9b3f2ba',status:'HOLD',originalFunctionsExecuted:0,
  counts:{mixed:definitions.filter(d=>d.classification==='MIXED_UI_REQUIRES_SEPARATION').length,effectful:definitions.filter(d=>d.classification==='EFFECTFUL_REQUIRES_REVIEW').length,unproven:definitions.filter(d=>d.classification==='UNPROVEN').length},
  groups:Object.keys(groups).map(name=>({name,mixed:definitions.filter(d=>d.group===name&&d.classification==='MIXED_UI_REQUIRES_SEPARATION').map(d=>d.key),definitions:definitions.filter(d=>d.group===name).length})),definitions,
  limitation:'Name graph is conservative and may merge lexical scopes. No original function is authorized by graph reachability.'};
}
function write(){
 const input=JSON.parse(fs.readFileSync(path.join(__dirname,'source-inventory.json'),'utf8'));
 const report=classify(input);
 if(report.counts.mixed!==46||report.counts.effectful!==147||report.counts.unproven!==176)throw Error('AUDIT_CLASSIFICATION_DRIFT');
 fs.writeFileSync(path.join(__dirname,'functional-groups.json'),JSON.stringify(report,null,2)+'\n');
 const lines=['# r31 機能グループと実行境界','',
  '前回監査369定義を保持。46混在/147副作用あり/176未証明を全件分類。原本関数の実行数0。未証明176件は全件実行禁止。','',
  '| 機能 | 混在件数 | 全定義 |','| --- | --- | --- |',...report.groups.map(g=>'| '+g.name+' | '+g.mixed.length+' | '+g.definitions+' |'),'',
  '機能別UI抽出は元関数を呼ぶのではなく、ASTで選んだテンプレート式/CSS定数を別途検査して生成する。状態の参照はimmutable view、イベントはUI状態かrequest境界、データ変更/履歴/KMZ/保存はPART A中HOLD。timer/listener/observerは新runtimeのdisposeで解除する。','',
  '## 混在46件の依存','',
  '| 機能 | 関数 | 最終変換元 | UI | 状態参照/呼出し | イベント | データ | 保存 | timer | 処理 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...report.definitions.filter(d=>d.classification==='MIXED_UI_REQUIRES_SEPARATION').map(d=>'| '+d.group+' | '+d.name+' | '+d.source+' | '+d.ui.join(',')+' | '+d.dependencies.stateReads.join(',')+' | '+d.dependencies.events+' | '+d.dependencies.dataChanges+' | '+d.dependencies.persistence+' | '+d.dependencies.timers+' | 原関数禁止・テンプレート/接続を分離 |'),'',
  '147副作用あり/176未証明の全経路・曖昧呼出しはqa/r31/functional-groups.jsonに記録。名前ベース解析は安全証明ではないので原関数のdenyを維持する。',''];
 fs.writeFileSync(path.join(ROOT,'creative-next/R31_FUNCTIONAL_GROUPS.md'),lines.join('\n'));
 console.log(JSON.stringify(report.groups.map(g=>({name:g.name,mixed:g.mixed.length,total:g.definitions}))));
 return report;
}
module.exports={classify,groupOf,write};
if(require.main===module)write();
