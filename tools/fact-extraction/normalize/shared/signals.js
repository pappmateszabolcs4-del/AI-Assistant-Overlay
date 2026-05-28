function createSignalComputer(options) {
  const matchesAny = options.matchesAny;
  const tokenizeText = options.tokenizeText;
  const genericTokens = options.genericTokens;
  const patterns = options.patterns || {};
  const conditionPatterns = patterns.condition || [];
  const dependencyGatingPatterns = patterns.dependencyGating || [];
  const stateChangePatterns = patterns.stateChange || [];
  const emergentConsequencePatterns = patterns.emergentConsequence || [];
  const tradeoffImplicationPatterns = patterns.tradeoffImplication || [];
  const failureBehaviorPatterns = patterns.failureBehavior || [];
  const stateTransitionPatterns = patterns.stateTransition || [];
  const downstreamImpactPatterns = patterns.downstreamImpact || [];
  const constraintChainPatterns = patterns.constraintChain || [];
  const failureConstraintPatterns = patterns.failureConstraint || [];
  const causalChainPatterns = patterns.causalChain || [];
  const multiStepPatterns = patterns.multiStep || [];
  const syntheticNarrationPatterns = patterns.syntheticNarration || [];
  const adviceTonePatterns = patterns.adviceTone || [];

  const hasSpecificSignal = (text) => {
    const tokens = tokenizeText(text);
    const unique = new Set();
    for (const token of tokens) {
      if (genericTokens.has(token)) continue;
      if (token.length < 4) continue;
      unique.add(token);
    }
    return unique.size >= 2;
  };

  const hasMechanisticEntity = (textLower, systemsCount, familiesCount, keywordsCount) => {
    if (hasSpecificSignal(textLower)) return true;
    if (systemsCount > 0 || familiesCount > 0) return true;
    if (keywordsCount >= 2) return true;
    return false;
  };

  const detectGroundingSignals = (textLower, systemsCount, familiesCount, keywordsCount) => {
    const hasEntity = hasMechanisticEntity(textLower, systemsCount, familiesCount, keywordsCount);
    const hasCondition = matchesAny(conditionPatterns, textLower)
      || matchesAny(dependencyGatingPatterns, textLower);
    const hasEffect = matchesAny(stateChangePatterns, textLower)
      || matchesAny(emergentConsequencePatterns, textLower)
      || matchesAny(tradeoffImplicationPatterns, textLower)
      || matchesAny(failureBehaviorPatterns, textLower);
    return {
      hasEntity,
      hasCondition,
      hasEffect,
      anchor: hasEntity && hasCondition && hasEffect
    };
  };

  const computeGroundingSignals = (textLower, contextLower, systemsCount, familiesCount, keywordsCount) => {
    const base = detectGroundingSignals(textLower, systemsCount, familiesCount, keywordsCount);
    const stateTransition = matchesAny(stateTransitionPatterns, textLower);
    const downstreamImpact = matchesAny(downstreamImpactPatterns, textLower);
    const constraintChain = matchesAny(constraintChainPatterns, textLower);
    const failureConstraint = matchesAny(failureConstraintPatterns, textLower);
    const causalChain = matchesAny(causalChainPatterns, textLower);
    const multiStep = matchesAny(multiStepPatterns, textLower);
    if (!contextLower) {
      const continuationScope = (stateTransition || downstreamImpact || constraintChain || failureConstraint || causalChain)
        ? 'text'
        : 'none';
      return {
        anchor: base.anchor,
        anchorInText: base.anchor,
        anchorInLocal: base.anchor,
        anchorScope: base.anchor ? 'text' : 'none',
        hasEntity: base.hasEntity,
        hasCondition: base.hasCondition,
        hasEffect: base.hasEffect,
        syntheticNarration: matchesAny(syntheticNarrationPatterns, textLower),
        adviceTone: matchesAny(adviceTonePatterns, textLower),
        failureConstraint,
        stateTransition,
        downstreamImpact,
        constraintChain,
        causalChain,
        multiStep,
        continuationScope
      };
    }
    const stateTransitionLocal = matchesAny(stateTransitionPatterns, contextLower);
    const downstreamImpactLocal = matchesAny(downstreamImpactPatterns, contextLower);
    const constraintChainLocal = matchesAny(constraintChainPatterns, contextLower);
    const failureConstraintLocal = matchesAny(failureConstraintPatterns, contextLower);
    const causalChainLocal = matchesAny(causalChainPatterns, contextLower);
    const multiStepLocal = matchesAny(multiStepPatterns, contextLower);
    const combined = detectGroundingSignals(
      `${textLower} ${contextLower}`,
      systemsCount,
      familiesCount,
      keywordsCount
    );
    const anchor = base.anchor || combined.anchor;
    const anchorScope = base.anchor ? 'text' : (combined.anchor ? 'local' : 'none');
    const continuationText = stateTransition || downstreamImpact || constraintChain || failureConstraint || causalChain;
    const continuationLocal = stateTransitionLocal
      || downstreamImpactLocal
      || constraintChainLocal
      || failureConstraintLocal
      || causalChainLocal;
    const continuationScope = continuationText ? 'text' : (continuationLocal ? 'local' : 'none');
    return {
      anchor,
      anchorInText: base.anchor,
      anchorInLocal: combined.anchor,
      anchorScope,
      hasEntity: combined.hasEntity,
      hasCondition: combined.hasCondition,
      hasEffect: combined.hasEffect,
      syntheticNarration: matchesAny(syntheticNarrationPatterns, textLower),
      adviceTone: matchesAny(adviceTonePatterns, textLower),
      failureConstraint: failureConstraint || failureConstraintLocal,
      stateTransition: stateTransition || stateTransitionLocal,
      downstreamImpact: downstreamImpact || downstreamImpactLocal,
      constraintChain: constraintChain || constraintChainLocal,
      causalChain: causalChain || causalChainLocal,
      multiStep: multiStep || multiStepLocal,
      continuationScope
    };
  };

  return {
    hasSpecificSignal,
    hasMechanisticEntity,
    detectGroundingSignals,
    computeGroundingSignals
  };
}

module.exports = {
  createSignalComputer
};
