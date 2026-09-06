(() => {
  const MAP_MODS_URL = "https://gitlab.com/Tntnnbltn/wayfarer-map-mods/-/raw/main/dist/wayfarer-map-mods.user.js";
  const TAMPERMONKEY_URL = "https://addons.mozilla.org/ja/firefox/addon/tampermonkey/";

  function ensureScriptGuideV2Styles() {
    if (document.getElementById("scriptGuideV2Styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "scriptGuideV2Styles";
    style.textContent = `
      #script .script-guide-summary {
        margin: 14px 0 18px;
        padding: 13px 15px;
        border: 1px solid rgba(74, 222, 128, 0.32);
        border-radius: 15px;
        background: rgba(34, 197, 94, 0.08);
        color: #dcfce7;
        font-size: 13px;
        line-height: 1.7;
      }

      #script .script-guide-summary strong {
        color: #86efac;
      }

      #script .script-guide-handoff {
        margin: 10px 0;
        padding: 16px;
        border: 1px solid rgba(56, 189, 248, 0.4);
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(14, 165, 233, 0.13), rgba(30, 64, 175, 0.08));
        color: #dbeafe;
        font-size: 13px;
        line-height: 1.75;
      }

      #script .script-guide-handoff strong {
        display: block;
        margin-bottom: 6px;
        color: #bae6fd;
        font-size: 15px;
      }

      #script .script-guide-url {
        margin-top: 12px;
        padding: 12px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 12px;
        background: rgba(2, 6, 23, 0.72);
        color: #bfdbfe;
        font-size: 11px;
        line-height: 1.6;
        word-break: break-all;
        user-select: all;
      }

      #script .script-guide-copy {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 48px;
        margin-top: 12px;
        padding: 12px 14px;
        border: 1px solid rgba(74, 222, 128, 0.42);
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(34, 197, 94, 0.22), rgba(22, 163, 74, 0.15));
        color: #dcfce7;
        font: inherit;
        font-size: 14px;
        font-weight: 900;
        text-align: center;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      #script .script-guide-copy-status {
        min-height: 18px;
        margin-top: 8px;
        color: #86efac;
        font-size: 11px;
        text-align: center;
      }

      #script .script-guide-callout {
        margin-top: 14px;
        padding: 13px 14px;
        border-radius: 14px;
        font-size: 13px;
        line-height: 1.75;
      }

      #script .script-guide-callout.info {
        border: 1px solid rgba(96, 165, 250, 0.34);
        background: rgba(59, 130, 246, 0.1);
        color: #dbeafe;
      }

      #script .script-guide-callout.warn {
        border: 1px solid rgba(251, 191, 36, 0.34);
        background: rgba(245, 158, 11, 0.09);
        color: #fef3c7;
      }

      #script details.script-guide-trouble {
        margin-top: 12px;
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 15px;
        background: rgba(2, 6, 23, 0.38);
      }

      #script details.script-guide-trouble summary {
        padding: 13px 14px;
        color: #e2e8f0;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
      }

      #script details.script-guide-trouble div {
        padding: 0 14px 14px;
        color: #cbd5e1;
        font-size: 13px;
        line-height: 1.75;
      }
    `;

    document.head.appendChild(style);
  }

  window.copyScriptGuideUrl = async function (sourceId, statusId) {
    const source = document.getElementById(sourceId);
    const status = document.getElementById(statusId);

    if (!source) {
      return;
    }

    const value = source.textContent.trim();

    try {
      if (!navigator.clipboard || !window.isSecureContext) {
        throw new Error("clipboard unavailable");
      }

      await navigator.clipboard.writeText(value);

      if (status) {
        status.textContent = "コピーしました。Firefoxのアドレス欄に貼り付けてください。";
      }
    } catch (error) {
      if (status) {
        status.textContent = "URLを長押ししてコピーしてください。";
      }
    }
  };

  function setupScriptGuideV2() {
    const panel = document.querySelector("#script .panel");

    if (!panel || panel.dataset.scriptGuideV2 === "true") {
      return;
    }

    ensureScriptGuideV2Styles();
    panel.dataset.scriptGuideV2 = "true";

    panel.innerHTML = `
      <h2>スクリプト導入方法</h2>
      <p class="note">利用する端末を選んでください。<br>選択した端末に必要な手順だけを表示します。</p>

      <div class="script-guide-summary">
        <strong>現在は Wayfarer Map Mods 1本だけ導入すればOKです。</strong><br>
        旧手順の「Base」「S2 Cells」を別々にインストールする必要はありません。
      </div>

      <div class="script-device-grid">
        <button type="button" class="script-device-card" onclick="showScriptFlow('pc', this)">
          <span class="script-device-icon">💻</span><strong>PC版</strong><small>Chromeを使用</small>
        </button>
        <button type="button" class="script-device-card" onclick="showScriptFlow('iphone', this)">
          <span class="script-device-icon">🍎</span><strong>iPhone版</strong><small>Safariを使用</small>
        </button>
        <button type="button" class="script-device-card" onclick="showScriptFlow('android', this)">
          <span class="script-device-icon">🤖</span><strong>Android版</strong><small>Firefoxを使用</small>
        </button>
      </div>

      <div id="scriptFlowPc" class="script-flow">
        <div class="step">
          <div class="step-no">PC STEP 1</div>
          <h3>Tampermonkeyをインストール</h3>
          <p class="note">Chromeブラウザに、ユーザースクリプト管理用の拡張機能を追加します。</p>
          <a class="link-btn" href="https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=ja" target="_blank" rel="noopener">Tampermonkeyをインストール</a>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="step">
          <div class="step-no">PC STEP 2</div>
          <h3>Chromeの拡張機能設定を確認する</h3>
          <p class="note">Tampermonkeyを追加しただけでは、まだ設定が足りません。<br>Chromeの拡張機能画面で、以下の項目をONにしてください。</p>
          <ol class="note">
            <li>Chrome右上の「︙」を押す</li>
            <li>「拡張機能」を押す</li>
            <li>「拡張機能を管理」を押す</li>
            <li>画面右上の「デベロッパーモード」をONにする</li>
            <li>Tampermonkeyの枠内にある「詳細」を押す</li>
            <li>「ユーザースクリプトを許可する」をONにする</li>
          </ol>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="step">
          <div class="step-no">PC STEP 3</div>
          <h3>Wayfarer Map Modsをインストール</h3>
          <p class="note">下のボタンを押し、表示されたインストール画面で「インストール」を押してください。</p>
          <a class="link-btn" href="${MAP_MODS_URL}" target="_blank" rel="noopener">Wayfarer Map Modsをインストール</a>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="step script-step-complete">
          <div class="step-no">PC STEP 4</div>
          <h3>Wayfarer Mapで動作を確認する</h3>
          <p class="note">ChromeでWayfarer Mapを開き、Wayfarer Map Modsの機能が表示されれば導入完了です。</p>
          <a class="link-btn" href="https://wayfarer.nianticlabs.com/new/" target="_blank" rel="noopener">ChromeでWayfarer Mapを開く</a>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="step script-step-next">
          <div class="step-no">NEXT STEP</div>
          <h3>POIを抽出する</h3>
          <p class="note">スクリプトの導入が完了したら、Wayfarer MapからPOIを抽出してください。<br>詳しい手順は、POI一括抽出マニュアルをご確認ください。</p>
          <a class="link-btn" href="docs/poi-export-guide.pdf" target="_blank" rel="noopener">📍 POI一括抽出マニュアルを開く</a>
          <a class="link-btn" href="#" onclick="openTab('tool'); return false;">キャンプサイト作成へ戻る</a>
        </div>
      </div>

      <div id="scriptFlowIphone" class="script-flow">
        <div class="step">
          <div class="step-no">iPhone STEP 1</div>
          <h3>Userscriptsをインストール</h3>
          <p class="note">App StoreからUserscriptsアプリを追加します。</p>
          <a class="link-btn" href="https://apps.apple.com/jp/app/userscripts/id1463298887" target="_blank" rel="noopener">Userscriptsをインストール</a>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="step">
          <div class="step-no">iPhone STEP 2</div>
          <h3>Safariの機能拡張をONにする</h3>
          <p class="note">Userscriptsをインストールしただけでは、まだ使えません。<br>Safari側でも機能拡張をONにしてください。</p>
          <ol class="note">
            <li>Safariを開く</li>
            <li>Safari左上のメニューを押す</li>
            <li>「機能拡張を管理」を押す</li>
            <li>一覧にある「Userscripts」をONにする</li>
          </ol>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="step">
          <div class="step-no">iPhone STEP 3</div>
          <h3>Wayfarer Map Modsをインストール</h3>
          <p class="note">下のボタンをSafariで開き、Safari左上のメニューから「Userscripts」を押し、続けて「Tap to Install」を押してください。</p>
          <a class="link-btn" href="${MAP_MODS_URL}" target="_blank" rel="noopener">Wayfarer Map Modsをインストール</a>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="step script-step-complete">
          <div class="step-no">iPhone STEP 4</div>
          <h3>Wayfarer Mapで動作を確認する</h3>
          <p class="note">SafariでWayfarer Mapを開き、Wayfarer Map Modsの機能が表示されれば導入完了です。</p>
          <a class="link-btn" href="https://wayfarer.nianticlabs.com/new/" target="_blank" rel="noopener">SafariでWayfarer Mapを開く</a>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="step script-step-next">
          <div class="step-no">NEXT STEP</div>
          <h3>POIを抽出する</h3>
          <p class="note">スクリプトの導入が完了したら、Wayfarer MapからPOIを抽出してください。<br>詳しい手順は、POI一括抽出マニュアルをご確認ください。</p>
          <a class="link-btn" href="docs/poi-export-guide.pdf" target="_blank" rel="noopener">📍 POI一括抽出マニュアルを開く</a>
          <a class="link-btn" href="#" onclick="openTab('tool'); return false;">キャンプサイト作成へ戻る</a>
        </div>
      </div>

      <div id="scriptFlowAndroid" class="script-flow">
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
          このマニュアルを参照しながら、マニュアルとFirefoxを行き来して進めてください。
        </div>
        <div class="flow-arrow">↓</div>

        <div class="step">
          <div class="step-no">Android STEP 2</div>
          <h3>TampermonkeyをFirefoxに追加</h3>
          <p class="note">Firefoxアプリを開き、アドレス欄に以下のURLをコピーして貼り付けて開いてください。ページが開いたら「Firefoxへ追加」→「追加」の順に押してください。</p>
          <div class="script-guide-url" id="scriptTamperUrl">${TAMPERMONKEY_URL}</div>
          <button type="button" class="script-guide-copy" onclick="copyScriptGuideUrl('scriptTamperUrl', 'scriptTamperStatus')">URLをコピー</button>
          <div id="scriptTamperStatus" class="script-guide-copy-status" aria-live="polite"></div>
          <div class="script-guide-callout info">ℹ️ Tampermonkey追加後に案内ページが開いても、そのページでは操作不要です。このマニュアルへ戻って次のSTEPへ進んでください。</div>
          <details class="script-guide-trouble">
            <summary>「追加」が表示されない場合</summary>
            <div>Firefoxを一度終了して開き直し、同じURLをもう一度開いてください。</div>
          </details>
        </div>

        <div class="flow-arrow">↓</div>
        <div class="step">
          <div class="step-no">Android STEP 3</div>
          <h3>Wayfarer Map Modsを開く</h3>
          <p class="note">Firefoxアプリのアドレス欄に、以下のURLをコピーして貼り付けて開いてください。</p>
          <div class="script-guide-url" id="scriptModsUrl">${MAP_MODS_URL}</div>
          <button type="button" class="script-guide-copy" onclick="copyScriptGuideUrl('scriptModsUrl', 'scriptModsStatus')">URLをコピー</button>
          <div id="scriptModsStatus" class="script-guide-copy-status" aria-live="polite"></div>
          <div class="script-guide-callout warn"><strong>もし空白ページが出たら</strong><br>Discordなどの外部アプリから直接開いている可能性があります。Firefoxアプリを開き、上のURLをコピーしてアドレス欄に貼り付けてください。</div>
        </div>

        <div class="flow-arrow">↓</div>
        <div class="step">
          <div class="step-no">Android STEP 4</div>
          <h3>表示された画面でインストール</h3>
          <p class="note">前のSTEPで「ユーザースクリプトのインストール」画面が表示されたら、画面下部の「インストール」を押してください。</p>
          <div class="script-guide-callout warn">⚠️ 画面には注意文が表示されますが、今回案内しているURLから開いた場合はそのまま「インストール」を押して進んでください。</div>
        </div>

        <div class="flow-arrow">↓</div>
        <div class="step script-step-complete">
          <div class="step-no">Android STEP 5</div>
          <h3>Wayfarer Mapで動作を確認する</h3>
          <p class="note">FirefoxでWayfarer Mapを開き、Wayfarer Map Modsの機能が表示されれば導入完了です。</p>
          <a class="link-btn" href="https://wayfarer.nianticlabs.com/new/" target="_blank" rel="noopener">FirefoxでWayfarer Mapを開く</a>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="step script-step-next">
          <div class="step-no">NEXT STEP</div>
          <h3>POIを抽出する</h3>
          <p class="note">スクリプトの導入が完了したら、Wayfarer MapからPOIを抽出してください。<br>詳しい手順は、POI一括抽出マニュアルをご確認ください。</p>
          <a class="link-btn" href="docs/poi-export-guide.pdf" target="_blank" rel="noopener">📍 POI一括抽出マニュアルを開く</a>
          <a class="link-btn" href="#" onclick="openTab('tool'); return false;">キャンプサイト作成へ戻る</a>
        </div>
      </div>
    `;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupScriptGuideV2, { once: true });
  } else {
    setupScriptGuideV2();
  }
})();