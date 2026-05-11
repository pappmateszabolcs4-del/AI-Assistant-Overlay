// Overlay UI logic.

// Specialization level csuszka
const specializationSlider = document.getElementById('specializationLevel');
const specValue = document.getElementById('specValue');

on(specializationSlider, 'input', () => {
  specValue.textContent = specializationSlider.value;
  localStorage.setItem(STORAGE_KEYS.OVERLAY_SPECIALIZATION_LEVEL, specializationSlider.value);
});

// Specialization level betoltese
const savedSpecLevel = localStorage.getItem(STORAGE_KEYS.OVERLAY_SPECIALIZATION_LEVEL) || '3';
specializationSlider.value = savedSpecLevel;
specValue.textContent = savedSpecLevel;

// Hotkey-t global szinten blokkoljuk az overlay-ben
on(document, 'keydown', (e) => {
  // Ctrl+Shift+K - blokkoljuk az overlay-ben
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'K') {
    e.preventDefault();
    e.stopPropagation();
    // If the user is currently holding a panel header (pending detach gesture),
    // cancel it before hiding the overlay. Otherwise the stale state can cause
    // an unintended detach when the overlay is shown again.
    try { window.__cancelAnyDetachGesture && window.__cancelAnyDetachGesture(); } catch (_) {}
    cleanupOverlay();
    fireAndForget(IPC_CHANNELS.CLOSE_OVERLAY);
    return false;
  }
}, true);  // Capture phase, hogy biztosan fogja el

// Mikrofon funkcio
var micBtn = document.getElementById('micBtn');
var status = document.getElementById('status');
var questionInput = document.getElementById('questionInput');
var askBtn = document.getElementById('askBtn');

let recording = false;
let recognition = null; // Web Speech API (deprecated, now using Whisper)
let mediaRecorder = null; // MediaRecorder for Whisper audio capture
let currentScreenshot = null; // Base64 image data
var currentGameContext = null;

const DEFAULT_GAME_IGNORE_TITLES = [
  'Google Chrome',
  'Chrome',
  'Microsoft Edge',
  'Edge',
  'Opera',
  'Firefox',
  'Mozilla Firefox',
  'Brave',
  'Vivaldi',
  'Discord',
  'Visual Studio Code',
  'VS Code'
];

function normalizeGameIgnoreInput(text) {
  return String(text || '')
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function loadGameIgnoreList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GAME_DETECT_IGNORE_LIST);
    if (!raw) return [...DEFAULT_GAME_IGNORE_TITLES];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed.filter((entry) => typeof entry === 'string' && entry.trim());
  } catch (_) {}
  return [...DEFAULT_GAME_IGNORE_TITLES];
}

function persistGameIgnoreList(list) {
  try {
    localStorage.setItem(STORAGE_KEYS.GAME_DETECT_IGNORE_LIST, JSON.stringify(list));
  } catch (_) {}
}

function sendGameIgnoreListToMain(list) {
  try { invokeMain(IPC_CHANNELS.SET_GAME_DETECT_IGNORE_LIST, list); } catch (_) {}
}

function getUserFacingErrorMessage(rawError) {
  const msg = String(rawError || '').trim();
  if (!msg) return '';
  const lower = msg.toLowerCase();

  if (msg === 'overlay-missing') return t().errorOverlayMissing || msg;
  if (msg === 'window-missing') return t().errorWindowMissing || msg;
  if (lower.includes('nincs elerheto kepernyo') || lower.includes('no screen')) {
    return t().errorNoScreen || msg;
  }
  if (lower.includes('openai') && (lower.includes('kulcs') || lower.includes('api key') || lower.includes('api kulcs'))) {
    return t().errorOpenAiKey || msg;
  }

  return '';
}

// Editable Note Panel (separate window)
const NOTE_PANEL_BOUNDS_KEY = STORAGE_KEYS.NOTE_PANEL_BOUNDS;
let notePanelBounds = null; // { x, y, width, height } in screen coords

function loadNotePanelBounds() {
  const saved = localStorage.getItem(NOTE_PANEL_BOUNDS_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object') {
      notePanelBounds = {
        x: typeof parsed.x === 'number' ? parsed.x : Number(parsed.x),
        y: typeof parsed.y === 'number' ? parsed.y : Number(parsed.y),
        width: typeof parsed.width === 'number' ? parsed.width : Number(parsed.width),
        height: typeof parsed.height === 'number' ? parsed.height : Number(parsed.height)
      };
      if (!Number.isFinite(notePanelBounds.x)) notePanelBounds.x = 120;
      if (!Number.isFinite(notePanelBounds.y)) notePanelBounds.y = 120;
      if (!Number.isFinite(notePanelBounds.width)) notePanelBounds.width = 420;
      if (!Number.isFinite(notePanelBounds.height)) notePanelBounds.height = 280;
    }
  } catch (_) {
    notePanelBounds = null;
  }
}

function saveNotePanelBounds() {
  if (!notePanelBounds) return;
  try {
    localStorage.setItem(NOTE_PANEL_BOUNDS_KEY, JSON.stringify(notePanelBounds));
  } catch (_) {}
}

async function openNotePanel() {
  const labels = {
    title: t().notePanelTitle || '📝 Note',
    placeholder: t().notePanelPlaceholder || 'Write a note...'
  };
  await invokeMain(IPC_CHANNELS.NOTE_PANEL_OPEN, {
    labels
  });
}

ipcRenderer.on(IPC_CHANNELS.NOTE_PANEL_BOUNDS, (_event, payload) => {
  if (!payload || !payload.bounds) return;
  const b = payload.bounds;
  if (typeof b.x !== 'number' || typeof b.y !== 'number' || typeof b.width !== 'number' || typeof b.height !== 'number') return;
  notePanelBounds = { x: b.x, y: b.y, width: b.width, height: b.height };
  saveNotePanelBounds();
});

// Vision controls
const screenshotBtn = document.getElementById('screenshotBtn');
const clearImageBtn = document.getElementById('clearImageBtn');
const screenshotPreview = document.getElementById('screenshotPreview');
const screenshotInfo = document.getElementById('screenshotInfo');

// Collapsible sections toggle
const floatingHost = document.getElementById('floating-panels');
// Ensure clean state after reload
floatingHost.innerHTML = '';
document.querySelectorAll('.collapsible-section').forEach((section) => {
  section.__floatingContent = null;
});
document.querySelectorAll('.section-content').forEach((content) => {
  content.classList.remove('open');
  content.style.display = 'none';
  content.style.left = '';
  content.style.top = '';
  content.style.height = '';
  content.style.minWidth = '';
  content.style.visibility = '';
  content.style.maxHeight = `${getPopupMaxHeightPx()}px`;
  const homeSection = content.__homeSection || content.closest('.collapsible-section');
  if (homeSection && homeSection !== content.parentElement) {
    homeSection.appendChild(content);
  }
  content.__homeSection = homeSection;
  content.__anchorBtn = null;
});

let clickThroughState = null;
let overlayHovered = false;
let forceInteractiveCount = 0;
let interactionHoldUntil = 0;
let lastPointerClientX = 0;
let lastPointerClientY = 0;
let hoverEvalFrame = null;

// Main-process assist: when mouse-forwarding gets re-enabled (after cursor leaves a child window),
// we may not get a move event before the user clicks. Accept a pushed cursor position and
// re-evaluate hover/click-through immediately.
try {
  ipcRenderer.on(IPC_CHANNELS.OVERLAY_CURSOR_SCREEN_POINT, (_event, payload) => {
    try {
      if (__isDetachedPanelWindow) return;
      if (!payload || !payload.bounds) return;
      const sx = Number(payload.x);
      const sy = Number(payload.y);
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;
      const b = payload.bounds;
      const bx = Number(b.x);
      const by = Number(b.y);
      if (!Number.isFinite(bx) || !Number.isFinite(by)) return;

      lastPointerClientX = sx - bx;
      lastPointerClientY = sy - by;
      // Run immediately so the next click has the right ignore-mouse state.
      evaluateHoverFromPoint(lastPointerClientX, lastPointerClientY);
    } catch (_) {}
  });
} catch (_) {}

