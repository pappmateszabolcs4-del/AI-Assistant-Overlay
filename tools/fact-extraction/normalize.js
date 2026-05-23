const { matchesBlockedPattern } = require('./policy');

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

function hasRejectedPayloadFields(payload, rejectFields) {
  const list = Array.isArray(rejectFields) ? rejectFields : [];
  for (const field of list) {
    if (!field) continue;
    if (payload && Object.prototype.hasOwnProperty.call(payload, field)) {
      const value = payload[field];
      if (typeof value === 'string' && value.trim()) return field;
      if (Array.isArray(value) && value.length) return field;
      if (value && typeof value === 'object') return field;
    }
  }
  return '';
}

function normalizeFactPayload(payload, policyInput) {
  const policy = policyInput || {};
  const rejectedField = hasRejectedPayloadFields(payload, policy.rejectPayloadFields);
  if (rejectedField) {
    return { ok: false, error: 'raw-source-persistence' };
  }

  const text = normalizeText(payload && payload.text);
  if (!text) return { ok: false, error: 'missing-text' };
  const maxLength = policy.factLimits ? policy.factLimits.textMaxLength : 0;
  if (maxLength && text.length > maxLength) {
    return { ok: false, error: 'text-too-long' };
  }

  const textLower = text.toLowerCase();
  if (matchesBlockedPattern(textLower, policy.hardFilters ? policy.hardFilters.lorePatterns : [])) {
    return { ok: false, error: 'lore-pattern' };
  }

  const sourceType = normalizeText(payload && payload.sourceType || payload && payload.source || 'user').toLowerCase();
  const allowList = policy.sourcePolicy ? policy.sourcePolicy.allowList : [];
  const blockList = policy.sourcePolicy ? policy.sourcePolicy.blockList : [];
  const blockedPatterns = policy.sourcePolicy ? policy.sourcePolicy.blockedPatterns : [];
  if (allowList.length && !allowList.includes(sourceType)) return { ok: false, error: 'source-not-allowed' };
  if (blockList.includes(sourceType)) return { ok: false, error: 'source-blocked' };
  if (matchesBlockedPattern(sourceType, blockedPatterns)) return { ok: false, error: 'source-blocked-pattern' };

  const keywords = normalizeListEntries(
    payload && payload.keywords,
    policy.factLimits ? policy.factLimits.keywordsMax : 0,
    policy.factLimits ? policy.factLimits.keywordMaxLength : 0
  );
  const tags = normalizeListEntries(
    payload && payload.tags,
    policy.factLimits ? policy.factLimits.tagsMax : 0,
    policy.factLimits ? policy.factLimits.tagMaxLength : 0
  );

  const priority = normalizePriority(payload && payload.priority, policy);
  const confidence = Number.isFinite(payload && payload.confidence)
    ? Math.max(0, Math.min(1, payload.confidence))
    : null;

  const fact = {
    text,
    keywords,
    tags,
    priority
  };

  if (payload && payload.id) fact.id = normalizeText(payload.id);
  if (payload && payload.system) fact.system = normalizeText(payload.system);
  if (payload && payload.gameStage) fact.gameStage = normalizeText(payload.gameStage);
  if (sourceType) fact.sourceType = sourceType;
  if (confidence !== null) fact.confidence = confidence;

  return { ok: true, fact };
}

function normalizeFactList(list, policyInput) {
  const policy = policyInput || {};
  const facts = [];
  const dropReasons = {};
  let dropped = 0;
  let exactDeduped = 0;
  let nearDuplicateMarked = 0;
  const exactDedupeEnabled = policy.dedupe ? policy.dedupe.exact !== false : true;
  const dedupeMap = new Map();
  const entries = Array.isArray(list) ? list : [];
  for (const entry of entries) {
    const result = normalizeFactPayload(entry, policy);
    if (!result.ok) {
      dropped += 1;
      dropReasons[result.error] = (dropReasons[result.error] || 0) + 1;
      continue;
    }
    const fact = result.fact;
    const key = normalizeTextKey(fact.text);
    if (exactDedupeEnabled && key) {
      const existingIndex = dedupeMap.get(key);
      if (typeof existingIndex === 'number') {
        const existing = facts[existingIndex];
        existing.keywords = normalizeListEntries(
          (existing.keywords || []).concat(fact.keywords || []),
          policy.factLimits ? policy.factLimits.keywordsMax : 0,
          policy.factLimits ? policy.factLimits.keywordMaxLength : 0
        );
        existing.tags = normalizeListEntries(
          (existing.tags || []).concat(fact.tags || []),
          policy.factLimits ? policy.factLimits.tagsMax : 0,
          policy.factLimits ? policy.factLimits.tagMaxLength : 0
        );
        existing.priority = Math.max(existing.priority || 0, fact.priority || 0);
        if (Number.isFinite(fact.confidence)) {
          if (!Number.isFinite(existing.confidence)) {
            existing.confidence = fact.confidence;
          } else {
            existing.confidence = Math.max(existing.confidence, fact.confidence);
          }
        }
        if (!existing.system && fact.system) existing.system = fact.system;
        if (!existing.gameStage && fact.gameStage) existing.gameStage = fact.gameStage;
        if (!existing.sourceType && fact.sourceType) existing.sourceType = fact.sourceType;
        dropped += 1;
        exactDeduped += 1;
        dropReasons['dedupe-exact'] = (dropReasons['dedupe-exact'] || 0) + 1;
        continue;
      }
      dedupeMap.set(key, facts.length);
    }
    facts.push(fact);
  }

  const nearDedupe = policy.dedupe && policy.dedupe.nearDuplicate ? policy.dedupe.nearDuplicate : null;
  if (nearDedupe && nearDedupe.enabled) {
    const threshold = Number.isFinite(nearDedupe.threshold) ? nearDedupe.threshold : 0.9;
    const minTokens = Number.isFinite(nearDedupe.minTokens) ? nearDedupe.minTokens : 6;
    const minOverlap = Number.isFinite(nearDedupe.minTokenOverlap) ? nearDedupe.minTokenOverlap : 4;
    const tokenSets = facts.map((fact) => buildTokenSet(tokenizeText(fact.text)));

    for (let i = 1; i < facts.length; i += 1) {
      const tokens = tokenSets[i];
      if (tokens.size < minTokens) continue;
      for (let j = 0; j < i; j += 1) {
        const other = tokenSets[j];
        if (other.size < minTokens) continue;
        const result = computeTokenOverlap(tokens, other);
        if (result.similarity < threshold) continue;
        if (result.overlap < minOverlap) continue;

        const groupId = `nd-${hashText(facts[j].text)}`;
        if (!facts[j].nearDuplicateGroup) {
          facts[j].nearDuplicateGroup = groupId;
        }
        facts[i].nearDuplicateGroup = groupId;
        facts[i].nearDuplicateScore = Number(result.similarity.toFixed(2));
        nearDuplicateMarked += 1;
        break;
      }
    }
  }

  return {
    facts,
    dropped,
    dropReasons,
    exactDeduped,
    nearDuplicateMarked
  };
}

module.exports = {
  normalizeFactPayload,
  normalizeFactList
};
