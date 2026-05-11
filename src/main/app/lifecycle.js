const { STORAGE_KEYS } = require('../../shared/storage-keys');

function createLifecycleManager(deps) {
  const {
    app,
    screen,
    BrowserWindow,
    globalShortcut,
    registry,
    openaiService,
    registerIpcHandlers,
    createWindow,
    createOverlayWindow,
    ensureOverlayWithinVisibleBounds,
    reassertOverlayTopmost,
    updateDisplaySnapshot,
    reflowAllWindows,
    closeAllPinnedHistoryWindows,
    closeAllDetachedPanelWindows,
    closeAllBlockWindows,
    notePanel,
    registerHotkey,
    detectCurrentGame,
    tryGetDisplayForGameWindow
  } = deps;

  const { core, overlay, game } = registry;

  const GAME_DISPLAY_FOLLOW_INTERVAL_MS = 1500;
  const GAME_DISPLAY_FOLLOW_MIN_MOVE_MS = 1200;

  function clamp01(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return 0;
    return Math.min(1, Math.max(0, v));
  }

  function getDisplayForBounds(bounds) {
    if (!bounds) return null;
    if (screen && typeof screen.getDisplayMatching === 'function') {
      try {
        const match = screen.getDisplayMatching({
          x: Math.round(bounds.x),
          y: Math.round(bounds.y),
          width: Math.max(1, Math.round(bounds.width || 1)),
          height: Math.max(1, Math.round(bounds.height || 1))
        });
        if (match) return match;
      } catch (_) {}
    }
    if (screen && typeof screen.getDisplayNearestPoint === 'function') {
      try {
        return screen.getDisplayNearestPoint({
          x: Math.round(bounds.x + Math.max(0, bounds.width || 0) / 2),
          y: Math.round(bounds.y + Math.max(0, bounds.height || 0) / 2)
        });
      } catch (_) {}
    }
    return null;
  }

  function getRecentGameDisplayFromState() {
    try {
      const now = Date.now();
      if (game.lastKnownGameDisplayId == null) return null;
      if ((now - game.lastKnownGameDisplayAt) > 10 * 60 * 1000) return null;
      const displays = screen.getAllDisplays();
      return displays.find((d) => d && d.id === game.lastKnownGameDisplayId) || null;
    } catch (_) {
      return null;
    }
  }

  function computeFollowBounds(currentBounds, fromDisplay, targetDisplay) {
    if (!currentBounds || !targetDisplay || !targetDisplay.workArea) return null;
    const toArea = targetDisplay.workArea;
    let x = toArea.x;
    let y = toArea.y;

    if (fromDisplay && fromDisplay.workArea) {
      const fromArea = fromDisplay.workArea;
      const nx = clamp01((currentBounds.x - fromArea.x) / Math.max(1, fromArea.width));
      const ny = clamp01((currentBounds.y - fromArea.y) / Math.max(1, fromArea.height));
      x = Math.round(toArea.x + nx * toArea.width);
      y = Math.round(toArea.y + ny * toArea.height);
    } else {
      x = Math.round(toArea.x + Math.max(0, (toArea.width - currentBounds.width) / 2));
      y = Math.round(toArea.y + Math.max(0, (toArea.height - currentBounds.height) / 2));
    }

    const maxX = toArea.x + Math.max(0, toArea.width - currentBounds.width);
    const maxY = toArea.y + Math.max(0, toArea.height - currentBounds.height);
    x = Math.min(Math.max(x, toArea.x), maxX);
    y = Math.min(Math.max(y, toArea.y), maxY);

    return {
      x,
      y,
      width: currentBounds.width,
      height: currentBounds.height
    };
  }

  function followGameDisplayIfNeeded() {
    if (!core.overlayWin || core.overlayWin.isDestroyed()) return;
    if (!overlay.overlayVirtualVisible) return;
    if (overlay.overlayDetachGuardActive) return;
    if (Date.now() < overlay.overlayIgnoreMoveUntil) return;

    try { detectCurrentGame(false); } catch (_) {}
    if (!game.currentDetectedGame) return;

    const targetDisplay = tryGetDisplayForGameWindow(game.currentDetectedGame)
      || getRecentGameDisplayFromState();
    if (!targetDisplay || !targetDisplay.workArea) return;

    let currentBounds = null;
    try { currentBounds = core.overlayWin.getBounds(); } catch (_) { currentBounds = null; }
    if (!currentBounds) return;

    const currentDisplay = getDisplayForBounds(currentBounds);
    if (currentDisplay && currentDisplay.id === targetDisplay.id) return;

    const now = Date.now();
    if ((now - overlay.lastGameFollowAt) < GAME_DISPLAY_FOLLOW_MIN_MOVE_MS) return;

    const nextBounds = computeFollowBounds(currentBounds, currentDisplay, targetDisplay);
    if (!nextBounds) return;

    overlay.lastGameFollowAt = now;
    overlay.overlayIgnoreMoveUntil = now + 600;
    try { core.overlayWin.setBounds(nextBounds); } catch (_) {}
  }

  function startGameDisplayFollow() {
    if (overlay.gameDisplayFollowTimer) return;
    overlay.gameDisplayFollowTimer = setInterval(() => {
      try { followGameDisplayIfNeeded(); } catch (_) {}
    }, GAME_DISPLAY_FOLLOW_INTERVAL_MS);
  }

  function stopGameDisplayFollow() {
    if (!overlay.gameDisplayFollowTimer) return;
    clearInterval(overlay.gameDisplayFollowTimer);
    overlay.gameDisplayFollowTimer = null;
  }

  function setupAppLifecycle() {
    app.whenReady().then(async () => {
      await openaiService.initializeOpenAI();
      registerIpcHandlers();

      createWindow();
      createOverlayWindow();
      try { updateDisplaySnapshot('startup'); } catch (_) {}
      startGameDisplayFollow();

      const handleDisplayChange = () => {
        if (!core.overlayWin || core.overlayWin.isDestroyed()) return;
        try { updateDisplaySnapshot('display-change'); } catch (_) {}
        try { reflowAllWindows(); } catch (_) {}
        ensureOverlayWithinVisibleBounds();
        if (overlay.overlayVirtualVisible) {
          reassertOverlayTopmost();
        }
      };
      screen.on('display-metrics-changed', handleDisplayChange);
      screen.on('display-added', handleDisplayChange);
      screen.on('display-removed', handleDisplayChange);

      core.win.webContents.once('did-finish-load', () => {
        setTimeout(() => {
          core.win.webContents.executeJavaScript(`localStorage.getItem(${JSON.stringify(STORAGE_KEYS.APP_SETTINGS)})`)
            .then(settingsStr => {
              let hotkey = 'CommandOrControl+Shift+K';
              if (settingsStr) {
                try {
                  const settings = JSON.parse(settingsStr);
                  if (settings.hotkey) {
                    hotkey = settings.hotkey;
                  }
                } catch (e) {
                  console.error('Error parsing settings:', e);
                }
              }

              registerHotkey(hotkey);
            })
            .catch(err => {
              console.error('Error loading hotkey from localStorage:', err);
              registerHotkey('CommandOrControl+Shift+K');
            });
        }, 500);
      });
    });

    app.on('window-all-closed', () => {
      app.quit();
    });

    function cleanup() {
      console.log('[Cleanup] Alkalmazás leállítása...');

      stopGameDisplayFollow();

      try {
        globalShortcut.unregisterAll();
        console.log('[Cleanup] Global shortcut-ok unregisztrálva');
      } catch (err) {
        console.error('[Cleanup] Shortcut unregister hiba:', err);
      }

      if (core.overlayWin && !core.overlayWin.isDestroyed()) {
        try {
          core.overlayWin.destroy();
          console.log('[Cleanup] Overlay ablak megsemmisítve');
        } catch (err) {
          console.error('[Cleanup] Overlay destroy hiba:', err);
        }
      }
      core.overlayWin = null;

      try {
        closeAllPinnedHistoryWindows();
        console.log('[Cleanup] Pinned ablakok megsemmisítve');
      } catch (err) {
        console.error('[Cleanup] Pinned destroy hiba:', err);
      }

      try {
        closeAllBlockWindows();
        console.log('[Cleanup] Block ablakok megsemmisítve');
      } catch (err) {
        console.error('[Cleanup] Block destroy hiba:', err);
      }

      if (core.win && !core.win.isDestroyed()) {
        try {
          core.win.destroy();
          console.log('[Cleanup] Főablak megsemmisítve');
        } catch (err) {
          console.error('[Cleanup] Főablak destroy hiba:', err);
        }
      }
      core.win = null;
    }

    app.on('before-quit', () => {
      cleanup();
    });

    app.on('will-quit', () => {
      globalShortcut.unregisterAll();
    });

    process.on('exit', () => {
      cleanup();
    });

    process.on('SIGTERM', () => {
      console.log('[SIGTERM] Jel fogadva, app bezárása...');
      cleanup();
      app.quit();
    });

    process.on('SIGINT', () => {
      console.log('[SIGINT] Jel fogadva, app bezárása...');
      cleanup();
      app.quit();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  }

  return {
    setupAppLifecycle
  };
}

module.exports = {
  createLifecycleManager
};
