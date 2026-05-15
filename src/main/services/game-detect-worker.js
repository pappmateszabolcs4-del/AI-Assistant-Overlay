const path = require('path');
const { execFileSync } = require('child_process');
const { extractGameName } = require('./game-detect-core');

const ACTIVE_WINDOW_SCRIPT = path.join(__dirname, '..', '..', '..', 'get-active-window.ps1');
const WINDOW_TITLES_SCRIPT = path.join(__dirname, '..', '..', '..', 'get-window-titles.ps1');
const WINDOW_BOUNDS_SCRIPT = path.join(__dirname, '..', '..', '..', 'get-window-bounds.ps1');

function runPowerShell(scriptPath, args) {
  return execFileSync('powershell', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath,
    ...(args || [])
  ], {
    encoding: 'utf8',
    timeout: 2000,
    windowsHide: true
  }).trim();
}

function getActiveWindowTitle() {
  try {
    return runPowerShell(ACTIVE_WINDOW_SCRIPT, []);
  } catch (_) {
    return '';
  }
}

function getWindowTitles() {
  try {
    const raw = runPowerShell(WINDOW_TITLES_SCRIPT, []);
    return raw
      .split(/\r?\n/)
      .map((t) => t.trim())
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function getWindowBoundsForTitle(title) {
  try {
    if (!title) return null;
    const safe = String(title).replace(/"/g, '');
    const raw = runPowerShell(WINDOW_BOUNDS_SCRIPT, ['-TitleContains', safe]);
    if (!raw || raw === '{}' ) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.left !== 'number' || typeof data.top !== 'number'
      || typeof data.right !== 'number' || typeof data.bottom !== 'number') {
      return null;
    }
    return data;
  } catch (_) {
    return null;
  }
}

function detectGame(ignoreList) {
  const activeTitle = getActiveWindowTitle();
  let detectedGame = null;

  if (activeTitle) {
    detectedGame = extractGameName(activeTitle, ignoreList);
  }

  if (!detectedGame) {
    const titles = getWindowTitles();
    for (const title of titles) {
      const game = extractGameName(title, ignoreList);
      if (game) {
        detectedGame = game;
        break;
      }
    }
  }

  const bounds = detectedGame ? getWindowBoundsForTitle(detectedGame) : null;

  return {
    activeTitle,
    gameName: detectedGame,
    bounds
  };
}

process.on('message', (msg) => {
  if (!msg || msg.type !== 'detect') return;
  const ignoreList = Array.isArray(msg.ignoreList) ? msg.ignoreList : [];
  const t0 = Date.now();
  let payload = null;
  let error = null;

  try {
    payload = detectGame(ignoreList);
  } catch (err) {
    error = err && err.message ? err.message : String(err || 'detect-failed');
  }

  if (process.send) {
    process.send({
      type: 'detect-result',
      id: msg.id,
      dtMs: Date.now() - t0,
      error,
      ...payload
    });
  }
});
