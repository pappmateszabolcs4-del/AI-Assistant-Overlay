function addIf(list, condition, value) {
  if (condition && !list.includes(value)) list.push(value);
}

function classifyRuntimeStructure(options) {
  const grounding = options.grounding || {};
  const utilityArchetype = Array.isArray(options.utilityArchetype) ? options.utilityArchetype : [];
  const operationalIdentity = Array.isArray(options.operationalIdentity) ? options.operationalIdentity : [];
  const runtimeUtilityClass = Array.isArray(options.runtimeUtilityClass) ? options.runtimeUtilityClass : [];
  const closureMetrics = options.closureMetrics || {};

  const continuationLinked = utilityArchetype.includes('continuity-bearing')
    || operationalIdentity.includes('continuity-chain')
    || !!grounding.operationalContinuation;

  const propagationAware = (closureMetrics.operationalClosureCost || 0) > 0
    || operationalIdentity.length > 0
    || runtimeUtilityClass.includes('state-transition');

  const operationalFragment = operationalIdentity.length > 0
    || runtimeUtilityClass.includes('routing-critical')
    || runtimeUtilityClass.includes('interruption-sensitive')
    || runtimeUtilityClass.includes('dependency-resolution');

  const localBias = Number.isFinite(closureMetrics.localAnswerabilityBias)
    ? closureMetrics.localAnswerabilityBias
    : 0;
  const localClosureDominant = utilityArchetype.includes('standalone-mechanic')
    && localBias > 0.1
    && !continuationLinked;

  const continuationType = [];
  addIf(continuationType, operationalIdentity.includes('routing-network')
    || runtimeUtilityClass.includes('routing-critical'), 'routing-network');
  addIf(continuationType, operationalIdentity.includes('dependency-propagation')
    || runtimeUtilityClass.includes('dependency-resolution'), 'dependency-propagation');
  addIf(continuationType, operationalIdentity.includes('interruption-flow-system')
    || runtimeUtilityClass.includes('interruption-sensitive'), 'interruption-flow');
  addIf(continuationType, operationalIdentity.includes('operational-transition-system')
    || runtimeUtilityClass.includes('state-transition'), 'operational-transition');
  addIf(continuationType, operationalIdentity.includes('downstream-operational-network')
    || runtimeUtilityClass.includes('downstream-impact'), 'downstream-operational');
  addIf(continuationType, utilityArchetype.includes('recovery-flow')
    || runtimeUtilityClass.includes('recovery-significant'), 'recovery-path');

  const boundedContinuation = {
    condition: grounding.hasCondition || null,
    transition: grounding.stateTransition || null,
    consequence: grounding.hasEffect || grounding.downstreamImpact || null
  };

  return {
    continuationLinked: !!continuationLinked,
    propagationAware: !!propagationAware,
    operationalFragment: !!operationalFragment,
    localClosureDominant: !!localClosureDominant,
    continuationType,
    boundedContinuation
  };
}

module.exports = {
  classifyRuntimeStructure
};
