import {attachOriginalFileReview} from '../integration/original-file-review.mjs';
// r19 uses the original entry controls. Consent is a native confirmation dialog.
// No legacy runtime scripts, no old localStorage, and no draft saves.
if(!globalThis.JSZip)throw Error('KMZ decoder unavailable');
globalThis.creativeR19=attachOriginalFileReview({
 document,JSZip:globalThis.JSZip,DOMParser:globalThis.DOMParser,XMLSerializer:globalThis.XMLSerializer,
 confirmReview:()=>globalThis.confirm('読み込み候補をCreative Nextの隔離編集領域に適用しますか？\n元のKMZと既存保存データは変更しません。')
});
