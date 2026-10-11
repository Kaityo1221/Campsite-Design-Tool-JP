// Completion requires ALL group gates, not merely the focused comparisons.
const fs=require('node:fs'),path=require('node:path');
const reportFile=path.join(__dirname,'ui-runtime-comparison.json');
const comparison=fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile,'utf8')):null;
const groups={
 startupAndDisplay:'FOCUSED_COMPARISON',poiAddition:'FOCUSED_COMPARISON',poiEditAndMove:'FOCUSED_COMPARISON',
 areasAndMap:'HOLD_ACTIVITY_TOOLS_NOT_SEPARATED',saveAndKmz:'HOLD_CHOOSER_AND_FULL_MENU_PATHS_NOT_SEPARATED',
 listCoordinatesAuxiliary:'HOLD_LIST_COORDINATE_CARD_GROUP_NOT_SEPARATED',animationsAndGestures:'HOLD_FULL_ANIMATION_GESTURE_MATRIX_NOT_TESTED'
};
const result={partA:'HOLD',partB:'NOT_STARTED',progress:'85% / Phase 1 HOLD',deployed:false,
 focusedComparison:comparison?.status||'NOT_RUN',groups,
 originalFunctionsExecuted:0,unprovenFunctionsRemaining:176,unprovenFunctionsAllowed:0,
 blockers:[...(comparison?.status==='PASS'?[]:[{group:'focusedComparison',reason:'HOLD_DOM_OR_PIXEL_DIFFERENCES'}]),...Object.entries(groups).filter(([,v])=>v.startsWith('HOLD')).map(([group,reason])=>({group,reason}))],
 safariRealDevice:'NOT_TESTED'};
fs.writeFileSync(path.join(__dirname,'part-a-status.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
process.exitCode=2;
