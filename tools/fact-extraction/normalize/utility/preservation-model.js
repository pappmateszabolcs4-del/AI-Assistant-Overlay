function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function classifyPreservationModel(options) {
  const grounding = options.grounding || {};
  const repStats = options.representationStats || {};
  const utilityArchetype = normalizeArray(options.utilityArchetype);
  const operationalIdentity = normalizeArray(options.operationalIdentity);
  const runtimeUtilityClass = normalizeArray(options.runtimeUtilityClass);
  const runtimeStructure = options.runtimeStructure || {};
  const closureMetrics = options.closureMetrics || {};

  const compactness = Number.isFinite(repStats.coreDrivenCompactness)
    ? repStats.coreDrivenCompactness
    : (Number.isFinite(repStats.representationCompactness) ? repStats.representationCompactness : 0);

  const transitionCritical = !!(
    runtimeStructure.boundedContinuation
    && runtimeStructure.boundedContinuation.transition
  ) || runtimeUtilityClass.includes('state-transition')
    || operationalIdentity.includes('operational-transition-system')
    || grounding.stateTransition
    || grounding.constraintChain
    || grounding.causalChain;

  const continuationLinked = !!runtimeStructure.continuationLinked
    || utilityArchetype.includes('continuity-bearing')
    || grounding.operationalContinuation;

  const propagationDepth = Number.isFinite(closureMetrics.propagationDepth)
    ? closureMetrics.propagationDepth
    : 0;
  const continuationFanout = Number.isFinite(closureMetrics.continuationFanout)
    ? closureMetrics.continuationFanout
    : 0;
  const operationalClosureCost = Number.isFinite(closureMetrics.operationalClosureCost)
    ? closureMetrics.operationalClosureCost
    : 0;

  const continuationBurden = clamp(
    operationalClosureCost * 0.4
      + Math.min(1, propagationDepth / 4) * 0.35
      + Math.min(1, continuationFanout / 4) * 0.25,
    0,
    1
  );

  const boundedOperationalClosure = !!(
    runtimeStructure.boundedContinuation
    && (runtimeStructure.boundedContinuation.condition
      || runtimeStructure.boundedContinuation.transition
      || runtimeStructure.boundedContinuation.consequence)
    && !runtimeStructure.localClosureDominant
  );

  const standaloneCollapseRisk = clamp(
    (utilityArchetype.includes('standalone-mechanic') ? 0.4 : 0)
      + (compactness >= 0.6 ? 0.3 : 0)
      + (runtimeStructure.localClosureDominant ? 0.2 : 0)
      + (!continuationLinked && runtimeStructure.operationalFragment ? 0.1 : 0),
    0,
    1
  );

  const propagationSensitivity = clamp(
    Math.min(1, propagationDepth / 4)
      + (runtimeUtilityClass.includes('dependency-resolution') ? 0.2 : 0)
      + (runtimeUtilityClass.includes('routing-critical') ? 0.1 : 0)
      + (runtimeUtilityClass.includes('interruption-sensitive') ? 0.1 : 0)
      + (runtimeUtilityClass.includes('downstream-impact') ? 0.2 : 0),
    0,
    1
  );

  return {
    transitionCritical: !!transitionCritical,
    continuationBurden: Number(continuationBurden.toFixed(3)),
    boundedOperationalClosure: !!boundedOperationalClosure,
    standaloneCollapseRisk: Number(standaloneCollapseRisk.toFixed(3)),
    propagationSensitivity: Number(propagationSensitivity.toFixed(3))
  };
}

module.exports = {
  classifyPreservationModel
};
