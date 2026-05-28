const { filters: filterPatterns, scoring: scoringPatterns, grounding: groundingPatterns } = require('../shared/patterns');
const { matchesAny } = require('../shared/utils');
const scoring = require('../scoring');

function looksTutorial(text) {
  return matchesAny(filterPatterns.TUTORIAL_PATTERNS, text);
}

function looksGeneric(text) {
  return matchesAny(filterPatterns.GENERIC_PATTERNS, text);
}

function looksWeakTradeoffTemplate(text) {
  return matchesAny(filterPatterns.WEAK_TRADEOFF_TEMPLATES, text);
}

function isWikiEditorialContamination(text) {
  return matchesAny(filterPatterns.WIKI_EDITORIAL_PATTERNS, text);
}

function isNonActionableGameplay(text) {
  if (!matchesAny(filterPatterns.NON_ACTIONABLE_PATTERNS, text)) return false;
  if (matchesAny(filterPatterns.GAMEPLAY_SIGNAL_PATTERNS, text)) return false;
  if (matchesAny(scoringPatterns.EMERGENT_CONSEQUENCE_PATTERNS, text)) return false;
  if (matchesAny(scoringPatterns.TRADEOFF_IMPLICATION_PATTERNS, text)) return false;
  return true;
}

function isLoreNonActionable(text) {
  if (!matchesAny(filterPatterns.LORE_NARRATIVE_PATTERNS, text)) return false;
  if (matchesAny(filterPatterns.GAMEPLAY_SIGNAL_PATTERNS, text)) return false;
  if (matchesAny(scoringPatterns.EMERGENT_CONSEQUENCE_PATTERNS, text)) return false;
  if (matchesAny(scoringPatterns.TRADEOFF_IMPLICATION_PATTERNS, text)) return false;
  return true;
}

function isTimeBoundMetadata(text) {
  if (!matchesAny(filterPatterns.TIME_BOUND_PATTERNS, text)) return false;
  if (matchesAny(filterPatterns.EVERGREEN_MECHANIC_PATTERNS, text)) return false;
  if (matchesAny(scoringPatterns.EMERGENT_CONSEQUENCE_PATTERNS, text)) return false;
  if (matchesAny(scoringPatterns.TRADEOFF_IMPLICATION_PATTERNS, text)) return false;
  return true;
}

function isLiveServiceContamination(text) {
  if (!matchesAny(filterPatterns.LIVE_SERVICE_PATTERNS, text)) return false;
  if (matchesAny(filterPatterns.GAMEPLAY_IMPACT_PATTERNS, text)) return false;
  if (matchesAny(scoringPatterns.EMERGENT_CONSEQUENCE_PATTERNS, text)) return false;
  if (matchesAny(scoringPatterns.TRADEOFF_IMPLICATION_PATTERNS, text)) return false;
  return true;
}

function isCosmeticOnly(text) {
  if (!matchesAny(filterPatterns.COSMETIC_ONLY_PATTERNS, text)) return false;
  if (matchesAny(filterPatterns.GAMEPLAY_SIGNAL_PATTERNS, text)) return false;
  if (matchesAny(scoringPatterns.EMERGENT_CONSEQUENCE_PATTERNS, text)) return false;
  if (matchesAny(scoringPatterns.TRADEOFF_IMPLICATION_PATTERNS, text)) return false;
  if (scoring.hasGameplayConsequence(text)) return false;
  return true;
}

function isHardLowSignal(text) {
  if (!matchesAny(filterPatterns.LOW_SIGNAL_PATTERNS, text)) return false;
  if (matchesAny(scoringPatterns.EMERGENT_CONSEQUENCE_PATTERNS, text)) return false;
  if (matchesAny(scoringPatterns.TRADEOFF_IMPLICATION_PATTERNS, text)) return false;
  return true;
}

function hasGameplaySignal(text) {
  return matchesAny(filterPatterns.GAMEPLAY_SIGNAL_PATTERNS, text);
}

