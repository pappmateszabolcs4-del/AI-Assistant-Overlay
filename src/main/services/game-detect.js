const path = require('path');
const { fork } = require('child_process');
const { IPC_CHANNELS } = require('../../shared/ipc-channels');
const { extractGameName, matchGameFromText } = require('./game-detect-core');

const DETECT_MIN_INTERVAL_MS = 2000;
const DETECT_INFLIGHT_TIMEOUT_MS = 5000;
const WINDOW_BOUNDS_MAX_AGE_MS = 5000;

function createGameDetectService(deps) {
  const { registry, screen } = deps;
  const { core, game } = registry;

  const DISABLE_GAME_DETECT = String(process.env.DISABLE_GAME_DETECT || '').toLowerCase() === '1'
    || String(process.env.DISABLE_GAME_DETECT || '').toLowerCase() === 'true';

  let worker = null;
  let workerBusy = false;
  let pendingDetect = false;
  let pendingForce = false;
  let lastDetectRequestAt = 0;
  let inflightTimer = null;
  let requestSeq = 0;

  function ensureWorker() {
    if (worker && !worker.killed) return;
    const workerPath = path.join(__dirname, 'game-detect-worker.js');
    worker = fork(workerPath, [], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
    worker.on('message', handleWorkerMessage);
    worker.on('exit', () => {
      worker = null;
      workerBusy = false;
      if (inflightTimer) {
        clearTimeout(inflightTimer);
        inflightTimer = null;
      }
    });
  }

  function resetWorker() {
    if (inflightTimer) {
      clearTimeout(inflightTimer);
      inflightTimer = null;
    }
    workerBusy = false;
    try { if (worker && !worker.killed) worker.kill(); } catch (_) {}
    worker = null;
  }

  function updateGameContext(result) {
    const prev = game.currentDetectedGame;
    const next = result && result.gameName ? result.gameName : null;
    game.currentDetectedGame = next;
    game.lastDetectedWindowTitle = result && result.activeTitle ? result.activeTitle : null;

    if (result && result.bounds) {
      game.lastDetectedWindowBounds = {
        gameName: next,
        bounds: result.bounds
      };
      game.lastDetectedWindowAt = Date.now();

      try {
        const cx = Math.round((result.bounds.left + result.bounds.right) / 2);
        const cy = Math.round((result.bounds.top + result.bounds.bottom) / 2);
        const display = screen.getDisplayNearestPoint({ x: cx, y: cy });
        if (display && typeof display.id !== 'undefined') {
          game.lastKnownGameDisplayId = display.id;
          game.lastKnownGameDisplayAt = Date.now();
        }
      } catch (_) {}
    }

    if (prev !== next && core && core.overlayWin && !core.overlayWin.isDestroyed()) {
      try { core.overlayWin.webContents.send(IPC_CHANNELS.SET_GAME_CONTEXT, next); } catch (_) {}
    }
  }

  function handleWorkerMessage(msg) {
    if (!msg || msg.type !== 'detect-result') return;

    workerBusy = false;
    if (inflightTimer) {
      clearTimeout(inflightTimer);
      inflightTimer = null;
    }

    if (!msg.error) {
      updateGameContext(msg);
    }

    if (pendingDetect) {
      const force = pendingForce;
      pendingDetect = false;
      pendingForce = false;
      detectCurrentGame(force);
    }
  }

  function getPreferredOverlayDisplay() {
    try {
      const now = Date.now();
      if (game.lastKnownGameDisplayId != null && (now - game.lastKnownGameDisplayAt) < 10 * 60 * 1000) {
        const displays = screen.getAllDisplays();
        const match = displays.find((d) => d && d.id === game.lastKnownGameDisplayId);
        if (match) return match;
      }
    } catch (_) {}
    try {
      return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    } catch (_) {
      return screen.getPrimaryDisplay();
    }
  }

  function tryGetDisplayForGameWindow(gameName) {
    try {
      if (!gameName) return null;
      const cached = game.lastDetectedWindowBounds;
      if (!cached || cached.gameName !== gameName || !cached.bounds) return null;
      if (Date.now() - (game.lastDetectedWindowAt || 0) > WINDOW_BOUNDS_MAX_AGE_MS) return null;
      const cx = Math.round((cached.bounds.left + cached.bounds.right) / 2);
      const cy = Math.round((cached.bounds.top + cached.bounds.bottom) / 2);
      return screen.getDisplayNearestPoint({ x: cx, y: cy });
    } catch (_) {
      return null;
    }
  }

  function detectCurrentGame(force = false) {
    if (DISABLE_GAME_DETECT) return;
    ensureWorker();

    const now = Date.now();
    if (!force && (now - lastDetectRequestAt) < DETECT_MIN_INTERVAL_MS) return;

    if (workerBusy) {
      pendingDetect = true;
      if (force) pendingForce = true;
      return;
    }

    lastDetectRequestAt = now;
    workerBusy = true;
    const id = ++requestSeq;
    const ignoreList = Array.isArray(game.gameDetectIgnoreList) ? game.gameDetectIgnoreList : [];

    try {
      worker.send({ type: 'detect', id, ignoreList });
    } catch (_) {
      resetWorker();
      return;
    }

    inflightTimer = setTimeout(() => {
      resetWorker();
    }, DETECT_INFLIGHT_TIMEOUT_MS);
  }

  function extractGameNameWithIgnoreList(windowTitle) {
    const ignoreList = Array.isArray(game.gameDetectIgnoreList) ? game.gameDetectIgnoreList : [];
    return extractGameName(windowTitle, ignoreList);
  }

  return {
    extractGameName: extractGameNameWithIgnoreList,
    matchGameFromText,
    detectCurrentGame,
    getPreferredOverlayDisplay,
    tryGetDisplayForGameWindow
  };
}

module.exports = {
  createGameDetectService
};
