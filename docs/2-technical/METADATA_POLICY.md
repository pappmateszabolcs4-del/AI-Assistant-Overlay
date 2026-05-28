# Metadata Policy (Low Risk)

Last updated: 2026-05-23

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
- No global third-party dataset or offline catalog shipped with the app (A-tier curated facts are limited and first-party).

## Monetization guardrails (MUST)

- No bundled datasets or offline catalogs from third parties.
- No artwork packs or bulk asset redistribution.
- No public metadata API or bulk backend aggregation.
- Only minimal, user-local metadata with TTL and purge.
- Runtime fetch only for artwork; keep caches small and time-limited.
- Commercial use of third-party sources requires explicit licensing.

### Target state (monetization-safe)

- Target state: first-party core registry + user-local memory + opt-in, reviewed community hints + runtime hydration.
- Positioning: gameplay assistance layer (compact, functional facts), not content replication.
- Not allowed: global IGDB dump, offline catalog, bulk artwork pack, public metadata API.
- Moat: personalization + workflow + overlay intelligence, not a "every-game DB".
- Project: monetizable desktop game assistant overlay.
- Problem: offline global third-party dataset (IGDB) was a runtime dependency -> monetization/legal risk.

### Decision points (canonical)

- Global dataset: no runtime global dataset (minimize legal/monetization risk).
- Data sources: local manifests + exe mapping + user-local cache + optional runtime lookup (compliance-safe, scalable).
- Facts strategy: tiered support (A: curated top games; B: runtime + user-fed; C: generic).
- Community knowledge: opt-in, reviewed patch layer (not a full DB).
- Moat focus: personalization + workflow + overlay intelligence (defensible IP).

### 3-phase plan (legacy)

- Stop the bleeding: remove global dataset dependency; keep local manifests + exe mapping + user-local cache only.
- Safe knowledge: minimal first-party core + user-local memory + reviewed community hints.
- Platformization: first-party ecosystem (automation, OCR packs, workflows) with metadata as descriptor only.

## Explicitly avoid
- Full store catalog mirrors.
- Bundled artwork packs.
- Offline dumps of third-party store metadata.
- First-run bulk dataset downloads (even if installer ships empty).
- Backends that function as metadata mirrors or bulk redistribution.

## Gameplay facts policy

Positioning: gameplay assistance layer, not a content replication platform.

### What we store (allowed)
- Compact, actionable gameplay facts (1 fact = 1 short insight).
- Structured facts only (retrieval-friendly, low-context cost).
- User-local storage, per game, with TTL where applicable.
- Manual review for curated facts (A-tier).

### What we do not store
- Full wiki pages, long guide paragraphs, lore dumps.
- Bulk scraped corpora or offline mega-RAG datasets.
- Persistent copies of third-party source content.

### Tiered support model
- A-tier: top 50 games, curated facts with manual review (expandable with explicit review capacity + caps).
- B-tier: runtime + user-fed context, no persistent third-party corpus.
- C-tier: generic assistant + clarification prompts.

### Fact format principles
- Facts are short and functional, focused on gameplay decisions.
- Each fact has tags + priority for deterministic retrieval and ranking.
- Deduping and review required before promotion to curated facts.

### Runtime knowledge model (bounded synthesis)

Verified facts remain the source of truth, but the runtime layer may perform
bounded, anchor-gated composition to avoid retrieval starvation.

Allowed at runtime:
- One-step, retrieval-local composition (condition -> transition -> consequence).
- Only when explicit mechanic anchors and transitions are present.
- Mechanically explicit continuation (no narration or coaching).

Not allowed at runtime:
- Multi-hop inference or cross-fact reasoning.
- Gameplay strategy or advisory narration.
- Graph-native propagation or hidden causal chains.

Runtime inputs (lightweight only):
- Mechanistic core
- Canonical entities
- Transitions and constraints
- Composition hints
- Retrieval metadata

## Gameplay fact extraction pipeline (long form)

Summary of the new data strategy and gameplay fact extraction pipeline for the game assistant overlay project.

The prior direction:
- offline/global IGDB-like dataset,
- bulk knowledge corpus,
- persistent third-party game knowledge storage,

