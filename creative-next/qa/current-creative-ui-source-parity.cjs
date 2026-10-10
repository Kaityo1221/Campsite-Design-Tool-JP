// Creative Next strict visual-source parity gate. No product data, no app execution.
// These blob IDs were read from production main on 2026-10-10.
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const expected={
  "creative/index.html": "d08eaef4091e562d7c51e3a79d393b180fb33ca7",
  "creative/runtime/runtime-vnext.html": "2129d57674bdf4b0c1935f594f408028a69966d9",
  "creative/runtime/creative-patches-v45-unified-map-ui.js": "114e991d810ac234ab1088539c20b6573888e9eb",
  "creative/runtime/creative-patches-v58-new-entry-current-map.js": "a4f24dfa13682450228e1502b6b2ed00ff3dca02",
  "creative/runtime/creative-patches-v59-help-button.js": "a7baa594203b0c529de8c83edb9796f922a2cbca",
  "creative/runtime/creative-patches-v60-rules-carousel.js": "7de7623b4fdbf31850d9916bc1d51a06506596aa",
  "creative/runtime/creative-patches-v61-saved-session-hint.js": "59ebfcbe161ec600c6017e0827f686e06fa71922",
  "creative/runtime/creative-patches-v73-production-visual-fixes.js": "9f129a649287b4f83352b01927d7c80ee7e4fe95",
  "creative/runtime/creative-patches-v74-tools-phase-b.js": "de242d295d17230f9f3d952dc9e1e3ca2f377474",
  "creative/runtime/creative-patches-v75-poi-add-phase-c.js": "56dba0416dcf7802e6bc7e065cad8f0b7c528d26",
  "creative/runtime/creative-patches-v76-radius-reference-ui.js": "76058ffb0df6141afac339d869b5175338935e51",
  "creative/runtime/creative-patches-v77-phase-e-ux.js": "e35c9a4313b4c261a9e07ad53ee610080b3d3137",
  "assets/creative-mode-opening-final.webp": "fa340c1f0e88f6f1d072d75cfa25905637616d3b",
  "assets/creative-mode-start-transition.webp": "1ec9e14d3057c232060ef0728443213a5d2de89d"
};
let failed=0;
for(const [relative,sha] of Object.entries(expected)){
 const filename=path.join(root,relative);
 if(!fs.existsSync(filename)){console.error('MISSING',relative);failed++;continue}
 const bytes=fs.readFileSync(filename);
 const hash=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\\0'.replace('\\0','\\x00'))).update(bytes).digest('hex');
 if(hash!==sha){console.error('VISUAL_DRIFT',relative,'actual='+hash,'baseline='+sha);failed++}
 else console.log('UI_SAME',relative);
}
const entry=fs.readFileSync(path.join(root,'creative/runtime/creative-patches-v58-new-entry-current-map.js'),'utf8');
if(!entry.includes("url('../assets/creative-mode-opening-final.webp')")){
 console.error('VISUAL_DRIFT: current entry artwork reference was modified');failed++;
}
const main=fs.readFileSync(path.join(root,'creative/index.html'),'utf8');
for(const name of ['creative-patches-v58-new-entry-current-map.js','creative-patches-v73-production-visual-fixes.js','creative-patches-v75-poi-add-phase-c.js']){
 if(!main.includes(name)){console.error('VISUAL_DRIFT: patch order missing',name);failed++}
}
if(failed)process.exitCode=1;else console.log('PASS: current Creative Mode visual assets and patches exactly unchanged');
