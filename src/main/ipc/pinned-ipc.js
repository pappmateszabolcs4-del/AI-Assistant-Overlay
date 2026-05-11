const { IPC_CHANNELS } = require('../../shared/ipc-channels');

function registerPinnedIpc(deps) {
  const {
    ipcMain,
    BrowserWindow,
    registry,
    clampWindowToWorkArea,
    captureWindowLayout,
    createPinnedHistoryWindow,
    closeAllPinnedHistoryWindows,
    shouldUnpinAtScreenPoint
  } = deps;

  const { core, pinned } = registry;

  ipcMain.handle(IPC_CHANNELS.PINNED_HISTORY_OPEN, async (_event, payload) => {
    try {
      createPinnedHistoryWindow(payload);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Allow overlay renderer to move a pinned window while dragging out from history.
  ipcMain.handle(IPC_CHANNELS.PINNED_HISTORY_MOVE_BY_TS, async (_event, ts, x, y) => {
    const key = Number(ts);
    const w = pinned.pinnedHistoryWindows.get(key);
    if (!w || w.isDestroyed()) return { success: false, error: 'window-missing' };
    const nextX = typeof x === 'number' ? Math.round(x) : w.getBounds().x;
    const nextY = typeof y === 'number' ? Math.round(y) : w.getBounds().y;
    try { w.setPosition(nextX, nextY); } catch (_) {}
    try { captureWindowLayout(`pinned:${key}`, { x: nextX, y: nextY, width: w.getBounds().width, height: w.getBounds().height }); } catch (_) {}
    return { success: true };
  });

  ipcMain.on(IPC_CHANNELS.PINNED_HISTORY_MOVE_BY_TS, (_event, ts, x, y) => {
    const key = Number(ts);
    const w = pinned.pinnedHistoryWindows.get(key);
    if (!w || w.isDestroyed()) return;
    const nextX = typeof x === 'number' ? Math.round(x) : w.getBounds().x;
    const nextY = typeof y === 'number' ? Math.round(y) : w.getBounds().y;
    try { w.setPosition(nextX, nextY); } catch (_) {}
    try { captureWindowLayout(`pinned:${key}`, { x: nextX, y: nextY, width: w.getBounds().width, height: w.getBounds().height }); } catch (_) {}
  });

  ipcMain.handle(IPC_CHANNELS.PINNED_HISTORY_END_DRAG, async (_event, ts) => {
    const key = Number(ts);
    const w = pinned.pinnedHistoryWindows.get(key);
    if (!w || w.isDestroyed()) return { success: false, error: 'window-missing' };
    try {
      w.setIgnoreMouseEvents(false);
    } catch (_) {}
    try { w.moveTop(); } catch (_) {}
    try {
      w.webContents.send(IPC_CHANNELS.PINNED_HISTORY_UPDATE, { ts: key, dragging: false });
    } catch (_) {}
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.PINNED_HISTORY_CLOSE, async (_event, ts) => {
    const key = Number(ts);
    const w = pinned.pinnedHistoryWindows.get(key);
    if (w && !w.isDestroyed()) {
      try { w.destroy(); } catch (_) {}
    }
    pinned.pinnedHistoryWindows.delete(key);
    pinned.pinnedHistoryPerfStarts.delete(key);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.PINNED_HISTORY_CLOSE_ALL, async () => {
    closeAllPinnedHistoryWindows();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.PINNED_HISTORY_SET_POSITION, async (event, pos) => {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (!w || w.isDestroyed()) return { success: false, error: 'window-missing' };
    const b = w.getBounds();
    const targetX = pos && typeof pos.x === 'number' ? Math.round(pos.x) : b.x;
    const targetY = pos && typeof pos.y === 'number' ? Math.round(pos.y) : b.y;
    const clamped = clampWindowToWorkArea(targetX, targetY, b.width, b.height, 0);
    try { w.setPosition(clamped.x, clamped.y); } catch (_) {}
    try { captureWindowLayout(`pinned:${w.__pinnedHistoryTs}`, { x: clamped.x, y: clamped.y, width: b.width, height: b.height }); } catch (_) {}
    return { success: true };
  });

  // High-frequency move updates should be fire-and-forget to avoid IPC backlog/lag.
  ipcMain.on(IPC_CHANNELS.PINNED_HISTORY_MOVE, (event, pos) => {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (!w || w.isDestroyed()) return;
    const b = w.getBounds();
    const targetX = pos && typeof pos.x === 'number' ? Math.round(pos.x) : b.x;
    const targetY = pos && typeof pos.y === 'number' ? Math.round(pos.y) : b.y;
    const clamped = clampWindowToWorkArea(targetX, targetY, b.width, b.height, 0);
    try { w.setPosition(clamped.x, clamped.y); } catch (_) {}
    try { captureWindowLayout(`pinned:${w.__pinnedHistoryTs}`, { x: clamped.x, y: clamped.y, width: b.width, height: b.height }); } catch (_) {}
  });

  // High-frequency resize updates for pinned windows.
  ipcMain.on(IPC_CHANNELS.PINNED_HISTORY_SET_BOUNDS, (event, nextBounds) => {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (!w || w.isDestroyed()) return;
    const b = w.getBounds();

    const minWidth = 240;
    const minHeight = 140;

    const rawX = nextBounds && typeof nextBounds.x === 'number' ? Math.round(nextBounds.x) : b.x;
    const rawY = nextBounds && typeof nextBounds.y === 'number' ? Math.round(nextBounds.y) : b.y;
    const rawW = nextBounds && typeof nextBounds.width === 'number' ? Math.round(nextBounds.width) : b.width;
    const rawH = nextBounds && typeof nextBounds.height === 'number' ? Math.round(nextBounds.height) : b.height;

    const width = Math.max(minWidth, rawW);
    const height = Math.max(minHeight, rawH);
    const clampedPos = clampWindowToWorkArea(rawX, rawY, width, height, 0);

    try { w.setBounds({ x: clampedPos.x, y: clampedPos.y, width, height }); } catch (_) {}
    try { captureWindowLayout(`pinned:${w.__pinnedHistoryTs}`, { x: clampedPos.x, y: clampedPos.y, width, height }); } catch (_) {}
  });

  // Persist the current bounds back to the overlay (without unpin checks).
  ipcMain.on(IPC_CHANNELS.PINNED_HISTORY_COMMIT_BOUNDS, (event, payload) => {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (!w || w.isDestroyed()) return;
    const ts = Number(payload && payload.ts);
    if (!core.overlayWin || core.overlayWin.isDestroyed() || !Number.isFinite(ts)) return;
    const b = w.getBounds();
    const clamped = clampWindowToWorkArea(b.x, b.y, b.width, b.height, 0);
    try { w.setPosition(clamped.x, clamped.y); } catch (_) {}
    const finalBounds = w.getBounds();
    core.overlayWin.webContents.send(IPC_CHANNELS.PINNED_HISTORY_BOUNDS, {
      ts,
      bounds: { x: finalBounds.x, y: finalBounds.y, width: finalBounds.width, height: finalBounds.height }
    });
    try { captureWindowLayout(`pinned:${ts}`, finalBounds); } catch (_) {}
  });

  ipcMain.handle(IPC_CHANNELS.PINNED_HISTORY_DROP, async (event, payload) => {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (!w || w.isDestroyed()) return { success: false, error: 'window-missing' };
    const ts = Number(payload && payload.ts);
    const screenPoint = {
      x: Number(payload && payload.pointerScreenX),
      y: Number(payload && payload.pointerScreenY)
    };

    const shouldUnpin = Number.isFinite(screenPoint.x) && Number.isFinite(screenPoint.y)
      ? await shouldUnpinAtScreenPoint(screenPoint)
      : false;

    if (shouldUnpin && Number.isFinite(ts)) {
      try { w.destroy(); } catch (_) {}
      pinned.pinnedHistoryWindows.delete(ts);
      pinned.pinnedHistoryPerfStarts.delete(ts);
      if (core.overlayWin && !core.overlayWin.isDestroyed()) {
        core.overlayWin.webContents.send(IPC_CHANNELS.PINNED_HISTORY_UNPINNED, { ts });
      }
      return { success: true, unpinned: true };
    }

    // Persist bounds after drop
    if (core.overlayWin && !core.overlayWin.isDestroyed() && Number.isFinite(ts)) {
      const b = w.getBounds();
      const clamped = clampWindowToWorkArea(b.x, b.y, b.width, b.height, 0);
      try { w.setPosition(clamped.x, clamped.y); } catch (_) {}
      const finalBounds = w.getBounds();
      core.overlayWin.webContents.send(IPC_CHANNELS.PINNED_HISTORY_BOUNDS, {
        ts,
        bounds: { x: finalBounds.x, y: finalBounds.y, width: finalBounds.width, height: finalBounds.height }
      });
      try { captureWindowLayout(`pinned:${ts}`, finalBounds); } catch (_) {}
    }

    return { success: true, unpinned: false };
  });
}

module.exports = {
  registerPinnedIpc
};