was too large in terms of:
- legal,
- monetization,
- maintenance,
- and scope creep risk.

The new goal is NOT:
"AI game encyclopedia"

But:
"AI gameplay assistance system"
or:
"gameplay decision-support engine".

Focus:
- short actionable gameplay facts,
- contextual assistance,
- overlay UX,
- user-local intelligence,
- runtime/gameplay support,
- compact gameplay intelligence.

Core concept:
NOT building a complete game knowledge base, but:
compressed gameplay intelligence extraction.

### CORE ARCHITECTURE

Core components:
- minimal first-party core registry
- compact structured gameplay facts
- user-local memory
- runtime retrieval
- AI-assisted extraction
- human review layer

NOT a goal:
- full wiki rebuild
- full offline RAG corpus
- "every game full knowledge"
- bulk scraped knowledge DB
- third-party encyclopedia replacement

The real moat is NOT a "big dataset".

It is:
- contextual reasoning
- user-local gameplay memory
- decision-support
- compact actionable intelligence
- gameplay workflow assistance

### FACT DESIGN PHILOSOPHY

1 fact = 1 short gameplay insight.

Good:
"Deep drills require stable power or production halts."

Bad:
- lore
- long guide paragraph
- wiki rewrite
- fluff
- encyclopedia-style content

The goal:
- help gameplay decisions,
- highlight blockers,
- support optimization,
- be quick to use in overlay.

The system is retrieval-friendly, not long-form content storage.

### WHY THIS IS BETTER

- lower legal risk
- lower maintenance
- smaller storage footprint
- cheaper retrieval/context
- optimal for overlay
- more scalable
- easier to monetize
- lower hallucination risk
- better signal/noise ratio

Key difference:

RISKY:
store entire third-party knowledgebase

MUCH MORE DEFENSIBLE:
extract short gameplay assistance facts

System goal:
gameplay assistance,
not content substitution.

This is the key architectural distinction.

### RECOMMENDED SOURCES

Preferred:
- official docs
- manuals
- official/semi-official wikis
- patch notes
- developer guides
- developer notes

Source goal:
temporary extraction input.

NOT:
offline permanent mega knowledgebase.

### DIRECTIONS TO AVOID

- full Fandom scrape/store
- IGN/GameFAQs guide corpus rebuild
- IGDB parity rebuild
- Steam review mirroring
- Reddit bulk persistence
- unofficial dump/archive datasets
- community mirrors
- torrent datasets
- offline mega-RAG corpora

NOT:
- full random internet scrape
- bulk wiki mirroring
- complete guide persistence

### FACT EXTRACTION PIPELINE

1. SOURCE INPUT

The system uses controlled source material:
- official docs
- manuals
- wikis
- patch notes

Source is input extraction material, not a persistent knowledge corpus.

2. CHUNKING

Source content is split into smaller chunks.

Example:
RimWorld power wiki page
-> 500-1500 token chunks

Why:
- more stable extraction
- better quality
- lower hallucination
- cheaper processing
- more precise prompting

3. AI FACT EXTRACTION

The AI does NOT store the full text.

It extracts high-signal gameplay facts.

Extraction target:
- actionable insight
- progression blocker
- optimization
- resource dependency
- combat mechanic
- economy insight
- system interaction

NOT:
- lore
- fluff
- guide rewrite
- long-form explanation

Example:

INPUT:
"Deep drills require power and the Deep Drilling research before underground resources can be extracted."

OUTPUT:
{
"text": "Deep resources require Deep Drilling research and powered Deep Drills.",
"tags": ["resource", "progression"],
"priority": 3
}

This is:
- shorter
- more transformative
- gameplay-assistance focused
- retrieval-friendly

4. STRUCTURED FACT FORMAT

Each fact is stored in standard JSON.

Example:

{
"id": "",
"text": "",
"keywords": [],
"tags": [],
"priority": 1,
"system": "",
"gameStage": "",
"confidence": 0.9,
"sourceType": ""
}

Why:
- deterministic retrieval
- ranking
- filtering
- overlay relevance scoring
- cheaper context assembly
- consistency

5. FACT TAXONOMY

Each fact is categorized.

