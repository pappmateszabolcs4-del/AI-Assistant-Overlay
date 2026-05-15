const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { isDev } = require('../../shared/app-env');

let cachedLogPath = null;

function ensureLogPath() {
  if (cachedLogPath) return cachedLogPath;
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    cachedLogPath = path.join(dir, 'overlay-bounds.log');
  } catch (_) {
    cachedLogPath = null;
  }
  return cachedLogPath;
}

function appendOverlayDebug(entry) {
  if (!isDev()) return;
  const logPath = ensureLogPath();
  if (!logPath) return;
  try {
    const line = JSON.stringify(entry);
    fs.appendFile(logPath, `${line}\n`, () => {});
  } catch (_) {}
}

function getOverlayDebugLogPath() {
  return ensureLogPath();
}

module.exports = {
  appendOverlayDebug,
  getOverlayDebugLogPath
};
