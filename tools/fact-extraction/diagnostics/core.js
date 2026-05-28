function initCoreDiagnostics() {
  return {
    total: 0,
    coreCoverageShare: 0,
    partialCoreShare: 0,
    avgCoreCoverage: 0,
    avgEntityCount: 0,
    structuralCoreShare: 0,
    coreMissingVerboseShare: 0,
    coreMissingMultiSentenceShare: 0
  };
}

function updateCoreDiagnostics(state, fact) {
  state.total += 1;
  const core = fact.mechanicCore || null;
  if (core && core.partial) state.partialCoreShare += 1;
  if (core && core.structuralCore) state.structuralCoreShare += 1;
  if (core && core.coverage) state.avgCoreCoverage += core.coverage;
  if (core && Array.isArray(core.entities)) state.avgEntityCount += core.entities.length;
  if (core && core.coverage >= 3) state.coreCoverageShare += 1;

  const textLength = String(fact.text || '').length;
  const groundingInfo = fact._grounding || {};
  const repStats = groundingInfo.representationStats || null;
  if ((!core || !core.partial) && textLength >= 160) state.coreMissingVerboseShare += 1;
  if ((!core || !core.partial) && repStats && repStats.sentenceCount >= 2) {
    state.coreMissingMultiSentenceShare += 1;
  }
}

function finalizeCoreDiagnostics(state) {
  if (!state.total) return;
  state.coreCoverageShare = Number((state.coreCoverageShare / state.total).toFixed(3));
  state.partialCoreShare = Number((state.partialCoreShare / state.total).toFixed(3));
  state.structuralCoreShare = Number((state.structuralCoreShare / state.total).toFixed(3));
  state.coreMissingVerboseShare = Number((state.coreMissingVerboseShare / state.total).toFixed(3));
  state.coreMissingMultiSentenceShare = Number((state.coreMissingMultiSentenceShare / state.total).toFixed(3));
  state.avgCoreCoverage = Number((state.avgCoreCoverage / state.total).toFixed(2));
  state.avgEntityCount = Number((state.avgEntityCount / state.total).toFixed(2));
}

module.exports = {
  initCoreDiagnostics,
  updateCoreDiagnostics,
  finalizeCoreDiagnostics
};
