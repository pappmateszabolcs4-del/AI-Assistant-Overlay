const { PANEL_IDS } = require('../../shared/panels');
const { IPC_CHANNELS } = require('../../shared/ipc-channels');

function createIpcRegistrar(deps) {
  const {
    app,
    BrowserWindow,
    ipcMain,
    screen,
    registry,
    clampWindowToWorkArea,
    ensureOverlayWithinVisibleBounds,
    detectCurrentGame,
    tryGetDisplayForGameWindow,
    getPreferredOverlayDisplay,
    centerOverlayOnDisplay,
    showOverlayAndRaise,
    setOverlayVirtualVisible,
    setPinnedHistoryWindowsVisible,
    setDetachedPanelWindowsVisible,
    reconcileDetachedPanelWindowsVisibility,
    startDetachedSelfHealPulse,
    startDetachedPanelPrewarm,
    notePanel,
    infoPanel,
    createDetachedPanelWindow,
    sendDetachedPanelsStateToOverlay,
    normalizePanelId,
    deactivateDetachedPanelWindow,
    createPinnedHistoryWindow,
    closeAllDetachedPanelWindows,
    closeAllPinnedHistoryWindows,
    openaiService,
    getNotePanelLabels,
    getInfoPanelLabels,
    setCurrentLanguage,
    getCurrentLanguage,
    setCurrentSpeechRate,
    isCursorInsideOverlayChildWindow,
    stopOverlayMouseForwardGate,
    startOverlayMouseForwardGate,
    createOverlayWindow
  } = deps;

  function pointInRect(pt, rect) {
    if (!pt || !rect) return false;
    return pt.x >= rect.left && pt.x <= rect.right && pt.y >= rect.top && pt.y <= rect.bottom;
  }

  function requestHistoryDropRects(timeoutMs = 250) {
    return new Promise((resolve) => {
      const sources = [];
      if (registry.overlayWin && !registry.overlayWin.isDestroyed()) sources.push(registry.overlayWin);
      const detachedHistory = registry.detachedPanelWindows && registry.detachedPanelWindows.get && registry.detachedPanelWindows.get('history');
      if (detachedHistory && !detachedHistory.isDestroyed()) sources.push(detachedHistory);

      if (sources.length === 0) return resolve([]);

      const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      let timer = null;
      const aggregated = [];
      const responded = new Set();

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        ipcMain.removeListener('response-history-drop-rects', onResponse);
      };

      const onResponse = (event, id, rects) => {
        if (id !== requestId) return;
        const wc = event && event.sender;
        const wcId = wc && typeof wc.id === 'number' ? wc.id : null;
        if (wcId != null) {
          if (responded.has(wcId)) return;
          responded.add(wcId);
        }

        if (Array.isArray(rects)) aggregated.push(...rects);

        if (responded.size >= sources.length) {
          cleanup();
          return resolve(aggregated);
        }
      };

      ipcMain.on(IPC_CHANNELS.RESPONSE_HISTORY_DROP_RECTS, onResponse);
      for (const w of sources) {
        try { w.webContents.send(IPC_CHANNELS.REQUEST_HISTORY_DROP_RECTS, requestId); } catch (_) {}
      }

      timer = setTimeout(() => {
        cleanup();
        resolve(aggregated);
      }, timeoutMs);
    });
  }

  function requestOverlayPanelDockRects(timeoutMs = 250) {
    return new Promise((resolve) => {
      if (!registry.overlayWin || registry.overlayWin.isDestroyed()) return resolve({});
      const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      let timer = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        ipcMain.removeListener('response-panel-dock-rects', onResponse);
      };

      const onResponse = (_event, id, rectsByPanel) => {
        if (id !== requestId) return;
        cleanup();
        if (rectsByPanel && typeof rectsByPanel === 'object') return resolve(rectsByPanel);
        return resolve({});
      };

      ipcMain.on(IPC_CHANNELS.RESPONSE_PANEL_DOCK_RECTS, onResponse);
      registry.overlayWin.webContents.send(IPC_CHANNELS.REQUEST_PANEL_DOCK_RECTS, requestId);

      timer = setTimeout(() => {
        cleanup();
        resolve({});
      }, timeoutMs);
    });
  }

  async function getDockTargetPanelIdAtScreenPoint(screenPoint) {
    if (!screenPoint || !Number.isFinite(screenPoint.x) || !Number.isFinite(screenPoint.y)) return null;
    const rects = await requestOverlayPanelDockRects();
    if (!rects || typeof rects !== 'object') return null;
    let bestPid = null;
    let bestArea = Infinity;
    const rectList = [];
    for (const pid of PANEL_IDS) {
      const r = rects[pid];
      if (!r || typeof r.left !== 'number' || typeof r.right !== 'number' || typeof r.top !== 'number' || typeof r.bottom !== 'number') {
        continue;
      }
      rectList.push({ pid, rect: r });
      if (!pointInRect(screenPoint, r)) continue;
      const area = Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
      if (area < bestArea) {
        bestArea = area;
        bestPid = pid;
      }
    }
    if (bestPid) return bestPid;

    if (rectList.length) {
      let minTop = Infinity;
      let maxBottom = -Infinity;
      for (const item of rectList) {
        const r = item.rect;
        minTop = Math.min(minTop, r.top);
        maxBottom = Math.max(maxBottom, r.bottom);
      }
      const M = 36;
      if (screenPoint.y >= (minTop - M) && screenPoint.y <= (maxBottom + M)) {
        let nearestPid = null;
        let nearestDx = Infinity;
        for (const item of rectList) {
          const r = item.rect;
          const centerX = (r.left + r.right) / 2;
          const dx = Math.abs(screenPoint.x - centerX);
          if (dx < nearestDx) {
            nearestDx = dx;
            nearestPid = item.pid;
          }
        }
        if (nearestPid) return nearestPid;
      }
    }
    return null;
  }

  async function shouldUnpinAtScreenPoint(screenPoint) {
    const rects = await requestHistoryDropRects();
    for (const r of rects) {
      if (r && typeof r.left === 'number' && pointInRect(screenPoint, r)) return true;
    }
    return false;
  }

  function registerIpcHandlers() {
    if (registry.ipcListenersRegistered) {
      return;
    }
    registry.ipcListenersRegistered = true;

    ipcMain.handle(IPC_CHANNELS.WINDOW_CONTROL, async (_event, action) => {
      switch (action) {
        case 'minimize':
          if (registry.win && !registry.win.isDestroyed()) {
            registry.win.minimize();
          }
          break;
        case 'maximize':
          if (registry.win && !registry.win.isDestroyed()) {
            if (registry.win.isMaximized()) {
              registry.win.unmaximize();
            } else {
              registry.win.maximize();
            }
          }
          break;
        case 'close':
          if (registry.overlayWin && !registry.overlayWin.isDestroyed()) {
            registry.overlayWin.destroy();
          }
          registry.overlayWin = null;
          if (registry.win && !registry.win.isDestroyed()) {
            registry.win.destroy();
          }
          registry.win = null;
          app.quit();
          break;
      }
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.WINDOW_ACTION, async (_event, action) => {
      if (!registry.overlayWin || registry.overlayWin.isDestroyed()) {
        return { success: false, error: 'overlay-missing' };
      }
      switch (action) {
        case 'maximize-temp':
          registry.overlayOriginalBounds = registry.overlayWin.getBounds();
          registry.overlayWin.maximize();
          break;
        case 'restore-temp':
          if (registry.overlayOriginalBounds) {
            registry.overlayWin.setBounds(registry.overlayOriginalBounds);
            registry.overlayOriginalBounds = null;
          }
          break;
        case 'reset-position':
          registry.overlayIgnoreMoveUntil = Date.now() + 1500;
          registry.overlayWin.setSize(1100, 500);
          ensureOverlayWithinVisibleBounds(true);
          break;
      }
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.SET_CLICK_THROUGH, async (event, enable) => {
      let allowThrough = !!enable;
      const senderWin = BrowserWindow.fromWebContents(event.sender);
      if (senderWin && !senderWin.isDestroyed()) {
        // Detached panels are always interactive when visible; don't let renderer toggle click-through.
        if (senderWin.__detachedPanelId) {
          return { success: true };
        }

        // If the main overlay is virtual-hidden (opacity 0), never allow it to become interactive.
        // Otherwise it can behave like an invisible window that still receives clicks/drags.
        if (registry.overlayWin && !registry.overlayWin.isDestroyed() && senderWin.id === registry.overlayWin.id && !registry.overlayVirtualVisible) {
          try { senderWin.setIgnoreMouseEvents(true, { forward: true }); } catch (_) {}
          registry.clickThrough = true;
          registry.overlayMouseForwardEnabled = true;
          stopOverlayMouseForwardGate();
          return { success: true };
        }

        // If the cursor is inside a detached/pinned/note/info window, keep the main overlay click-through.
        // This prevents cursor flicker when windows overlap and not all panels are undocked.
        if (registry.overlayWin && !registry.overlayWin.isDestroyed() && senderWin.id === registry.overlayWin.id && !allowThrough) {
          if (isCursorInsideOverlayChildWindow()) {
            allowThrough = true;
          }
        }

        // If the note panel is virtual-hidden (opacity 0), never allow it to become interactive.
        // Otherwise it can end up as an invisible window that blocks clicks behind it.
        let forwardMoves = allowThrough;
        if (registry.notePanelWin && !registry.notePanelWin.isDestroyed() && senderWin.id === registry.notePanelWin.id && !registry.notePanelVirtualVisible) {
          allowThrough = true;
          forwardMoves = false;
        }

        // When the cursor is inside a child window (detached/pinned/note/info), do NOT forward
        // mouse moves to the overlay renderer while click-through is enabled. Forwarding can
        // still affect the cursor (grab<->arrow) on Windows even though clicks pass through.
        if (registry.overlayWin && !registry.overlayWin.isDestroyed() && senderWin.id === registry.overlayWin.id && allowThrough) {
          try {
            if (isCursorInsideOverlayChildWindow()) {
              forwardMoves = false;
            }
          } catch (_) {}
        }
        try {
          if (allowThrough) {
            senderWin.setIgnoreMouseEvents(true, forwardMoves ? { forward: true } : undefined);
          } else {
            senderWin.setIgnoreMouseEvents(false);
          }
        } catch (_) {}
      }
      if (registry.overlayWin && senderWin && senderWin.id === registry.overlayWin.id) {
        registry.clickThrough = allowThrough;
        registry.overlayMouseForwardEnabled = true;
        if (registry.clickThrough) startOverlayMouseForwardGate();
        else stopOverlayMouseForwardGate();
      }
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.SET_ALWAYS_ON_TOP, async (_event, enable) => {
      if (registry.win && !registry.win.isDestroyed()) {
        if (enable) {
          if (registry.win.isMinimized()) registry.win.restore();
          registry.win.setAlwaysOnTop(true, 'floating', 1);
          registry.win.show();
          registry.win.moveTop();
          registry.win.focus();
          registry.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        } else {
          registry.win.setAlwaysOnTop(false);
          registry.win.setVisibleOnAllWorkspaces(false);
        }
      }
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.OPEN_OVERLAY, async () => {
      createOverlayWindow();
      registry.detachedWindowsDesiredVisible = true;
      if (registry.overlayWin && !registry.overlayWin.isDestroyed()) {
        try {
          if (!registry.overlayVirtualVisible) {
            // Preserve the last user position when toggling the overlay (hotkey).
            // Only center on first-ever show; subsequent opens should feel stable.
            if (!registry.overlayEverShown) {
              detectCurrentGame();
              const gameDisplay = tryGetDisplayForGameWindow(registry.currentDetectedGame);
              const preferred = gameDisplay || getPreferredOverlayDisplay();
              centerOverlayOnDisplay(preferred);
            }
          }
        } catch (_) {}
        showOverlayAndRaise();

        // Keep renderer in sync even when overlay is pre-created.
        if (registry.currentDetectedGame) {
          try { registry.overlayWin.webContents.send(IPC_CHANNELS.SET_GAME_CONTEXT, registry.currentDetectedGame); } catch (_) {}
        }
      }
      setPinnedHistoryWindowsVisible(true);
      setDetachedPanelWindowsVisible(true);
      reconcileDetachedPanelWindowsVisibility('open-overlay');
      try { startDetachedSelfHealPulse(2000, 250); } catch (_) {}
      // Background prewarm: create the detached panel windows invisibly so the first undock
      // doesn't pay the full creation + compositor warm-up cost.
      try {
        setTimeout(() => {
          try { startDetachedPanelPrewarm(); } catch (_) {}
        }, 250);
      } catch (_) {}
      notePanel.setNotePanelVisible(true);
      return { success: true, visible: !!(registry.overlayWin && registry.overlayVirtualVisible) };
    });

    ipcMain.handle(IPC_CHANNELS.CLOSE_OVERLAY, async () => {
      // If the renderer hid the overlay mid-detach gesture, ensure the main-process
      // guard can't remain stuck (which would ignore future x/y moves).
      registry.overlayDetachGuardActive = false;
      registry.detachedWindowsDesiredVisible = false;
      if (registry.overlayWin && !registry.overlayWin.isDestroyed()) {
        setOverlayVirtualVisible(false);
      }
      setPinnedHistoryWindowsVisible(false);
      setDetachedPanelWindowsVisible(false);
      reconcileDetachedPanelWindowsVisibility('close-overlay');
      notePanel.setNotePanelVisible(false);
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.DETACHED_PANEL_OPEN, async (_event, payload) => {
      try {
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

      const w = registry.detachedPanelWindows.get(pid);
      if (!w || w.isDestroyed() || w.id !== senderWin.id) return;

      // Mark readiness first; visibility is controlled by registry.detachedWindowsDesiredVisible.
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

      if (!registry.detachedWindowsDesiredVisible) {
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
        if (registry.overlayWin && !registry.overlayWin.isDestroyed()) {
          registry.overlayWin.webContents.send(IPC_CHANNELS.DETACHED_PANEL_SHOWN, { panelId: pid });
        }
      } catch (_) {}

      if (createdAt) {
        const dt = Date.now() - createdAt;
        try {
          console.log(`[PERF] Detached panel "${pid}" ready in ${dt} ms`);
        } catch (_) {}
        w.__detachedCreatedAt = null;
      }
    });

    // While dragging a detached panel back to dock, temporarily show docking targets in the main overlay.
    // Safety: auto-turn-off so the overlay can't get stuck in preview mode.
    let overlayDockPreviewTimer = null;
    let overlayDockPreviewLastOnAt = 0;
    let overlayDockPreviewVisible = false;

    function setOverlayDockPreview(visible) {
      const next = !!visible;
      overlayDockPreviewVisible = next;
      if (!registry.overlayWin || registry.overlayWin.isDestroyed()) return;
      try {
        registry.overlayWin.webContents.send(IPC_CHANNELS.OVERLAY_DOCK_PREVIEW, { visible: next });
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

      if (!registry.overlayWin || registry.overlayWin.isDestroyed()) {
        setOverlayDockPreview(false);
        return { success: true, visible: false };
      }

      const x = Number(payload && payload.pointerScreenX);
      const y = Number(payload && payload.pointerScreenY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        setOverlayDockPreview(false);
        return { success: true, visible: false };
      }

      const b = registry.overlayWin.getBounds();
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
      const w = registry.detachedPanelWindows.get(pid);
      if (!w || w.isDestroyed()) return;
      const b = w.getBounds();
      const nextX = typeof x === 'number' ? Math.round(x) : b.x;
      const nextY = typeof y === 'number' ? Math.round(y) : b.y;
      try {
        const clamped = clampWindowToWorkArea(nextX, nextY, b.width, b.height, 0);
        w.setPosition(clamped.x, clamped.y);
      } catch (_) {
        try { w.setPosition(nextX, nextY); } catch (_) {}
      }
    });

    ipcMain.handle(IPC_CHANNELS.DETACHED_PANEL_END_DRAG, async (_event, panelId) => {
      const pid = normalizePanelId(panelId);
      if (!pid) return { success: false, error: 'bad-panel' };
      const w = registry.detachedPanelWindows.get(pid);
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
      registry.detachedPanelLastBounds.set(pid, { x: finalBounds.x, y: finalBounds.y, width: finalBounds.width, height: finalBounds.height });

      return { success: true };
    });

    ipcMain.on(IPC_CHANNELS.DETACHED_PANEL_SET_BOUNDS, (event, nextBounds) => {
      const w = BrowserWindow.fromWebContents(event.sender);
      if (!w || w.isDestroyed()) return;
      const pid = w.__detachedPanelId;
      if (!normalizePanelId(pid)) return;
      const b = w.getBounds();
      const rawX = nextBounds && typeof nextBounds.x === 'number' ? Math.round(nextBounds.x) : b.x;
      const rawY = nextBounds && typeof nextBounds.y === 'number' ? Math.round(nextBounds.y) : b.y;
      const rawW = nextBounds && typeof nextBounds.width === 'number' ? Math.round(nextBounds.width) : b.width;
      const rawH = nextBounds && typeof nextBounds.height === 'number' ? Math.round(nextBounds.height) : b.height;

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
      registry.detachedPanelLastBounds.set(pid, { x, y, width, height });
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
      if (!dockTargetPid && registry.overlayWin && !registry.overlayWin.isDestroyed() && registry.overlayVirtualVisible) {
        const candidate = (Number.isFinite(screenPoint.x) && Number.isFinite(screenPoint.y))
          ? screenPoint
          : windowDerivedPoint;
        if (candidate && Number.isFinite(candidate.x) && Number.isFinite(candidate.y)) {
          try {
            const b = registry.overlayWin.getBounds();
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
        if (registry.overlayWin && !registry.overlayWin.isDestroyed()) {
          if (dockTargetPid !== pid) {
            registry.overlayWin.webContents.send(IPC_CHANNELS.OVERLAY_PANEL_SWAP, { fromPanelId: pid, toPanelId: dockTargetPid });
          }
          registry.overlayWin.webContents.send(IPC_CHANNELS.DETACHED_PANEL_DOCKED, { panelId: pid, open: true });
        }
        sendDetachedPanelsStateToOverlay();
        return { success: true, docked: true };
      }

      // Persist bounds after drop
      const b = w.getBounds();
      const clamped = clampWindowToWorkArea(b.x, b.y, b.width, b.height, 0);
      try { w.setPosition(clamped.x, clamped.y); } catch (_) {}
      const finalBounds = w.getBounds();
      registry.detachedPanelLastBounds.set(pid, { x: finalBounds.x, y: finalBounds.y, width: finalBounds.width, height: finalBounds.height });

      return { success: true, docked: false };
    });

    ipcMain.handle(IPC_CHANNELS.DETACHED_PANEL_DOCK, async (_event, panelId) => {
      const pid = normalizePanelId(panelId);
      if (!pid) return { success: false, error: 'bad-panel' };
      deactivateDetachedPanelWindow(pid);
      if (registry.overlayWin && !registry.overlayWin.isDestroyed()) {
        registry.overlayWin.webContents.send(IPC_CHANNELS.DETACHED_PANEL_DOCKED, { panelId: pid, open: true });
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
      const w = registry.pinnedHistoryWindows.get(key);
      if (!w || w.isDestroyed()) return { success: false, error: 'window-missing' };
      const nextX = typeof x === 'number' ? Math.round(x) : w.getBounds().x;
      const nextY = typeof y === 'number' ? Math.round(y) : w.getBounds().y;
      try { w.setPosition(nextX, nextY); } catch (_) {}
      return { success: true };
    });

    ipcMain.on(IPC_CHANNELS.PINNED_HISTORY_MOVE_BY_TS, (_event, ts, x, y) => {
      const key = Number(ts);
      const w = registry.pinnedHistoryWindows.get(key);
      if (!w || w.isDestroyed()) return;
      const nextX = typeof x === 'number' ? Math.round(x) : w.getBounds().x;
      const nextY = typeof y === 'number' ? Math.round(y) : w.getBounds().y;
      try { w.setPosition(nextX, nextY); } catch (_) {}
    });

    ipcMain.handle(IPC_CHANNELS.PINNED_HISTORY_END_DRAG, async (_event, ts) => {
      const key = Number(ts);
      const w = registry.pinnedHistoryWindows.get(key);
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
      const w = registry.pinnedHistoryWindows.get(key);
      if (w && !w.isDestroyed()) {
        try { w.destroy(); } catch (_) {}
      }
      registry.pinnedHistoryWindows.delete(key);
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
    });

    // Persist the current bounds back to the overlay (without unpin checks).
    ipcMain.on(IPC_CHANNELS.PINNED_HISTORY_COMMIT_BOUNDS, (event, payload) => {
      const w = BrowserWindow.fromWebContents(event.sender);
      if (!w || w.isDestroyed()) return;
      const ts = Number(payload && payload.ts);
      if (!registry.overlayWin || registry.overlayWin.isDestroyed() || !Number.isFinite(ts)) return;
      const b = w.getBounds();
      const clamped = clampWindowToWorkArea(b.x, b.y, b.width, b.height, 0);
      try { w.setPosition(clamped.x, clamped.y); } catch (_) {}
      const finalBounds = w.getBounds();
      registry.overlayWin.webContents.send(IPC_CHANNELS.PINNED_HISTORY_BOUNDS, {
        ts,
        bounds: { x: finalBounds.x, y: finalBounds.y, width: finalBounds.width, height: finalBounds.height }
      });
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
        registry.pinnedHistoryWindows.delete(ts);
        if (registry.overlayWin && !registry.overlayWin.isDestroyed()) {
          registry.overlayWin.webContents.send(IPC_CHANNELS.PINNED_HISTORY_UNPINNED, { ts });
        }
        return { success: true, unpinned: true };
      }

      // Persist bounds after drop
      if (registry.overlayWin && !registry.overlayWin.isDestroyed() && Number.isFinite(ts)) {
        const b = w.getBounds();
        const clamped = clampWindowToWorkArea(b.x, b.y, b.width, b.height, 0);
        try { w.setPosition(clamped.x, clamped.y); } catch (_) {}
        const finalBounds = w.getBounds();
        registry.overlayWin.webContents.send(IPC_CHANNELS.PINNED_HISTORY_BOUNDS, {
          ts,
          bounds: { x: finalBounds.x, y: finalBounds.y, width: finalBounds.width, height: finalBounds.height }
        });
      }

      return { success: true, unpinned: false };
    });

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

    // Read-only Info Panel (singleton separate overlay element)
    ipcMain.handle(IPC_CHANNELS.INFO_PANEL_OPEN, async (_event, payload) => {
      try {
        infoPanel.createInfoPanelWindow(payload || {});
        infoPanel.setInfoPanelVisible(true);
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle(IPC_CHANNELS.INFO_PANEL_CLOSE, async () => {
      infoPanel.setInfoPanelVisible(false);
      return { success: true };
    });

    ipcMain.on(IPC_CHANNELS.INFO_PANEL_MOVE, (event, pos) => {
      const w = BrowserWindow.fromWebContents(event.sender);
      if (!w || w.isDestroyed()) return;
      const b = w.getBounds();
      const targetX = pos && typeof pos.x === 'number' ? Math.round(pos.x) : b.x;
      const targetY = pos && typeof pos.y === 'number' ? Math.round(pos.y) : b.y;
      const clamped = clampWindowToWorkArea(targetX, targetY, b.width, b.height, 0);
      try { w.setPosition(clamped.x, clamped.y); } catch (_) {}
      registry.infoPanelLastBounds = { x: clamped.x, y: clamped.y, width: b.width, height: b.height };
    });

    ipcMain.on(IPC_CHANNELS.INFO_PANEL_SET_BOUNDS, (event, nextBounds) => {
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
      registry.infoPanelLastBounds = { x: clampedPos.x, y: clampedPos.y, width, height };
    });

    ipcMain.on(IPC_CHANNELS.INFO_PANEL_COMMIT_BOUNDS, (event) => {
      const w = BrowserWindow.fromWebContents(event.sender);
      if (!w || w.isDestroyed()) return;

      const b = w.getBounds();
      const clamped = clampWindowToWorkArea(b.x, b.y, b.width, b.height, 0);
      try { w.setPosition(clamped.x, clamped.y); } catch (_) {}
      const finalBounds = w.getBounds();
      registry.infoPanelLastBounds = { x: finalBounds.x, y: finalBounds.y, width: finalBounds.width, height: finalBounds.height };
    });

    ipcMain.on(IPC_CHANNELS.NOTE_PANEL_MOVE, (event, pos) => {
      const w = BrowserWindow.fromWebContents(event.sender);
      if (!w || w.isDestroyed()) return;
      const b = w.getBounds();
      const targetX = pos && typeof pos.x === 'number' ? Math.round(pos.x) : b.x;
      const targetY = pos && typeof pos.y === 'number' ? Math.round(pos.y) : b.y;
      const clamped = clampWindowToWorkArea(targetX, targetY, b.width, b.height, 0);
      try { w.setPosition(clamped.x, clamped.y); } catch (_) {}
      registry.notePanelLastBounds = { x: clamped.x, y: clamped.y, width: b.width, height: b.height };
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
      registry.notePanelLastBounds = { x: clampedPos.x, y: clampedPos.y, width, height };
    });

    ipcMain.on(IPC_CHANNELS.NOTE_PANEL_COMMIT_BOUNDS, (event) => {
      const w = BrowserWindow.fromWebContents(event.sender);
      if (!w || w.isDestroyed()) return;

      const b = w.getBounds();
      const clamped = clampWindowToWorkArea(b.x, b.y, b.width, b.height, 0);
      try { w.setPosition(clamped.x, clamped.y); } catch (_) {}
      const finalBounds = w.getBounds();
      registry.notePanelLastBounds = { x: finalBounds.x, y: finalBounds.y, width: finalBounds.width, height: finalBounds.height };
    });

    ipcMain.handle(IPC_CHANNELS.SET_LANGUAGE, async (_event, lang) => {
      const nextLanguage = openaiService.normalizeLanguage(lang);
      setCurrentLanguage(nextLanguage);
      if (registry.overlayWin && !registry.overlayWin.isDestroyed()) {
        registry.overlayWin.webContents.send(IPC_CHANNELS.SET_LANGUAGE, nextLanguage);
      }
      if (registry.notePanelWin && !registry.notePanelWin.isDestroyed()) {
        try {
          const labels = getNotePanelLabels(nextLanguage);
          registry.notePanelWin.webContents.send(IPC_CHANNELS.NOTE_PANEL_INIT, { labels });
        } catch (_) {}
      }
      if (registry.infoPanelWin && !registry.infoPanelWin.isDestroyed()) {
        try {
          const labels = getInfoPanelLabels(nextLanguage);
          registry.infoPanelWin.webContents.send(IPC_CHANNELS.INFO_PANEL_INIT, { labels });
        } catch (_) {}
      }
      if (registry.detachedPanelWindows && registry.detachedPanelWindows.size) {
        for (const win of registry.detachedPanelWindows.values()) {
          if (!win || win.isDestroyed()) continue;
          try {
            win.webContents.send(IPC_CHANNELS.SET_LANGUAGE, nextLanguage);
          } catch (_) {}
        }
      }
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.OVERLAY_LAYOUT_SET, async (_event, payload) => {
      const rawMode = payload && typeof payload === 'object' && payload.mode != null
        ? payload.mode
        : payload;
      const mode = typeof rawMode === 'string' ? rawMode : String(rawMode || '');
      const validModes = new Set(['horizontal', 'compact', 'stacked']);
      const nextMode = validModes.has(mode) ? mode : 'horizontal';

      const sendLayout = (win) => {
        if (!win || win.isDestroyed()) return;
        try { win.webContents.send(IPC_CHANNELS.OVERLAY_LAYOUT_UPDATED, { mode: nextMode }); } catch (_) {}
      };

      sendLayout(registry.overlayWin);
      if (registry.detachedPanelWindows && registry.detachedPanelWindows.size) {
        for (const win of registry.detachedPanelWindows.values()) {
          sendLayout(win);
        }
      }

      return { success: true, mode: nextMode };
    });

    ipcMain.handle(IPC_CHANNELS.SET_SPEECH_RATE, async (_event, rate) => {
      const nextRate = Math.max(0, Math.min(200, rate));
      setCurrentSpeechRate(nextRate);
      if (registry.overlayWin && !registry.overlayWin.isDestroyed()) {
        registry.overlayWin.webContents.send(IPC_CHANNELS.SET_SPEECH_RATE, nextRate);
      }
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.RESIZE_OVERLAY, async (_event, bounds) => {
      if (!registry.overlayWin || registry.overlayWin.isDestroyed()) {
        return { success: false, error: 'overlay-missing' };
      }
      const current = registry.overlayWin.getBounds();
      const ignoreMoves = registry.overlayDetachGuardActive || Date.now() < registry.overlayIgnoreMoveUntil;
      const rawX = (!ignoreMoves && bounds && Number.isFinite(bounds.x)) ? Math.round(bounds.x) : current.x;
      const rawY = (!ignoreMoves && bounds && Number.isFinite(bounds.y)) ? Math.round(bounds.y) : current.y;
      const rawW = (bounds && Number.isFinite(bounds.width)) ? Math.round(bounds.width) : current.width;
      const rawH = (bounds && Number.isFinite(bounds.height)) ? Math.round(bounds.height) : current.height;

      const width = Math.max(240, rawW);
      const height = Math.max(140, rawH);
      const clamped = clampWindowToWorkArea(rawX, rawY, width, height, 0);

      const next = {
        x: ignoreMoves ? current.x : clamped.x,
        y: ignoreMoves ? current.y : clamped.y,
        width,
        height
      };

      try { registry.overlayWin.setBounds(next); } catch (_) {}
      return { success: true };
    });

    ipcMain.on(IPC_CHANNELS.OVERLAY_DETACH_GUARD, (_event, active) => {
      registry.overlayDetachGuardActive = !!active;
    });

    ipcMain.handle(IPC_CHANNELS.GET_GAME_CONTEXT, async () => {
      if (!registry.currentDetectedGame) {
        try { detectCurrentGame(false); } catch (_) {}
      }
      return registry.currentDetectedGame;
    });

    ipcMain.handle(IPC_CHANNELS.SET_AUTO_START, async (_event, enable) => {
      app.setLoginItemSettings({
        openAtLogin: !!enable,
        path: process.execPath
      });
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.GET_AUTO_START, () => app.getLoginItemSettings().openAtLogin);

    ipcMain.handle(IPC_CHANNELS.CAPTURE_SCREENSHOT, async () => {
      try {
        const { desktopCapturer } = require('electron');
        const wasVirtualVisible = registry.overlayWin && !registry.overlayWin.isDestroyed() && registry.overlayVirtualVisible;
        if (wasVirtualVisible) {
          setOverlayVirtualVisible(false);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 1920, height: 1080 }
        });
        if (sources.length === 0) {
          if (wasVirtualVisible) setOverlayVirtualVisible(true);
          return { success: false, error: 'Nincs elérhető képernyő' };
        }
        const primarySource = sources[0];
        const imageData = primarySource.thumbnail.toDataURL();
        if (wasVirtualVisible) setOverlayVirtualVisible(true);
        return { success: true, imageData };
      } catch (err) {
        console.error('[Screenshot] Hiba:', err);
        if (registry.overlayWin && !registry.overlayWin.isDestroyed()) setOverlayVirtualVisible(true);
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle(IPC_CHANNELS.PROCESS_TEXT, async (_event, text, lang, specializationLevel, imageData, gameContext) => {
      return openaiService.processText({ text, lang, specializationLevel, imageData, gameContext });
    });

    ipcMain.handle(IPC_CHANNELS.PROCESS_AUDIO, async (_event, audioBuffer, language = 'hu', specializationLevel = 3) => {
      return openaiService.processAudio({ audioBuffer, language, specializationLevel });
    });

    ipcMain.handle(IPC_CHANNELS.SET_OPENAI_KEY, async (_event, apiKey) => {
      return openaiService.setOpenAIKey(apiKey);
    });

    ipcMain.handle(IPC_CHANNELS.GET_OPENAI_STATUS, async () => {
      return openaiService.getOpenAIStatus();
    });

    ipcMain.handle(IPC_CHANNELS.DELETE_OPENAI_KEY, async () => {
      return openaiService.deleteOpenAIKey();
    });
  }

  return {
    registerIpcHandlers
  };
}

module.exports = {
  createIpcRegistrar
};
