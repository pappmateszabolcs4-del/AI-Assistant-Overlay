const { app } = require('electron');
const fs = require('fs');
const path = require('path');

let cachedLogPath = null;

function ensureLogPath() {
  if (cachedLogPath) return cachedLogPath;
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    cachedLogPath = path.join(dir, 'overlay-perf.log');
  } catch (_) {
    cachedLogPath = null;
  }
  return cachedLogPath;
}

function appendOverlayPerf(entry) {
  const logPath = ensureLogPath();
  if (!logPath) return;
  try {
    const line = JSON.stringify(entry);
    fs.appendFile(logPath, `${line}\n`, () => {});
  } catch (_) {}
}

module.exports = {
  appendOverlayPerf
};
