const fs = require('fs');
const path = require('path');

const DEFAULT_POLICY_PATH = path.join(__dirname, '..', '..', 'data', 'fact-extraction-policy.json');

function getDefaultPolicy() {
  return {
    version: 1,
    sourcePolicy: {
      allowList: ['user'],
      blockList: [],
      blockedPatterns: []
    },
    factLimits: {
      textMaxLength: 240,
      keywordsMax: 12,
      tagsMax: 8,
      keywordMaxLength: 48,
      tagMaxLength: 32
    },
    priority: {
      min: 1,
      max: 3,
      default: 2
    },
    hardFilters: {
      lorePatterns: []
    },
    rejectPayloadFields: ['sourceText', 'rawSource', 'sourceContent', 'rawContent', 'fullText', 'pageText'],
    dedupe: {
      exact: true,
      nearDuplicate: {
        enabled: true,
        threshold: 0.9,
        minTokens: 6,
        minTokenOverlap: 4
      }
    }
  };
}

function normalizeStringList(list) {
  return (Array.isArray(list) ? list : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
}

function normalizePolicy(raw) {
  const base = getDefaultPolicy();
  const policy = raw && typeof raw === 'object' ? raw : {};
  const sourcePolicy = policy.sourcePolicy || {};
  const factLimits = policy.factLimits || {};
  const priority = policy.priority || {};
  const hardFilters = policy.hardFilters || {};
  const dedupe = policy.dedupe || {};
  const nearDuplicate = dedupe.nearDuplicate || {};
  return {
    version: Number.isFinite(policy.version) ? policy.version : base.version,
    sourcePolicy: {
      allowList: normalizeStringList(sourcePolicy.allowList).map((entry) => entry.toLowerCase()),
      blockList: normalizeStringList(sourcePolicy.blockList).map((entry) => entry.toLowerCase()),
      blockedPatterns: normalizeStringList(sourcePolicy.blockedPatterns).map((entry) => entry.toLowerCase())
    },
    factLimits: {
      textMaxLength: Number.isFinite(factLimits.textMaxLength) ? factLimits.textMaxLength : base.factLimits.textMaxLength,
      keywordsMax: Number.isFinite(factLimits.keywordsMax) ? factLimits.keywordsMax : base.factLimits.keywordsMax,
      tagsMax: Number.isFinite(factLimits.tagsMax) ? factLimits.tagsMax : base.factLimits.tagsMax,
      keywordMaxLength: Number.isFinite(factLimits.keywordMaxLength) ? factLimits.keywordMaxLength : base.factLimits.keywordMaxLength,
      tagMaxLength: Number.isFinite(factLimits.tagMaxLength) ? factLimits.tagMaxLength : base.factLimits.tagMaxLength
    },
    priority: {
      min: Number.isFinite(priority.min) ? priority.min : base.priority.min,
      max: Number.isFinite(priority.max) ? priority.max : base.priority.max,
      default: Number.isFinite(priority.default) ? priority.default : base.priority.default
    },
    hardFilters: {
      lorePatterns: normalizeStringList(hardFilters.lorePatterns).map((entry) => entry.toLowerCase())
    },
    rejectPayloadFields: normalizeStringList(policy.rejectPayloadFields || base.rejectPayloadFields),
    dedupe: {
      exact: dedupe.exact === false ? false : true,
      nearDuplicate: {
        enabled: nearDuplicate.enabled === false ? false : true,
        threshold: Number.isFinite(nearDuplicate.threshold) ? nearDuplicate.threshold : base.dedupe.nearDuplicate.threshold,
        minTokens: Number.isFinite(nearDuplicate.minTokens) ? nearDuplicate.minTokens : base.dedupe.nearDuplicate.minTokens,
        minTokenOverlap: Number.isFinite(nearDuplicate.minTokenOverlap)
          ? nearDuplicate.minTokenOverlap
          : base.dedupe.nearDuplicate.minTokenOverlap
      }
    }
  };
}

function loadPolicy(policyPath) {
  const resolvedPath = policyPath ? path.resolve(policyPath) : DEFAULT_POLICY_PATH;
  try {
    if (!fs.existsSync(resolvedPath)) {
      return { policy: getDefaultPolicy(), path: resolvedPath, loaded: false };
    }
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    const parsed = JSON.parse(raw);
    return { policy: normalizePolicy(parsed), path: resolvedPath, loaded: true };
  } catch (_) {
    return { policy: getDefaultPolicy(), path: resolvedPath, loaded: false };
  }
}

function matchesBlockedPattern(value, patterns) {
  const text = String(value || '').toLowerCase();
  if (!text) return false;
  return (Array.isArray(patterns) ? patterns : []).some((pattern) => pattern && text.includes(pattern));
}

function validateSourceType(sourceType, policy) {
  const value = String(sourceType || '').trim().toLowerCase();
  const allowList = policy && policy.sourcePolicy ? policy.sourcePolicy.allowList : [];
  const blockList = policy && policy.sourcePolicy ? policy.sourcePolicy.blockList : [];
  const blockedPatterns = policy && policy.sourcePolicy ? policy.sourcePolicy.blockedPatterns : [];
  if (!value) return { ok: false, error: 'missing-source-type' };
  if (allowList.length && !allowList.includes(value)) return { ok: false, error: 'source-not-allowed' };
  if (blockList.includes(value)) return { ok: false, error: 'source-blocked' };
  if (matchesBlockedPattern(value, blockedPatterns)) return { ok: false, error: 'source-blocked-pattern' };
  return { ok: true, sourceType: value };
}

function validateSourceUrl(url, policy) {
  const raw = String(url || '').trim();
  if (!raw) return { ok: false, error: 'missing-url' };
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    return { ok: false, error: 'invalid-url' };
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    return { ok: false, error: 'unsupported-url-scheme' };
  }
  const blockList = policy && policy.sourcePolicy ? policy.sourcePolicy.blockList : [];
  const blockedPatterns = policy && policy.sourcePolicy ? policy.sourcePolicy.blockedPatterns : [];
  const rawLower = raw.toLowerCase();
  if (blockList.some((entry) => entry && rawLower.includes(entry))) {
    return { ok: false, error: 'source-blocked' };
  }
  if (matchesBlockedPattern(rawLower, blockedPatterns)) {
    return { ok: false, error: 'source-blocked-pattern' };
  }
  return { ok: true, url: raw, host: parsed.host };
}

module.exports = {
  getDefaultPolicy,
  loadPolicy,
  matchesBlockedPattern,
  validateSourceType,
  validateSourceUrl
};
