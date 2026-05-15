const { screen } = require('electron');
const { STORAGE_KEYS } = require('../../shared/storage-keys');
const { appendOverlayDebug } = require('./overlay-debug-log');

const DEFAULT_MIN = { width: 120, height: 80 };

function clamp01(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function round4(value) {
  return Math.round(Number(value) * 10000) / 10000;
}

function getDisplayById(displays, id) {
  if (id == null) return null;
  return displays.find((d) => d && d.id === id) || null;
}

function getDisplayForBounds(screenApi, displays, bounds) {
  if (!bounds) return null;
  if (typeof screenApi.getDisplayMatching === 'function') {
    try {
      const matched = screenApi.getDisplayMatching({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.max(1, Math.round(bounds.width || 1)),
        height: Math.max(1, Math.round(bounds.height || 1))
      });
      if (matched) return matched;
    } catch (_) {}
  }
  const centerX = Math.round(bounds.x + Math.max(0, bounds.width || 0) / 2);
  const centerY = Math.round(bounds.y + Math.max(0, bounds.height || 0) / 2);
  try {
    return screenApi.getDisplayNearestPoint({ x: centerX, y: centerY });
  } catch (_) {
    return null;
  }
}

function normalizeRectToWorkArea(bounds, workArea) {
  if (!bounds || !workArea) return null;
  const w = Math.max(1, Number(workArea.width) || 1);
  const h = Math.max(1, Number(workArea.height) || 1);
  const x = (Number(bounds.x) - Number(workArea.x)) / w;
  const y = (Number(bounds.y) - Number(workArea.y)) / h;
  const width = Number(bounds.width) / w;
  const height = Number(bounds.height) / h;

  return {
    x: round4(clamp01(x)),
    y: round4(clamp01(y)),
    width: round4(clamp01(width)),
    height: round4(clamp01(height))
  };
}

function denormalizeRectFromWorkArea(normalized, workArea, minSize) {
  if (!normalized || !workArea) return null;
  const w = Math.max(1, Number(workArea.width) || 1);
  const h = Math.max(1, Number(workArea.height) || 1);
  const minW = Math.max(1, Number(minSize && minSize.width) || DEFAULT_MIN.width);
  const minH = Math.max(1, Number(minSize && minSize.height) || DEFAULT_MIN.height);

  let width = Math.round(clamp01(normalized.width) * w);
  let height = Math.round(clamp01(normalized.height) * h);
  width = Math.max(minW, width);
  height = Math.max(minH, height);
  width = Math.min(width, w);
  height = Math.min(height, h);

  let x = Math.round(Number(workArea.x) + clamp01(normalized.x) * w);
  let y = Math.round(Number(workArea.y) + clamp01(normalized.y) * h);

  x = Math.min(Math.max(x, workArea.x), workArea.x + Math.max(0, w - width));
  y = Math.min(Math.max(y, workArea.y), workArea.y + Math.max(0, h - height));

  return { x, y, width, height };
}

function createWindowLayoutManager(deps) {
  const { registry, screen: injectedScreen } = deps;
  const screenApi = injectedScreen || screen;
  const layoutState = registry.layout;
  let persistTimer = null;
  let lastDebugMapAt = 0;
  const DEBUG_MAP_MIN_INTERVAL_MS = 1200;

  function getDisplays() {
    try {
      return screenApi.getAllDisplays();
    } catch (_) {
      return [];
    }
  }

  function getPrimaryDisplay() {
    try {
      return screenApi.getPrimaryDisplay();
    } catch (_) {
      return null;
    }
  }

  function updateDisplaySnapshot(reason) {
    const displays = getDisplays();
    layoutState.lastDisplaySnapshot = displays.map((d) => ({
      id: d.id,
      bounds: d.bounds,
      workArea: d.workArea,
      scaleFactor: d.scaleFactor,
      rotation: d.rotation,
      isPrimary: d.id === (getPrimaryDisplay() && getPrimaryDisplay().id)
    }));
    layoutState.lastDisplaySnapshotAt = Date.now();
    layoutState.lastDisplaySnapshotReason = reason || 'unknown';
  }

  function rectsOverlap(a, b) {
    if (!a || !b) return false;
    const ax2 = a.x + a.width;
    const ay2 = a.y + a.height;
    const bx2 = b.x + b.width;
    const by2 = b.y + b.height;
    return ax2 > b.x && bx2 > a.x && ay2 > b.y && by2 > a.y;
  }

  function safeBounds(bounds) {
    if (!bounds) return null;
    const x = Number(bounds.x);
    const y = Number(bounds.y);
    const width = Number(bounds.width);
    const height = Number(bounds.height);
    if (![x, y, width, height].every(Number.isFinite)) return null;
    return { x, y, width, height };
  }

  function collectWindowAnchors(displays) {
    const anchors = [];
    const { core, note, info, detached, pinned, blocks } = registry;

    function addAnchor(key, win) {
      if (!win || win.isDestroyed()) return;
      let bounds = null;
      try { bounds = safeBounds(win.getBounds()); } catch (_) { bounds = null; }
      if (!bounds) {
        anchors.push({ key, bounds: null, displayId: null, onScreen: false });
        return;
      }
      const display = getDisplayForBounds(screenApi, displays, bounds);
      const onScreen = displays.some((d) => d && d.workArea && rectsOverlap(d.workArea, bounds));
      anchors.push({
        key,
        bounds,
        displayId: display ? display.id : null,
        onScreen
      });
    }

    addAnchor('overlay', core.overlayWin);
    addAnchor('note-panel', note.notePanelWin);
    addAnchor('info-panel', info.infoPanelWin);

    if (detached.detachedPanelWindows && detached.detachedPanelWindows.size) {
      for (const [panelId, win] of detached.detachedPanelWindows.entries()) {
        addAnchor(`detached:${panelId}`, win);
      }
    }

    if (pinned.pinnedHistoryWindows && pinned.pinnedHistoryWindows.size) {
      for (const [ts, win] of pinned.pinnedHistoryWindows.entries()) {
        addAnchor(`pinned:${ts}`, win);
      }
    }

    if (blocks.detachedBlockWindows && blocks.detachedBlockWindows.size) {
      for (const [blockId, win] of blocks.detachedBlockWindows.entries()) {
        addAnchor(`block:${blockId}`, win);
      }
    }

    return anchors;
  }

  function collectLayoutEntries() {
    const entries = [];
    for (const [key, value] of layoutState.windowLayouts.entries()) {
      if (!value || !value.normalized) continue;
      entries.push({
        key: String(key),
        displayId: value.displayId,
        normalized: value.normalized,
        updatedAt: value.updatedAt || null
      });
    }
    return entries;
  }

  function validateDebugMap(map, displays) {
    const issues = [];
    const displayIds = new Set(displays.map((d) => d && d.id).filter((v) => v != null));

    for (const d of displays) {
      if (!d || !d.bounds || !d.workArea) {
        issues.push({ code: 'display-missing-bounds', displayId: d && d.id });
        continue;
      }
      if (d.bounds.width <= 0 || d.bounds.height <= 0) {
        issues.push({ code: 'display-zero-bounds', displayId: d.id });
      }
      if (d.workArea.width <= 0 || d.workArea.height <= 0) {
        issues.push({ code: 'display-zero-workarea', displayId: d.id });
      }
      if (d.workArea.width > d.bounds.width || d.workArea.height > d.bounds.height) {
        issues.push({ code: 'workarea-larger-than-bounds', displayId: d.id });
      }
    }

    for (const entry of map.layouts) {
      if (entry.displayId != null && !displayIds.has(entry.displayId)) {
        issues.push({ code: 'layout-missing-display', key: entry.key, displayId: entry.displayId });
      }
      const n = entry.normalized || {};
      const vals = [n.x, n.y, n.width, n.height].map((v) => Number(v));
      if (!vals.every(Number.isFinite)) {
        issues.push({ code: 'layout-invalid-normalized', key: entry.key });
        continue;
      }
      const outOfRange = vals.some((v) => v < -0.01 || v > 1.01);
      if (outOfRange) {
        issues.push({ code: 'layout-normalized-out-of-range', key: entry.key, normalized: n });
      }
    }

    for (const anchor of map.windows) {
      if (!anchor.bounds) {
        issues.push({ code: 'window-missing-bounds', key: anchor.key });
        continue;
      }
      if (!anchor.onScreen) {
        issues.push({ code: 'window-offscreen', key: anchor.key, bounds: anchor.bounds });
      }
      if (anchor.displayId == null) {
        issues.push({ code: 'window-no-display-match', key: anchor.key, bounds: anchor.bounds });
      }
    }

    const lastGameDisplayId = registry.game && registry.game.lastKnownGameDisplayId;
    if (lastGameDisplayId != null && !displayIds.has(lastGameDisplayId)) {
      issues.push({ code: 'game-display-missing', displayId: lastGameDisplayId });
    }

    return issues;
  }

  function logDisplayDebugMap(reason) {
    const now = Date.now();
    if ((now - lastDebugMapAt) < DEBUG_MAP_MIN_INTERVAL_MS) return;
    lastDebugMapAt = now;
    const map = buildDisplayDebugMap(reason || 'unknown');
    if (!map) return;
    appendOverlayDebug(map);
  }

  function buildDisplayDebugMap(reason) {
    const displays = getDisplays();
    const windows = collectWindowAnchors(displays);
    const layouts = collectLayoutEntries();
    const issues = validateDebugMap({ windows, layouts }, displays);
    return {
      t: new Date().toISOString(),
      event: 'display-debug-map',
      reason: reason || 'manual',
      summary: {
        displayCount: displays.length,
        windowCount: windows.length,
        layoutCount: layouts.length,
        issuesCount: issues.length
      },
      displays: displays.map((d) => ({
        id: d.id,
        bounds: d.bounds,
        workArea: d.workArea,
        scaleFactor: d.scaleFactor,
        rotation: d.rotation,
        isPrimary: d.id === (getPrimaryDisplay() && getPrimaryDisplay().id)
      })),
      windows,
      layouts,
      issues
    };
  }

  function getDisplayDebugMap(reason) {
    try {
      return buildDisplayDebugMap(reason || 'ipc');
    } catch (_) {
      return null;
    }
  }

  function serializeLayouts() {
    const entries = {};
    for (const [key, value] of layoutState.windowLayouts.entries()) {
      if (!value || !value.normalized) continue;
      entries[String(key)] = {
        displayId: value.displayId,
        normalized: value.normalized,
        updatedAt: value.updatedAt || Date.now()
      };
    }
    return { version: 1, entries };
  }

  function applySerializedLayouts(payload) {
    if (!payload || typeof payload !== 'object') return;
    const entries = payload.entries && typeof payload.entries === 'object' ? payload.entries : null;
    if (!entries) return;
    layoutState.windowLayouts.clear();
    for (const [key, value] of Object.entries(entries)) {
      if (!value || !value.normalized) continue;
      layoutState.windowLayouts.set(String(key), {
        displayId: value.displayId,
        normalized: value.normalized,
        updatedAt: value.updatedAt || Date.now()
      });
    }
  }

  function persistLayoutsToStorage() {
    try {
      const win = registry.core && registry.core.overlayWin;
      if (!win || win.isDestroyed()) return;
      const payload = serializeLayouts();
      const json = JSON.stringify(payload);
      const script = `(() => { try { localStorage.setItem(${JSON.stringify(STORAGE_KEYS.WINDOW_LAYOUTS)}, ${JSON.stringify(json)}); return true; } catch (_) { return false; } })()`;
      win.webContents.executeJavaScript(script, true).catch(() => {});
    } catch (_) {}
  }

  function schedulePersistLayouts() {
    if (persistTimer) return;
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persistLayoutsToStorage();
    }, 350);
  }

  async function loadLayoutsFromStorage() {
    const win = registry.core && registry.core.overlayWin;
    if (!win || win.isDestroyed()) return;
    let raw = null;
    try {
      const script = `(() => { try { return {
        layouts: localStorage.getItem(${JSON.stringify(STORAGE_KEYS.WINDOW_LAYOUTS)}),
        overlayX: localStorage.getItem(${JSON.stringify(STORAGE_KEYS.OVERLAY_POSITION_X)}),
        overlayY: localStorage.getItem(${JSON.stringify(STORAGE_KEYS.OVERLAY_POSITION_Y)}),
        overlayW: localStorage.getItem('overlayWidth'),
        overlayH: localStorage.getItem('overlayHeight'),
        overlayBounds: localStorage.getItem('overlayBounds'),
        noteBounds: localStorage.getItem(${JSON.stringify(STORAGE_KEYS.NOTE_PANEL_BOUNDS)}),
        infoBounds: localStorage.getItem('infoPanelBounds'),
        pinnedHistory: localStorage.getItem(${JSON.stringify(STORAGE_KEYS.PINNED_HISTORY)}),
        detachedBounds: localStorage.getItem('detachedPanelBounds'),
        blockBounds: localStorage.getItem('blockWindowBounds')
      }; } catch (_) { return {}; } })()`;
      raw = await win.webContents.executeJavaScript(script, true);
    } catch (_) {
      raw = null;
    }

    let migrated = false;
    let loaded = false;

    function parseBoundsCandidate(value) {
      let parsed = value;
      if (typeof value === 'string') {
        try { parsed = JSON.parse(value); } catch (_) { parsed = null; }
      }
      if (!parsed || typeof parsed !== 'object') return null;
      const x = Number(parsed.x);
      const y = Number(parsed.y);
      const width = Number(parsed.width);
      const height = Number(parsed.height);
      if (![x, y, width, height].every(Number.isFinite)) return null;
      return { x, y, width, height };
    }

    if (raw && raw.layouts) {
      try {
        const parsed = JSON.parse(raw.layouts);
        applySerializedLayouts(parsed);
        loaded = true;
        layoutState.loadedFromStorage = true;
        return true;
      } catch (_) {}
    }

    const overlayX = raw && raw.overlayX != null ? Number(raw.overlayX) : null;
    const overlayY = raw && raw.overlayY != null ? Number(raw.overlayY) : null;
    const overlayBounds = raw && raw.overlayBounds ? parseBoundsCandidate(raw.overlayBounds) : null;
    if (overlayBounds && win && !win.isDestroyed()) {
      try {
        captureWindowLayout('overlay', overlayBounds);
        migrated = true;
      } catch (_) {}
    } else if (Number.isFinite(overlayX) && Number.isFinite(overlayY) && win && !win.isDestroyed()) {
      try {
        const b = win.getBounds();
        const overlayW = raw && raw.overlayW != null ? Number(raw.overlayW) : b.width;
        const overlayH = raw && raw.overlayH != null ? Number(raw.overlayH) : b.height;
        const width = Number.isFinite(overlayW) ? overlayW : b.width;
        const height = Number.isFinite(overlayH) ? overlayH : b.height;
        captureWindowLayout('overlay', { x: overlayX, y: overlayY, width, height });
        migrated = true;
      } catch (_) {}
    }

    if (raw && raw.noteBounds) {
      try {
        const note = parseBoundsCandidate(raw.noteBounds);
        if (note) {
          captureWindowLayout('note-panel', note);
          migrated = true;
        }
      } catch (_) {}
    }

    if (raw && raw.infoBounds) {
      try {
        const info = parseBoundsCandidate(raw.infoBounds);
        if (info) {
          captureWindowLayout('info-panel', info);
          migrated = true;
        }
      } catch (_) {}
    }

    if (raw && raw.pinnedHistory) {
      try {
        const list = JSON.parse(raw.pinnedHistory);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (!item || !Number.isFinite(item.ts)) continue;
            if (!Number.isFinite(item.x) || !Number.isFinite(item.y) || !Number.isFinite(item.width) || !Number.isFinite(item.height)) {
              continue;
            }
            captureWindowLayout(`pinned:${item.ts}`, {
              x: item.x,
              y: item.y,
              width: item.width,
              height: item.height
            });
            migrated = true;
          }
        }
      } catch (_) {}
    }

    if (raw && raw.detachedBounds) {
      try {
        const parsed = JSON.parse(raw.detachedBounds);
        if (parsed && typeof parsed === 'object') {
          for (const [panelId, bounds] of Object.entries(parsed)) {
            const entry = parseBoundsCandidate(bounds);
            if (!entry) continue;
            captureWindowLayout(`detached:${panelId}`, entry);
            migrated = true;
          }
        }
      } catch (_) {}
    }

    if (raw && raw.blockBounds) {
      try {
        const parsed = JSON.parse(raw.blockBounds);
        if (parsed && typeof parsed === 'object') {
          for (const [blockId, bounds] of Object.entries(parsed)) {
            const entry = parseBoundsCandidate(bounds);
            if (!entry) continue;
            captureWindowLayout(`block:${blockId}`, entry);
            migrated = true;
          }
        }
      } catch (_) {}
    }

    if (migrated) {
      persistLayoutsToStorage();
      try {
        appendOverlayDebug({
          t: new Date().toISOString(),
          event: 'layout-migration',
          migratedKeys: {
            overlay: !!(overlayBounds || (Number.isFinite(overlayX) && Number.isFinite(overlayY))),
            note: !!raw.noteBounds,
            info: !!raw.infoBounds,
            pinned: !!raw.pinnedHistory,
            detached: !!raw.detachedBounds,
            block: !!raw.blockBounds
          }
        });
      } catch (_) {}
    }
    layoutState.loadedFromStorage = true;
    return loaded || migrated;
  }

  function getMinSizeForKey(key) {
    const id = String(key || '');
    if (id === 'overlay') return { width: 380, height: 60 };
    if (id === 'note-panel' || id === 'info-panel') return { width: 240, height: 140 };
    if (id.startsWith('detached:')) return { width: 200, height: 120 };
    if (id.startsWith('block:')) return { width: 260, height: 160 };
    if (id.startsWith('pinned:')) return { width: 240, height: 140 };
    return DEFAULT_MIN;
  }

  function captureWindowLayout(key, bounds) {
    if (!key || !bounds) return null;
    const displays = getDisplays();
    const display = getDisplayForBounds(screenApi, displays, bounds) || getPrimaryDisplay();
    if (!display || !display.workArea) return null;

    const normalized = normalizeRectToWorkArea(bounds, display.workArea);
    if (!normalized) return null;

    const entry = {
      displayId: display.id,
      normalized,
      updatedAt: Date.now()
    };
    layoutState.windowLayouts.set(String(key), entry);
    schedulePersistLayouts();
    return entry;
  }

  function resolveLayoutBounds(key, fallbackBounds) {
    const entry = layoutState.windowLayouts.get(String(key));
    if (!entry || !entry.normalized) return null;
    const displays = getDisplays();
    let display = entry ? getDisplayById(displays, entry.displayId) : null;

    if (!display && fallbackBounds) {
      display = getDisplayForBounds(screenApi, displays, fallbackBounds);
    }

    if (!display) {
      display = getPrimaryDisplay();
    }

    if (!display || !display.workArea) return null;

    return denormalizeRectFromWorkArea(entry.normalized, display.workArea, getMinSizeForKey(key));
  }

  function reflowWindow(key, win) {
    if (!win || win.isDestroyed()) return;
    let bounds = null;
    try { bounds = win.getBounds(); } catch (_) { bounds = null; }
    if (!layoutState.windowLayouts.get(String(key)) && bounds) {
      captureWindowLayout(key, bounds);
    }
    const target = resolveLayoutBounds(key, bounds || null);
    if (!target) return;
    try {
      win.setBounds(target);
      captureWindowLayout(key, target);
    } catch (_) {}
  }

  function reflowAllWindows() {
    const { core, note, info, detached, pinned, blocks } = registry;

    if (core.overlayWin && !core.overlayWin.isDestroyed()) {
      reflowWindow('overlay', core.overlayWin);
    }

    if (note.notePanelWin && !note.notePanelWin.isDestroyed()) {
      reflowWindow('note-panel', note.notePanelWin);
    }

    if (info.infoPanelWin && !info.infoPanelWin.isDestroyed()) {
      reflowWindow('info-panel', info.infoPanelWin);
    }

    if (detached.detachedPanelWindows && detached.detachedPanelWindows.size) {
      for (const [panelId, win] of detached.detachedPanelWindows.entries()) {
        reflowWindow(`detached:${panelId}`, win);
      }
    }

    if (pinned.pinnedHistoryWindows && pinned.pinnedHistoryWindows.size) {
      for (const [ts, win] of pinned.pinnedHistoryWindows.entries()) {
        reflowWindow(`pinned:${ts}`, win);
      }
    }

    if (blocks.detachedBlockWindows && blocks.detachedBlockWindows.size) {
      for (const [blockId, win] of blocks.detachedBlockWindows.entries()) {
        reflowWindow(`block:${blockId}`, win);
      }
    }
  }

  return {
    updateDisplaySnapshot,
    captureWindowLayout,
    reflowAllWindows,
    resolveLayoutBounds,
    loadLayoutsFromStorage,
    logDisplayDebugMap,
    getDisplayDebugMap
  };
}

module.exports = {
  createWindowLayoutManager
};
