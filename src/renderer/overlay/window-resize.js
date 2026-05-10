// Uses global IPC_CHANNELS from ipc-helpers.

// Resize handle logic
const overlayContainer = document.getElementById('overlay-container');
const leftHandle = document.querySelector('.resize-handle-left');
const rightHandle = document.querySelector('.resize-handle-right');
const bottomHandle = document.querySelector('.resize-handle-bottom');
const dragHandle = document.getElementById('dragHandle');
const confirmModal = document.getElementById('confirmModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalConfirm = document.getElementById('modalConfirm');
const modalCancel = document.getElementById('modalCancel');
const infoBtn = document.getElementById('infoBtn');

const __skipOverlayResize = typeof __isBlockWindow !== 'undefined' && __isBlockWindow;

let isResizing = false;
let startX = 0;
let startWidth = 0;
let startY = 0;
let startHeight = 0;
let startWindowX = 0;
let startWindowY = 0;
let startWindowWidth = 0;
let startWindowHeight = 0;
let resizeDirection = null;
let resizePointerId = null;
let resizeHandleEl = null;
let startPointerScreenX = 0;
let startPointerScreenY = 0;
let startRightEdge = 0;
let resizeForcedInteractive = false;

// Resize IPC batching to avoid jitter/lag (one send per animation frame)
let pendingResize = null;
let resizeFrame = null;
let lastSentBounds = null;
let prevOverflowY = null;

// Global guard: while detaching a panel, the main overlay must not move.
// (Used by sendOverlayResizeBatched, so it must be declared before that function.)
let isDetachGestureActive = false;

function sendOverlayResize(bounds) {
  fireAndForget(IPC_CHANNELS.RESIZE_OVERLAY, bounds);
}

function boundsChanged(next) {
  if (!lastSentBounds) return true;
  const keys = ['x', 'y', 'width', 'height'];
  return keys.some((k) => next[k] !== undefined && next[k] !== lastSentBounds[k]);
}

function flushPendingResize() {
  if (pendingResize && boundsChanged(pendingResize)) {
    sendOverlayResize(pendingResize);
    lastSentBounds = { ...lastSentBounds, ...pendingResize };
  }
  pendingResize = null;
  resizeFrame = null;
}

function cancelPendingOverlayResize() {
  pendingResize = null;
  if (resizeFrame) {
    try { cancelAnimationFrame(resizeFrame); } catch (_) {}
    resizeFrame = null;
  }
}

function sendOverlayResizeBatched(bounds) {
  // During panel detach drags, ignore any attempt to move the main overlay.
  // This prevents a one-time "jump" if some stale drag/resize state tries to flush x/y.
  if (isDetachGestureActive && bounds && (bounds.x !== undefined || bounds.y !== undefined)) {
    const sanitized = { ...bounds };
    delete sanitized.x;
    delete sanitized.y;
    bounds = sanitized;
    if (!Object.keys(bounds).length) return;
  }

  // During boot/reload, never send x/y moves. The BrowserWindow already has the
  // correct position; sending x/y during transient sizing can fling it to (0,0).
  if (!__isDetachedPanelWindow && __bootingMainOverlay && bounds && (bounds.x !== undefined || bounds.y !== undefined)) {
    const sanitized = { ...bounds };
    delete sanitized.x;
    delete sanitized.y;
    bounds = sanitized;
    if (!Object.keys(bounds).length) return;
  }
  pendingResize = { ...pendingResize, ...bounds };
  if (!resizeFrame) {
    resizeFrame = requestAnimationFrame(flushPendingResize);
  }
}

function startResize(e, direction) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  // Keep overlay interactive during resize; otherwise click-through can re-enable
  // when the pointer leaves the UI, causing pointermove events to stop.
  resizeForcedInteractive = true;
  pushForceInteractive();
  isResizing = true;
  startX = e.clientX;
  startY = e.clientY;
  // Use window inner dimensions to align with BrowserWindow bounds
  startWidth = window.innerWidth;
  startHeight = window.innerHeight;
  startWindowX = window.screenX;
  startWindowY = window.screenY;
  startWindowWidth = window.innerWidth;
  startWindowHeight = window.innerHeight;
  resizeDirection = direction;
  resizePointerId = typeof e.pointerId === 'number' ? e.pointerId : null;
  resizeHandleEl = e.currentTarget || null;
  startPointerScreenX = e.screenX;
  startPointerScreenY = e.screenY;
  startRightEdge = startWindowX + startWindowWidth;
  // Hide scrollbars during resize to avoid width-dependent layout shifts
  prevOverflowY = overlayContainer.style.overflowY;
  overlayContainer.style.overflowY = 'hidden';
  if (resizeHandleEl && resizePointerId !== null) {
    try {
      resizeHandleEl.setPointerCapture(resizePointerId);
    } catch (_) {}
  }
  e.preventDefault();
  e.stopPropagation();
}

