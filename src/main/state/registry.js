const registry = {
  // Core windows
  win: null,
  overlayWin: null,

  // Overlay state
  overlayOriginalBounds: null,
  clickThrough: false,
  ipcListenersRegistered: false,
  overlayVirtualVisible: false,
  overlayEverShown: false,
  overlayTopmostPulseTimer: null,
  overlayTopmostMode: 'unknown',
  overlayMouseForwardGateTimer: null,
  overlayMouseForwardEnabled: true,
  overlayDetachGuardActive: false,
  overlayHideDuringLoad: false,
  overlayIgnoreMoveUntil: 0,

  // Game detection state
  currentDetectedGame: null,
  currentGameContext: null,
  currentLanguage: 'en',
  currentSpeechRate: 100,
  lastGameDetectAt: 0,
  lastKnownGameDisplayId: null,
  lastKnownGameDisplayAt: 0,
  lastOverlayRaiseAt: 0,

  // Detached windows state
  detachedWindowsDesiredVisible: true,
  detachedPrewarmStarted: false,
  detachedSelfHealTimer: null,
  detachedSelfHealUntil: 0,
  detachedPanelWindows: new Map(),
  detachedPanelLastBounds: new Map(),

  // Pinned windows state
  pinnedHistoryWindows: new Map(),

  // Note panel state
  notePanelWin: null,
  notePanelLastBounds: null,
  notePanelVirtualVisible: false,

  // Info panel state
  infoPanelWin: null,
  infoPanelLastBounds: null,
  infoPanelVirtualVisible: false
};

module.exports = registry;
