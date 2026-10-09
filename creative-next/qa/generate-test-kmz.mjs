import {writeFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../phase-1b/core/create-new-kmz.mjs';
const result=await createFreshV1Kmz({records:[{id:'preview-synthetic-1',kind:'pokestop',role:'existing',title:'検証用POI',memo:'検証用メモ',lat:35.643,lng:139.858,deleted:false}],activityAreas:[]},{JSZip,DOMParser,XMLSerializer});
await writeFile(process.argv[2]||'/tmp/creative-next-test-fixture.kmz',result.bytes);
