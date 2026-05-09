# Architecture Refactor Plan (No-Build, CommonJS)

## Goals
- Keep behavior unchanged while improving structure and maintainability.
- Make future decomposition incremental (no re-splitting work).
- Avoid introducing a build step.
- Preserve all stability fixes (overlay/detached readiness, reconcile, prewarm/caching, boot gating, bounds clamp).

## Target Structure (Phase 1 Focus)
```
src/
  main/
    index.js                # optional future entry (root main.js can delegate)
    state/
      registry.js           # shared window refs + flags (single source of truth)
    utils/
      bounds.js             # clamp helpers + work area logic
    windows/
      overlay.js            # create/show/hide overlay
      detached.js           # detached window lifecycle
      pinned.js             # pinned-history windows
      note.js               # note panel window
      info.js               # info panel window
    ipc/
      register.js           # registerIpcHandlers (delegates)
      overlay-ipc.js
      detached-ipc.js
      pinned-ipc.js
      note-ipc.js
      info-ipc.js
      openai-ipc.js
    services/
      game-detect.js        # active window + PS integration
      openai.js             # Whisper + Vision + chat
  renderer/
    overlay/
      overlay.html          # stays as-is in Phase 1
      overlay.css           # optional later extraction
      boot.js
      ipc.js
      ui.js
      history.js
      detach.js
      translations.js
    windows/
      note-panel.html
      info-panel.html
      pinned-history.html
```

## Module Boundaries
- state/: central registry of shared flags and window instances.
- utils/: pure helpers only (no window creation, no IPC).
- windows/: window creation + visibility policies (no OpenAI/game logic).
- ipc/: IPC wiring and delegation only (no heavy logic).
- services/: external integrations (OpenAI, game detection).

## Import/Export Rules (Avoid Circular Deps)
- windows/ and services/ may import state/ and utils/.
- ipc/ may import windows/, services/, state/.
- utils/ must not import windows/ or ipc/.
- state/ should not import windows/ (only hold references).

## Migration Phases
### Phase 1: main.js decomposition baseline
- [x] Create folder skeleton under src/main.
- [x] Add utils/bounds.js and move clamp helpers.
- [x] Add state/registry.js (centralize window refs + flags).
- [x] Extract windows/* modules (overlay/detached/pinned/note/info).
- [x] Extract ipc/* modules (handlers delegate to windows/services).
- [x] Extract services/* modules (game detection, OpenAI) if cleanly separable.

### Phase 2: renderer organization (optional, no bundler)
- [x] Extract overlay CSS into overlay.css.
- [x] Split overlay JS into ipc/ui/history/detach/translations.
- [x] Keep overlay.html as entry, use <script src="...">.

### Phase 3: optional index entry move
- [x] Move root main.js logic into src/main/index.js.
- [x] Keep root main.js as thin delegate to preserve package.json main.

## Definition of Done (Phase 1)
- main.js reduced to an entry + orchestration layer.
- All existing behavior preserved (verified by npm run check + manual smoke).
- No build step added.
- No circular imports introduced (simple require graph).
- Plan updated with checked items.

## TODO (Architecture Expansion)
- [x] Phase 1: finish registry extraction (centralize window refs + flags).
- [x] Phase 1: extract windows/* modules (overlay/detached/pinned/note/info).
- [x] Phase 1: extract ipc/* modules with pure delegation.
- [x] Phase 1: extract services/game-detect.js and services/openai.js if clean.
- [x] Phase 2: renderer split (ipc/ui/history/detach/translations) without bundler.

## TODO (AI Vision: Video Recording Recognition)
See the canonical checklist in [docs/3-overview/TODO.md](docs/3-overview/TODO.md).
