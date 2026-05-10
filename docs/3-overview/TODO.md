# ✅ TODO / Backlog

Last updated: 2026-05-10

## Top candidates (next)

 - [ ] Per-game layout profiles
  - Save/apply per detected game: layout mode, panel order (and optionally open/detached state)
 - [ ] Multi-monitor optimization
  - Ensure overlay + block windows respect per-monitor work areas and DPI
  - Persist per-monitor positions and restore safely


## Recently completed

- [x] Add volume control for TTS
- [x] History search/filter with pinned-only toggle (overlay + block windows)
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
- [ ] Crash reporting (opt-in) + minimal telemetry policy
- [ ] Release build smoke test checklist (clean VM)




### v2.0 (Q2 2026)

- [ ] User feedback integration
- [ ] Refactor overlay.html → React
- [ ] Plugin API for game mods
- [ ] Cloud sync for settings
- [ ] Advanced game profiles

## UX

- [ ] Per-game layout profiles
  - Save/apply per detected game: layout mode, panel order (and optionally open/detached state)
- [ ] Multi-monitor optimization
  - Ensure overlay + block windows respect per-monitor work areas and DPI
  - Persist per-monitor positions and restore safely
- [ ] Prompt templates per game
  - One-click question templates tailored to the detected game (e.g., "next steps", "build advice", "boss prep")
- [ ] Hotkey customization UI
- [ ] Accessibility keyboard navigation
- [ ] Multi-account support
- [ ] Consent UX for microphone + screenshot usage
- [ ] Safe mode / reset layout shortcut

## Infra

- [x] Better reload safety guard
- [x] Overlay performance instrumentation
- [ ] Settings export/import (backup + restore)
- [ ] Startup/perf profiling (release build)
- [ ] Hotkey conflict detection and messaging

## Security

- [ ] Dependency monitoring + lockfile audit policy (CVE alerts)
- [ ] Signed release artifacts + checksum publishing
- [ ] Auto-update security (signed updates + rollback)
- [ ] IPC payload validation + rate limiting for critical channels
- [ ] Local data retention policy (history/notes)
- [ ] Opt-in crash reporting with PII minimization
- [ ] Electron security hardening checklist (CSP, contextIsolation, sandbox)

## AI

- [ ] AI Vision: Video recording recognition
  - [ ] Define the exact flow: capture (source), sampling rate, and retention policy
  - [ ] Add a dedicated service module (services/vision-video.js) for video frame extraction
  - [ ] Implement incremental frame-to-Vision analysis (batch or rolling window)
  - [ ] Add UI controls (start/stop recording + status) with 8-language translations
  - [ ] Add privacy and storage notes (explicit consent, local retention limits)
