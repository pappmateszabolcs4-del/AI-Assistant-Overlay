const { screen } = require('electron');
const { IPC_CHANNELS } = require('../../shared/ipc-channels');

function createPinnedWindowsManager(deps) {
  const {
    registry,
    BrowserWindow,
    clampWindowToWorkArea
  } = deps;

  const { pinned } = registry;

  function bringPinnedHistoryWindowsToFront() {
    pinned.pinnedHistoryWindows.forEach((w) => {
      if (!w || w.isDestroyed()) return;
      try {
        // Keep pinned panels above the overlay so the overlay rectangle can't visually "cut" them.
        w.setAlwaysOnTop(true, 'screen-saver', 3);
      } catch (_) {
        try { w.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
      }
      try { w.moveTop(); } catch (_) {}
    });
  }

  function setPinnedHistoryWindowsVisible(visible) {
    pinned.pinnedHistoryWindows.forEach((w) => {
      if (!w || w.isDestroyed()) return;
      try {
        if (visible) {
          if (typeof w.showInactive === 'function') w.showInactive();
          else w.show();
          try { w.moveTop(); } catch (_) {}
        } else {
          w.hide();
        }
      } catch (_) {}
    });
  }

  function closeAllPinnedHistoryWindows() {
    pinned.pinnedHistoryWindows.forEach((w) => {
      if (!w || w.isDestroyed()) return;
      try { w.destroy(); } catch (_) {}
    });
    pinned.pinnedHistoryWindows.clear();
  }

  function createPinnedHistoryWindow(payload) {
    const ts = Number(payload && payload.ts);
    if (!Number.isFinite(ts)) return null;

    const existing = pinned.pinnedHistoryWindows.get(ts);
    if (existing && !existing.isDestroyed()) {
      try { existing.webContents.send(IPC_CHANNELS.PINNED_HISTORY_UPDATE, payload); } catch (_) {}
      return existing;
    }

    const bounds = payload && payload.bounds ? payload.bounds : null;
    const width = Math.max(260, Math.round((bounds && bounds.width) || 420));
    const height = Math.max(160, Math.round((bounds && bounds.height) || 300));
    const x = typeof (bounds && bounds.x) === 'number' ? Math.round(bounds.x) : undefined;
    const y = typeof (bounds && bounds.y) === 'number' ? Math.round(bounds.y) : undefined;

    const clampedPos = (typeof x === 'number' && typeof y === 'number')
      ? clampWindowToWorkArea(x, y, width, height, 0)
      : null;

    const pinnedWin = new BrowserWindow({
      width,
      height,
      x: clampedPos ? clampedPos.x : x,
      y: clampedPos ? clampedPos.y : y,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focusable: true,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    pinnedWin.__pinnedHistoryTs = ts;
    pinned.pinnedHistoryWindows.set(ts, pinnedWin);

    pinnedWin.loadFile('pinned-history.html');
    pinnedWin.webContents.on('did-finish-load', () => {
      try { pinnedWin.webContents.send(IPC_CHANNELS.PINNED_HISTORY_INIT, payload); } catch (_) {}
    });

    // Keep pinned panels above the overlay window.
    try {
      pinnedWin.setAlwaysOnTop(true, 'screen-saver', 3);
    } catch (_) {
      pinnedWin.setAlwaysOnTop(true, 'screen-saver');
    }
    try { pinnedWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (_) {}

    pinnedWin.on('closed', () => {
      pinned.pinnedHistoryWindows.delete(ts);
    });

    // Start interactive so drag works immediately; window renderer will toggle click-through on hover.
    try {
      if (payload && payload.dragging) {
        // During drag-out from the overlay, keep this window fully click-through so it can't steal the pointer.
        pinnedWin.setIgnoreMouseEvents(true);
      } else {
        pinnedWin.setIgnoreMouseEvents(false);
      }
    } catch (_) {}

    try {
      if (typeof pinnedWin.showInactive === 'function') pinnedWin.showInactive();
      else pinnedWin.show();
      try { pinnedWin.moveTop(); } catch (_) {}
    } catch (_) {}

    return pinnedWin;
  }

  return {
    bringPinnedHistoryWindowsToFront,
    setPinnedHistoryWindowsVisible,
    closeAllPinnedHistoryWindows,
    createPinnedHistoryWindow
  };
}

module.exports = {
  createPinnedWindowsManager
};
