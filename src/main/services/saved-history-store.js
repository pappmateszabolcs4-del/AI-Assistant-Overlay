const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

const SAVED_HISTORY_FILE = 'saved-history.json';
const MAX_SAVED_ITEMS = 500;

function getSavedHistoryPath() {
  try {
    return path.join(app.getPath('userData'), SAVED_HISTORY_FILE);
  } catch (_) {
    return path.join(os.tmpdir(), SAVED_HISTORY_FILE);
  }
}

function loadSavedHistory() {
  const filePath = getSavedHistoryPath();
  try {
    if (!fs.existsSync(filePath)) {
      return { items: [] };
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed && parsed.items) ? parsed.items : [];
    return { items };
  } catch (_) {
    return { items: [] };
  }
}

function saveSavedHistory(items) {
  const filePath = getSavedHistoryPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify({ items }, null, 2));
  return { success: true };
}

function addSavedHistoryEntry(payload) {
  const question = String(payload && payload.question || '').trim();
  const answer = String(payload && payload.answer || '').trim();
  if (!question && !answer) return { success: false, error: 'missing-content' };
  const timestamp = Number(payload && payload.timestamp);
  const id = Number.isFinite(timestamp) ? timestamp : Date.now();
  const hasImage = !!(payload && payload.hasImage);
  const language = String(payload && payload.language || '').trim();
  const gameContext = String(payload && payload.gameContext || '').trim();

  const existing = loadSavedHistory();
  let items = Array.isArray(existing.items) ? existing.items : [];
  if (items.some((entry) => entry && entry.id === id)) {
    return { success: true, id, deduped: true };
  }

  const next = {
    id,
    question,
    answer,
    hasImage,
    language,
    gameContext,
    savedAt: Date.now()
  };
  items.unshift(next);
  if (items.length > MAX_SAVED_ITEMS) {
    items = items.slice(0, MAX_SAVED_ITEMS);
  }
  const saved = saveSavedHistory(items);
  if (!saved.success) return saved;
  return { success: true, id };
}

function removeSavedHistoryEntry(id) {
  const key = Number(id);
  if (!Number.isFinite(key)) return { success: false, error: 'missing-id' };
  const existing = loadSavedHistory();
  const items = Array.isArray(existing.items) ? existing.items : [];
  const filtered = items.filter((entry) => entry && entry.id !== key);
  const saved = saveSavedHistory(filtered);
  if (!saved.success) return saved;
  return { success: true };
}

module.exports = {
  loadSavedHistory,
  addSavedHistoryEntry,
  removeSavedHistoryEntry
};
