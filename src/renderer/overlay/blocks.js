// Movable blocks manager.

const BLOCK_LAYOUTS_KEY = STORAGE_KEYS.BLOCK_LAYOUTS;
const BLOCK_FREE_LAYOUT_KEY = STORAGE_KEYS.BLOCK_FREE_LAYOUT;
const LEGACY_FREE_LAYOUT_KEY = 'overlayWidgetCompositionMode';
const __skipBlocksManager = (typeof __isBlockWindow !== 'undefined' && __isBlockWindow)
  || (typeof __isDetachedPanelWindow !== 'undefined' && __isDetachedPanelWindow);

const BLOCKS = [
  { id: 'ask-main', home: 'ask', elementId: 'block-ask-main', titleKey: 'tabAsk' },
  { id: 'game-template', home: 'ask', elementId: 'block-game-template', titleKey: 'gameTemplateLabel' },
  { id: 'history-list', home: 'history', elementId: 'block-history-list', titleKey: 'history' },
  { id: 'history-actions', home: 'history', elementId: 'block-history-actions', titleKey: 'clearHistory' },
  { id: 'spec', home: 'settings', elementId: 'block-spec', titleKey: 'specializationLabel' },
  { id: 'tts', home: 'settings', elementId: 'block-tts', titleKey: 'ttsLabel' },
  { id: 'data', home: 'settings', elementId: 'block-data', titleKey: 'dataLabel' },
  { id: 'game-ignore', home: 'settings', elementId: 'block-game-ignore', titleKey: 'gameIgnoreLabel' },
  { id: 'layout', home: 'settings', elementId: 'block-layout', titleKey: 'layoutMode' },
  { id: 'note', home: 'settings', elementId: 'block-note', titleKey: 'notePanelBtn' },
  { id: 'free-layout', home: 'settings', elementId: 'block-free-layout', titleKey: 'compositionModeLabel' },
  { id: 'version', home: 'settings', elementId: 'block-version', titleKey: 'versionLabel' }
];

const blockShelves = new Map();
const blockStash = document.getElementById('block-stash');
const dragState = { blockId: null, targetPanel: null, pointerId: null, insertBeforeId: null };
let externalDropPanel = null;

function getBlockShelves() {
  if (blockShelves.size) return blockShelves;
  document.querySelectorAll('.block-shelf[data-panel]').forEach((shelf) => {
    const panelId = String(shelf.getAttribute('data-panel') || '').toLowerCase();
    if (panelId) blockShelves.set(panelId, shelf);
  });
  return blockShelves;
}

function getBlockMeta(blockId) {
  return BLOCKS.find((b) => b.id === blockId) || null;
}

function getBlockElement(blockId) {
  const meta = getBlockMeta(blockId);
  if (!meta) return null;
  return document.getElementById(meta.elementId);
}

function buildDefaultLayouts() {
  const order = { ask: [], history: [], settings: [] };
  const blocks = {};
  BLOCKS.forEach((block) => {
    if (!order[block.home]) order[block.home] = [];
    order[block.home].push(block.id);
    blocks[block.id] = { location: `panel:${block.home}`, lastPanel: block.home };
  });
  return { order, blocks };
}

function readLayouts() {
  try {
    const raw = localStorage.getItem(BLOCK_LAYOUTS_KEY);
    if (!raw) return buildDefaultLayouts();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return buildDefaultLayouts();
    const layouts = {
      order: parsed.order && typeof parsed.order === 'object' ? parsed.order : {},
      blocks: parsed.blocks && typeof parsed.blocks === 'object' ? parsed.blocks : {}
    };
    return normalizeLayouts(layouts);
  } catch (_) {
    return buildDefaultLayouts();
  }
}

function normalizeLayouts(layouts) {
  const next = layouts && typeof layouts === 'object' ? layouts : buildDefaultLayouts();
  if (!next.order || typeof next.order !== 'object') next.order = {};
  if (!next.blocks || typeof next.blocks !== 'object') next.blocks = {};

  const defaultOrder = buildDefaultLayouts().order;
  ['ask', 'history', 'settings'].forEach((panelId) => {
    const list = Array.isArray(next.order[panelId]) ? next.order[panelId] : [];
    const unique = [];
    list.forEach((id) => {
      if (!unique.includes(id)) unique.push(id);
    });
    next.order[panelId] = unique;
  });

  BLOCKS.forEach((block) => {
    const entry = next.blocks[block.id] && typeof next.blocks[block.id] === 'object'
      ? next.blocks[block.id]
      : {};
    let location = entry.location;
    if (typeof location !== 'string') location = `panel:${block.home}`;
    if (!location.startsWith('panel:') && location !== 'detached') {
      location = `panel:${block.home}`;
    }
    let lastPanel = entry.lastPanel;
    if (typeof lastPanel !== 'string') lastPanel = block.home;
    next.blocks[block.id] = { location, lastPanel };
  });

  ['ask', 'history', 'settings'].forEach((panelId) => {
    const order = next.order[panelId];
    const defaults = defaultOrder[panelId] || [];
    defaults.forEach((id) => {
      if (!order.includes(id)) order.push(id);
    });
  });

  return next;
}

