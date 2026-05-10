const { screen } = require('electron');
const { IPC_CHANNELS } = require('../../shared/ipc-channels');
const { appendOverlayPerf } = require('../utils/overlay-perf-log');

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
          if (w.__blockActive === false || w.__blockReady === false) {
            try { w.setIgnoreMouseEvents(true); } catch (_) {}
            if (typeof w.setOpacity === 'function') {
              try { w.setOpacity(0); } catch (_) {}
            }
            try { w.hide(); } catch (_) {}
            return;
          }
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
      blocks.blockPerfStarts.delete(blockId);
      return;
    }
    try { w.destroy(); } catch (_) {}
    blocks.detachedBlockWindows.delete(blockId);
    blocks.blockPerfStarts.delete(blockId);
  }

  function closeAllBlockWindows() {
    blocks.detachedBlockWindows.forEach((w) => {
      if (!w || w.isDestroyed()) return;
      try { w.destroy(); } catch (_) {}
    });
    blocks.detachedBlockWindows.clear();
    blocks.blockPerfStarts.clear();
  }

  function prewarmBlockWindows() {
    // Disabled: block windows are created on demand to avoid startup lag.
  }

  function createBlockWindow(payload) {
    const blockId = String(payload && payload.blockId || '').trim();
    if (!blockId) return null;

    const existing = getBlockWindow(blockId);
    if (existing && !existing.isDestroyed()) {
      if (true) {
        if (!blocks.blockPerfStarts.has(blockId)) {
          blocks.blockPerfStarts.set(blockId, Date.now());
        }
        try {
          appendOverlayPerf({
            t: new Date().toISOString(),
            event: 'block-open',
            blockId
          });
        } catch (_) {}
        try { existing.__blockActive = true; } catch (_) {}
        try {
          const b = existing.getBounds();
          const next = payload && payload.bounds ? payload.bounds : null;
          const rawX = next && typeof next.x === 'number' ? Math.round(next.x) : b.x;
          const rawY = next && typeof next.y === 'number' ? Math.round(next.y) : b.y;
          const rawW = next && typeof next.width === 'number' ? Math.round(next.width) : b.width;
          const rawH = next && typeof next.height === 'number' ? Math.round(next.height) : b.height;
          const width = Math.max(MIN_BLOCK_WIDTH, rawW);
          const height = Math.max(MIN_BLOCK_HEIGHT, rawH);
          const clamped = clampWindowToWorkArea(rawX, rawY, width, height, 0);
          existing.setBounds({ x: clamped.x, y: clamped.y, width, height });
        } catch (_) {}

        if (existing.__blockReady && !existing.__blockShown) {
          try {
            if (typeof existing.showInactive === 'function') existing.showInactive();
            else existing.show();
            try { existing.moveTop(); } catch (_) {}
            try { existing.setIgnoreMouseEvents(false); } catch (_) {}
            if (typeof existing.setOpacity === 'function') {
              try { existing.setOpacity(1); } catch (_) {}
            }
            existing.__blockShown = true;
            const startedAt = blocks.blockPerfStarts.get(blockId) || null;
            const dtMs = startedAt ? Math.max(0, Date.now() - startedAt) : null;
            appendOverlayPerf({
              t: new Date().toISOString(),
              event: 'block-shown',
              blockId,
              dtMs
            });
            if (startedAt) blocks.blockPerfStarts.delete(blockId);
          } catch (_) {}
        }
      }
      try { existing.webContents.send(IPC_CHANNELS.BLOCK_WINDOW_OPEN, payload || {}); } catch (_) {}
      return existing;
    }

    blocks.blockPerfStarts.set(blockId, Date.now());
    try {
      appendOverlayPerf({
        t: new Date().toISOString(),
        event: 'block-open',
        blockId
      });
    } catch (_) {}

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
    blockWin.__blockReady = false;
    blockWin.__blockActive = true;
    blockWin.__blockShown = false;
    blocks.detachedBlockWindows.set(blockId, blockWin);

    blockWin.loadFile('block.html', { query: { role: 'block', block: blockId } });
    blockWin.webContents.on('did-finish-load', () => {
      try { blockWin.webContents.send(IPC_CHANNELS.SET_LANGUAGE, getCurrentLanguage()); } catch (_) {}
      try {
        if (blockWin.__blockActive) {
          blockWin.webContents.send(IPC_CHANNELS.BLOCK_WINDOW_OPEN, { blockId });
        }
      } catch (_) {}
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

    try { blockWin.setIgnoreMouseEvents(true); } catch (_) {}
    if (typeof blockWin.setOpacity === 'function') {
      try { blockWin.setOpacity(0); } catch (_) {}
    }
    try { blockWin.hide(); } catch (_) {}

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

  function markBlockWindowReady(blockId, senderWebContents) {
    const w = getBlockWindow(blockId);
    if (!w || w.isDestroyed()) return;
    if (senderWebContents && w.webContents && senderWebContents.id !== w.webContents.id) return;
    if (w.__blockReady) return;
    w.__blockReady = true;

    try {
      const startedAt = blocks.blockPerfStarts.get(blockId) || null;
      const dtMs = startedAt ? Math.max(0, Date.now() - startedAt) : null;
      appendOverlayPerf({
        t: new Date().toISOString(),
        event: 'block-ready',
        blockId,
        dtMs
      });
    } catch (_) {}

    if (w.__blockActive && !w.__blockShown) {
      try {
        if (typeof w.showInactive === 'function') w.showInactive();
        else w.show();
        try { w.moveTop(); } catch (_) {}
        try { w.setIgnoreMouseEvents(false); } catch (_) {}
        if (typeof w.setOpacity === 'function') {
          try { w.setOpacity(1); } catch (_) {}
        }
        w.__blockShown = true;
        const startedAt = blocks.blockPerfStarts.get(blockId) || null;
        const dtMs = startedAt ? Math.max(0, Date.now() - startedAt) : null;
        appendOverlayPerf({
          t: new Date().toISOString(),
          event: 'block-shown',
          blockId,
          dtMs
        });
        if (startedAt) blocks.blockPerfStarts.delete(blockId);
      } catch (_) {}
    }
  }

  return {
    bringBlockWindowsToFront,
    setBlockWindowsVisible,
    closeBlockWindow,
    closeAllBlockWindows,
    createBlockWindow,
    updateBlockWindowBounds,
    prewarmBlockWindows,
    markBlockWindowReady
  };
}

module.exports = {
  createBlockWindowsManager
};