function getPopupMaxHeightPx() {
  const gutter = 12;
  return Math.max(260, Math.round(window.innerHeight - gutter * 2));
}

function syncClickThrough(allowThrough) {
  if (__isDetachedPanelWindow || (typeof __isBlockWindow !== 'undefined' && __isBlockWindow)) return;
  // After an interaction (resize/drag), keep the window interactive briefly.
  // This prevents a common failure mode where pointerup happens outside the window
  // (due to pointer capture), we immediately go click-through, and the next click
  // on the handle never reaches the window unless the user moves the mouse first.
  if (Date.now() < interactionHoldUntil) {
    allowThrough = false;
  }
  if (clickThroughState === allowThrough) return;
  clickThroughState = allowThrough;
  fireAndForget(IPC_CHANNELS.SET_CLICK_THROUGH, allowThrough);
}

function holdInteractive(ms = 600) {
  const until = Date.now() + Math.max(0, ms | 0);
  interactionHoldUntil = Math.max(interactionHoldUntil, until);
  overlayHovered = true;
  syncClickThrough(false);
}

window.__holdInteractive = holdInteractive;

function pushForceInteractive() {
  forceInteractiveCount += 1;
  overlayHovered = true;
  syncClickThrough(false);
}

function popForceInteractive() {
  forceInteractiveCount = Math.max(0, forceInteractiveCount - 1);
  if (forceInteractiveCount > 0) return;
  setTimeout(() => {
    if (forceInteractiveCount > 0) return;
    if (Date.now() < interactionHoldUntil) {
      overlayHovered = true;
      syncClickThrough(false);
      return;
    }
    const el = document.elementFromPoint(lastPointerClientX, lastPointerClientY);
    overlayHovered = isInteractiveTarget(el) || isPointOverInteractiveRect(lastPointerClientX, lastPointerClientY);
    syncClickThrough(!overlayHovered);
  }, 0);
}

window.__pushForceInteractive = pushForceInteractive;
window.__popForceInteractive = popForceInteractive;

const INTERACTIVE_SELECTOR = [
  '#dragHandle',
  '.resize-handle-right',
  '.resize-handle-bottom',
  '.section-header',
  '.section-content',
  '.popup-resize-handle',
  '.history-item',
  'button',
  'input',
  'select',
  'textarea',
  'a[href]',
  '[role="button"]'
].join(',');

function isInteractiveTarget(target) {
  if (!target) return false;
  const el = target.nodeType === 1 ? target : target.parentElement;
  if (!el) return false;

  // Modal is always interactive when open
  if (confirmModal && confirmModal.classList.contains('active') && confirmModal.contains(el)) {
    return true;
  }

  // Only treat specific UI elements as interactive.
  // This prevents the whole overlay window from blocking clicks in "empty" areas.
  const hit = el.closest(INTERACTIVE_SELECTOR);
  if (!hit) return false;
  // Ensure it's within our overlay UI
  if (overlayContainer && overlayContainer.contains(hit)) return true;
  if (floatingHost && floatingHost.contains(hit)) return true;
  if (confirmModal && confirmModal.contains(hit)) return true;
  return false;
}

function isPointOverInteractiveRect(clientX, clientY) {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
  const roots = [];
  if (overlayContainer) roots.push(overlayContainer);
  if (floatingHost) roots.push(floatingHost);
  if (confirmModal) roots.push(confirmModal);

  for (const root of roots) {
    const nodes = root.querySelectorAll(INTERACTIVE_SELECTOR);
    for (const node of nodes) {
      if (!node || typeof node.getBoundingClientRect !== 'function') continue;
      if (node.getClientRects().length === 0) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return true;
      }
    }
  }

  return false;
}

