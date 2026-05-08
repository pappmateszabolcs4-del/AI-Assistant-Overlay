const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const { OpenAI } = require('openai');
const keytar = require('keytar');
require('dotenv').config();
const { clampWindowToWorkArea, rectsOverlap } = require('./src/main/utils/bounds');
const registry = require('./src/main/state/registry');
const { createNotePanelManager } = require('./src/main/windows/note');
const { createInfoPanelManager } = require('./src/main/windows/info');
const { createDetachedWindowsManager } = require('./src/main/windows/detached');
const { createDetachedVisibilityManager } = require('./src/main/windows/detached-visibility');
const { createPinnedWindowsManager } = require('./src/main/windows/pinned');
const { createOverlayManager } = require('./src/main/windows/overlay');
const { createMainWindowManager } = require('./src/main/windows/main-window');
const { createHotkeyManager } = require('./src/main/app/hotkeys');
const { createLifecycleManager } = require('./src/main/app/lifecycle');
const { createUiTextService } = require('./src/main/services/ui-text');
const { createDetachedStateSender } = require('./src/main/windows/detached-state');
const { createGameDetectService } = require('./src/main/services/game-detect');
const { createOpenAIService } = require('./src/main/services/openai');
const { createIpcRegistrar } = require('./src/main/ipc/register');
const { normalizePanelId } = require('./src/shared/panels');

// === NO AGGRESSIVE FLAGS - clean app ===
// Removed: V8CodeCaching, CalculateNativeWinOcclusion, renderer-process-limit (all causing resource hogging)
// Keeping only essential optimizations

let currentLanguage = 'en';
let currentSpeechRate = 100;
let currentGameContext = null; // Aktuálisan detektált játék

const gameDetect = createGameDetectService({
  registry,
  screen
});

const {
  extractGameName,
  detectCurrentGame,
  matchGameFromText,
  getPreferredOverlayDisplay,
  tryGetDisplayForGameWindow
} = gameDetect;

const openaiService = createOpenAIService({
  OpenAI,
  keytar,
  registry,
  detectCurrentGame,
  matchGameFromText,
  getCurrentLanguage: () => currentLanguage
});

const uiText = createUiTextService();
const detachedStateSender = createDetachedStateSender({
  registry
});

const { getNotePanelLabels, getInfoPanelLabels } = uiText;
const { sendDetachedPanelsStateToOverlay } = detachedStateSender;

const detachedVisibility = createDetachedVisibilityManager({
  registry
});

const {
  setBringDetachedPanelWindowsToFront,
  setCreateDetachedPanelWindow,
  startDetachedPanelPrewarm,
  startDetachedSelfHealPulse,
  reconcileDetachedPanelWindowsVisibility
} = detachedVisibility;

// Window and state registry lives in src/main/state/registry.js

const notePanel = createNotePanelManager({
  registry,
  BrowserWindow,
  clampWindowToWorkArea,
  getPreferredOverlayDisplay,
  getCurrentLanguage: () => currentLanguage
});

const infoPanel = createInfoPanelManager({
  registry,
  BrowserWindow,
  clampWindowToWorkArea,
  getPreferredOverlayDisplay,
  getCurrentLanguage: () => currentLanguage
});

const detachedPanels = createDetachedWindowsManager({
  registry,
  BrowserWindow,
  clampWindowToWorkArea,
  getPreferredOverlayDisplay,
  getCurrentLanguage: () => currentLanguage,
  sendDetachedPanelsStateToOverlay,
  startDetachedSelfHealPulse,
  normalizePanelId
});

const pinnedHistory = createPinnedWindowsManager({
  registry,
  BrowserWindow,
  clampWindowToWorkArea
});

const {
  bringDetachedPanelWindowsToFront,
  setDetachedPanelWindowsVisible,
  closeAllDetachedPanelWindows,
  deactivateDetachedPanelWindow,
  createDetachedPanelWindow
} = detachedPanels;

setBringDetachedPanelWindowsToFront(bringDetachedPanelWindowsToFront);
setCreateDetachedPanelWindow(createDetachedPanelWindow);