function applyDependencySuppression(text, interactionCount, systemsCount, noveltyScore, obviousness) {
  if (!matchesAny(groundingPatterns.DEPENDENCY_GATING_PATTERNS, text)) {
    return { noveltyScore, obviousness, dependencyPenaltyApplied: false, hardDrop: false };
  }
  if (isPureDependencyGate(text, interactionCount, systemsCount)) {
    return { noveltyScore, obviousness, dependencyPenaltyApplied: false, hardDrop: true };
  }
  const boostedObviousness = Math.min(1, (obviousness ?? 0.4) + 0.14);
  const reducedNovelty = Math.max(0, (noveltyScore ?? 0.5) - 0.1);
  return { noveltyScore: reducedNovelty, obviousness: boostedObviousness, dependencyPenaltyApplied: true, hardDrop: false };
}

function isPureDependencyGate(text, interactionCount, systemsCount) {
  if (!matchesAny(groundingPatterns.DEPENDENCY_GATING_PATTERNS, text)) return false;
  if (scoring.hasGameplayConsequence(text)) return false;
  if (interactionCount >= 2 || systemsCount >= 2) return false;
  return true;
}

function applyEvergreenTightening(text, noveltyScore, obviousness) {
  if (!matchesAny(filterPatterns.EVERGREEN_TIGHTEN_PATTERNS, text)) {
    return { noveltyScore, obviousness, evergreenPenaltyApplied: false, hardDrop: false };
  }
  if (matchesAny(filterPatterns.EVERGREEN_MECHANIC_PATTERNS, text) || scoring.hasGameplayConsequence(text)) {
    const boostedObviousness = Math.min(1, (obviousness ?? 0.4) + 0.1);
    const reducedNovelty = Math.max(0, (noveltyScore ?? 0.5) - 0.08);
    return { noveltyScore: reducedNovelty, obviousness: boostedObviousness, evergreenPenaltyApplied: true, hardDrop: false };
  }
  return { noveltyScore, obviousness, evergreenPenaltyApplied: false, hardDrop: true };
}

function applyShallowActionPenalty(text, interactionCount, systemsCount, noveltyScore, obviousness) {
  if (!matchesAny(scoringPatterns.SHALLOW_ACTION_PATTERNS, text)) {
    return { noveltyScore, obviousness, shallowPenaltyApplied: false };
  }
  if (scoring.hasGameplayConsequence(text)) {
    return { noveltyScore, obviousness, shallowPenaltyApplied: false };
  }
  if (interactionCount >= 2 || systemsCount >= 2) {
    return { noveltyScore, obviousness, shallowPenaltyApplied: false };
  }
  const boostedObviousness = Math.min(1, (obviousness ?? 0.4) + 0.1);
  const reducedNovelty = Math.max(0, (noveltyScore ?? 0.5) - 0.06);
  return { noveltyScore: reducedNovelty, obviousness: boostedObviousness, shallowPenaltyApplied: true };
}

function applyWorkflowPenalty(text, interactionCount, systemsCount, noveltyScore, obviousness) {
  const isWorkflow = matchesAny(groundingPatterns.DEPENDENCY_GATING_PATTERNS, text)
    || matchesAny(scoringPatterns.RESOURCE_DEPENDENCY_PATTERNS, text)
    || matchesAny(scoringPatterns.SUPPORTING_SIGNAL_PATTERNS, text);
  if (!isWorkflow) {
    return { noveltyScore, obviousness, workflowPenaltyApplied: false };
  }
  if (scoring.hasGameplayConsequence(text)) {
    return { noveltyScore, obviousness, workflowPenaltyApplied: false };
  }
  if (interactionCount >= 2 || systemsCount >= 2) {
    return { noveltyScore, obviousness, workflowPenaltyApplied: false };
  }
  const boostedObviousness = Math.min(1, (obviousness ?? 0.4) + 0.12);
  const reducedNovelty = Math.max(0, (noveltyScore ?? 0.5) - 0.08);
  return { noveltyScore: reducedNovelty, obviousness: boostedObviousness, workflowPenaltyApplied: true };
}