// Keep overlay interactive while native selects are open.
on(document, 'focusin', (event) => {
  const el = event && event.target;
  if (el && (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
    pushForceInteractive();
  }
}, true);

on(document, 'focusout', (event) => {
  const el = event && event.target;
  if (el && (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
    setTimeout(() => {
      popForceInteractive();
    }, 0);
  }
}, true);

let selectHoldActive = false;
let selectHoldTimer = null;

function releaseSelectHold() {
  if (!selectHoldActive) return;
  selectHoldActive = false;
  if (selectHoldTimer) {
    clearTimeout(selectHoldTimer);
    selectHoldTimer = null;
  }
  popForceInteractive();
}

on(document, 'pointerdown', (event) => {
  const el = event && event.target;
  if (el && el.tagName === 'SELECT') {
    if (!selectHoldActive) {
      selectHoldActive = true;
      pushForceInteractive();
    }
    if (selectHoldTimer) clearTimeout(selectHoldTimer);
    selectHoldTimer = setTimeout(() => {
      releaseSelectHold();
    }, 2000);
  }
}, true);

on(document, 'pointerup', (event) => {
  const el = event && event.target;
  if (el && el.tagName === 'SELECT') {
    releaseSelectHold();
  }
}, true);

on(document, 'pointercancel', (event) => {
  const el = event && event.target;
  if (el && el.tagName === 'SELECT') {
    releaseSelectHold();
  }
}, true);

function evaluateHoverFromPoint(clientX, clientY) {
  if (forceInteractiveCount > 0) return;
  if (Date.now() < interactionHoldUntil) {
    overlayHovered = true;
    syncClickThrough(false);
    return;
  }
  const el = document.elementFromPoint(clientX, clientY);
  overlayHovered = isInteractiveTarget(el) || isPointOverInteractiveRect(clientX, clientY);
  syncClickThrough(!overlayHovered);
}

function scheduleHoverEvaluation() {
  if (hoverEvalFrame) return;
  hoverEvalFrame = requestAnimationFrame(() => {
    hoverEvalFrame = null;
    evaluateHoverFromPoint(lastPointerClientX, lastPointerClientY);
  });
}

on(document, 'pointerover', (event) => {
  if (overlayHovered) return;
  if (isInteractiveTarget(event.target)) {
    overlayHovered = true;
    syncClickThrough(false);
  }
}, true);

on(document, 'pointerout', (event) => {
  if (forceInteractiveCount > 0) return;
  if (Date.now() < interactionHoldUntil) return;
  if (!overlayHovered) return;
  if (!isInteractiveTarget(event.target)) return;
  if (isInteractiveTarget(event.relatedTarget)) return;
  overlayHovered = false;
  syncClickThrough(true);
}, true);

on(document, 'pointermove', (event) => {
  lastPointerClientX = event.clientX;
  lastPointerClientY = event.clientY;
  scheduleHoverEvaluation();
}, true);

// Start click-through by default; we enable interactivity only when hovering real UI.
syncClickThrough(true);

function positionPopup(content, headerBtn, isReposition = false) {
  const rect = headerBtn.getBoundingClientRect();
  const minPopupWidth = 140;
  const popupWidth = Math.max(rect.width, minPopupWidth);
  content.style.minWidth = `${popupWidth}px`;
  content.style.maxWidth = `${popupWidth}px`;

  // Keep maxHeight in sync with the current overlay window size.
  // Without this, if a popup is opened while the overlay is temporarily in a small
  // header-only height, it can remain capped ("shrunk") even after the window expands.
  content.style.maxHeight = `${getPopupMaxHeightPx()}px`;

  if (!isReposition) {
    content.style.visibility = 'hidden';
    content.style.display = 'flex';
    content.style.height = 'auto';
    floatingHost.appendChild(content);
    content.classList.add('open');
  }

  requestAnimationFrame(() => {
    // If the popup was previously sized in a temporarily-small overlay height (header-only),
    // it may have an explicit pixel height set. On resize/reposition we must release it
    // so the popup can grow again, unless the user explicitly resized it.
    if (isReposition && !content.__userResizedHeight) {
      content.style.height = 'auto';
    }
    const popupRect = content.getBoundingClientRect();
    const measuredWidth = popupRect.width;
    const gutter = 12;
    const gap = 8;
    let left = rect.left;
    if (left + popupRect.width > window.innerWidth - gutter) {
      left = window.innerWidth - gutter - measuredWidth;
    }
    if (left < gutter) left = gutter;

    const desiredTop = rect.bottom + gap;
    const maxHeightCap = getPopupMaxHeightPx();
    const spaceBelow = window.innerHeight - gutter - desiredTop;
    const spaceAbove = rect.top - gutter - gap;
    const availableBelow = Math.max(0, Math.min(spaceBelow, maxHeightCap));
    const availableAbove = Math.max(0, Math.min(spaceAbove, maxHeightCap));

    let placeBelow = true;
    if (!availableBelow && availableAbove) {
      placeBelow = false;
    } else if (availableBelow && availableAbove) {
      placeBelow = availableBelow >= availableAbove;
    }

    let top = desiredTop;
    if (placeBelow) {
      const maxHeight = availableBelow || Math.min(maxHeightCap, popupRect.height);
      content.style.maxHeight = `${Math.round(maxHeight)}px`;
      const actualHeight = Math.min(popupRect.height, maxHeight);
      content.style.height = `${Math.round(actualHeight)}px`;
      top = Math.max(gutter, desiredTop);
    } else {
      const maxHeight = availableAbove || Math.min(maxHeightCap, popupRect.height);
      const actualHeight = Math.min(popupRect.height, maxHeight);
      content.style.maxHeight = `${Math.round(maxHeight)}px`;
      content.style.height = `${Math.round(actualHeight)}px`;
      top = Math.max(gutter, rect.top - gap - actualHeight);
    }

    content.style.left = `${Math.round(left)}px`;
    content.style.top = `${Math.round(top)}px`;
    content.style.visibility = 'visible';
  });
}

function closePopup(content, section, toggleEl) {
  if (!content) return;
  content.classList.remove('open');
  content.style.left = '';
  content.style.top = '';
  content.style.minWidth = '';
  content.style.visibility = '';
  content.style.height = '';
  content.style.maxHeight = `${getPopupMaxHeightPx()}px`;
  content.__userResizedHeight = false;
  content.style.display = 'none';
  content.__anchorBtn = null;
  if (toggleEl) toggleEl.classList.remove('open');
  if (section) {
    section.appendChild(content);
    section.__floatingContent = null;
  }
}

function toggleSection(event, headerBtn) {
  event.stopPropagation();
  event.preventDefault();
  if (headerBtn && headerBtn.__suppressToggleOnce) {
    headerBtn.__suppressToggleOnce = false;
    return;
  }
  const section = headerBtn.parentElement;
  if (!section) return;
  let content = section.querySelector('.section-content');
  if (!content && section.__floatingContent) {
    content = section.__floatingContent;
  }
  const toggle = headerBtn.querySelector('.section-toggle');
  if (!toggle || !content) return;
  const isOpen = content.classList.contains('open');

  if (isOpen) {
    closePopup(content, section, toggle);
    return;
  }

  // Mark home section and anchor once
  if (!content.__homeSection) content.__homeSection = section;
  section.__floatingContent = content;
  content.__anchorBtn = headerBtn;

  const shouldExpandForPopup = !__isDetachedPanelWindow
    && !section.classList.contains('panel-detached')
    && !document.body.classList.contains('header-only')
    && !document.body.classList.contains('dock-preview')
    && window.innerHeight < 240;

  if (shouldExpandForPopup) {
    try { sendOverlayResizeBatched({ height: 500, __debug: { reason: 'popup-open-expand' } }); } catch (_) {}
  }

  toggle.classList.add('open');
  positionPopup(content, headerBtn);
}

// Reposition open popups on window resize (e.g., during dragging overlay edges)
let repositionFrame = null;
function scheduleRepositionPopups() {
  if (repositionFrame) return;
  repositionFrame = requestAnimationFrame(() => {
    document.querySelectorAll('.section-content.open').forEach((openEl) => {
      const anchor = openEl.__anchorBtn;
      if (anchor && document.body.contains(anchor)) {
        positionPopup(openEl, anchor, true);
      }
    });
    repositionFrame = null;
  });
}
on(window, 'resize', scheduleRepositionPopups);

// Popup resize handling (vertical only)
let popupResizeState = null;

function startPopupResize(e) {
  // Detached panel windows should resize the BrowserWindow itself, not the popup content.
  // (The detached content is flex-stretched and content-height resizing feels jumpy.)
  if (__isDetachedPanelWindow) return;
  e.stopPropagation();
  e.preventDefault();
  // Keep overlay interactive during popup resize.
  pushForceInteractive();
  const content = e.currentTarget.parentElement;
  if (!content || !content.classList.contains('section-content')) return;
  const rect = content.getBoundingClientRect();
  content.__userResizedHeight = true;
  popupResizeState = {
    target: content,
    startY: e.clientY,
    startHeight: rect.height
  };
  content.style.maxHeight = 'none';
  on(document, 'mousemove', doPopupResize);
  on(document, 'mouseup', stopPopupResize, { once: true });
}

function doPopupResize(e) {
  if (!popupResizeState) return;
  const deltaY = e.clientY - popupResizeState.startY;
  let newHeight = popupResizeState.startHeight + deltaY;
  const minH = 200;
  const gutter = 12;
  const maxH = window.innerHeight - gutter - popupResizeState.target.getBoundingClientRect().top;
  newHeight = Math.max(minH, Math.min(maxH, newHeight));
  popupResizeState.target.style.height = `${Math.round(newHeight)}px`;
}

function stopPopupResize() {
  if (popupResizeState && popupResizeState.target) {
    const rect = popupResizeState.target.getBoundingClientRect();
    const gutter = 12;
    const available = window.innerHeight - gutter - Math.max(rect.top, gutter);
    popupResizeState.target.style.maxHeight = `${Math.max(200, Math.round(available))}px`;
  }
  popupResizeState = null;
  document.removeEventListener('mousemove', doPopupResize);
  scheduleRepositionPopups();
  popForceInteractive();
}

// Attach popup resize handles
document.querySelectorAll('.popup-resize-handle').forEach((handle) => {
  on(handle, 'mousedown', startPopupResize);
});

// Detached panel window: resize the BrowserWindow by dragging the handle.
if (__isDetachedPanelWindow) {
  let detachedResizeState = null;

  function evToScreenY(ev) {
    if (typeof ev.screenY === 'number') return Math.round(ev.screenY);
    return Math.round(window.screenY + (typeof ev.clientY === 'number' ? ev.clientY : 0));
  }

  function startDetachedWindowResize(ev) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    const handle = ev.currentTarget;
    ev.preventDefault();
    ev.stopPropagation();
    pushForceInteractive();

    detachedResizeState = {
      pointerId: ev.pointerId,
      startScreenY: evToScreenY(ev),
      startX: window.screenX,
      startY: window.screenY,
      startWidth: window.innerWidth,
      startHeight: window.innerHeight
    };

    try { handle.setPointerCapture(detachedResizeState.pointerId); } catch (_) {}
  }

  function moveDetachedWindowResize(ev) {
    if (!detachedResizeState || ev.pointerId !== detachedResizeState.pointerId) return;
    ev.preventDefault();
    const dy = evToScreenY(ev) - detachedResizeState.startScreenY;
    const nextHeight = Math.max(120, Math.round(detachedResizeState.startHeight + dy));
    ipcRenderer.send(IPC_CHANNELS.DETACHED_PANEL_SET_BOUNDS, {
      x: detachedResizeState.startX,
      y: detachedResizeState.startY,
      width: detachedResizeState.startWidth,
      height: nextHeight
    });
  }

  function endDetachedWindowResize(ev) {
    if (!detachedResizeState || ev.pointerId !== detachedResizeState.pointerId) return;
    const handle = ev.currentTarget;
    try { handle.releasePointerCapture(detachedResizeState.pointerId); } catch (_) {}
    detachedResizeState = null;
    holdInteractive(800);
    popForceInteractive();
  }

  function cancelDetachedWindowResize(ev) {
    if (!detachedResizeState || ev.pointerId !== detachedResizeState.pointerId) return;
    const handle = ev.currentTarget;
    try { handle.releasePointerCapture(detachedResizeState.pointerId); } catch (_) {}
    detachedResizeState = null;
    holdInteractive(800);
    popForceInteractive();
  }

  document.querySelectorAll('.popup-resize-handle').forEach((handle) => {
    on(handle, 'pointerdown', startDetachedWindowResize);
    on(handle, 'pointermove', moveDetachedWindowResize);
    on(handle, 'pointerup', endDetachedWindowResize);
    on(handle, 'pointercancel', cancelDetachedWindowResize);
  });

  // Add side + corner resize handles (like Note/Info windows)
  try {
    const host = document.getElementById('overlay-container');
    if (host) {
      const right = document.createElement('div');
      right.className = 'detached-resize-handle detached-resize-handle-right';
      const corner = document.createElement('div');
      corner.className = 'detached-resize-handle detached-resize-handle-corner';

      host.appendChild(right);
      host.appendChild(corner);

      // Prevent side resize handles from overlapping the draggable header.
      // This avoids cursor/hover instability around the dock button area.
      const headerEl = document.querySelector('.collapsible-section.panel-active .section-header');
      const headerH = headerEl ? Math.max(0, Math.ceil(headerEl.getBoundingClientRect().height)) : 0;
      if (headerH > 0) {
        right.style.top = `${headerH}px`;
      }

      const MIN_W = 200;
      const MIN_H = 120;

      let edgeResizeState = null;
      let pendingBounds = null;
      let boundsRaf = null;

      function requestSetBounds(bounds) {
        pendingBounds = bounds;
        if (boundsRaf) return;
        boundsRaf = requestAnimationFrame(() => {
          boundsRaf = null;
          const next = pendingBounds;
          pendingBounds = null;
          if (!next) return;
          ipcRenderer.send(IPC_CHANNELS.DETACHED_PANEL_SET_BOUNDS, next);
        });
      }

      function beginEdgeResize(ev, edge) {
        if (ev.pointerType === 'mouse' && ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        pushForceInteractive();

        const pt = getReliableScreenPoint(ev);
        edgeResizeState = {
          pointerId: ev.pointerId,
          edge,
          startScreenX: pt.x,
          startScreenY: pt.y,
          startBounds: {
            x: window.screenX,
            y: window.screenY,
            width: window.innerWidth,
            height: window.innerHeight
          }
        };
        try { ev.currentTarget.setPointerCapture(edgeResizeState.pointerId); } catch (_) {}
      }

      function moveEdgeResize(ev) {
        if (!edgeResizeState || ev.pointerId !== edgeResizeState.pointerId) return;
        ev.preventDefault();
        ev.stopPropagation();

        const pt = getReliableScreenPoint(ev);
        const dx = pt.x - edgeResizeState.startScreenX;
        const dy = pt.y - edgeResizeState.startScreenY;
        const b = edgeResizeState.startBounds;

        let nextX = b.x;
        let nextY = b.y;
        let nextW = b.width;
        let nextH = b.height;

        if (edgeResizeState.edge === 'right') {
          nextW = b.width + dx;
        } else if (edgeResizeState.edge === 'corner') {
          nextW = b.width + dx;
          nextH = b.height + dy;
        }

        nextW = Math.max(MIN_W, Math.round(nextW));
        nextH = Math.max(MIN_H, Math.round(nextH));

        requestSetBounds({ x: Math.round(nextX), y: Math.round(nextY), width: nextW, height: nextH });
      }

      function endEdgeResize(ev) {
        if (!edgeResizeState || ev.pointerId !== edgeResizeState.pointerId) return;
        ev.preventDefault();
        ev.stopPropagation();
        try { ev.currentTarget.releasePointerCapture(edgeResizeState.pointerId); } catch (_) {}
        edgeResizeState = null;
        holdInteractive(800);
        popForceInteractive();
      }

      function cancelEdgeResize(ev) {
        if (!edgeResizeState || ev.pointerId !== edgeResizeState.pointerId) return;
        try { ev.currentTarget.releasePointerCapture(edgeResizeState.pointerId); } catch (_) {}
        edgeResizeState = null;
        holdInteractive(800);
        popForceInteractive();
      }

      const edgeHandles = [
        { el: right, edge: 'right' },
        { el: corner, edge: 'corner' }
      ];
      edgeHandles.forEach(({ el, edge }) => {
        on(el, 'pointerdown', (ev) => beginEdgeResize(ev, edge));
        on(el, 'pointermove', moveEdgeResize);
        on(el, 'pointerup', endEdgeResize);
        on(el, 'pointercancel', cancelEdgeResize);
      });
    }
  } catch (_) {}
}

// Cleanup funkcio - cuando window hide-olodik
function cleanupOverlay() {
  // Speech recognition leallitasa
  if (recognition) {
    recognition.stop();
    recognition = null;
  }

  // State resetelese (csak a folyamatban levo dolgok)
  recording = false;
  micBtn.textContent = t().mic;
  status.textContent = t().statusIdle;
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // NE toroljuk:
  // - currentScreenshot - maradjon meg
  // - screenshotPreview - lathato marad
  // - responseContainer - valasz megmarad
  // - questionInput - kerdes szoveg megmarad

  // Igy amikor ujra kinyitod, latod az elozo valaszt es screenshot-ot!
}

// Full clear funkcio - MINDEN torlese (manualis)
function clearAll() {
  // Speech recognition leallitasa
  if (recognition) {
    recognition.stop();
    recognition = null;
  }

  // State resetelese
  recording = false;
  micBtn.textContent = t().mic;
  status.textContent = t().statusIdle;
  questionInput.value = '';
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // Screenshot torlese
  currentScreenshot = null;
  screenshotPreview.style.display = 'none';
  screenshotPreview.src = '';
  clearImageBtn.style.display = 'none';
  screenshotInfo.textContent = t().statusIdle;

  // Response container elrejtese
  document.getElementById('responseContainer').style.display = 'none';
  document.getElementById('aiResponse').textContent = t().statusIdle;
}

// Bezárás
const closeBtn = document.getElementById('closeBtn');
on(closeBtn, 'click', () => {
  // If a detach drag is in-flight, cancel it before hiding; otherwise the
  // panel can end up in a stuck state after close/reopen.
  try { window.__cancelAnyDetachGesture && window.__cancelAnyDetachGesture(); } catch (_) {}
  cleanupOverlay();
  fireAndForget(IPC_CHANNELS.CLOSE_OVERLAY);
});

function updateInfoButtonText() {
  if (!infoBtn) return;
  infoBtn.title = (t().infoBtnTitle || t().infoTitle || 'Info');
}

async function openInfoPanel() {
  // Open a movable, note-panel-like window instead of a modal.
  try {
    await invokeMain(IPC_CHANNELS.INFO_PANEL_OPEN, {});
  } catch (_) {}
  holdInteractive(300);
}

on(infoBtn, 'click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  openInfoPanel();
});

function speakResponse(text) {
  const enableTTS = document.getElementById('enableTTS');
  if (!enableTTS || !enableTTS.checked) return;

  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  const langTag = mapSpeechLang(currentLanguage);
  utterance.lang = langTag;
  const voice = selectedVoice || getBestVoice(langTag);
  if (voice) {
    utterance.voice = voice;
  } else {
    console.warn(`[TTS] No voice found for language: ${langTag}. Using system default.`);
  }
  utterance.rate = 1.0;
  utterance.volume = Math.min(currentSpeechRate / 100, 1.0); // Fix: volume must be 0-1
  window.speechSynthesis.speak(utterance);
}

function mapSpeechLang(lang) {
  switch (lang) {
    case 'hu': return 'hu-HU';
    case 'de': return 'de-DE';
    case 'ru': return 'ru-RU';
    case 'fr': return 'fr-FR';
    case 'zh': return 'zh-CN';
    case 'en':
    default: return 'en-US';
  }
}

function getBestVoice(langTag) {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  if (!voices.length) return null;

  // 1. Exact match first (hu-HU, en-US, de-DE, etc.)
  let match = voices.find(v => v.lang === langTag);
  if (match) return match;

  // 2. Base language match (hu, en, de, etc.)
  const base = langTag.split('-')[0];
  match = voices.find(v => v.lang && v.lang.split('-')[0] === base);
  if (match) return match;

  // 3. Fallback to English if requested language not available
  if (langTag !== 'en-US') {
    match = voices.find(v => v.lang === 'en-US' || v.lang.startsWith('en-'));
    if (match) {
      console.log(`[TTS] Fallback: Using ${match.name} (${match.lang}) instead of ${langTag}`);
      return match;
    }
  }

  // 4. Last resort: use first available voice
  return voices[0] || null;
}

function refreshVoices() {
  const langTag = mapSpeechLang(currentLanguage);
  selectedVoice = getBestVoice(langTag);
  if (!selectedVoice) {
    console.warn(`[TTS] No voice available for ${currentLanguage} (${langTag}). Install language pack in Windows.`);
  } else {
    console.log(`[TTS] Selected voice: ${selectedVoice.name} (${selectedVoice.lang})`);
  }
}

function updatePlaceholder() {
  questionInput.placeholder = t().placeholder;
}

// Content filter - tiltott kulcsszavak eszlelese
function containsForbiddenContent(text) {
  const lowerText = text.toLowerCase();

  // Tiltott kulcsszavak (minden nyelven) - CSAK NON-GAME kontextusban!
  const forbidden = [
    // Illegális dolgok (EN/HU/DE/RU/FR/ZH) - DE: gaming context OK!
    'real hack', 'real crack', 'pirate software', 'real bomb', 'real weapon', 'kill real people', 'real murder', 'real drugs',
    'valódi fegyver', 'valódi bomba', 'valódi drog', 'emberek megölése',
    'echte waffe', 'echte bombe', 'menschen töten',
    'настоящее оружие', 'настоящая бомба', 'убийство людей',
    'vraie arme', 'vraie bombe', 'tuer des gens',
    '真实武器', '真实炸弹', '杀人',

    // Szexuális tartalom (EN/HU/DE/RU/FR/ZH)
    'porn', 'sex', 'nude', 'nsfw', 'xxx', 'adult content', 'erotic',
    'szex', 'pornó', 'meztelen', 'erotikus',
    'porno', 'nackt', 'erotisch',
    'порно', 'секс', 'эротика',
    'sexe', 'nu', 'érotique',
    '色情', '性', '裸体',

    // Prompt injection (EN/HU/DE/RU/FR/ZH)
    'ignore previous', 'ignore all', 'new instructions', 'forget everything',
    'you are now', 'act as', 'pretend to be', 'roleplay as',
    'hagyd figyelmen kívül', 'új utasítás', 'felejts el mindent',
    'ignoriere vorherige', 'neue anweisungen',
    'игнорируй предыдущие', 'новые инструкции',
    'ignore précédent', 'nouvelles instructions',
    '忽略以前', '新指令'
  ];

  // Ellenorzes
  for (const word of forbidden) {
    if (lowerText.includes(word)) {
      return true;
    }
  }

  return false;
}

function updateOverlayText() {
  const titleEl = document.querySelector('h2');
  if (titleEl) {
    titleEl.textContent = t().title;
  }
  if (dragHandle) {
    const dragLabel = t().dragHandleLabel || '⇕ Move overlay';
    dragHandle.dataset.label = dragLabel;
    dragHandle.title = dragLabel;
  }
  updateInfoButtonText();
  const askHeaderLabel = document.getElementById('askHeaderLabel');
  if (askHeaderLabel) askHeaderLabel.textContent = t().tabAsk;
  const historyHeaderLabel = document.getElementById('historyHeaderLabel');
  if (historyHeaderLabel) historyHeaderLabel.textContent = t().tabHistory;
  const settingsHeaderLabel = document.getElementById('settingsHeaderLabel');
  if (settingsHeaderLabel) settingsHeaderLabel.textContent = t().tabSettings;
  micBtn.textContent = t().mic;
  askBtn.textContent = t().ask;
  screenshotBtn.textContent = t().screenshot;
  clearImageBtn.textContent = t().clearImage;
  clearHistoryBtn.textContent = t().clearHistory;
  // Tab buttons removed - now using collapsible sections
  const answerLabel = document.getElementById('answerLabel');
  if (answerLabel) answerLabel.textContent = t().answer;
  const askTtsLabel = document.getElementById('askTtsLabel');
  if (askTtsLabel) askTtsLabel.textContent = t().askTtsLabel;
  document.getElementById('specLabel').textContent = t().specializationLabel;
  const specDetail = document.getElementById('specDetail');
  if (specDetail) specDetail.textContent = t().specializationDetail || specDetail.textContent;
  const ttsLabel = document.getElementById('ttsLabel');
  if (ttsLabel) ttsLabel.textContent = t().ttsLabel || ttsLabel.textContent;
  const speechRateLabel = document.getElementById('speechRateLabel');
  if (speechRateLabel) speechRateLabel.textContent = t().speechRate || speechRateLabel.textContent;
  const dataLabel = document.getElementById('dataLabel');
  if (dataLabel) dataLabel.textContent = t().dataLabel || dataLabel.textContent;
  const exportHistoryBtn = document.getElementById('exportHistoryBtn');
  if (exportHistoryBtn) exportHistoryBtn.textContent = t().exportHistory || exportHistoryBtn.textContent;
  const clearAllBtn = document.getElementById('clearAllBtn');
  if (clearAllBtn) clearAllBtn.textContent = t().clearAllData || clearAllBtn.textContent;
  const gameIgnoreLabel = document.getElementById('gameIgnoreLabel');
  if (gameIgnoreLabel) gameIgnoreLabel.textContent = t().gameIgnoreLabel || gameIgnoreLabel.textContent;
  const gameIgnoreHint = document.getElementById('gameIgnoreHint');
  if (gameIgnoreHint) gameIgnoreHint.textContent = t().gameIgnoreHint || gameIgnoreHint.textContent;
  const gameIgnoreInput = document.getElementById('gameIgnoreInput');
  if (gameIgnoreInput) gameIgnoreInput.placeholder = t().gameIgnorePlaceholder || gameIgnoreInput.placeholder;
  const gameIgnoreApplyBtn = document.getElementById('gameIgnoreApplyBtn');
  if (gameIgnoreApplyBtn) gameIgnoreApplyBtn.textContent = t().gameIgnoreApply || gameIgnoreApplyBtn.textContent;
  const gameIgnoreResetBtn = document.getElementById('gameIgnoreResetBtn');
  if (gameIgnoreResetBtn) gameIgnoreResetBtn.textContent = t().gameIgnoreReset || gameIgnoreResetBtn.textContent;
  const versionLabel = document.getElementById('versionLabel');
  if (versionLabel) versionLabel.textContent = t().versionLabel || versionLabel.textContent;
  const layoutLabel = document.getElementById('layoutLabel');
  if (layoutLabel) layoutLabel.textContent = t().layoutLabel || '🧩 Layout mode:';
  const notePanelLabel = document.getElementById('notePanelLabel');
  if (notePanelLabel) notePanelLabel.textContent = t().notePanelBtn || notePanelLabel.textContent;
  const compositionModeLabel = document.getElementById('compositionModeLabel');
  if (compositionModeLabel) compositionModeLabel.textContent = t().compositionModeLabel || compositionModeLabel.textContent;
  const perfHudLabel = document.getElementById('perfHudLabel');
  if (perfHudLabel) perfHudLabel.textContent = t().perfHudLabel || perfHudLabel.textContent;
  document.getElementById('resetLayoutBtn').textContent = t().resetLayout;
  const notePanelBtn = document.getElementById('notePanelBtn');
  if (notePanelBtn) notePanelBtn.textContent = t().notePanelEdit || t().notePanelBtn || '✏️ Edit';
  updateNotePanelPreview();
  try { window.__updatePerfHudLabel && window.__updatePerfHudLabel(); } catch (_) {}
  updateLayoutToggleText();
  updatePlaceholder();
  renderHistory(); // Re-render history with new language
  updatePinnedUI();
  syncPinnedHistoryWindows();
}

function updateNotePanelPreview() {
  const notePanelPreview = document.getElementById('notePanelPreview');
  if (!notePanelPreview) return;
  let text = '';
  try {
    const rawList = localStorage.getItem(STORAGE_KEYS.NOTES_LIST);
    const list = rawList ? JSON.parse(rawList) : [];
    const activeId = localStorage.getItem(STORAGE_KEYS.NOTES_ACTIVE_ID);
    if (Array.isArray(list) && list.length) {
      const active = list.find((note) => note && note.id === activeId) || list[0];
      text = active && typeof active.content === 'string' ? active.content : '';
    } else {
      text = localStorage.getItem(STORAGE_KEYS.NOTE_PANEL_TEXT) || '';
    }
  } catch (_) {
    text = '';
  }
  if (text && text.trim()) {
    notePanelPreview.textContent = text;
    notePanelPreview.classList.remove('is-empty');
  } else {
    notePanelPreview.textContent = t().notePanelPlaceholder || '';
    notePanelPreview.classList.add('is-empty');
  }
}

function readSpeechRateSetting() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
    if (!raw) return 100;
    const parsed = JSON.parse(raw);
    const rate = Number(parsed && parsed.speechRate);
    if (!Number.isFinite(rate)) return 100;
    return Math.max(0, Math.min(100, Math.round(rate)));
  } catch (_) {
    return 100;
  }
}

