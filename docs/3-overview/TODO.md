# ✅ TODO / Backlog

Last updated: 2026-05-17

## Top candidates (next)

- [x] Dev/prod parity: single-source UI + automated diff check (stop drift)
  - [x] Merge dev/prod UI into one canonical template; dev uses a flag for debug-only UI
  - [x] Add script to diff dev/prod artifacts and fail on divergence
  - [x] Add CI/`npm run check` hook for the parity check
  - [x] Keep dev-only UI limited to debug panels/components

 - [x] Multi-monitor optimization (full scope)
  - [x] Display registry: stable displayId, workArea/bounds, scaleFactor, rotation
  - [x] Canonical layout: per-monitor normalized rects (x,y,w,h in 0..1)
  - [x] DPI-aware restore: map normalized rects to monitor workArea
  - [x] Game-monitor binding: overlay follows active game display
  - [x] Hot-plug + reflow: clamp/reposition on monitor change
  - [x] Recovery rules: fallback to primary if target monitor is missing
  - [x] Storage migration: convert legacy absolute positions (overlay/note/info/pinned/detached/block)
  - [x] Debug map logging + visual overlay

## IGDB data strategy (pending decision)

- [ ] Runtime cache
  - Idea: Query IGDB as needed and cache short-term for performance.
  - Why: Avoid bundled dumps; lower redistribution risk.

- [ ] First-run download
  - Idea: Installer ships empty; app pulls dataset on first run and stores locally.
  - Why: More defensible than bundling; still requires commercial clarity.

- [ ] Own backend (recommended long-term)
  - Idea: Server fetches IGDB and serves clients with strict control.
  - Why: Best control of licensing, rate limits, and monetization risk.


## Recently completed

- [x] Game-detect triggers tuned to event-driven flow
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
  - Status: focus-first detection, startup retry, focus-blur re-detect, background poll, unknown prompt, and stickiness are implemented.
  - Long-term detection plan (merged):
        - [x] Focus-first: only active window drives detection; unknown shows prompt
        - [x] Optional global fallback (off by default) for non-focused scan (env-only)
        - [x] Score-based decision (not pure title match)
        - [x] Title normalization + fuzzy match (strip launcher/edition/suffix noise)
        - [ ] Minimum-signal rule: title + exe/process path + window class must collectively reach the threshold
        - [ ] Browser/process category guard: block title-only matches for known browser processes
        - [ ] Mapping-first priority: prefer exe->game mapping (IGDB/Steam/Epic/GoG + learned), title is secondary
        - [ ] Stability threshold: require 2-3 consecutive matches before switching games
        - [ ] Overlay-focused guard: if overlay is active, skip detection and keep last recognized
        - [ ] Raise score threshold so title-only match is not enough
      - [ ] Augment data sources (policy-safe): local manifests + exe mapping only (no global dataset) (see docs/2-technical/METADATA_POLICY.md)
  - Coupled UX: "What game is this?" prompt builds local mapping -> then offer per-game templates (next steps/build/boss)
        - [x] Local mapping storage (exe + titlePattern -> game name)
      - [x] Unknown prompt UI + IPC (collect answer, persist mapping)
      - [x] Detection hook to prefer learned mapping over Unknown
      - [x] Template source + fallback to generic prompts when missing
      - [x] Stickiness: keep last recognized game for a short window (20-30s) to avoid flapping
    - [x] Optional vision fallback with explicit consent + privacy guardrails
    - Long-term template strategy (metadata policy aligned):
      - [ ] Detect via local manifests + running exe -> title, appId, install path
      - [ ] Per-game template editor stored locally (JSON/SQLite), export/import optional
      - [ ] Optional LLM seed template on first encounter with user approval
      - [ ] No global dataset; cache is user-specific with TTL; artwork runtime-only
    - Implementation roadmap (high-level):
      - [ ] Principles/limits: policy-safe metadata, no global catalog, user cache with TTL
      - [ ] Detection quality: multi-signal scoring, guards, raised thresholds, stability gates
      - [ ] Metadata sources: local manifests + exe mapping, normalized appId/title
      - [x] Template strategy: editor + optional LLM seed + runtime composition
        - Game template block defaults to Ask panel (movable/detachable).
        - Multi-select quick options + custom guidance combined into the AI prompt.
      - [x] UX/data flow: detect -> context -> template -> prompt, generic fallback
        - Renderer requests game context on boot and before AI calls; main publishes updates.
        - If unknown: show prompt, persist mapping (title/exe -> game) and force re-detect.
        - Template lookup is local (userData JSON) and injected into OpenAI prompts when present.
        - Missing template falls back to generic prompt; no global dataset.
      - [ ] Testing: unit scoring/guards, E2E unknown->mapping->template, flapping checks
        - Unit: game-detect scoring (min-signal), browser/process guard, stability gate
        - Unit: metadata resolver + template store CRUD (load/save/delete, cache TTL)
        - E2E (manual): unknown prompt -> mapping save -> re-detect -> template load -> AI prompt
        - E2E (manual): flapping protection across rapid focus changes; overlay-focused guard
        - Regression: ignore list + forced detect still bypasses browser titles
      - [x] Docs: keep METADATA_POLICY, LEARNINGS, CHANGELOG aligned
        - Update METADATA_POLICY with local-manifest-only stance + no global dataset.
        - Append LEARNINGS entry for template store + UX/data flow.
        - Note changes in CHANGELOG under the current version block.
 - [ ] Per-game layout profiles
  - Save/apply per detected game: layout mode, panel order (and optionally open/detached state)
  - Depends on Coupled UX (Unknown -> mapping) for reliable game identity
