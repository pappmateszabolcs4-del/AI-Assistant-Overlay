function initRepresentationDiagnostics() {
  return {
    total: 0,
    avgTextLength: 0,
    verboseShare: 0,
    compressionRatioAvg: 0,
    compressedShare: 0,
    tutorialResidueShare: 0,
    mechanicStructureShare: 0,
    avgSentenceCount: 0,
    multiSentenceShare: 0,
    lowCompactnessShare: 0,
    lowUniqueTokenShare: 0,
    coreDrivenCompactShare: 0,
    coreSparseVerboseShare: 0,
    coreSparseMultiSentenceShare: 0,
    compressionRatioCount: 0
  };
}

function updateRepresentationDiagnostics(state, fact) {
  state.total += 1;
  const textLength = String(fact.text || '').length;
  state.avgTextLength += textLength;
  if (textLength >= 160) state.verboseShare += 1;
  const groundingInfo = fact._grounding || {};
  if (groundingInfo.compressed) state.compressedShare += 1;
  if (groundingInfo.adviceTone && !groundingInfo.transformed) {
    state.tutorialResidueShare += 1;
  }
  const repStats = groundingInfo.representationStats || null;
  if (repStats) {
    state.avgSentenceCount += repStats.sentenceCount || 0;
    if (repStats.sentenceCount >= 2) state.multiSentenceShare += 1;
    if (repStats.compactnessScore <= 0.6) state.lowCompactnessShare += 1;
    if (repStats.uniqueTokenShare <= 0.55) state.lowUniqueTokenShare += 1;
    if (repStats.coreDrivenCompactness >= 0.7) state.coreDrivenCompactShare += 1;
    if (repStats.verbose && repStats.coreCoverage <= 1) state.coreSparseVerboseShare += 1;
    if (repStats.sentenceCount >= 2 && repStats.coreCoverage <= 1) {
      state.coreSparseMultiSentenceShare += 1;
    }
  }
  if (groundingInfo.mechanicShape
    && groundingInfo.mechanicShape.hasCondition
    && groundingInfo.mechanicShape.hasEffect
    && (groundingInfo.mechanicShape.stateTransition
      || groundingInfo.mechanicShape.downstreamImpact
      || groundingInfo.mechanicShape.constraintChain
      || groundingInfo.mechanicShape.failureConstraint)) {
    state.mechanicStructureShare += 1;
  }
  if (Number.isFinite(groundingInfo.compressionRatio)) {
    state.compressionRatioAvg += groundingInfo.compressionRatio;
    state.compressionRatioCount += 1;
  }
}

function finalizeRepresentationDiagnostics(state) {
  if (!state.total) return;
  state.avgTextLength = Number((state.avgTextLength / state.total).toFixed(1));
  state.verboseShare = Number((state.verboseShare / state.total).toFixed(3));
  state.compressedShare = Number((state.compressedShare / state.total).toFixed(3));
  state.tutorialResidueShare = Number((state.tutorialResidueShare / state.total).toFixed(3));
  state.mechanicStructureShare = Number((state.mechanicStructureShare / state.total).toFixed(3));
  state.avgSentenceCount = Number((state.avgSentenceCount / state.total).toFixed(2));
  state.multiSentenceShare = Number((state.multiSentenceShare / state.total).toFixed(3));
  state.lowCompactnessShare = Number((state.lowCompactnessShare / state.total).toFixed(3));
  state.lowUniqueTokenShare = Number((state.lowUniqueTokenShare / state.total).toFixed(3));
  state.coreDrivenCompactShare = Number((state.coreDrivenCompactShare / state.total).toFixed(3));
  state.coreSparseVerboseShare = Number((state.coreSparseVerboseShare / state.total).toFixed(3));
  state.coreSparseMultiSentenceShare = Number((state.coreSparseMultiSentenceShare / state.total).toFixed(3));
  state.compressionRatioAvg = state.compressionRatioCount
    ? Number((state.compressionRatioAvg / state.compressionRatioCount).toFixed(3))
    : 0;
}

module.exports = {
  initRepresentationDiagnostics,
  updateRepresentationDiagnostics,
  finalizeRepresentationDiagnostics
};