function writeLayouts(layouts) {
  try {
    localStorage.setItem(BLOCK_LAYOUTS_KEY, JSON.stringify(layouts || {}));
  } catch (_) {}
}

function migrateLegacyFreeLayout() {
  try {
    const raw = localStorage.getItem(BLOCK_FREE_LAYOUT_KEY);
    if (raw !== null) return;
    const legacy = localStorage.getItem(LEGACY_FREE_LAYOUT_KEY);
    if (legacy === null) return;
    localStorage.setItem(BLOCK_FREE_LAYOUT_KEY, legacy);
    localStorage.removeItem(LEGACY_FREE_LAYOUT_KEY);
  } catch (_) {}
}

function getFreeLayoutMode() {
  migrateLegacyFreeLayout();
  try {
    const raw = localStorage.getItem(BLOCK_FREE_LAYOUT_KEY);
    if (raw !== null) return raw === 'true';
  } catch (_) {}
  return false;
}

function setFreeLayoutMode(next) {
  try { localStorage.setItem(BLOCK_FREE_LAYOUT_KEY, next ? 'true' : 'false'); } catch (_) {}
  try { localStorage.setItem(LEGACY_FREE_LAYOUT_KEY, next ? 'true' : 'false'); } catch (_) {}
}

function canDockToPanel(blockId, targetPanel) {
  const meta = getBlockMeta(blockId);
  if (!meta) return false;
  if (getFreeLayoutMode()) return true;
  return meta.home === targetPanel;
}

function clearDropTargets() {
  getBlockShelves().forEach((shelf) => shelf.classList.remove('block-drop-target'));
  document.querySelectorAll('.section-content.block-drop-target').forEach((content) => {
    content.classList.remove('block-drop-target');
  });
  dragState.targetPanel = null;
  dragState.insertBeforeId = null;
}

function clearExternalDropTargets() {
  getBlockShelves().forEach((shelf) => shelf.classList.remove('block-drop-target'));
  document.querySelectorAll('.section-content.block-drop-target').forEach((content) => {
    content.classList.remove('block-drop-target');
  });
  externalDropPanel = null;
}

function applyExternalDropTarget(panelId) {
  clearExternalDropTargets();
  if (!panelId) return;
  const shelf = getBlockShelves().get(panelId);
  if (shelf) shelf.classList.add('block-drop-target');
  const content = getPanelContentEl(panelId);
  if (content) content.classList.add('block-drop-target');
  externalDropPanel = panelId;
}

function getPanelContentEl(panelId) {
  const contents = document.querySelectorAll('.section-content');
  for (const content of contents) {
    const homeSection = content.__homeSection || content.closest('.collapsible-section[data-panel]');
    if (!homeSection) continue;
    const id = String(homeSection.getAttribute('data-panel') || '').toLowerCase();
    if (id && id === panelId) return content;
  }
  return null;
}

function findPanelIdFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const content = el.closest ? el.closest('.section-content') : null;
  if (content) {
    const homeSection = content.__homeSection || content.closest('.collapsible-section[data-panel]');
    if (homeSection) {
      return String(homeSection.getAttribute('data-panel') || '').toLowerCase() || null;
    }
  }
  const shelf = el.closest ? el.closest('.block-shelf[data-panel]') : null;
  if (shelf) {
    return String(shelf.getAttribute('data-panel') || '').toLowerCase() || null;
  }
  const sections = document.querySelectorAll('.collapsible-section[data-panel]');
  for (const section of sections) {
    const rect = section.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return String(section.getAttribute('data-panel') || '').toLowerCase() || null;
    }
  }
  return null;
}

function findInsertBeforeId(panelId, clientY) {
  const shelf = getBlockShelves().get(panelId);
  if (!shelf) return null;
  const items = Array.from(shelf.querySelectorAll('.block-item'))
    .filter((el) => !el.classList.contains('block-hidden'));
  for (const item of items) {
    const rect = item.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (clientY < mid) return item.dataset.blockId || null;
  }
  return null;
}

