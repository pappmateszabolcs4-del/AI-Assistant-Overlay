const { screen } = require('electron');
const { IPC_CHANNELS } = require('../../shared/ipc-channels');

const MIN_BLOCK_WIDTH = 260;
const MIN_BLOCK_HEIGHT = 160;

function createBlockWindowsManager(deps) {
  const { registry, BrowserWindow, clampWindowToWorkArea, getCurrentLanguage } = deps;
  const { blocks } = registry;

  function getBlockWindow(blockId) {
    return blocks.detachedBlockWindows.get(blockId);
  }

  function bringBlockWindowsToFront() {
    blocks.detachedBlockWindows.forEach((w) => {
      if (!w || w.isDestroyed()) return;
      try { w.setAlwaysOnTop(true, 'screen-saver', 2); } catch (_) {
        try { w.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
      }
      try { w.moveTop(); } catch (_) {}
    });
  }

  function setBlockWindowsVisible(visible) {
    blocks.detachedBlockWindows.forEach((w) => {
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

  function closeBlockWindow(blockId) {
    const w = blocks.detachedBlockWindows.get(blockId);
    if (!w || w.isDestroyed()) {
      blocks.detachedBlockWindows.delete(blockId);
      return;
    }
    try { w.destroy(); } catch (_) {}
    blocks.detachedBlockWindows.delete(blockId);
  }

  function closeAllBlockWindows() {
    blocks.detachedBlockWindows.forEach((w) => {
      if (!w || w.isDestroyed()) return;
      try { w.destroy(); } catch (_) {}
    });
    blocks.detachedBlockWindows.clear();
  }

  function createBlockWindow(payload) {
    const blockId = String(payload && payload.blockId || '').trim();
    if (!blockId) return null;

    const existing = getBlockWindow(blockId);
    if (existing && !existing.isDestroyed()) {
      try { existing.webContents.send(IPC_CHANNELS.BLOCK_WINDOW_OPEN, payload || {}); } catch (_) {}
      return existing;
    }

    const bounds = payload && payload.bounds ? payload.bounds : blocks.blockLastBounds.get(blockId) || null;
    const width = Math.max(MIN_BLOCK_WIDTH, Math.round((bounds && bounds.width) || 360));
    const height = Math.max(MIN_BLOCK_HEIGHT, Math.round((bounds && bounds.height) || 240));
    let x = typeof (bounds && bounds.x) === 'number' ? Math.round(bounds.x) : undefined;
    let y = typeof (bounds && bounds.y) === 'number' ? Math.round(bounds.y) : undefined;

    if (typeof x !== 'number' || typeof y !== 'number') {
      try {
        const area = screen.getPrimaryDisplay().workArea;
        x = Math.round(area.x + Math.max(0, (area.width - width) / 2));
        y = Math.round(area.y + Math.max(0, (area.height - height) / 2));
      } catch (_) {}
    }

    const clampedPos = (typeof x === 'number' && typeof y === 'number')
      ? clampWindowToWorkArea(x, y, width, height, 0)
      : null;

    const blockWin = new BrowserWindow({
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

    blockWin.__blockId = blockId;
    blocks.detachedBlockWindows.set(blockId, blockWin);

    blockWin.loadFile('overlay.html', { query: { role: 'block', block: blockId } });
    blockWin.webContents.on('did-finish-load', () => {
      try { blockWin.webContents.send(IPC_CHANNELS.SET_LANGUAGE, getCurrentLanguage()); } catch (_) {}
    });

    try {
      blockWin.setAlwaysOnTop(true, 'screen-saver', 2);
    } catch (_) {
      try { blockWin.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
    }
    try { blockWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (_) {}

    blockWin.on('closed', () => {
      blocks.detachedBlockWindows.delete(blockId);
    });

    try {
      if (typeof blockWin.showInactive === 'function') blockWin.showInactive();
      else blockWin.show();
      try { blockWin.moveTop(); } catch (_) {}
    } catch (_) {}

    return blockWin;
  }

  function updateBlockWindowBounds(blockId, bounds) {
    const w = getBlockWindow(blockId);
    if (!w || w.isDestroyed()) return;
    const b = w.getBounds();
    const rawX = bounds && typeof bounds.x === 'number' ? Math.round(bounds.x) : b.x;
    const rawY = bounds && typeof bounds.y === 'number' ? Math.round(bounds.y) : b.y;
    const rawW = bounds && typeof bounds.width === 'number' ? Math.round(bounds.width) : b.width;
    const rawH = bounds && typeof bounds.height === 'number' ? Math.round(bounds.height) : b.height;
    const width = Math.max(MIN_BLOCK_WIDTH, rawW);
    const height = Math.max(MIN_BLOCK_HEIGHT, rawH);
    const clamped = clampWindowToWorkArea(rawX, rawY, width, height, 0);
    try { w.setBounds({ x: clamped.x, y: clamped.y, width, height }); } catch (_) {}
    blocks.blockLastBounds.set(blockId, { x: clamped.x, y: clamped.y, width, height });
  }

  return {
    bringBlockWindowsToFront,
    setBlockWindowsVisible,
    closeBlockWindow,
    closeAllBlockWindows,
    createBlockWindow,
    updateBlockWindowBounds
  };
}

module.exports = {
  createBlockWindowsManager
};
