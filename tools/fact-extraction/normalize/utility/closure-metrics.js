function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computePropagationDepth(grounding) {
  if (!grounding) return 0;
  let depth = 0;
  if (grounding.stateTransition) depth += 1;
  if (grounding.constraintChain) depth += 1;
  if (grounding.causalChain) depth += 1;
  if (grounding.downstreamImpact) depth += 1;
  return depth;
}

function computeClosureMetrics(options) {
  const grounding = options.grounding || {};
  const representationStats = options.representationStats || {};
  const utilityArchetype = Array.isArray(options.utilityArchetype) ? options.utilityArchetype : [];
  const operationalIdentity = Array.isArray(options.operationalIdentity) ? options.operationalIdentity : [];
  const runtimeUtilityClass = Array.isArray(options.runtimeUtilityClass) ? options.runtimeUtilityClass : [];

  const propagationDepth = computePropagationDepth(grounding);
  const continuationFanout = operationalIdentity.length;
  const dependencyMaintenanceCost = utilityArchetype.includes('dependency-chain') || grounding.hasCondition ? 1 : 0;
  const operationalClosureCost = Number(
    (propagationDepth * 0.5 + continuationFanout * 0.2 + (grounding.operationalContinuation ? 0.3 : 0))
      .toFixed(3)
  );
  const compactness = Number.isFinite(representationStats.coreDrivenCompactness)
    ? representationStats.coreDrivenCompactness
    : 0;
  const standaloneClosureScore = Number(
    (utilityArchetype.includes('standalone-mechanic') ? (0.5 + compactness * 0.5) : 0).toFixed(3)
  );
  const localAnswerabilityBias = Number(
    clamp(standaloneClosureScore - Math.min(1, operationalClosureCost), -1, 1).toFixed(3)
  );

  return {
    propagationDepth,
    continuationFanout,
    dependencyMaintenanceCost,
    operationalClosureCost,
    standaloneClosureScore,
    localAnswerabilityBias,
    runtimeClassCount: runtimeUtilityClass.length
  };
}

module.exports = {
  computeClosureMetrics
};
