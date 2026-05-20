const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

const FACTS_FILE_NAME = 'facts.json';

function normalizeGameKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function getGameFactsPath(gameName) {
  const key = normalizeGameKey(gameName);
  if (!key) return null;
  try {
    return path.join(app.getPath('userData'), 'games', key, FACTS_FILE_NAME);
  } catch (_) {
    return path.join(os.tmpdir(), 'games', key, FACTS_FILE_NAME);
  }
}

function loadFacts(gameName) {
  const filePath = getGameFactsPath(gameName);
  if (!filePath) return { facts: [] };
  try {
    if (!fs.existsSync(filePath)) {
      return { facts: [] };
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const facts = Array.isArray(parsed && parsed.facts) ? parsed.facts : [];
    return { facts };
  } catch (_) {
    return { facts: [] };
  }
}

function saveFacts(gameName, payload) {
  const filePath = getGameFactsPath(gameName);
  if (!filePath) return { success: false, error: 'missing-game' };
  const facts = Array.isArray(payload && payload.facts) ? payload.facts : [];
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify({ facts }, null, 2));
  return { success: true };
}

function addFact(gameName, payload) {
  const game = String(gameName || '').trim();
  if (!game) return { success: false, error: 'missing-game' };
  const text = String(payload && payload.text || '').trim();
  if (!text) return { success: false, error: 'missing-text' };
  const keywords = Array.isArray(payload && payload.keywords) ? payload.keywords.filter(Boolean) : [];
  const tags = Array.isArray(payload && payload.tags) ? payload.tags.filter(Boolean) : [];
  const priority = Number.isFinite(payload && payload.priority) ? payload.priority : 0;

  const existing = loadFacts(game);
  const facts = Array.isArray(existing.facts) ? existing.facts : [];
  const id = `fact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  facts.push({
    id,
    text,
    keywords,
    tags,
    priority,
    createdAt: Date.now()
  });

  const saved = saveFacts(game, { facts });
  if (!saved.success) return saved;
  return { success: true, id };
}

module.exports = {
  addFact
};
