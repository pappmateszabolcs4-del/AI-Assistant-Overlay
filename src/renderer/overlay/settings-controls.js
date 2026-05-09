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

  // If panels are open, changing layout does not trigger a resize.
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

initLayoutModeToggle();
