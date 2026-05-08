const { IPC_CHANNELS } = require('../../shared/ipc-channels');

function getNotePanelLabels(lang) {
  const L = String(lang || '').toLowerCase();
  const table = {
    hu: { title: '📝 Jegyzet', placeholder: 'Írj ide jegyzetet...' },
    en: { title: '📝 Note', placeholder: 'Write a note...' },
    de: { title: '📝 Notiz', placeholder: 'Schreibe eine Notiz...' },
    ru: { title: '📝 Заметка', placeholder: 'Напишите заметку...' },
    fr: { title: '📝 Note', placeholder: 'Écrivez une note...' },
    zh: { title: '📝 便笺', placeholder: '写点笔记...' }
  };
  return table[L] || table.en;
}

function createNotePanelManager(deps) {
  const {
    registry,
    BrowserWindow,
    clampWindowToWorkArea,
    getPreferredOverlayDisplay,
    getCurrentLanguage
  } = deps;

  function bringNotePanelToFront() {
    if (!registry.notePanelWin || registry.notePanelWin.isDestroyed()) return;
    try {
      // Keep the note panel above the overlay.
      registry.notePanelWin.setAlwaysOnTop(true, 'screen-saver', 2);
    } catch (_) {
      try { registry.notePanelWin.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
    }
    try { registry.notePanelWin.moveTop(); } catch (_) {}
  }

  function setNotePanelVisible(visible) {
    if (visible && (!registry.notePanelWin || registry.notePanelWin.isDestroyed())) {
      try { createNotePanelWindow({}); } catch (_) {}
    }
    if (!registry.notePanelWin || registry.notePanelWin.isDestroyed()) return;
    try {
      registry.notePanelVirtualVisible = !!visible;
      if (visible) {
        // Virtual-show: keep the window present, but toggle opacity.
        try {
          if (!registry.notePanelWin.isVisible()) {
            if (typeof registry.notePanelWin.showInactive === 'function') registry.notePanelWin.showInactive();
            else registry.notePanelWin.show();
          }
        } catch (_) {}
        try { registry.notePanelWin.setIgnoreMouseEvents(true, { forward: true }); } catch (_) {}
        if (typeof registry.notePanelWin.setOpacity === 'function') {
          try { registry.notePanelWin.setOpacity(1); } catch (_) {}
        }
        try { bringNotePanelToFront(); } catch (_) {}
      } else {
        // Virtual-hide: do not call hide() to avoid z-order settle/flicker on re-show.
        // IMPORTANT: do NOT forward mouse moves while hidden; otherwise the invisible
        // textarea can still affect the cursor (I-beam) even though the window is click-through.
        try { registry.notePanelWin.setIgnoreMouseEvents(true); } catch (_) {}
        if (typeof registry.notePanelWin.setOpacity === 'function') {
          try { registry.notePanelWin.setOpacity(0); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  function closeNotePanelWindow() {
    if (!registry.notePanelWin || registry.notePanelWin.isDestroyed()) {
      registry.notePanelWin = null;
      return;
    }
    try { registry.notePanelWin.destroy(); } catch (_) {}
    registry.notePanelWin = null;
  }

  function hideNotePanelWindow() {
    if (!registry.notePanelWin || registry.notePanelWin.isDestroyed()) {
      registry.notePanelWin = null;
      return;
    }
    try { registry.notePanelWin.hide(); } catch (_) {}
  }

  function createNotePanelWindow(payload) {
    if (registry.notePanelWin && !registry.notePanelWin.isDestroyed()) {
      try { registry.notePanelWin.webContents.send(IPC_CHANNELS.NOTE_PANEL_INIT, payload || {}); } catch (_) {}
      return registry.notePanelWin;
    }

    const bounds = (payload && payload.bounds) ? payload.bounds : (registry.notePanelLastBounds || null);
    const width = Math.max(240, Math.round((bounds && bounds.width) || 420));
    const height = Math.max(140, Math.round((bounds && bounds.height) || 280));
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

    const clampedPos = (typeof x === 'number' && typeof y === 'number')
      ? clampWindowToWorkArea(x, y, width, height, 0)
      : null;

    registry.notePanelWin = new BrowserWindow({
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

    registry.notePanelWin.loadFile('note-panel.html');
    registry.notePanelWin.webContents.on('did-finish-load', () => {
      try {
        const labels = getNotePanelLabels(getCurrentLanguage());
        registry.notePanelWin.webContents.send(IPC_CHANNELS.NOTE_PANEL_INIT, { ...(payload || {}), labels });
      } catch (_) {}
    });

    try {
      registry.notePanelWin.setAlwaysOnTop(true, 'screen-saver', 2);
    } catch (_) {
      registry.notePanelWin.setAlwaysOnTop(true, 'screen-saver');
    }
    try { registry.notePanelWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (_) {}

    registry.notePanelWin.on('closed', () => {
      registry.notePanelWin = null;
    });

    // Start click-through; the renderer enables interactivity on hover.
    try { registry.notePanelWin.setIgnoreMouseEvents(true, { forward: true }); } catch (_) {}

    return registry.notePanelWin;
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