const {
  bringPinnedHistoryWindowsToFront,
  setPinnedHistoryWindowsVisible,
  closeAllPinnedHistoryWindows,
  createPinnedHistoryWindow
} = pinnedHistory;

const overlayManager = createOverlayManager({
  registry,
  BrowserWindow,
  screen,
  rectsOverlap,
  notePanel,
  bringDetachedPanelWindowsToFront,
  bringPinnedHistoryWindowsToFront,
  closeAllPinnedHistoryWindows,
  closeAllDetachedPanelWindows,
  startDetachedSelfHealPulse,
  reconcileDetachedPanelWindowsVisibility,
  sendDetachedPanelsStateToOverlay,
  getCurrentLanguage: () => currentLanguage
});

const mainWindowManager = createMainWindowManager({
  registry,
  BrowserWindow,
  closeAllPinnedHistoryWindows,
  closeAllDetachedPanelWindows,
  notePanel
});

const {
  ensureOverlayWithinVisibleBounds,
  reassertOverlayTopmost,
  isCursorInsideOverlayChildWindow,
  showOverlayAndRaise,
  sendOverlayCursorPointForHoverEval,
  stopOverlayMouseForwardGate,
  startOverlayMouseForwardGate,
  startOverlayTopmostPulse,
  stopOverlayTopmostPulse,
  setOverlayVirtualVisible,
  hasAnyVisibleDetachedPanelWindow,
  centerOverlayOnDisplay,
  createOverlayWindow
} = overlayManager;

const { createWindow } = mainWindowManager;

const hotkeyManager = createHotkeyManager({
  registry,
  globalShortcut,
  detectCurrentGame,
  showOverlayAndRaise,
  setOverlayVirtualVisible,
  setPinnedHistoryWindowsVisible,
  setDetachedPanelWindowsVisible,
  reconcileDetachedPanelWindowsVisibility,
  notePanel,
  createOverlayWindow,
  getCurrentLanguage: () => currentLanguage
});

const { registerHotkey } = hotkeyManager;

const ipcRegistrar = createIpcRegistrar({
  app,
  BrowserWindow,
  ipcMain,
  screen,
  registry,
  clampWindowToWorkArea,
  ensureOverlayWithinVisibleBounds,
  detectCurrentGame,
  tryGetDisplayForGameWindow,
  getPreferredOverlayDisplay,
  centerOverlayOnDisplay,
  showOverlayAndRaise,
  setOverlayVirtualVisible,
  setPinnedHistoryWindowsVisible,
  setDetachedPanelWindowsVisible,
  reconcileDetachedPanelWindowsVisibility,
  startDetachedSelfHealPulse,
  startDetachedPanelPrewarm,
  notePanel,
  infoPanel,
  createDetachedPanelWindow,
  sendDetachedPanelsStateToOverlay,
  normalizePanelId,
  deactivateDetachedPanelWindow,
  createPinnedHistoryWindow,
  closeAllDetachedPanelWindows,
  closeAllPinnedHistoryWindows,
  openaiService,
  getNotePanelLabels,
  getInfoPanelLabels,
  setCurrentLanguage: (lang) => { currentLanguage = lang; },
  getCurrentLanguage: () => currentLanguage,
  setCurrentSpeechRate: (rate) => { currentSpeechRate = rate; },
  isCursorInsideOverlayChildWindow,
  stopOverlayMouseForwardGate,
  startOverlayMouseForwardGate,
  createOverlayWindow
});

const { registerIpcHandlers } = ipcRegistrar;

const lifecycleManager = createLifecycleManager({
  app,
  screen,
  BrowserWindow,
  globalShortcut,
  registry,
  openaiService,
  registerIpcHandlers,
  createWindow,
  createOverlayWindow,
  ensureOverlayWithinVisibleBounds,
  reassertOverlayTopmost,
  closeAllPinnedHistoryWindows,
  closeAllDetachedPanelWindows,
  notePanel,
  registerHotkey
});

lifecycleManager.setupAppLifecycle();



