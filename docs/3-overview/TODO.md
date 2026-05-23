# ✅ TODO / Backlog

Last updated: 2026-05-23

Note: We are switching to a config-first, no-hardcode approach (per Phase 2 Whitelist v2) because the previous path did not move fast enough.

## Build plan (ordered, dependency-safe)

## Monetization Guardrails (MUST)

- All phases and roadmap items must comply with these guardrails.
- No bundled datasets or offline catalogs from third parties.
- No artwork packs or bulk asset redistribution.
- No public metadata API or bulk backend aggregation.
- Only minimal, user-local metadata with TTL and purge.
- Prefer runtime fetch + cache limits; avoid long-term mirrors.

### Target state (monetization-safe)

- Target state: first-party core registry + user-local memory + opt-in, reviewed community hints + runtime hydration.
- Positioning: gameplay assistance layer (compact, functional facts), not content replication.
- Allowed: limited first-party curated facts for A-tier (top 50, manual review).
- Not allowed: global IGDB dump, offline catalog, bulk artwork pack, public metadata API.
- Moat: personalization + workflow + overlay intelligence, not a "every-game DB".
- Project: monetizable desktop game assistant overlay.
- Problem: offline global third-party dataset (IGDB) was a runtime dependency -> monetization/legal risk.

### Decision points (recommended)

- Global dataset: no runtime global dataset (minimize legal/monetization risk).
- Data sources: local manifests + exe mapping + user-local cache + optional runtime lookup (compliance-safe, scalable).
- Community knowledge: opt-in, reviewed patch layer (not a full DB).
- Moat focus: personalization + workflow + overlay intelligence (defensible IP).

### Phase 0 — Baseline visibility

Why: Until we can see where quality drops, every fix is guesswork.

- [x] Local diagnostics for AI decisions (intent, game context, template) without telemetry
  - [x] Record intent classification outcome (local-only)
  - [x] Log resolved game context + detection score
  - [x] Log template selection (game template vs generic)
  - [x] Add a debug toggle to enable/disable diagnostics
  - [x] Track "too generic" flag in diagnostics
  - [x] Guardrails check: no new data sources or caching outside policy
  - [ ] Error observability panel (why UNKNOWN)
  - [ ] Logging privacy (retention limits + purge)
  - [ ] i18n key linter (8 languages)
  - [ ] Dev vs prod parity check (new UI panels)
  - [ ] Policy guardrail checklist (metadata)

### Phase 1 — Stable game context (UX block)

Why: If the game context flaps or is wrong, routing and templates fall apart.

- [x] Minimum-signal rule: title + exe/process path + window class must collectively reach the threshold
- [x] Browser/process category guard: block title-only matches for known browser processes
- [x] Stability threshold + flapping guard: require 2-3 consecutive matches before switching games
- [x] Raise score threshold so title-only match is not enough
- [x] Mapping-first priority: prefer exe->game mapping (IGDB/Steam/Epic/GoG + learned), title is secondary
- [x] Overlay-focused guard: if overlay is active, skip detection and keep last recognized
- [x] Augment data sources (policy-safe): local manifests + exe mapping only (no global dataset) (see docs/2-technical/METADATA_POLICY.md)
- [x] Guardrails check: no bundled catalogs, no public metadata API
- [x] Stop the bleeding: remove global dataset dependency; keep local manifests + exe mapping + user-local cache only
  - [ ] Handle multi-language mixing

### Phase 2 — Deterministic response scaffolds (AI core)

Why: Enables “no prompt engineering needed” guidance.

- [x] Deterministic shortcuts for common intents (e.g., "what game am I playing")
  - [x] Add common game intents (farm/build/boss/quest/loadout/progression/mechanics/resource/economy/combat/base/exploration/troubleshoot/crafting/settings/multiplayer/roadmap) with fixed response structures
  - [x] Enable deterministic only for game-identity (safety + game-specific priority)
- [x] Intent routing layer (simple router before LLM call)
  - [x] Route how-to/farming questions to step-by-step, game-specific answers
  - [x] Enforce "no generic tips" mode when game context is known

