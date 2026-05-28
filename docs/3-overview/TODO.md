
# ✅ TODO / Backlog

Last updated: 2026-05-26

Note: Config-first, no-hardcode remains mandatory. The architecture now assumes:
OFFLINE KNOWLEDGE ENGINE -> EXPORTED RUNTIME KNOWLEDGE PACKAGE -> LIGHTWEIGHT RUNTIME.

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

## Phase 0 — Baseline visibility

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

## Phase 1 — Stable game context (UX block)

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

## Phase 2 — Deterministic scaffolds + strict safety

Why: Enables safe routing and strict guardrails before bounded synthesis.

- [x] Deterministic shortcuts for common intents
- [x] Intent routing layer (simple router before LLM call)
- [x] Anti-hallucination safeguards (deterministic)
  - [x] KnowledgeMode: VERIFIED / PARTIAL / UNKNOWN
  - [x] Entity whitelist: allow only VERIFIED FACTS + USER INPUT; forbid new proper nouns
  - [x] "I don't know" policy: prefer "no reliable data" over invention
  - [x] Output template: [Knowledge Status] + [Answer] + [Unverified notice]
  - [x] Guardrails check: no external metadata ingestion beyond policy
  - [ ] Allow bounded verified + grounded synthesis (anchor-gated, one-step only)
  - [ ] Disallow strict fact-only lock when anchored composition is permitted
  - [ ] Runtime answer policy: verified facts + bounded synthesis, not facts-only

- [ ] Whitelist v2 (all languages; config-first, no hardcode)
  - [x] Fast-start mentionables (user-provided names auto-detect, mentionable-only)
  - [ ] Shared text normalizer (casefold + diacritics + Unicode normalize)
  - [ ] Entity marker expansion (all languages)
  - [ ] Inflection-tolerant whitelist (language-specific)
  - [ ] Overblocking soft-violation mode
  - [ ] Answer provenance tags (FACTS/USER/inferred)

## Phase 3 — Offline knowledge compiler (pipeline)

Why: The pipeline is a heavy offline toolchain for verified knowledge creation.

- [x] Source input policy (allow/block)
- [x] Ingest gate + no raw source persistence
- [x] Chunking pipeline
- [x] Fact extraction + validation
- [x] Normalization + canonicalization + dedupe
- [x] Representation shaping + diagnostics
- [x] Review UX (approve/reject/rewrite/merge/retag)
- [x] Storage gate (facts only; runtime may use bounded synthesis)
- [x] Tiered support enforcement (A/B/C in prompt assembly)

- [ ] Review throughput plan (manual review scaling)
- [ ] Curated A-tier facts (top games, manual)
- [ ] Fact request UX (JIT + approve)

## Phase 4 — Runtime knowledge package (export)

Why: The runtime must remain lightweight and bounded.

- [ ] Define runtime knowledge package schema
  - [ ] mechanistic core
  - [ ] canonical entities
  - [ ] transitions + constraints
  - [ ] composition hints
  - [ ] retrieval metadata
- [ ] Export tool (pipeline -> runtime package)
- [ ] Versioning + compatibility checks
- [ ] Verify no heavy heuristics are shipped to runtime

## Phase 5 — Runtime bounded synthesis

Why: Strict verified-only direct answering causes retrieval starvation.

- [ ] Anchor-gated one-step composition (condition -> transition -> consequence)
- [ ] Retrieval-local synthesis only (no cross-fact reasoning)
- [ ] No gameplay coaching/strategy narration
- [ ] No multi-hop inference or graph propagation
- [ ] Runtime retrieval prefers mechanistic overlap vs sentence-only
- [ ] Runtime answers may include anchored composition beyond strict fact sentences
- [ ] Runtime diagnostics for bounded synthesis (local only)

## Phase 6 — Representation Stability + Scaling

Why: Stabilization phase for runtime-usable representation at scale.

Mode: Stabilization (foundation freeze; no large refactors).

### Phase 6 stabilization strategy

- Foundation freeze
  - No large normalize refactors or module moves
  - No heuristic explosion
  - Allowed: boundary cleanup, parity fixes, ownership cleanup, small stabilization work
- Stabilization KPIs (primary success metrics)
  - mechanicRecoverability
  - operationalContinuityPreservation
  - corePersistence
  - continuityBearingRetention
  - retrievalStitchingPressure
  - fragmentationScore
  - runtimeUtilityIdentityPersistence
- Controlled representation experiments
  - Trace-only, observability-only, deterministic, bounded
  - No scoring impact, no retention tuning, no runtime integration
  - One representation hypothesis per experiment
- Representation stabilization focus
  - Continuity-aware representation semantics stabilization
  - Runtime utility identity stabilization
  - Continuity-bearing fact stability
- Canonical stabilization follow-up
  - Merge stability, canonical persistence, wording independence, merge arbitration stabilization
- Multi-genre scaling after semantics + canonical stability