function writeSpeechRateSetting(rate) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = parsed && typeof parsed === 'object' ? parsed : {};
    next.speechRate = Math.max(0, Math.min(100, Math.round(rate)));
    localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(next));
  } catch (_) {}
}

function setSpeechRateUI(nextRate) {
  const speechRateInput = document.getElementById('speechRate');
  const speechRateValue = document.getElementById('speechRateValue');
  const normalized = Math.max(0, Math.min(100, Math.round(Number(nextRate) || 0)));
  if (speechRateInput) speechRateInput.value = String(normalized);
  if (speechRateValue) speechRateValue.textContent = String(normalized);
}

window.setSpeechRateUI = setSpeechRateUI;

const speechRateInput = document.getElementById('speechRate');
if (speechRateInput) {
  const initialRate = readSpeechRateSetting();
  currentSpeechRate = initialRate;
  setSpeechRateUI(initialRate);
  speechRateInput.addEventListener('input', () => {
    const next = Math.max(0, Math.min(100, Math.round(Number(speechRateInput.value) || 0)));
    currentSpeechRate = next;
    setSpeechRateUI(next);
    writeSpeechRateSetting(next);
    fireAndForget(IPC_CHANNELS.SET_SPEECH_RATE, next);
  });
}

async function askQuestion() {
  const text = questionInput.value.trim();
  if (!text) {
    status.textContent = t().typeQuestion;
    return;
  }

  if (!currentGameContext) {
    await requestGameContext();
  }

  // Content filter ellenorzes
  if (containsForbiddenContent(text)) {
    status.textContent = t().forbiddenContent;
    return;
  }

  if (currentScreenshot) {
    status.textContent = t().analyzingImage;
  } else {
    status.textContent = t().thinking;
  }

  askBtn.disabled = true;
  try {
    const result = await invokeMain(IPC_CHANNELS.PROCESS_TEXT, text, currentLanguage, parseInt(specializationSlider.value), currentScreenshot, currentGameContext);
    if (result.success) {
      status.textContent = t().responseReady;
      document.getElementById('aiResponse').textContent = result.response;
      document.getElementById('responseContainer').style.display = 'block';
      speakResponse(result.response);

      // Add to history
      addToHistory(text, result.response, !!currentScreenshot);
    } else {
      const friendly = getUserFacingErrorMessage(result.error);
      status.textContent = t().genericErrorPrefix + (friendly || result.error);
    }
  } catch (err) {
    const friendly = getUserFacingErrorMessage(err && err.message);
    status.textContent = t().apiErrorPrefix + (friendly || (err && err.message) || t().unknownError);
  } finally {
    askBtn.disabled = false;
  }
}

