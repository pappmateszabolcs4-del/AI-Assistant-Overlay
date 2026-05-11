const { screen } = require('electron');
const { STORAGE_KEYS } = require('../../shared/storage-keys');

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
        noteBounds: localStorage.getItem(${JSON.stringify(STORAGE_KEYS.NOTE_PANEL_BOUNDS)}),
        pinnedHistory: localStorage.getItem(${JSON.stringify(STORAGE_KEYS.PINNED_HISTORY)})
      }; } catch (_) { return {}; } })()`;
      raw = await win.webContents.executeJavaScript(script, true);
    } catch (_) {
      raw = null;
    }

    let migrated = false;
    let loaded = false;

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
    if (Number.isFinite(overlayX) && Number.isFinite(overlayY) && win && !win.isDestroyed()) {
      try {
        const b = win.getBounds();
        captureWindowLayout('overlay', { x: overlayX, y: overlayY, width: b.width, height: b.height });
        migrated = true;
      } catch (_) {}
    }

    if (raw && raw.noteBounds) {
      try {
        const note = JSON.parse(raw.noteBounds);
        if (note && Number.isFinite(note.x) && Number.isFinite(note.y) && Number.isFinite(note.width) && Number.isFinite(note.height)) {
          captureWindowLayout('note-panel', note);
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

    if (migrated) {
      persistLayoutsToStorage();
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
    loadLayoutsFromStorage
  };
}

module.exports = {
  createWindowLayoutManager
};
