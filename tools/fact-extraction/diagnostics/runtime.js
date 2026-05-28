function buildRuntimeDiagnostics(data) {
  const grounding = data.grounding || {};
  const representationQuality = data.representationQuality || {};
  const compositionDiagnostics = data.compositionDiagnostics || {};
  const coreDiagnostics = data.coreDiagnostics || {};

  const runtimeDiagnostics = {
    fragmentationScore: 0,
    retrievalStitchingPressure: 0,
    operationalContinuityScore: 0,
    retrievalPackability: 0,
    compositionUtility: 0
  };

  const structuralCoreShare = coreDiagnostics.structuralCoreShare || 0;
  const compositionCoverage = compositionDiagnostics.compositionCoverage || 0;
  const lowCompactnessShare = representationQuality.lowCompactnessShare || 0;
  const multiSentenceShare = representationQuality.multiSentenceShare || 0;
  const partialCoreShare = coreDiagnostics.partialCoreShare || 0;

  runtimeDiagnostics.fragmentationScore = Number(Math.min(1, Math.max(0,
    (1 - structuralCoreShare) * 0.4 + lowCompactnessShare * 0.3 + (1 - compositionCoverage) * 0.3
  )).toFixed(3));
  runtimeDiagnostics.retrievalStitchingPressure = Number(Math.min(1, Math.max(0,
    (1 - compositionCoverage) * 0.5 + (1 - structuralCoreShare) * 0.3 + multiSentenceShare * 0.2
  )).toFixed(3));
  runtimeDiagnostics.operationalContinuityScore = Number(Math.min(1, Math.max(0,
    (grounding.localPropagationShare || 0) * 0.3
      + (grounding.constraintChainShare || 0) * 0.2
      + (grounding.downstreamImpactShare || 0) * 0.2
      + (compositionDiagnostics.operationalContinuationShare || 0) * 0.3
  )).toFixed(3));
  runtimeDiagnostics.retrievalPackability = Number(Math.min(1, Math.max(0,
    partialCoreShare * 0.4 + (1 - lowCompactnessShare) * 0.4 + (1 - multiSentenceShare) * 0.2
  )).toFixed(3));
  runtimeDiagnostics.compositionUtility = Number(Math.min(1, Math.max(0,
    (compositionDiagnostics.compositionCoverage || 0) * 0.3
      + (compositionDiagnostics.boundedCompositionShare || 0) * 0.3
      + (compositionDiagnostics.operationalContinuationShare || 0) * 0.4
      - (compositionDiagnostics.compositionDrift || 0) * 0.2
  )).toFixed(3));

  return runtimeDiagnostics;
}

module.exports = {
  buildRuntimeDiagnostics
};
