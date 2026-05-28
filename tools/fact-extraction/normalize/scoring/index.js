const { scoring: scoringPatterns, grounding: groundingPatterns } = require('../shared/patterns');
const { matchesAny } = require('../shared/utils');
const { getTemplateShape } = require('../shared/template-shapes');

function hasGameplayConsequence(text) {
  return matchesAny(scoringPatterns.EMERGENT_CONSEQUENCE_PATTERNS, text)
    || matchesAny(scoringPatterns.TRADEOFF_IMPLICATION_PATTERNS, text)
    || matchesAny(scoringPatterns.SPECIFICITY_BONUS_PATTERNS, text);
}

function applyObviousnessBoost(text, noveltyScore, obviousness) {
  let boostHits = 0;
  for (const pattern of scoringPatterns.OBVIOUSNESS_BOOST_PATTERNS) {
    if (pattern.test(text)) boostHits += 1;
  }
  if (!boostHits) return { noveltyScore, obviousness };
  const boostedObviousness = Math.min(1, (obviousness ?? 0.4) + 0.12 * boostHits);
  const reducedNovelty = Math.max(0, (noveltyScore ?? 0.5) - 0.1 * boostHits);
  return { noveltyScore: reducedNovelty, obviousness: boostedObviousness };
}

function applyTemplatePenalty(text, noveltyScore, obviousness) {
  const shape = getTemplateShape(text);
  if (!shape) return { noveltyScore, obviousness, shape };
  const shapePenalty = (shape === 'requires_x' || shape === 'blocked_without') ? 0.04 : 0;
  const boostedObviousness = Math.min(1, (obviousness ?? 0.4) + 0.14 + shapePenalty);
  const reducedNovelty = Math.max(0, (noveltyScore ?? 0.5) - 0.08 - shapePenalty);
  return { noveltyScore: reducedNovelty, obviousness: boostedObviousness, shape };
}

function applyAbilityTemplatePenalty(text, noveltyScore, obviousness) {
  if (!matchesAny(scoringPatterns.ABILITY_TEMPLATE_PATTERNS, text)) {
    return { noveltyScore, obviousness, abilityPenaltyApplied: false };
  }
  const boostedObviousness = Math.min(1, (obviousness ?? 0.4) + 0.12);
  const reducedNovelty = Math.max(0, (noveltyScore ?? 0.5) - 0.08);
  return { noveltyScore: reducedNovelty, obviousness: boostedObviousness, abilityPenaltyApplied: true };
}

function applySpecificityBonus(text, noveltyScore, obviousness) {
  if (!matchesAny(scoringPatterns.SPECIFICITY_BONUS_PATTERNS, text)) {
    return { noveltyScore, obviousness, specificityBonusApplied: false };
  }
  const boostedNovelty = Math.min(1, (noveltyScore ?? 0.5) + 0.1);
  const reducedObviousness = Math.max(0, (obviousness ?? 0.5) - 0.05);
  return { noveltyScore: boostedNovelty, obviousness: reducedObviousness, specificityBonusApplied: true };
}

function applyGameplayImplicationBoost(text, interactionCount, systemsCount, noveltyScore, obviousness) {
  if (!matchesAny(scoringPatterns.GAMEPLAY_IMPLICATION_PATTERNS, text)) {
    return { noveltyScore, obviousness, implicationBoostApplied: false };
  }
  if (interactionCount < 2 && systemsCount < 2) {
    return { noveltyScore, obviousness, implicationBoostApplied: false };
  }
  const boostedNovelty = Math.min(1, (noveltyScore ?? 0.5) + 0.12);
  const reducedObviousness = Math.max(0, (obviousness ?? 0.5) - 0.08);
  return { noveltyScore: boostedNovelty, obviousness: reducedObviousness, implicationBoostApplied: true };
}

function applyEmergentConsequenceBonus(text, noveltyScore, obviousness) {
  if (!matchesAny(scoringPatterns.EMERGENT_CONSEQUENCE_PATTERNS, text)) {
    return { noveltyScore, obviousness, emergentBonusApplied: false };
  }
  const boostedNovelty = Math.min(1, (noveltyScore ?? 0.5) + 0.15);
  const reducedObviousness = Math.max(0, (obviousness ?? 0.5) - 0.1);
  return { noveltyScore: boostedNovelty, obviousness: reducedObviousness, emergentBonusApplied: true };
}

