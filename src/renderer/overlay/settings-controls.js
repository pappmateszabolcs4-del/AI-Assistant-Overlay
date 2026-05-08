// Uses global ipcRenderer/IPC_CHANNELS/STORAGE_KEYS from ipc-helpers.

// Layout mode toggle (manual)
const LAYOUT_STORAGE_KEY = STORAGE_KEYS.OVERLAY_LAYOUT_MODE;
const LAYOUT_MODES = ['horizontal', 'compact', 'stacked'];
let currentLayoutMode = localStorage.getItem(LAYOUT_STORAGE_KEY) || 'horizontal';
if (!LAYOUT_MODES.includes(currentLayoutMode)) currentLayoutMode = 'horizontal';

function getLayoutModeLabel(mode) {
  if (mode === 'compact') return t().layoutCompact || 'Compact (2+1)';
  if (mode === 'stacked') return t().layoutStacked || 'Stacked';
  return t().layoutHorizontal || 'Horizontal';
}

function updateLayoutToggleText() {
  const toggleLayoutBtn = document.getElementById('toggleLayoutBtn');
  if (!toggleLayoutBtn) return;
  toggleLayoutBtn.textContent = `${t().layoutMode || '🧩 Layout mode'}: ${getLayoutModeLabel(currentLayoutMode)}`;
}

function applyLayoutMode(mode, options = {}) {
  const nextMode = LAYOUT_MODES.includes(mode) ? mode : 'horizontal';
  document.body.classList.remove('layout-horizontal', 'layout-compact', 'layout-stacked');
  document.body.classList.add(`layout-${nextMode}`);
  currentLayoutMode = nextMode;
  localStorage.setItem(LAYOUT_STORAGE_KEY, nextMode);
  updateLayoutToggleText();

  if (options && options.notifyMain) {
    try { invokeMain(IPC_CHANNELS.OVERLAY_LAYOUT_SET, { mode: nextMode }); } catch (_) {}
  }

  // If panels are open (floating dropdowns), changing the layout doesn't trigger a window resize,
  // so the popups would remain positioned for the previous layout. Reposition after the DOM reflows.
  // NOTE: defer so initial startup (which calls applyLayoutMode early) can't hit TDZ for later vars.
  try {
    setTimeout(() => {
      try { scheduleRepositionPopups(); } catch (_) {}
    }, 0);
    setTimeout(() => {
      try { scheduleRepositionPopups(); } catch (_) {}
    }, 60);
  } catch (_) {}
}

function initLayoutModeToggle() {
  currentLayoutMode = localStorage.getItem(LAYOUT_STORAGE_KEY) || 'horizontal';
  if (!LAYOUT_MODES.includes(currentLayoutMode)) currentLayoutMode = 'horizontal';
  applyLayoutMode(currentLayoutMode, { notifyMain: false });

  const toggleLayoutBtn = document.getElementById('toggleLayoutBtn');
  if (toggleLayoutBtn) {
    on(toggleLayoutBtn, 'click', () => {
      const idx = LAYOUT_MODES.indexOf(currentLayoutMode);
      const next = LAYOUT_MODES[(idx + 1) % LAYOUT_MODES.length];
      if (__isDetachedPanelWindow) {
        try { invokeMain(IPC_CHANNELS.OVERLAY_LAYOUT_SET, { mode: next }); } catch (_) {}
        return;
      }
      applyLayoutMode(next, { notifyMain: true });
    });
  }
}

ipcRenderer.on(IPC_CHANNELS.OVERLAY_LAYOUT_UPDATED, (_event, payload) => {
  const nextMode = payload && typeof payload === 'object' ? payload.mode : payload;
  if (!nextMode || nextMode === currentLayoutMode) return;
  applyLayoutMode(nextMode, { notifyMain: false });
});

// Settings: Overlay width slider
const overlayWidthSlider = document.getElementById('overlayWidth');
// Optional UI counters; comment out to remove live pixel display
const widthValue = document.getElementById('widthValue');
// overlayContainer already defined elsewhere
function updateOverlayWidthSliderRange(rawMinWidth = null, rawMaxWidth = null) {
  try {
    const fallback = Math.max(900, window.screen.availWidth || 0);
    const nextMin = Number(rawMinWidth);
    const minWidth = Number.isFinite(nextMin) && nextMin > 0 ? Math.round(nextMin) : null;
    const next = Number(rawMaxWidth);
    const nextMax = Number.isFinite(next) && next > 0 ? Math.max(fallback, next) : fallback;
    if (minWidth && minWidth > 0) {
      overlayWidthSlider.min = String(minWidth);
    }
    overlayWidthSlider.max = String(nextMax);
    overlayWidthSlider.step = String(getOverlayWidthStepPx());
  } catch (_) {}
}

updateOverlayWidthSliderRange();

// Discrete slider: split the range into 10 segments.
function getOverlayWidthStepPx() {
  try {
    const min = parseInt(overlayWidthSlider.min || '0', 10) || 0;
    const max = parseInt(overlayWidthSlider.max || '0', 10) || 0;
    const span = Math.max(0, max - min);
    // 10 segments => 11 stops (including min/max). Keep step >= 1px.
    return Math.max(1, Math.round(span / 10));
  } catch (_) {
    return 1;
  }
}

