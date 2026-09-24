# Campsite Bridge Confidentiality / Integration Policy

This document defines the security boundary for Campsite Bridge, especially when it interoperates with Wayfarer Map Mods (WFMM) or any other third-party script/extension.

## Core rule

Campsite Bridge must never expose Campsite Design Tool confidential decision logic to code running on the Wayfarer page.

The Wayfarer-side Bridge runtime is treated as an untrusted/public execution environment. Any third-party script running in the same page context may be able to observe DOM changes, globally exposed JavaScript state, network destinations, or other runtime behavior.

## What is allowed on the Wayfarer side

Only the minimum data-collection and transfer responsibilities belong in the Wayfarer-side runtime:

- Detect and collect POI/Wayfarer data required by Campsite Bridge.
- Deduplicate collected POIs by stable identifiers where available.
- Show Bridge status and basic collection state.
- Transfer only the minimum required POI data to Campsite Design Tool.
- Detect an already-installed WFMM instance and prefer it over any bundled/fallback map visualization.
- Avoid duplicate WFMM/Bridge overlays.

## What must stay inside Campsite Design Tool

The following must not be embedded in, transmitted to, or reconstructable from the Wayfarer-side Bridge runtime unless explicitly approved in a future security review:

- Internal campsite-design rules.
- Distance/spacing policy logic, including the 50 m design method and any related thresholds.
- Placement decision logic.
- Scoring, ranking, evaluation, or recommendation algorithms.
- Internal CA operating rules or unpublished guidance.
- Private development notes, unpublished features, or confidential reference material.
- Any algorithm whose disclosure would reveal how Campsite Design Tool makes design decisions.

The security goal is that inspecting the Wayfarer-side Bridge should reveal at most that it collects POIs and sends the minimum required data to Campsite Design Tool, not how Campsite Design Tool evaluates those POIs.

## Third-party integration policy

When WFMM or another third-party script is present:

1. Existing user installations take priority. Bridge must not replace or modify an existing WFMM installation.
2. Bridge must avoid starting a second copy of equivalent map functionality when an existing WFMM instance is detected.
3. Third-party settings, storage, and user preferences must not be rewritten by Bridge.
4. Third-party code must not receive Campsite Design Tool internal rules or confidential configuration.
5. Before bundling third-party code, confirm the license/re-distribution terms and review its external communications.

## External communication review

Before bundling or tightly integrating any third-party code, review at minimum:

- `fetch` / XHR destinations
- WebSocket connections
- analytics / telemetry
- image or beacon requests
- userscript `@require`, `@connect`, update/download URLs
- dynamically loaded JavaScript
- remote configuration that can change executable behavior

Where feasible, executable third-party code should be packaged locally after license approval rather than fetched and executed remotely at runtime.

## Data minimization

Bridge should transmit only the fields that Campsite Design Tool actually requires. Confidential evaluation rules must be applied after the data reaches Campsite Design Tool, not before.

Do not add new Wayfarer-side derived fields if they disclose internal design criteria. If a new calculation can be performed safely inside Campsite Design Tool, keep it there.

## Review requirement

Any change that moves Campsite Design Tool logic into the Wayfarer-side runtime, exposes new global state, adds a new external endpoint, or bundles new third-party executable code requires an explicit security/confidentiality review before release.

## Practical architecture

```text
Wayfarer page
  ├─ WFMM (existing installation preferred)
  └─ Campsite Bridge
       ├─ POI acquisition
       ├─ minimal normalization / deduplication
       └─ transfer
                │
                ▼
Campsite Design Tool
  ├─ confidential distance / placement logic
  ├─ evaluation and recommendation logic
  └─ internal CA design rules
```

The boundary above is intentional and must be preserved.
