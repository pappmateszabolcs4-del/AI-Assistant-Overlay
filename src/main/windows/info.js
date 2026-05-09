const { IPC_CHANNELS } = require('../../shared/ipc-channels');

function createInfoPanelManager(deps) {
  const {
    registry,
    BrowserWindow,
    clampWindowToWorkArea,
    getPreferredOverlayDisplay,
    getCurrentLanguage
  } = deps;

  const { info } = registry;

  function bringInfoPanelToFront() {
    if (!info.infoPanelWin || info.infoPanelWin.isDestroyed()) return;
    try {
      // Keep the info panel above the overlay.
      info.infoPanelWin.setAlwaysOnTop(true, 'screen-saver', 2);
    } catch (_) {
      try { info.infoPanelWin.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
    }
    try { info.infoPanelWin.moveTop(); } catch (_) {}
  }

  function setInfoPanelVisible(visible) {
    if (visible && (!info.infoPanelWin || info.infoPanelWin.isDestroyed())) {
      try { createInfoPanelWindow({}); } catch (_) {}
    }
    if (!info.infoPanelWin || info.infoPanelWin.isDestroyed()) return;
    try {
      info.infoPanelVirtualVisible = !!visible;
      if (visible) {
        try {
          if (!info.infoPanelWin.isVisible()) {
            if (typeof info.infoPanelWin.showInactive === 'function') info.infoPanelWin.showInactive();
            else info.infoPanelWin.show();
          }
        } catch (_) {}
        try { info.infoPanelWin.setIgnoreMouseEvents(true, { forward: true }); } catch (_) {}
        if (typeof info.infoPanelWin.setOpacity === 'function') {
          try { info.infoPanelWin.setOpacity(1); } catch (_) {}
        }
        try { bringInfoPanelToFront(); } catch (_) {}
      } else {
        try { info.infoPanelWin.setIgnoreMouseEvents(true); } catch (_) {}
        if (typeof info.infoPanelWin.setOpacity === 'function') {
          try { info.infoPanelWin.setOpacity(0); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  function closeInfoPanelWindow() {
    if (!info.infoPanelWin || info.infoPanelWin.isDestroyed()) {
      info.infoPanelWin = null;
      return;
    }
    try { info.infoPanelWin.destroy(); } catch (_) {}
    info.infoPanelWin = null;
  }

  function createInfoPanelWindow(payload) {
    if (info.infoPanelWin && !info.infoPanelWin.isDestroyed()) {
      try { info.infoPanelWin.webContents.send(IPC_CHANNELS.INFO_PANEL_INIT, payload || {}); } catch (_) {}
      return info.infoPanelWin;
    }

    const bounds = (payload && payload.bounds) ? payload.bounds : (info.infoPanelLastBounds || null);
    const width = Math.max(240, Math.round((bounds && bounds.width) || 440));
    const height = Math.max(140, Math.round((bounds && bounds.height) || 300));
    let x = typeof (bounds && bounds.x) === 'number' ? Math.round(bounds.x) : undefined;
    let y = typeof (bounds && bounds.y) === 'number' ? Math.round(bounds.y) : undefined;

    if (typeof x !== 'number' || typeof y !== 'number') {
      try {
        const display = getPreferredOverlayDisplay();
        const area = display && display.workArea ? display.workArea : require('electron').screen.getPrimaryDisplay().workArea;
        x = Math.round(area.x + Math.max(0, (area.width - width) / 2));
        y = Math.round(area.y + Math.max(0, (area.height - height) / 2));
      } catch (_) {}
    }

    const clampedPos = (typeof x === 'number' && typeof y === 'number')
      ? clampWindowToWorkArea(x, y, width, height, 0)
      : null;

    info.infoPanelWin = new BrowserWindow({
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

    info.infoPanelWin.loadFile('info-panel.html');
    info.infoPanelWin.webContents.on('did-finish-load', () => {
      try {
        const language = getCurrentLanguage();
        info.infoPanelWin.webContents.send(IPC_CHANNELS.INFO_PANEL_INIT, { ...(payload || {}), language });
      } catch (_) {}
    });

    try {
      info.infoPanelWin.setAlwaysOnTop(true, 'screen-saver', 2);
    } catch (_) {
      info.infoPanelWin.setAlwaysOnTop(true, 'screen-saver');
    }
    try { info.infoPanelWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (_) {}

    info.infoPanelWin.on('closed', () => {
      info.infoPanelWin = null;
    });

    // Start click-through; the renderer enables interactivity on hover.
    try { info.infoPanelWin.setIgnoreMouseEvents(true, { forward: true }); } catch (_) {}

    return info.infoPanelWin;
  }

  return {
    bringInfoPanelToFront,
    setInfoPanelVisible,
    closeInfoPanelWindow,
    createInfoPanelWindow
  };
}

module.exports = {
  createInfoPanelManager
};
