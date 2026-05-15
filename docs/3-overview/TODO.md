# ✅ TODO / Backlog

Last updated: 2026-05-15

## Top candidates (next)

 - [ ] Multi-monitor optimization (full scope)
  - [x] Display registry: stable displayId, workArea/bounds, scaleFactor, rotation
  - [x] Canonical layout: per-monitor normalized rects (x,y,w,h in 0..1)
  - [x] DPI-aware restore: map normalized rects to monitor workArea
  - [~] Game-monitor binding: overlay follows active game display (stabilized, still tuning)
  - [x] Hot-plug + reflow: clamp/reposition on monitor change
  - [x] Recovery rules: fallback to primary if target monitor is missing
  - [x] Storage migration: convert legacy absolute positions (overlay/note/info/pinned/detached/block)
  - [~] Debug map logging + validation (no visual overlay yet)


## Recently completed

- [x] Worker-based game detection to remove drag stutter
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

 - [ ] Game-aware detection + UX (long-term)
  - Multi-signal detection: window title + exe + process path + window class + recent focus
  - Title normalization + fuzzy match (strip launcher/edition/suffix noise)
  - Augment data sources: IGDB + Steam/Epic/GoG metadata for exe/display-name mapping
  - Coupled UX: "What game is this?" prompt builds local mapping -> then offer per-game templates (next steps/build/boss)
    - Local mapping storage (window title/exe/shortcut -> game name)
    - Unknown prompt UI + IPC (collect answer, persist mapping)
    - Detection hook to prefer learned mapping over Unknown
    - Template source + fallback to generic prompts when missing
  - Stickiness: keep last recognized game for a short window to avoid flapping
  - Optional vision fallback with explicit consent + privacy guardrails
 - [ ] Per-game layout profiles
  - Save/apply per detected game: layout mode, panel order (and optionally open/detached state)
  - Depends on Coupled UX (Unknown -> mapping) for reliable game identity
- [ ] Multi-monitor optimization (full scope)
  - [x] Display registry: stable displayId, workArea/bounds, scaleFactor, rotation
  - [x] Canonical layout: per-monitor normalized rects (x,y,w,h in 0..1)
  - [x] DPI-aware restore: map normalized rects to monitor workArea
  - [~] Game-monitor binding: overlay follows active game display (stabilized, still tuning)
  - [x] Hot-plug + reflow: clamp/reposition on monitor change
  - [x] Recovery rules: fallback to primary if target monitor is missing
  - [x] Storage migration: convert legacy absolute positions (overlay/note/info/pinned/detached/block)
  - [~] Debug map logging + validation (no visual overlay yet)

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
