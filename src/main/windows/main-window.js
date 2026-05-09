function createMainWindowManager(deps) {
  const {
    registry,
    BrowserWindow,
    closeAllPinnedHistoryWindows,
    closeAllDetachedPanelWindows,
    notePanel
  } = deps;

  const { core } = registry;

  function createWindow() {
    core.win = new BrowserWindow({
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
    core.win.loadFile('index.html');

    core.win.on('closed', () => {
      core.win = null;
      if (core.overlayWin && !core.overlayWin.isDestroyed()) {
        core.overlayWin.close();
      }
      core.overlayWin = null;
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
