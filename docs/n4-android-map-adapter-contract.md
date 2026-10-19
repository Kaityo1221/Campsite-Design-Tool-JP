# N4 Android Map Adapter contract

N4 keeps the public Android 0.3.5 package unchanged. The unsigned N4 candidate may add an adapter, but it must obey this contract.

## Purpose

Expose the Wayfarer Google Maps instance already used by the Android page layer to the shared polygon controller through:

```js
window.CampsiteBridgeWayfarerMapAdapter.findMap(document)
```

## Ownership

- Wayfarer/WFMM owns POI display.
- Android page-hook keeps GCS collection ownership.
- The adapter does not fetch POIs, create POI markers, alter filters, or send Receiver payloads.
- The polygon controller may draw only the project polygon geometry and its edit handles/crosshair.
- No refresh/re-observation/diff/merge behavior is introduced.

## Resolution order

The adapter may use only live map objects already present in the page/runtime. It must not create a second map.

1. A map object explicitly exposed by the Android page layer for N4.
2. A Wayfarer Google Maps instance discoverable from the existing page integration.
3. Otherwise return null and let the polygon UI report that the map is unavailable.

## Failure rule

Failure to resolve the map must never fall back to DOM/canvas POI scraping or Bridge-owned POI overlays.
