const path = require('path');
const { fork } = require('child_process');
const { IPC_CHANNELS } = require('../../shared/ipc-channels');
const { extractGameName, matchGameFromText } = require('./game-detect-core');
const { isDev } = require('../../shared/app-env');
const { appendOverlayDebug } = require('../utils/overlay-debug-log');

const DETECT_MIN_INTERVAL_MS = 2000;
const DETECT_INFLIGHT_TIMEOUT_MS = 5000;
const WINDOW_BOUNDS_MAX_AGE_MS = 5000;
const GAME_CONTEXT_STICKY_MS = 30000;
const GAME_CONTEXT_SWITCH_COOLDOWN_MS = 3000;
const GAME_CONTEXT_STABILITY_MATCHES = Math.max(2, Math.min(3,
  Number.parseInt(process.env.GAME_DETECT_STABILITY_MATCHES || '2', 10) || 2
));
const MAPPING_TITLE_MISMATCH_LIMIT = Math.max(2, Math.min(3,
  Number.parseInt(process.env.GAME_MAPPING_TITLE_MISMATCHES || '2', 10) || 2
));

function normalizeMatch(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function logMappingGuard(entry) {
  if (!isDev()) return;
  try {
    console.log(`[GAME-DETECT] mapping-guard ${JSON.stringify(entry)}`);
  } catch (_) {}
  try {
    appendOverlayDebug({ type: 'mapping-guard', ...entry });
  } catch (_) {}
}

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
    const safeResult = applyMappingSafety(result);
    const prev = game.currentDetectedGame;
    const now = Date.now();
    let next = safeResult && safeResult.gameName ? safeResult.gameName : null;
    const withinSticky = prev && (now - (game.lastGameRecognizedAt || 0)) < GAME_CONTEXT_STICKY_MS;
    const canStick = !next && withinSticky;
    const canCooldownSwitch = next && prev && next !== prev
      && (now - (game.lastGameRecognizedAt || 0)) < GAME_CONTEXT_SWITCH_COOLDOWN_MS;
    if (canStick || canCooldownSwitch) {
      next = prev;
    }
    if (next && prev && next !== prev) {
      const candidate = String(next);
      if (game.pendingGameCandidate === candidate) {
        game.pendingGameCandidateCount = (game.pendingGameCandidateCount || 0) + 1;
      } else {
        game.pendingGameCandidate = candidate;
        game.pendingGameCandidateCount = 1;
      }
      if (game.pendingGameCandidateCount < GAME_CONTEXT_STABILITY_MATCHES) {
        next = prev;
      }
    } else {
      game.pendingGameCandidate = null;
      game.pendingGameCandidateCount = 0;
    }
    game.currentDetectedGame = next;
    game.lastDetectedWindowTitle = safeResult && safeResult.activeTitle ? safeResult.activeTitle : null;
    game.lastActiveWindowTitle = safeResult && safeResult.activeTitle ? safeResult.activeTitle : null;
    game.lastMatchedWindowTitle = safeResult && safeResult.matchedTitle
      ? safeResult.matchedTitle
      : (canStick ? game.lastMatchedWindowTitle : null);
    game.lastDetectScore = safeResult && typeof safeResult.detectScore === 'number' ? safeResult.detectScore : null;
    game.lastDetectReasons = safeResult && Array.isArray(safeResult.detectReasons) ? safeResult.detectReasons : null;
    game.lastDetectSignalCount = safeResult && typeof safeResult.detectSignalCount === 'number' ? safeResult.detectSignalCount : null;
    game.lastDetectSource = safeResult && safeResult.detectSource ? String(safeResult.detectSource) : null;
    if (safeResult && safeResult.activeProcess) {
      game.lastActiveProcessPath = safeResult.activeProcess.path || null;
      game.lastActiveProcessName = safeResult.activeProcess.name || null;
      game.lastActiveProcessId = Number.isFinite(safeResult.activeProcess.pid) ? safeResult.activeProcess.pid : null;
      if (!safeResult.metadata || !safeResult.metadata.installPath) {
        game.lastDetectedInstallPath = safeResult.activeProcess.path
          ? path.dirname(safeResult.activeProcess.path)
          : null;
      }
    } else if (!canStick) {
      game.lastActiveProcessPath = null;
      game.lastActiveProcessName = null;
      game.lastActiveProcessId = null;
      game.lastDetectedInstallPath = null;
      game.lastDetectedAppId = null;
      game.lastDetectedGameTitle = null;
      game.lastDetectedMetadataSource = null;
    }

    if (safeResult && safeResult.metadata) {
      game.lastDetectedInstallPath = safeResult.metadata.installPath || game.lastDetectedInstallPath || null;
      game.lastDetectedAppId = safeResult.metadata.appId || null;
      game.lastDetectedGameTitle = safeResult.metadata.title || null;
      game.lastDetectedMetadataSource = safeResult.metadata.source || null;
    }
    game.lastGameDetectAt = now;
    if (safeResult && safeResult.gameName && next === safeResult.gameName) {
      game.lastGameRecognizedAt = now;
      game.lastRecognizedGameName = safeResult.gameName;
    }

    if (safeResult && safeResult.bounds) {
      game.lastDetectedWindowBounds = {
        gameName: next,
        bounds: safeResult.bounds
      };
      game.lastDetectedWindowAt = now;

      try {
        const cx = Math.round((safeResult.bounds.left + safeResult.bounds.right) / 2);
        const cy = Math.round((safeResult.bounds.top + safeResult.bounds.bottom) / 2);
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

  function resetMappingTitleMismatch() {
    game.mappingTitleMismatchCount = 0;
    game.mappingTitleMismatchGame = null;
  }

  function appendMappingReason(result, reason) {
    const reasons = Array.isArray(result.detectReasons) ? [...result.detectReasons] : [];
    if (!reasons.includes(reason)) reasons.push(reason);
    return { ...result, detectReasons: reasons };
  }

  function applyMappingSafety(result) {
    if (!result || !result.mappingInfo) {
      resetMappingTitleMismatch();
      return result;
    }
    const info = result.mappingInfo || {};
    const mappingGame = info.mappingGame ? String(info.mappingGame) : '';
    if (!mappingGame) {
      resetMappingTitleMismatch();
      return result;
    }

    const normalizedMapping = normalizeMatch(mappingGame);
    const titleMatch = info.titleMatch ? String(info.titleMatch) : '';
    const processMatch = info.processMatch ? String(info.processMatch) : '';
    const metadataMatch = info.metadataMatch ? String(info.metadataMatch) : '';

    const processMismatch = processMatch && normalizeMatch(processMatch) !== normalizedMapping;
    const metadataMismatch = metadataMatch && normalizeMatch(metadataMatch) !== normalizedMapping;
    const titleMismatch = titleMatch && normalizeMatch(titleMatch) !== normalizedMapping;

    const hasStrongSignal = Boolean(titleMatch || processMatch || metadataMatch);

    if (processMismatch || metadataMismatch) {
      resetMappingTitleMismatch();
      logMappingGuard({
        status: 'suspended',
        reason: processMismatch ? 'process-mismatch' : 'metadata-mismatch',
        mappingGame,
        processMatch,
        metadataMatch,
        titleMatch
      });
      const fallbackName = processMatch || metadataMatch || titleMatch || null;
      return appendMappingReason({ ...result, gameName: fallbackName }, 'mapping-suspended');
    }

    if (!hasStrongSignal) {
      resetMappingTitleMismatch();
      logMappingGuard({
        status: 'suspended',
        reason: 'weak-signal',
        mappingGame,
        titleMatch
      });
      return appendMappingReason({ ...result, gameName: null }, 'mapping-weak');
    }

    if (titleMismatch) {
      if (game.mappingTitleMismatchGame === mappingGame) {
        game.mappingTitleMismatchCount += 1;
      } else {
        game.mappingTitleMismatchGame = mappingGame;
        game.mappingTitleMismatchCount = 1;
      }

      if (game.mappingTitleMismatchCount >= MAPPING_TITLE_MISMATCH_LIMIT) {
        logMappingGuard({
          status: 'suspended',
          reason: 'title-mismatch',
          mappingGame,
          titleMatch,
          count: game.mappingTitleMismatchCount,
          limit: MAPPING_TITLE_MISMATCH_LIMIT
        });
        const fallbackName = titleMatch || processMatch || metadataMatch || null;
        return appendMappingReason({ ...result, gameName: fallbackName }, 'mapping-suspended');
      }

      logMappingGuard({
        status: 'warning',
        reason: 'title-mismatch',
        mappingGame,
        titleMatch,
        count: game.mappingTitleMismatchCount,
        limit: MAPPING_TITLE_MISMATCH_LIMIT
      });
      return result;
    }

    if (game.mappingTitleMismatchCount || game.mappingTitleMismatchGame) {
      resetMappingTitleMismatch();
    }

    return result;
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
    if (core && core.overlayWin && !core.overlayWin.isDestroyed()) {
      try {
        if (!force && core.overlayWin.isFocused()) return;
      } catch (_) {}
    }
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
    const ignoreList = [];
    const mappings = Array.isArray(game.gameDetectMappings) ? game.gameDetectMappings : [];

    try {
      worker.send({ type: 'detect', id, ignoreList, mappings });
    } catch (_) {
      resetWorker();
      return;
    }

    inflightTimer = setTimeout(() => {
      resetWorker();
    }, DETECT_INFLIGHT_TIMEOUT_MS);
  }

  function extractGameNameWithIgnoreList(windowTitle) {
    return extractGameName(windowTitle, []);
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
