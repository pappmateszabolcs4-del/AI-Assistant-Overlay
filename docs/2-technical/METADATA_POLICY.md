# Metadata Policy (Low Risk)

Last updated: 2026-05-15

## Non-legal note
This is implementation guidance, not legal advice.

## Low-risk principles
- Metadata is used solely for application interoperability and game identification.
- Cached metadata is not exposed or exportable.
- No third-party redistribution API.
- Only minimal required fields are stored.
- Metadata can be refreshed or purged.

## Recommended model
- Sources: local manifests + running exe.
- Outputs: title + appId + install path.
- Cache: small, user-specific, with TTL.
- Artwork: runtime fetch only, optional, cache-limited.
- No global dataset or offline catalog shipped with the app.

## Monetization guardrails (MUST)

- No bundled datasets or offline catalogs from third parties.
- No artwork packs or bulk asset redistribution.
- No public metadata API or bulk backend aggregation.
- Only minimal, user-local metadata with TTL and purge.
- Runtime fetch only for artwork; keep caches small and time-limited.
- Commercial use of third-party sources requires explicit licensing.

### Target state (monetization-safe)

- Target state: first-party core registry + user-local memory + opt-in, reviewed community hints + runtime hydration.
- Not allowed: global IGDB dump, offline catalog, bulk artwork pack, public metadata API.
- Moat: personalization + workflow + overlay intelligence, not a "every-game DB".
- Project: monetizable desktop game assistant overlay.
- Problem: offline global third-party dataset (IGDB) is a runtime dependency -> monetization/legal risk.

### Decision points (canonical)

- Global dataset: no runtime global dataset (minimize legal/monetization risk).
- Data sources: local manifests + exe mapping + user-local cache + optional runtime lookup (compliance-safe, scalable).
- Community knowledge: opt-in, reviewed patch layer (not a full DB).
- Moat focus: personalization + workflow + overlay intelligence (defensible IP).

### 3-phase plan

- Stop the bleeding: remove global dataset dependency; keep local manifests + exe mapping + user-local cache only.
- Safe knowledge: minimal first-party core + user-local memory + reviewed community hints.
- Platformization: first-party ecosystem (automation, OCR packs, workflows) with metadata as descriptor only.

## Explicitly avoid
- Full store catalog mirrors.
- Bundled artwork packs.
- Offline dumps of third-party store metadata.
- First-run bulk dataset downloads (even if installer ships empty).
- Backends that function as metadata mirrors or bulk redistribution.
