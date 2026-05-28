function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function classifyPreservationInterpretation(options) {
  const grounding = options.grounding || {};
  const repStats = options.representationStats || {};
  const utilityArchetype = normalizeArray(options.utilityArchetype);
  const operationalIdentity = normalizeArray(options.operationalIdentity);
  const runtimeUtilityClass = normalizeArray(options.runtimeUtilityClass);
  const runtimeStructure = options.runtimeStructure || {};
  const closureMetrics = options.closureMetrics || {};
  const preservationModel = options.preservationModel || {};

  const compactness = Number.isFinite(repStats.coreDrivenCompactness)
    ? repStats.coreDrivenCompactness
    : (Number.isFinite(repStats.representationCompactness) ? repStats.representationCompactness : 0);

  const transitionCritical = !!preservationModel.transitionCritical;
  const operationalFragment = !!runtimeStructure.operationalFragment;
  const localClosureDominant = !!runtimeStructure.localClosureDominant;
  const boundedContinuation = runtimeStructure.boundedContinuation || {};

  const propagationDepth = Number.isFinite(closureMetrics.propagationDepth)
    ? closureMetrics.propagationDepth
    : 0;
  const continuationFanout = Number.isFinite(closureMetrics.continuationFanout)
    ? closureMetrics.continuationFanout
    : 0;
  const graphRisk = clamp(
    (propagationDepth >= 2 ? 0.4 : 0)
      + (continuationFanout >= 2 ? 0.3 : 0)
      + (runtimeStructure.propagationAware ? 0.2 : 0)
      + (preservationModel.propagationSensitivity >= 0.6 ? 0.1 : 0),
    0,
    1
  );

  const standaloneDominance = clamp(
    (utilityArchetype.includes('standalone-mechanic') ? 0.5 : 0)
      + (compactness >= 0.6 ? 0.3 : 0)
      + (localClosureDominant ? 0.2 : 0),
    0,
    1
  );

  const operationalFragmentWeight = clamp(
    (operationalFragment ? 0.5 : 0)
      + (transitionCritical ? 0.3 : 0)
      + (grounding.operationalContinuation ? 0.2 : 0),
    0,
    1
  );

  const transitionPreservationPotential = clamp(
    (transitionCritical ? 0.4 : 0)
      + (preservationModel.boundedOperationalClosure ? 0.3 : 0)
      + (operationalFragment ? 0.2 : 0)
      + (!localClosureDominant ? 0.1 : 0),
    0,
    1
  );

  const boundednessConfidence = clamp(
    1
      - (graphRisk * 0.6)
      - (preservationModel.continuationBurden >= 0.6 ? 0.2 : 0)
      - (preservationModel.propagationSensitivity >= 0.6 ? 0.2 : 0),
    0,
    1
  );

  let interpretationMode = 'standalone-atom';
  if (transitionCritical && operationalFragment) interpretationMode = 'bounded-operational-fragment';
  else if (operationalFragment) interpretationMode = 'operational-fragment';
  else if (transitionCritical) interpretationMode = 'transition-critical-fragment';

  if (graphRisk >= 0.6 || boundednessConfidence < 0.4) {
    interpretationMode = 'graph-risk-boundary';
  }

  return {
    interpretationMode,
    standaloneDominance: Number(standaloneDominance.toFixed(3)),
    operationalFragmentWeight: Number(operationalFragmentWeight.toFixed(3)),
    transitionPreservationPotential: Number(transitionPreservationPotential.toFixed(3)),
    boundednessConfidence: Number(boundednessConfidence.toFixed(3)),
    graphRisk: Number(graphRisk.toFixed(3))
  };
}

module.exports = {
  classifyPreservationInterpretation
};
