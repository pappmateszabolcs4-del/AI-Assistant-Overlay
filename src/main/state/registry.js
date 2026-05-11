const registry = {
  core: {
    win: null,
    overlayWin: null
  },
  overlay: {
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
    lastOverlayRaiseAt: 0,
    gameDisplayFollowTimer: null,
    lastGameFollowAt: 0,
  },
  game: {
    currentDetectedGame: null,
    currentGameContext: null,
    gameDetectIgnoreList: [],
    currentLanguage: 'en',
    currentSpeechRate: 100,
    lastGameDetectAt: 0,
    lastKnownGameDisplayId: null,
    lastKnownGameDisplayAt: 0
  },
  detached: {
    detachedWindowsDesiredVisible: true,
    detachedPrewarmStarted: false,
    detachedSelfHealTimer: null,
    detachedSelfHealUntil: 0,
    detachedPanelWindows: new Map(),
    detachedPanelLastBounds: new Map(),
    detachedPanelDesiredBounds: new Map(),
    detachedPanelPerfStarts: new Map()
  },
  pinned: {
    pinnedHistoryWindows: new Map(),
    pinnedHistoryPerfStarts: new Map()
  },
  blocks: {
    detachedBlockWindows: new Map(),
    blockLastBounds: new Map(),
    blockPerfStarts: new Map(),
    blockPrewarmStarted: false
  },
  note: {
    notePanelWin: null,
    notePanelLastBounds: null,
    notePanelVirtualVisible: false
  },
  info: {
    infoPanelWin: null,
    infoPanelLastBounds: null,
    infoPanelVirtualVisible: false
  },
  layout: {
    windowLayouts: new Map(),
    lastDisplaySnapshot: [],
    lastDisplaySnapshotAt: 0,
    lastDisplaySnapshotReason: 'init',
    loadedFromStorage: false
  }
};

module.exports = registry;