function applyResourcePenalty(text, interactionCount, systemsCount, noveltyScore, obviousness) {
  if (!scoring.shouldApplyResourcePenalty(text, interactionCount, systemsCount)) {
    return { noveltyScore, obviousness, resourcePenaltyApplied: false };
  }
  const boostedObviousness = Math.min(1, (obviousness ?? 0.4) + 0.15);
  const reducedNovelty = Math.max(0, (noveltyScore ?? 0.5) - 0.1);
  return { noveltyScore: reducedNovelty, obviousness: boostedObviousness, resourcePenaltyApplied: true };
}

function applyMechanicFirstReframe(text, grounding) {
  if (!grounding || !grounding.anchor || !grounding.adviceTone) return text;
  let updated = String(text || '');
  updated = updated.replace(/^\s*(you\s+)?(should|shouldn'?t|ensure|make sure|remember)\b\s*/i, '');
  updated = updated.replace(/^\s*(to\s+avoid|to\s+prevent)\b\s*/i, '');
  updated = updated.replace(/^\s*(carefully|strategically)\b\s*/i, '');
  updated = updated.replace(/\s*\.\s*$/, '');
  return updated.trim();
}

function applyNarrationPenalty(noveltyScore, obviousness, grounding) {
  if (grounding.syntheticNarration && !grounding.anchor) {
    grounding.narrationPenaltyApplied = true;
    return {
      noveltyScore: Math.max(0, (noveltyScore ?? 0.5) - 0.06),
      obviousness: Math.min(1, (obviousness ?? 0.5) + 0.06)
    };
  }
  return { noveltyScore, obviousness };
}

function applyAdvicePenalty(noveltyScore, obviousness, grounding) {
  if (grounding.adviceTone && !grounding.anchor) {
    grounding.advicePenaltyApplied = true;
    if (!grounding.demotionReason) grounding.demotionReason = 'advice-tone';
    return {
      noveltyScore: Math.max(0, (noveltyScore ?? 0.5) - 0.09),
      obviousness: Math.min(1, (obviousness ?? 0.5) + 0.09)
    };
  }
  return { noveltyScore, obviousness };
}

function applyProceduralPenalty(noveltyScore, obviousness, grounding) {
  if (grounding.procedural && !grounding.recoveredImplication) {
    grounding.proceduralPenaltyApplied = true;
    if (!grounding.demotionReason) grounding.demotionReason = 'procedural';
    return {
      noveltyScore: Math.max(0, (noveltyScore ?? 0.5) - 0.08),
      obviousness: Math.min(1, (obviousness ?? 0.5) + 0.08)
    };
  }
  return { noveltyScore, obviousness };
}

function applyMissingAnchorPenalty(noveltyScore, obviousness, grounding, roleTags) {
  if (roleTags.includes('gameplay_implication') && !grounding.anchor) {
    grounding.demotionReason = 'missing-anchor';
    return {
      noveltyScore: Math.max(0, (noveltyScore ?? 0.5) - 0.08),
      obviousness: Math.min(1, (obviousness ?? 0.5) + 0.08)
    };
  }
  return { noveltyScore, obviousness };
}

module.exports = {
  looksTutorial,
  looksGeneric,
  looksWeakTradeoffTemplate,
  isWikiEditorialContamination,
  isNonActionableGameplay,
  isLoreNonActionable,
  isTimeBoundMetadata,
  isLiveServiceContamination,
  isCosmeticOnly,
  isHardLowSignal,
  hasGameplaySignal,
  applyDependencySuppression,
  applyEvergreenTightening,
  applyShallowActionPenalty,
  applyWorkflowPenalty,
  applyResourcePenalty,
  applyMechanicFirstReframe,
  applyNarrationPenalty,
  applyAdvicePenalty,
  applyProceduralPenalty,
  applyMissingAnchorPenalty
};
