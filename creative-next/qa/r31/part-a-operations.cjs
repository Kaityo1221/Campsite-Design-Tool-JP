const assert=require('node:assert/strict');
// Real input events in isolated synthetic contexts. Display APIs prepare fixtures only.
async function touchPath(item,points){
 const cdp=await item.context.newCDPSession(item.page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points[0].map((p,i)=>({x:p[0],y:p[1],id:i+1}))});
 for(const step of points.slice(1)){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:step.map((p,i)=>({x:p[0],y:p[1],id:i+1}))});await item.page.waitForTimeout(24);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
}
async function exercise({pair,view,camera,folder,compareScene,both,onScene}){
 const scenes=[],checks=[],referenceDiagnostics=[];
 pair[1].operationChecks=checks;
 const capture=async(name,selectors)=>{const scene=await compareScene(pair,name,selectors,folder);scenes.push(scene);onScene?.(scene);};
 const check=(name,value,details=null)=>{checks.push({name,pass:!!value,details});};
 const cameraOf=async item=>item.page.evaluate(()=>window.__r31ReferenceProbe?.camera()||creativeR31.status().camera);
 const setCamera=async c=>{await pair[0].page.evaluate(c=>__r31ReferenceProbe.setCamera(c),c);await pair[1].page.evaluate(c=>creativeR31.setCamera(c),c);};
 const tap=async selector=>{for(const item of pair){const b=await item.page.locator(selector).boundingBox();assert(b,selector);const point={x:b.x+b.width/2,y:b.y+b.height/2};await item.page.evaluate(()=>{window.__inputTrace=[];if(!window.__inputTraceReady){window.__inputTraceReady=true;for(const type of ['pointerdown','pointerup','touchstart','touchend','click'])document.addEventListener(type,e=>__inputTrace.push({type,target:e.target.id,x:e.clientX,y:e.clientY}),true);}});await item.page.locator(selector).tap({timeout:3000});await item.page.waitForTimeout(100);item.tapDebug=await item.page.evaluate(p=>({point:p,hit:document.elementFromPoint(p.x,p.y)?.outerHTML.slice(0,160),events:__inputTrace,scale:visualViewport.scale}),point);}};
 const openNew=async()=>{for(const [i,item]of pair.entries())await item.page.evaluate(({id,i})=>i?creativeR31.openSheet(id):__r31ReferenceProbe.openSheet(id),{id:view.pois.find(p=>p.role==='new').id,i});};
 const swipe=async(selector,dx,dy)=>{for(const item of pair){const b=await item.page.locator(selector).boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;await touchPath(item,[[[x,y]],[[x+dx/2,y+dy/2]],[[x+dx,y+dy]]]);}};
 await both('#cmV59HelpButton');for(const item of pair)await item.page.locator('#cmV60RulesDots button').nth(1).click();await capture('rules-distance',['#cmV60RulesPanel','#cmV60RulesDots']);for(const item of pair)await item.page.locator('#cmV60RulesDots button').nth(2).click();await capture('rules-finish',['#cmV60RulesPanel','#cmV60RulesDots']);for(const item of pair)await item.page.keyboard.press('Escape');check('rules-escape',(await Promise.all(pair.map(x=>x.page.locator('#cmV60RulesPanel').isVisible()))).every(x=>!x));

 // Normal touch opening of ＋ and all three selections, followed by position previews.
 for(const kind of ['new-pokestop','new-gym','new-power']){
  await tap('#cmAddFab');const classes=await Promise.all(pair.map(x=>x.page.locator('#cmFabWrap').getAttribute('class')));referenceDiagnostics.push({name:'plus-normal-tap-'+kind,pass:classes.every(c=>c.includes('open')),details:{classes,debug:pair.map(x=>x.tapDebug)}});
  // Preserve a failed native-input result. Reset it with ordinary UI input only to
  // continue independent type/preview tests; this never changes that check to PASS.
  for(const [i,item]of pair.entries())if(!classes[i].includes('open')){if(await item.page.locator('#cmSafeAddCancel').count())await item.page.locator('#cmSafeAddCancel').click();await item.page.locator('#cmAddFab').click();}
  await tap('.cm-bubble[data-layer="'+kind+'"]');await capture('touch-preview-'+kind,['#cmSafeAddBar','#cmSafeAddDot']);
  const preview=await pair[1].page.evaluate(()=>creativeR31.status().preview);check('position-preview-'+kind,preview?.radius===50&&Number.isFinite(preview.position.lat));await tap('#cmSafeAddCancel');
 }
 await both('#cmAddFab');for(const item of pair)await item.page.locator('.cm-bubble[data-layer="new-pokestop"]').click();
 await swipe('#cmSafeAddLever',0,32);await capture('add-lever-40',['#cmSafeAddBar','#cmSafeAddLever']);
 check('add-lever-snap',await pair[1].page.evaluate(()=>creativeR31.status().preview.radius===40));
 const leverBefore=await pair[1].page.evaluate(()=>({overflow:document.body.style.overflow,touchAction:document.body.style.touchAction,camera:creativeR31.status().camera}));
 {const item=pair[1],b=await item.page.locator('#cmSafeAddLever').boundingBox(),cdp=await item.context.newCDPSession(item.page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2+16,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await cdp.detach();}
 check('lever-cancel-restores-surface',await pair[1].page.evaluate(before=>document.body.style.overflow===before.overflow&&document.body.style.touchAction===before.touchAction&&JSON.stringify(creativeR31.status().camera)===JSON.stringify(before.camera),leverBefore));
 await pair[1].page.locator('#cmSafeAddConfirm').click();await both('#cmSafeAddCancel');
 // Coordinate panel errors, camera changes and focus/close behavior are display only.
 await both('#cmAddFab');for(const item of pair)await item.page.locator('.cm-bubble[data-layer="new-gym"]').click();
 await both('.cm-coordinate-trigger');await capture('coordinate-jump-open',['#cmCoordinateJumpPanel']);
 for(const item of pair)await item.page.locator('#cmCoordinateInput').fill('invalid');await both('.cm-v52-confirm');await capture('coordinate-jump-error',['#cmCoordinateJumpPanel']);
 for(const item of pair){await item.page.locator('#cmCoordinateInput').fill(camera.center.join(', '));await item.page.locator('#cmCoordinateInput').press('Enter');}
 check('coordinate-apply-close',(await Promise.all(pair.map(x=>x.page.locator('#cmCoordinateJumpPanel').isVisible()))).every(x=>!x));await both('#cmSafeAddCancel');await setCamera(camera);
 await pair[1].page.locator('#cmAddFab').click();await pair[1].page.locator('.cm-bubble[data-layer="new-pokestop"]').click();await pair[1].page.locator('.cm-coordinate-trigger').click();await pair[1].page.locator('#cmCoordinateInput').fill(camera.center.join(','));await pair[1].page.locator('.cm-v52-confirm').click();check('coordinate-confirm-hold',await pair[1].page.evaluate(()=>__r31Requests.at(-1).action.type==='coordinate-add'&&__r31Requests.at(-1).result.status==='HOLD'));await pair[1].page.locator('.cm-coordinate-close').click();await pair[1].page.locator('#cmSafeAddCancel').click();

 // Folder tabs and native swipes, row navigation and close/back.
 await both('#cmCount');await capture('list-new',['.cm-list','.cm-list-row']);
 for(const item of pair)await item.page.locator('.cm-folder-tab').nth(1).click();await capture('list-existing',['.cm-list','.cm-list-row']);
 await swipe('.cm-folder-tabs',80,0);await capture('list-swipe-new',['.cm-list']);
 check('list-swipe-page',(await Promise.all(pair.map(x=>x.page.locator('.cm-list').getAttribute('data-page')))).every(x=>x==='0'));
 for(const item of pair)await item.page.locator('.cm-list-row').first().click();for(const item of pair)await item.page.locator('.cm-sheet').waitFor();await capture('list-row-sheet',['.cm-sheet']);await both('.cm-sheet-close');await setCamera(camera);
 await both('#cmCount');await both('.cm-view-head button');check('list-close',(await Promise.all(pair.map(x=>x.page.locator('.cm-list').count()))).every(x=>x===0));
 await both('#cmStandaloneSaveButton');await both('#cmStandaloneCoords');await capture('coordinate-cards',['.cm-coords','.cm-coord-card']);
 for(const item of pair)await item.page.locator('[data-copy]').first().click();await capture('coordinate-copy',['.cm-coord-card']);
 const clipboard=await Promise.all(pair.map(x=>x.page.evaluate(()=>__r31Clipboard)));check('coordinate-copy-value',JSON.stringify(clipboard[0])===JSON.stringify(clipboard[1])&&clipboard[1].length===1,clipboard);await both('.cm-view-head button');
 // Save menus and chooser: source preparation bypasses only KMZ generation, never a click.
 await both('#cmStandaloneSaveButton');await capture('save-menu-reopen',['#cmStandaloneSaveMenu']);await both('#cmStandaloneClose');
 await pair[0].page.evaluate(()=>__r31ReferenceProbe.chooser());await pair[1].page.locator('#cmStandaloneSaveButton').click();await pair[1].page.locator('#cmStandaloneKmz').click();await capture('save-chooser',['#cmV73SaveChooser']);
 await pair[1].page.getByRole('button',{name:'保存先を選ぶ',exact:true}).click();await pair[1].page.getByRole('button',{name:'ダウンロード',exact:true}).click();
 for(const item of pair)await item.page.locator('#cmV73SaveChooser button').last().click();check('chooser-cancel',(await Promise.all(pair.map(x=>x.page.locator('#cmV73SaveChooser').count()))).every(x=>x===0));

 // Layer toggles and circles on every width. Source pane content is compared visually.
 await both('#layerButton');await capture('layers-open',['#layerPanel']);
 for(const label of ['既存 PokéStop','新規 Gym']){for(const item of pair)await item.page.locator('#layerRows').getByRole('button',{name:label,exact:true}).click();await capture('layer-hidden-'+label,['#layerPanel']);for(const item of pair)await item.page.locator('#layerRows').getByRole('button',{name:label,exact:true}).click();}
 for(const radius of [50,40,30]){for(const item of pair)await item.page.locator('#layerRows').getByRole('button',{name:radius+'m円',exact:true}).click();await capture('circle-layer-'+radius,['#layerPanel','.leaflet-distance-pane svg']);}
 for(const radius of [50,40,30])for(const item of pair)await item.page.locator('#layerRows').getByRole('button',{name:radius+'m円',exact:true}).click();await both('#layerButton');
 await both('#mapToggle');await capture('map-aerial',['#mapLicense']);await both('#mapToggle');await capture('map-street',['#mapLicense']);
 // Activity preview stores draft points only, never synthetic view data.
 await both('#toolbox');await both('[data-tool="polygon"]');await capture('area-start',['#toolMenu','body > button[style*="min-width: 160px"]','body > div[style*="width: 52px"][style*="pointer-events: none"]']);
 const areaButton=item=>item.page.getByRole('button',{name:/^点を打つ$|^活動範囲を作成！$/});
 for(const item of pair)await areaButton(item).click();await setCamera({center:[camera.center[0]+.0006,camera.center[1]],zoom:camera.zoom});
 for(const item of pair)await areaButton(item).click();await setCamera({center:[camera.center[0]+.0006,camera.center[1]+.0006],zoom:camera.zoom});
 for(const item of pair)await areaButton(item).click();await capture('area-vertices',['.leaflet-polygon-pane']);
 await both('#undo');await capture('area-draft-undo',['.leaflet-polygon-pane']);await both('#redo');await setCamera(camera);await capture('area-close-preview',['.leaflet-polygon-pane']);
 await pair[1].page.getByRole('button',{name:'活動範囲を作成！',exact:true}).click();check('area-confirm-hold',await pair[1].page.evaluate(()=>__r31Requests.at(-1).action.type==='area-create'&&__r31Requests.at(-1).result.status==='HOLD'));
 for(const item of pair)await item.page.getByRole('button',{name:'×',exact:true}).filter({visible:true}).first().click();
 check('area-cancel-teardown',await pair[1].page.evaluate(()=>creativeR31.status().areaPreview.points.length===0));
 // Existing synthetic activity area exercises redraw/delete/cancel without a real import.
 const points=[[camera.center[0]-.0003,camera.center[1]-.0003],[camera.center[0]+.0003,camera.center[1]-.0003],[camera.center[0]+.0003,camera.center[1]+.0003]];
 await pair[0].page.evaluate(p=>__r31ReferenceProbe.fixtureArea(p),points);await pair[1].page.evaluate(p=>{window.__r31Fixture={...window.__r31Fixture,areas:[{id:'qa-area',points:p}]};creativeR31.setViewReader(()=>__r31Fixture);},points);
 const withArea=await pair[1].page.evaluate(()=>JSON.stringify(__r31Fixture));
 await both('#layerButton');await capture('activity-layer',['#layerPanel']);await both('#layerButton');await both('#toolbox');await both('[data-tool="polygon"]');await capture('area-choice',['body > div:last-child']);
 for(const item of pair)await item.page.getByRole('button',{name:'削除する',exact:true}).click();
 for(const item of pair)await item.page.locator('.leaflet-polygon-pane path.leaflet-interactive').last().click();await capture('area-delete-confirm',['body > div:last-child']);
 await pair[1].page.getByRole('button',{name:'活動範囲を削除',exact:true}).click();check('area-delete-hold',await pair[1].page.evaluate(()=>__r31Requests.at(-1).action.type==='area-delete'&&__r31Requests.at(-1).result.status==='HOLD'));
 for(const item of pair)await item.page.getByRole('button',{name:'戻る',exact:true}).click();check('area-view-immutable',(await pair[1].page.evaluate(()=>JSON.stringify(__r31Fixture)))===withArea);
 await both('#toolbox');await both('[data-tool="polygon"]');for(const item of pair)await item.page.getByRole('button',{name:'キャンセル',exact:true}).click();
 await pair[1].page.locator('#toolbox').click();await pair[1].page.locator('[data-tool="polygon"]').click();await pair[1].page.getByRole('button',{name:'描き直す',exact:true}).click();check('area-redraw-hold',await pair[1].page.evaluate(()=>__r31Requests.at(-1).action.type==='area-redraw'&&__r31Requests.at(-1).result.status==='HOLD'));await pair[1].page.getByRole('button',{name:'×',exact:true}).filter({visible:true}).first().click();
 await both('#toolbox');await both('[data-tool="ruler"]');for(const position of [{x:70,y:260},{x:135,y:325}])for(const item of pair)await item.page.locator('#map').click({position});await capture('ruler-measured',['#cmRulerExit','.leaflet-ruler-pane svg','#status']);await both('#cmRulerExit');
 check('ruler-exit',(await Promise.all(pair.map(x=>x.page.locator('#cmRulerExit').count()))).every(x=>x===0));
 await pair[0].page.evaluate(()=>__r31ReferenceProbe.fixtureArea([]));await pair[1].page.evaluate(v=>{window.__r31Fixture=JSON.parse(JSON.stringify(v));creativeR31.setViewReader(()=>__r31Fixture);},view);await setCamera(camera);

 // Marker activation uses visible current renderer targets, no programmatic openSheet.
 for(const selector of ['.cm-engine-candidate-icon','.cm-engine-existing-icon']){for(const item of pair)await item.page.locator(selector).first().click();await capture('marker-'+selector.slice(1),['.cm-sheet']);await both('.cm-sheet-close');}
 await openNew();await swipe('.cm-sheet-handle',0,80);check('sheet-handle-swipe',(await Promise.all(pair.map(x=>x.page.locator('.cm-sheet').count()))).every(x=>x===0));
 await openNew();await both('#cmMove');await swipe('#cmMoveLever',0,65);await capture('move-lever-30',['#cmMoveBar']);check('move-lever-snap',await pair[1].page.evaluate(()=>creativeR31.status().preview.radius===30));await both('#cmMoveCancel');
 // FAB boundary clamping, cancel and ordinary tap after drag.
 for(const item of pair){const b=await item.page.locator('#cmAddFab').boundingBox();await item.page.mouse.move(b.x+28,b.y+28);await item.page.mouse.down();await item.page.mouse.move(20,250,{steps:8});await item.page.mouse.up();}await capture('fab-drag',['#cmFabWrap']);
 check('fab-drag-no-menu',(await Promise.all(pair.map(x=>x.page.locator('#cmFabWrap').getAttribute('class')))).every(c=>!c.includes('open')));await both('#cmAddFab');await capture('fab-tap-after-drag',['#cmFabWrap']);await both('#cmAddFab');
 await pair[0].page.evaluate(()=>__r31ReferenceProbe.setHand('left'));await pair[1].page.evaluate(()=>creativeR31.setHand('left'));await capture('map-left',['#cmFabWrap','#cmStandaloneSaveButton','#toolbox']);await pair[0].page.evaluate(()=>__r31ReferenceProbe.setHand('right'));await pair[1].page.evaluate(()=>creativeR31.setHand('right'));
 for(const item of pair){await item.page.mouse.move(90,250);await item.page.mouse.down();await item.page.mouse.move(130,290,{steps:8});await item.page.mouse.up();await item.page.waitForTimeout(400);}const draggedCameras=await Promise.all(pair.map(cameraOf));check('map-drag-camera',draggedCameras.every(c=>JSON.stringify(c.center)!==JSON.stringify(camera.center))&&JSON.stringify(draggedCameras[0])===JSON.stringify(draggedCameras[1]),draggedCameras);await setCamera(camera);
 for(const item of pair)await item.page.locator('#map').dblclick({position:{x:100,y:240}});for(const item of pair)await item.page.waitForTimeout(400);const zooms=await Promise.all(pair.map(cameraOf));check('map-double-click-zoom',zooms.every(c=>c.zoom===camera.zoom+1));await setCamera(camera);
 for(const item of pair){await item.page.touchscreen.tap(100,240);await item.page.touchscreen.tap(100,240);}for(const item of pair)await item.page.waitForTimeout(400);check('map-double-tap-zoom',(await Promise.all(pair.map(cameraOf))).every(c=>c.zoom===camera.zoom+1));await setCamera(camera);
 for(const item of pair)await touchPath(item,[[[100,280],[200,280]],[[80,280],[220,280]],[[60,280],[240,280]],[[40,280],[260,280]]]);for(const item of pair)await item.page.waitForTimeout(400);check('map-pinch-zoom',(await Promise.all(pair.map(cameraOf))).every(c=>c.zoom>camera.zoom));await setCamera(camera);
 // Animation lifetime samples are synchronized by presentation time, not image tolerances.
 await pair[0].page.evaluate(p=>__r31ReferenceProbe.feedback(p),view.pois[1]);await pair[1].page.evaluate(p=>creativeR31.feedback(p),view.pois[1]);
 for(const item of pair)await item.page.evaluate(()=>document.getAnimations().forEach(a=>{if(a.effect?.getTiming().duration===430){a.pause();a.currentTime=180;}}));await capture('addition-star',['.cm-v46-shooting-star']);
 for(const item of pair)await item.page.evaluate(()=>document.getAnimations().forEach(a=>{if(a.effect?.getTiming().duration===430)a.finish();}));for(const item of pair)await item.page.waitForTimeout(400);check('addition-animation-cleanup',(await Promise.all(pair.map(x=>x.page.locator('.cm-v46-shooting-star').count()))).every(x=>x===0));
 await both('#back');await pair[1].page.locator('#entryFile').setInputFiles({name:'synthetic-request.kmz',mimeType:'application/vnd.google-earth.kmz',buffer:Buffer.from('not imported')});await pair[0].page.evaluate(()=>__r31ReferenceProbe.transition());await pair[1].page.locator('#startButton').click();check('startup-button-hold',await pair[1].page.evaluate(()=>__r31Requests.at(-1).action.type==='acceptPrepared'&&__r31Requests.at(-1).result.status==='HOLD'));
 for(const item of pair)await item.page.evaluate(()=>document.getAnimations().forEach(a=>{if(a.effect?.target?.id==='cmV58StartTransition'){a.pause();a.currentTime=400;}}));await capture('startup-transition',['#cmV58StartTransition']);
 for(const item of pair)await item.page.waitForFunction(()=>document.getElementById('entry').classList.contains('hidden'));check('startup-transition-completes',(await Promise.all(pair.map(x=>x.page.locator('#entry').getAttribute('class')))).every(c=>c.includes('hidden')));await setCamera(camera);
 const source=await pair[0].page.evaluate(()=>__r31ReferenceProbe.view()),candidate=await pair[1].page.evaluate(()=>__r31Fixture);check('all-display-actions-view-immutable',JSON.stringify(candidate)===JSON.stringify(view)&&JSON.stringify(source.pois)===JSON.stringify(view.pois));
 return{scenes,checks,referenceDiagnostics};
}
module.exports={exercise,touchPath};
