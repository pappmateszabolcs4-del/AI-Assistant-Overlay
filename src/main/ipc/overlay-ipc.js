const { IPC_CHANNELS } = require('../../shared/ipc-channels');
const { STORAGE_KEYS } = require('../../shared/storage-keys');
const { isDev } = require('../../shared/app-env');
const {
  loadSavedHistory,
  addSavedHistoryEntry,
  removeSavedHistoryEntry
} = require('../services/saved-history-store');
const { appendOverlayDebug } = require('../utils/overlay-debug-log');
const { appendOverlayPerf } = require('../utils/overlay-perf-log');
const { listTemplates, upsertTemplate, deleteTemplate } = require('../services/game-template-store');
const {
  addFact,
  addFactRequest,
  listFactRequests,
  updateFactRequest,
  getUsage,
  getHotGames
} = require('../services/game-facts-store');

function registerOverlayIpc(deps) {
  const {
    app,
    BrowserWindow,
    ipcMain,
    screen,
    registry,
    clampWindowToWorkArea,
    ensureOverlayWithinVisibleBounds,
    detectCurrentGame,
    tryGetDisplayForGameWindow,
    getPreferredOverlayDisplay,
    centerOverlayOnDisplay,
    showOverlayAndRaise,
    setOverlayVirtualVisible,
    setPinnedHistoryWindowsVisible,
    setBlockWindowsVisible,
    setDetachedPanelWindowsVisible,
    reconcileDetachedPanelWindowsVisibility,
    startDetachedSelfHealPulse,
    startDetachedPanelPrewarm,
    notePanel,
    openaiService,
    setCurrentLanguage,
    setCurrentSpeechRate,
    isCursorInsideOverlayChildWindow,
    stopOverlayMouseForwardGate,
    startOverlayMouseForwardGate,
    createOverlayWindow,
    getDisplayDebugMap
  } = deps;

  const { core, overlay, detached, note, info, game } = registry;

  ipcMain.handle(IPC_CHANNELS.WINDOW_CONTROL, async (_event, action) => {
    switch (action) {
      case 'minimize':
        if (core.win && !core.win.isDestroyed()) {
          core.win.minimize();
        }
        break;
      case 'maximize':
        if (core.win && !core.win.isDestroyed()) {
          if (core.win.isMaximized()) {
            core.win.unmaximize();
          } else {
            core.win.maximize();
          }
        }
        break;
      case 'close':
        if (core.overlayWin && !core.overlayWin.isDestroyed()) {
          core.overlayWin.destroy();
        }
        core.overlayWin = null;
        if (core.win && !core.win.isDestroyed()) {
          core.win.destroy();
        }
        core.win = null;
        app.quit();
        break;
    }
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_ACTION, async (_event, action) => {
    if (!core.overlayWin || core.overlayWin.isDestroyed()) {
      return { success: false, error: 'overlay-missing' };
    }
    switch (action) {
      case 'maximize-temp':
        overlay.overlayOriginalBounds = core.overlayWin.getBounds();
        core.overlayWin.maximize();
        break;
      case 'restore-temp':
        if (overlay.overlayOriginalBounds) {
          core.overlayWin.setBounds(overlay.overlayOriginalBounds);
          overlay.overlayOriginalBounds = null;
        }
        break;
      case 'reset-position':
        overlay.overlayIgnoreMoveUntil = Date.now() + 1500;
        core.overlayWin.setSize(1100, 500);
        ensureOverlayWithinVisibleBounds(true);
        break;
    }
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SET_CLICK_THROUGH, async (event, enable) => {
    let allowThrough = !!enable;
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (senderWin && !senderWin.isDestroyed()) {
      // Detached panels are always interactive when visible; don't let renderer toggle click-through.
      if (senderWin.__detachedPanelId) {
        return { success: true };
      }

      // If the main overlay is virtual-hidden (opacity 0), never allow it to become interactive.
      // Otherwise it can behave like an invisible window that still receives clicks/drags.
      if (core.overlayWin && !core.overlayWin.isDestroyed() && senderWin.id === core.overlayWin.id && !overlay.overlayVirtualVisible) {
        try { senderWin.setIgnoreMouseEvents(true, { forward: true }); } catch (_) {}
        overlay.clickThrough = true;
        overlay.overlayMouseForwardEnabled = true;
        stopOverlayMouseForwardGate();
        return { success: true };
      }

      // If the cursor is inside a detached/pinned/note/info window, keep the main overlay click-through.
      // This prevents cursor flicker when windows overlap and not all panels are undocked.
      if (core.overlayWin && !core.overlayWin.isDestroyed() && senderWin.id === core.overlayWin.id && !allowThrough) {
        if (isCursorInsideOverlayChildWindow()) {
          allowThrough = true;
        }
      }

      // If the note panel is virtual-hidden (opacity 0), never allow it to become interactive.
      // Otherwise it can end up as an invisible window that blocks clicks behind it.
      let forwardMoves = allowThrough;
      if (note.notePanelWin && !note.notePanelWin.isDestroyed() && senderWin.id === note.notePanelWin.id && !note.notePanelVirtualVisible) {
        allowThrough = true;
        forwardMoves = false;
      }

      // When the cursor is inside a child window (detached/pinned/note/info), do NOT forward
      // mouse moves to the overlay renderer while click-through is enabled. Forwarding can
      // still affect the cursor (grab<->arrow) on Windows even though clicks pass through.
      if (core.overlayWin && !core.overlayWin.isDestroyed() && senderWin.id === core.overlayWin.id && allowThrough) {
        try {
          if (isCursorInsideOverlayChildWindow()) {
            forwardMoves = false;
          }
        } catch (_) {}
      }
      try {
        if (allowThrough) {
          senderWin.setIgnoreMouseEvents(true, forwardMoves ? { forward: true } : undefined);
        } else {
          senderWin.setIgnoreMouseEvents(false);
        }
      } catch (_) {}
    }
    if (core.overlayWin && senderWin && senderWin.id === core.overlayWin.id) {
      overlay.clickThrough = allowThrough;
      overlay.overlayMouseForwardEnabled = true;
      if (overlay.clickThrough) startOverlayMouseForwardGate();
      else stopOverlayMouseForwardGate();
    }
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SET_ALWAYS_ON_TOP, async (_event, enable) => {
    if (core.win && !core.win.isDestroyed()) {
      if (enable) {
        if (core.win.isMinimized()) core.win.restore();
        core.win.setAlwaysOnTop(true, 'floating', 1);
        core.win.show();
        core.win.moveTop();
        core.win.focus();
        core.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      } else {
        core.win.setAlwaysOnTop(false);
        core.win.setVisibleOnAllWorkspaces(false);
      }
    }
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_OVERLAY, async () => {
    createOverlayWindow();
    detached.detachedWindowsDesiredVisible = true;
    const now = Date.now();
    const canStickyRestore = !game.currentDetectedGame
      && game.lastRecognizedGameName
      && (now - (game.lastGameRecognizedAt || 0)) < 30000;
    if (canStickyRestore) {
      game.currentDetectedGame = game.lastRecognizedGameName;
    }
    if (core.overlayWin && !core.overlayWin.isDestroyed()) {
      try {
        if (!overlay.overlayVirtualVisible) {
          // Preserve the last user position when toggling the overlay (hotkey).
          // Only center on first-ever show; subsequent opens should feel stable.
          if (!overlay.overlayEverShown) {
            detectCurrentGame();
            const gameDisplay = tryGetDisplayForGameWindow(game.currentDetectedGame);
            const preferred = gameDisplay || getPreferredOverlayDisplay();
            centerOverlayOnDisplay(preferred);
          }
        }
      } catch (_) {}
      showOverlayAndRaise();

      // Keep renderer in sync even when overlay is pre-created.
      if (game.currentDetectedGame) {
        try { core.overlayWin.webContents.send(IPC_CHANNELS.SET_GAME_CONTEXT, game.currentDetectedGame); } catch (_) {}
      }
    }
    setPinnedHistoryWindowsVisible(true);
    setBlockWindowsVisible(true);
    setDetachedPanelWindowsVisible(true);
    reconcileDetachedPanelWindowsVisibility('open-overlay');
    try { startDetachedSelfHealPulse(2000, 250); } catch (_) {}
    // Background prewarm: create the detached panel windows invisibly so the first undock
    // doesn't pay the full creation + compositor warm-up cost.
    try {
      setTimeout(() => {
        try { startDetachedPanelPrewarm(); } catch (_) {}
      }, 250);
    } catch (_) {}
    // Note panel is manual-only now; do not auto-show on overlay open.
    return { success: true, visible: !!(core.overlayWin && overlay.overlayVirtualVisible) };
  });

  ipcMain.handle(IPC_CHANNELS.CLOSE_OVERLAY, async () => {
    // If the renderer hid the overlay mid-detach gesture, ensure the main-process
    // guard can't remain stuck (which would ignore future x/y moves).
    overlay.overlayDetachGuardActive = false;
    detached.detachedWindowsDesiredVisible = false;
      try { core.overlayWin.webContents.send(IPC_CHANNELS.SET_SPEECH_RATE, registry.game.currentSpeechRate); } catch (_) {}
    if (core.overlayWin && !core.overlayWin.isDestroyed()) {
      setOverlayVirtualVisible(false);
    }
    setPinnedHistoryWindowsVisible(false);
    setBlockWindowsVisible(false);
    setDetachedPanelWindowsVisible(false);
    reconcileDetachedPanelWindowsVisibility('close-overlay');
    notePanel.setNotePanelVisible(false);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SET_LANGUAGE, async (_event, lang) => {
    const nextLanguage = openaiService.normalizeLanguage(lang);
    setCurrentLanguage(nextLanguage);
    if (core.overlayWin && !core.overlayWin.isDestroyed()) {
      core.overlayWin.webContents.send(IPC_CHANNELS.SET_LANGUAGE, nextLanguage);
    }
    if (note.notePanelWin && !note.notePanelWin.isDestroyed()) {
      try {
        note.notePanelWin.webContents.send(IPC_CHANNELS.NOTE_PANEL_INIT, { language: nextLanguage });
      } catch (_) {}
    }
    if (info.infoPanelWin && !info.infoPanelWin.isDestroyed()) {
      try {
        info.infoPanelWin.webContents.send(IPC_CHANNELS.INFO_PANEL_INIT, { language: nextLanguage });
      } catch (_) {}
    }
    if (detached.detachedPanelWindows && detached.detachedPanelWindows.size) {
      for (const win of detached.detachedPanelWindows.values()) {
        if (!win || win.isDestroyed()) continue;
        try {
          win.webContents.send(IPC_CHANNELS.SET_LANGUAGE, nextLanguage);
        } catch (_) {}
      }
    }
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.ADD_GAME_FACT, async (_event, payload) => {
    try {
      const game = String(payload && payload.game || '').trim();
      const text = String(payload && payload.text || '').trim();
      const keywords = Array.isArray(payload && payload.keywords) ? payload.keywords : [];
      const tags = Array.isArray(payload && payload.tags) ? payload.tags : [];
      const priority = Number.isFinite(payload && payload.priority) ? payload.priority : 0;
      const entityType = String(payload && payload.entityType || '').trim();
      const source = String(payload && payload.source || '').trim();
      const reliability = String(payload && payload.reliability || '').trim();
      const reliabilityRank = Number.isFinite(payload && payload.reliabilityRank) ? payload.reliabilityRank : undefined;
      const version = Number.isFinite(payload && payload.version) ? payload.version : undefined;
      const lastVerified = Number.isFinite(payload && payload.lastVerified) ? payload.lastVerified : undefined;
      return addFact(game, {
        text,
        keywords,
        tags,
        priority,
        entityType,
        source,
        reliability,
        reliabilityRank,
        version,
        lastVerified
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ADD_GAME_FACT_REQUEST, async (_event, payload) => {
    try {
      const game = String(payload && payload.game || '').trim();
      const text = String(payload && payload.text || '').trim();
      const intent = String(payload && payload.intent || '').trim();
      const reason = String(payload && payload.reason || '').trim();
      const tags = Array.isArray(payload && payload.tags) ? payload.tags : [];
      const entityType = String(payload && payload.entityType || '').trim();
      const source = String(payload && payload.source || '').trim();
      const reliability = String(payload && payload.reliability || '').trim();
      const reliabilityRank = Number.isFinite(payload && payload.reliabilityRank) ? payload.reliabilityRank : undefined;
      return addFactRequest(game, {
        text,
        intent,
        reason,
        tags,
        entityType,
        source,
        reliability,
        reliabilityRank
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_GAME_FACT_REQUESTS, async (_event, payload) => {
    try {
      const game = String(payload && payload.game || '').trim();
      const status = String(payload && payload.status || '').trim();
      return listFactRequests(game, status || undefined);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_GAME_FACT_REQUEST, async (_event, payload) => {
    try {
      const game = String(payload && payload.game || '').trim();
      const id = String(payload && payload.id || '').trim();
      const status = String(payload && payload.status || '').trim();
      const note = String(payload && payload.note || '').trim();
      return updateFactRequest(game, { id, status, note });
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_GAME_USAGE, async (_event, payload) => {
    try {
      const game = String(payload && payload.game || '').trim();
      return getUsage(game);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_HOT_GAMES, async (_event, payload) => {
    try {
      const limit = Number.isFinite(payload && payload.limit) ? payload.limit : undefined;
      return getHotGames(limit);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.OVERLAY_LAYOUT_SET, async (_event, payload) => {
    const rawMode = payload && typeof payload === 'object' && payload.mode != null
      ? payload.mode
      : payload;
    const mode = typeof rawMode === 'string' ? rawMode : String(rawMode || '');
    const validModes = new Set(['horizontal', 'compact', 'stacked']);
    const nextMode = validModes.has(mode) ? mode : 'horizontal';

    const sendLayout = (win) => {
      if (!win || win.isDestroyed()) return;
      try { win.webContents.send(IPC_CHANNELS.OVERLAY_LAYOUT_UPDATED, { mode: nextMode }); } catch (_) {}
    };

    sendLayout(core.overlayWin);
    if (detached.detachedPanelWindows && detached.detachedPanelWindows.size) {
      for (const win of detached.detachedPanelWindows.values()) {
        sendLayout(win);
      }
    }

    return { success: true, mode: nextMode };
  });

  ipcMain.handle(IPC_CHANNELS.SET_SPEECH_RATE, async (_event, rate) => {
    const nextRate = Math.max(0, Math.min(100, rate));
    setCurrentSpeechRate(nextRate);
    if (core.overlayWin && !core.overlayWin.isDestroyed()) {
      core.overlayWin.webContents.send(IPC_CHANNELS.SET_SPEECH_RATE, nextRate);
    }
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SET_AI_DIAGNOSTICS, async (_event, payload) => {
    const enabled = payload && typeof payload === 'object'
      ? !!payload.enabled
      : !!payload;
    if (registry.ai) registry.ai.diagnosticsEnabled = enabled;
    return { success: true, enabled };
  });

  ipcMain.handle(IPC_CHANNELS.SET_GAME_DETECT_MAPPINGS, async (_event, mappings) => {
    const next = Array.isArray(mappings) ? mappings : [];
    const cleaned = next
      .map((entry) => ({
        match: entry && entry.match ? String(entry.match).trim() : '',
        gameName: entry && entry.gameName ? String(entry.gameName).trim() : '',
        updatedAt: entry && entry.updatedAt ? Number(entry.updatedAt) : Date.now()
      }))
      .filter((entry) => entry.match && entry.gameName)
      .slice(0, 200);
    game.gameDetectMappings = cleaned;
    return { success: true, count: cleaned.length };
  });

  ipcMain.handle(IPC_CHANNELS.GET_GAME_TEMPLATES, async () => {
    return { success: true, templates: listTemplates() };
  });

  ipcMain.handle(IPC_CHANNELS.UPSERT_GAME_TEMPLATE, async (_event, payload) => {
    const gameName = payload && payload.game ? String(payload.game) : '';
    const template = payload && payload.template ? String(payload.template) : '';
    const aliases = payload && Array.isArray(payload.aliases) ? payload.aliases : [];
    const options = payload && Array.isArray(payload.options) ? payload.options : [];
    const answerStyle = payload && typeof payload.answerStyle === 'string' ? payload.answerStyle : undefined;
    const autoSeededAt = payload && Number.isFinite(payload.autoSeededAt) ? payload.autoSeededAt : undefined;
    return upsertTemplate(gameName, template, aliases, options, answerStyle, autoSeededAt);
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_GAME_TEMPLATE, async (_event, payload) => {
    const gameName = payload && payload.game ? String(payload.game) : '';
    return deleteTemplate(gameName);
  });


  ipcMain.handle(IPC_CHANNELS.GET_GAME_DETECT_STATUS, async () => {
    return {
      success: true,
      gameName: game.currentDetectedGame || null,
      activeTitle: game.lastActiveWindowTitle || null,
      matchedTitle: game.lastMatchedWindowTitle || null,
      lastDetectAt: game.lastGameDetectAt || 0
    };
  });

  ipcMain.handle(IPC_CHANNELS.FORCE_GAME_DETECT, async () => {
    try { detectCurrentGame(true); } catch (_) {}
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.GET_DISPLAY_DEBUG_MAP, async () => {
    if (!isDev()) {
      return { success: false, error: 'debug-map-disabled' };
    }
    if (typeof getDisplayDebugMap !== 'function') {
      return { success: false, error: 'debug-map-unavailable' };
    }
    try {
      const map = getDisplayDebugMap('overlay');
      return { success: true, map };
    } catch (err) {
      return { success: false, error: err && err.message ? err.message : 'debug-map-failed' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.RESIZE_OVERLAY, async (_event, bounds) => {
    if (!core.overlayWin || core.overlayWin.isDestroyed()) {
      return { success: false, error: 'overlay-missing' };
    }
    if (overlay.resetInProgress) {
      return { success: true, ignored: true };
    }
    const current = core.overlayWin.getBounds();
    const ignoreMoves = overlay.overlayDetachGuardActive || Date.now() < overlay.overlayIgnoreMoveUntil;
    let wantsX = !!(bounds && Number.isFinite(bounds.x));
    let wantsY = !!(bounds && Number.isFinite(bounds.y));
    let wantsW = !!(bounds && Number.isFinite(bounds.width));
    let wantsH = !!(bounds && Number.isFinite(bounds.height));

    let rawX = (!ignoreMoves && wantsX) ? Math.round(bounds.x) : current.x;
    const rawY = (!ignoreMoves && wantsY) ? Math.round(bounds.y) : current.y;
    let rawW = wantsW ? Math.round(bounds.width) : current.width;
    let rawH = wantsH ? Math.round(bounds.height) : current.height;
    const resizeDir = bounds && bounds.__debug ? bounds.__debug.dir : null;
    if (resizeDir === 'right') {
      rawH = current.height;
    }


    let width = Math.max(450, rawW);
    let height = Math.max(140, rawH);
    let targetDisplay = null;
    try {
      if (screen && typeof screen.getDisplayMatching === 'function') {
        targetDisplay = screen.getDisplayMatching({
          x: current.x,
          y: current.y,
          width: current.width,
          height: current.height
        });
      }
    } catch (_) {}
    if (!targetDisplay && screen && typeof screen.getDisplayNearestPoint === 'function') {
      try {
        targetDisplay = screen.getDisplayNearestPoint({
          x: current.x + Math.round(current.width / 2),
          y: current.y + Math.round(current.height / 2)
        });
      } catch (_) {}
    }
    const area = targetDisplay && targetDisplay.workArea ? targetDisplay.workArea : null;
    if (area) {
      width = Math.min(width, Math.max(450, area.width));
      height = Math.min(height, Math.max(140, area.height));
    }

    const clamped = clampWindowToWorkArea(rawX, rawY, width, height, 0);

    const next = {
      x: ignoreMoves ? current.x : (wantsX ? clamped.x : current.x),
      y: ignoreMoves ? current.y : (wantsY ? clamped.y : current.y),
      width,
      height
    };

    try {
      const hasMoveReq = !!(bounds && (Number.isFinite(bounds.x) || Number.isFinite(bounds.y)));
      const moved = next.x !== current.x || next.y !== current.y;
      const ignoredMove = ignoreMoves && hasMoveReq;
      if (moved || ignoredMove) {
        appendOverlayDebug({
          t: new Date().toISOString(),
          event: 'overlay-resize',
          ignoreMoves,
          current: { x: current.x, y: current.y, width: current.width, height: current.height },
          request: {
            x: bounds && Number.isFinite(bounds.x) ? Math.round(bounds.x) : null,
            y: bounds && Number.isFinite(bounds.y) ? Math.round(bounds.y) : null,
            width: bounds && Number.isFinite(bounds.width) ? Math.round(bounds.width) : null,
            height: bounds && Number.isFinite(bounds.height) ? Math.round(bounds.height) : null
          },
          raw: { x: rawX, y: rawY, width: rawW, height: rawH },
          clamped: { x: clamped.x, y: clamped.y },
          next,
          debug: bounds && bounds.__debug ? bounds.__debug : null
        });
      }
    } catch (_) {}

    try { core.overlayWin.setBounds(next); } catch (_) {}
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.RESET_LAYOUT, async () => {
    if (!core.overlayWin || core.overlayWin.isDestroyed()) {
      return { success: false, error: 'overlay-missing' };
    }

    overlay.resetInProgress = true;
    overlay.overlayIgnoreMoveUntil = Date.now() + 2000;

    try {
      if (registry.layout && registry.layout.windowLayouts) {
        registry.layout.windowLayouts.clear();
      }
    } catch (_) {}

    try { setPinnedHistoryWindowsVisible(false); } catch (_) {}
    try { setBlockWindowsVisible(false); } catch (_) {}
    try { setDetachedPanelWindowsVisible(false); } catch (_) {}
    try { notePanel.setNotePanelVisible(false); } catch (_) {}

    try {
      const keys = [
        STORAGE_KEYS.OVERLAY_POSITION_X,
        STORAGE_KEYS.OVERLAY_POSITION_Y,
        STORAGE_KEYS.OVERLAY_LAYOUT_MODE,
        STORAGE_KEYS.PINNED_TABS,
        STORAGE_KEYS.PINNED_HISTORY,
        STORAGE_KEYS.OVERLAY_PANEL_HEIGHTS,
        STORAGE_KEYS.NOTE_PANEL_BOUNDS,
        STORAGE_KEYS.WINDOW_LAYOUTS,
        STORAGE_KEYS.BLOCK_LAYOUTS,
        STORAGE_KEYS.BLOCK_FREE_LAYOUT,
        'overlayWidgetCompositionMode',
        'overlayBounds',
        'overlayWidth',
        'overlayHeight',
        'infoPanelBounds',
        'detachedPanelBounds',
        'blockWindowBounds'
      ];
      const script = `(() => { try { const keys = ${JSON.stringify(keys)}; keys.forEach((k) => localStorage.removeItem(k)); return true; } catch (_) { return false; } })()`;
      await core.overlayWin.webContents.executeJavaScript(script, true);
    } catch (_) {}

    try {
      core.overlayWin.setSize(1100, 500);
      ensureOverlayWithinVisibleBounds(true);
    } catch (_) {}

    setTimeout(() => {
      try {
        if (core.overlayWin && !core.overlayWin.isDestroyed()) {
          core.overlayWin.reload();
        }
      } catch (_) {}
    }, 150);

    setTimeout(() => {
      overlay.resetInProgress = false;
    }, 2000);

    return { success: true };
  });

  ipcMain.on(IPC_CHANNELS.OVERLAY_DETACH_GUARD, (_event, active) => {
    overlay.overlayDetachGuardActive = !!active;
  });

  ipcMain.handle(IPC_CHANNELS.OVERLAY_PERF_SAMPLE, (_event, payload) => {
    if (!isDev()) {
      return { success: true, ignored: true };
    }
    try {
      if (!payload || typeof payload !== 'object') return;
      appendOverlayPerf({
        t: new Date().toISOString(),
        ...payload
      });
    } catch (_) {}
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY_GET, async () => {
    try {
      if (!core.overlayWin || core.overlayWin.isDestroyed()) {
        return { success: false, history: [] };
      }
      const raw = await core.overlayWin.webContents.executeJavaScript(
        `localStorage.getItem(${JSON.stringify(STORAGE_KEYS.CONVERSATION_HISTORY)})`,
        true
      );
      if (!raw) return { success: true, history: [] };
      const parsed = JSON.parse(raw);
      return { success: true, history: Array.isArray(parsed) ? parsed : [] };
    } catch (_) {
      return { success: false, history: [] };
    }
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY_SET, async (_event, payload) => {
    try {
      if (!core.overlayWin || core.overlayWin.isDestroyed()) {
        return { success: false };
      }
      const list = Array.isArray(payload) ? payload : [];
      const raw = JSON.stringify(list);
      await core.overlayWin.webContents.executeJavaScript(
        `localStorage.setItem(${JSON.stringify(STORAGE_KEYS.CONVERSATION_HISTORY)}, ${JSON.stringify(raw)});`,
        true
      );
      await core.overlayWin.webContents.executeJavaScript(
        `try { if (typeof loadHistory === 'function') loadHistory(); if (typeof renderHistory === 'function') renderHistory(); } catch (_) {}`,
        true
      );
      return { success: true };
    } catch (_) {
      return { success: false };
    }
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY_SAVED_GET, async () => {
    try {
      const existing = loadSavedHistory();
      return { success: true, items: existing.items || [] };
    } catch (_) {
      return { success: false, items: [] };
    }
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY_SAVED_ADD, async (_event, payload) => {
    try {
      return addSavedHistoryEntry(payload || {});
    } catch (_) {
      return { success: false };
    }
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY_SAVED_REMOVE, async (_event, payload) => {
    try {
      const id = payload && payload.id;
      return removeSavedHistoryEntry(id);
    } catch (_) {
      return { success: false };
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_GAME_CONTEXT, async () => {
    if (!game.currentDetectedGame) {
      const now = Date.now();
      if ((now - (game.lastGameDetectAt || 0)) > 3000) {
        try { detectCurrentGame(true); } catch (_) {}
      }
    }
    return game.currentDetectedGame;
  });

  ipcMain.handle(IPC_CHANNELS.SET_AUTO_START, async (_event, enable) => {
    app.setLoginItemSettings({
      openAtLogin: !!enable,
      path: process.execPath
    });
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.GET_AUTO_START, () => app.getLoginItemSettings().openAtLogin);

  ipcMain.handle(IPC_CHANNELS.CAPTURE_SCREENSHOT, async () => {
    try {
      const { desktopCapturer } = require('electron');
      const wasVirtualVisible = core.overlayWin && !core.overlayWin.isDestroyed() && overlay.overlayVirtualVisible;
      if (wasVirtualVisible) {
        setOverlayVirtualVisible(false);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 }
      });
      if (sources.length === 0) {
        if (wasVirtualVisible) setOverlayVirtualVisible(true);
        return { success: false, error: 'Nincs elerheto kepernyo' };
      }
      const primarySource = sources[0];
      const imageData = primarySource.thumbnail.toDataURL();
      if (wasVirtualVisible) setOverlayVirtualVisible(true);
      return { success: true, imageData };
    } catch (err) {
      console.error('[Screenshot] Hiba:', err);
      if (core.overlayWin && !core.overlayWin.isDestroyed()) setOverlayVirtualVisible(true);
      return { success: false, error: err.message };
    }
  });
}

module.exports = {
  registerOverlayIpc
};