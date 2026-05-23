<!-- Workspace-level Copilot guidance for AI Game Assistant -->

## Project Summary
- Electron desktop overlay for game assistance on Windows.
- OpenAI GPT + Vision + Whisper STT integration.
- Real-time game detection (PowerShell based).
- 8-language UI: hu, en, de, ru, fr, zh, it, pl.

## Current Direction (2026-05)
- Focus: correctness and safety for game-specific answers.
- Anti-hallucination safeguards for high-risk content.
- Facts strategy: minimal, on-demand facts, no global dataset.
- Tiered support: A/B/C with strict fallback rules.
- Config-first, no-hardcode rules for behavior and language rules.
- Dev-only admin tools exist for review and diagnostics; never shown to end users.

## Guardrails (Non-Negotiable)
- No bundled third-party datasets or offline catalogs.
- No public metadata API or bulk aggregation.
- User-local data only; minimal metadata with TTL and purge.
- All backups are sacred: never auto-delete, only manual deletion after explicit review.

## AI Behavior Rules
- Never invent game-specific names; prefer "unknown" + ask for clarification.
- Entity whitelist: only verified facts + user-provided names.
- High-risk questions (loot, bosses, crafting, mechanics) require strict fallback if unverified.
- Prefer "no reliable data" over generic tips when game context is known.

## UI/UX Rules
- All user-facing text must be translated to all 8 languages in uiText.
- Custom modal dialogs only (no native alert/confirm/prompt).
- Keep overlays game-safe: no focus stealing, no popups that block input.
- Dev-only admin UI must be hidden in production builds.

## Data & Storage
- Facts: stored per game under userData (facts.json).
- Fact requests: userData/games/<game>/fact-requests.json (reviewed manually).
- Usage stats: userData/games/<game>/usage.json for hot-game prioritization.
- Source inputs are temporary only; never persist full source content.

## Dev Tooling
- `npm run check`: bug-checker + dev/prod parity check.
- `npm run cleanup`: reports quality issues and lists backups (never deletes).
- Always run scripts/make-backup.ps1 before risky edits.

## Documentation
- Docs are English-only.
- Update CHANGELOG.md and LEARNINGS.md after major changes.
- Keep TODOs in docs/3-overview/TODO.md in sync with progress.

## Critical Philosophy & Collaboration
- **Long-term solutions first:** choose robust, maintainable, future-proof solutions.
- **Proactive communication:** ask for clarification when requirements are unclear.
- **User collaboration style:**
	- Prefers clear, stepwise logic and simple, robust solutions.
	- Minimal dependencies, readable code, and basic error handling are valued.
	- Outlines approach first, then code, then brief explanation.
	- Avoids overengineering; simplify when possible.
- **Critical project values:**
	- Security, correctness, and game-specificity are always prioritized.
	- All dev/admin tools must be gated and never exposed to end users.
	- Documentation, backup, and i18n are sacred; never skip or automate destructive actions.
	- Prompt bloat, IPC hygiene, and data retention must be actively managed.
- **Continuous improvement:**
	- If a better long-term approach is found, propose it, even if it means refactoring.
	- Learn from issues and update guidance and docs accordingly.
	- If a mistake is made, document the lesson and fix it for the future.

> "Bármi is a feladat, mindig a hosszútávú, tiszta megoldást választjuk. Kérdezz, ha kell, mert én is fogok. Amit eddig tapasztaltál a közös munkánk során, nyugodtan vedd figyelembe!"

