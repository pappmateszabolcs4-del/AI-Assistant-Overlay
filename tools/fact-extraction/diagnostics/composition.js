function initCompositionDiagnostics() {
  return {
    total: 0,
    compositionCoverage: 0,
    boundedCompositionShare: 0,
    propagationWithoutAnchor: 0,
    compositionDrift: 0,
    localVsCrossFactComposition: { local: 0, crossFact: 0 },
    operationalContinuationShare: 0,
    compositionFalsePositiveRisk: 0,
    retrievalUtilityShare: 0,
    answerUtilityShare: 0,
    operationalUtilityShare: 0,
    continuationLocalShare: 0
  };
}

function updateCompositionDiagnostics(state, fact) {
  state.total += 1;
  const groundingInfo = fact._grounding || {};
  const compositionHints = groundingInfo.compositionHints || null;
  if (compositionHints) {
    state.compositionCoverage += 1;
    if (groundingInfo.anchor
      && groundingInfo.hasCondition
      && groundingInfo.hasEffect
      && (groundingInfo.stateTransition || groundingInfo.downstreamImpact
        || groundingInfo.constraintChain || groundingInfo.failureConstraint
        || groundingInfo.causalChain)) {
      state.boundedCompositionShare += 1;
    }
    if (!groundingInfo.anchor) state.propagationWithoutAnchor += 1;
    if (compositionHints.continuation) state.operationalContinuationShare += 1;
    if (compositionHints.utility && compositionHints.utility.retrieval) {
      state.retrievalUtilityShare += 1;
    }
    if (compositionHints.utility && compositionHints.utility.answer) {
      state.answerUtilityShare += 1;
    }
    if (compositionHints.utility && compositionHints.utility.operational) {
      state.operationalUtilityShare += 1;
    }
    if (compositionHints.continuationScope === 'local') {
      state.continuationLocalShare += 1;
    }
    state.localVsCrossFactComposition.local += 1;
    const core = fact.mechanicCore || null;
    if (!core || !core.structuralCore) state.compositionDrift += 1;
    if (core && core.coverage <= 1) state.compositionFalsePositiveRisk += 1;
  }
}

function finalizeCompositionDiagnostics(state) {
  if (!state.total) return;
  state.compositionCoverage = Number((state.compositionCoverage / state.total).toFixed(3));
  state.boundedCompositionShare = Number((state.boundedCompositionShare / state.total).toFixed(3));
  state.propagationWithoutAnchor = Number((state.propagationWithoutAnchor / state.total).toFixed(3));
  state.operationalContinuationShare = Number((state.operationalContinuationShare / state.total).toFixed(3));
  state.compositionDrift = Number((state.compositionDrift / state.total).toFixed(3));
  state.compositionFalsePositiveRisk = Number((state.compositionFalsePositiveRisk / state.total).toFixed(3));
  state.retrievalUtilityShare = Number((state.retrievalUtilityShare / state.total).toFixed(3));
  state.answerUtilityShare = Number((state.answerUtilityShare / state.total).toFixed(3));
  state.operationalUtilityShare = Number((state.operationalUtilityShare / state.total).toFixed(3));
  state.continuationLocalShare = Number((state.continuationLocalShare / state.total).toFixed(3));
}

module.exports = {
  initCompositionDiagnostics,
  updateCompositionDiagnostics,
  finalizeCompositionDiagnostics
};
