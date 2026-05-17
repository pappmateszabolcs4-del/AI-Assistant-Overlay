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

## Explicitly avoid
- Full store catalog mirrors.
- Bundled artwork packs.
- Offline dumps of third-party store metadata.
