const { IPC_CHANNELS } = require('../../shared/ipc-channels');

function createOverlayManager(deps) {
  const {
    registry,
    BrowserWindow,
    screen,
    rectsOverlap,
    notePanel,
    bringDetachedPanelWindowsToFront,
    bringPinnedHistoryWindowsToFront,
    closeAllPinnedHistoryWindows,
    closeAllDetachedPanelWindows,
    startDetachedSelfHealPulse,
    reconcileDetachedPanelWindowsVisibility,
    sendDetachedPanelsStateToOverlay,
    getCurrentLanguage
  } = deps;

  const OVERLAY_TOPMOST_PULSE_MS = 900;

  function ensureOverlayWithinVisibleBounds(forceCenter = false) {
    if (!registry.overlayWin || registry.overlayWin.isDestroyed()) return;
    const bounds = registry.overlayWin.getBounds();
    const displays = screen.getAllDisplays();
    const isVisible = displays.some((display) => rectsOverlap(display.workArea, bounds));

    if (!isVisible || forceCenter) {
      const target = screen.getPrimaryDisplay().workArea;
      const x = Math.round(target.x + Math.max(0, (target.width - bounds.width) / 2));
      const y = Math.round(target.y + Math.max(0, (target.height - bounds.height) / 2));
      registry.overlayWin.setBounds({ ...bounds, x, y });
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
      if (!registry.detachedPanelWindows || registry.detachedPanelWindows.size === 0) return false;
      for (const w of registry.detachedPanelWindows.values()) {
        if (isWindowActivelyVisible(w)) return true;
      }
    } catch (_) {}
    return false;
  }

  function reassertOverlayTopmost() {
    if (!registry.overlayWin || registry.overlayWin.isDestroyed()) return;

    const hasDetached = hasAnyVisibleDetachedPanelWindow();

    if (hasDetached) {
      if (registry.overlayTopmostMode !== 'detached') {
        registry.overlayTopmostMode = 'detached';
        try {
          registry.overlayWin.setAlwaysOnTop(true, 'screen-saver', 1);
        } catch (_) {
          try { registry.overlayWin.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
        }
        try {
          registry.overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        } catch (_) {}
      }
    } else {
      if (registry.overlayTopmostMode !== 'normal') {
        registry.overlayTopmostMode = 'normal';
        try {
          registry.overlayWin.setAlwaysOnTop(true, 'screen-saver', 1);
        } catch (_) {
          try { registry.overlayWin.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
        }
        try {
          registry.overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        } catch (_) {}
      }
      try { registry.overlayWin.moveTop(); } catch (_) {}
    }

    try { notePanel.bringNotePanelToFront(); } catch (_) {}
    try { bringDetachedPanelWindowsToFront(); } catch (_) {}
    try { bringPinnedHistoryWindowsToFront(); } catch (_) {}
  }

  function isCursorInsideOverlayChildWindow() {
    let pt;
    try { pt = screen.getCursorScreenPoint(); } catch (_) { pt = null; }
    if (!pt) return false;

    try {
      if (registry.notePanelVirtualVisible && isWindowActivelyVisible(registry.notePanelWin)) {
        if (pointInBounds(pt, registry.notePanelWin.getBounds())) return true;
      }
    } catch (_) {}
    try {
      if (registry.infoPanelVirtualVisible && isWindowActivelyVisible(registry.infoPanelWin)) {
        if (pointInBounds(pt, registry.infoPanelWin.getBounds())) return true;
      }
    } catch (_) {}

    try {
      for (const w of registry.detachedPanelWindows.values()) {
        if (!isWindowActivelyVisible(w)) continue;
        try {
          if (pointInBounds(pt, w.getBounds())) return true;
        } catch (_) {}
      }
    } catch (_) {}

    try {
      for (const w of registry.pinnedHistoryWindows.values()) {
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
      if (!registry.overlayWin || registry.overlayWin.isDestroyed() || !registry.overlayVirtualVisible) return;
      const pt = screen.getCursorScreenPoint();
      const bounds = registry.overlayWin.getBounds();
      registry.overlayWin.webContents.send(IPC_CHANNELS.OVERLAY_CURSOR_SCREEN_POINT, {
        x: pt && typeof pt.x === 'number' ? pt.x : null,
        y: pt && typeof pt.y === 'number' ? pt.y : null,
        bounds: bounds && typeof bounds.x === 'number' ? bounds : null
      });
    } catch (_) {}
  }

  function stopOverlayMouseForwardGate() {
    if (!registry.overlayMouseForwardGateTimer) return;
    try { clearInterval(registry.overlayMouseForwardGateTimer); } catch (_) {}
    registry.overlayMouseForwardGateTimer = null;
  }

  function startOverlayMouseForwardGate() {
    if (registry.overlayMouseForwardGateTimer) return;
    registry.overlayMouseForwardGateTimer = setInterval(() => {
      try {
        if (!registry.overlayWin || registry.overlayWin.isDestroyed() || !registry.overlayVirtualVisible) {
          stopOverlayMouseForwardGate();
          return;
        }
        if (!registry.clickThrough) {
          stopOverlayMouseForwardGate();
          return;
        }

        const hasChildren = hasAnyVisibleDetachedPanelWindow() || (registry.pinnedHistoryWindows && registry.pinnedHistoryWindows.size) || (registry.notePanelWin && !registry.notePanelWin.isDestroyed()) || (registry.infoPanelWin && !registry.infoPanelWin.isDestroyed());
        if (!hasChildren) {
          if (!registry.overlayMouseForwardEnabled) {
            registry.overlayMouseForwardEnabled = true;
            try { registry.overlayWin.setIgnoreMouseEvents(true, { forward: true }); } catch (_) {}
          }
          return;
        }

        const insideChild = isCursorInsideOverlayChildWindow();
        const desiredForward = !insideChild;
        if (desiredForward === registry.overlayMouseForwardEnabled) return;
        registry.overlayMouseForwardEnabled = desiredForward;
        try {
          if (desiredForward) {
            registry.overlayWin.setIgnoreMouseEvents(true, { forward: true });
            sendOverlayCursorPointForHoverEval();
          }
          else registry.overlayWin.setIgnoreMouseEvents(true);
        } catch (_) {}
      } catch (_) {}
    }, 60);
  }

  function startOverlayTopmostPulse() {
    if (registry.overlayTopmostPulseTimer) return;
    registry.overlayTopmostPulseTimer = setInterval(() => {
      try {
        if (!registry.overlayWin || registry.overlayWin.isDestroyed() || !registry.overlayVirtualVisible) return;
        reassertOverlayTopmost();
      } catch (_) {}
    }, OVERLAY_TOPMOST_PULSE_MS);
  }

  function stopOverlayTopmostPulse() {
    if (!registry.overlayTopmostPulseTimer) return;
    try { clearInterval(registry.overlayTopmostPulseTimer); } catch (_) {}
    registry.overlayTopmostPulseTimer = null;
  }

  function setOverlayVirtualVisible(visible) {
    if (!registry.overlayWin || registry.overlayWin.isDestroyed()) return;
    registry.overlayVirtualVisible = !!visible;

    const canOpacity = typeof registry.overlayWin.setOpacity === 'function';
    if (!registry.overlayVirtualVisible) {
      stopOverlayTopmostPulse();
      stopOverlayMouseForwardGate();
      try { registry.overlayWin.setIgnoreMouseEvents(true, { forward: true }); } catch (_) {}
      if (canOpacity) {
        try { registry.overlayWin.setOpacity(0); } catch (_) {}
      }
      return;
    }

    try {
      if (typeof registry.overlayWin.showInactive === 'function') registry.overlayWin.showInactive();
      else registry.overlayWin.show();
    } catch (_) {}

    if (canOpacity) {
      try { registry.overlayWin.setOpacity(1); } catch (_) {}
    }

    registry.overlayEverShown = true;
    try {
      registry.overlayWin.setIgnoreMouseEvents(!!registry.clickThrough, registry.clickThrough ? { forward: true } : undefined);
    } catch (_) {}

    registry.overlayMouseForwardEnabled = true;
    if (registry.clickThrough) startOverlayMouseForwardGate();

    try {
      reassertOverlayTopmost();
      ensureOverlayWithinVisibleBounds();
      if (!hasAnyVisibleDetachedPanelWindow()) {
        registry.overlayWin.moveTop();
      }
    } catch (_) {}
    startOverlayTopmostPulse();

    setTimeout(() => {
      try {
        if (!registry.overlayWin || registry.overlayWin.isDestroyed() || !registry.overlayVirtualVisible) return;
        if (canOpacity) {
          try { registry.overlayWin.setOpacity(1); } catch (_) {}
        }
        reassertOverlayTopmost();
        ensureOverlayWithinVisibleBounds();
        if (!hasAnyVisibleDetachedPanelWindow()) {
          registry.overlayWin.moveTop();
        }
      } catch (_) {}
    }, 0);
  }

  function centerOverlayOnDisplay(display) {
    if (!registry.overlayWin || registry.overlayWin.isDestroyed()) return;
    if (!display || !display.workArea) return;
    const b = registry.overlayWin.getBounds();
    const area = display.workArea;
    const x = Math.round(area.x + Math.max(0, (area.width - b.width) / 2));
    const y = Math.round(area.y + Math.max(0, (area.height - b.height) / 2));
    try { registry.overlayWin.setPosition(x, y); } catch (_) {}
  }

  function createOverlayWindow() {
    if (registry.overlayWin && !registry.overlayWin.isDestroyed()) {
      if (!registry.overlayWin.isVisible()) {
        try {
          reassertOverlayTopmost();
          ensureOverlayWithinVisibleBounds();
        } catch (_) {}
      }
      return;
    }

    registry.overlayWin = new BrowserWindow({
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

    registry.overlayWin.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true);
      } else {
        callback(false);
      }
    });

    registry.overlayWin.loadFile('overlay.html');
    if (shouldOpenOverlayDevTools()) {
      registry.overlayWin.webContents.openDevTools({ mode: 'detach' });
    }

    registry.overlayWin.webContents.on('did-start-loading', () => {
      if (!registry.overlayWin || registry.overlayWin.isDestroyed()) return;
      registry.overlayIgnoreMoveUntil = Date.now() + 1500;
      if (!registry.overlayVirtualVisible) {
        registry.overlayHideDuringLoad = false;
        return;
      }
      registry.overlayHideDuringLoad = true;
      try { setOverlayVirtualVisible(false); } catch (_) {}
    });

    registry.overlayWin.webContents.on('did-finish-load', () => {
      if (!registry.overlayWin || registry.overlayWin.isDestroyed()) return;
      registry.overlayWin.webContents.send(IPC_CHANNELS.SET_LANGUAGE, getCurrentLanguage());
      sendDetachedPanelsStateToOverlay();

      try {
        const b = registry.overlayWin.getBounds();
        let maxWidth = null;
        let minWidth = null;
        try {
          const display = screen.getDisplayMatching(b);
          if (display && display.workArea && typeof display.workArea.width === 'number') {
            maxWidth = display.workArea.width;
          }
        } catch (_) {}
        try {
          const minSize = registry.overlayWin.getMinimumSize();
          if (Array.isArray(minSize) && typeof minSize[0] === 'number') {
            minWidth = minSize[0];
          }
        } catch (_) {}
        const payload = { x: b.x, y: b.y, width: b.width, height: b.height, maxWidth, minWidth };
        registry.overlayWin.webContents.send(IPC_CHANNELS.OVERLAY_BOUNDS_UPDATED, payload);
        if (registry.detachedPanelWindows && registry.detachedPanelWindows.size) {
          for (const win of registry.detachedPanelWindows.values()) {
            if (!win || win.isDestroyed()) continue;
            try { win.webContents.send(IPC_CHANNELS.OVERLAY_BOUNDS_UPDATED, payload); } catch (_) {}
          }
        }
      } catch (_) {}

      if (registry.overlayHideDuringLoad) {
        registry.overlayHideDuringLoad = false;
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
      registry.overlayWin.setAlwaysOnTop(true, 'screen-saver', 1);
    } catch (_) {
      try { registry.overlayWin.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
    }
    reassertOverlayTopmost();

    registry.overlayWin.on('resize', () => {
      if (!registry.overlayWin || registry.overlayWin.isDestroyed()) return;
      try {
        const b = registry.overlayWin.getBounds();
        let maxWidth = null;
        let minWidth = null;
        try {
          const display = screen.getDisplayMatching(b);
          if (display && display.workArea && typeof display.workArea.width === 'number') {
            maxWidth = display.workArea.width;
          }
        } catch (_) {}
        try {
          const minSize = registry.overlayWin.getMinimumSize();
          if (Array.isArray(minSize) && typeof minSize[0] === 'number') {
            minWidth = minSize[0];
          }
        } catch (_) {}
        const payload = { x: b.x, y: b.y, width: b.width, height: b.height, maxWidth, minWidth };
        if (registry.detachedPanelWindows && registry.detachedPanelWindows.size) {
          for (const win of registry.detachedPanelWindows.values()) {
            if (!win || win.isDestroyed()) continue;
            try { win.webContents.send(IPC_CHANNELS.OVERLAY_BOUNDS_UPDATED, payload); } catch (_) {}
          }
        }
      } catch (_) {}
    });

    registry.overlayWin.on('closed', () => {
      registry.overlayWin = null;
      stopOverlayTopmostPulse();
      closeAllPinnedHistoryWindows();
      closeAllDetachedPanelWindows();
      notePanel.closeNotePanelWindow();
    });

    registry.overlayWin.webContents.on('render-process-gone', () => {
      if (registry.overlayWin && !registry.overlayWin.isDestroyed()) {
        registry.overlayWin.destroy();
      }
      registry.overlayWin = null;
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
