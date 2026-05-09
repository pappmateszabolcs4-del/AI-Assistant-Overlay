const { IPC_CHANNELS } = require('../../shared/ipc-channels');

function createHotkeyManager(deps) {
  const {
    registry,
    globalShortcut,
    detectCurrentGame,
    showOverlayAndRaise,
    setOverlayVirtualVisible,
    setPinnedHistoryWindowsVisible,
    setDetachedPanelWindowsVisible,
    reconcileDetachedPanelWindowsVisibility,
    notePanel,
    createOverlayWindow,
    getCurrentLanguage
  } = deps;

  const { core, overlay, game, detached } = registry;

  let isHotkeyProcessing = false;
  let lastHotkeyTime = 0;
  const HOTKEY_MIN_INTERVAL_MS = 250;

  function registerHotkey(hotkey) {
    const hotkeyCallback = async () => {
      if (isHotkeyProcessing) return;
      const now = Date.now();
      if (now - lastHotkeyTime < HOTKEY_MIN_INTERVAL_MS) return;
      lastHotkeyTime = now;

      isHotkeyProcessing = true;
      setTimeout(() => {
        isHotkeyProcessing = false;
      }, HOTKEY_MIN_INTERVAL_MS);

      detectCurrentGame();

      if (core.overlayWin && !core.overlayWin.isDestroyed() && game.currentDetectedGame) {
        try { core.overlayWin.webContents.send(IPC_CHANNELS.SET_GAME_CONTEXT, game.currentDetectedGame); } catch (_) {}
      }

      if (core.overlayWin && !core.overlayWin.isDestroyed()) {
        if (overlay.overlayVirtualVisible) {
          overlay.overlayDetachGuardActive = false;
          setOverlayVirtualVisible(false);
          setPinnedHistoryWindowsVisible(false);
          detached.detachedWindowsDesiredVisible = false;
          setDetachedPanelWindowsVisible(false);
          reconcileDetachedPanelWindowsVisibility('hotkey hide');
          notePanel.setNotePanelVisible(false);
          overlay.lastOverlayRaiseAt = 0;
        } else {
          detached.detachedWindowsDesiredVisible = true;
          showOverlayAndRaise();
          setPinnedHistoryWindowsVisible(true);
          setDetachedPanelWindowsVisible(true);
          reconcileDetachedPanelWindowsVisibility('hotkey show');
          notePanel.setNotePanelVisible(true);
          overlay.lastOverlayRaiseAt = now;
        }
      } else {
        createOverlayWindow();
        detached.detachedWindowsDesiredVisible = true;
        showOverlayAndRaise();
        setPinnedHistoryWindowsVisible(true);
        setDetachedPanelWindowsVisible(true);
        reconcileDetachedPanelWindowsVisibility('hotkey create+show');
        notePanel.setNotePanelVisible(true);
        overlay.lastOverlayRaiseAt = now;
        if (core.overlayWin && !core.overlayWin.isDestroyed()) {
          core.overlayWin.webContents.send(IPC_CHANNELS.SET_LANGUAGE, getCurrentLanguage());
          if (game.currentDetectedGame) {
            core.overlayWin.webContents.send(IPC_CHANNELS.SET_GAME_CONTEXT, game.currentDetectedGame);
          }
        }
      }

      if (core.win && !core.win.isDestroyed()) {
        core.win.setAlwaysOnTop(false);
      }
    };

    const success = globalShortcut.register(hotkey, hotkeyCallback);
    if (!success) {
      console.error(`Hotkey registration failed: ${hotkey}`);
    } else {
      console.log(`Hotkey registered: ${hotkey}`);
    }
  }

  return {
    registerHotkey
  };
}

module.exports = {
  createHotkeyManager
};
