const { IPC_CHANNELS } = require('../../shared/ipc-channels');
const { appendOverlayPerf } = require('../utils/overlay-perf-log');

function registerDetachedIpc(deps) {
  const {
    ipcMain,
    BrowserWindow,
    screen,
    registry,
    clampWindowToWorkArea,
    captureWindowLayout,
    normalizePanelId,
    createDetachedPanelWindow,
    sendDetachedPanelsStateToOverlay,
    deactivateDetachedPanelWindow,
    closeAllDetachedPanelWindows,
    startDetachedSelfHealPulse,
    getDockTargetPanelIdAtScreenPoint
  } = deps;

  const { core, overlay, detached } = registry;

  ipcMain.handle(IPC_CHANNELS.DETACHED_PANEL_OPEN, async (_event, payload) => {
    try {
      const pid = normalizePanelId(payload && payload.panelId);
      if (pid && !(payload && payload.prewarm)) {
        detached.detachedPanelPerfStarts.set(pid, Date.now());
        try {
          appendOverlayPerf({
            t: new Date().toISOString(),
            event: 'detached-open',
            panelId: pid
          });
        } catch (_) {}
      }
      createDetachedPanelWindow(payload || {});
      sendDetachedPanelsStateToOverlay();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Renderer-driven readiness: detached panel windows signal when their UI is ready to paint,
  // so we can avoid showing a blank/half-baked transparent window and also log perceived delay.
  ipcMain.on(IPC_CHANNELS.DETACHED_PANEL_READY, (event, payload) => {
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (!senderWin || senderWin.isDestroyed()) return;

    const pid = normalizePanelId(payload && payload.panelId) || normalizePanelId(senderWin.__detachedPanelId);
    if (!pid) return;

    const w = detached.detachedPanelWindows.get(pid);
    if (!w || w.isDestroyed() || w.id !== senderWin.id) return;

    // Mark readiness first; visibility is controlled by detached.detachedWindowsDesiredVisible.
    w.__detachedReady = true;

    // Prewarmed/inactive windows should never surface until a real detach activates them.
    if (!w.__detachedActive) {
      try { w.setIgnoreMouseEvents(true); } catch (_) {}
      if (typeof w.setOpacity === 'function') {
        try { w.setOpacity(0); } catch (_) {}
      }
      try { w.hide(); } catch (_) {}
      return;
    }

    // Heal any transient hidden/opacity state right after readiness.
    try { startDetachedSelfHealPulse(1200, 200); } catch (_) {}

    if (!detached.detachedWindowsDesiredVisible) {
      // Overlay group is currently hidden; keep the detached window hidden until the user re-opens.
      try { w.setIgnoreMouseEvents(true); } catch (_) {}
      if (typeof w.setOpacity === 'function') {
        try { w.setOpacity(0); } catch (_) {}
      }
      try { w.hide(); } catch (_) {}
      return;
    }

    const canOpacity = typeof w.setOpacity === 'function';
    const createdAt = w.__detachedCreatedAt || null;

    try {
      if (typeof w.isVisible !== 'function' || !w.isVisible()) {
        if (typeof w.showInactive === 'function') w.showInactive();
        else w.show();
      }
      if (canOpacity) {
        try { w.setOpacity(1); } catch (_) {}
      }
      try { w.moveTop(); } catch (_) {}
    } catch (_) {}

    // Inform the main overlay that it can now hide the docked slot for this panel.
    try {
      if (core.overlayWin && !core.overlayWin.isDestroyed()) {
        core.overlayWin.webContents.send(IPC_CHANNELS.DETACHED_PANEL_SHOWN, { panelId: pid });
      }
    } catch (_) {}

    if (createdAt) {
      const dt = Date.now() - createdAt;
      try {
        console.log(`[PERF] Detached panel "${pid}" ready in ${dt} ms`);
      } catch (_) {}
      w.__detachedCreatedAt = null;
    }

    try {
      const startedAt = detached.detachedPanelPerfStarts.get(pid) || null;
      const dtMs = startedAt ? Math.max(0, Date.now() - startedAt) : null;
      appendOverlayPerf({
        t: new Date().toISOString(),
        event: 'detached-ready',
        panelId: pid,
        dtMs
      });
    } catch (_) {}
  });

  // While dragging a detached panel back to dock, temporarily show docking targets in the main overlay.
  // Safety: auto-turn-off so the overlay can't get stuck in preview mode.
  let overlayDockPreviewTimer = null;
  let overlayDockPreviewLastOnAt = 0;
  let overlayDockPreviewVisible = false;

  function setOverlayDockPreview(visible) {
    const next = !!visible;
    overlayDockPreviewVisible = next;
    if (!core.overlayWin || core.overlayWin.isDestroyed()) return;
    try {
      core.overlayWin.webContents.send(IPC_CHANNELS.OVERLAY_DOCK_PREVIEW, { visible: next });
    } catch (_) {}

    if (next) {
      overlayDockPreviewLastOnAt = Date.now();
      if (overlayDockPreviewTimer) clearTimeout(overlayDockPreviewTimer);
      overlayDockPreviewTimer = setTimeout(() => {
        const age = Date.now() - overlayDockPreviewLastOnAt;
        if (age >= 450) setOverlayDockPreview(false);
      }, 500);
    } else {
      if (overlayDockPreviewTimer) clearTimeout(overlayDockPreviewTimer);
      overlayDockPreviewTimer = null;
    }
  }

  ipcMain.on(IPC_CHANNELS.OVERLAY_DOCK_PREVIEW, (_event, visible) => {
    setOverlayDockPreview(visible);
  });

  // Called from a detached panel window while dragging; turns dock-preview on only when the
  // pointer is actually near/over the overlay header area (so the header doesn't expand prematurely).
  ipcMain.handle(IPC_CHANNELS.DETACHED_PANEL_DOCK_PREVIEW_AT, async (_event, payload) => {
    if (payload && payload.visible === false) {
      setOverlayDockPreview(false);
      return { success: true, visible: false };
    }

    if (!core.overlayWin || core.overlayWin.isDestroyed()) {
      setOverlayDockPreview(false);
      return { success: true, visible: false };
    }

    const x = Number(payload && payload.pointerScreenX);
    const y = Number(payload && payload.pointerScreenY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      setOverlayDockPreview(false);
      return { success: true, visible: false };
    }

    const b = core.overlayWin.getBounds();
    // Allow a small margin so it's easy to trigger while approaching.
    const M = 28;
    // Limit to the top portion of the overlay (header area). In header-only mode this is basically
    // the whole window; when expanded, this still acts as a sensible "dock zone".
    // Keep the dock-preview trigger zone tight; otherwise users can dock from far below
    // the header/panel slot area.
    const headerZoneH = Math.max(28, Math.min(70, Math.round(b.height * 0.25)));

    const withinX = x >= (b.x - M) && x <= (b.x + b.width + M);
    const withinY = y >= (b.y - M) && y <= (b.y + headerZoneH + M);
    const shouldShow = withinX && withinY;

    setOverlayDockPreview(shouldShow);
    return { success: true, visible: shouldShow };
  });

  // Allow main overlay renderer to move a detached panel while dragging out.
  ipcMain.on(IPC_CHANNELS.DETACHED_PANEL_MOVE, (_event, panelId, x, y) => {
    const pid = normalizePanelId(panelId);
    if (!pid) return;
    const w = detached.detachedPanelWindows.get(pid);
    if (!w || w.isDestroyed()) return;
    const b = w.getBounds();
    const desired = detached.detachedPanelDesiredBounds.get(pid) || { width: b.width, height: b.height };
    const nextX = typeof x === 'number' ? Math.round(x) : b.x;
    const nextY = typeof y === 'number' ? Math.round(y) : b.y;
    try {
      const width = Math.max(200, Math.round(desired.width || b.width));
      const height = Math.max(120, Math.round(desired.height || b.height));
      const clamped = clampWindowToWorkArea(nextX, nextY, width, height, 0);
      w.setBounds({ x: clamped.x, y: clamped.y, width, height });
      try { captureWindowLayout(`detached:${pid}`, { x: clamped.x, y: clamped.y, width, height }); } catch (_) {}
    } catch (_) {
      try { w.setBounds({ x: nextX, y: nextY, width: b.width, height: b.height }); } catch (_) {}
    }
  });

  ipcMain.handle(IPC_CHANNELS.DETACHED_PANEL_END_DRAG, async (_event, panelId) => {
    const pid = normalizePanelId(panelId);
    if (!pid) return { success: false, error: 'bad-panel' };
    const w = detached.detachedPanelWindows.get(pid);
    if (!w || w.isDestroyed()) return { success: false, error: 'window-missing' };
    try {
      // Make detached panels interactive after drag-out ends.
      w.setIgnoreMouseEvents(false);
    } catch (_) {}
    try { w.moveTop(); } catch (_) {}
    try {
      w.webContents.send(IPC_CHANNELS.DETACHED_PANEL_INIT, { panelId: pid, dragging: false });
    } catch (_) {}

    // Persist bounds after drag ends
    const b = w.getBounds();
    const clamped = clampWindowToWorkArea(b.x, b.y, b.width, b.height, 0);
    try { w.setPosition(clamped.x, clamped.y); } catch (_) {}
    const finalBounds = w.getBounds();
    detached.detachedPanelLastBounds.set(pid, { x: finalBounds.x, y: finalBounds.y, width: finalBounds.width, height: finalBounds.height });
    try { captureWindowLayout(`detached:${pid}`, detached.detachedPanelLastBounds.get(pid)); } catch (_) {}

    return { success: true };
  });

  ipcMain.on(IPC_CHANNELS.DETACHED_PANEL_SET_BOUNDS, (event, nextBounds) => {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (!w || w.isDestroyed()) return;
    const pid = w.__detachedPanelId;
    if (!normalizePanelId(pid)) return;
    const b = w.getBounds();

    const desired = detached.detachedPanelDesiredBounds.get(pid) || { width: b.width, height: b.height };
    const hasWidth = nextBounds && typeof nextBounds.width === 'number';
    const hasHeight = nextBounds && typeof nextBounds.height === 'number';
    const rawX = nextBounds && typeof nextBounds.x === 'number' ? Math.round(nextBounds.x) : b.x;
    const rawY = nextBounds && typeof nextBounds.y === 'number' ? Math.round(nextBounds.y) : b.y;
    const rawW = hasWidth ? Math.round(nextBounds.width) : desired.width;
    const rawH = hasHeight ? Math.round(nextBounds.height) : desired.height;

    const MIN_W = 200;
    const MIN_H = 120;
    let width = Math.max(MIN_W, rawW);
    let height = Math.max(MIN_H, rawH);
    let x = rawX;
    let y = rawY;

    // Clamp behavior for resize: keep the top-left anchored as much as possible.
    // Instead of pushing the window upward when height grows near the bottom edge,
    // cap the height so the bottom can't go beyond the work area.
    try {
      const centerPoint = { x: x + Math.round(width / 2), y: y + Math.round(height / 2) };
      const display = screen.getDisplayNearestPoint(centerPoint);
      const area = (display && display.workArea) ? display.workArea : screen.getPrimaryDisplay().workArea;

      // Ensure the top-left is within the work area enough to show a minimum-sized window.
      x = Math.min(Math.max(x, area.x), area.x + Math.max(0, area.width - MIN_W));
      y = Math.min(Math.max(y, area.y), area.y + Math.max(0, area.height - MIN_H));

      // Cap width/height based on remaining work area from anchored x/y.
      const maxW = Math.max(MIN_W, (area.x + area.width) - x);
      const maxH = Math.max(MIN_H, (area.y + area.height) - y);
      width = Math.min(width, maxW);
      height = Math.min(height, maxH);

      // Final safety clamp to keep the whole window visible.
      x = Math.min(Math.max(x, area.x), area.x + Math.max(0, area.width - width));
      y = Math.min(Math.max(y, area.y), area.y + Math.max(0, area.height - height));
    } catch (_) {
      // Fallback: old behavior (position clamp).
      const clampedPos = clampWindowToWorkArea(x, y, width, height, 0);
      x = clampedPos.x;
      y = clampedPos.y;
    }

    try { w.setBounds({ x, y, width, height }); } catch (_) {}
    detached.detachedPanelLastBounds.set(pid, { x, y, width, height });
    if (hasWidth || hasHeight) {
      detached.detachedPanelDesiredBounds.set(pid, { width, height });
    }
    try { captureWindowLayout(`detached:${pid}`, { x, y, width, height }); } catch (_) {}
  });

  ipcMain.handle(IPC_CHANNELS.DETACHED_PANEL_DROP, async (event, payload) => {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (!w || w.isDestroyed()) return { success: false, error: 'window-missing' };
    const pid = normalizePanelId(payload && payload.panelId) || w.__detachedPanelId;
    if (!pid) return { success: false, error: 'bad-panel' };
    const screenPoint = {
      x: Number(payload && payload.pointerScreenX),
      y: Number(payload && payload.pointerScreenY)
    };

    // Fallback point derived from window bounds, used only if the pointer
    // coordinates look inconsistent (can happen on Windows frameless windows
    // under pointer capture).
    const winX = Number(payload && payload.winX);
    const winY = Number(payload && payload.winY);
    const winW = Number(payload && payload.width);
    const winH = Number(payload && payload.height);
    const hasWin = Number.isFinite(winX) && Number.isFinite(winY) && Number.isFinite(winW) && Number.isFinite(winH);
    const windowDerivedPoint = hasWin
      ? { x: winX + Math.round(winW / 2), y: winY + Math.round(Math.min(24, Math.max(12, winH * 0.08))) }
      : null;

    let dockTargetPid = Number.isFinite(screenPoint.x) && Number.isFinite(screenPoint.y)
      ? await getDockTargetPanelIdAtScreenPoint(screenPoint)
      : null;

    // On Windows frameless windows under pointer capture, pointer screen coords can be unreliable.
    // If the pointer-based check doesn't find a dock target, fall back to a window-derived point
    // (near the top-center of the window), which better matches user intent for drag-to-dock.
    if (!dockTargetPid && windowDerivedPoint) {
      dockTargetPid = await getDockTargetPanelIdAtScreenPoint(windowDerivedPoint);
    }

    // Final fallback: if the drop happens in the overlay header zone (as described in UX),
    // dock back into the same panel even if slot rects didn't match.
    // This is more robust against click-through/forward + pointer-capture coordinate quirks.
    if (!dockTargetPid && core.overlayWin && !core.overlayWin.isDestroyed() && overlay.overlayVirtualVisible) {
      const candidate = (Number.isFinite(screenPoint.x) && Number.isFinite(screenPoint.y))
        ? screenPoint
        : windowDerivedPoint;
      if (candidate && Number.isFinite(candidate.x) && Number.isFinite(candidate.y)) {
        try {
          const b = core.overlayWin.getBounds();
          const M = 28;
          // Keep the fallback docking header zone tight so docking can't trigger from
          // the large empty area between header and content.
          const headerZoneH = Math.max(28, Math.min(70, Math.round(b.height * 0.25)));
          const withinX = candidate.x >= (b.x - M) && candidate.x <= (b.x + b.width + M);
          const withinY = candidate.y >= (b.y - M) && candidate.y <= (b.y + headerZoneH + M);
          if (withinX && withinY) {
            dockTargetPid = pid;
          }
        } catch (_) {}
      }
    }

    if (dockTargetPid) {
      deactivateDetachedPanelWindow(pid);
      if (core.overlayWin && !core.overlayWin.isDestroyed()) {
        if (dockTargetPid !== pid) {
          core.overlayWin.webContents.send(IPC_CHANNELS.OVERLAY_PANEL_SWAP, { fromPanelId: pid, toPanelId: dockTargetPid });
        }
        core.overlayWin.webContents.send(IPC_CHANNELS.DETACHED_PANEL_DOCKED, { panelId: pid, open: true });
      }
      sendDetachedPanelsStateToOverlay();
      return { success: true, docked: true };
    }

    // Persist bounds after drop
    const b = w.getBounds();
    const clamped = clampWindowToWorkArea(b.x, b.y, b.width, b.height, 0);
    try { w.setPosition(clamped.x, clamped.y); } catch (_) {}
    const finalBounds = w.getBounds();
    detached.detachedPanelLastBounds.set(pid, { x: finalBounds.x, y: finalBounds.y, width: finalBounds.width, height: finalBounds.height });
    try { captureWindowLayout(`detached:${pid}`, detached.detachedPanelLastBounds.get(pid)); } catch (_) {}

    return { success: true, docked: false };
  });

  ipcMain.handle(IPC_CHANNELS.DETACHED_PANEL_DOCK, async (_event, panelId) => {
    const pid = normalizePanelId(panelId);
    if (!pid) return { success: false, error: 'bad-panel' };
    deactivateDetachedPanelWindow(pid);
    if (core.overlayWin && !core.overlayWin.isDestroyed()) {
      core.overlayWin.webContents.send(IPC_CHANNELS.DETACHED_PANEL_DOCKED, { panelId: pid, open: true });
    }
    sendDetachedPanelsStateToOverlay();
    return { success: true };
  });

  // Close all detached main overlay panels (Ask/History/Settings) for a full layout reset.
  // IMPORTANT: do NOT broadcast a detached-panels-state update here; the overlay is about
  // to reload, and sending an empty detached list would briefly "revive" header slots
  // just before navigation, causing a visible flash. The new overlay instance will start
  // with all panels docked and no detached windows alive.
  ipcMain.handle(IPC_CHANNELS.DETACHED_PANEL_CLOSE_ALL, async () => {
    closeAllDetachedPanelWindows();
    return { success: true };
  });
}

module.exports = {
  registerDetachedIpc
};
