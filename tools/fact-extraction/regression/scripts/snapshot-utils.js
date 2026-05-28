const fs = require('fs');
const path = require('path');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(',')}}`;
}

function writeStableJson(filePath, payload) {
  ensureDir(filePath);
  const json = stableStringify(payload);
  fs.writeFileSync(filePath, `${json}\n`);
}

function writeText(filePath, text) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, text);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return 'n/a';
  return `${(value * 100).toFixed(1)}%`;
}

module.exports = {
  ensureDir,
  writeStableJson,
  writeText,
  formatPercent
};