// Mikrofon gomb click handler
on(micBtn, 'click', async () => {
  if (recording) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      recording = false;  // Immediately mark as not recording
      micBtn.textContent = t().mic;
      status.textContent = t().processingAudio;
    }
    return;
  }

  // Request microphone permission
  try {
    status.textContent = t().speakNow;
    micBtn.textContent = t().stop;
    recording = true;

    // Capture audio from microphone
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      // Stop microphone
      stream.getTracks().forEach(track => track.stop());

      // Create audio blob
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

      status.textContent = t().processingAudio;

      try {
        // Send to Whisper API via main process
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = Array.from(new Uint8Array(arrayBuffer));

        const result = await invokeMain(IPC_CHANNELS.PROCESS_AUDIO, audioBuffer, currentLanguage, parseInt(specializationSlider.value));

        if (result.success) {
          const transcript = result.transcript;
          status.textContent = t().transcriptPreview.replace('{text}', transcript);
          micBtn.textContent = t().mic;
          recording = false;

          // Content filter ellenorzes
          if (containsForbiddenContent(transcript)) {
            status.textContent = t().forbiddenContent;
            return;
          }

          // Process the transcript as question
          if (currentScreenshot) {
            status.textContent = t().analyzingImage;
          } else {
            status.textContent = t().thinking;
          }

          if (!currentGameContext) {
            await requestGameContext();
          }

          try {
            const processResult = await invokeMain(IPC_CHANNELS.PROCESS_TEXT, transcript, currentLanguage, parseInt(specializationSlider.value), currentScreenshot, currentGameContext);

            if (processResult.success) {
              document.getElementById('aiResponse').textContent = processResult.response;
              document.getElementById('responseContainer').style.display = 'block';
              speakResponse(processResult.response);

              // Add to history
              addToHistory(transcript, processResult.response, !!currentScreenshot);
            } else {
              const friendly = getUserFacingErrorMessage(processResult.error);
              status.textContent = t().genericErrorPrefix + (friendly || processResult.error);
            }
          } catch (err) {
            const friendly = getUserFacingErrorMessage(err && err.message);
            status.textContent = t().apiErrorPrefix + (friendly || (err && err.message) || t().unknownError);
          }
        } else {
          const friendly = getUserFacingErrorMessage(result.error);
          status.textContent = t().transcriptionErrorPrefix + (friendly || result.error);
        }
      } catch (err) {
        const friendly = getUserFacingErrorMessage(err && err.message);
        status.textContent = t().audioProcessingErrorPrefix + (friendly || (err && err.message) || t().unknownError);
        console.error('[MIC] Error:', err);
      } finally {
        micBtn.textContent = t().mic;
        recording = false;
      }
    };

    mediaRecorder.start();

  } catch (err) {
    const friendly = getUserFacingErrorMessage(err && err.message);
    status.textContent = t().microphoneErrorPrefix + (friendly || (err && err.message) || t().unknownError);
    micBtn.textContent = t().mic;
    recording = false;
    console.error('[MIC] Permission error:', err);
  }
});