function openBlockWindow(blockId, bounds) {
  if (__isDetachedPanelWindow) return;
  try { invokeMain(IPC_CHANNELS.BLOCK_WINDOW_OPEN, { blockId, bounds }); } catch (_) {}
}

function closeBlockWindow(blockId) {
  if (__isDetachedPanelWindow) return;
  try { invokeMain(IPC_CHANNELS.BLOCK_WINDOW_CLOSE, { blockId }); } catch (_) {}
}

function applyLayouts() {
  if (__skipBlocksManager) return;
  const layouts = readLayouts();
  const shelves = getBlockShelves();

  ['ask', 'history', 'settings'].forEach((panelId) => {
    const shelf = shelves.get(panelId);
    if (!shelf) return;
    const order = Array.isArray(layouts.order[panelId]) ? layouts.order[panelId] : [];
    const ids = [];
    order.forEach((id) => {
      const meta = getBlockMeta(id);
      if (!meta) return;
      const location = layouts.blocks[id] && layouts.blocks[id].location;
      if (location === `panel:${panelId}`) ids.push(id);
    });
    BLOCKS.forEach((block) => {
      const location = layouts.blocks[block.id] && layouts.blocks[block.id].location;
      if (location === `panel:${panelId}` && !ids.includes(block.id)) ids.push(block.id);
    });

    ids.forEach((id) => {
      const el = getBlockElement(id);
      if (!el) return;
      el.classList.remove('block-hidden');
      shelf.appendChild(el);
    });
  });

  BLOCKS.forEach((block) => {
    const el = getBlockElement(block.id);
    if (!el) return;
    const entry = layouts.blocks[block.id];
    const location = entry && entry.location;
    if (location === 'detached') {
      el.classList.add('block-hidden');
      if (blockStash) blockStash.appendChild(el);
      openBlockWindow(block.id, entry && entry.bounds ? entry.bounds : null);
    } else {
      el.classList.remove('block-hidden');
      closeBlockWindow(block.id);
    }
  });

  writeLayouts(layouts);
  initDragHandles();
  clearExternalDropTargets();
  try { window.__applyGameTemplateDraftFromStorage && window.__applyGameTemplateDraftFromStorage(); } catch (_) {}
}

