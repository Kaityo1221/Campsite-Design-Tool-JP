# Noah Android N4 / PC基準差分監査（2026-10-19）

**判定: HOLD。Android N4 0.3.7を正式配布・mainへマージしない。**

- PC参照：main@0e73b4984fc3719f1a4ee08c35854d8f76ff3397（10/18のPR #369、#370を含む）。
- Android候補：PR #338 feature/n4-android-pc-parity@672ccc699646f2c62261a6c4ef3ef6385ea09a47。
- 仕様書候補：PR #371 docs/noah-pc-reference-baseline-2026-10-19.md（Draft、main未統合）。
- 証拠：ソース読み取り・Git blob SHA比較・隔離合成監査。Android Firefox実機、ログイン済GCS、署名済N4は未検証。

## 結論

**Android N4は全体が古いのではない。** 0.3.7 builderはPCのpolygon controller / polygon UI / observation zone / acquisition engineをコピーしている。4モジュールともN4とPC基準のGit blob SHAが同一。問題はAndroid固有の取得・集約・Observation送信コーディネーターに集中する。

## 11項目マトリクス

| 基準 | 判定 | 根拠・不足 |
|---|---|---|
| R01 ポリゴン | STRUCTURAL / 実機未検証 | PC controller/UIを使い、イベント名だけAndroid向けに変更 |
| R02 200m/500m | **BLOCKER** | BUFFER_METERS=200は一致。ただしAndroid acquire() のcreatePlanにmaxTileMeters:500が指定されない |
| R03 完全性 | **BLOCKER** | responseVerifierがbodyTextの存在とGCS URL bounds一致だけでtrueを返し、GCS本文・source完全性を検証しない |
| R04 INTERIOR/REFERENCE_100/RESERVE_200 | MODULE SAME / 入力未検証 | PCのzone分類コードは完全一致。しかし入力POIの範囲・正規化・集約は別 |
| R05 対象POI/GUID | **BLOCKER** | latestPoisを直近SYNC_STATEのdata.poisで上書き。全タイル正規化とGUID重複排除、Inactive保持の証明なし |
| R06 Receiver/Handshake | STRUCTURAL / 実機未検証 | CAMPSITE_BRIDGE_POI_V1、既存Receiver通信を再使用。READY/ACK実機は別ゲート |
| R07 Project/Observation | **BLOCKER** | N4のacquisitionはbufferMeters/cellLevel/coverageCompleteだけ。PCのtransport/source/geometryCompleteness、bounds、tileCount、status等の診断が落ちる |
| R08 Inactive参照 | HOLD | 同じzone分類コード。ただし全件集約未証明。N4 branchには10/18追加のjs/bridge-observation-inactive.jsがない |
| R09 参照専用KMZ | HOLD | 10/18のCreative最新修正はmain。N4から最新Receiver/Creativeへの統合E2E未検証 |
| R10 古い観察の拒否 | HOLD | PC Creativeに範囲外安全停止あり。N4から完全な観察診断が来る保証なし |
| R11 50m円OFF | HOLD | PR #369修正はmainのみ。Androidフローからの最新Creative動作未検証 |

## Android固有の追加問題

- **F04 失敗後再試行**：lastCompletedSignatureをacquire成功前に固定し、失敗時にクリアしない。再度同じポリゴン状態イベントを送っても実行されない可能性。
- **F05 空POI**：Android canProceedはcoverageComplete===trueだけを使用。PCはvisibleTotal>0で判定するため、空観察でも「進める」となり得る。
- **F06 応答の帰属**：GCS URL boundsが一致した応答を待つが、request ID／セッション単位での全タイルスナップショット証明が未実施。
- **F07 観察キャッシュ**：lastObservationがある場合はbuildObservation()がそのまま返す。再観察とProject更新の一貫性は未検証。

## 改修方針（推奨順）

1. **R03: fail closed最優先。** 本文あり／HTTP成功／URL範囲一致をsourceComplete=trueとしない。GCS応答の意味上の完全性が検証できない場合はnullを維持し、coverageComplete=falseで安全停止。正しいresponseVerifierの仕様は実GCS検証後に設計する。
2. **R02: maxTileMeters:500指定**と実タイル分割・順次取得・失敗時STOP・元地図復帰のテスト。
3. **R05: PC同等のレスポンス正規化**、全タイルのGUID集合・Active/Inactiveの区別・重複除外。最後のSYNC_STATE表示キャッシュを全領域の証明に使わない。
4. **R07: Observation診断の完全化**。engineVersion, buffer/reference/reserve, cellLevel, acquisitionBounds, tileCount, geometryCoverageComplete, transportComplete, sourceComplete, coverageComplete, coverageStatusを保存し、canProceedは観察結果と正しい安全条件に合わせる。
5. **F04/F05: 再試行・空データ停止・セッション整合**。現行ユーザー情報や元KMZを上書きしない。
6. **R08-R11: 10/18最新main Receiver/Creativeで合成17 Active + 100 Inactive（50 INTERIOR/40 REFERENCE_100/10 RESERVE_200）を照合**。受信100、表示90、予備10、KMZ参照90、予備除外、編集データ非混入、50m OFF。
7. Android Firefox実機でログイン済Wayfarer・複数tile・転送・再読込・失敗復旧・旧版保護を確認。署名・配布はこの後。

## PC側に関する注意

PC collectPolygon() 自体もsource verifierが指定されないケースはunverifiedとなる。**PCが全GCSソース完全性をすでに保証しているという意味ではない。** 不明な状態をAndroidで勝手にtrueにするのが危険。PCの将来のsource完全性改善は別件として扱う。

## 安全境界

本監査PRはドキュメント・合成監査テストのみ。N4製品コード、署名済Android 0.3.5、未署名0.3.7、iPhone、PC、Creative、Receiver、main、保存データは変更しない。N4 PR #338とPhase 1はHOLDを維持。X-01/X-04は別ゲート。監査スクリプトがPASSでも**製品の実機PASSではない**。