on(askBtn, 'click', askQuestion);
on(questionInput, 'keydown', (e) => {
  if (e.key === 'Enter') {
    askQuestion();
  }
});

// Screenshot button
on(screenshotBtn, 'click', async () => {
  try {
    status.textContent = t().screenshotInProgress;
    const result = await invokeMain(IPC_CHANNELS.CAPTURE_SCREENSHOT);
    if (result.success) {
      currentScreenshot = result.imageData;
      screenshotPreview.src = result.imageData;
      screenshotPreview.style.display = 'block';
      clearImageBtn.style.display = 'block';
      screenshotInfo.textContent = t().screenshotReady;
      status.textContent = t().statusIdle;
    } else {
      const friendly = getUserFacingErrorMessage(result.error);
      status.textContent = t().screenshotError + (friendly || result.error);
    }
  } catch (err) {
    const friendly = getUserFacingErrorMessage(err && err.message);
    status.textContent = t().screenshotError + (friendly || (err && err.message) || t().unknownError);
  }
});

// Clear image button
on(clearImageBtn, 'click', () => {
  currentScreenshot = null;
  screenshotPreview.style.display = 'none';
  screenshotPreview.src = '';
  clearImageBtn.style.display = 'none';
  screenshotInfo.textContent = t().statusIdle;
  status.textContent = t().statusIdle;
});

