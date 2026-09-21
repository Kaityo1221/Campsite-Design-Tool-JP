# Campsite Bridge PC Minimum Spec v1

Updated: 2026-09-21  
Scope: Month-end PC Bridge minimum release  
Repository: `Kaityo1221/Campsite-Design-Tool-JP`

## 1. Goal

PC users must be able to send the POIs currently collected from the Wayfarer map into the same Campsite Bridge Receiver used by the mobile paths.

The PC path must converge on the existing contract:

```
Wayfarer
  -> Campsite Bridge PC
  -> CAMPSITE_BRIDGE_POI_V1
  -> bridge-receiver.html
  -> Receiver Adapter
  -> campsiteProject.v1
  -> CREATIVE MODE
```

The canonical Project key is `campsiteProject.v1`.

PC must not introduce a PC-only Receiver protocol, Adapter schema, or Project schema.

## 2. Supported environment for the month-end release

Formal target:

- Desktop Google Chrome stable
- Windows 11
- macOS current stable

Not a month-end requirement:

- Microsoft Edge
- Firefox desktop
- Safari desktop
- Chromebook
- Chrome Web Store publication

Those may be added after the presentation once the Chrome path is stable.

## 3. Installation form

Campsite Bridge PC is a **Chrome extension using Manifest V3**.

For the month-end release, the minimum distribution form is:

```
downloads/campsite-bridge-pc-0.1.0.zip
```

The ZIP is extracted locally and loaded from Chrome's extension management page using Developer Mode / Load unpacked.

Chrome Web Store distribution is a later release task and must not block the month-end demo.

Campsite Bridge PC must not depend on:

- Tampermonkey
- Userscripts
- the legacy Base / S2 Cells install flow
- manual CSV export/import

The old script-install guide is not the installation path for Campsite Bridge PC.

## 4. Wayfarer scope

The extension is active only on:

```
https://wayfarer.scopely.com/*
https://wayfarer.nianticlabs.com/*
```

The extension must not request broad all-sites access.

The month-end implementation should use the minimum Chrome permissions needed for:

- running the Bridge UI on Wayfarer
- collecting the currently available map POIs
- opening the Campsite Bridge Receiver
- exchanging messages with the Receiver

Avoid permissions that are not needed by the above flow.

## 5. User interface

When the Wayfarer Map page is ready, show one Campsite Bridge entry:

```
🌉 Bridge
```

Minimum states:

- Ready
- Collecting POIs
- Opening Campsite
- Sending
- Complete
- Error / Retry

The Bridge UI must not replace or modify the normal Wayfarer navigation.

One click/tap on Bridge starts the handoff. The user must not need to download a CSV.

## 6. POI collection boundary

The collector returns the POIs currently available to the Bridge from the Wayfarer map session.

The PC implementation must normalize each POI into the same fields accepted by the Receiver:

- `guid`
- `title`
- `lat`
- `lng`
- `gameEntity`
- `gameStatus`
- `sponsored`
- `smr`
- `imageUrl`
- `description`
- `s2L14`
- `s2L17`
- `provenance[]`

Allowed `gameEntity` values:

```
POKESTOP
GYM
POWERSPOT
```

The Bridge may omit optional metadata when Wayfarer does not provide it. The Receiver remains responsible for validation and normalization.

Duplicate GUIDs must not become duplicate Campsite POIs.

## 7. Selected map context

The payload should include the current Wayfarer map context when available:

```
selectedBounds.center.lat
selectedBounds.center.lng
selectedBounds.zoom
```

This is used only to restore a useful starting view on the Campsite polygon-selection map.

Failure to read map context must not block POI transfer.

## 8. Receiver endpoint

The PC Bridge uses the existing Receiver implementation.

Receiver path:

```
/bridge-receiver.html
```

Current handoff query contract:

```
?campsiteBridgeDev=1&handshake=<HANDSHAKE_ID>
```

The `campsiteBridgeDev` name is retained for compatibility in the month-end release. Renaming the public Receiver parameter is not part of the PC minimum implementation.

The extension must build the Receiver URL from the production Campsite Design Tool origin. Do not create a second PC-specific Receiver page.

## 9. Handshake

For each send operation:

1. Generate a new `handshakeId`.
2. Open the Receiver while keeping a Window reference.
3. Wait for:
   `CAMPSITE_BRIDGE_READY_V1`
4. Confirm the same `handshakeId`.
5. Send:
   `CAMPSITE_BRIDGE_POI_V1`
6. Wait for:
   `CAMPSITE_BRIDGE_ACK_V1`
7. Confirm the same `handshakeId`.
8. Treat the handoff as complete only when `accepted === true`.

The Receiver already repeats ACK messages. The PC sender may retry the payload when READY was received but ACK was not observed, as long as the same `handshakeId` is reused for that send operation.

## 10. Payload

Minimum top-level payload:

```js
{
  type: 'CAMPSITE_BRIDGE_POI_V1',
  bridgeVersion: '0.1.0',
  bridgePlatform: 'pc',
  schemaVersion: '1.2',
  handshakeId,
  selectedBounds,
  autoContinue: true,
  pois
}
```

The payload contract is shared with the existing Bridge Receiver. Do not invent `CAMPSITE_BRIDGE_PC_*` protocol names.

## 11. Safety against wrong-window / wrong-session delivery

The sender must validate:

- Receiver message origin
- message type
- `handshakeId`

The Receiver validates the Wayfarer origin and handshake.

A message from another window/session must not complete the current handoff.

## 12. Failure behavior

### No POIs

Do not open the Receiver.

Show:

```
POIを取得できませんでした。Wayfarer Mapを表示してからもう一度お試しください。
```

### Popup blocked

Keep the user on Wayfarer and offer Retry.

Do not discard the collected POI snapshot immediately.

### Receiver READY timeout

Show connection failure and allow Retry.

### Receiver rejects payload

Show that the transfer failed and keep Wayfarer usable.

### ACK timeout

Allow resend using the same handoff session before creating a new session.

No error path may navigate the Wayfarer tab away from Wayfarer.

## 13. Successful handoff

On accepted ACK:

- Wayfarer stays open.
- Receiver continues automatically to Gateway.
- Gateway uses the existing polygon-selection screen.
- The standard Bridge flow continues to `campsiteProject.v1` and CREATIVE MODE on iPhone, Android, and PC.
- The old virtual-CSV path is retained only as a hidden emergency fallback through `campsiteBridgeLegacyFlow.v1`.

PC-specific code ends at a successful Receiver handoff.

## 14. Files planned for implementation task 6

Minimum implementation layout:

```
bridge-pc/
  manifest.json
  content.js
  page-collector.js
  bridge-ui.js

scripts/
  build-pc-bridge.mjs
  check-pc-bridge.mjs

downloads/
  campsite-bridge-pc-0.1.0.zip
```

The exact internal split may be reduced if a smaller implementation is cleaner, but the public behavior and protocol in this document are fixed.

## 15. Definition of done for task 6

Task 6 is complete when all of the following are true:

- Chrome loads the unpacked extension without errors.
- Wayfarer Map displays `🌉 Bridge`.
- Bridge collects at least PokéStop / Gym / PowerSpot data exposed by the current map session.
- Clicking Bridge opens the existing Receiver.
- READY / payload / ACK handshake succeeds.
- Receiver shows the correct received count.
- Receiver automatically reaches Gateway.
- Existing Android and iPhone Receiver behavior is unchanged.
- No manual CSV is required.
- No Tampermonkey / Userscripts dependency is introduced.
