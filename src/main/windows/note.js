const { IPC_CHANNELS } = require('../../shared/ipc-channels');

function createNotePanelManager(deps) {
  const {
    registry,
    BrowserWindow,
    clampWindowToWorkArea,
    captureWindowLayout,
    resolveLayoutBounds,
    getPreferredOverlayDisplay,
    getCurrentLanguage
  } = deps;

  const { note } = registry;

  function bringNotePanelToFront() {
    if (!note.notePanelWin || note.notePanelWin.isDestroyed()) return;
    try {
      // Keep the note panel above the overlay.
      note.notePanelWin.setAlwaysOnTop(true, 'screen-saver', 2);
    } catch (_) {
      try { note.notePanelWin.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
    }
    try { note.notePanelWin.moveTop(); } catch (_) {}
  }

  function setNotePanelVisible(visible) {
    if (visible && (!note.notePanelWin || note.notePanelWin.isDestroyed())) {
      try { createNotePanelWindow({}); } catch (_) {}
    }
    if (!note.notePanelWin || note.notePanelWin.isDestroyed()) return;
    try {
      note.notePanelVirtualVisible = !!visible;
      if (visible) {
        // Virtual-show: keep the window present, but toggle opacity.
        try {
          if (!note.notePanelWin.isVisible()) {
            if (typeof note.notePanelWin.showInactive === 'function') note.notePanelWin.showInactive();
            else note.notePanelWin.show();
          }
        } catch (_) {}
        try { note.notePanelWin.setIgnoreMouseEvents(true, { forward: true }); } catch (_) {}
        if (typeof note.notePanelWin.setOpacity === 'function') {
          try { note.notePanelWin.setOpacity(1); } catch (_) {}
        }
        try { bringNotePanelToFront(); } catch (_) {}
      } else {
        // Virtual-hide: do not call hide() to avoid z-order settle/flicker on re-show.
        // IMPORTANT: do NOT forward mouse moves while hidden; otherwise the invisible
        // textarea can still affect the cursor (I-beam) even though the window is click-through.
        try { note.notePanelWin.setIgnoreMouseEvents(true); } catch (_) {}
        if (typeof note.notePanelWin.setOpacity === 'function') {
          try { note.notePanelWin.setOpacity(0); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  function closeNotePanelWindow() {
    if (!note.notePanelWin || note.notePanelWin.isDestroyed()) {
      note.notePanelWin = null;
      return;
    }
    try { note.notePanelWin.destroy(); } catch (_) {}
    note.notePanelWin = null;
  }

  function hideNotePanelWindow() {
    if (!note.notePanelWin || note.notePanelWin.isDestroyed()) {
      note.notePanelWin = null;
      return;
    }
    try { note.notePanelWin.hide(); } catch (_) {}
  }

  function createNotePanelWindow(payload) {
    if (note.notePanelWin && !note.notePanelWin.isDestroyed()) {
      try { note.notePanelWin.webContents.send(IPC_CHANNELS.NOTE_PANEL_INIT, payload || {}); } catch (_) {}
      return note.notePanelWin;
    }

    const bounds = (payload && payload.bounds) ? payload.bounds : (note.notePanelLastBounds || null);
    let width = Math.max(240, Math.round((bounds && bounds.width) || 420));
    let height = Math.max(140, Math.round((bounds && bounds.height) || 280));
    let x = typeof (bounds && bounds.x) === 'number' ? Math.round(bounds.x) : undefined;
    let y = typeof (bounds && bounds.y) === 'number' ? Math.round(bounds.y) : undefined;

    // If no stored position, open near the preferred overlay display.
    if (typeof x !== 'number' || typeof y !== 'number') {
      try {
        const display = getPreferredOverlayDisplay();
        const area = display && display.workArea ? display.workArea : require('electron').screen.getPrimaryDisplay().workArea;
        x = Math.round(area.x + Math.max(0, (area.width - width) / 2));
        y = Math.round(area.y + Math.max(0, (area.height - height) / 2));
      } catch (_) {}
    }

    try {
      const layoutBounds = resolveLayoutBounds ? resolveLayoutBounds('note-panel', { x, y, width, height }) : null;
      if (layoutBounds) {
        x = layoutBounds.x;
        y = layoutBounds.y;
        width = layoutBounds.width || width;
        height = layoutBounds.height || height;
      }
    } catch (_) {}

    const clampedPos = (typeof x === 'number' && typeof y === 'number')
      ? clampWindowToWorkArea(x, y, width, height, 0)
      : null;

    note.notePanelWin = new BrowserWindow({
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

    note.notePanelWin.loadFile('note-panel.html');
    note.notePanelWin.webContents.on('did-finish-load', () => {
      try {
        const language = getCurrentLanguage();
        note.notePanelWin.webContents.send(IPC_CHANNELS.NOTE_PANEL_INIT, { ...(payload || {}), language });
      } catch (_) {}
    });

    try {
      note.notePanelWin.setAlwaysOnTop(true, 'screen-saver', 2);
    } catch (_) {
      note.notePanelWin.setAlwaysOnTop(true, 'screen-saver');
    }
    try { note.notePanelWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (_) {}

    note.notePanelWin.on('closed', () => {
      note.notePanelWin = null;
    });

    // Start click-through; the renderer enables interactivity on hover.
    try { note.notePanelWin.setIgnoreMouseEvents(true, { forward: true }); } catch (_) {}

    try {
      captureWindowLayout('note-panel', note.notePanelWin.getBounds());
    } catch (_) {}

    return note.notePanelWin;
  }

  return {
    bringNotePanelToFront,
    setNotePanelVisible,
    closeNotePanelWindow,
    hideNotePanelWindow,
    createNotePanelWindow
  };
}

module.exports = {
  createNotePanelManager
};
