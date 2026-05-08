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

      if (registry.overlayWin && !registry.overlayWin.isDestroyed() && registry.currentDetectedGame) {
        try { registry.overlayWin.webContents.send(IPC_CHANNELS.SET_GAME_CONTEXT, registry.currentDetectedGame); } catch (_) {}
      }

      if (registry.overlayWin && !registry.overlayWin.isDestroyed()) {
        if (registry.overlayVirtualVisible) {
          registry.overlayDetachGuardActive = false;
          setOverlayVirtualVisible(false);
          setPinnedHistoryWindowsVisible(false);
          registry.detachedWindowsDesiredVisible = false;
          setDetachedPanelWindowsVisible(false);
          reconcileDetachedPanelWindowsVisibility('hotkey hide');
          notePanel.setNotePanelVisible(false);
          registry.lastOverlayRaiseAt = 0;
        } else {
          registry.detachedWindowsDesiredVisible = true;
          showOverlayAndRaise();
          setPinnedHistoryWindowsVisible(true);
          setDetachedPanelWindowsVisible(true);
          reconcileDetachedPanelWindowsVisibility('hotkey show');
          notePanel.setNotePanelVisible(true);
          registry.lastOverlayRaiseAt = now;
        }
      } else {
        createOverlayWindow();
        registry.detachedWindowsDesiredVisible = true;
        showOverlayAndRaise();
        setPinnedHistoryWindowsVisible(true);
        setDetachedPanelWindowsVisible(true);
        reconcileDetachedPanelWindowsVisibility('hotkey create+show');
        notePanel.setNotePanelVisible(true);
        registry.lastOverlayRaiseAt = now;
        if (registry.overlayWin && !registry.overlayWin.isDestroyed()) {
          registry.overlayWin.webContents.send(IPC_CHANNELS.SET_LANGUAGE, getCurrentLanguage());
          if (registry.currentDetectedGame) {
            registry.overlayWin.webContents.send(IPC_CHANNELS.SET_GAME_CONTEXT, registry.currentDetectedGame);
          }
        }
      }

      if (registry.win && !registry.win.isDestroyed()) {
        registry.win.setAlwaysOnTop(false);
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
