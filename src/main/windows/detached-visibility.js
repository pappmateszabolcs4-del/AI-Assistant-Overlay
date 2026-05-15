const { PANEL_IDS } = require('../../shared/panels');
const { appendOverlayDebug } = require('../utils/overlay-debug-log');

const DEBUG_STUTTER_LOG = String(process.env.DEBUG_STUTTER_LOG || '').toLowerCase() === '1'
  || String(process.env.DEBUG_STUTTER_LOG || '').toLowerCase() === 'true';
const DISABLE_SELF_HEAL = String(process.env.DISABLE_SELF_HEAL || '').toLowerCase() === '1'
  || String(process.env.DISABLE_SELF_HEAL || '').toLowerCase() === 'true';

function createDetachedVisibilityManager(deps) {
  const { registry } = deps;
  const { detached } = registry;

  let bringDetachedPanelWindowsToFront = null;
  let createDetachedPanelWindow = null;

  function setBringDetachedPanelWindowsToFront(fn) {
    bringDetachedPanelWindowsToFront = typeof fn === 'function' ? fn : null;
  }

  function setCreateDetachedPanelWindow(fn) {
    createDetachedPanelWindow = typeof fn === 'function' ? fn : null;
  }

  function startDetachedPanelPrewarm() {
    try {
      if (detached.detachedPrewarmStarted) return;
      detached.detachedPrewarmStarted = true;
      // Warm up in the background shortly after the overlay is used.
      setTimeout(() => {
        try {
          if (!createDetachedPanelWindow) return;
          PANEL_IDS.forEach((panelId) => {
            try {
              const existing = detached.detachedPanelWindows.get(panelId);
              if (existing && !existing.isDestroyed()) return;
              createDetachedPanelWindow({ panelId, prewarm: true });
            } catch (_) {}
          });
        } catch (_) {}
      }, 250);
    } catch (_) {}
  }

  function reconcileDetachedPanelWindowsVisibility(reason = '') {
    try {
      const wantVisible = !!detached.detachedWindowsDesiredVisible;
      detached.detachedPanelWindows.forEach((w, pid) => {
        if (!w || w.isDestroyed()) return;
        try {
          // Prewarmed windows are kept hidden until activated by a real detach.
          if (!w.__detachedActive) {
            try { w.setIgnoreMouseEvents(true); } catch (_) {}
            if (typeof w.setOpacity === 'function') {
              try { w.setOpacity(0); } catch (_) {}
            }
            try { w.hide(); } catch (_) {}
            return;
          }

          // If the page finished loading but ready IPC never arrived, treat it as ready.
          if (!w.__detachedReady && w.__detachedDidFinishLoad) {
            w.__detachedReady = true;
          }

          if (!wantVisible) {
            try { w.setIgnoreMouseEvents(true); } catch (_) {}
            if (typeof w.setOpacity === 'function') {
              try { w.setOpacity(0); } catch (_) {}
            }
            try { w.hide(); } catch (_) {}
            return;
          }

          // Want visible: if not ready, keep hidden (we'll show on ready/failsafe).
          if (!w.__detachedReady) {
            try { w.setIgnoreMouseEvents(true); } catch (_) {}
            if (typeof w.setOpacity === 'function') {
              try { w.setOpacity(0); } catch (_) {}
            }
            try { w.hide(); } catch (_) {}
            return;
          }

          // Force show + opacity 1. This is intentionally idempotent.
          try {
            if (typeof w.showInactive === 'function') w.showInactive();
            else w.show();
          } catch (_) {}
          if (typeof w.setOpacity === 'function') {
            try { w.setOpacity(1); } catch (_) {}
          }
          try { w.setIgnoreMouseEvents(false); } catch (_) {}
          try { w.moveTop(); } catch (_) {}
        } catch (err) {
          try { console.warn(`[DETACHED] Reconcile failed for ${pid}: ${err && err.message ? err.message : err}`); } catch (_) {}
        }
      });

      try {
        if (wantVisible && bringDetachedPanelWindowsToFront) bringDetachedPanelWindowsToFront();
      } catch (_) {}

      if (reason && reason !== 'self-heal') {
        try { console.log(`[DETACHED] Reconciled visibility (${reason}) wantVisible=${wantVisible}`); } catch (_) {}
      }
    } catch (_) {}
  }

  function startDetachedSelfHealPulse(durationMs = 2500, intervalMs = 250) {
    if (DISABLE_SELF_HEAL) return;
    try {
      const now = Date.now();
      detached.detachedSelfHealUntil = Math.max(detached.detachedSelfHealUntil || 0, now + Math.max(200, durationMs));
      if (detached.detachedSelfHealTimer) return;
      detached.detachedSelfHealTimer = setInterval(() => {
        try {
          if (DEBUG_STUTTER_LOG) {
            appendOverlayDebug({
              t: new Date().toISOString(),
              event: 'pulse-detached-self-heal',
              intervalMs: Math.max(100, intervalMs)
            });
          }
          if (Date.now() >= detached.detachedSelfHealUntil) {
            try { clearInterval(detached.detachedSelfHealTimer); } catch (_) {}
            detached.detachedSelfHealTimer = null;
            return;
          }
          reconcileDetachedPanelWindowsVisibility('self-heal');
        } catch (_) {}
      }, Math.max(100, intervalMs));
    } catch (_) {}
  }

  return {
    setBringDetachedPanelWindowsToFront,
    setCreateDetachedPanelWindow,
    startDetachedPanelPrewarm,
    startDetachedSelfHealPulse,
    reconcileDetachedPanelWindowsVisibility
  };
}

module.exports = {
  createDetachedVisibilityManager
};
