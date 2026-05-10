// Uses global ipcRenderer and IPC_CHANNELS from ipc-helpers.

// Window role detection (main overlay vs detached panel BrowserWindow)
const __urlParams = new URLSearchParams(window.location.search || '');
const __windowRole = (__urlParams.get('role') || 'main').toLowerCase();
const __panelId = (__urlParams.get('panel') || '').toLowerCase();
const __blockId = (__urlParams.get('block') || '').toLowerCase();
const __isDetachedPanelWindow = __windowRole === 'detached' && (__panelId === 'ask' || __panelId === 'history' || __panelId === 'settings');
const __isBlockWindow = __windowRole === 'block' && !!__blockId;

// Main overlay boot gating: hide the header panel slots until we have both
// language + detached-panels-state from main. This prevents any transient
// "docked content" flash on Ctrl+R.
let __bootingMainOverlay = !__isDetachedPanelWindow && !__isBlockWindow;
let __bootLangReady = false;
let __bootDetachedReady = false;

function __maybeFinishBoot() {
  if (!__bootingMainOverlay) return;
  if (!__bootLangReady) return;
  if (!__bootDetachedReady) return;
  __bootingMainOverlay = false;
  try { document.body.classList.remove('booting'); } catch (_) {}
}

if (!__isDetachedPanelWindow) {
  try { document.body.classList.add('booting'); } catch (_) {}
  // Failsafe: do not stay invisible forever if IPC is delayed.
  try {
    setTimeout(() => {
      if (!__bootingMainOverlay) return;
      __bootingMainOverlay = false;
      try { document.body.classList.remove('booting'); } catch (_) {}
    }, 2000);
  } catch (_) {}
}

if (__isDetachedPanelWindow) {
  document.body.classList.add('panel-mode');

  // Detached panel windows: signal to the main process as early as possible when the
  // renderer is ready so the BrowserWindow can be shown without waiting for all
  // overlay wiring to finish. This reduces the "invisible drag" gap.
  try {
    requestAnimationFrame(() => {
      try {
        ipcRenderer.send(IPC_CHANNELS.DETACHED_PANEL_READY, { panelId: __panelId });
      } catch (_) {}
    });
  } catch (_) {
    try { ipcRenderer.send(IPC_CHANNELS.DETACHED_PANEL_READY, { panelId: __panelId }); } catch (_) {}
  }
} else {
  // Intentionally do NOT force any initial docked/detached state here.
  // We keep the header slots hidden (booting) until main sends authoritative
  // detached-panels-state to avoid any flicker.
}

if (__isBlockWindow) {
  document.body.classList.add('block-mode');
}
