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
    lastOverlayUserMoveAt: 0,
    lastOverlayProgrammaticMoveAt: 0,
    resetInProgress: false,
    lastOverlayRaiseAt: 0,
    gameDisplayFollowTimer: null,
    lastGameFollowAt: 0,
  },
  game: {
    currentDetectedGame: null,
    currentGameContext: null,
    gameDetectIgnoreList: [],
    gameDetectMappings: [],
    currentLanguage: 'en',
    currentSpeechRate: 100,
    lastGameDetectAt: 0,
    lastGameRecognizedAt: 0,
    lastRecognizedGameName: null,
    lastKnownGameDisplayId: null,
    lastKnownGameDisplayAt: 0,
    lastDetectedWindowBounds: null,
    lastDetectedWindowAt: 0,
    lastDetectedWindowTitle: null,
    lastActiveWindowTitle: null,
    lastMatchedWindowTitle: null,
    lastActiveProcessPath: null,
    lastActiveProcessName: null,
    lastActiveProcessId: null,
    lastDetectedInstallPath: null,
    lastDetectedAppId: null,
    lastDetectedGameTitle: null,
    lastDetectedMetadataSource: null
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
