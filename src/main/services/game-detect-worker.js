const path = require('path');
const { execFileSync } = require('child_process');
const { extractGameName } = require('./game-detect-core');

const ACTIVE_WINDOW_SCRIPT = path.join(__dirname, '..', '..', '..', 'get-active-window.ps1');
const ACTIVE_PROCESS_SCRIPT = path.join(__dirname, '..', '..', '..', 'get-active-process.ps1');
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

function getActiveProcessInfo() {
  try {
    const raw = runPowerShell(ACTIVE_PROCESS_SCRIPT, []);
    if (!raw || raw === '{}' ) return null;
    const data = JSON.parse(raw);
    if (!data || (!data.path && !data.name && !data.pid)) return null;
    return {
      pid: typeof data.pid === 'number' ? data.pid : null,
      name: typeof data.name === 'string' ? data.name : '',
      path: typeof data.path === 'string' ? data.path : ''
    };
  } catch (_) {
    return null;
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

function normalizeMatch(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveMappedGame(title, mappings) {
  if (!title || !Array.isArray(mappings) || !mappings.length) return null;
  const normalizedTitle = normalizeMatch(title);
  if (!normalizedTitle) return null;
  for (const entry of mappings) {
    if (!entry || !entry.match || !entry.gameName) continue;
    const needle = normalizeMatch(entry.match);
    if (!needle) continue;
    if (normalizedTitle.includes(needle)) {
      return String(entry.gameName).trim();
    }
  }
  return null;
}

const SCORE_TITLE_MATCH = 4;
const SCORE_MAPPING_MATCH = 6;
const SCORE_THRESHOLD = 4;

function isDevEnv() {
  return String(process.env.APP_ENV || '').toLowerCase() === 'development';
}

function scoreGameTitle(title, ignoreList, mappings) {
  const mappingMatch = resolveMappedGame(title, mappings);
  const titleMatch = extractGameName(title, ignoreList);
  let name = null;
  let score = 0;
  const reasons = [];

  if (mappingMatch) {
    name = mappingMatch;
    score += SCORE_MAPPING_MATCH;
    reasons.push('mapping');
  }

  if (titleMatch) {
    if (!name) {
      name = titleMatch;
      score += SCORE_TITLE_MATCH;
      reasons.push('title');
    } else if (titleMatch === name) {
      score += SCORE_TITLE_MATCH;
      reasons.push('title');
    } else {
      reasons.push('title-mismatch');
    }
  }

  return {
    name,
    score,
    reasons
  };
}

function detectGame(ignoreList, mappings) {
  const activeTitle = getActiveWindowTitle();
  const activeProcess = getActiveProcessInfo();
  let detectedGame = null;
  let matchedTitle = '';

  if (activeTitle) {
    const scored = scoreGameTitle(activeTitle, ignoreList, mappings);
    if (scored && scored.name && scored.score >= SCORE_THRESHOLD) {
      detectedGame = scored.name;
      matchedTitle = activeTitle;
      if (isDevEnv()) {
        console.log(`[GAME-DETECT] Active title score=${scored.score} reasons=${scored.reasons.join(',')}`);
      }
    }
  }

  const fallbackEnabled = String(process.env.GAME_DETECT_GLOBAL_FALLBACK || '').toLowerCase() === '1'
    || String(process.env.GAME_DETECT_GLOBAL_FALLBACK || '').toLowerCase() === 'true';

  if (!detectedGame && fallbackEnabled) {
    const titles = getWindowTitles();
    let best = null;
    for (const title of titles) {
      const scored = scoreGameTitle(title, ignoreList, mappings);
      if (!scored || !scored.name || scored.score < SCORE_THRESHOLD) continue;
      if (!best || scored.score > best.score) {
        best = { title, name: scored.name, score: scored.score, reasons: scored.reasons };
      }
    }
    if (best) {
      detectedGame = best.name;
      matchedTitle = best.title;
      if (isDevEnv()) {
        console.log(`[GAME-DETECT] Fallback title score=${best.score} reasons=${best.reasons.join(',')}`);
      }
    }
  }

  const bounds = matchedTitle ? getWindowBoundsForTitle(matchedTitle) : null;

  return {
    activeTitle,
    matchedTitle,
    gameName: detectedGame,
    activeProcess,
    bounds
  };
}

process.on('message', (msg) => {
  if (!msg || msg.type !== 'detect') return;
  const ignoreList = Array.isArray(msg.ignoreList) ? msg.ignoreList : [];
  const mappings = Array.isArray(msg.mappings) ? msg.mappings : [];
  const t0 = Date.now();
  let payload = null;
  let error = null;

  try {
    payload = detectGame(ignoreList, mappings);
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
