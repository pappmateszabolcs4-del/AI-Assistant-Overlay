function createRetentionEngine(options) {
  const normalizeTextKey = options.normalizeTextKey;
  const matchesAny = options.matchesAny;
  const looksWeakTradeoffTemplate = options.looksWeakTradeoffTemplate;
  const hasSpecificSignal = options.hasSpecificSignal;
  const hasGameplayConsequence = options.hasGameplayConsequence;
  const computeSystemicDepth = options.computeSystemicDepth;
  const computeRoleTags = options.computeRoleTags;
  const shouldApplyResourcePenalty = options.shouldApplyResourcePenalty;
  const getTemplateShape = options.getTemplateShape;
  const normalizeSuggestedPriority = options.normalizeSuggestedPriority;
  const patterns = options.patterns || {};

  const applyP1Cap = (facts) => {
    const total = facts.length;
    if (!total) return;
    const maxRatio = 0.2;
    const targetRatio = 0.15;
    const maxP1 = Math.ceil(total * maxRatio);
    const targetP1 = Math.ceil(total * targetRatio);
    const p1Indices = [];
    for (let i = 0; i < facts.length; i += 1) {
      if (facts[i].priority === 3) p1Indices.push(i);
    }
    if (p1Indices.length <= maxP1) return;
    const scored = p1Indices.map((index) => {
      const fact = facts[index];
      return {
        index,
        retentionScore: computeRetentionScore(fact),
        obviousness: Number.isFinite(fact.obviousness) ? fact.obviousness : 0.5,
        novelty: Number.isFinite(fact.noveltyScore) ? fact.noveltyScore : 0.5,
        interaction: Number.isFinite(fact.interactionCount) ? fact.interactionCount : 0
      };
    });
    scored.sort((a, b) => {
      if (a.retentionScore !== b.retentionScore) return a.retentionScore - b.retentionScore;
      if (a.obviousness !== b.obviousness) return b.obviousness - a.obviousness;
      if (a.novelty !== b.novelty) return a.novelty - b.novelty;
      return a.interaction - b.interaction;
    });
    const downgradeCount = Math.max(0, p1Indices.length - targetP1);
    for (let i = 0; i < downgradeCount; i += 1) {
      const fact = facts[scored[i].index];
      fact.priority = 2;
    }
  };

  const decideFinalPriority = (basePriority, suggestedPriority, noveltyScore, obviousness, interactionCount, systemsCount) => {
    let priority = Number.isFinite(basePriority) ? basePriority : 2;
    if (suggestedPriority) priority = suggestedPriority;

    if (Number.isFinite(obviousness)) {
      if (obviousness >= 0.75) priority = Math.min(priority, 1);
      else if (obviousness >= 0.6) priority = Math.min(priority, 2);
    }

    if (Number.isFinite(noveltyScore)) {
      const strongNovelty = noveltyScore >= 0.75;
      const lowObvious = Number.isFinite(obviousness) ? obviousness <= 0.35 : false;
      if (strongNovelty && (interactionCount >= 2 || lowObvious)) {
        priority = Math.max(priority, 3);
      }
    }

    if (interactionCount >= 2 && Number.isFinite(obviousness) && obviousness <= 0.5) {
      const implicationLikely = Number.isFinite(noveltyScore) ? noveltyScore >= 0.55 : false;
      if (implicationLikely) {
        priority = Math.max(priority, 3);
      }
    }

    if (interactionCount >= 2 && Number.isFinite(obviousness) && obviousness <= 0.5) {
      priority = Math.max(priority, 2);
    }

    if (systemsCount >= 2 && Number.isFinite(obviousness) && obviousness <= 0.5) {
      priority = Math.max(priority, 2);
    }

    return Math.max(1, Math.min(3, priority));
  };

  const applyTemplateRepetitionPenalty = (facts) => {
    const shapeCounts = {};
    const shapes = new Array(facts.length);
    for (let i = 0; i < facts.length; i += 1) {
      const textLower = normalizeTextKey(facts[i].text);
      const shape = getTemplateShape(textLower);
      shapes[i] = shape;
      if (!shape) continue;
      shapeCounts[shape] = (shapeCounts[shape] || 0) + 1;
    }

    for (let i = 0; i < facts.length; i += 1) {
      const shape = shapes[i];
      if (!shape) continue;
      const count = shapeCounts[shape] || 0;
      const extra = Math.max(0, count - 3);
      if (!extra) continue;

      const fact = facts[i];
      let novelty = Number.isFinite(fact.noveltyScore) ? fact.noveltyScore : 0.5;
      let obvious = Number.isFinite(fact.obviousness) ? fact.obviousness : 0.5;
      novelty = Math.max(0, novelty - 0.02 * extra);
      obvious = Math.min(1, obvious + 0.02 * extra);
      fact.noveltyScore = novelty;
      fact.obviousness = obvious;

      const suggestedPriority = normalizeSuggestedPriority(fact.suggestedPriority);
      const systemsCount = Array.isArray(fact.systems) ? fact.systems.length : 0;
      const interactionCount = Number.isFinite(fact.interactionCount)
        ? fact.interactionCount
        : systemsCount;
      let recomputed = decideFinalPriority(
        fact.priority,
        suggestedPriority,
        novelty,
        obvious,
        interactionCount,
        systemsCount
      );
      if (shouldApplyResourcePenalty(normalizeTextKey(fact.text), interactionCount, systemsCount)) {
        recomputed = Math.min(recomputed, 2);
      }
      fact.priority = recomputed;
    }
  };

  const computeRetentionScore = (fact) => {
    const novelty = Number.isFinite(fact.noveltyScore) ? fact.noveltyScore : 0.5;
    const obvious = Number.isFinite(fact.obviousness) ? fact.obviousness : 0.5;
    const interaction = Number.isFinite(fact.interactionCount)
      ? fact.interactionCount
      : (Array.isArray(fact.systems) ? fact.systems.length : 0);
    const grounding = fact && fact._grounding ? fact._grounding : null;
    const interactionBonus = Math.min(0.2, interaction * 0.05);
    const textLower = normalizeTextKey(fact.text);
    const templatePenalty = looksWeakTradeoffTemplate(textLower) ? 0.2 : 0;
    const consequenceBonus = matchesAny(patterns.emergentConsequence, textLower) ? 0.08 : 0;
    const tradeoffBonus = matchesAny(patterns.tradeoffImplication, textLower) ? 0.06 : 0;
    const optimizationBonus = matchesAny(patterns.optimizationChain, textLower) ? 0.06 : 0;
    const multiStepBonus = matchesAny(patterns.multiStep, textLower) ? 0.04 : 0;
    const deepBonus = matchesAny(patterns.deepImplication, textLower)
      || matchesAny(patterns.scalingConstraint, textLower)
      || matchesAny(patterns.failureBehavior, textLower)
      ? 0.07
      : 0;
    const depthSignals = computeSystemicDepth(
      textLower,
      interaction,
      Array.isArray(fact.systems) ? fact.systems.length : 0
    );
    const depthBonus = depthSignals.depthScore ? depthSignals.depthScore * 0.08 : 0;
    const workflowPenalty = (!hasGameplayConsequence(textLower)
      && matchesAny(patterns.dependencyGating, textLower)
      && interaction < 2) ? 0.08 : 0;
    const roleTags = computeRoleTags(
      textLower,
      interaction,
      Array.isArray(fact.systems) ? fact.systems.length : 0,
      Array.isArray(fact.mechanicFamilies) ? fact.mechanicFamilies.length : 0
    );
    const implicationRoleBonus = roleTags.includes('gameplay_implication') ? 0.06 : 0;
    const workflowRolePenalty = roleTags.includes('workflow') && !roleTags.includes('gameplay_implication') ? 0.05 : 0;
    const mechanicFirstBonus = grounding && grounding.anchor
      ? (grounding.anchorScope === 'text' ? 0.06 : 0.04)
      : 0;
    const unanchoredImplicationPenalty = grounding
      && roleTags.includes('gameplay_implication')
      && !grounding.anchor
      ? 0.08
      : 0;
    const syntheticNarrationPenalty = grounding && grounding.syntheticNarration && !grounding.anchor ? 0.06 : 0;
    const adviceTonePenalty = grounding && grounding.adviceTone && !grounding.anchor ? 0.08 : 0;
    const lexicalOnlyPenalty = grounding
      && (!grounding.mechanicShape || !grounding.mechanicShape.structuralCore)
      && (grounding.adviceTone || grounding.syntheticNarration)
      ? 0.04
      : 0;
    const repStats = grounding && grounding.representationStats ? grounding.representationStats : null;
    const coreCoverage = repStats ? repStats.coreCoverage : 0;
    const coreCoverageBonus = coreCoverage >= 3 ? 0.05 : (coreCoverage >= 2 ? 0.03 : 0);
    const compactnessPenalty = repStats && repStats.coreDrivenCompactness <= 0.45 ? 0.04 : 0;
    const coreSparseVerbosePenalty = repStats && repStats.verbose && coreCoverage <= 1 ? 0.04 : 0;
    const anchored = grounding && grounding.anchor;
    const failureConstraintBonus = anchored && grounding.failureConstraint ? 0.06 : 0;
    const downstreamImpactBonus = anchored && grounding.downstreamImpact ? 0.05 : 0;
    const stateTransitionBonus = anchored && grounding.stateTransition ? 0.05 : 0;
    const constraintChainBonus = anchored && grounding.constraintChain ? 0.04 : 0;
    const structureBonus = anchored && grounding.mechanicShape && grounding.mechanicShape.structuralCore ? 0.05 : 0;
    const propagationBonus = anchored && (grounding.downstreamImpact || grounding.constraintChain)
      && interaction >= 2 ? 0.03 : 0;
    const recoveryBonus = grounding && grounding.recoveredImplication ? 0.06 : 0;
    let onboardingPenalty = 0;
    for (const pattern of patterns.obviousnessBoost || []) {
      if (pattern.test(textLower)) onboardingPenalty += 0.04;
    }
    onboardingPenalty = Math.min(0.12, onboardingPenalty);
    return novelty - obvious + interactionBonus + consequenceBonus + tradeoffBonus
      + optimizationBonus + multiStepBonus + deepBonus + depthBonus + implicationRoleBonus + mechanicFirstBonus
      + failureConstraintBonus + downstreamImpactBonus + stateTransitionBonus + constraintChainBonus + recoveryBonus
      + structureBonus + propagationBonus + coreCoverageBonus
      - templatePenalty - onboardingPenalty - workflowPenalty - workflowRolePenalty
      - unanchoredImplicationPenalty - syntheticNarrationPenalty - adviceTonePenalty - lexicalOnlyPenalty
      - compactnessPenalty - coreSparseVerbosePenalty;
  };

  const computeRetentionAttribution = (fact) => {
    const novelty = Number.isFinite(fact.noveltyScore) ? fact.noveltyScore : 0.5;
    const obvious = Number.isFinite(fact.obviousness) ? fact.obviousness : 0.5;
    const interaction = Number.isFinite(fact.interactionCount)
      ? fact.interactionCount
      : (Array.isArray(fact.systems) ? fact.systems.length : 0);
    const grounding = fact && fact._grounding ? fact._grounding : null;
    const interactionBonus = Math.min(0.2, interaction * 0.05);
    const textLower = normalizeTextKey(fact.text);
    const templatePenalty = looksWeakTradeoffTemplate(textLower) ? 0.2 : 0;
    const consequenceBonus = matchesAny(patterns.emergentConsequence, textLower) ? 0.08 : 0;
    const tradeoffBonus = matchesAny(patterns.tradeoffImplication, textLower) ? 0.06 : 0;
    const optimizationBonus = matchesAny(patterns.optimizationChain, textLower) ? 0.06 : 0;
    const multiStepBonus = matchesAny(patterns.multiStep, textLower) ? 0.04 : 0;
    const deepBonus = matchesAny(patterns.deepImplication, textLower)
      || matchesAny(patterns.scalingConstraint, textLower)
      || matchesAny(patterns.failureBehavior, textLower)
      ? 0.07
      : 0;
    const depthSignals = computeSystemicDepth(
      textLower,
      interaction,
      Array.isArray(fact.systems) ? fact.systems.length : 0
    );
    const depthBonus = depthSignals.depthScore ? depthSignals.depthScore * 0.08 : 0;
    const workflowPenalty = (!hasGameplayConsequence(textLower)
      && matchesAny(patterns.dependencyGating, textLower)
      && interaction < 2) ? 0.08 : 0;
    const roleTags = computeRoleTags(
      textLower,
      interaction,
      Array.isArray(fact.systems) ? fact.systems.length : 0,
      Array.isArray(fact.mechanicFamilies) ? fact.mechanicFamilies.length : 0
    );
    const implicationRoleBonus = roleTags.includes('gameplay_implication') ? 0.06 : 0;
    const workflowRolePenalty = roleTags.includes('workflow') && !roleTags.includes('gameplay_implication') ? 0.05 : 0;
    const mechanicFirstBonus = grounding && grounding.anchor
      ? (grounding.anchorScope === 'text' ? 0.06 : 0.04)
      : 0;
    const unanchoredImplicationPenalty = grounding
      && roleTags.includes('gameplay_implication')
      && !grounding.anchor
      ? 0.08
      : 0;
    const syntheticNarrationPenalty = grounding && grounding.syntheticNarration && !grounding.anchor ? 0.06 : 0;
    const adviceTonePenalty = grounding && grounding.adviceTone && !grounding.anchor ? 0.08 : 0;
    const lexicalOnlyPenalty = grounding
      && (!grounding.mechanicShape || !grounding.mechanicShape.structuralCore)
      && (grounding.adviceTone || grounding.syntheticNarration)
      ? 0.04
      : 0;
    const repStats = grounding && grounding.representationStats ? grounding.representationStats : null;
    const coreCoverage = repStats ? repStats.coreCoverage : 0;
    const coreCoverageBonus = coreCoverage >= 3 ? 0.05 : (coreCoverage >= 2 ? 0.03 : 0);
    const compactnessPenalty = repStats && repStats.coreDrivenCompactness <= 0.45 ? 0.04 : 0;
    const coreSparseVerbosePenalty = repStats && repStats.verbose && coreCoverage <= 1 ? 0.04 : 0;
    const anchored = grounding && grounding.anchor;
    const failureConstraintBonus = anchored && grounding.failureConstraint ? 0.06 : 0;
    const downstreamImpactBonus = anchored && grounding.downstreamImpact ? 0.05 : 0;
    const stateTransitionBonus = anchored && grounding.stateTransition ? 0.05 : 0;
    const constraintChainBonus = anchored && grounding.constraintChain ? 0.04 : 0;
    const structureBonus = anchored && grounding.mechanicShape && grounding.mechanicShape.structuralCore ? 0.05 : 0;
    const propagationBonus = anchored && (grounding.downstreamImpact || grounding.constraintChain)
      && interaction >= 2 ? 0.03 : 0;
    const recoveryBonus = grounding && grounding.recoveredImplication ? 0.06 : 0;
    let onboardingPenalty = 0;
    for (const pattern of patterns.obviousnessBoost || []) {
      if (pattern.test(textLower)) onboardingPenalty += 0.04;
    }
    onboardingPenalty = Math.min(0.12, onboardingPenalty);

    const score = novelty - obvious + interactionBonus + consequenceBonus + tradeoffBonus
      + optimizationBonus + multiStepBonus + deepBonus + depthBonus + implicationRoleBonus + mechanicFirstBonus
      + failureConstraintBonus + downstreamImpactBonus + stateTransitionBonus + constraintChainBonus + recoveryBonus
      + structureBonus + propagationBonus + coreCoverageBonus
      - templatePenalty - onboardingPenalty - workflowPenalty - workflowRolePenalty
      - unanchoredImplicationPenalty - syntheticNarrationPenalty - adviceTonePenalty - lexicalOnlyPenalty
      - compactnessPenalty - coreSparseVerbosePenalty;

    return {
      score: Number(score.toFixed(3)),
      bonuses: {
        interactionBonus,
        consequenceBonus,
        tradeoffBonus,
        optimizationBonus,
        multiStepBonus,
        deepBonus,
        depthBonus,
        implicationRoleBonus,
        mechanicFirstBonus,
        failureConstraintBonus,
        downstreamImpactBonus,
        stateTransitionBonus,
        constraintChainBonus,
        recoveryBonus,
        structureBonus,
        propagationBonus,
        coreCoverageBonus
      },
      penalties: {
        templatePenalty,
        onboardingPenalty,
        workflowPenalty,
        workflowRolePenalty,
        unanchoredImplicationPenalty,
        syntheticNarrationPenalty,
        adviceTonePenalty,
        lexicalOnlyPenalty,
        compactnessPenalty,
        coreSparseVerbosePenalty
      },
      signals: {
        novelty,
        obvious,
        interaction,
        roleTags,
        depthSignals,
        repStats: repStats ? {
          coreCoverage: repStats.coreCoverage,
          coreDrivenCompactness: repStats.coreDrivenCompactness,
          verbose: repStats.verbose
        } : null
      }
    };
  };

  const computeRetentionScoreB = (fact) => {
    const novelty = Number.isFinite(fact.noveltyScore) ? fact.noveltyScore : 0.5;
    const obvious = Number.isFinite(fact.obviousness) ? fact.obviousness : 0.5;
    const interaction = Number.isFinite(fact.interactionCount)
      ? fact.interactionCount
      : (Array.isArray(fact.systems) ? fact.systems.length : 0);
    const systemsCount = Array.isArray(fact.systems) ? fact.systems.length : 0;
    const familiesCount = Array.isArray(fact.mechanicFamilies) ? fact.mechanicFamilies.length : 0;
    const textLower = normalizeTextKey(fact.text);
    const grounding = fact && fact._grounding ? fact._grounding : null;

    let score = 0;
    if (matchesAny(patterns.supportingSignal, textLower)) score += 0.2;
    if (matchesAny(patterns.dependencyGating, textLower)) score += 0.15;
    if (matchesAny(patterns.resourceDependency, textLower)) score += 0.1;
    if (matchesAny(patterns.emergentConsequence, textLower)) score += 0.2;
    if (matchesAny(patterns.tradeoffImplication, textLower)) score += 0.15;
    if (interaction >= 1) score += 0.1;
    if (systemsCount >= 1) score += 0.1;
    if (familiesCount >= 1) score += 0.1;
    score += (novelty - obvious) * 0.2;

    if (looksWeakTradeoffTemplate(textLower) && !hasSpecificSignal(textLower)) {
      score -= 0.2;
    }
    if (!hasGameplayConsequence(textLower)
      && matchesAny(patterns.dependencyGating, textLower)
      && interaction < 2) {
      score -= 0.1;
    }
    const roleTags = computeRoleTags(textLower, interaction, systemsCount, familiesCount);
    if (roleTags.includes('gameplay_implication')) score += 0.06;
    if (roleTags.includes('workflow') && !roleTags.includes('gameplay_implication')) score -= 0.05;
    if (matchesAny(patterns.deepImplication, textLower)
      || matchesAny(patterns.scalingConstraint, textLower)
      || matchesAny(patterns.failureBehavior, textLower)) {
      score += 0.04;
    }
    const depthSignals = computeSystemicDepth(textLower, interaction, systemsCount);
    if (depthSignals.depthScore) score += depthSignals.depthScore * 0.04;
    if (grounding && roleTags.includes('gameplay_implication') && !grounding.anchor) score -= 0.06;
    if (grounding && grounding.syntheticNarration && !grounding.anchor) score -= 0.04;
    if (grounding && grounding.adviceTone && !grounding.anchor) score -= 0.06;
    if (grounding && grounding.anchor) score += grounding.anchorScope === 'text' ? 0.03 : 0.02;
    const anchored = grounding && grounding.anchor;
    if (anchored && grounding.failureConstraint) score += 0.04;
    if (anchored && grounding.downstreamImpact) score += 0.03;
    if (anchored && grounding.stateTransition) score += 0.03;
    if (anchored && grounding.constraintChain) score += 0.02;
    if (anchored && grounding.mechanicShape && grounding.mechanicShape.structuralCore) score += 0.03;
    if (anchored && (grounding.downstreamImpact || grounding.constraintChain) && interaction >= 2) score += 0.02;
    const repStats = grounding && grounding.representationStats ? grounding.representationStats : null;
    const coreCoverage = repStats ? repStats.coreCoverage : 0;
    if (coreCoverage >= 3) score += 0.03;
    else if (coreCoverage >= 2) score += 0.02;
    if (repStats && repStats.coreDrivenCompactness <= 0.45) score -= 0.03;
    if (repStats && repStats.verbose && coreCoverage <= 1) score -= 0.03;
    if (grounding && grounding.recoveredImplication) score += 0.04;

    return score;
  };

  const computeRetentionAttributionB = (fact) => {
    const novelty = Number.isFinite(fact.noveltyScore) ? fact.noveltyScore : 0.5;
    const obvious = Number.isFinite(fact.obviousness) ? fact.obviousness : 0.5;
    const interaction = Number.isFinite(fact.interactionCount)
      ? fact.interactionCount
      : (Array.isArray(fact.systems) ? fact.systems.length : 0);
    const systemsCount = Array.isArray(fact.systems) ? fact.systems.length : 0;
    const familiesCount = Array.isArray(fact.mechanicFamilies) ? fact.mechanicFamilies.length : 0;
    const textLower = normalizeTextKey(fact.text);
    const grounding = fact && fact._grounding ? fact._grounding : null;

    let score = 0;
    const supportingSignalBonus = matchesAny(patterns.supportingSignal, textLower) ? 0.2 : 0;
    const dependencyGatingBonus = matchesAny(patterns.dependencyGating, textLower) ? 0.15 : 0;
    const resourceDependencyBonus = matchesAny(patterns.resourceDependency, textLower) ? 0.1 : 0;
    const emergentBonus = matchesAny(patterns.emergentConsequence, textLower) ? 0.2 : 0;
    const tradeoffBonus = matchesAny(patterns.tradeoffImplication, textLower) ? 0.15 : 0;
    const interactionBonus = interaction >= 1 ? 0.1 : 0;
    const systemsBonus = systemsCount >= 1 ? 0.1 : 0;
    const familiesBonus = familiesCount >= 1 ? 0.1 : 0;
    const noveltyObviousContribution = (novelty - obvious) * 0.2;

    score += supportingSignalBonus + dependencyGatingBonus + resourceDependencyBonus
      + emergentBonus + tradeoffBonus + interactionBonus + systemsBonus + familiesBonus
      + noveltyObviousContribution;

    const weakTradeoffPenalty = (looksWeakTradeoffTemplate(textLower) && !hasSpecificSignal(textLower)) ? 0.2 : 0;
    const dependencyWorkflowPenalty = (!hasGameplayConsequence(textLower)
      && matchesAny(patterns.dependencyGating, textLower)
      && interaction < 2) ? 0.1 : 0;
    const roleTags = computeRoleTags(textLower, interaction, systemsCount, familiesCount);
    const workflowRolePenalty = roleTags.includes('workflow') && !roleTags.includes('gameplay_implication') ? 0.05 : 0;
    const implicationRoleBonus = roleTags.includes('gameplay_implication') ? 0.06 : 0;
    const deepBonus = (matchesAny(patterns.deepImplication, textLower)
      || matchesAny(patterns.scalingConstraint, textLower)
      || matchesAny(patterns.failureBehavior, textLower)) ? 0.04 : 0;
    const depthSignals = computeSystemicDepth(textLower, interaction, systemsCount);
    const depthBonus = depthSignals.depthScore ? depthSignals.depthScore * 0.04 : 0;
    const unanchoredImplicationPenalty = (grounding && roleTags.includes('gameplay_implication') && !grounding.anchor) ? 0.06 : 0;
    const syntheticNarrationPenalty = (grounding && grounding.syntheticNarration && !grounding.anchor) ? 0.04 : 0;
    const adviceTonePenalty = (grounding && grounding.adviceTone && !grounding.anchor) ? 0.06 : 0;
    const anchorBonus = (grounding && grounding.anchor) ? (grounding.anchorScope === 'text' ? 0.03 : 0.02) : 0;
    const failureConstraintBonus = (grounding && grounding.anchor && grounding.failureConstraint) ? 0.04 : 0;
    const downstreamImpactBonus = (grounding && grounding.anchor && grounding.downstreamImpact) ? 0.03 : 0;
    const stateTransitionBonus = (grounding && grounding.anchor && grounding.stateTransition) ? 0.03 : 0;
    const constraintChainBonus = (grounding && grounding.anchor && grounding.constraintChain) ? 0.02 : 0;
    const structureBonus = (grounding && grounding.anchor && grounding.mechanicShape
      && grounding.mechanicShape.structuralCore) ? 0.03 : 0;
    const propagationBonus = (grounding && grounding.anchor
      && (grounding.downstreamImpact || grounding.constraintChain) && interaction >= 2) ? 0.02 : 0;
    const repStats = grounding && grounding.representationStats ? grounding.representationStats : null;
    const coreCoverage = repStats ? repStats.coreCoverage : 0;
    const coreCoverageBonus = coreCoverage >= 3 ? 0.03 : (coreCoverage >= 2 ? 0.02 : 0);
    const compactnessPenalty = repStats && repStats.coreDrivenCompactness <= 0.45 ? 0.03 : 0;
    const coreSparseVerbosePenalty = repStats && repStats.verbose && coreCoverage <= 1 ? 0.03 : 0;
    const recoveryBonus = grounding && grounding.recoveredImplication ? 0.04 : 0;

    score += implicationRoleBonus + deepBonus + depthBonus + anchorBonus
      + failureConstraintBonus + downstreamImpactBonus + stateTransitionBonus + constraintChainBonus
      + structureBonus + propagationBonus + coreCoverageBonus + recoveryBonus;

    score -= weakTradeoffPenalty + dependencyWorkflowPenalty + workflowRolePenalty
      + unanchoredImplicationPenalty + syntheticNarrationPenalty + adviceTonePenalty
      + compactnessPenalty + coreSparseVerbosePenalty;

    return {
      score: Number(score.toFixed(3)),
      bonuses: {
        supportingSignalBonus,
        dependencyGatingBonus,
        resourceDependencyBonus,
        emergentBonus,
        tradeoffBonus,
        interactionBonus,
        systemsBonus,
        familiesBonus,
        noveltyObviousContribution,
        implicationRoleBonus,
        deepBonus,
        depthBonus,
        anchorBonus,
        failureConstraintBonus,
        downstreamImpactBonus,
        stateTransitionBonus,
        constraintChainBonus,
        structureBonus,
        propagationBonus,
        coreCoverageBonus,
        recoveryBonus
      },
      penalties: {
        weakTradeoffPenalty,
        dependencyWorkflowPenalty,
        workflowRolePenalty,
        unanchoredImplicationPenalty,
        syntheticNarrationPenalty,
        adviceTonePenalty,
        compactnessPenalty,
        coreSparseVerbosePenalty
      },
      signals: {
        novelty,
        obvious,
        interaction,
        systemsCount,
        familiesCount,
        roleTags,
        depthSignals,
        repStats: repStats ? {
          coreCoverage: repStats.coreCoverage,
          coreDrivenCompactness: repStats.coreDrivenCompactness,
          verbose: repStats.verbose
        } : null
      }
    };
  };

  const assignKnowledgeLayer = (fact) => {
    const textLower = normalizeTextKey(fact.text);
    const interaction = Number.isFinite(fact.interactionCount)
      ? fact.interactionCount
      : (Array.isArray(fact.systems) ? fact.systems.length : 0);
    const systemsCount = Array.isArray(fact.systems) ? fact.systems.length : 0;
    const familiesCount = Array.isArray(fact.mechanicFamilies) ? fact.mechanicFamilies.length : 0;
    const grounding = fact && fact._grounding ? fact._grounding : null;
    const roleTags = Array.isArray(fact.roleTags) ? fact.roleTags : [];
    const unanchoredImplication = roleTags.includes('gameplay_implication')
      && grounding
      && !grounding.anchor;
    const scoreA = computeRetentionScore(fact);
    const scoreB = computeRetentionScoreB(fact);

    const anchoredImplicationSignal = grounding && grounding.anchor
      && grounding.hasCondition
      && grounding.hasEffect
      && (grounding.downstreamImpact || grounding.constraintChain
        || grounding.failureConstraint || grounding.stateTransition
        || matchesAny(patterns.gameplayImplication, textLower));

    const highSignal = anchoredImplicationSignal
      || interaction >= 2
      || (systemsCount >= 2 && Number.isFinite(fact.obviousness) ? fact.obviousness <= 0.6 : false);

    const supportingSignal = matchesAny(patterns.supportingSignal, textLower)
      || matchesAny(patterns.dependencyGating, textLower)
      || matchesAny(patterns.resourceDependency, textLower);
    const systemicPresence = systemsCount > 0 || familiesCount > 0;

    const knowledgeRoleSupporting = supportingSignal
      && systemicPresence
      && !matchesAny(patterns.gameplayImplication, textLower)
      && !matchesAny(patterns.emergentConsequence, textLower)
      && !matchesAny(patterns.tradeoffImplication, textLower)
      && interaction < 2;

    let layer = 'A';
    if (knowledgeRoleSupporting) {
      layer = 'B';
    } else if (grounding && grounding.procedural && !grounding.recoveredImplication && scoreA < 0.18) {
      layer = 'B';
    } else if (unanchoredImplication && !(interaction >= 2 && scoreA >= 0.18)) {
      layer = 'B';
    } else if (highSignal || scoreA >= 0.1) {
      layer = 'A';
    } else if (fact.evergreen && supportingSignal && systemicPresence && scoreB >= 0.03) {
      layer = 'B';
    }

    return {
      layer,
      retentionScoreA: Number(scoreA.toFixed(3)),
      retentionScoreB: Number(scoreB.toFixed(3))
    };
  };

  const applyRetentionShaping = (facts) => {
    applyTemplateRepetitionPenalty(facts);
    applyP1Cap(facts);
  };

  return {
    computeRetentionScore,
    computeRetentionScoreB,
    computeRetentionAttribution,
    computeRetentionAttributionB,
    assignKnowledgeLayer,
    decideFinalPriority,
    applyTemplateRepetitionPenalty,
    applyP1Cap,
    applyRetentionShaping
  };
}

module.exports = {
  createRetentionEngine
};