function cancelResize() {
  if (!isResizing) return;
  isResizing = false;
  resizeDirection = null;
  if (resizeHandleEl && resizePointerId !== null) {
    try { resizeHandleEl.releasePointerCapture(resizePointerId); } catch (_) {}
  }
  resizePointerId = null;
  resizeHandleEl = null;
  startPointerScreenX = 0;
  startPointerScreenY = 0;
  overlayContainer.style.overflowY = prevOverflowY || 'visible';
  if (resizeForcedInteractive) {
    resizeForcedInteractive = false;
    popForceInteractive();
  }
}

function doResize(e) {
  if (!isResizing) return;
  // Safety: if we missed pointerup and the mouse button is no longer down,
  // stop the resize to prevent the window from drifting.
  if (e.pointerType === 'mouse' && typeof e.buttons === 'number' && e.buttons === 0) {
    cancelResize();
    return;
  }

  if (resizePointerId !== null && e.pointerId !== resizePointerId) return;

  const deltaX = e.clientX - startX;
  const deltaY = e.clientY - startY;
  const deltaScreenX = e.screenX - startPointerScreenX;
  const deltaScreenY = e.screenY - startPointerScreenY;
  let newWidth = startWidth;
  let newHeight = startHeight;

  if (resizeDirection === 'right') {
    newWidth = startWidth + deltaScreenX;
  } else if (resizeDirection === 'bottom') {
    newHeight = startHeight + deltaScreenY;
  }

  const minWidth = 450;
  const minHeight = 80;
  const availWidth = window.screen && (window.screen.availWidth || window.screen.width) ? Math.max(window.screen.availWidth || 0, window.screen.width || 0) : 0;
  const availHeight = window.screen && (window.screen.availHeight || window.screen.height) ? Math.max(window.screen.availHeight || 0, window.screen.height || 0) : 0;
  const maxWidth = availWidth > 0 ? Math.max(minWidth, availWidth * 2) : Number.MAX_SAFE_INTEGER;
  const maxHeight = availHeight > 0 ? Math.max(minHeight, availHeight * 2) : Number.MAX_SAFE_INTEGER;
  newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
  newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

  // Round to whole pixels to avoid sub-pixel oscillation from Electron bounds rounding
  const roundedWidth = Math.round(newWidth);
  const roundedHeight = Math.round(newHeight);

  if (resizeDirection === 'left') {
    const minWidth = 450;
    const minHeight = 80;
    const availWidth = window.screen && (window.screen.availWidth || window.screen.width) ? Math.max(window.screen.availWidth || 0, window.screen.width || 0) : 0;
    const maxWidth = availWidth > 0 ? Math.max(minWidth, availWidth * 2) : Number.MAX_SAFE_INTEGER;
    let newX = startWindowX + deltaScreenX;
    const maxLeft = startRightEdge - minWidth;
    newX = Math.min(newX, maxLeft);
    if (isFinite(maxWidth)) {
      const minLeft = startRightEdge - maxWidth;
      newX = Math.max(newX, minLeft);
    }
    const computedWidth = startRightEdge - newX;
    const roundedWidth = Math.round(computedWidth);
    sendOverlayResizeBatched({ x: Math.round(newX), width: roundedWidth });
    return;
  } else if (resizeDirection === 'right') {
    sendOverlayResizeBatched({ width: roundedWidth });
  } else if (resizeDirection === 'bottom') {
    sendOverlayResizeBatched({ height: roundedHeight });
  }
}