- [x] Anti-hallucination safeguards (deterministic)
  - [x] KnowledgeMode: VERIFIED / PARTIAL / UNKNOWN
  - [x] Entity whitelist: allow only VERIFIED FACTS + USER INPUT; forbid new proper nouns
  - [x] User list != verified facts (mentionable, but never asserted as truth)
  - [x] High-risk question detection (loot, boss spawn, quest, recipe, mechanics) -> STRICT / UNKNOWN
  - [x] Post-validation: strip disallowed entities, downgrade to general tips + clarification
  - [x] "I don't know" policy: prefer "no reliable data" over invention
  - [x] Output template: [Knowledge Status] + [Answer] + [Unverified notice]
  - [x] Guardrails check: no external metadata ingestion beyond policy
    - [ ] Whitelist v2 (all languages; config-first, no hardcode)
      - [x] Fast-start mentionables (user-provided names auto-detect, mentionable-only)
      - [ ] Shared text normalizer (casefold + diacritics + Unicode normalize)
      - [ ] Entity marker expansion (all languages: location/character/item/boss/quest/mechanic)
        - [ ] Temporary expansion only; replace with data-driven list after review
        - [ ] Rollback criteria if overblocking does not improve (>=30% reduction over 100+ answers)
      - [ ] Inflection-tolerant whitelist (language-specific inflection rules)
      - [ ] False-offender suppression (language-specific)
      - [ ] Overblocking soft-violation mode (keep answer usable)
      - [ ] Mentions vs Facts separation (clear labeling in the answer)
      - [ ] Fail-safe answer plan (when everything is blocked)
      - [ ] Entity-confidence scoring (verified/mentionable/unknown)
      - [ ] Answer provenance tags (FACTS/USER/inferred)
      - [ ] Language fallback (when language rules missing)
      - [ ] Underblocking per-game safety level
      - [ ] Per-game safe mode (when violations are frequent)
      - [ ] Prompt-guard regression tests (suffixes, articles, plurals)

- [ ] Data extraction MVP (to seed test data)
  - [ ] Source input policy (allowed/blocked sources)
    - [ ] Blocked: full wiki mirrors/dumps, guide corpus rebuilds, IGDB parity goals, Steam/Reddit bulk persistence, unofficial dumps/archives
    - [ ] Allowed: temporary source processing + compact transformed facts only (no full-page persistence)
  - [ ] Chunking pipeline (500-1500 tokens + chunk metadata)
  - [ ] Fact extraction step (LLM prompt + output validation)
  - [ ] Structured fact schema (id, text, keywords, tags, priority; optional: system, gameStage, confidence, sourceType)
  - [ ] Human review flow (approve/reject/rewrite/merge/retag)
  - [ ] Priority system (P1/P2/P3 + retrieval weights)
  - [ ] Retention rules (no persistent source input)
  - [ ] Tiered support enforcement (A/B/C in prompt assembly)
  - [ ] Diagnostics (extraction + tier logging)

### Phase 3 — Facts pipeline (tiered support)

Why: Keep coverage lean while grounding entities to reduce hallucinations.

- [ ] Tiered support model (A/B/C)
  - [ ] A-tier: top 50 games with curated facts (manual review)
  - [ ] B-tier: runtime + user-fed context only
  - [ ] C-tier: generic assistant + clarification
- [ ] Compact gameplay facts only (no wiki-style content replication)
- [ ] Dedupe/merge pipeline (embedding/semantic merge -> canonical fact)
- [ ] System-based support taxonomy (game systems + fact tagging)
- [ ] Diagnostics expansion (dedupe stats + extraction quality)

- [x] On-demand knowledge (seed facts only when needed)
- [x] Minimal entity-first seed (characters, locations, items, mechanics, quests)
- [x] Hot-game prioritization (usage x hallucination rate x session length)
- [x] Community correction loop (user flags -> review -> FACTS)
- [x] Source reliability ranking (official > trusted > community > user input)
- [x] Fact versioning (fact_version + last_verified)
- [x] Guardrails check: facts are verified, minimal, non-redistributed
- [x] Safe knowledge: minimal first-party core + user-local memory + reviewed community hints
  - [ ] Fact request UX (JIT + confirm, 1-click dev approval)
  - [x] Auto-create facts.json on game saves
  - [ ] Entity lifecycle + TTL mentionables
  - [ ] Entity list contamination (dedupe + review)
  - [ ] Synonym drift / alias mapping
  - [ ] Cross-game name collision namespace
  - [ ] Multi-turn mentionable cache (session scope)
  - [ ] Per-session entity memory + "forget" button
  - [ ] Handle implicit references (previous turn)

### Phase 4 — Answer style + auto-seed

Why: Once routing is stable, styling and templates can ride the correct path.

- [ ] Preset answer styles (short/step-by-step/deep) without user prompt writing (dev-only first; requires detailed multi-game testing before checking off)
  - [ ] Answer style conflict rule priority
- [x] Auto-seed per-game template defaults on first encounter (opt-in)
- [x] Guardrails check: no auto-seeding from third-party dumps

