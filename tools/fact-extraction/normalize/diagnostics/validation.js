function toList(list) {
  return Array.isArray(list) ? list : [];
}

function safeDiv(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}

function collectCoreKeys(facts) {
  const keys = new Set();
  toList(facts).forEach((fact) => {
    if (fact && fact.mechanicCore && fact.mechanicCore.coreKey) {
      keys.add(fact.mechanicCore.coreKey);
    }
  });
  return keys;
}

function countOperationalContinuation(facts) {
  let count = 0;
  toList(facts).forEach((fact) => {
    if (fact && fact._grounding && fact._grounding.operationalContinuation) count += 1;
  });
  return count;
}

function countRepresentationFlag(facts, flag) {
  let count = 0;
  toList(facts).forEach((fact) => {
    if (fact && fact._grounding && fact._grounding.representation === flag) count += 1;
  });
  return count;
}

function validateRepresentationStability({ baselineFacts, currentFacts }) {
  const baselineList = toList(baselineFacts);
  const currentList = toList(currentFacts);

  const baselineCoreKeys = collectCoreKeys(baselineList);
  const currentCoreKeys = collectCoreKeys(currentList);
  let coreMatches = 0;
  baselineCoreKeys.forEach((key) => {
    if (currentCoreKeys.has(key)) coreMatches += 1;
  });

  const baselineOperational = countOperationalContinuation(baselineList);
  const currentOperational = countOperationalContinuation(currentList);

  const representationShares = {
    baselineExtractive: safeDiv(countRepresentationFlag(baselineList, 'extractive'), baselineList.length),
    baselineInferred: safeDiv(countRepresentationFlag(baselineList, 'inferred'), baselineList.length),
    baselineCompressed: safeDiv(countRepresentationFlag(baselineList, 'compressed'), baselineList.length),
    baselineSynthetic: safeDiv(countRepresentationFlag(baselineList, 'synthetic'), baselineList.length),
    currentExtractive: safeDiv(countRepresentationFlag(currentList, 'extractive'), currentList.length),
    currentInferred: safeDiv(countRepresentationFlag(currentList, 'inferred'), currentList.length),
    currentCompressed: safeDiv(countRepresentationFlag(currentList, 'compressed'), currentList.length),
    currentSynthetic: safeDiv(countRepresentationFlag(currentList, 'synthetic'), currentList.length)
  };

  return {
    paritySnapshotSanity: {
      baselineFacts: baselineList.length,
      currentFacts: currentList.length,
      deltaFacts: currentList.length - baselineList.length
    },
    mechanicRecoverabilitySanity: {
      baselineCoreKeys: baselineCoreKeys.size,
      currentCoreKeys: currentCoreKeys.size,
      corePersistenceShare: safeDiv(coreMatches, baselineCoreKeys.size)
    },
    continuityPreservationSanity: {
      baselineOperationalShare: safeDiv(baselineOperational, baselineList.length),
      currentOperationalShare: safeDiv(currentOperational, currentList.length),
      deltaOperationalShare: safeDiv(currentOperational, currentList.length) - safeDiv(baselineOperational, baselineList.length)
    },
    representationCollapseChecks: representationShares
  };
}

module.exports = {
  validateRepresentationStability
};
