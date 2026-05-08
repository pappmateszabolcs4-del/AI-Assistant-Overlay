function createMainWindowManager(deps) {
  const {
    registry,
    BrowserWindow,
    closeAllPinnedHistoryWindows,
    closeAllDetachedPanelWindows,
    notePanel
  } = deps;

  function createWindow() {
    registry.win = new BrowserWindow({
      width: 800,
      height: 600,
      minWidth: 600,
      minHeight: 500,
      alwaysOnTop: false,
      frame: false,
      resizable: true,
      show: true,
      backgroundColor: '#1e293b',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    registry.win.loadFile('index.html');

    registry.win.on('closed', () => {
      registry.win = null;
      if (registry.overlayWin && !registry.overlayWin.isDestroyed()) {
        registry.overlayWin.close();
      }
      registry.overlayWin = null;
      closeAllPinnedHistoryWindows();
      closeAllDetachedPanelWindows();
      notePanel.closeNotePanelWindow();
    });
  }

  return {
    createWindow
  };
}

module.exports = {
  createMainWindowManager
};
