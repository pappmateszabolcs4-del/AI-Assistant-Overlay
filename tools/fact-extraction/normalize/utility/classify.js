function addIf(list, condition, value) {
  if (condition && !list.includes(value)) list.push(value);
}

function truthy(signal) {
  return !!(signal && signal.detected);
}

function classifyUtilitySignals(options) {
  const utilitySignals = options.utilitySignals || {};
  const grounding = options.grounding || {};
  const repStats = options.representationStats || {};

  const hasRouting = truthy(utilitySignals.routingSignificance);
  const hasInterruption = truthy(utilitySignals.interruptionSensitive);
  const hasRecovery = truthy(utilitySignals.recoverySignificance);
  const hasDownstream = truthy(utilitySignals.downstreamOperationalEffect);
  const hasDependency = truthy(utilitySignals.operationalDependency);
  const hasContinuity = truthy(utilitySignals.continuityBearing);

  const coreCoverage = Number.isFinite(repStats.coreCoverage) ? repStats.coreCoverage : 0;
  const compactness = Number.isFinite(repStats.coreDrivenCompactness) ? repStats.coreDrivenCompactness : 0;

  const utilityArchetype = [];
  const runtimeUtilityClass = [];

  addIf(utilityArchetype, compactness >= 0.6 && coreCoverage >= 2 && !hasContinuity, 'standalone-mechanic');
  addIf(utilityArchetype, hasContinuity || grounding.operationalContinuation, 'continuity-bearing');
  addIf(utilityArchetype, hasDependency, 'dependency-chain');
  addIf(utilityArchetype, hasInterruption, 'interruption-flow');
  addIf(utilityArchetype, hasRecovery, 'recovery-flow');
  addIf(utilityArchetype, hasRouting, 'routing-state');
  addIf(utilityArchetype, hasDownstream || grounding.downstreamImpact, 'downstream-operational');

  addIf(runtimeUtilityClass, hasRouting, 'routing-critical');
  addIf(runtimeUtilityClass, hasRecovery, 'recovery-significant');
  addIf(runtimeUtilityClass, hasInterruption, 'interruption-sensitive');
  addIf(runtimeUtilityClass, hasDependency, 'dependency-resolution');
  addIf(runtimeUtilityClass, grounding.stateTransition, 'state-transition');
  addIf(runtimeUtilityClass, hasDownstream || grounding.downstreamImpact, 'downstream-impact');

  return {
    utilityArchetype,
    runtimeUtilityClass
  };
}

module.exports = {
  classifyUtilitySignals
};
