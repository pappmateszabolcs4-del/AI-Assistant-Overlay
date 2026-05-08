const { PANEL_IDS } = require('../../shared/panels');

function createDetachedVisibilityManager(deps) {
  const { registry } = deps;

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
      if (registry.detachedPrewarmStarted) return;
      registry.detachedPrewarmStarted = true;
      // Warm up in the background shortly after the overlay is used.
      setTimeout(() => {
        try {
          if (!createDetachedPanelWindow) return;
          PANEL_IDS.forEach((panelId) => {
            try {
              const existing = registry.detachedPanelWindows.get(panelId);
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
      const wantVisible = !!registry.detachedWindowsDesiredVisible;
      registry.detachedPanelWindows.forEach((w, pid) => {
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
    try {
      const now = Date.now();
      registry.detachedSelfHealUntil = Math.max(registry.detachedSelfHealUntil || 0, now + Math.max(200, durationMs));
      if (registry.detachedSelfHealTimer) return;
      registry.detachedSelfHealTimer = setInterval(() => {
        try {
          if (Date.now() >= registry.detachedSelfHealUntil) {
            try { clearInterval(registry.detachedSelfHealTimer); } catch (_) {}
            registry.detachedSelfHealTimer = null;
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
