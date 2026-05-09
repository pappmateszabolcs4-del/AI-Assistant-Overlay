# ✅ TODO / Backlog

Last updated: 2026-05-09

## Top candidates (next)



## Recently completed

- [x] Basic unit tests (3-5 critical paths)
- [x] Reduce offline IGDB dataset size (minify/prune/gzip) without losing match quality
- [x] Unify UI translation sources (overlay/index/detached/aux windows)
- [x] Modularize overlay renderer script
- [x] Restructure IPC handlers (clear domain ownership)
- [x] Context-aware error messages
- [x] Configurable game detection ignore list (UI + IPC)
- [x] Split registry by domain (overlay, detached, pinned, note/info)

## Release readiness

- [ ] Remove openDevTools() from production
- [ ] Create Windows installer (NSIS/MSI)
- [ ] Code sign executable (EV certificate)
- [ ] Auto-update mechanism (electron-updater)
- [ ] Privacy policy document
- [ ] Terms of service

## Roadmap v1.1 (Next Month)

- [ ] Replace history popup with inline expansion
- [ ] Fix 11 IPC listener duplications
- [ ] Add volume control for TTS
- [ ] User feedback integration

## Roadmap v2.0 (Q2 2026)

- [ ] Refactor overlay.html → React
- [ ] Plugin API for game mods
- [ ] Cloud sync for settings
- [ ] Advanced game profiles

- [ ] Per-game layout profiles
  - Save/apply per detected game: layout mode, panel order (and optionally open/detached state)
- [ ] Prompt templates per game
  - One-click question templates tailored to the detected game (e.g., "next steps", "build advice", "boss prep")
- [ ] Pinned history search/filter
  - Keyword search across history questions/answers; optional pinned-only filter

- [ ] Dockable widgets system ("everything everywhere")
  - Make UI modules (e.g., Note, layout mode, TTS toggle, specialization slider) movable between:
    - main overlay panels
    - detached windows (existing undock/dock)
    - optional pinned/standalone widgets
  - Safety rule (protect the default UX):
    - Each widget has a "home" area (origin).
    - When re-docking, it can ONLY go back to its home area (e.g., Settings widgets cannot be docked into Ask).
    - Default layouts cannot be corrupted by mixing widget categories.
    - Allow free-form mixing ONLY inside a clearly-separated user-created "Custom workspace / Composition mode".
      - This mode stores its own layout separately and cannot overwrite the default layout.
      - Users can build their own stitched/composed overlay there (your “összeillesztett” use-case).
  - Requirements (to avoid state/UX chaos):
    - Widget registry (id → render + capabilities + size constraints)
    - Single source of truth for settings/state (no duplicated sliders/toggles fighting)
    - Persisted per-user layout: widget placement + visibility + order
    - Safe defaults: Settings still contains everything; widgets are optional “extract/undock” views

## Other ideas

- [ ] Hotkey customization UI
- [ ] Better reload safety guard
- [ ] Overlay performance instrumentation
- [ ] Accessibility keyboard navigation
- [ ] AI Vision: Video recording recognition
  - [ ] Define the exact flow: capture (source), sampling rate, and retention policy
  - [ ] Add a dedicated service module (services/vision-video.js) for video frame extraction
  - [ ] Implement incremental frame-to-Vision analysis (batch or rolling window)
  - [ ] Add UI controls (start/stop recording + status) with 6-language translations
  - [ ] Add privacy and storage notes (explicit consent, local retention limits)
- [ ] Multi-account support