function snapOverlayWidthPx(rawWidth) {
  const min = parseInt(overlayWidthSlider.min || '0', 10) || 0;
  const max = parseInt(overlayWidthSlider.max || String(rawWidth), 10) || rawWidth;
  const step = getOverlayWidthStepPx();
  const w = Number(rawWidth);
  if (!Number.isFinite(w)) return String(min);
  const clamped = Math.max(min, Math.min(max, Math.round(w)));
  const idx = step > 0 ? Math.round((clamped - min) / step) : 0;
  const snapped = Math.max(min, Math.min(max, min + (idx * step)));
  return String(snapped);
}

try {
  overlayWidthSlider.step = String(getOverlayWidthStepPx());
} catch (_) {}

// Load saved width (do not force apply; only update slider display)
const savedWidth = localStorage.getItem(STORAGE_KEYS.OVERLAY_WIDTH) || '650';
overlayWidthSlider.value = snapOverlayWidthPx(savedWidth);
// widthValue.textContent = savedWidth; // disable pixel counter display

// Apply width only on release (prevents overlay jitter while holding the slider)
let overlayWidthPendingValue = null;
let overlayWidthSliderUserActive = false;

function applyOverlayWidthFromSlider() {
  try {
    if (!overlayWidthSlider) return;
    const width = snapOverlayWidthPx(overlayWidthSlider.value);
    if (overlayWidthSlider.value !== width) overlayWidthSlider.value = width;
    overlayWidthPendingValue = width;
    try { localStorage.setItem(STORAGE_KEYS.OVERLAY_WIDTH, width); } catch (_) {}
    if (widthValue) {
      try { widthValue.textContent = width; } catch (_) {}
    }
    sendOverlayResize({ width: parseInt(width, 10) });
  } catch (_) {}
}

// While the user is actively dragging/holding the slider, don't let window resize events
// overwrite its value (that feedback loop causes visible jumping).
try {
  on(overlayWidthSlider, 'pointerdown', () => { overlayWidthSliderUserActive = true; });
  on(overlayWidthSlider, 'pointercancel', () => {
    overlayWidthSliderUserActive = false;
    applyOverlayWidthFromSlider();
    try { scheduleOverlayWidthSliderSync(); } catch (_) {}
  });
  on(overlayWidthSlider, 'blur', () => {
    overlayWidthSliderUserActive = false;
    applyOverlayWidthFromSlider();
    try { scheduleOverlayWidthSliderSync(); } catch (_) {}
  });
  on(document, 'pointerup', () => {
    if (!overlayWidthSliderUserActive) return;
    overlayWidthSliderUserActive = false;
    applyOverlayWidthFromSlider();
    try { scheduleOverlayWidthSliderSync(); } catch (_) {}
  }, true);
} catch (_) {}

// While dragging: update slider value (snapped), but do not resize the window.
on(overlayWidthSlider, 'input', () => {
  const width = snapOverlayWidthPx(overlayWidthSlider.value);
  if (overlayWidthSlider.value !== width) overlayWidthSlider.value = width;
  overlayWidthPendingValue = width;
  try { localStorage.setItem(STORAGE_KEYS.OVERLAY_WIDTH, width); } catch (_) {}
  if (widthValue) {
    try { widthValue.textContent = width; } catch (_) {}
  }
});

// Non-pointer interactions (keyboard) typically fire 'change' when committed.
on(overlayWidthSlider, 'change', () => {
  if (overlayWidthSliderUserActive) return;
  applyOverlayWidthFromSlider();
});

// Keep the width slider synced when the user resizes the overlay via manual drag handles.
// Manual resize updates the BrowserWindow bounds, but does not emit an 'input' event on the slider.
let overlayWidthSyncFrame = null;
function syncOverlayWidthSliderFromValue(rawWidth) {
  try {
    if (!overlayWidthSlider) return;
    if (overlayWidthSliderUserActive) return;
    const nextVal = snapOverlayWidthPx(Math.round(rawWidth));
    if (overlayWidthSlider.value !== nextVal) {
      overlayWidthSlider.value = nextVal;
    }
    try { localStorage.setItem(STORAGE_KEYS.OVERLAY_WIDTH, nextVal); } catch (_) {}
    if (widthValue) {
      try { widthValue.textContent = nextVal; } catch (_) {}
    }
  } catch (_) {}
}

function syncOverlayWidthSliderFromWindow() {
  syncOverlayWidthSliderFromValue(window.innerWidth);
}

function scheduleOverlayWidthSliderSync() {
  if (overlayWidthSyncFrame) return;
  overlayWidthSyncFrame = requestAnimationFrame(() => {
    overlayWidthSyncFrame = null;
    syncOverlayWidthSliderFromWindow();
  });
}

if (!__isDetachedPanelWindow) {
  on(window, 'resize', scheduleOverlayWidthSliderSync);
  // Initial sync (in case the window width differs from persisted value).
  try { setTimeout(syncOverlayWidthSliderFromWindow, 0); } catch (_) {}
} else {
  // Detached windows should follow the main overlay width, not their own window size.
  try { setTimeout(() => syncOverlayWidthSliderFromValue(savedWidth), 0); } catch (_) {}
}

ipcRenderer.on(IPC_CHANNELS.OVERLAY_BOUNDS_UPDATED, (_event, payload) => {
  if (!payload || typeof payload.width !== 'number') return;
  if (typeof payload.maxWidth === 'number' || typeof payload.minWidth === 'number') {
    updateOverlayWidthSliderRange(payload.minWidth, payload.maxWidth);
  }
  syncOverlayWidthSliderFromValue(payload.width);
});

initLayoutModeToggle();
