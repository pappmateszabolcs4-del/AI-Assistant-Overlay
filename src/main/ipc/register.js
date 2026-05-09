const { PANEL_IDS } = require('../../shared/panels');
const { IPC_CHANNELS } = require('../../shared/ipc-channels');
const { registerOverlayIpc } = require('./overlay-ipc');
const { registerDetachedIpc } = require('./detached-ipc');
const { registerPinnedIpc } = require('./pinned-ipc');
const { registerNoteIpc } = require('./note-ipc');
const { registerInfoIpc } = require('./info-ipc');
const { registerOpenAiIpc } = require('./openai-ipc');

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
        ipcMain.removeListener(IPC_CHANNELS.RESPONSE_HISTORY_DROP_RECTS, onResponse);
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
        ipcMain.removeListener(IPC_CHANNELS.RESPONSE_PANEL_DOCK_RECTS, onResponse);
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

    registerOverlayIpc({
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
      openaiService,
      setCurrentLanguage,
      getCurrentLanguage,
      setCurrentSpeechRate,
      isCursorInsideOverlayChildWindow,
      stopOverlayMouseForwardGate,
      startOverlayMouseForwardGate,
      createOverlayWindow
    });

    registerDetachedIpc({
      ipcMain,
      BrowserWindow,
      screen,
      registry,
      clampWindowToWorkArea,
      normalizePanelId,
      createDetachedPanelWindow,
      sendDetachedPanelsStateToOverlay,
      deactivateDetachedPanelWindow,
      closeAllDetachedPanelWindows,
      startDetachedSelfHealPulse,
      getDockTargetPanelIdAtScreenPoint
    });

    registerPinnedIpc({
      ipcMain,
      BrowserWindow,
      registry,
      clampWindowToWorkArea,
      createPinnedHistoryWindow,
      closeAllPinnedHistoryWindows,
      shouldUnpinAtScreenPoint
    });

    registerNoteIpc({
      ipcMain,
      BrowserWindow,
      registry,
      clampWindowToWorkArea,
      notePanel
    });

    registerInfoIpc({
      ipcMain,
      BrowserWindow,
      registry,
      clampWindowToWorkArea,
      infoPanel
    });

    registerOpenAiIpc({
      ipcMain,
      openaiService
    });
  }

  return {
    registerIpcHandlers
  };
}

module.exports = {
  createIpcRegistrar
};
