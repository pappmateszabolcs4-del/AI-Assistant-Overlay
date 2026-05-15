const { IPC_CHANNELS } = require('../../shared/ipc-channels');
const { STORAGE_KEYS } = require('../../shared/storage-keys');
const { clampWindowToWorkArea } = require('../utils/bounds');
const { appendOverlayDebug } = require('../utils/overlay-debug-log');

const DEBUG_STUTTER_LOG = String(process.env.DEBUG_STUTTER_LOG || '').toLowerCase() === '1'
  || String(process.env.DEBUG_STUTTER_LOG || '').toLowerCase() === 'true';
const DISABLE_TOPMOST_PULSE = String(process.env.DISABLE_TOPMOST_PULSE || '').toLowerCase() === '1'
  || String(process.env.DISABLE_TOPMOST_PULSE || '').toLowerCase() === 'true';
const DISABLE_MOUSE_FORWARD_GATE = String(process.env.DISABLE_MOUSE_FORWARD_GATE || '').toLowerCase() === '1'
  || String(process.env.DISABLE_MOUSE_FORWARD_GATE || '').toLowerCase() === 'true';

function createOverlayManager(deps) {
  const {
    registry,
    BrowserWindow,
    screen,
    rectsOverlap,
    notePanel,
    captureWindowLayout,
    resolveLayoutBounds,
    loadLayoutsFromStorage,
    reflowAllWindows,
    bringDetachedPanelWindowsToFront,
    bringPinnedHistoryWindowsToFront,
    bringBlockWindowsToFront,
    prewarmBlockWindows,
    closeAllPinnedHistoryWindows,
    closeAllDetachedPanelWindows,
    closeAllBlockWindows,
    startDetachedSelfHealPulse,
    reconcileDetachedPanelWindowsVisibility,
    sendDetachedPanelsStateToOverlay,
    getCurrentLanguage
  } = deps;

  const { core, overlay, detached, pinned, blocks, note, info } = registry;

  const OVERLAY_TOPMOST_PULSE_MS = 900;
  const OVERLAY_LAYOUT_CAPTURE_DELAY_MS = 120;
  let lastTopmostPulseLogAt = 0;
  let lastMouseGateLogAt = 0;
  let overlayLayoutCaptureTimer = null;
  let overlayDragReady = false;
  function setOverlayDragReady(ready) {
    const next = !!ready;
    if (next === overlayDragReady) return;
    overlayDragReady = next;
    if (!core.overlayWin || core.overlayWin.isDestroyed()) return;
    try {
      core.overlayWin.webContents.send(IPC_CHANNELS.OVERLAY_DRAG_READY, { ready: next });
    } catch (_) {}
  }

  function scheduleOverlayLayoutCapture() {
    if (!core.overlayWin || core.overlayWin.isDestroyed()) return;
    if (overlayLayoutCaptureTimer) return;
    overlayLayoutCaptureTimer = setTimeout(() => {
      overlayLayoutCaptureTimer = null;
      try {
        captureWindowLayout('overlay', core.overlayWin.getBounds());
      } catch (_) {}
    }, OVERLAY_LAYOUT_CAPTURE_DELAY_MS);
  }

  function ensureOverlayWithinVisibleBounds(forceCenter = false) {
    if (!core.overlayWin || core.overlayWin.isDestroyed()) return;
    const bounds = core.overlayWin.getBounds();
    const displays = screen.getAllDisplays();
    const isVisible = displays.some((display) => rectsOverlap(display.workArea, bounds));

    if (!isVisible || forceCenter) {
      const target = screen.getPrimaryDisplay().workArea;
      const x = Math.round(target.x + Math.max(0, (target.width - bounds.width) / 2));
      const y = Math.round(target.y + Math.max(0, (target.height - bounds.height) / 2));
      try {
        appendOverlayDebug({
          t: new Date().toISOString(),
          event: 'overlay-recenter',
          reason: forceCenter ? 'force-center' : 'not-visible',
          from: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
          to: { x, y, width: bounds.width, height: bounds.height }
        });
      } catch (_) {}
      core.overlayWin.setBounds({ ...bounds, x, y });
    }
  }

  function shouldOpenOverlayDevTools() {
    const flag = String(process.env.DEBUG_OVERLAY || '').toLowerCase();
    return flag === '1' || flag === 'true' || flag === 'yes';
  }

  function pointInBounds(pt, bounds) {
    if (!pt || !bounds) return false;
    const x = Number(pt.x);
    const y = Number(pt.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const bx = Number(bounds.x);
    const by = Number(bounds.y);
    const bw = Number(bounds.width);
    const bh = Number(bounds.height);
    if (![bx, by, bw, bh].every(Number.isFinite)) return false;
    return x >= bx && x <= (bx + bw) && y >= by && y <= (by + bh);
  }

  function isPointInDragHandleZone(pt, bounds) {
    if (!pt || !bounds) return false;
    const zoneHeight = 32;
    const maxWidth = Math.max(120, Math.min(380, Math.max(0, bounds.width - 160)));
    const zoneWidth = Math.max(120, maxWidth);
    const zoneX = Math.round(bounds.x + Math.max(0, (bounds.width - zoneWidth) / 2));
    const zoneY = Math.round(bounds.y);
    return pt.x >= zoneX && pt.x <= (zoneX + zoneWidth) && pt.y >= zoneY && pt.y <= (zoneY + zoneHeight);
  }

  function isWindowActivelyVisible(w) {
    if (!w || w.isDestroyed()) return false;
    try {
      if (typeof w.isVisible === 'function' && !w.isVisible()) return false;
    } catch (_) {}
    try {
      if (typeof w.getOpacity === 'function' && w.getOpacity() === 0) return false;
    } catch (_) {}
    return true;
  }

  function hasAnyVisibleDetachedPanelWindow() {
    try {
      if (!detached.detachedPanelWindows || detached.detachedPanelWindows.size === 0) return false;
      for (const w of detached.detachedPanelWindows.values()) {
        if (isWindowActivelyVisible(w)) return true;
      }
    } catch (_) {}
    return false;
  }

  function reassertOverlayTopmost() {
    if (!core.overlayWin || core.overlayWin.isDestroyed()) return;

    const hasDetached = hasAnyVisibleDetachedPanelWindow();

    if (hasDetached) {
      if (overlay.overlayTopmostMode !== 'detached') {
        overlay.overlayTopmostMode = 'detached';
        try {
          core.overlayWin.setAlwaysOnTop(true, 'screen-saver', 1);
        } catch (_) {
          try { core.overlayWin.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
        }
        try {
          core.overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        } catch (_) {}
      }
    } else {
      if (overlay.overlayTopmostMode !== 'normal') {
        overlay.overlayTopmostMode = 'normal';
        try {
          core.overlayWin.setAlwaysOnTop(true, 'screen-saver', 1);
        } catch (_) {
          try { core.overlayWin.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
        }
        try {
          core.overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        } catch (_) {}
      }
      try { core.overlayWin.moveTop(); } catch (_) {}
    }

    try { notePanel.bringNotePanelToFront(); } catch (_) {}
    try { bringDetachedPanelWindowsToFront(); } catch (_) {}
    try { bringPinnedHistoryWindowsToFront(); } catch (_) {}
    try { bringBlockWindowsToFront(); } catch (_) {}
  }

  function isCursorInsideOverlayChildWindow() {
    let pt;
    try { pt = screen.getCursorScreenPoint(); } catch (_) { pt = null; }
    if (!pt) return false;

    try {
      if (note.notePanelVirtualVisible && isWindowActivelyVisible(note.notePanelWin)) {
        if (pointInBounds(pt, note.notePanelWin.getBounds())) return true;
      }
    } catch (_) {}
    try {
      if (info.infoPanelVirtualVisible && isWindowActivelyVisible(info.infoPanelWin)) {
        if (pointInBounds(pt, info.infoPanelWin.getBounds())) return true;
      }
    } catch (_) {}

    try {
      for (const w of detached.detachedPanelWindows.values()) {
        if (!isWindowActivelyVisible(w)) continue;
        try {
          if (pointInBounds(pt, w.getBounds())) return true;
        } catch (_) {}
      }
    } catch (_) {}

    try {
      for (const w of pinned.pinnedHistoryWindows.values()) {
        if (!isWindowActivelyVisible(w)) continue;
        try {
          if (pointInBounds(pt, w.getBounds())) return true;
        } catch (_) {}
      }
    } catch (_) {}

    try {
      for (const w of blocks.detachedBlockWindows.values()) {
        if (!isWindowActivelyVisible(w)) continue;
        try {
          if (pointInBounds(pt, w.getBounds())) return true;
        } catch (_) {}
      }
    } catch (_) {}

    return false;
  }

  function showOverlayAndRaise() {
    setOverlayVirtualVisible(true);
  }

  function sendOverlayCursorPointForHoverEval() {
    try {
      if (!core.overlayWin || core.overlayWin.isDestroyed() || !overlay.overlayVirtualVisible) return;
      const pt = screen.getCursorScreenPoint();
      const bounds = core.overlayWin.getBounds();
      core.overlayWin.webContents.send(IPC_CHANNELS.OVERLAY_CURSOR_SCREEN_POINT, {
        x: pt && typeof pt.x === 'number' ? pt.x : null,
        y: pt && typeof pt.y === 'number' ? pt.y : null,
        bounds: bounds && typeof bounds.x === 'number' ? bounds : null
      });
    } catch (_) {}
  }

  function stopOverlayMouseForwardGate() {
    if (!overlay.overlayMouseForwardGateTimer) return;
    try { clearInterval(overlay.overlayMouseForwardGateTimer); } catch (_) {}
    overlay.overlayMouseForwardGateTimer = null;
  }

  function startOverlayMouseForwardGate() {
    if (DISABLE_MOUSE_FORWARD_GATE) return;
    if (overlay.overlayMouseForwardGateTimer) return;
    overlay.overlayMouseForwardGateTimer = setInterval(() => {
      try {
        if (DEBUG_STUTTER_LOG) {
          const now = Date.now();
          if ((now - lastMouseGateLogAt) >= 1000) {
            lastMouseGateLogAt = now;
            appendOverlayDebug({
              t: new Date().toISOString(),
              event: 'pulse-mouse-forward-gate',
              intervalMs: 60
            });
          }
        }
        if (!core.overlayWin || core.overlayWin.isDestroyed() || !overlay.overlayVirtualVisible) {
          stopOverlayMouseForwardGate();
          return;
        }
        // Keep drag-ready state updated even when click-through is disabled.
        try {
          const pt = screen.getCursorScreenPoint();
          const b = core.overlayWin.getBounds();
          if (pt && b && isPointInDragHandleZone(pt, b)) {
            setOverlayDragReady(true);
            if (overlay.clickThrough && overlay.overlayMouseForwardEnabled) {
              overlay.overlayMouseForwardEnabled = false;
              core.overlayWin.setIgnoreMouseEvents(false);
            }
            return;
          }
        } catch (_) {}

        setOverlayDragReady(false);
        if (!overlay.clickThrough) {
          overlay.overlayMouseForwardEnabled = false;
          return;
        }

        const hasChildren = hasAnyVisibleDetachedPanelWindow() || (pinned.pinnedHistoryWindows && pinned.pinnedHistoryWindows.size) || (note.notePanelWin && !note.notePanelWin.isDestroyed()) || (info.infoPanelWin && !info.infoPanelWin.isDestroyed());
        if (!hasChildren) {
          if (!overlay.overlayMouseForwardEnabled) {
            overlay.overlayMouseForwardEnabled = true;
            try { core.overlayWin.setIgnoreMouseEvents(true, { forward: true }); } catch (_) {}
          }
          return;
        }

        const insideChild = isCursorInsideOverlayChildWindow();
        const desiredForward = !insideChild;
        if (desiredForward === overlay.overlayMouseForwardEnabled) return;
        overlay.overlayMouseForwardEnabled = desiredForward;
        try {
          if (desiredForward) {
            core.overlayWin.setIgnoreMouseEvents(true, { forward: true });
            sendOverlayCursorPointForHoverEval();
          }
          else core.overlayWin.setIgnoreMouseEvents(true);
        } catch (_) {}
      } catch (_) {}
    }, 60);
  }

  function startOverlayTopmostPulse() {
    if (DISABLE_TOPMOST_PULSE) return;
    if (overlay.overlayTopmostPulseTimer) return;
    overlay.overlayTopmostPulseTimer = setInterval(() => {
      try {
        if (DEBUG_STUTTER_LOG) {
          const now = Date.now();
          if ((now - lastTopmostPulseLogAt) >= 400) {
            lastTopmostPulseLogAt = now;
            appendOverlayDebug({
              t: new Date().toISOString(),
              event: 'pulse-topmost',
              intervalMs: OVERLAY_TOPMOST_PULSE_MS
            });
          }
        }
        if (!core.overlayWin || core.overlayWin.isDestroyed() || !overlay.overlayVirtualVisible) return;
        reassertOverlayTopmost();
      } catch (_) {}
    }, OVERLAY_TOPMOST_PULSE_MS);
  }

  function stopOverlayTopmostPulse() {
    if (!overlay.overlayTopmostPulseTimer) return;
    try { clearInterval(overlay.overlayTopmostPulseTimer); } catch (_) {}
    overlay.overlayTopmostPulseTimer = null;
  }

  function setOverlayVirtualVisible(visible) {
    if (!core.overlayWin || core.overlayWin.isDestroyed()) return;
    overlay.overlayVirtualVisible = !!visible;

    const canOpacity = typeof core.overlayWin.setOpacity === 'function';
    if (!overlay.overlayVirtualVisible) {
      stopOverlayTopmostPulse();
      stopOverlayMouseForwardGate();
      setOverlayDragReady(false);
      try { core.overlayWin.setIgnoreMouseEvents(true, { forward: true }); } catch (_) {}
      if (canOpacity) {
        try { core.overlayWin.setOpacity(0); } catch (_) {}
      }
      return;
    }

    try {
      if (typeof core.overlayWin.showInactive === 'function') core.overlayWin.showInactive();
      else core.overlayWin.show();
    } catch (_) {}

    if (canOpacity) {
      try { core.overlayWin.setOpacity(1); } catch (_) {}
    }

    overlay.overlayEverShown = true;
    try {
      core.overlayWin.setIgnoreMouseEvents(!!overlay.clickThrough, overlay.clickThrough ? { forward: true } : undefined);
    } catch (_) {}

    overlay.overlayMouseForwardEnabled = true;
    if (overlay.clickThrough) startOverlayMouseForwardGate();

    try {
      reassertOverlayTopmost();
      ensureOverlayWithinVisibleBounds();
      if (!hasAnyVisibleDetachedPanelWindow()) {
        core.overlayWin.moveTop();
      }
    } catch (_) {}
    startOverlayTopmostPulse();

    setTimeout(() => {
      try {
        if (!core.overlayWin || core.overlayWin.isDestroyed() || !overlay.overlayVirtualVisible) return;
        if (canOpacity) {
          try { core.overlayWin.setOpacity(1); } catch (_) {}
        }
        reassertOverlayTopmost();
        ensureOverlayWithinVisibleBounds();
        if (!hasAnyVisibleDetachedPanelWindow()) {
          core.overlayWin.moveTop();
        }
      } catch (_) {}
    }, 0);
  }

  function centerOverlayOnDisplay(display) {
    if (!core.overlayWin || core.overlayWin.isDestroyed()) return;
    if (!display || !display.workArea) return;
    const b = core.overlayWin.getBounds();
    const area = display.workArea;
    const x = Math.round(area.x + Math.max(0, (area.width - b.width) / 2));
    const y = Math.round(area.y + Math.max(0, (area.height - b.height) / 2));
    try { core.overlayWin.setPosition(x, y); } catch (_) {}
  }

  function createOverlayWindow() {
    if (core.overlayWin && !core.overlayWin.isDestroyed()) {
      if (!core.overlayWin.isVisible()) {
        try {
          reassertOverlayTopmost();
          ensureOverlayWithinVisibleBounds();
        } catch (_) {}
      }
      return;
    }

    core.overlayWin = new BrowserWindow({
      width: 1100,
      height: 500,
      x: -999,
      y: -999,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      modal: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      minWidth: 380,
      minHeight: 60,
      focusable: true,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    try {
      const entry = registry.layout && registry.layout.windowLayouts
        ? registry.layout.windowLayouts.get('overlay')
        : null;
      if (entry) {
        const nextBounds = resolveLayoutBounds('overlay', core.overlayWin.getBounds());
        if (nextBounds) core.overlayWin.setBounds(nextBounds);
      }
    } catch (_) {}

    core.overlayWin.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true);
      } else {
        callback(false);
      }
    });

    core.overlayWin.loadFile('overlay.html');
    if (shouldOpenOverlayDevTools()) {
      core.overlayWin.webContents.openDevTools({ mode: 'detach' });
    }

    core.overlayWin.webContents.on('did-start-loading', () => {
      if (!core.overlayWin || core.overlayWin.isDestroyed()) return;
      overlay.overlayIgnoreMoveUntil = Date.now() + 1500;
      if (!overlay.overlayVirtualVisible) {
        overlay.overlayHideDuringLoad = false;
        return;
      }
      overlay.overlayHideDuringLoad = true;
      try { setOverlayVirtualVisible(false); } catch (_) {}
    });

    core.overlayWin.webContents.on('did-finish-load', () => {
      if (!core.overlayWin || core.overlayWin.isDestroyed()) return;
      core.overlayWin.webContents.send(IPC_CHANNELS.SET_LANGUAGE, getCurrentLanguage());
      sendDetachedPanelsStateToOverlay();

      // Block prewarm disabled: only create block windows on demand.

      if (typeof loadLayoutsFromStorage === 'function') {
        try {
          Promise.resolve(loadLayoutsFromStorage()).then(() => {
            if (typeof reflowAllWindows === 'function') {
              try { reflowAllWindows(); } catch (_) {}
            }
          }).catch(() => {});
        } catch (_) {}
      }
      try { scheduleOverlayLayoutCapture(); } catch (_) {}

      try {
        const b = core.overlayWin.getBounds();
        let maxWidth = null;
        let minWidth = null;
        try {
          const display = screen.getDisplayMatching(b);
          if (display && display.workArea && typeof display.workArea.width === 'number') {
            maxWidth = display.workArea.width;
          }
        } catch (_) {}
        try {
          const minSize = core.overlayWin.getMinimumSize();
          if (Array.isArray(minSize) && typeof minSize[0] === 'number') {
            minWidth = minSize[0];
          }
        } catch (_) {}
        const payload = { x: b.x, y: b.y, width: b.width, height: b.height, maxWidth, minWidth };
        core.overlayWin.webContents.send(IPC_CHANNELS.OVERLAY_BOUNDS_UPDATED, payload);
        if (detached.detachedPanelWindows && detached.detachedPanelWindows.size) {
          for (const win of detached.detachedPanelWindows.values()) {
            if (!win || win.isDestroyed()) continue;
            try { win.webContents.send(IPC_CHANNELS.OVERLAY_BOUNDS_UPDATED, payload); } catch (_) {}
          }
        }
      } catch (_) {}

      if (overlay.overlayHideDuringLoad) {
        overlay.overlayHideDuringLoad = false;
        try { setOverlayVirtualVisible(true); } catch (_) {}
      }

      try {
        setTimeout(() => {
          reconcileDetachedPanelWindowsVisibility('overlay did-finish-load');
        }, 0);
      } catch (_) {}

      try { startDetachedSelfHealPulse(3000, 250); } catch (_) {}
    });

    try {
      core.overlayWin.on('move', () => {
        scheduleOverlayLayoutCapture();
      });
      core.overlayWin.on('resize', () => {
        scheduleOverlayLayoutCapture();
      });
    } catch (_) {}

    try {
      core.overlayWin.setAlwaysOnTop(true, 'screen-saver', 1);
    } catch (_) {
      try { core.overlayWin.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
    }
    reassertOverlayTopmost();

    core.overlayWin.on('resize', () => {
      if (!core.overlayWin || core.overlayWin.isDestroyed()) return;
      try {
        const b = core.overlayWin.getBounds();
        let maxWidth = null;
        let minWidth = null;
        try {
          const display = screen.getDisplayMatching(b);
          if (display && display.workArea && typeof display.workArea.width === 'number') {
            maxWidth = display.workArea.width;
          }
        } catch (_) {}
        try {
          const minSize = core.overlayWin.getMinimumSize();
          if (Array.isArray(minSize) && typeof minSize[0] === 'number') {
            minWidth = minSize[0];
          }
        } catch (_) {}
        const payload = { x: b.x, y: b.y, width: b.width, height: b.height, maxWidth, minWidth };
        if (detached.detachedPanelWindows && detached.detachedPanelWindows.size) {
          for (const win of detached.detachedPanelWindows.values()) {
            if (!win || win.isDestroyed()) continue;
            try { win.webContents.send(IPC_CHANNELS.OVERLAY_BOUNDS_UPDATED, payload); } catch (_) {}
          }
        }
      } catch (_) {}
    });

    core.overlayWin.on('closed', () => {
      core.overlayWin = null;
      stopOverlayTopmostPulse();
      closeAllPinnedHistoryWindows();
      closeAllDetachedPanelWindows();
      notePanel.closeNotePanelWindow();
    });

    core.overlayWin.webContents.on('render-process-gone', () => {
      if (core.overlayWin && !core.overlayWin.isDestroyed()) {
        core.overlayWin.destroy();
      }
      core.overlayWin = null;
    });
  }

  return {
    ensureOverlayWithinVisibleBounds,
    reassertOverlayTopmost,
    isCursorInsideOverlayChildWindow,
    showOverlayAndRaise,
    sendOverlayCursorPointForHoverEval,
    stopOverlayMouseForwardGate,
    startOverlayMouseForwardGate,
    startOverlayTopmostPulse,
    stopOverlayTopmostPulse,
    setOverlayVirtualVisible,
    hasAnyVisibleDetachedPanelWindow,
    centerOverlayOnDisplay,
    createOverlayWindow
  };
}

module.exports = {
  createOverlayManager
};