### Phase 5 — Tuning + durability

Why: Optimization on a stable pipeline.

Design/spec plan (order recommended):
1) Trim/segment strict policy (prompt bloat control)
  - Define prompt budget by layer (system, facts, templates, user text).
  - Define trim order (e.g., optional hints → verbose template text → low-priority facts).
  - Segment policy: hard cap per section + final assembly check.
  - Add diagnostics fields to log what was trimmed (dev-only).
2) Model strategy split + timeout fallback
  - Decision matrix: text-only vs vision vs high-quality model.
  - Timeout thresholds per mode and a safe fallback response template.
  - Retry rules: once max, no cascading retries.
  - Telemetry: local counters only (no external telemetry).
3) Hybrid stack (structured DB + vector DB + LLM formatting) — design only
  - Define data boundaries: verified facts vs user inputs vs ephemeral context.
  - Decide vector usage: local-only, opt-in, TTL, no redistribution.
  - Storage schema + migration plan (non-destructive).
  - Guardrails check: no metadata mirrors, no bulk imports.
4) Platformization — roadmap only
  - Identify 2-3 first-party automation workflows.
  - Define plugin/extension safety model + permissions.
  - Guardrails check: no metadata export or bulk sharing.

- [ ] Model strategy split (text-only vs vision) + timeout fallback (requires extensive testing and joint review before production enablement)
- [ ] Hybrid stack (structured DB + vector DB + LLM formatting)
- [x] Token budget caps per detail level
- [x] Template cache + reload strategy (dev)
- [x] Prompt trim diagnostics (dev-only preview logging; diagnostics only)
- [x] Model strategy diagnostics (dev-only preview logging)
- [x] Dev-only diagnostics UI (prompt budget, trim snapshots, intent breakdown, fact-load stats, latency) with 1000-entry local retention
  - [ ] Prompt trim policy for facts/whitelist segments
  - [ ] Chunked facts trim order control
  - [ ] Context window hygiene (top-k entity filtering)
  - [ ] High-risk fallback template (when verified facts are missing)
- [ ] Trim/segment strict policy to reduce prompt bloat (requires extensive testing and joint review of trims before production enablement)
- [ ] Guardrails check: hybrid stack uses verified facts, not store mirrors
  - [ ] Facts boundary: only VERIFIED facts can be indexed or vectorized; user input stays separate (tagged, non-authoritative).
  - [ ] No mirrors: forbid bulk ingestion of third-party catalogs; allow only user-local, game-scoped facts.
  - [ ] TTL and purge: ephemeral context has TTL; purge paths validated and logged.
  - [ ] Data lineage: every stored fact keeps source and verification status; reject unknown sources.
  - [ ] Access rules: prompt assembly can only read VERIFIED facts + user session data; never merge with external dumps.
  - [ ] Export rules: no bulk export of facts/embeddings; only per-game user export with explicit consent.
  - [ ] Security: encrypt sensitive store fields; minimize retention; document keys and rotation plan.
  - [ ] Review checklist: add a formal checklist in docs/2-technical/METADATA_POLICY.md after implementation.
- [ ] Platformization: first-party ecosystem (automation, OCR packs, workflows) with metadata as descriptor only
  - [ ] Scope: first-party only; no third-party marketplace at this phase.
  - [ ] Workflows: define 2-3 automation flows (e.g., capture -> classify -> summarize) with clear permissions.
  - [ ] OCR packs: treat OCR outputs as transient session context; no persistent archive.
  - [ ] Metadata: descriptor-only (game name, high-level tags); forbid item/quest catalogs.
  - [ ] Permissions: explicit opt-in per workflow; visible activity indicator; no background capture by default.
  - [ ] Storage: local-only, per-game; TTL for workflow artifacts; manual purge control.
  - [ ] Dev gating: all platformization UI/tools dev-only until guardrails review passes.
  - [ ] Abuse guardrails: block scraping, bulk export, or automated ingestion workflows.

### Phase 6 — UX surfacing

Why: Make the system’s behavior visible and user-correctable.

- [x] Resizable popup panels with per-panel height persistence
- [x] History saved list header + toggle + per-item scroll for long answers
- [x] User-facing error UX for AI failures (clear, actionable)
- [ ] Auto-raise specificity when "too generic" is detected
- [ ] Guardrails check: UX does not expose or export cached metadata
  - [ ] Starter packs (A-tier top 50 games minimal entity seed, manual review)
  - [ ] Guided intake flow (2-minute wizard, minimal set)
  - [ ] Premium safe-mode UI indicator / dashboard