function applyOptimizationChainBoost(text, interactionCount, systemsCount, noveltyScore, obviousness) {
  if (!matchesAny(scoringPatterns.OPTIMIZATION_CHAIN_PATTERNS, text)) {
    return { noveltyScore, obviousness, optimizationBoostApplied: false };
  }
  if (interactionCount < 2 && systemsCount < 2) {
    return { noveltyScore, obviousness, optimizationBoostApplied: false };
  }
  const boostedNovelty = Math.min(1, (noveltyScore ?? 0.5) + 0.08);
  const reducedObviousness = Math.max(0, (obviousness ?? 0.5) - 0.04);
  return { noveltyScore: boostedNovelty, obviousness: reducedObviousness, optimizationBoostApplied: true };
}

function applyMultiStepBoost(text, noveltyScore, obviousness) {
  if (!matchesAny(scoringPatterns.MULTI_STEP_PATTERNS, text)) {
    return { noveltyScore, obviousness, multiStepApplied: false };
  }
  if (!(matchesAny(scoringPatterns.EMERGENT_CONSEQUENCE_PATTERNS, text)
    || matchesAny(scoringPatterns.TRADEOFF_IMPLICATION_PATTERNS, text)
    || matchesAny(scoringPatterns.OPTIMIZATION_CHAIN_PATTERNS, text))) {
    return { noveltyScore, obviousness, multiStepApplied: false };
  }
  const boostedNovelty = Math.min(1, (noveltyScore ?? 0.5) + 0.08);
  const reducedObviousness = Math.max(0, (obviousness ?? 0.5) - 0.05);
  return { noveltyScore: boostedNovelty, obviousness: reducedObviousness, multiStepApplied: true };
}

function applyDeepImplicationBoost(text, interactionCount, systemsCount, noveltyScore, obviousness) {
  const deepSignal = matchesAny(scoringPatterns.DEEP_IMPLICATION_PATTERNS, text)
    || matchesAny(scoringPatterns.SCALING_CONSTRAINT_PATTERNS, text)
    || matchesAny(scoringPatterns.FAILURE_BEHAVIOR_PATTERNS, text);
  if (!deepSignal) {
    return { noveltyScore, obviousness, deepBoostApplied: false };
  }
  if (interactionCount < 2 && systemsCount < 2) {
    return { noveltyScore, obviousness, deepBoostApplied: false };
  }
  const boostedNovelty = Math.min(1, (noveltyScore ?? 0.5) + 0.1);
  const reducedObviousness = Math.max(0, (obviousness ?? 0.5) - 0.06);
  return { noveltyScore: boostedNovelty, obviousness: reducedObviousness, deepBoostApplied: true };
}

function applyFailureConstraintBonus(text, noveltyScore, obviousness, anchorOk) {
  if (!anchorOk || !matchesAny(groundingPatterns.FAILURE_CONSTRAINT_PATTERNS, text)) {
    return { noveltyScore, obviousness, failureBonusApplied: false };
  }
  const boostedNovelty = Math.min(1, (noveltyScore ?? 0.5) + 0.12);
  const reducedObviousness = Math.max(0, (obviousness ?? 0.5) - 0.06);
  return { noveltyScore: boostedNovelty, obviousness: reducedObviousness, failureBonusApplied: true };
}

function inferArchetypes(text, families) {
  const results = new Set();
  const familyList = Array.isArray(families) ? families : [];
  const familySet = new Set(familyList);
  Object.entries(scoringPatterns.ARCHETYPE_FAMILY_MAP).forEach(([key, familyGroup]) => {
    let hits = 0;
    for (const family of familyGroup) {
      if (familySet.has(family)) hits += 1;
    }
    if (hits >= 2) results.add(key);
  });
  Object.entries(scoringPatterns.ARCHETYPE_TEXT_PATTERNS).forEach(([key, patterns]) => {
    if (matchesAny(patterns, text)) results.add(key);
  });
  return results;
}

function applyExperiencedGate(text, families, noveltyScore, obviousness) {
  if (hasGameplayConsequence(text)) {
    return { noveltyScore, obviousness, experiencedGateApplied: false };
  }
  const archetypes = inferArchetypes(text, families);
  if (!archetypes.size) {
    return { noveltyScore, obviousness, experiencedGateApplied: false };
  }
  for (const archetype of archetypes) {
    const patterns = scoringPatterns.ARCHETYPE_OBVIOUS_PATTERNS[archetype] || [];
    if (matchesAny(patterns, text)) {
      const boostedObviousness = Math.min(1, (obviousness ?? 0.4) + 0.06);
      const reducedNovelty = Math.max(0, (noveltyScore ?? 0.5) - 0.04);
      return { noveltyScore: reducedNovelty, obviousness: boostedObviousness, experiencedGateApplied: true };
    }
  }
  return { noveltyScore, obviousness, experiencedGateApplied: false };
}

