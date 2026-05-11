const { IPC_CHANNELS } = require('../../shared/ipc-channels');

function registerBlockIpc(deps) {
  const {
    ipcMain,
    registry,
    clampWindowToWorkArea,
    captureWindowLayout,
    createBlockWindow,
    closeBlockWindow,
    updateBlockWindowBounds,
    markBlockWindowReady,
    getBlockDropTargetPanelIdAtScreenPoint
  } = deps;

  const { blocks } = registry;

  ipcMain.handle(IPC_CHANNELS.BLOCK_WINDOW_OPEN, async (_event, payload) => {
    try {
      createBlockWindow(payload || {});
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BLOCK_WINDOW_CLOSE, async (_event, payload) => {
    try {
      const blockId = String(payload && payload.blockId || '').trim();
      if (!blockId) return { success: false, error: 'block-missing' };
      closeBlockWindow(blockId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.on(IPC_CHANNELS.BLOCK_WINDOW_MOVE, (_event, payload) => {
    const blockId = String(payload && payload.blockId || '').trim();
    const w = blocks.detachedBlockWindows.get(blockId);
    if (!w || w.isDestroyed()) return;
    const b = w.getBounds();
    const rawX = typeof (payload && payload.x) === 'number' ? Math.round(payload.x) : b.x;
    const rawY = typeof (payload && payload.y) === 'number' ? Math.round(payload.y) : b.y;
    const clamped = clampWindowToWorkArea(rawX, rawY, b.width, b.height, 0);
    try { w.setPosition(clamped.x, clamped.y); } catch (_) {}
    blocks.blockLastBounds.set(blockId, { x: clamped.x, y: clamped.y, width: b.width, height: b.height });
    try { captureWindowLayout(`block:${blockId}`, { x: clamped.x, y: clamped.y, width: b.width, height: b.height }); } catch (_) {}
  });

  ipcMain.on(IPC_CHANNELS.BLOCK_WINDOW_SET_BOUNDS, (_event, payload) => {
    const blockId = String(payload && payload.blockId || '').trim();
    if (!blockId) return;
    updateBlockWindowBounds(blockId, payload);
  });

  ipcMain.on(IPC_CHANNELS.BLOCK_WINDOW_READY, (event, payload) => {
    const blockId = String(payload && payload.blockId || '').trim();
    if (!blockId) return;
    markBlockWindowReady(blockId, event.sender);
  });

  ipcMain.handle(IPC_CHANNELS.BLOCK_WINDOW_DROP_TARGET, async (_event, payload) => {
    if (payload && payload.visible === false) {
      try {
        if (registry.core.overlayWin && !registry.core.overlayWin.isDestroyed()) {
          registry.core.overlayWin.webContents.send(IPC_CHANNELS.BLOCK_WINDOW_DROP_PREVIEW, { panelId: null });
        }
      } catch (_) {}
      return { success: true, panelId: null };
    }
    const x = Number(payload && payload.pointerScreenX);
    const y = Number(payload && payload.pointerScreenY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { success: false, panelId: null };
    const panelId = await getBlockDropTargetPanelIdAtScreenPoint({ x, y });
    try {
      if (registry.core.overlayWin && !registry.core.overlayWin.isDestroyed()) {
        registry.core.overlayWin.webContents.send(IPC_CHANNELS.BLOCK_WINDOW_DROP_PREVIEW, { panelId: panelId || null });
      }
    } catch (_) {}
    return { success: true, panelId: panelId || null };
  });
}

module.exports = {
  registerBlockIpc
};