## Product roadmap (not in current build chain)

### Release readiness

- [ ] Remove openDevTools() from production
- [ ] Create Windows installer (NSIS/MSI)
- [ ] Code sign executable (EV certificate)
- [ ] Auto-update mechanism (electron-updater)
- [ ] Privacy policy document
- [ ] Terms of service
- [ ] Crash reporting (opt-in) + minimal telemetry policy
- [ ] Release build smoke test checklist (clean VM)
- [ ] Guardrails check: distribution has no bundled datasets or artwork

### v2.0 (Q2 2026)

- [ ] User feedback integration
- [ ] Refactor overlay.html → React
- [ ] Plugin API for game mods
- [ ] Cloud sync for settings
- [ ] Advanced game profiles
- [ ] Guardrails check: features do not create metadata redistribution

### AI Vision

- [ ] Vision video pipeline (end-to-end) — Max Quality (premium-only)
  - [ ] Scope + constraints
    - [ ] Define capture sources (game window only; exclude desktop by default)
    - [ ] Sampling strategy (fps, keyframes, resize policy)
    - [ ] Retention window (seconds, max frames, explicit purge behavior)
  - [ ] Data handling + privacy
    - [ ] Explicit consent per session + persistent toggle with UI indicator
    - [ ] Local-only processing; no persistent media archives
    - [ ] TTL + purge for all temporary frames and metadata
    - [ ] Guardrails check: no background capture, no hidden recording
  - [ ] Core services
    - [ ] Create services/vision-video.js
    - [ ] Frame extraction (rolling buffer) with bounded memory
    - [ ] Incremental frame-to-Vision pipeline (batch or rolling window)
    - [ ] Rate limiting + backpressure when Vision is slow
  - [ ] Max Quality policy (premium tier)
    - [ ] Premium-only; no standard/low-cost tier
    - [ ] FPS: 6–8 (10s video => ~60–80 frames)
    - [ ] Max frame cap: 120–150 per 10s window
    - [ ] Resolution: 1280×720 default; 1600×900 when UI/tooltip clarity needed
    - [ ] Vision timeout: 15–20s per pass
    - [ ] Two-pass Vision: scene summary -> question-focused pass
    - [ ] Aggregate evidence from frames into structured summary JSON
    - [ ] Model: flagship Vision model (current target: GPT-4o)
    - [ ] Strict guard + FACTS whitelist + high-risk fallback
  - [ ] UI/UX
    - [ ] Start/stop recording controls + status banner
    - [ ] Error states (permissions, capture failure, timeouts)
    - [ ] 8-language translations for all labels + messages
  - [ ] Storage + diagnostics
    - [ ] Local-only logs (dev-only) for frame counts and latency
    - [ ] No media export; only per-session summaries
  - [ ] Testing + verification
    - [ ] Manual: start/stop, fps throttle, game switching
    - [ ] Load test: long session with bounded memory
    - [ ] Guardrails check: no persistent media archives, no remote storage

### Infra

- [ ] Settings export/import (backup + restore)
- [ ] Startup/perf profiling (release build)
- [ ] Hotkey conflict detection and messaging
- [ ] Guardrails check: no telemetry or remote data export

### UX

- [ ] Per-game layout profiles
  - Save/apply per detected game: layout mode, panel order (and optionally open/detached state)
  - Depends on Coupled UX (Unknown -> mapping) for reliable game identity
- [ ] Hotkey customization UI
- [ ] Accessibility keyboard navigation
- [ ] Multi-account support
- [ ] Consent UX for microphone + screenshot usage
- [ ] Safe mode / reset layout shortcut
- [ ] Guardrails check: user data stays local, no exportable metadata

## Completed (key milestones)

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

- [x] Game-detect triggers tuned to event-driven flow
- [x] Worker-based game detection to remove drag stutter
- [x] Add volume control for TTS
- [x] History search/filter with pinned-only toggle (overlay + block windows)
- [x] Basic unit tests (3-5 critical paths)
- [x] Unify UI translation sources (overlay/index/detached/aux windows)
- [x] Modularize overlay renderer script
- [x] Restructure IPC handlers (clear domain ownership)
- [x] Context-aware error messages
- [x] Split registry by domain (overlay, detached, pinned, note/info)
- [x] Block-based layout with detachable blocks
- [x] Data-driven intent routing + response templates
- [x] Local game facts capture + storage
- [x] Removed game ignore + unknown mapping settings blocks
- [x] Better reload safety guard
- [x] Overlay performance instrumentation
