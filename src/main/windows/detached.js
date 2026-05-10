const { screen } = require('electron');
const { IPC_CHANNELS } = require('../../shared/ipc-channels');

function createDetachedWindowsManager(deps) {
  const {
    registry,
    BrowserWindow,
    clampWindowToWorkArea,
    getPreferredOverlayDisplay,
    getCurrentLanguage,
    sendDetachedPanelsStateToOverlay,
    startDetachedSelfHealPulse,
    normalizePanelId
  } = deps;

  const { core, detached } = registry;

  function bringDetachedPanelWindowsToFront() {
    detached.detachedPanelWindows.forEach((w) => {
      if (!w || w.isDestroyed()) return;
      try {
        // Keep detached panels above the overlay, but below pinned history windows.
        w.setAlwaysOnTop(true, 'screen-saver', 2);
      } catch (_) {
        try { w.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
      }
      try { w.moveTop(); } catch (_) {}
    });
  }

  function setDetachedPanelWindowsVisible(visible) {
    detached.detachedPanelWindows.forEach((w) => {
      if (!w || w.isDestroyed()) return;
      try {
        // Prewarmed windows stay hidden until activated by a real detach.
        if (!w.__detachedActive) {
          try { w.setIgnoreMouseEvents(true); } catch (_) {}
          if (typeof w.setOpacity === 'function') {
            try { w.setOpacity(0); } catch (_) {}
          }
          try { w.hide(); } catch (_) {}
          return;
        }

        if (visible) {
          // Last-resort: if the page finished loading but ready IPC never arrived,
          // promote to ready so the window can be shown after an overlay reopen.
          if (!w.__detachedReady && w.__detachedDidFinishLoad) {
            w.__detachedReady = true;
          }

          // Show only when the renderer is ready; otherwise keep it hidden to avoid blank windows.
          if (!w.__detachedReady) {
            try { w.setIgnoreMouseEvents(true); } catch (_) {}
            if (typeof w.setOpacity === 'function') {
              try { w.setOpacity(0); } catch (_) {}
            }
            try { w.hide(); } catch (_) {}
            return;
          }

          // Always show; relying on isVisible can be flaky with transparent/opacity windows.
          try {
            if (typeof w.showInactive === 'function') w.showInactive();
            else w.show();
          } catch (_) {}
          if (typeof w.setOpacity === 'function') {
            try { w.setOpacity(1); } catch (_) {}
          }
          try { w.setIgnoreMouseEvents(false); } catch (_) {}
          try { bringDetachedPanelWindowsToFront(); } catch (_) {}
        } else {
          // When hidden, make it truly not visible (not just transparent).
          try { w.setIgnoreMouseEvents(true); } catch (_) {}
          if (typeof w.setOpacity === 'function') {
            try { w.setOpacity(0); } catch (_) {}
          }
          try { w.hide(); } catch (_) {}
        }
      } catch (_) {}
    });
  }

  function closeAllDetachedPanelWindows() {
    detached.detachedPanelWindows.forEach((w) => {
      if (!w || w.isDestroyed()) return;
      try { w.destroy(); } catch (_) {}
    });
    detached.detachedPanelWindows.clear();
    detached.detachedPanelPerfStarts.clear();
  }

  function deactivateDetachedPanelWindow(panelId) {
    const pid = normalizePanelId(panelId);
    if (!pid) return;
    detached.detachedPanelPerfStarts.delete(pid);
    const w = detached.detachedPanelWindows.get(pid);
    if (!w || w.isDestroyed()) {
      detached.detachedPanelWindows.delete(pid);
      return;
    }

    try { w.__detachedActive = false; } catch (_) {}
    try { w.__detachedCreatedAt = null; } catch (_) {}

    try { w.setIgnoreMouseEvents(true); } catch (_) {}
    if (typeof w.setOpacity === 'function') {
      try { w.setOpacity(0); } catch (_) {}
    }
    try { w.hide(); } catch (_) {}
  }

  function createDetachedPanelWindow(payload) {
    const panelId = normalizePanelId(payload && payload.panelId);
    if (!panelId) return null;

    const existing = detached.detachedPanelWindows.get(panelId);
    if (existing && !existing.isDestroyed()) {
      const isPrewarmReq = !!(payload && payload.prewarm);
      // If this is a real detach (not prewarm), activate the prewarmed window.
      if (!isPrewarmReq) {
        try { existing.__detachedActive = true; } catch (_) {}

        // Apply requested bounds if provided.
        try {
          const b = existing.getBounds();
          const nextBounds = payload && payload.bounds ? payload.bounds : null;
          const rawX = nextBounds && typeof nextBounds.x === 'number' ? Math.round(nextBounds.x) : b.x;
          const rawY = nextBounds && typeof nextBounds.y === 'number' ? Math.round(nextBounds.y) : b.y;
          const rawW = nextBounds && typeof nextBounds.width === 'number' ? Math.round(nextBounds.width) : b.width;
          const rawH = nextBounds && typeof nextBounds.height === 'number' ? Math.round(nextBounds.height) : b.height;
          const width = Math.max(200, rawW);
          const height = Math.max(120, rawH);
          const clamped = clampWindowToWorkArea(rawX, rawY, width, height, 0);
          existing.setBounds({ x: clamped.x, y: clamped.y, width, height });
        } catch (_) {}

        // If already ready, show immediately and notify overlay to hide the slot.
        try {
          if (existing.__detachedReady && detached.detachedWindowsDesiredVisible) {
            try {
              if (typeof existing.showInactive === 'function') existing.showInactive();
              else existing.show();
            } catch (_) {}
            try {
              if (typeof existing.setOpacity === 'function') existing.setOpacity(1);
            } catch (_) {}
            try { existing.setIgnoreMouseEvents(false); } catch (_) {}
            try { existing.moveTop(); } catch (_) {}
            try {
              if (core.overlayWin && !core.overlayWin.isDestroyed()) {
                core.overlayWin.webContents.send(IPC_CHANNELS.DETACHED_PANEL_SHOWN, { panelId });
              }
            } catch (_) {}
          }
        } catch (_) {}

        try { sendDetachedPanelsStateToOverlay(); } catch (_) {}
        try { startDetachedSelfHealPulse(1500, 200); } catch (_) {}
      }

      try { existing.webContents.send(IPC_CHANNELS.DETACHED_PANEL_INIT, payload || {}); } catch (_) {}
      return existing;
    }

    const bounds = (payload && payload.bounds) ? payload.bounds : (detached.detachedPanelLastBounds.get(panelId) || null);
    const defaultSizes = {
      ask: { width: 480, height: 420 },
      history: { width: 520, height: 520 },
      settings: { width: 520, height: 560 }
    };
    const fallback = defaultSizes[panelId] || { width: 500, height: 500 };

    // Allow smaller detached windows; size is also clamped during interactive resize.
    const width = Math.max(200, Math.round((bounds && bounds.width) || fallback.width));
    const height = Math.max(120, Math.round((bounds && bounds.height) || fallback.height));
    let x = typeof (bounds && bounds.x) === 'number' ? Math.round(bounds.x) : undefined;
    let y = typeof (bounds && bounds.y) === 'number' ? Math.round(bounds.y) : undefined;

    if (typeof x !== 'number' || typeof y !== 'number') {
      try {
        const display = getPreferredOverlayDisplay();
        const area = display && display.workArea ? display.workArea : screen.getPrimaryDisplay().workArea;
        x = Math.round(area.x + Math.max(0, (area.width - width) / 2));
        y = Math.round(area.y + Math.max(0, (area.height - height) / 2));
      } catch (_) {}
    }

    const clampedPos = (typeof x === 'number' && typeof y === 'number')
      ? clampWindowToWorkArea(x, y, width, height, 0)
      : null;

    const detachedWin = new BrowserWindow({
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

    // Track creation time for perceived-latency logging and start fully transparent until the
    // renderer signals it is ready to paint real content.
    detachedWin.__detachedCreatedAt = (payload && payload.prewarm) ? null : Date.now();
    detachedWin.__detachedReady = false;
    detachedWin.__detachedDidFinishLoad = false;
    detachedWin.__detachedActive = !(payload && payload.prewarm);
    try {
      if (typeof detachedWin.setOpacity === 'function') {
        detachedWin.setOpacity(0);
      }
    } catch (_) {}

    // Pre-warm (visible path): show immediately but fully transparent + click-through.
    // For background prewarm windows, do NOT show.
    if (!(payload && payload.prewarm)) {
      try { detachedWin.setIgnoreMouseEvents(true); } catch (_) {}
      try {
        if (typeof detachedWin.showInactive === 'function') detachedWin.showInactive();
        else detachedWin.show();
      } catch (_) {}
    } else {
      try { detachedWin.setIgnoreMouseEvents(true); } catch (_) {}
      try { detachedWin.hide(); } catch (_) {}
    }

    detachedWin.__detachedPanelId = panelId;
    detached.detachedPanelWindows.set(panelId, detachedWin);

    detachedWin.loadFile('overlay.html', { query: { role: 'detached', panel: panelId } });
    detachedWin.webContents.on('did-finish-load', () => {
      detachedWin.__detachedDidFinishLoad = true;
      try {
        detachedWin.webContents.send(IPC_CHANNELS.SET_LANGUAGE, getCurrentLanguage());
        detachedWin.webContents.send(IPC_CHANNELS.DETACHED_PANEL_INIT, payload || {});
      } catch (_) {}

      try {
        if (core.overlayWin && !core.overlayWin.isDestroyed()) {
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
          const payloadBounds = { x: b.x, y: b.y, width: b.width, height: b.height, maxWidth, minWidth };
          detachedWin.webContents.send(IPC_CHANNELS.OVERLAY_BOUNDS_UPDATED, payloadBounds);
        }
      } catch (_) {}
    });

    // Failsafe: on some Windows transparent frameless windows, the renderer->main
    // ready IPC can very rarely be missed/delayed under load. If the page finished
    // loading but we never got `detached-panel-ready`, force-show the window so it
    // can't "vanish" during detach.
    try {
      setTimeout(() => {
        try {
          if (!detachedWin || detachedWin.isDestroyed()) return;
          if (!detachedWin.__detachedDidFinishLoad) return;
          if (detachedWin.__detachedReady) return;

          // Mark ready regardless of current overlay visibility so we can't get stuck
          // in a permanently hidden/non-ready state after X -> reopen.
          detachedWin.__detachedReady = true;

          // Prewarm windows: mark ready but never show until activated.
          if (!detachedWin.__detachedActive) {
            try { detachedWin.setIgnoreMouseEvents(true); } catch (_) {}
            if (typeof detachedWin.setOpacity === 'function') {
              try { detachedWin.setOpacity(0); } catch (_) {}
            }
            try { detachedWin.hide(); } catch (_) {}
            return;
          }

          // If the overlay group is hidden, keep the detached window hidden for now;
          // it will be shown on the next open-overlay via setDetachedPanelWindowsVisible(true).
          if (!detached.detachedWindowsDesiredVisible) {
            try { detachedWin.setIgnoreMouseEvents(true); } catch (_) {}
            if (typeof detachedWin.setOpacity === 'function') {
              try { detachedWin.setOpacity(0); } catch (_) {}
            }
            try { detachedWin.hide(); } catch (_) {}
            try { console.warn(`[PERF] Detached panel "${panelId}" marked ready while overlay hidden (ready IPC missing)`); } catch (_) {}
            return;
          }

          try {
            if (typeof detachedWin.showInactive === 'function') detachedWin.showInactive();
            else detachedWin.show();
          } catch (_) {}
          try {
            if (typeof detachedWin.setOpacity === 'function') detachedWin.setOpacity(1);
          } catch (_) {}

          // Respect initial drag-out click-through; otherwise make it interactive.
          const keepClickThrough = !!(payload && payload.dragging);
          try { detachedWin.setIgnoreMouseEvents(keepClickThrough); } catch (_) {}
          try { detachedWin.moveTop(); } catch (_) {}

          try {
            if (core.overlayWin && !core.overlayWin.isDestroyed()) {
              core.overlayWin.webContents.send(IPC_CHANNELS.DETACHED_PANEL_SHOWN, { panelId });
            }
          } catch (_) {}

          try { console.warn(`[PERF] Detached panel "${panelId}" forced visible (ready IPC missing)`); } catch (_) {}
        } catch (_) {}
      }, 1200);
    } catch (_) {}

    try {
      // Keep detached panels above the main overlay.
      detachedWin.setAlwaysOnTop(true, 'screen-saver', 2);
    } catch (_) {
      detachedWin.setAlwaysOnTop(true, 'screen-saver');
    }
    try { detachedWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (_) {}

    detachedWin.on('closed', () => {
      detached.detachedPanelWindows.delete(panelId);

      // If the detached panel window is closed (e.g., Alt+F4), restore the panel slot
      // in the main overlay so it doesn't stay "missing".
      if (core.overlayWin && !core.overlayWin.isDestroyed()) {
        try {
          core.overlayWin.webContents.send(IPC_CHANNELS.DETACHED_PANEL_DOCKED, { panelId, open: false });
        } catch (_) {}
      }

      sendDetachedPanelsStateToOverlay();
    });

    try {
      if (payload && payload.dragging) {
        // During drag-out from the overlay, keep this window fully click-through so it can't steal the pointer.
        detachedWin.setIgnoreMouseEvents(true);
      } else {
        // Detached panels should remain interactive when visible.
        // Hover-based click-through can be unreliable on Windows transparent windows.
        detachedWin.setIgnoreMouseEvents(false);
      }
    } catch (_) {}

    return detachedWin;
  }

  return {
    bringDetachedPanelWindowsToFront,
    setDetachedPanelWindowsVisible,
    closeAllDetachedPanelWindows,
    deactivateDetachedPanelWindow,
    createDetachedPanelWindow
  };
}

module.exports = {
  createDetachedWindowsManager
};
