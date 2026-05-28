function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTextKey(value) {
  return normalizeText(value).toLowerCase();
}

function tokenizeText(value) {
  const cleaned = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!cleaned) return [];
  return cleaned.split(' ').filter((token) => token.length >= 3);
}

function matchesAny(patterns, text) {
  for (const pattern of patterns) {
    if (pattern.test(text)) return true;
  }
  return false;
}

function buildTokenSet(tokens) {
  const set = new Set();
  for (const token of tokens) set.add(token);
  return set;
}

function computeTokenOverlap(a, b) {
  if (!a.size || !b.size) return { similarity: 0, overlap: 0 };
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let overlap = 0;
  for (const token of small) {
    if (large.has(token)) overlap += 1;
  }
  const union = a.size + b.size - overlap;
  const similarity = union ? overlap / union : 0;
  return { similarity, overlap };
}

function hashText(value) {
  let hash = 5381;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i);
    hash &= 0xffffffff;
  }
  return (hash >>> 0).toString(16);
}

function normalizeListEntries(list, maxEntries, maxLength) {
  const source = Array.isArray(list) ? list : [];
  const dedupe = new Map();
  for (const entry of source) {
    const normalized = normalizeText(entry);
    if (!normalized) continue;
    const trimmed = maxLength ? normalized.slice(0, maxLength).trim() : normalized;
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!dedupe.has(key)) dedupe.set(key, trimmed);
  }
  const values = Array.from(dedupe.values());
  return typeof maxEntries === 'number' && maxEntries >= 0 ? values.slice(0, maxEntries) : values;
}

function mergeDropReasons(base, extra) {
  const output = { ...(base || {}) };
  Object.entries(extra || {}).forEach(([key, value]) => {
    output[key] = (output[key] || 0) + Number(value || 0);
  });
  return output;
}

function normalizePriority(value, policy) {
  if (!policy || !policy.priority) return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const raw = value.trim().toUpperCase();
    if (raw === 'P1') return policy.priority.max;
    if (raw === 'P2') return Math.max(policy.priority.min, Math.min(policy.priority.max, policy.priority.max - 1));
    if (raw === 'P3') return policy.priority.min;
  }
  const numeric = Number.isFinite(value) ? value : policy.priority.default;
  return Math.max(policy.priority.min, Math.min(policy.priority.max, numeric));
}

function normalizeSuggestedPriority(value) {
  if (!value) return 0;
  const raw = String(value).trim().toUpperCase();
  if (raw === 'P1') return 3;
  if (raw === 'P2') return 2;
  if (raw === 'P3') return 1;
  return 0;
}

function clampScore(value) {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

module.exports = {
  normalizeText,
  normalizeTextKey,
  tokenizeText,
  matchesAny,
  buildTokenSet,
  computeTokenOverlap,
  hashText,
  normalizeListEntries,
  mergeDropReasons,
  normalizePriority,
  normalizeSuggestedPriority,
  clampScore
};
