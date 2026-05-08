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
    closeAllPinnedHistoryWindows,
    closeAllDetachedPanelWindows,
    notePanel,
    registerHotkey
  } = deps;

  function setupAppLifecycle() {
    app.whenReady().then(async () => {
      await openaiService.initializeOpenAI();
      registerIpcHandlers();

      createWindow();
      createOverlayWindow();

      const handleDisplayChange = () => {
        if (!registry.overlayWin || registry.overlayWin.isDestroyed()) return;
        ensureOverlayWithinVisibleBounds();
        if (registry.overlayVirtualVisible) {
          reassertOverlayTopmost();
        }
      };
      screen.on('display-metrics-changed', handleDisplayChange);
      screen.on('display-added', handleDisplayChange);
      screen.on('display-removed', handleDisplayChange);

      registry.win.webContents.once('did-finish-load', () => {
        setTimeout(() => {
          registry.win.webContents.executeJavaScript(`localStorage.getItem(${JSON.stringify(STORAGE_KEYS.APP_SETTINGS)})`)
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

      try {
        globalShortcut.unregisterAll();
        console.log('[Cleanup] Global shortcut-ok unregisztrálva');
      } catch (err) {
        console.error('[Cleanup] Shortcut unregister hiba:', err);
      }

      if (registry.overlayWin && !registry.overlayWin.isDestroyed()) {
        try {
          registry.overlayWin.destroy();
          console.log('[Cleanup] Overlay ablak megsemmisítve');
        } catch (err) {
          console.error('[Cleanup] Overlay destroy hiba:', err);
        }
      }
      registry.overlayWin = null;

      try {
        closeAllPinnedHistoryWindows();
        console.log('[Cleanup] Pinned ablakok megsemmisítve');
      } catch (err) {
        console.error('[Cleanup] Pinned destroy hiba:', err);
      }

      if (registry.win && !registry.win.isDestroyed()) {
        try {
          registry.win.destroy();
          console.log('[Cleanup] Főablak megsemmisítve');
        } catch (err) {
          console.error('[Cleanup] Főablak destroy hiba:', err);
        }
      }
      registry.win = null;
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
