# r31 PART B1 — POI接続のみ

PART Aソース109a1b0a6a66dc95ae88de72091f45a3fb611aab、証跡f271cf82d13bcf0b5fe01069cc3a8d0c3318967bを固定。既存engineとPART A原本を変更しない。build.cjsが凍結した表示controllerに6接続hookだけを付けて生成する。HTML/CSS/画像/templateは同じものを参照。UI表示codeの派生であり、編集engineの複製ではない。

## 接続契約

既存createIsolatedEditorSessionの明示承認済みactive Session（sourceIsolated、履歴0/0、保存未接続）を1つだけ、connectB1({session,ui,document,confirmEdit})へ渡す。UIはB1生成runtimeのcreativeR31。POI StoreはSession内の既存実装、Command BoundaryとRead Followerも既存moduleをそのまま使う。

Sessionの作成・KMZロード・保存はB1 UIに追加しない。初期Sessionは検査側/将来の承認済みhostから注入する。B1ページ単独では未接続HOLDで起動する。実データ入口・公開previewではない。

## 明示操作

- ＋は承認済み2段階。種類選択・位置preview・取消は無変更。追加/移動の確定buttonだけをdispatchする。
- 名前/メモinputは未確定draft。name Enterまたはfield changeでconfirmEditを呼び、確認にtrueを返した場合だけeditを1回実行。ブラウザ検査はnative確認dialogを使う。memo Enterは改行のまま、focus移動時に確認する。取消は無変更。
- 種類button、削除button、Undo/Redoは明示clickでdispatch。新規roleだけを許可。既存/不明/削除済みPOIへの変更はAdapterで拒否。
- 座標の新規確定はaddへ接続。既存source modeは拒否。入力Enterによるcamera previewはデータ変更なし。
- Session状態と履歴は一つ。request IDを接続期間中記憶し重複実行を拒否。確定ごとにread follower refreshを1回だけ行い、同じLeafletへ投影する。
- 外部Session変更と描画失敗は接続をHOLDに固定。自動rollback/retry、別履歴、別store、別mapを作らない。

保存/復元/prepare/export/活動範囲編集/申請理由applicationCommentは未接続HOLD。B2/B3/B4へ進まない。disposeは境界を停止しfollower解除、Adapter listener/draft/参照を解除してUI/mapも終了する。

## 検証

    node creative-next/qa/r31-b1/run.cjs

合成NEW_V1のみ、storage:null・locks:null、独立browser context、memory storage、通信遮断、force click0。実編集flowは接続状態で実測。PART A156/333/17はB1派生表示codeを未接続HOLD fixtureに差し替えて再測定する（PART Aの全データHOLD条件を保持するため）。接続後のデータ動作は別の実編集browser検査で確認する。元PART A JSONをbyte単位で戻し、B1結果だけを別保存する。

進捗85% / Phase 1 HOLD。保存・配信・main反映なし。Safari実機は未検証。