function stopResize(e) {
  if (!isResizing || (resizePointerId !== null && e.pointerId !== resizePointerId)) {
    return;
  }

  if (isResizing) {
    // Send a final precise size on mouseup
    const finalBounds = { width: Math.round(window.innerWidth), height: Math.round(window.innerHeight), x: window.screenX, y: window.screenY };
    sendOverlayResize(finalBounds);
    lastSentBounds = { ...lastSentBounds, ...finalBounds };
  }
  isResizing = false;
  resizeDirection = null;
  if (resizeHandleEl && resizePointerId !== null) {
    try {
      resizeHandleEl.releasePointerCapture(resizePointerId);
    } catch (_) {}
  }
  resizePointerId = null;
  resizeHandleEl = null;
  startPointerScreenX = 0;
  startPointerScreenY = 0;
  // Restore scrollbars after resize
  overlayContainer.style.overflowY = prevOverflowY || 'visible';
  // syncContainerSize was removed; no-op here

  if (resizeForcedInteractive) {
    resizeForcedInteractive = false;
    popForceInteractive();
  }
}

if (!__skipOverlayResize) {
  on(leftHandle, 'pointerdown', (e) => startResize(e, 'left'));
  on(rightHandle, 'pointerdown', (e) => startResize(e, 'right'));
  // Bottom resize handle is intentionally not used on the main overlay.
  on(document, 'pointermove', doResize);
  on(document, 'pointerup', stopResize);
  on(document, 'pointercancel', stopResize);
}

// Manual window dragging fallback to ensure reliable movement on transparent overlays
let isWindowDragging = false;
let windowDragPointerId = null;
let dragStartScreenX = 0;
let dragStartScreenY = 0;
let windowStartX = 0;
let windowStartY = 0;
let windowDragForcedInteractive = false;

// While a detach gesture is active, never allow the main overlay to start/continue window dragging.

function cancelWindowDrag() {
  if (!isWindowDragging) return;
  isWindowDragging = false;
  try {
    if (dragHandle && windowDragPointerId !== null) {
      dragHandle.releasePointerCapture(windowDragPointerId);
    }
  } catch (_) {}
  windowDragPointerId = null;
  document.removeEventListener('pointermove', handleWindowDragMove, true);
  document.removeEventListener('pointerup', endWindowDrag, true);
  document.removeEventListener('pointercancel', endWindowDrag, true);

  // If a position update was queued but not yet flushed, drop it.
  cancelPendingOverlayResize();

  if (windowDragForcedInteractive) {
    windowDragForcedInteractive = false;
    popForceInteractive();
  }
}

function beginWindowDrag(event) {
  if (!dragHandle || event.button !== 0) return;
  if (isDetachGestureActive) return;
  event.preventDefault();
  event.stopPropagation();

  // Keep the overlay interactive for the full drag; otherwise hover-eval can
  // flip click-through mid-gesture and leave drag listeners stuck.
  if (!windowDragForcedInteractive) {
    windowDragForcedInteractive = true;
    pushForceInteractive();
  }

  isWindowDragging = true;
  windowDragPointerId = event.pointerId;
  dragStartScreenX = event.screenX;
  dragStartScreenY = event.screenY;
  windowStartX = window.screenX;
  windowStartY = window.screenY;
  try {
    dragHandle.setPointerCapture(windowDragPointerId);
  } catch (_) {}
  on(document, 'pointermove', handleWindowDragMove, true);
  on(document, 'pointerup', endWindowDrag, true);
  on(document, 'pointercancel', endWindowDrag, true);
}

function handleWindowDragMove(event) {
  if (!isWindowDragging) {
    return;
  }

  // If a detach drag is in-flight, immediately cancel any window-drag state.
  if (isDetachGestureActive) {
    cancelWindowDrag();
    return;
  }

  // Safety: if we missed pointerup and the mouse button is no longer down,
  // cancel the drag to prevent the overlay from drifting.
  if (event.pointerType === 'mouse' && typeof event.buttons === 'number' && event.buttons === 0) {
    cancelWindowDrag();
    return;
  }

  if (windowDragPointerId !== null && event.pointerId !== windowDragPointerId) {
    return;
  }

  const deltaX = event.screenX - dragStartScreenX;
  const deltaY = event.screenY - dragStartScreenY;
  const nextX = Math.round(windowStartX + deltaX);
  const nextY = Math.round(windowStartY + deltaY);
  sendOverlayResizeBatched({ x: nextX, y: nextY });
}

function endWindowDrag(event) {
  if (!isWindowDragging || (windowDragPointerId !== null && event.pointerId !== windowDragPointerId)) {
    return;
  }
  cancelWindowDrag();
  sendOverlayResize({ x: window.screenX, y: window.screenY });
}

if (!__skipOverlayResize && dragHandle) {
  on(dragHandle, 'pointerdown', beginWindowDrag);
}
