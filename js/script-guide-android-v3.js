(() => {
  'use strict';

  const MAP_MODS_URL = 'https://gitlab.com/Tntnnbltn/wayfarer-map-mods/-/raw/main/dist/wayfarer-map-mods.user.js';

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
        status.textContent = 'コピーしました。「URLからインポート」の入力欄に貼り付けてください。';
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
        <strong>📱 ここから先はFirefoxで操作します</strong>
        STEP 2以降は、Firefoxアプリ側で操作してください。<br>
        このマニュアルは開いたままにして、マニュアルとFirefoxを行き来しながら進めてください。
      </div>
      <div class="flow-arrow">↓</div>

      <div class="step">
        <div class="step-no">Android STEP 2</div>
        <h3>TampermonkeyをFirefoxに追加</h3>
        <p class="note">FirefoxでTampermonkeyのページを開き、「Firefoxへ追加」→「追加」の順に押してください。</p>
        <div class="script-guide-url">https://addons.mozilla.org/ja/firefox/addon/tampermonkey/</div>
        <a class="link-btn" href="https://addons.mozilla.org/ja/firefox/addon/tampermonkey/" target="_blank" rel="noopener">Tampermonkeyのページを開く</a>
        <div class="script-guide-callout info">ℹ️ 追加後に案内ページが開いても、そのページでは操作不要です。TampermonkeyがFirefoxに追加できたら次へ進んでください。</div>
      </div>

      <div class="flow-arrow">↓</div>
      <div class="step">
        <div class="step-no">Android STEP 3</div>
        <h3>Tampermonkeyを有効にして「設定」を開く</h3>
        <p class="note">Firefoxの拡張機能画面からTampermonkeyを開きます。</p>
        <ol class="note">
          <li>Firefox右上の「︙」を押す</li>
          <li>「拡張機能」を押す</li>
          <li>「拡張機能を管理」を押す</li>
          <li>一覧の「Tampermonkey」を押す</li>
          <li>「有効」がONになっていることを確認する</li>
          <li>「設定」を押す</li>
        </ol>
        <div class="script-guide-callout info">ℹ️ Tampermonkeyのページに「削除」と表示されている場合は、すでにFirefoxへ追加済みです。入れ直す必要はありません。</div>
      </div>

      <div class="flow-arrow">↓</div>
      <div class="step">
        <div class="step-no">Android STEP 4</div>
        <h3>設定モードを「初心者」にしてユーティリティを開く</h3>
        <ol class="note">
          <li>Tampermonkeyの設定画面で「設定のモード」を確認する</li>
          <li>「新参者」になっている場合は「初心者」に変更する</li>
          <li>画面上部のタブを横にスライドする</li>
          <li>「ユーティリティ」を押す</li>
        </ol>
        <div class="script-guide-callout info">ℹ️ 「ユーティリティ」は「設定」の右側に隠れていることがあります。上部の黒いタブ部分を横にスライドしてください。</div>
      </div>

      <div class="flow-arrow">↓</div>
      <div class="step">
        <div class="step-no">Android STEP 5</div>
        <h3>URLからWayfarer Map Modsを読み込む</h3>
        <p class="note">「ユーティリティ」を下へスクロールし、「URLからインポート」を探してください。入力欄に下のURLを貼り付けて、その下の「インストール」を押します。</p>
        <div class="script-guide-url" id="androidMapModsUrl">${MAP_MODS_URL}</div>
        <button type="button" class="script-guide-copy" onclick="copyAndroidScriptGuideUrl('androidMapModsUrl', 'androidMapModsStatus')">URLをコピー</button>
        <div id="androidMapModsStatus" class="script-guide-copy-status" aria-live="polite"></div>
        <details class="script-guide-trouble">
          <summary>スクリプトのコードがずらっと表示された場合</summary>
          <div>失敗ではありません。そのコード画面では操作せず、このSTEPの「ユーティリティ → URLからインポート」から進めてください。</div>
        </details>
      </div>

      <div class="flow-arrow">↓</div>
      <div class="step">
        <div class="step-no">Android STEP 6</div>
        <h3>表示された確認画面でインストール</h3>
        <p class="note">Wayfarer Map Modsの「ユーザースクリプトのインストール」画面が表示されたら、画面内の「インストール」を押してください。</p>
        <div class="script-guide-callout warn">⚠️ 注意文が表示されます。今回案内しているWayfarer Map ModsのURLから開いたことを確認して、「インストール」を押して進んでください。</div>
      </div>

      <div class="flow-arrow">↓</div>
      <div class="step script-step-complete">
        <div class="step-no">Android STEP 7</div>
        <h3>インストール完了を確認する</h3>
        <p class="note">「操作が正常に完了しました」と表示されたらインストール成功です。Tampermonkey上部の「インストール済みユーザースクリプト」を開き、<strong>Wayfarer Map Mods</strong> が一覧に表示され、有効がONになっていることを確認してください。</p>
        <div class="script-guide-callout info">ℹ️ 「Tam・サービスボット」が表示されても操作は不要です。普段は触りません。吹き出しは閉じても、そのままでも大丈夫です。</div>
        <p class="note">確認できたら、FirefoxでWayfarer Mapを開いてログインしてください。Wayfarer Map Modsの機能が表示されれば導入完了です。</p>
        <a class="link-btn" href="https://wayfarer.scopely.com/new/mapview?z=16" target="_blank" rel="noopener">FirefoxでWayfarer Mapを開く</a>
      </div>

      <div class="flow-arrow">↓</div>
      <div class="step script-step-next">
        <div class="step-no">NEXT STEP</div>
        <h3>POIを抽出する</h3>
        <p class="note">スクリプトの導入が完了したら、Wayfarer MapからPOIを抽出してください。<br>詳しい手順は、POI一括抽出マニュアルをご確認ください。</p>
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