function ensureDragHandle(blockId, el) {
  if (!el || el.querySelector('.block-drag-handle')) return;
  el.dataset.blockId = blockId;
  el.classList.add('has-drag-handle');
  const handle = document.createElement('div');
  handle.className = 'block-drag-handle';
  handle.setAttribute('role', 'button');
  handle.setAttribute('aria-label', 'Drag block');

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    dragState.blockId = blockId;
    dragState.pointerId = event.pointerId;
    el.classList.add('block-dragging');
    try { window.__pushForceInteractive && window.__pushForceInteractive(); } catch (_) {}
    try { window.__holdInteractive && window.__holdInteractive(1500); } catch (_) {}
    try { handle.setPointerCapture(event.pointerId); } catch (_) {}
    event.preventDefault();
  });

  handle.addEventListener('pointermove', (event) => {
    if (!dragState.blockId || dragState.pointerId !== event.pointerId) return;
    try { window.__holdInteractive && window.__holdInteractive(600); } catch (_) {}
    const panelId = findPanelIdFromPoint(event.clientX, event.clientY);
    if (panelId !== dragState.targetPanel) {
      clearDropTargets();
      if (panelId) {
        const shelf = getBlockShelves().get(panelId);
        if (shelf) shelf.classList.add('block-drop-target');
        const content = getPanelContentEl(panelId);
        if (content) content.classList.add('block-drop-target');
        dragState.targetPanel = panelId;
      }
    }
    dragState.insertBeforeId = panelId ? findInsertBeforeId(panelId, event.clientY) : null;
  });

  function endPointerDrag(event) {
    if (!dragState.blockId || dragState.pointerId !== event.pointerId) return;
    const layouts = readLayouts();
    const blockIdLocal = dragState.blockId;
    try {
      if (blockIdLocal === 'game-template') {
        window.__saveGameTemplateDraftFromUi && window.__saveGameTemplateDraftFromUi();
      }
    } catch (_) {}
    const targetPanel = dragState.targetPanel || findPanelIdFromPoint(event.clientX, event.clientY);

    if (targetPanel && canDockToPanel(blockIdLocal, targetPanel)) {
      const entry = layouts.blocks[blockIdLocal] || {};
      entry.location = `panel:${targetPanel}`;
      entry.lastPanel = targetPanel;
      layouts.blocks[blockIdLocal] = entry;

      ['ask', 'history', 'settings'].forEach((panelId) => {
        const list = Array.isArray(layouts.order[panelId]) ? layouts.order[panelId] : [];
        layouts.order[panelId] = list.filter((id) => id !== blockIdLocal);
      });

      const order = Array.isArray(layouts.order[targetPanel]) ? layouts.order[targetPanel] : [];
      const insertBefore = dragState.insertBeforeId;
      if (insertBefore && order.includes(insertBefore)) {
        const idx = order.indexOf(insertBefore);
        order.splice(idx, 0, blockIdLocal);
      } else {
        order.push(blockIdLocal);
      }
      layouts.order[targetPanel] = order;
    } else {
      const entry = layouts.blocks[blockIdLocal] || {};
      if (!entry.lastPanel) {
        const meta = getBlockMeta(blockIdLocal);
        entry.lastPanel = meta ? meta.home : 'settings';
      }
      entry.location = 'detached';
      layouts.blocks[blockIdLocal] = entry;

      const el = getBlockElement(blockIdLocal);
      if (el) {
        const rect = el.getBoundingClientRect();
        const bounds = {
          x: Math.round(window.screenX + rect.left),
          y: Math.round(window.screenY + rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
        entry.bounds = bounds;
      }
    }

    writeLayouts(layouts);
    applyLayouts();

    dragState.blockId = null;
    dragState.pointerId = null;
    clearDropTargets();
    el.classList.remove('block-dragging');
    try { window.__popForceInteractive && window.__popForceInteractive(); } catch (_) {}
    try { handle.releasePointerCapture(event.pointerId); } catch (_) {}
  }

  handle.addEventListener('pointerup', endPointerDrag);
  handle.addEventListener('pointercancel', endPointerDrag);

  el.appendChild(handle);
}

function initDragHandles() {
  BLOCKS.forEach((block) => {
    const el = getBlockElement(block.id);
    if (el) ensureDragHandle(block.id, el);
  });
}

function initFreeLayoutToggle() {
  if (__skipBlocksManager) return;
  const toggle = document.getElementById('freeLayoutToggle');
  if (!toggle) return;
  toggle.checked = getFreeLayoutMode();
  on(toggle, 'change', () => {
    setFreeLayoutMode(toggle.checked);
    applyLayouts();
  });
}

window.addEventListener('storage', (ev) => {
  if (__skipBlocksManager) return;
  if (!ev || !ev.key) return;
  if (ev.key === BLOCK_LAYOUTS_KEY || ev.key === BLOCK_FREE_LAYOUT_KEY || ev.key === LEGACY_FREE_LAYOUT_KEY) {
    applyLayouts();
  }
});

if (!__skipBlocksManager) {
  ipcRenderer.on(IPC_CHANNELS.REQUEST_BLOCK_DROP_RECTS, (_event, requestId) => {
    const rects = [];
    const offX = window.screenX;
    const offY = window.screenY;
    document.querySelectorAll('.collapsible-section[data-panel]').forEach((section) => {
      const panelId = String(section.getAttribute('data-panel') || '').toLowerCase();
      if (!panelId) return;
      const header = section.querySelector('.section-header');
      if (header) {
        const r = header.getBoundingClientRect();
        rects.push({ panelId, left: offX + r.left, top: offY + r.top, right: offX + r.right, bottom: offY + r.bottom });
      }
      const content = section.__floatingContent || section.querySelector('.section-content');
      if (content && content.classList.contains('open')) {
        const r = content.getBoundingClientRect();
        rects.push({ panelId, left: offX + r.left, top: offY + r.top, right: offX + r.right, bottom: offY + r.bottom });
      }
    });
    ipcRenderer.send(IPC_CHANNELS.RESPONSE_BLOCK_DROP_RECTS, requestId, rects);
  });

  ipcRenderer.on(IPC_CHANNELS.BLOCK_WINDOW_DROP_PREVIEW, (_event, payload) => {
    if (!payload || !payload.panelId) {
      clearExternalDropTargets();
      return;
    }
    const panelId = String(payload.panelId || '').toLowerCase();
    if (panelId && panelId !== externalDropPanel) {
      applyExternalDropTarget(panelId);
    }
  });
}

initFreeLayoutToggle();
applyLayouts();

window.__applyBlockLayouts = applyLayouts;