- [x] Multi-monitor optimization (full scope)
  - [x] Display registry: stable displayId, workArea/bounds, scaleFactor, rotation
  - [x] Canonical layout: per-monitor normalized rects (x,y,w,h in 0..1)
  - [x] DPI-aware restore: map normalized rects to monitor workArea
  - [x] Game-monitor binding: overlay follows active game display
  - [x] Hot-plug + reflow: clamp/reposition on monitor change
  - [x] Recovery rules: fallback to primary if target monitor is missing
  - [x] Storage migration: convert legacy absolute positions (overlay/note/info/pinned/detached/block)
  - [x] Debug map logging + visual overlay

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

## AI

- [ ] Local diagnostics for AI decisions (intent, game context, template) without telemetry
  - [ ] Record intent classification outcome (local-only)
  - [ ] Log resolved game context + detection score
  - [ ] Log template selection (game template vs generic)
  - [ ] Add a debug toggle to enable/disable diagnostics
  - [ ] Detect "too generic" replies and auto-raise specificity on next call
- [ ] Deterministic shortcuts for common intents (e.g., "what game am I playing")
  - [ ] Add common game intents (farm/build/boss/quest/loadout) with fixed response structures
- [ ] Intent routing layer (simple router before LLM call)
  - [ ] Route how-to/farming questions to step-by-step, game-specific answers
  - [ ] Enforce "no generic tips" mode when game context is known
- [ ] Model strategy split (text-only vs vision) + timeout fallback
- [ ] Token budget caps per detail level
- [ ] Template cache + reload strategy (dev)
- [ ] Preset answer styles (short/step-by-step/deep) without user prompt writing
- [ ] Auto-seed per-game template defaults on first encounter (opt-in)
- [ ] User-facing error UX for AI failures (clear, actionable)
- [ ] Trim/segment strict policy to reduce prompt bloat

- [ ] AI Vision: Video recording recognition
  - [ ] Define the exact flow: capture (source), sampling rate, and retention policy
  - [ ] Add a dedicated service module (services/vision-video.js) for video frame extraction
  - [ ] Implement incremental frame-to-Vision analysis (batch or rolling window)
  - [ ] Add UI controls (start/stop recording + status) with 8-language translations
  - [ ] Add privacy and storage notes (explicit consent, local retention limits)
