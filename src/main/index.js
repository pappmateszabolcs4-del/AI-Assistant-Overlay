const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const { OpenAI } = require('openai');
const keytar = require('keytar');
require('dotenv').config();
const { clampWindowToWorkArea, rectsOverlap } = require('./utils/bounds');
const registry = require('./state/registry');
const { createNotePanelManager } = require('./windows/note');
const { createInfoPanelManager } = require('./windows/info');
const { createDetachedWindowsManager } = require('./windows/detached');
const { createDetachedVisibilityManager } = require('./windows/detached-visibility');
const { createPinnedWindowsManager } = require('./windows/pinned');
const { createOverlayManager } = require('./windows/overlay');
const { createMainWindowManager } = require('./windows/main-window');
const { createHotkeyManager } = require('./app/hotkeys');
const { createLifecycleManager } = require('./app/lifecycle');
const { createDetachedStateSender } = require('./windows/detached-state');
const { createGameDetectService } = require('./services/game-detect');
const { createOpenAIService } = require('./services/openai');
const { createIpcRegistrar } = require('./ipc/register');
const { normalizePanelId } = require('../shared/panels');

// === NO AGGRESSIVE FLAGS - clean app ===
// Removed: V8CodeCaching, CalculateNativeWinOcclusion, renderer-process-limit (all causing resource hogging)
// Keeping only essential optimizations

registry.currentLanguage = registry.currentLanguage || 'en';
registry.currentSpeechRate = Number.isFinite(registry.currentSpeechRate)
  ? registry.currentSpeechRate
  : 100;
registry.currentGameContext = registry.currentGameContext || null;

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
  getCurrentLanguage: () => registry.currentLanguage
});

const detachedStateSender = createDetachedStateSender({
  registry
});

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
  getCurrentLanguage: () => registry.currentLanguage
});

const infoPanel = createInfoPanelManager({
  registry,
  BrowserWindow,
  clampWindowToWorkArea,
  getPreferredOverlayDisplay,
  getCurrentLanguage: () => registry.currentLanguage
});

const detachedPanels = createDetachedWindowsManager({
  registry,
  BrowserWindow,
  clampWindowToWorkArea,
  getPreferredOverlayDisplay,
  getCurrentLanguage: () => registry.currentLanguage,
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
  getCurrentLanguage: () => registry.currentLanguage
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
  getCurrentLanguage: () => registry.currentLanguage
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
  setCurrentLanguage: (lang) => { registry.currentLanguage = lang; },
  getCurrentLanguage: () => registry.currentLanguage,
  setCurrentSpeechRate: (rate) => { registry.currentSpeechRate = rate; },
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
