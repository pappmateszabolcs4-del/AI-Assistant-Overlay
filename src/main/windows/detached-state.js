const { IPC_CHANNELS } = require('../../shared/ipc-channels');

function createDetachedStateSender(deps) {
  const { registry } = deps;

  function sendDetachedPanelsStateToOverlay() {
    try {
      if (!registry.overlayWin || registry.overlayWin.isDestroyed()) return;
      // Only report panels that actually have a live BrowserWindow backing them.
      // If a detached window was destroyed but the map entry was not yet cleaned up
      // (or was left behind by an unexpected shutdown), treating it as detached would
      // permanently hide the corresponding header slot in the main overlay.
      const detached = [];
      registry.detachedPanelWindows.forEach((w, pid) => {
        try {
          // Only report ACTIVE detached windows. Prewarmed windows must not hide header slots.
          if (w && !w.isDestroyed() && w.__detachedActive) detached.push(pid);
        } catch (_) {}
      });
      registry.overlayWin.webContents.send(IPC_CHANNELS.DETACHED_PANELS_STATE, { detached });
    } catch (_) {}
  }

  return {
    sendDetachedPanelsStateToOverlay
  };
}

module.exports = {
  createDetachedStateSender
};
