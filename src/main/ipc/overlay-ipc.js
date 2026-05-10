const { IPC_CHANNELS } = require('../../shared/ipc-channels');

function registerOverlayIpc(deps) {
  const {
    app,
    BrowserWindow,
    ipcMain,
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
    createOverlayWindow
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
    notePanel.setNotePanelVisible(true);
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

  ipcMain.handle(IPC_CHANNELS.RESIZE_OVERLAY, async (_event, bounds) => {
    if (!core.overlayWin || core.overlayWin.isDestroyed()) {
      return { success: false, error: 'overlay-missing' };
    }
    const current = core.overlayWin.getBounds();
    const ignoreMoves = overlay.overlayDetachGuardActive || Date.now() < overlay.overlayIgnoreMoveUntil;
    const rawX = (!ignoreMoves && bounds && Number.isFinite(bounds.x)) ? Math.round(bounds.x) : current.x;
    const rawY = (!ignoreMoves && bounds && Number.isFinite(bounds.y)) ? Math.round(bounds.y) : current.y;
    const rawW = (bounds && Number.isFinite(bounds.width)) ? Math.round(bounds.width) : current.width;
    const rawH = (bounds && Number.isFinite(bounds.height)) ? Math.round(bounds.height) : current.height;

    const width = Math.max(240, rawW);
    const height = Math.max(140, rawH);
    const clamped = clampWindowToWorkArea(rawX, rawY, width, height, 0);

    const next = {
      x: ignoreMoves ? current.x : clamped.x,
      y: ignoreMoves ? current.y : clamped.y,
      width,
      height
    };

    try { core.overlayWin.setBounds(next); } catch (_) {}
    return { success: true };
  });

  ipcMain.on(IPC_CHANNELS.OVERLAY_DETACH_GUARD, (_event, active) => {
    overlay.overlayDetachGuardActive = !!active;
  });

  ipcMain.handle(IPC_CHANNELS.GET_GAME_CONTEXT, async () => {
    if (!game.currentDetectedGame) {
      try { detectCurrentGame(false); } catch (_) {}
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

  ipcMain.handle(IPC_CHANNELS.SET_GAME_DETECT_IGNORE_LIST, (_event, list) => {
    const normalized = Array.isArray(list)
      ? list.map((entry) => String(entry).trim()).filter(Boolean)
      : [];
    game.gameDetectIgnoreList = normalized;
    try {
      detectCurrentGame(true);
      if (core.overlayWin && !core.overlayWin.isDestroyed()) {
        core.overlayWin.webContents.send(IPC_CHANNELS.SET_GAME_CONTEXT, game.currentDetectedGame);
      }
    } catch (_) {}
    return { success: true };
  });

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