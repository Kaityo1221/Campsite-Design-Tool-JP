# Campsite Bridge 3端末 E2E 実機チェック

更新: 2026-09-22

## 目的

iPhone / iPad、Android、PCの3経路が、同じ標準フローへ到達することを確認する。

標準フロー:

```
Wayfarer
  -> Campsite Bridge
  -> Receiver
  -> Gateway
  -> ポリゴン選択
  -> campsiteProject.v1
  -> CREATIVE MODE
  -> 距離チェック
```

## 共通合格条件

各端末で以下を満たせば合格。

- Wayfarer MapでBridgeを起動できる
- PokéStop / Gym / Power SpotがReceiverへ渡る
- Receiverで受信件数と変換後件数が一致する
- 自動でGatewayへ進む
- ポリゴンを描ける
- 「この範囲をCampsiteで使う」でCREATIVE MODEへ進む
- 選択した既存POIがCREATIVE MODEに復元される
- 50m / 40m / 30m円が利用できる
- 新規POIを追加できる
- POIを移動・削除・種別変更できる
- 「次へ」で距離チェックへ進める
- 「保存して作り直す」で同じProjectへ戻れる
- 前回の別Projectが混入しない

## iPhone / iPad

対象:

- Campsite Bridge Shortcut 1.0.0
- Safari
- 現行Shortcut Payload: schema 1.4

確認:

- SafariのWayfarerでShortcutを起動
- Receiverが前面へ切り替わる
- READY / Payload / ACKが成立する
- Gateway以降が標準Projectフローになる

実機結果:

- [ ] PASS
- [ ] FAIL
- 端末:
- iOS:
- 備考:

## Android

対象:

- Campsite Bridge M3.5 / 0.3.5
- Firefox
- Mozilla署名済みXPI

確認:

- Wayfarer MapにBridge UIが出る
- 現行M3.5からReceiverへ送信できる
- platform項目がない旧互換Payloadでも標準Projectフローへ進む
- Gateway以降でCSVへ戻らない

実機結果:

- [ ] PASS
- [ ] FAIL
- 端末:
- Android:
- Firefox:
- 備考:

## PC

対象:

- Campsite Bridge PC 0.1.0
- Google Chrome
- Manifest V3

確認:

- Wayfarer Map右下に「🌉 Bridge」が出る
- Bridgeを押すとReceiverが開く
- POI件数が一致する
- Wayfarer元タブがそのまま残る
- Gateway以降が標準Projectフローになる

実機結果:

- [ ] PASS
- [ ] FAIL
- OS:
- Chrome:
- 備考:

## 自動E2E

```
npm run check:bridge-3device-e2e
```

自動テスト対象:

- iPhone Shortcut 1.0.0 / schema 1.4互換
- Android M3.5 / 0.3.5 / schema 1.4
- PC Chrome 0.1.0
- Receiver -> Adapter
- handoffId
- 3種POI
- Project生成
- Next標準化
- Creative入口
- 50 / 40 / 30m
- 距離チェック入口

## リリース判定

3端末すべて実機PASS後に、Task 10を完全完了とする。

実機PASS前はコード契約上のE2E完了であり、リリース前最終確認は未完了として扱う。