// Start with the correct language immediately on first paint.
// Main sends the persisted language via `set-language` right after load,
// but we also resolve it eagerly here so there is no brief English flash
// before the IPC arrives.
try {
  const storedLang = localStorage.getItem(STORAGE_KEYS.OVERLAY_LANGUAGE);
  if (storedLang && uiText[storedLang]) {
    currentLanguage = storedLang;
  }
} catch (_) {}
updateOverlayText();

// Eager language init counts as "language ready" for boot gating.
// Detached-state still needs to arrive from main before we unhide.
__bootLangReady = true;
__maybeFinishBoot();

// Load conversation history (renderHistory is already called from updateOverlayText)
loadHistory();

async function requestGameContext() {
  try {
    const detectedGame = await invokeMain(IPC_CHANNELS.GET_GAME_CONTEXT);
    if (detectedGame) {
      currentGameContext = detectedGame;
      console.log(`[GAME] Context resolved: ${detectedGame}`);
    }
  } catch (err) {
    console.error('[IPC] get-game-context failed:', err);
  }
}

// Request current game context on startup (with retry)
requestGameContext();

// Retry after a short delay if not set
setTimeout(() => {
  if (!currentGameContext) {
    console.log('[GAME] No game context yet, retrying...');
    requestGameContext();
  }
}, 500);

// Load pinned tabs
loadPinnedTabs();

// Load note panel persisted bounds (separate window)
loadNotePanelBounds();

// Sync pinned history windows
syncPinnedHistoryWindows();

// Settings: TTS toggle
const enableTTS = document.getElementById('enableTTS');
const savedTTS = localStorage.getItem(STORAGE_KEYS.ENABLE_TTS);
if (savedTTS !== null) {
  enableTTS.checked = savedTTS === 'true';
}
on(enableTTS, 'change', () => {
  localStorage.setItem(STORAGE_KEYS.ENABLE_TTS, enableTTS.checked);
});

// Settings: game detection ignore list
const gameIgnoreInput = document.getElementById('gameIgnoreInput');
const gameIgnoreApplyBtn = document.getElementById('gameIgnoreApplyBtn');
const gameIgnoreResetBtn = document.getElementById('gameIgnoreResetBtn');

function applyGameIgnoreList(list, options = {}) {
  const normalized = Array.isArray(list)
    ? list.map((entry) => String(entry).trim()).filter(Boolean)
    : [];

  if (gameIgnoreInput) {
    gameIgnoreInput.value = normalized.join('\n');
  }

  if (options.persist) {
    persistGameIgnoreList(normalized);
  }

  sendGameIgnoreListToMain(normalized);
}

if (gameIgnoreInput) {
  applyGameIgnoreList(loadGameIgnoreList(), { persist: true });
}

if (gameIgnoreApplyBtn) {
  on(gameIgnoreApplyBtn, 'click', () => {
    const list = normalizeGameIgnoreInput(gameIgnoreInput ? gameIgnoreInput.value : '');
    applyGameIgnoreList(list, { persist: true });
  });
}

if (gameIgnoreResetBtn) {
  on(gameIgnoreResetBtn, 'click', () => {
    applyGameIgnoreList(DEFAULT_GAME_IGNORE_TITLES, { persist: true });
  });
}

// Clear all data
// Custom modal functions
let pendingConfirmAction = null;

const closeConfirmModal = () => {
  if (!confirmModal.classList.contains('active')) {
    pendingConfirmAction = null;
    return;
  }
  confirmModal.classList.remove('active');
  fireAndForget(IPC_CHANNELS.WINDOW_ACTION, 'restore-temp');
  pendingConfirmAction = null;
};

on(modalConfirm, 'click', () => {
  const action = pendingConfirmAction;
  closeConfirmModal();
  if (action) {
    action();
  }
});

on(modalCancel, 'click', closeConfirmModal);

on(confirmModal, 'click', (e) => {
  if (e.target === confirmModal) {
    closeConfirmModal();
  }
});

function showConfirmModal(title, message, onConfirm, confirmBtnText = null) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalCancel.textContent = t().btnCancel;
  modalConfirm.textContent = confirmBtnText || t().btnDelete;
  pendingConfirmAction = onConfirm;
  fireAndForget(IPC_CHANNELS.WINDOW_ACTION, 'maximize-temp');
  confirmModal.classList.add('active');
}

window.clearAllData = function() {
  showConfirmModal(
    t().confirmTitle,
    t().confirmClearAll,
    () => {
      localStorage.clear();
      conversationHistory = [];
      expandedHistoryKey = null;
      pinnedTabs.clear();
      pinnedHistoryBoxes = [];
      fireAndForget(IPC_CHANNELS.PINNED_HISTORY_CLOSE_ALL);
      updatePinnedUI();
      renderPinnedContent();
      renderHistory();
      status.textContent = t().allDataCleared;
    }
  );
};

