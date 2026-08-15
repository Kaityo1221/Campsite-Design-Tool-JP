(()=>{
  function init(){
    const r=document.getElementById('campsiteSupportBotRoot');
    if(!r||r.dataset.botMenuReady)return;
    r.dataset.botMenuReady='1';

    const m=r.querySelector('.support-bot-messages');
    const l=r.querySelector('.support-bot-launcher');
    const i=r.querySelector('.support-bot-input');
    const s=r.querySelector('.support-bot-send');
    const f=Array.isArray(window.CAMPSITE_SUPPORT_FAQS)?window.CAMPSITE_SUPPORT_FAQS:[];

    const L={wayfarer:'Wayfarer Map',poi:'POI・スポット',mymaps:'Google My Maps・レイヤー',file:'CSV・KMZ・ファイル',distance:'距離チェック・結果',other:'不具合・その他'};
    const FLOW=[['candidate','候補地を決める'],['poi','POIを準備する'],['mymaps','Google My Mapsで作成する'],['distance','距離チェックをする'],['submit','提出する']];
    const SYN={消す:['削除','ゴミ箱'],削除:['消す','ゴミ箱'],出ない:['表示されない','見えない'],表示されない:['出ない','見えない'],場所:['位置','座標'],位置:['場所','座標'],座標:['緯度','経度','位置'],マイマップ:['my maps','google my maps','mymaps'],スポンサー:['スポンサード','sponsored'],スポンサード:['スポンサー','sponsored'],ポケストップ:['poi','スポット'],ジム:['poi','スポット'],kmz:['kml','ファイル'],csv:['ファイル'],レイヤー:['分け方','振り分け','分類'],分け方:['レイヤー','振り分け','分類'],インポート:['読み込む','読み込み'],読み込み:['インポート','読み込む'],エクスポート:['書き出し','保存'],書き出し:['エクスポート','保存']};

    let c=null,q=null,imp=false,mode='home',step=null,clarify=0,rejected=new Set(),trail=[],searchContext='';
    const KEY='campsite_support_v2_state';

    function sid(){let x=localStorage.getItem('campsite_support_session_id');if(!x){x='cs_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);localStorage.setItem('campsite_support_session_id',x)}return x}
    function persist(){localStorage.setItem(KEY,JSON.stringify({c,q:q&&q.id,mode,step,clarify,rejected:[...rejected],trail:trail.slice(-30),searchContext}))}
    function restore(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(!x)return false;c=x.c||null;q=f.find(v=>v.id===x.q)||null;mode=x.mode||'home';step=x.step||null;clarify=Number.isFinite(x.clarify)?x.clarify:0;rejected=new Set(x.rejected||[]);trail=Array.isArray(x.trail)?x.trail:[];searchContext=typeof x.searchContext==='string'?x.searchContext:'';return true}catch(e){return false}}
    async function save(d){if(!window.campsiteSupabase)return false;const z=await window.campsiteSupabase.from('ca_feedback').insert({session_id:sid(),feedback_type:d.type||'question',category:d.category||'other',content:String(d.content||'').slice(0,2000),faq_id:d.faq_id||null,resolved:typeof d.resolved==='boolean'?d.resolved:null,app_version:window.APP_VERSION||null,status:'new'});if(z.error)console.warn('support feedback error',z.error.message);return !z.error}

    function avatar(user){const a=document.createElement(user?'span':'img');a.className='support-bot-avatar '+(user?'you':'ren');if(user){a.textContent='YOU'}else{a.src='assets/ren_normal.png';a.alt='レン';a.onerror=()=>a.style.display='none'}return a}
    function add(t,u,b,meta){const a=document.createElement('div');a.className='support-bot-row '+(u?'user':'bot');const z=document.createElement('div');z.className='support-bot-bubble';z.textContent=t;if(meta){const e=document.createElement('div');e.className='support-bot-meta';e.textContent=meta;z.appendChild(e)}if(b){const A=document.createElement('div');A.className='support-bot-actions';b.forEach(x=>{const y=document.createElement('button');y.type='button';y.className='support-bot-action'+(x.kind?' '+x.kind:'');y.textContent=x.label;y.onclick=x.onClick;A.appendChild(y)});z.appendChild(A)}if(u){a.appendChild(z);a.appendChild(avatar(true))}else{a.appendChild(avatar(false));a.appendChild(z)}m.appendChild(a);m.scrollTop=m.scrollHeight;if(t&&t!=='確認しています…'){trail.push((u?'利用者: ':'レン: ')+t);persist()}}
    function thinking(cb){add('確認しています…',false);const row=m.lastElementChild;setTimeout(()=>{if(row)row.remove();cb()},250)}

    function appendSearchContext(text){const t=String(text||'').trim();if(!t)return searchContext;const current=searchContext.trim();if(!current)searchContext=t;else if(!current.includes(t))searchContext=(current+' '+t).trim();persist();return searchContext}
    function startTextSearch(base){mode='searchText';clarify=0;searchContext=String(base||'').trim();persist()}
    function reset(){localStorage.removeItem(KEY);c=q=step=null;mode='home';imp=false;clarify=0;rejected=new Set();trail=[];searchContext='';home()}

    function home(){m.innerHTML='';mode='home';c=q=null;imp=false;clarify=0;searchContext='';add('こんにちは。Campsite Design Tool サポートです。ご希望の案内方法を選択してください。',false,[{label:'質問を探す',onClick:searchHome},{label:'最初から案内して',onClick:guideHome},{label:'改善・要望を送る',kind:'purple',onClick:()=>{imp=true;mode='improvement';add('改善してほしい点や、新機能のご要望を入力してください。',false);i.focus()}}])}
    function searchHome(){mode='search';clarify=0;searchContext='';c=q=null;add('質問を探す',true);add('文章で質問を入力するか、カテゴリからお探しください。',false,[{label:'文章で探す',onClick:()=>{startTextSearch('');add('困っている内容を入力してください。関連する案内を確認します。',false);i.focus()}},{label:'カテゴリから探す',onClick:categories},{label:'最初に戻る',onClick:home}])}
    function categories(){const b=Object.keys(L).map(k=>({label:L[k],onClick:()=>cat(k)}));b.push({label:'最初に戻る',onClick:home});add('カテゴリを選択してください。',false,b)}
    function cat(k){c=k;q=null;mode='category';clarify=0;searchContext='';add(L[k],true);const x=f.filter(v=>v.c===k),b=x.map(v=>({label:v.q,onClick:()=>faq(v)}));b.push({label:'戻る',onClick:categories});add(x.length?'近い質問を選択してください。':'このカテゴリは準備中です。文章で状況を入力してください。',false,b)}

    function words(t){const n=t.toLowerCase().replace(/[？?！!、。・／/（）()]/g,' '),w=n.split(/\s+/).filter(Boolean);Object.keys(SYN).forEach(k=>{if(n.includes(k))w.push(k,...SYN[k])});return [...new Set(w.filter(x=>x.length>1))]}
    function intentBonus(v,t){const n=t.toLowerCase();let b=0;const layer=/レイヤー|分け方|振り分け|分類/.test(n),importKmz=/kmz/.test(n)&&/インポート|読み込|取り込/.test(n),exportKmz=/kmz/.test(n)&&/エクスポート|書き出|保存|ダウンロード/.test(n);if(layer){if(v.id==='FAQ-28')b+=34;if(v.id==='FAQ-12'||v.id==='FAQ-13')b+=20;if(v.id==='FAQ-21')b-=24}if(importKmz){if(v.id==='FAQ-28'||v.id==='FAQ-16')b+=14;if(v.id==='FAQ-21')b-=16}if(exportKmz&&v.id==='FAQ-21')b+=24;return b}
    function score(v,t){const ws=words(t),qq=v.q.toLowerCase(),aa=v.a.toLowerCase();let n=intentBonus(v,t);const hit=[];ws.forEach(w=>{const x=w.toLowerCase();if(qq.includes(x)){n+=6;hit.push(w)}if(aa.includes(x)){n+=2;hit.push(w)}});if(step&&((step==='mymaps'&&v.c==='mymaps')||(step==='distance'&&v.c==='distance')||(step==='poi'&&(v.c==='poi'||v.c==='wayfarer'))))n+=5;if(c){if(v.c===c)n+=9;else n-=4}if(rejected.has(v.id))n-=30;return {v,n,hit:[...new Set(hit)].slice(0,4)}}
    function doSearch(text){const queryText=appendSearchContext(text),z=f.map(v=>score(v,queryText)).sort((a,b)=>b.n-a.n).filter(x=>x.n>0);if(!z.length||z[0].n<4)return noMatch(queryText);clarify=0;persist();const strong=z[0].n>=14&&(!z[1]||z[0].n-z[1].n>=5),pick=strong?z.slice(0,1):z.slice(0,3);if(strong){faq(pick[0].v,true,pick[0].hit);return}const actions=pick.map(x=>({label:x.v.q,onClick:()=>faq(x.v)}));actions.push({label:'当てはまらないので問い合わせる',kind:'bad',onClick:()=>inquiryConfirm(queryText)});add('近い内容の案内はこちらです。',false,actions,pick.map(x=>x.hit.join('・')).filter(Boolean).join(' / '))}
    function clarificationChoice(label,category){c=category;appendSearchContext(label);add(label,true);add('ありがとうございます。続けて、表示されている内容や直前に行った操作を入力してください。',false);i.focus()}
    function noMatch(queryText){clarify++;persist();if(clarify<=2){const actions=[{label:'Wayfarer Map',onClick:()=>clarificationChoice('Wayfarer Map','wayfarer')},{label:'Google My Maps',onClick:()=>clarificationChoice('Google My Maps','mymaps')},{label:'距離チェック',onClick:()=>clarificationChoice('距離チェック','distance')},{label:'その他・自由入力',onClick:()=>clarificationChoice('その他','other')}];if(clarify===2)actions.push({label:'問い合わせる',kind:'bad',onClick:()=>inquiryConfirm(searchContext||queryText)});add(clarify===1?'もう少し状況を教えてください。どの画面・機能で困っていますか？':'ありがとうございます。もう一点だけ、表示されている内容や、直前に行った操作を教えてください。',false,actions);i.focus()}else inquiryConfirm(searchContext||queryText)}

    function faqActions(){return [{label:'解決した！',kind:'good',onClick:()=>rate(true)},{label:'まだ困ってる',kind:'bad',onClick:()=>rate(false)},{label:'別の質問を見る',onClick:()=>cat(q?q.c:(c||'file'))}]}
    function csvSource(source){const label=source==='mymaps'?'My Mapsから書き出したCSV':source==='wayfarer'?'Wayfarer Mapから抽出したCSV':'自作CSV';add(label,true);appendSearchContext(label);if(source==='mymaps'){add('My Mapsから書き出したCSVはMy Mapsでしか読み取れません。Wayfarer Mapから抽出するか、自作CSVを使用してください。',false,faqActions());return}add('そのCSVの中身を確認してください。',false,faqActions())}
    function faq(v,auto=false,hit=[]){q=v;c=v.c;mode='faq';if(auto)add('ご質問は「'+v.q+'」として案内します。',false,null,hit&&hit.length?'一致: '+hit.join('・'):null);else add(v.q,true);if(v.id==='FAQ-38'){add(v.a,false,[{label:'My Mapsから書き出したCSV',onClick:()=>csvSource('mymaps')},{label:'Wayfarer Mapから抽出したCSV',onClick:()=>csvSource('wayfarer')},{label:'自作CSV',onClick:()=>csvSource('custom')}]);return}add(v.a,false,faqActions())}
    async function rate(ok){if(!q)return;const x=q;await save({type:'question',category:x.c,faq_id:x.id,resolved:ok,content:(ok?'FAQ回答で解決: ':'FAQ回答で解決しなかった: ')+x.q});if(ok){clarify=0;searchContext='';persist();add('解決できてよかったです。ほかにお困りのことがあれば、いつでもご利用ください。',false,[{label:'最初に戻る',onClick:home}])}else{rejected.add(x.id);const baseContext=[searchContext,x.q].filter(Boolean).join(' ').trim();persist();add('承知しました。次の方法を選択してください。',false,[{label:'別の方法を試す',onClick:()=>{startTextSearch(baseContext);add('別の候補を探します。状況を短く入力してください。',false);i.focus()}},{label:'もう少し状況を伝える',onClick:()=>{startTextSearch(baseContext);add('追加の状況を入力してください。これまでの内容と合わせて確認します。',false);i.focus()}},{label:'問い合わせる',kind:'bad',onClick:()=>inquiryConfirm(baseContext)}])}}

    function guideHome(){mode='guide';add('最初から案内して',true);add('どこから案内を開始しますか？',false,[{label:'最初から作る',onClick:()=>guideStep('candidate')},{label:'途中から続ける',onClick:guidePick},{label:'最初に戻る',onClick:home}])}
    function guidePick(){add('現在の工程を選択してください。',false,FLOW.map(x=>({label:x[1],onClick:()=>guideStep(x[0])})))}
    function guideStep(k){step=k;mode='guideStep';const idx=FLOW.findIndex(x=>x[0]===k),name=FLOW[idx][1],bar=FLOW.map((x,j)=>j<idx?'✓':j===idx?'●':'○').join(' ');add(name,true);const copy={candidate:'まずキャンプサイト候補地を決めます。候補地の条件を確認し、現地の状況も確認してください。',poi:'必要なPOIを準備します。Wayfarer Mapから取得できないPOIは、必要に応じて手動で追加します。',mymaps:'Google My MapsでPOIと活動範囲を整えます。POIは種類に沿ったレイヤーへ配置してください。',distance:'完成KMZを使って距離チェックを行います。現地環境チェックは該当する項目だけ選択すれば問題ありません。',submit:'距離チェックの確認が終わったら、提出用データを確認して申請へ進みます。'}[k];const b=[{label:'困った',onClick:()=>stepHelp(k)},{label:'全体を見る',onClick:()=>add(FLOW.map((x,j)=>(j+1)+'. '+x[1]).join('\n'),false)}];if(idx<FLOW.length-1)b.unshift({label:'次へ',onClick:()=>guideStep(FLOW[idx+1][0])});add(copy,false,b,'進捗 '+bar);persist()}
    function stepHelp(k){c=k==='candidate'?'other':k;clarify=0;searchContext='';add('この工程でよくある質問を確認します。近いものを選ぶか、状況を入力してください。',false,f.filter(v=>v.c===c).slice(0,4).map(v=>({label:v.q,onClick:()=>faq(v)})));mode='searchText';persist();i.focus()}

    function inquiryConfirm(text){mode='inquiry';const base=(String(text||'').trim()||searchContext||(q&&q.q)||'').trim(),tried=[...rejected].join(', ')||'なし',summary='問い合わせ内容：'+(base||'入力してください')+'\n試したFAQ：'+tried+'\n現在の工程：'+(step||'未指定'),actions=[];if(base)actions.push({label:'この内容で問い合わせる',onClick:()=>sendInquiry(base)});actions.push({label:'内容を入力・修正する',onClick:()=>{mode='inquiryEdit';i.value=base;i.focus()}});add('問い合わせ内容をご確認ください。必要であれば入力欄で内容を補足・修正してから送信してください。',false,actions,summary);persist()}
    async function sendInquiry(text){const content=String(text||'').trim();if(!content){mode='inquiryEdit';add('問い合わせ内容を入力してください。',false);i.focus();return}const history=trail.slice(-12).join('\n'),full=content+'\n\n【Botで確認した内容】\n'+history,ok=await save({type:'question',category:c||'other',faq_id:q?q.id:null,resolved:false,content:full});add(ok?'お問い合わせを受け付けました。担当者が確認します。':'送信に失敗しました。通信状況を確認して、もう一度お試しください。',false,[{label:'最初に戻る',onClick:home}]);q=null;mode='home';clarify=0;searchContext='';persist()}

    async function submit(){const t=i.value.trim();if(!t)return;i.value='';add(t,true);if(imp){const ok=await save({type:'improvement',category:c||'other',content:t});add(ok?'ご要望を受け付けました。今後の改善に活用します。':'送信に失敗しました。もう一度お試しください。',false,[{label:'最初に戻る',onClick:home}]);imp=false;return}if(mode==='inquiryEdit'){inquiryConfirm(t);return}if(mode==='inquiry'){sendInquiry(t);return}if(mode==='faq'&&q){rejected.add(q.id);searchContext=[searchContext,q.q].filter(Boolean).join(' ').trim();q=null;mode='searchText';persist()}thinking(()=>doSearch(t))}

    function resume(){add('前回の続きから',true);if(step&&mode==='guideStep'){guideStep(step);return}if(mode==='faq'&&q){faq(q);return}if(mode==='inquiry'||mode==='inquiryEdit'){inquiryConfirm(searchContext||(q&&q.q)||'');return}if(mode==='searchText'&&searchContext){add('前回の質問内容を引き継いでいます。続けて状況を入力してください。',false,null,'検索中の内容：'+searchContext);i.focus();return}searchHome()}
    function open(){m.innerHTML='';if(restore()){add('前回のサポート履歴があります。',false,[{label:'前回の続きから',onClick:resume},{label:'新しく始める',onClick:reset}])}else home()}

    l.onclick=()=>setTimeout(open,0);
    s.onclick=submit;
    i.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();submit()}};
    window.CampsiteSupportMenuInit=init;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else setTimeout(init,0);
})();
