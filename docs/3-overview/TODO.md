# ✅ TODO / Backlog

Last updated: 2026-05-10

## Top candidates (next)

 - [ ] Per-game layout profiles
  - Save/apply per detected game: layout mode, panel order (and optionally open/detached state)


## Recently completed

- [x] Add volume control for TTS
- [x] Basic unit tests (3-5 critical paths)
- [x] Reduce offline IGDB dataset size (minify/prune/gzip) without losing match quality
- [x] Unify UI translation sources (overlay/index/detached/aux windows)
- [x] Modularize overlay renderer script
- [x] Restructure IPC handlers (clear domain ownership)
- [x] Context-aware error messages
- [x] Configurable game detection ignore list (UI + IPC)
- [x] Split registry by domain (overlay, detached, pinned, note/info)
- [x] Block-based layout with detachable blocks

## Roadmap

### Release readiness

- [ ] Remove openDevTools() from production
- [ ] Create Windows installer (NSIS/MSI)
- [ ] Code sign executable (EV certificate)
- [ ] Auto-update mechanism (electron-updater)
- [ ] Privacy policy document
- [ ] Terms of service




### v2.0 (Q2 2026)

- [ ] User feedback integration
- [ ] Refactor overlay.html → React
- [ ] Plugin API for game mods
- [ ] Cloud sync for settings
- [ ] Advanced game profiles

## UX

- [ ] Per-game layout profiles
  - Save/apply per detected game: layout mode, panel order (and optionally open/detached state)
- [ ] Prompt templates per game
  - One-click question templates tailored to the detected game (e.g., "next steps", "build advice", "boss prep")
- [ ] Pinned history search/filter
  - Keyword search across history questions/answers; optional pinned-only filter
- [ ] Hotkey customization UI
- [ ] Accessibility keyboard navigation
- [ ] Multi-account support

## Infra

- [x] Better reload safety guard
- [x] Overlay performance instrumentation

## AI

- [ ] AI Vision: Video recording recognition
  - [ ] Define the exact flow: capture (source), sampling rate, and retention policy
  - [ ] Add a dedicated service module (services/vision-video.js) for video frame extraction
  - [ ] Implement incremental frame-to-Vision analysis (batch or rolling window)
  - [ ] Add UI controls (start/stop recording + status) with 8-language translations
  - [ ] Add privacy and storage notes (explicit consent, local retention limits)