- [x] Normalize architecture refactor (split normalize.js) — foundation complete
  - [x] Modules: filters / grounding / representation / scoring / composition / diagnostics / taxonomy / canonical signals
  - [x] Explicit ownership boundaries
  - [x] Behavior parity + regression notes
  - [x] Lightweight validation checks
  - [x] Fixed-input isolation run (same seed/pages/raw candidates)
  - [x] Per-stage delta tracing (filters/grounding/scoring/retention/composition/canonical signals)
- [ ] Representation stability (core-centric, structure-native)
  - [ ] Operational continuity recoverability
  - [ ] Retrieval stitching friendliness
  - [ ] Runtime answerability
  - [ ] Composition utility
  - [ ] Mechanistic density vs fragmentation balance
  - [ ] Runtime utility identity stabilization (continuity-aware, no tuning)
  - [ ] Continuity-bearing fact representation stability
- [ ] Canonicalization stability (structure-first merge)
  - [ ] Drift prevention
  - [ ] Genre robustness
  - [ ] Stable merge behavior
  - [ ] Wording independence calibration
  - [ ] Runtime-oriented merge usefulness
- [ ] Bounded composition + grounding safety
  - [ ] Local + one-step + anchor-gated + mechanistically explicit + structure-native
  - [ ] No reasoning engine, no graph propagation, no gameplay commentary, no planning layer
- [ ] Multi-genre stress testing
  - [ ] MMO / FPS-PvP / ARPG / Roguelike / Extraction shooter / Survival / Sandbox / RTS
- [ ] Retrieval quality validation
  - [ ] Fragmentation score
  - [ ] Retrieval stitching pressure
  - [ ] Operational continuity score
  - [ ] Retrieval packability
  - [ ] Composition utility
  - [ ] Answer composition friendliness
  - [ ] Local continuation recoverability
- [ ] Reviewer + human calibration workflow
  - [ ] Semantic drift review
  - [ ] Merge quality review
  - [ ] Composition usefulness review
  - [ ] Runtime usefulness review
  - [ ] False-positive composition review
  - [ ] Representation stability tracking
- [ ] Diagnostics + observability
  - [x] Runtime-oriented diagnostics
  - [ ] Composition diagnostics
  - [x] Representation drift
  - [ ] Merge behavior
  - [ ] Retrieval usefulness
  - [ ] Fragmentation pressure
  - [x] Utility semantics observability (trace-only, no scoring/retention impact)
- [ ] Operational continuity causal tracing (domain-agnostic, structure-native)
  - [ ] Entity-role persistence tracking
  - [ ] Condition -> transition -> consequence preservation tracing
  - [x] Operational dependency continuity
  - [ ] Local propagation preservation
  - [x] Continuity fragmentation points by stage
  - [x] Retention-induced decomposition tracing
  - [ ] Representation granularity drift
  - [ ] Core compression side-effects
  - [x] Guardrail: analysis-only, no auto-correction/tuning

### Current core finding (2026-05)

- The drift is primarily a representation semantics + runtime utility identity problem, not penalties/merge/modularization.
- Implicit runtime usefulness is currently biased toward compact, shallow, standalone, synthetic, low-continuity-burden facts.
- Continuity-bearing operational facts are structurally strong but lack stable runtime-utility identity.
- Utility semantics experiments must remain trace-only/observability-only until representation + canonical stability improves.
- [ ] Guardrails + architectural constraints
  - [ ] Bounded + grounded + structure-first + diagnostics-first + runtime-oriented + mechanistically explicit
  - [ ] No open-ended reasoning, no graph-native inference, no symbolic planner, no heuristic explosion

## Phase 7 — Answer style + UX surfacing

Why: Once routing and synthesis are safe, UX can be tuned.

- [ ] Preset answer styles (short/steps/deep)
  - [ ] Answer style conflict rule priority
- [x] Auto-seed per-game template defaults on first encounter (opt-in)
- [x] Guardrails check: no auto-seeding from third-party dumps
- [ ] Auto-raise specificity when "too generic" is detected

## Phase 8 — Tuning + durability

Why: Optimization on a stable pipeline.

- [ ] Trim/segment strict policy (prompt bloat control)
- [ ] Model strategy split + timeout fallback
- [ ] Hybrid stack design (structured DB + vector DB + LLM formatting)
- [ ] Platformization roadmap only (no metadata export)

## Phase 9 — Release readiness

- [ ] Remove openDevTools() from production
- [ ] Create Windows installer (NSIS/MSI)
- [ ] Code sign executable (EV certificate)
- [ ] Auto-update mechanism (electron-updater)
- [ ] Privacy policy document
- [ ] Terms of service
- [ ] Crash reporting (opt-in) + minimal telemetry policy
- [ ] Release build smoke test checklist (clean VM)
- [ ] Guardrails check: distribution has no bundled datasets or artwork

## Product roadmap (not in current build chain)

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
