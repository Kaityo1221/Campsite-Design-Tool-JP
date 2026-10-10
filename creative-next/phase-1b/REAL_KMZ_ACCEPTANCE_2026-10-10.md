# Creative Next: real KMZ iPhone acceptance and exception ledger (2026-10-10)

**Scope: isolated feature branch only. No production/main merge approval.**
All mobile results below are **user-reported iPhone Safari** results, not claims of independent instrumented iPhone execution.
Original uploaded KMZ files are not modified or replaced. Exception handling requires exact matching and explicit approval; this document does not authorize auto-cleanup on general imports.

## Kasai Rinkai Park

- Original legacy KMZ: 188 existing + 25 new POIs, 214 x 50m circles, one activity area.
- One circle named `50m 214` could not be uniquely assigned to any POI. The user confirmed it was not intentionally added and approved removing **only that circle from a conversion/test copy**.
- Audited copy: 213 POIs, 213 x 50m circles, one area. No other Placemark or ZIP asset is intended to be dropped.
- Reverse-winding 48-segment rings are verified by geometry (not accepted merely by filename).
- The user reported PASS for two flows: independent NEW_V1 test-candidate reimport/export/reimport, and direct legacy-to-NEW_V1-to-export/reimport on the cleaned old-format copy.
- No authorization to delete that circle from the original KMZ or from live saves.

## Hikarigaoka Park

- Original legacy KMZ: 199 existing + 12 new POIs, 211 x 40m circles, 422 x 50m circles, one activity area.
- 50m circles have a duplicated 211-item set: one duplicate with identical XML per original 50m ring. All 633 circles have unique POI centers; exactly 211 repeated owner/radius pairs.
- The user explicitly approved excluding **only the repeated 211 50m circles** from a separate conversion/test copy.
- Audited copy: 211 POIs, 211 x 40m circles, 211 x 50m circles, one activity area, 634 Placemarks.
- The user reported PASS for direct conversion of this cleaned old-format copy in isolated r12, export and reimport with matching counts.
- Of the 12 new POIs, nine are gyms and three are powers. Nine exceeds the regular new-gym cap (8); they are retained as legacy imported records. A tenth new gym is not permitted. Do not silently remove the ninth gym.
- No authorization to mutate original KMZ/live saves or to apply generic de-duplication.

## Safety and release gates

- Conversion is opt-in, in an isolated preview, with a verified import candidate and manual confirmation.
- Existing circular geometry must have verified ring shape, exact radius, identified unique owner and owner/radius uniqueness. Unknown/orphan/ambiguous circles remain HOLD.
- Original assets, POI IDs, roles, positions, activity polygons and metadata must be preserved, except for the precisely approved exclusions on conversion copies, recorded above.
- Generated files require restaging/diagnosis and source comparison; user-reported successful operations do not establish every conceivable source variant is supported.
- r10 basic interactive iPhone regression (edits, undo/redo, export/roundtrip, protected save/resume, invalid-input and invalid-KMZ HOLD) was user-reported PASS; r12 real-KMZ conversion flow for the two audited copies was user-reported PASS.
- **Phase 1-B remains HOLD** pending release review and any required negative recovery tests, further legacy variants, UI/regression gates, and the user's explicit approval. Do not merge into production/main.
