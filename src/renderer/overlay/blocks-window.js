// Block window UI (role=block).

(function initBlockWindow() {
  if (typeof __isBlockWindow === 'undefined' || !__isBlockWindow) return;

  try {
    document.body.classList.add('block-mode');
    document.body.style.overflow = 'hidden';
  } catch (_) {}

  try {
    const savedLang = localStorage.getItem(STORAGE_KEYS.OVERLAY_LANGUAGE);
    if (typeof setLanguage === 'function') {
      setLanguage(savedLang || 'en');
    }
  } catch (_) {}

  const params = new URLSearchParams(window.location.search || '');
  const blockId = (params.get('block') || '').toLowerCase();
  if (!blockId) return;

  const BLOCK_LAYOUTS_KEY = STORAGE_KEYS.BLOCK_LAYOUTS;
  const BLOCK_FREE_LAYOUT_KEY = STORAGE_KEYS.BLOCK_FREE_LAYOUT;
  const LEGACY_FREE_LAYOUT_KEY = 'overlayWidgetCompositionMode';

  function readLayouts() {
    try {
      const raw = localStorage.getItem(BLOCK_LAYOUTS_KEY);
      if (!raw) return { order: {}, blocks: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return { order: {}, blocks: {} };
      return parsed;
    } catch (_) {
      return { order: {}, blocks: {} };
    }
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

  function canDockToPanel(panelId) {
    if (!panelId) return false;
    if (getFreeLayoutMode()) return true;
    const home = (blockEl && blockEl.getAttribute('data-block-home')) || 'settings';
    return panelId === String(home).toLowerCase();
  }

  function writeLayouts(layouts) {
    try {
      localStorage.setItem(BLOCK_LAYOUTS_KEY, JSON.stringify(layouts || {}));
    } catch (_) {}
  }

  function getBlockTitle(el) {
    if (!el) return 'Block';
    const key = el.getAttribute('data-block-title-key');
    const fallback = el.getAttribute('data-block-title') || blockId;
    if (!key) return fallback;
    try {
      const label = t()[key];
      return label || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function restoreBlockToPanel() {
    const layouts = readLayouts();
    const blocks = layouts.blocks && typeof layouts.blocks === 'object' ? layouts.blocks : {};
    const entry = blocks[blockId] && typeof blocks[blockId] === 'object' ? blocks[blockId] : {};
    const lastPanel = entry.lastPanel || (blockEl && blockEl.getAttribute('data-block-home')) || 'settings';
    entry.location = `panel:${lastPanel}`;
    entry.lastPanel = lastPanel;
    blocks[blockId] = entry;
    layouts.blocks = blocks;
    writeLayouts(layouts);
  }

  async function tryDockAtScreenPoint(screenX, screenY) {
    let res = null;
    try {
      res = await invokeMain(IPC_CHANNELS.BLOCK_WINDOW_DROP_TARGET, {
        pointerScreenX: Math.round(screenX),
        pointerScreenY: Math.round(screenY)
      });
    } catch (_) {
      res = null;
    }

    const panelId = res && res.panelId ? String(res.panelId).toLowerCase() : '';
    if (!panelId || !canDockToPanel(panelId)) return false;

    const layouts = readLayouts();
    const blocks = layouts.blocks && typeof layouts.blocks === 'object' ? layouts.blocks : {};
    const order = layouts.order && typeof layouts.order === 'object' ? layouts.order : {};
    const entry = blocks[blockId] && typeof blocks[blockId] === 'object' ? blocks[blockId] : {};
    entry.location = `panel:${panelId}`;
    entry.lastPanel = panelId;
    blocks[blockId] = entry;
    layouts.blocks = blocks;

    Object.keys(order).forEach((pid) => {
      order[pid] = Array.isArray(order[pid]) ? order[pid].filter((id) => id !== blockId) : [];
    });
    if (!Array.isArray(order[panelId])) order[panelId] = [];
    if (!order[panelId].includes(blockId)) order[panelId].push(blockId);
    layouts.order = order;

    writeLayouts(layouts);
    return true;
  }

  const blockEl = document.querySelector(`.block-item[data-block-id="${blockId}"]`);

  const shell = document.createElement('div');
  shell.className = 'block-window';
  shell.id = 'blockWindow';

  const header = document.createElement('div');
  header.className = 'block-window-header';

  const title = document.createElement('div');
  title.className = 'block-window-title';
  title.textContent = getBlockTitle(blockEl);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'block-window-close';
  closeBtn.type = 'button';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => {
    restoreBlockToPanel();
    try { invokeMain(IPC_CHANNELS.BLOCK_WINDOW_CLOSE, { blockId }); } catch (_) {}
  });

  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'block-window-body';

  if (blockEl) {
    blockEl.classList.remove('block-hidden');
    body.appendChild(blockEl);
  } else {
    const fallback = document.createElement('div');
    fallback.textContent = `Missing block: ${blockId}`;
    body.appendChild(fallback);
  }

  shell.appendChild(header);
  shell.appendChild(body);
  document.body.appendChild(shell);

  const resizeRight = document.createElement('div');
  resizeRight.className = 'block-resize-handle block-resize-handle-right';
  const resizeCorner = document.createElement('div');
  resizeCorner.className = 'block-resize-handle block-resize-handle-corner';
  shell.appendChild(resizeRight);
  shell.appendChild(resizeCorner);

  let dragState = null;
  let dropPreviewInFlight = false;
  let dropPreviewLastAt = 0;
    async function requestDropPreview(screenX, screenY, force = false) {
      const now = Date.now();
      if (!force && (now - dropPreviewLastAt) < 60) return;
      if (dropPreviewInFlight) return;
      dropPreviewInFlight = true;
      dropPreviewLastAt = now;
      try {
        await invokeMain(IPC_CHANNELS.BLOCK_WINDOW_DROP_TARGET, {
          pointerScreenX: Math.round(screenX),
          pointerScreenY: Math.round(screenY)
        });
      } catch (_) {}
      dropPreviewInFlight = false;
    }
  header.addEventListener('pointerdown', (ev) => {
    if (ev.target && ev.target.closest && ev.target.closest('button')) return;
    if (ev.button !== 0) return;
    dragState = { pointerId: ev.pointerId, startX: ev.screenX, startY: ev.screenY };
    try { header.setPointerCapture(ev.pointerId); } catch (_) {}
  });

  header.addEventListener('pointermove', (ev) => {
    if (!dragState || dragState.pointerId !== ev.pointerId) return;
    const dx = ev.screenX - dragState.startX;
    const dy = ev.screenY - dragState.startY;
    dragState.startX = ev.screenX;
    dragState.startY = ev.screenY;
    dragState.lastScreenX = ev.screenX;
    dragState.lastScreenY = ev.screenY;
    requestDropPreview(ev.screenX, ev.screenY);
    try {
      ipcRenderer.send(IPC_CHANNELS.BLOCK_WINDOW_MOVE, {
        blockId,
        x: window.screenX + dx,
        y: window.screenY + dy
      });
    } catch (_) {}
  });

  async function endDrag(ev) {
    if (!dragState || dragState.pointerId !== ev.pointerId) return;
    try { header.releasePointerCapture(ev.pointerId); } catch (_) {}
    const lastX = typeof dragState.lastScreenX === 'number' ? dragState.lastScreenX : ev.screenX;
    const lastY = typeof dragState.lastScreenY === 'number' ? dragState.lastScreenY : ev.screenY;
    dragState = null;
    try { await invokeMain(IPC_CHANNELS.BLOCK_WINDOW_DROP_TARGET, { visible: false }); } catch (_) {}
    const docked = await tryDockAtScreenPoint(lastX, lastY);
    if (docked) {
      try { invokeMain(IPC_CHANNELS.BLOCK_WINDOW_CLOSE, { blockId }); } catch (_) {}
    }
  }

  header.addEventListener('pointerup', endDrag);
  header.addEventListener('pointercancel', endDrag);

  let resizeState = null;
  function startResize(ev, axis) {
    if (ev.button !== 0) return;
    resizeState = {
      pointerId: ev.pointerId,
      startX: ev.screenX,
      startY: ev.screenY,
      startW: window.innerWidth,
      startH: window.innerHeight,
      axis
    };
    try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (_) {}
    ev.preventDefault();
  }

  function moveResize(ev) {
    if (!resizeState || resizeState.pointerId !== ev.pointerId) return;
    const dx = ev.screenX - resizeState.startX;
    const dy = ev.screenY - resizeState.startY;
    let nextW = resizeState.startW;
    let nextH = resizeState.startH;
    if (resizeState.axis === 'x' || resizeState.axis === 'xy') nextW = Math.round(resizeState.startW + dx);
    if (resizeState.axis === 'y' || resizeState.axis === 'xy') nextH = Math.round(resizeState.startH + dy);

    try {
      ipcRenderer.send(IPC_CHANNELS.BLOCK_WINDOW_SET_BOUNDS, {
        blockId,
        x: window.screenX,
        y: window.screenY,
        width: nextW,
        height: nextH
      });
    } catch (_) {}
  }

  function endResize(ev) {
    if (!resizeState || resizeState.pointerId !== ev.pointerId) return;
    try { ev.currentTarget.releasePointerCapture(ev.pointerId); } catch (_) {}
    resizeState = null;
  }

  resizeRight.addEventListener('pointerdown', (ev) => startResize(ev, 'x'));
  resizeRight.addEventListener('pointermove', moveResize);
  resizeRight.addEventListener('pointerup', endResize);
  resizeRight.addEventListener('pointercancel', endResize);

  resizeCorner.addEventListener('pointerdown', (ev) => startResize(ev, 'xy'));
  resizeCorner.addEventListener('pointermove', moveResize);
  resizeCorner.addEventListener('pointerup', endResize);
  resizeCorner.addEventListener('pointercancel', endResize);

  ipcRenderer.on(IPC_CHANNELS.SET_LANGUAGE, (_event, lang) => {
    try {
      if (typeof setLanguage === 'function') setLanguage(lang || 'en');
    } catch (_) {}
    title.textContent = getBlockTitle(blockEl);
  });
})();
