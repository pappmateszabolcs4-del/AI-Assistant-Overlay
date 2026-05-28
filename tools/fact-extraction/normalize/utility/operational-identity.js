function addIf(list, condition, value) {
  if (condition && !list.includes(value)) list.push(value);
}

function truthy(signal) {
  return !!(signal && signal.detected);
}

function classifyOperationalIdentity(options) {
  const utilitySignals = options.utilitySignals || {};
  const grounding = options.grounding || {};
  const runtimeUtilityClass = Array.isArray(options.runtimeUtilityClass)
    ? options.runtimeUtilityClass
    : [];

  const hasContinuity = truthy(utilitySignals.continuityBearing) || !!grounding.operationalContinuation;
  const hasRouting = truthy(utilitySignals.routingSignificance) || runtimeUtilityClass.includes('routing-critical');
  const hasInterruption = truthy(utilitySignals.interruptionSensitive)
    || runtimeUtilityClass.includes('interruption-sensitive');
  const hasDependency = truthy(utilitySignals.operationalDependency)
    || runtimeUtilityClass.includes('dependency-resolution')
    || !!grounding.hasCondition;
  const hasTransition = runtimeUtilityClass.includes('state-transition')
    || !!grounding.stateTransition
    || !!grounding.constraintChain
    || !!grounding.causalChain;
  const hasDownstream = truthy(utilitySignals.downstreamOperationalEffect)
    || runtimeUtilityClass.includes('downstream-impact')
    || !!grounding.downstreamImpact;

  const identity = [];
  addIf(identity, hasContinuity && hasTransition, 'continuity-chain');
  addIf(identity, hasRouting, 'routing-network');
  addIf(identity, hasInterruption, 'interruption-flow-system');
  addIf(identity, hasDependency, 'dependency-propagation');
  addIf(identity, hasTransition, 'operational-transition-system');
  addIf(identity, hasDownstream, 'downstream-operational-network');

  return identity;
}

module.exports = {
  classifyOperationalIdentity
};
