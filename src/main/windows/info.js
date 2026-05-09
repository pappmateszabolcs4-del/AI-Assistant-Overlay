const { IPC_CHANNELS } = require('../../shared/ipc-channels');

function createInfoPanelManager(deps) {
  const {
    registry,
    BrowserWindow,
    clampWindowToWorkArea,
    getPreferredOverlayDisplay,
    getCurrentLanguage
  } = deps;

  function bringInfoPanelToFront() {
    if (!registry.infoPanelWin || registry.infoPanelWin.isDestroyed()) return;
    try {
      // Keep the info panel above the overlay.
      registry.infoPanelWin.setAlwaysOnTop(true, 'screen-saver', 2);
    } catch (_) {
      try { registry.infoPanelWin.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
    }
    try { registry.infoPanelWin.moveTop(); } catch (_) {}
  }

  function setInfoPanelVisible(visible) {
    if (visible && (!registry.infoPanelWin || registry.infoPanelWin.isDestroyed())) {
      try { createInfoPanelWindow({}); } catch (_) {}
    }
    if (!registry.infoPanelWin || registry.infoPanelWin.isDestroyed()) return;
    try {
      registry.infoPanelVirtualVisible = !!visible;
      if (visible) {
        try {
          if (!registry.infoPanelWin.isVisible()) {
            if (typeof registry.infoPanelWin.showInactive === 'function') registry.infoPanelWin.showInactive();
            else registry.infoPanelWin.show();
          }
        } catch (_) {}
        try { registry.infoPanelWin.setIgnoreMouseEvents(true, { forward: true }); } catch (_) {}
        if (typeof registry.infoPanelWin.setOpacity === 'function') {
          try { registry.infoPanelWin.setOpacity(1); } catch (_) {}
        }
        try { bringInfoPanelToFront(); } catch (_) {}
      } else {
        try { registry.infoPanelWin.setIgnoreMouseEvents(true); } catch (_) {}
        if (typeof registry.infoPanelWin.setOpacity === 'function') {
          try { registry.infoPanelWin.setOpacity(0); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  function closeInfoPanelWindow() {
    if (!registry.infoPanelWin || registry.infoPanelWin.isDestroyed()) {
      registry.infoPanelWin = null;
      return;
    }
    try { registry.infoPanelWin.destroy(); } catch (_) {}
    registry.infoPanelWin = null;
  }

  function createInfoPanelWindow(payload) {
    if (registry.infoPanelWin && !registry.infoPanelWin.isDestroyed()) {
      try { registry.infoPanelWin.webContents.send(IPC_CHANNELS.INFO_PANEL_INIT, payload || {}); } catch (_) {}
      return registry.infoPanelWin;
    }

    const bounds = (payload && payload.bounds) ? payload.bounds : (registry.infoPanelLastBounds || null);
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

    registry.infoPanelWin = new BrowserWindow({
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

    registry.infoPanelWin.loadFile('info-panel.html');
    registry.infoPanelWin.webContents.on('did-finish-load', () => {
      try {
        const language = getCurrentLanguage();
        registry.infoPanelWin.webContents.send(IPC_CHANNELS.INFO_PANEL_INIT, { ...(payload || {}), language });
      } catch (_) {}
    });

    try {
      registry.infoPanelWin.setAlwaysOnTop(true, 'screen-saver', 2);
    } catch (_) {
      registry.infoPanelWin.setAlwaysOnTop(true, 'screen-saver');
    }
    try { registry.infoPanelWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (_) {}

    registry.infoPanelWin.on('closed', () => {
      registry.infoPanelWin = null;
    });

    // Start click-through; the renderer enables interactivity on hover.
    try { registry.infoPanelWin.setIgnoreMouseEvents(true, { forward: true }); } catch (_) {}

    return registry.infoPanelWin;
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