function computeSystemicDepth(textLower, interactionCount, systemsCount) {
  const chainSignal = matchesAny(groundingPatterns.CAUSAL_CHAIN_PATTERNS, textLower)
    || matchesAny(scoringPatterns.DEEP_IMPLICATION_PATTERNS, textLower);
  const emergentSignal = matchesAny(scoringPatterns.SYSTEMIC_PATTERN_SIGNALS, textLower)
    || matchesAny(scoringPatterns.FAILURE_BEHAVIOR_PATTERNS, textLower);
  const spreadSignal = matchesAny(scoringPatterns.INTERACTION_SPREAD_PATTERNS, textLower)
    || (interactionCount >= 2 && systemsCount >= 2);

  let depthScore = 0;
  if (chainSignal) depthScore += 0.4;
  if (emergentSignal) depthScore += 0.4;
  if (spreadSignal) depthScore += 0.2;
  depthScore = Math.min(1, Number(depthScore.toFixed(2)));

  return {
    depthScore,
    chainSignal,
    emergentSignal,
    spreadSignal
  };
}

function computeRoleTags(textLower, interactionCount, systemsCount, familiesCount) {
  const tags = new Set();
  const workflow = matchesAny(groundingPatterns.DEPENDENCY_GATING_PATTERNS, textLower)
    || matchesAny(scoringPatterns.RESOURCE_DEPENDENCY_PATTERNS, textLower)
    || matchesAny(scoringPatterns.SUPPORTING_SIGNAL_PATTERNS, textLower);
  const implication = matchesAny(scoringPatterns.EMERGENT_CONSEQUENCE_PATTERNS, textLower)
    || matchesAny(scoringPatterns.TRADEOFF_IMPLICATION_PATTERNS, textLower)
    || matchesAny(scoringPatterns.GAMEPLAY_IMPLICATION_PATTERNS, textLower)
    || (matchesAny(scoringPatterns.OPTIMIZATION_CHAIN_PATTERNS, textLower) && (interactionCount >= 2 || systemsCount >= 2));
  const operational = (systemsCount > 0 || familiesCount > 0) && !implication;

  if (workflow) tags.add('workflow');
  if (implication) tags.add('gameplay_implication');
  if (operational) tags.add('operational');

  return Array.from(tags);
}

function shouldApplyResourcePenalty(text, interactionCount, systemsCount) {
  if (!matchesAny(scoringPatterns.RESOURCE_DEPENDENCY_PATTERNS, text)) return false;
  if (matchesAny(scoringPatterns.EMERGENT_CONSEQUENCE_PATTERNS, text)) return false;
  if (matchesAny(scoringPatterns.TRADEOFF_IMPLICATION_PATTERNS, text)) return false;
  if (interactionCount >= 2 || systemsCount >= 2) return false;
  return true;
}

function getRetentionPatternBundle() {
  return {
    emergentConsequence: scoringPatterns.EMERGENT_CONSEQUENCE_PATTERNS,
    tradeoffImplication: scoringPatterns.TRADEOFF_IMPLICATION_PATTERNS,
    optimizationChain: scoringPatterns.OPTIMIZATION_CHAIN_PATTERNS,
    multiStep: scoringPatterns.MULTI_STEP_PATTERNS,
    deepImplication: scoringPatterns.DEEP_IMPLICATION_PATTERNS,
    scalingConstraint: scoringPatterns.SCALING_CONSTRAINT_PATTERNS,
    failureBehavior: scoringPatterns.FAILURE_BEHAVIOR_PATTERNS,
    dependencyGating: groundingPatterns.DEPENDENCY_GATING_PATTERNS,
    supportingSignal: scoringPatterns.SUPPORTING_SIGNAL_PATTERNS,
    resourceDependency: scoringPatterns.RESOURCE_DEPENDENCY_PATTERNS,
    gameplayImplication: scoringPatterns.GAMEPLAY_IMPLICATION_PATTERNS,
    obviousnessBoost: scoringPatterns.OBVIOUSNESS_BOOST_PATTERNS
  };
}

module.exports = {
  hasGameplayConsequence,
  applyObviousnessBoost,
  applyTemplatePenalty,
  applyAbilityTemplatePenalty,
  applySpecificityBonus,
  applyGameplayImplicationBoost,
  applyEmergentConsequenceBonus,
  applyOptimizationChainBoost,
  applyMultiStepBoost,
  applyDeepImplicationBoost,
  applyFailureConstraintBonus,
  applyExperiencedGate,
  computeSystemicDepth,
  computeRoleTags,
  shouldApplyResourcePenalty,
  getRetentionPatternBundle
};
