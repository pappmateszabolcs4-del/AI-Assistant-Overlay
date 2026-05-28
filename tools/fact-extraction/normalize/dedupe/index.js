const {
  buildTokenSet,
  computeTokenOverlap,
  hashText,
  normalizeListEntries,
  normalizeTextKey: defaultNormalizeTextKey,
  tokenizeText: defaultTokenizeText
} = require('../shared/utils');

function applyDedupe(facts, policyInput, helpers) {
  const policy = policyInput || {};
  let dropped = 0;
  let exactDeduped = 0;
  let nearDuplicateMarked = 0;
  let nearDuplicateDropped = 0;
  const dropReasons = {};
  const exactDedupeEnabled = policy.dedupe ? policy.dedupe.exact !== false : true;
  const dedupeMap = new Map();
  const normalizeTextKey = helpers && helpers.normalizeTextKey
    ? helpers.normalizeTextKey
    : defaultNormalizeTextKey;
  const tokenizeText = helpers && helpers.tokenizeText
    ? helpers.tokenizeText
    : defaultTokenizeText;

  const output = [];
  for (const fact of facts) {
    const key = normalizeTextKey(fact.text);
    if (exactDedupeEnabled && key) {
      const existingIndex = dedupeMap.get(key);
      if (typeof existingIndex === 'number') {
        const existing = output[existingIndex];
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
      dedupeMap.set(key, output.length);
    }
    output.push(fact);
  }

  const nearDedupe = policy.dedupe && policy.dedupe.nearDuplicate ? policy.dedupe.nearDuplicate : null;
  if (nearDedupe && nearDedupe.enabled) {
    const threshold = Number.isFinite(nearDedupe.threshold) ? nearDedupe.threshold : 0.9;
    const minTokens = Number.isFinite(nearDedupe.minTokens) ? nearDedupe.minTokens : 6;
    const minOverlap = Number.isFinite(nearDedupe.minTokenOverlap) ? nearDedupe.minTokenOverlap : 4;
    const action = String(nearDedupe.action || 'keep').trim().toLowerCase();
    const tokenSets = output.map((fact) => buildTokenSet(tokenizeText(fact.text)));
    const dropIndices = new Set();

    for (let i = 1; i < output.length; i += 1) {
      if (dropIndices.has(i)) continue;
      const tokens = tokenSets[i];
      if (tokens.size < minTokens) continue;
      for (let j = 0; j < i; j += 1) {
        if (dropIndices.has(j)) continue;
        const other = tokenSets[j];
        if (other.size < minTokens) continue;
        const result = computeTokenOverlap(tokens, other);
        if (result.similarity < threshold) continue;
        if (result.overlap < minOverlap) continue;

        if (action === 'drop') {
          dropIndices.add(i);
          dropped += 1;
          nearDuplicateDropped += 1;
          dropReasons['dedupe-near'] = (dropReasons['dedupe-near'] || 0) + 1;
          break;
        }
        const groupId = `nd-${hashText(output[j].text)}`;
        if (!output[j].nearDuplicateGroup) {
          output[j].nearDuplicateGroup = groupId;
        }
        output[i].nearDuplicateGroup = groupId;
        output[i].nearDuplicateScore = Number(result.similarity.toFixed(2));
        nearDuplicateMarked += 1;
        break;
      }
    }

    if (dropIndices.size) {
      const filtered = [];
      for (let i = 0; i < output.length; i += 1) {
        if (!dropIndices.has(i)) filtered.push(output[i]);
      }
      output.length = 0;
      output.push(...filtered);
    }
  }

  return {
    facts: output,
    dropped,
    dropReasons,
    exactDeduped,
    nearDuplicateMarked,
    nearDuplicateDropped
  };
}

module.exports = {
  applyDedupe
};
