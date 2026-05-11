const { IPC_CHANNELS } = require('../../shared/ipc-channels');

function registerNoteIpc(deps) {
  const {
    ipcMain,
    BrowserWindow,
    registry,
    clampWindowToWorkArea,
    notePanel,
    captureWindowLayout
  } = deps;

  const { note } = registry;

  // Editable Note Panel (singleton separate overlay element)
  ipcMain.handle(IPC_CHANNELS.NOTE_PANEL_OPEN, async (_event, payload) => {
    try {
      notePanel.createNotePanelWindow(payload || {});
      notePanel.setNotePanelVisible(true);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NOTE_PANEL_CLOSE, async () => {
    notePanel.setNotePanelVisible(false);
    return { success: true };
  });

  ipcMain.on(IPC_CHANNELS.NOTE_PANEL_MOVE, (event, pos) => {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (!w || w.isDestroyed()) return;
    const b = w.getBounds();
    const targetX = pos && typeof pos.x === 'number' ? Math.round(pos.x) : b.x;
    const targetY = pos && typeof pos.y === 'number' ? Math.round(pos.y) : b.y;
    const clamped = clampWindowToWorkArea(targetX, targetY, b.width, b.height, 0);
    try { w.setPosition(clamped.x, clamped.y); } catch (_) {}
    note.notePanelLastBounds = { x: clamped.x, y: clamped.y, width: b.width, height: b.height };
    try { captureWindowLayout('note-panel', note.notePanelLastBounds); } catch (_) {}
  });

  ipcMain.on(IPC_CHANNELS.NOTE_PANEL_SET_BOUNDS, (event, nextBounds) => {
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
    note.notePanelLastBounds = { x: clampedPos.x, y: clampedPos.y, width, height };
    try { captureWindowLayout('note-panel', note.notePanelLastBounds); } catch (_) {}
  });

  ipcMain.on(IPC_CHANNELS.NOTE_PANEL_COMMIT_BOUNDS, (event) => {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (!w || w.isDestroyed()) return;

    const b = w.getBounds();
    const clamped = clampWindowToWorkArea(b.x, b.y, b.width, b.height, 0);
    try { w.setPosition(clamped.x, clamped.y); } catch (_) {}
    const finalBounds = w.getBounds();
    note.notePanelLastBounds = { x: finalBounds.x, y: finalBounds.y, width: finalBounds.width, height: finalBounds.height };
    try { captureWindowLayout('note-panel', note.notePanelLastBounds); } catch (_) {}
  });
}

module.exports = {
  registerNoteIpc
};