// Drag handle delegates to OS via -webkit-app-region; track and persist native window position
// IMPORTANT: Only the MAIN overlay window is allowed to persist `overlayPositionX/Y`.
// Detached panel windows use the same origin/localStorage, so if they write these keys,
// the main overlay can "jump" to the detached window position after Ctrl+R/reset.

window.__markOverlayPositionTouched = function __markOverlayPositionTouched() {};

function suppressOverlayPositionPersistenceNow() {
  // No-op: position persistence handled in main process.
}

// Overlay position persistence now lives in the main process (normalized per-monitor layout).

const dragHandleFlushThreshold = 32; // px from top of monitor where the grip should compress

function monitorDragHandlePosition() {
  if (!dragHandle) return;
  const isFlushTop = window.screenY <= dragHandleFlushThreshold;
  dragHandle.classList.toggle('flush-top', isFlushTop);
  requestAnimationFrame(monitorDragHandlePosition);
}

monitorDragHandlePosition();

// Note panel (separate overlay element)
const notePanelBtn = document.getElementById('notePanelBtn');
if (notePanelBtn) {
  on(notePanelBtn, 'click', (ev) => {
    if (ev) ev.stopPropagation();
    openNotePanel().catch((err) => {
      console.error('[NOTE] Failed to open note panel:', err);
    });
  });
}

window.addEventListener('storage', (ev) => {
  if (!ev) return;
  if (ev.key !== STORAGE_KEYS.NOTE_PANEL_TEXT && ev.key !== STORAGE_KEYS.NOTES_LIST && ev.key !== STORAGE_KEYS.NOTES_ACTIVE_ID) return;
  updateNotePanelPreview();
});

if (dragHandle) {
  try {
    ipcRenderer.on(IPC_CHANNELS.OVERLAY_DRAG_READY, (_event, payload) => {
      const ready = !!(payload && payload.ready);
      dragHandle.classList.toggle('drag-ready', ready);
    });
  } catch (_) {}
}

// Reset layout function
const resetLayoutBtn = document.getElementById('resetLayoutBtn');
on(resetLayoutBtn, 'click', () => {
  showConfirmModal(
    t().confirmTitle,
    t().resetLayout,
    () => {
      // Prevent any rAF-based window position tracking from re-saving x/y
      // after we clear the stored layout keys.
      suppressOverlayPositionPersistenceNow();

      // Cancel any in-flight move/resize batching so no late x/y updates can
      // flush right as we reset/reload.
      try { cancelResize && cancelResize(); } catch (_) {}
      try { cancelWindowDrag && cancelWindowDrag(); } catch (_) {}
      try { cancelPendingOverlayResize && cancelPendingOverlayResize(); } catch (_) {}

      // Visually hide the overlay immediately so header slots or layout jumps
      // during reset are never seen by the user.
      try {
        document.body.style.opacity = '0';
      } catch (_) {}

      // Belt-and-suspenders: hide the main overlay container and sections
      // immediately so no header/dockable area can flash during reset.
      try {
        const container = document.getElementById('overlay-container');
        if (container) container.style.display = 'none';
      } catch (_) {}
      try {
        const sections = document.querySelector('.sections-container');
        if (sections) sections.style.display = 'none';
      } catch (_) {}

      // Also ask main to hide the overlay window itself (virtual visibility off)
      // so any BrowserWindow size/position changes happen fully off-screen.
      // NOTE: do not toggle virtual visibility here; otherwise after reload the
      // overlay can remain hidden until the user re-opens it.

      // Clear all layout-related localStorage
      localStorage.removeItem(STORAGE_KEYS.OVERLAY_POSITION_X);
      localStorage.removeItem(STORAGE_KEYS.OVERLAY_POSITION_Y);
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEYS.PINNED_TABS);
      localStorage.removeItem(PINNED_HISTORY_KEY);
      localStorage.removeItem(NOTE_PANEL_BOUNDS_KEY);
      localStorage.removeItem(STORAGE_KEYS.WINDOW_LAYOUTS);
      localStorage.removeItem(STORAGE_KEYS.BLOCK_LAYOUTS);
      localStorage.removeItem(STORAGE_KEYS.BLOCK_FREE_LAYOUT);
      localStorage.removeItem('overlayWidgetCompositionMode');

      // Unpin all tabs
      pinnedTabs.clear();
      pinnedHistoryBoxes = [];

      // Close any pinned windows
      fireAndForget(IPC_CHANNELS.PINNED_HISTORY_CLOSE_ALL);
      fireAndForget(IPC_CHANNELS.NOTE_PANEL_CLOSE);
      fireAndForget(IPC_CHANNELS.DETACHED_PANEL_CLOSE_ALL);
      fireAndForget(IPC_CHANNELS.BLOCK_WINDOW_CLOSE, { blockId: 'ask-main' });
      fireAndForget(IPC_CHANNELS.BLOCK_WINDOW_CLOSE, { blockId: 'history-list' });
      fireAndForget(IPC_CHANNELS.BLOCK_WINDOW_CLOSE, { blockId: 'history-actions' });
      fireAndForget(IPC_CHANNELS.BLOCK_WINDOW_CLOSE, { blockId: 'spec' });
      fireAndForget(IPC_CHANNELS.BLOCK_WINDOW_CLOSE, { blockId: 'tts' });
      fireAndForget(IPC_CHANNELS.BLOCK_WINDOW_CLOSE, { blockId: 'data' });
      fireAndForget(IPC_CHANNELS.BLOCK_WINDOW_CLOSE, { blockId: 'game-ignore' });
      fireAndForget(IPC_CHANNELS.BLOCK_WINDOW_CLOSE, { blockId: 'layout' });
      fireAndForget(IPC_CHANNELS.BLOCK_WINDOW_CLOSE, { blockId: 'note' });
      fireAndForget(IPC_CHANNELS.BLOCK_WINDOW_CLOSE, { blockId: 'free-layout' });
      fireAndForget(IPC_CHANNELS.BLOCK_WINDOW_CLOSE, { blockId: 'version' });

      // Send reset position to main process
      fireAndForget(IPC_CHANNELS.WINDOW_ACTION, 'reset-position');

      // Reload window to reset everything
      setTimeout(() => {
        location.reload();
      }, 100);
    },
    t().btnReset  // Custom button text for reset
  );
});

// Ensure voices are loaded (some engines load async)
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    refreshVoices();
  };
  window.speechSynthesis.getVoices();
}

// Dev reload hardening: intercept Ctrl+R / F5 so we can hide the overlay
// before navigation begins (prevents any single-frame header flicker).
if (!__isDetachedPanelWindow) {
  try {
    on(window, 'keydown', (e) => {
      const key = String(e && e.key || '').toLowerCase();
      const wantsReload = (key === 'r' && (e.ctrlKey || e.metaKey)) || key === 'f5';
      if (!wantsReload) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (_) {}

      // Freeze position persistence during reload. This avoids any late writes
      // from transient states right before navigation.
      suppressOverlayPositionPersistenceNow();

      // Drop any queued move/resize updates before navigation begins.
      try { cancelResize && cancelResize(); } catch (_) {}
      try { cancelWindowDrag && cancelWindowDrag(); } catch (_) {}
      try { cancelPendingOverlayResize && cancelPendingOverlayResize(); } catch (_) {}

      try {
        document.body.style.opacity = '0';
      } catch (_) {}
      try {
        const container = document.getElementById('overlay-container');
        if (container) container.style.display = 'none';
      } catch (_) {}
      try {
        const sections = document.querySelector('.sections-container');
        if (sections) sections.style.display = 'none';
      } catch (_) {}
      setTimeout(() => {
        try { location.reload(); } catch (_) {}
      }, 0);
    }, true);
  } catch (_) {}
}