Examples:
- progression
- blocker
- optimization
- crafting
- combat
- economy
- survival
- automation
- base-building

Why:
- consistency
- retrieval
- ranking
- UI filtering
- orchestration

6. DEDUPE PIPELINE

Raw extraction is redundant.

Example:
- "Deep drills need electricity."
- "Deep drills require power."
- "Without power drills stop."

Pipeline:
- embedding similarity
- semantic clustering
- merge/rewrite

After that:
1 compact canonical fact remains.

This is critical.

7. HUMAN REVIEW LAYER

AI extraction does NOT go to production automatically.

Review flow:
- approve
- reject
- rewrite
- merge
- retag

Why:
- quality control
- hallucination reduction
- consistency
- stronger transformative position

The system is AI-assisted, not fully automated content replication.

8. PRIORITY SYSTEM

Each fact gets a priority.

P1:
critical blocker
Example:
"Need Fabrication before crafting components."

P2:
optimization
Example:
"Trade ships help component shortages."

P3:
optional hint
Example:
"Underground deposits vary by seed."

This is important for overlay UX.

9. SYSTEM-BASED SUPPORT

The system does NOT represent the full game.

Instead, it represents game systems.

Example (RimWorld):
- power
- research
- raids
- medicine
- crafting
- food
- mood
- economy

Each system gets 5-20 high-value facts.

This is:
- more sustainable
- cheaper
- more scalable
- better signal/noise ratio

10. TIERED GAME SUPPORT

Not every game gets the same support.

Tier A:
Top 20-50 games
- curated fact graph
- reviewed facts
- deep support

Tier B:
runtime extraction

Tier C:
generic assistant mode

This is a realistic scaling strategy.

### FINAL STRATEGIC DIRECTION

The goal is NOT:
"AI rebuilt global gaming encyclopedia"

It IS:
"context-aware gameplay assistance engine"

The main value:
- contextual gameplay intelligence
- personalized assistance
- overlay workflow support
- compact actionable guidance
- user-local learning

This is:
- healthier commercially
- sustainable technically
- and far more defensible legally
	than a full global third-party game corpus.

---

## Phase 2 Data Extraction MVP (Implementation Spec)

Goal: minimal, long-term compatible pipeline that yields compact, structured gameplay facts with strict policy enforcement and zero raw source persistence.

### 1) Policy and enforcement (hard rules)

Required:
- Source policy uses config-defined allow/block lists (no hardcode).
- Raw source content must never be persisted (disk or durable cache).
- Only transformed, validated facts can be stored.
- Dev/admin review tools must remain dev-only.

Enforcement points:
- Ingest gate: reject source if blocked or missing allow match.
- Extraction buffer: in-memory only + TTL; no file writes.
- Storage gate: reject any payload that includes source text.

### 2) Fact schema (stable base)

Required fields:
- id (string, stable, unique)
- text (string, short, actionable)
- keywords (string[])
- tags (string[])
- priority (number or enum: P1/P2/P3)

Optional fields:
- system (string)
- gameStage (string)
- confidence (number 0..1)
- sourceType (string)

Normalization rules:
- text length limit (config)
- keywords/tags: lowercase, trimmed, deduped
- priority constrained to allowed values

### 3) Chunking + extraction pipeline

Chunking:
- 500 to 1500 tokens per chunk
- chunk meta: gameId, sourceType, chunkId

Extraction prompt constraints:
- Output only compact, action-focused facts
- No lore, no guide paragraphs, no rewrites
- One fact per item

### 4) Output validation + filtering

Reject if:
- Missing required fields
- text too long
- duplicate keywords/tags after normalization
- lore/guide patterns detected (hard filter list in config)

### 5) Human review flow (dev-only)

States:
- approve / reject / rewrite / merge / retag

Rules:
- Only approved facts can be promoted to A-tier
- Review history stored without raw source

### 6) Tiered enforcement in prompt assembly

Tier rules:
- A: curated, reviewed facts only
- B: runtime + user input only
- C: generic facts + clarification question

### 7) Diagnostics (local-only)

Log events:
- extraction count
- drop reasons
- tier lookup result
- retrieval hit count

No raw source content in logs.
