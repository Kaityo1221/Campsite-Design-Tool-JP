(() => {
  'use strict';

  const TAMPERMONKEY_URL = 'https://addons.mozilla.org/ja/firefox/addon/tampermonkey/';
  const MAP_MODS_URL = 'https://gitlab.com/Tntnnbltn/wayfarer-map-mods/-/raw/main/dist/wayfarer-map-mods.user.js';
  const GOOGLE_ACCOUNT_URL = 'https://accounts.google.com/';
  const WAYFARER_URL = 'https://wayfarer.scopely.com/new/mapview';

  window.copyAndroidScriptGuideUrl = async function (sourceId, statusId) {
    const source = document.getElementById(sourceId);
    const status = document.getElementById(statusId);

    if (!source) return;

    const value = source.textContent.trim();

    try {
      if (!navigator.clipboard || !window.isSecureContext) {
        throw new Error('clipboard unavailable');
      }

      await navigator.clipboard.writeText(value);

      if (status) {
        status.textContent = 'コピーしました。Firefoxの一番上にあるアドレス欄へ貼り付けてください。';
      }
    } catch (_) {
      if (status) {
        status.textContent = 'URLを長押ししてコピーしてください。';
      }
    }
  };

  function applyAndroidGuide() {
    const flow = document.getElementById('scriptFlowAndroid');

    if (!flow || flow.dataset.androidGuideV3 === 'true') {
      return false;
    }

    flow.dataset.androidGuideV3 = 'true';

    flow.innerHTML = `
      <div class="step">
        <div class="step-no">Android STEP 1</div>
        <h3>Firefoxをインストール</h3>
        <p class="note">Android版ではFirefoxブラウザを使用します。</p>
        <a class="link-btn" href="https://play.google.com/store/apps/details?id=org.mozilla.firefox" target="_blank" rel="noopener">Firefoxをインストール</a>
      </div>

      <div class="flow-arrow">↓</div>
      <div class="script-guide-handoff">
        <strong>📱 STEP 2以降はFirefox側で操作します</strong>
        Discordなどのアプリ内ブラウザではなく、Firefoxアプリを開いて進めます。<br>
        このマニュアルは残したまま、Firefoxと行き来しながら操作してください。
      </div>
      <div class="flow-arrow">↓</div>

      <div class="step">
        <div class="step-no">Android STEP 2</div>
        <h3>TampermonkeyをFirefoxに追加</h3>
        <p class="note">Firefoxで新しいタブを開き、<strong>画面一番上のアドレス欄</strong>に下のURLを貼り付けて開いてください。Googleの検索欄には貼り付けません。</p>
        <div class="script-guide-url" id="androidTamperUrl">${TAMPERMONKEY_URL}</div>
        <button type="button" class="script-guide-copy" onclick="copyAndroidScriptGuideUrl('androidTamperUrl', 'androidTamperStatus')">URLをコピー</button>
        <div id="androidTamperStatus" class="script-guide-copy-status" aria-live="polite"></div>
        <ol class="note">
          <li>Tampermonkeyのページが開いたら「Firefoxへ追加」を押す</li>
          <li>確認画面の「追加」を押す</li>
          <li>追加後に案内ページが開いても、そのページでは操作しない</li>
        </ol>
        <details class="script-guide-trouble">
          <summary>「Firefoxへ追加」や「追加」が表示されない場合</summary>
          <div>ページに「削除」と表示されている場合は、すでにTampermonkeyが追加済みです。入れ直す必要はありません。追加ボタンがうまく出ない場合は、Firefoxを一度終了して開き直し、このSTEPをもう一度試してください。スマートフォン本体の再起動までは通常不要です。</div>
        </details>
      </div>

      <div class="flow-arrow">↓</div>
      <div class="step">
        <div class="step-no">Android STEP 3</div>
        <h3>Tampermonkeyが有効か確認して「設定」を開く</h3>
        <p class="note">Firefoxの拡張機能一覧からTampermonkeyを開きます。</p>
        <ol class="note">
          <li>Firefox右上の「︙」を押す</li>
          <li>「拡張機能」を押す。折りたたまれている場合は展開する</li>
          <li>「拡張機能を管理」を押す</li>
          <li>一覧の「Tampermonkey」を押す</li>
          <li>「有効」がONになっていることを確認する</li>
          <li>「設定」を押す</li>
        </ol>
        <div class="script-guide-callout info">ℹ️ 「拡張機能」の下に黒いTampermonkeyアイコンの行が表示される場合があります。そこからTampermonkeyを開いても大丈夫です。</div>
      </div>

      <div class="flow-arrow">↓</div>
      <div class="step">
        <div class="step-no">Android STEP 4</div>
        <h3>設定モードを「初心者」にしてユーティリティを開く</h3>
        <ol class="note">
          <li>Tampermonkeyの設定画面で「設定のモード」を確認する</li>
          <li>「新参者」になっている場合は「初心者」に変更する</li>
          <li>画面上部の黒いタブ部分を横にスライドする</li>
          <li>「ユーティリティ」を押す</li>
        </ol>
        <div class="script-guide-callout info">ℹ️ 「ユーティリティ」は「設定」の右側に隠れていることがあります。横にスライドすると表示されます。</div>
        <div class="script-guide-callout info">ℹ️ 左上の「＋」は新しいスクリプトを自分で作るボタンです。今回は使いません。</div>
      </div>

      <div class="flow-arrow">↓</div>
      <div class="step">
        <div class="step-no">Android STEP 5</div>
        <h3>URLからWayfarer Map Modsを読み込む</h3>
        <p class="note">「ユーティリティ」を一番下付近までスクロールし、<strong>「URLからインポート」</strong>を探してください。入力欄に下のURLを貼り付け、その下の「インストール」を押します。</p>
        <div class="script-guide-url" id="androidMapModsUrl">${MAP_MODS_URL}</div>
        <button type="button" class="script-guide-copy" onclick="copyAndroidScriptGuideUrl('androidMapModsUrl', 'androidMapModsStatus')">URLをコピー</button>
        <div id="androidMapModsStatus" class="script-guide-copy-status" aria-live="polite"></div>
        <details class="script-guide-trouble">
          <summary>大量のスクリプトコードが表示された場合</summary>
          <div>失敗ではありません。そのコード画面をスクロールしたり編集したりする必要はありません。Tampermonkeyの「ユーティリティ → URLからインポート」へ戻り、このURLを直接読み込んでください。</div>
        </details>
      </div>

      <div class="flow-arrow">↓</div>
      <div class="step">
        <div class="step-no">Android STEP 6</div>
        <h3>確認画面でもう一度「インストール」</h3>
        <p class="note"><strong>Wayfarer Map Mods</strong> の「ユーザースクリプトのインストール」画面が表示されたら、画面内の「インストール」を押してください。</p>
        <div class="script-guide-callout warn">⚠️ 注意文が表示されます。画面上部にWayfarer Map Modsと表示されていることを確認してから「インストール」を押してください。</div>
      </div>

      <div class="flow-arrow">↓</div>
      <div class="step script-step-complete">
        <div class="step-no">Android STEP 7</div>
        <h3>Wayfarer Map Modsが入ったことを確認</h3>
        <p class="note">「操作が正常に完了しました」と表示されたらインストール成功です。</p>
        <ol class="note">
          <li>Tampermonkey上部の「インストール済みユーザースクリプト」を開く</li>
          <li><strong>Wayfarer Map Mods</strong> が一覧にあることを確認する</li>
          <li>左側の有効スイッチがONになっていることを確認する</li>
        </ol>
        <div class="script-guide-callout info">ℹ️ 「Tam・サービスボット」の吹き出しが表示されても操作不要です。閉じても、そのままでも大丈夫です。</div>
      </div>

      <div class="flow-arrow">↓</div>
      <div class="step script-step-complete">
        <div class="step-no">Android STEP 8</div>
        <h3>FirefoxでWayfarer Mapを開く</h3>
        <p class="note">Firefoxで新しいタブを開き、<strong>一番上のアドレス欄</strong>に下のURLを貼り付けてください。Googleの検索ボックスに貼り付けると検索結果になってしまうので注意してください。</p>
        <div class="script-guide-url" id="androidWayfarerUrl">${WAYFARER_URL}</div>
        <button type="button" class="script-guide-copy" onclick="copyAndroidScriptGuideUrl('androidWayfarerUrl', 'androidWayfarerStatus')">Wayfarer URLをコピー</button>
        <div id="androidWayfarerStatus" class="script-guide-copy-status" aria-live="polite"></div>
        <p class="note">サインインして地図が表示されたら、地図右側に<strong>「◀」</strong>の小さなボタンが出ているか確認してください。押したときに「Settings / Import Sponsored / Nearby Wayspots / Plugins」などが表示されれば、Wayfarer Map Modsは正常に動いています。</p>
        <details class="script-guide-trouble">
          <summary>Googleログインが真っ白になった場合</summary>
          <div>
            まずFirefoxの新しいタブを開き、画面一番上のアドレス欄に次のURLを直接入力してください。<br>
            <div class="script-guide-url" id="androidGoogleUrl">${GOOGLE_ACCOUNT_URL}</div>
            <button type="button" class="script-guide-copy" onclick="copyAndroidScriptGuideUrl('androidGoogleUrl', 'androidGoogleStatus')">Google URLをコピー</button>
            <div id="androidGoogleStatus" class="script-guide-copy-status" aria-live="polite"></div>
            Googleページが表示され、右上に自分のアカウントアイコンが出ればGoogleへのログインはできています。そのあと新しいタブでWayfarer URLをもう一度、Firefoxのアドレス欄へ直接入力してください。<br><br>
            <strong>ポイント：</strong>Googleの検索欄ではなく、Firefox画面最上部のアドレス欄へURLを入れます。
          </div>
        </details>
      </div>

      <div class="flow-arrow">↓</div>
      <div class="step script-step-next">
        <div class="step-no">NEXT STEP</div>
        <h3>POIを抽出する</h3>
        <p class="note">右側の「◀」が出てWayfarer Map Modsの動作を確認できたら、スクリプト導入は完了です。<br>次はPlugins・フィルター・Power Spot表示を設定して、Nearby WayspotsからCSVを取得します。</p>
        <a class="link-btn" href="docs/poi-export-guide.pdf" target="_blank" rel="noopener">📍 POI一括抽出マニュアルを開く</a>
        <a class="link-btn" href="#" onclick="openTab('tool'); return false;">キャンプサイト作成へ戻る</a>
      </div>
    `;

    return true;
  }

  if (applyAndroidGuide()) return;

  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    if (applyAndroidGuide() || Date.now() - startedAt > 5000) {
      window.clearInterval(timer);
    }
  }, 100);
})();