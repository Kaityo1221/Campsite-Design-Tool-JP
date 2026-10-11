import fs from 'node:fs';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../phase-1b/core/create-new-kmz.mjs';
const record={id:'phase1-e2e',role:'existing',kind:'pokestop',title:'Phase1実物確認',memo:'未編集',lat:35.64203,lng:139.855563,deleted:false};
const out=await createFreshV1Kmz({records:[record],activityAreas:[]},{JSZip,DOMParser,XMLSerializer});
fs.writeFileSync('/tmp/creative-next-phase1-check.kmz',out.bytes);
console.log('Synthetic KMZ generated, no personal data');
