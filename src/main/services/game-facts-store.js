const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

const FACTS_FILE_NAME = 'facts.json';
const FACT_REQUESTS_FILE_NAME = 'fact-requests.json';
const USAGE_FILE_NAME = 'usage.json';

function normalizeGameKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function normalizeRequestKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getGameDataPath(gameName, fileName) {
  const key = normalizeGameKey(gameName);
  if (!key) return null;
  const file = fileName || FACTS_FILE_NAME;
  try {
    return path.join(app.getPath('userData'), 'games', key, file);
  } catch (_) {
    return path.join(os.tmpdir(), 'games', key, file);
  }
}

function getGameFactsPath(gameName) {
  return getGameDataPath(gameName, FACTS_FILE_NAME);
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

function loadFactRequests(gameName) {
  const filePath = getGameDataPath(gameName, FACT_REQUESTS_FILE_NAME);
  if (!filePath) return { requests: [] };
  try {
    if (!fs.existsSync(filePath)) {
      return { requests: [] };
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const requests = Array.isArray(parsed && parsed.requests) ? parsed.requests : [];
    return { requests };
  } catch (_) {
    return { requests: [] };
  }
}

function saveFactRequests(gameName, payload) {
  const filePath = getGameDataPath(gameName, FACT_REQUESTS_FILE_NAME);
  if (!filePath) return { success: false, error: 'missing-game' };
  const requests = Array.isArray(payload && payload.requests) ? payload.requests : [];
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify({ requests }, null, 2));
  return { success: true };
}

function addFactRequest(gameName, payload) {
  const game = String(gameName || '').trim();
  if (!game) return { success: false, error: 'missing-game' };
  const text = String(payload && payload.text || '').trim();
  const intent = String(payload && payload.intent || '').trim();
  const reason = String(payload && payload.reason || '').trim();
  const tags = Array.isArray(payload && payload.tags) ? payload.tags.filter(Boolean) : [];
  const entityType = String(payload && payload.entityType || '').trim();
  const source = String(payload && payload.source || 'user').trim();
  const reliability = String(payload && payload.reliability || 'user').trim();
  const reliabilityRankMap = {
    official: 3,
    trusted: 2,
    community: 1,
    user: 0
  };
  const reliabilityRank = Number.isFinite(payload && payload.reliabilityRank)
    ? payload.reliabilityRank
    : (reliabilityRankMap[reliability] ?? 0);
  if (!text) return { success: false, error: 'missing-text' };

  const existing = loadFactRequests(game);
  const requests = Array.isArray(existing.requests) ? existing.requests : [];
  const normalizedText = normalizeRequestKey(text);
  if (normalizedText) {
    const match = requests.find((entry) => {
      if (!entry || entry.status !== 'open') return false;
      return normalizeRequestKey(entry.text) === normalizedText;
    });
    if (match) {
      return { success: true, id: match.id, deduped: true };
    }
  }
  const id = `fact-req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  requests.push({
    id,
    text,
    intent,
    reason,
    tags,
    entityType,
    source,
    reliability,
    reliabilityRank,
    status: 'open',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    note: ''
  });

  const saved = saveFactRequests(game, { requests });
  if (!saved.success) return saved;
  return { success: true, id };
}

function listFactRequests(gameName, status) {
  const game = String(gameName || '').trim();
  if (!game) return { success: false, error: 'missing-game' };
  const existing = loadFactRequests(game);
  const requests = Array.isArray(existing.requests) ? existing.requests : [];
  const normalizedStatus = String(status || '').trim();
  const filtered = normalizedStatus
    ? requests.filter((entry) => entry && entry.status === normalizedStatus)
    : requests;
  return { success: true, requests: filtered };
}

function updateFactRequest(gameName, payload) {
  const game = String(gameName || '').trim();
  if (!game) return { success: false, error: 'missing-game' };
  const id = String(payload && payload.id || '').trim();
  if (!id) return { success: false, error: 'missing-id' };
  const status = String(payload && payload.status || '').trim();
  const note = String(payload && payload.note || '').trim();

  const existing = loadFactRequests(game);
  const requests = Array.isArray(existing.requests) ? existing.requests : [];
  const target = requests.find((entry) => entry && entry.id === id);
  if (!target) return { success: false, error: 'missing-request' };
  if (status) target.status = status;
  if (note) target.note = note;
  target.updatedAt = Date.now();
  if (status && status !== 'open') {
    target.resolvedAt = Date.now();
  }

  const saved = saveFactRequests(game, { requests });
  if (!saved.success) return saved;
  return { success: true };
}

function loadUsage(gameName) {
  const filePath = getGameDataPath(gameName, USAGE_FILE_NAME);
  if (!filePath) return { usage: null };
  try {
    if (!fs.existsSync(filePath)) {
      return { usage: null };
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return { usage: parsed && typeof parsed === 'object' ? parsed : null };
  } catch (_) {
    return { usage: null };
  }
}

function saveUsage(gameName, usage) {
  const filePath = getGameDataPath(gameName, USAGE_FILE_NAME);
  if (!filePath) return { success: false, error: 'missing-game' };
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(usage || {}, null, 2));
  return { success: true };
}

function updateUsage(gameName, payload) {
  const game = String(gameName || '').trim();
  if (!game) return { success: false, error: 'missing-game' };
  const intent = String(payload && payload.intent || '').trim();
  const highRisk = !!(payload && payload.highRisk);
  const strictUnknown = !!(payload && payload.strictUnknown);
  const unknown = !!(payload && payload.unknown);
  const mode = String(payload && payload.knowledgeMode || '').trim();

  const existing = loadUsage(game).usage || {};
  const next = {
    game,
    totalCount: Number.isFinite(existing.totalCount) ? existing.totalCount : 0,
    highRiskCount: Number.isFinite(existing.highRiskCount) ? existing.highRiskCount : 0,
    unknownCount: Number.isFinite(existing.unknownCount) ? existing.unknownCount : 0,
    strictUnknownCount: Number.isFinite(existing.strictUnknownCount) ? existing.strictUnknownCount : 0,
    lastIntent: intent || existing.lastIntent || '',
    lastKnowledgeMode: mode || existing.lastKnowledgeMode || '',
    lastSeenAt: Date.now()
  };

  next.totalCount += 1;
  if (highRisk) next.highRiskCount += 1;
  if (unknown) next.unknownCount += 1;
  if (strictUnknown) next.strictUnknownCount += 1;

  const saved = saveUsage(game, next);
  if (!saved.success) return saved;
  return { success: true };
}

function getUsage(gameName) {
  const game = String(gameName || '').trim();
  if (!game) return { success: false, error: 'missing-game' };
  return { success: true, usage: loadUsage(game).usage };
}

function computeHotScore(usage) {
  if (!usage || typeof usage !== 'object') return 0;
  const total = Number.isFinite(usage.totalCount) ? usage.totalCount : 0;
  const highRisk = Number.isFinite(usage.highRiskCount) ? usage.highRiskCount : 0;
  const unknown = Number.isFinite(usage.unknownCount) ? usage.unknownCount : 0;
  const strictUnknown = Number.isFinite(usage.strictUnknownCount) ? usage.strictUnknownCount : 0;
  const lastSeenAt = Number.isFinite(usage.lastSeenAt) ? usage.lastSeenAt : 0;
  const daysSince = lastSeenAt ? Math.max(0, (Date.now() - lastSeenAt) / (1000 * 60 * 60 * 24)) : 999;
  const recencyBoost = Math.max(0.5, 1 - (daysSince / 14));
  const base = total + highRisk * 2 + unknown * 1.5 + strictUnknown * 3;
  return Number((base * recencyBoost).toFixed(2));
}

function getHotGames(limit) {
  const maxResults = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 50)) : 10;
  const results = [];
  let gamesDir = '';
  try {
    gamesDir = path.join(app.getPath('userData'), 'games');
  } catch (_) {
    gamesDir = path.join(os.tmpdir(), 'games');
  }
  try {
    if (!fs.existsSync(gamesDir)) return { success: true, games: [] };
    const entries = fs.readdirSync(gamesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const usagePath = path.join(gamesDir, entry.name, USAGE_FILE_NAME);
      if (!fs.existsSync(usagePath)) continue;
      try {
        const raw = fs.readFileSync(usagePath, 'utf8');
        const parsed = JSON.parse(raw);
        const usage = parsed && typeof parsed === 'object' ? parsed : null;
        if (!usage) continue;
        const score = computeHotScore(usage);
        results.push({ game: entry.name, score, usage });
      } catch (_) {
        // ignore malformed usage
      }
    }
  } catch (_) {
    return { success: true, games: [] };
  }
  results.sort((a, b) => b.score - a.score);
  return { success: true, games: results.slice(0, maxResults) };
}

function addFact(gameName, payload) {
  const game = String(gameName || '').trim();
  if (!game) return { success: false, error: 'missing-game' };
  const text = String(payload && payload.text || '').trim();
  if (!text) return { success: false, error: 'missing-text' };
  const keywords = Array.isArray(payload && payload.keywords) ? payload.keywords.filter(Boolean).map(String) : [];
  const tags = Array.isArray(payload && payload.tags) ? payload.tags.filter(Boolean).map(String) : [];
  const priority = Number.isFinite(payload && payload.priority) ? payload.priority : 0;
  const entityType = String(payload && payload.entityType || '').trim();
  const source = String(payload && payload.source || 'user').trim();
  const reliability = String(payload && payload.reliability || 'user').trim();
  const reliabilityRankMap = {
    official: 3,
    trusted: 2,
    community: 1,
    user: 0
  };
  const reliabilityRank = Number.isFinite(payload && payload.reliabilityRank)
    ? payload.reliabilityRank
    : (reliabilityRankMap[reliability] ?? 0);
  const version = Number.isFinite(payload && payload.version) ? payload.version : 1;
  const lastVerified = Number.isFinite(payload && payload.lastVerified) ? payload.lastVerified : null;

  const existing = loadFacts(game);
  const facts = Array.isArray(existing.facts) ? existing.facts : [];
  const id = `fact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  facts.push({
    id,
    text,
    keywords,
    tags,
    priority,
    entityType,
    source,
    reliability,
    reliabilityRank,
    version,
    lastVerified,
    createdAt: Date.now()
  });

  const saved = saveFacts(game, { facts });
  if (!saved.success) return saved;
  return { success: true, id };
}

module.exports = {
  addFact,
  addFactRequest,
  listFactRequests,
  updateFactRequest,
  updateUsage,
  getUsage,
  getHotGames
};
