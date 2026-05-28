const { matchesBlockedPattern } = require('./policy');
const { getTemplateShape } = require('./normalize/shared/template-shapes');
const {
  normalizeText,
  normalizeTextKey,
  tokenizeText,
  matchesAny,
  normalizeListEntries,
  mergeDropReasons,
  normalizePriority,
  normalizeSuggestedPriority,
  clampScore
} = require('./normalize/shared/utils');
const { createCanonicalSignals } = require('./normalize/canonical-signals');
const { createGroundingComputer } = require('./normalize/grounding');
const scoring = require('./normalize/scoring');
const filters = require('./normalize/filters');
const { applyDedupe } = require('./normalize/dedupe');
const { validateRepresentationStability } = require('./normalize/diagnostics/validation');
const { createRetentionEngine } = require('./normalize/retention/engine');
const { detectUtilitySignals } = require('./normalize/utility/signals');

const canonicalSignals = createCanonicalSignals({
  normalizeText,
  tokenizeText
});

const groundingComputer = createGroundingComputer({
  normalizeText,
  tokenizeText
});

const retentionEngine = createRetentionEngine({
  normalizeTextKey,
  matchesAny,
  looksWeakTradeoffTemplate: filters.looksWeakTradeoffTemplate,
  hasSpecificSignal: groundingComputer.hasSpecificSignal,
  hasGameplayConsequence: scoring.hasGameplayConsequence,
  computeSystemicDepth: scoring.computeSystemicDepth,
  computeRoleTags: scoring.computeRoleTags,
  shouldApplyResourcePenalty: scoring.shouldApplyResourcePenalty,
  getTemplateShape,
  normalizeSuggestedPriority,
  patterns: scoring.getRetentionPatternBundle()
});

function computeRetentionScore(fact) {
  return retentionEngine.computeRetentionScore(fact);
}

function computeRetentionScoreB(fact) {
  return retentionEngine.computeRetentionScoreB(fact);
}

function assignKnowledgeLayer(fact) {
  return retentionEngine.assignKnowledgeLayer(fact);
}

function applyP1Cap(facts) {
  retentionEngine.applyP1Cap(facts);
}

function applyTemplateRepetitionPenalty(facts) {
  retentionEngine.applyTemplateRepetitionPenalty(facts);
}

function decideFinalPriority(basePriority, suggestedPriority, noveltyScore, obviousness, interactionCount, systemsCount) {
  return retentionEngine.decideFinalPriority(
    basePriority,
    suggestedPriority,
    noveltyScore,
    obviousness,
    interactionCount,
    systemsCount
  );
}

function hasRejectedPayloadFields(payload, rejectFields) {
  const list = Array.isArray(rejectFields) ? rejectFields : [];
  for (const field of list) {
    if (!field) continue;
    if (payload && Object.prototype.hasOwnProperty.call(payload, field)) {
      const value = payload[field];
      if (typeof value === 'string' && value.trim()) return field;
      if (Array.isArray(value) && value.length) return field;
      if (value && typeof value === 'object') return field;
    }
  }
  return '';
}

function normalizeFactPayload(payload, policyInput) {
  const policy = policyInput || {};
  const traceNormalize = !!policy.traceNormalize;
  const scoringSteps = [];
  const scoreValue = (value, fallback) => (Number.isFinite(value) ? value : fallback);
  const recordScoreStep = (name, prevNovelty, prevObvious, nextNovelty, nextObvious, meta) => {
    if (!traceNormalize) return;
    const prevN = scoreValue(prevNovelty, 0.5);
    const prevO = scoreValue(prevObvious, 0.5);
    const nextN = scoreValue(nextNovelty, prevN);
    const nextO = scoreValue(nextObvious, prevO);
    const deltaN = Number((nextN - prevN).toFixed(3));
    const deltaO = Number((nextO - prevO).toFixed(3));
    const applied = meta && Object.prototype.hasOwnProperty.call(meta, 'applied')
      ? meta.applied
      : (deltaN !== 0 || deltaO !== 0);
    if (!applied) return;
    scoringSteps.push({
      name,
      noveltyDelta: deltaN,
      obviousnessDelta: deltaO,
      ...meta,
      applied
    });
  };
  const rejectedField = hasRejectedPayloadFields(payload, policy.rejectPayloadFields);
  if (rejectedField) {
    return { ok: false, error: 'raw-source-persistence' };
  }

  const text = normalizeText(payload && payload.text);
  if (!text) return { ok: false, error: 'missing-text' };
  const maxLength = policy.factLimits ? policy.factLimits.textMaxLength : 0;
  if (maxLength && text.length > maxLength) {
    return { ok: false, error: 'text-too-long' };
  }

  const textLower = text.toLowerCase();
  const contextWindow = normalizeText(payload && payload._contextWindow);
  const contextLower = contextWindow ? contextWindow.toLowerCase() : '';
  if (matchesBlockedPattern(textLower, policy.hardFilters ? policy.hardFilters.lorePatterns : [])) {
    return { ok: false, error: 'lore-pattern' };
  }
  if (filters.looksTutorial(textLower)) {
    return { ok: false, error: 'tutorial-pattern' };
  }
  if (filters.looksGeneric(textLower)) {
    return { ok: false, error: 'generic-pattern' };
  }
  if (filters.isLoreNonActionable(textLower)) {
    return { ok: false, error: 'lore-nonactionable' };
  }
  if (filters.isNonActionableGameplay(textLower)) {
    return { ok: false, error: 'non-actionable' };
  }
  if (filters.isWikiEditorialContamination(textLower)) {
    return { ok: false, error: 'wiki-editorial' };
  }
  if (filters.isTimeBoundMetadata(textLower)) {
    return { ok: false, error: 'time-bound-metadata' };
  }
  if (filters.isLiveServiceContamination(textLower)) {
    return { ok: false, error: 'live-service' };
  }
  if (filters.isCosmeticOnly(textLower)) {
    return { ok: false, error: 'cosmetic-only' };
  }
  if (filters.isHardLowSignal(textLower)) {
    return { ok: false, error: 'low-signal' };
  }
  if (filters.looksWeakTradeoffTemplate(textLower) && !groundingComputer.hasSpecificSignal(textLower)) {
    return { ok: false, error: 'low-signal-template' };
  }

  const sourceType = normalizeText(payload && payload.sourceType || payload && payload.source || 'user').toLowerCase();
  const allowList = policy.sourcePolicy ? policy.sourcePolicy.allowList : [];
  const blockList = policy.sourcePolicy ? policy.sourcePolicy.blockList : [];
  const blockedPatterns = policy.sourcePolicy ? policy.sourcePolicy.blockedPatterns : [];
  if (allowList.length && !allowList.includes(sourceType)) return { ok: false, error: 'source-not-allowed' };
  if (blockList.includes(sourceType)) return { ok: false, error: 'source-blocked' };
  if (matchesBlockedPattern(sourceType, blockedPatterns)) return { ok: false, error: 'source-blocked-pattern' };

  const keywords = normalizeListEntries(
    payload && payload.keywords,
    policy.factLimits ? policy.factLimits.keywordsMax : 0,
    policy.factLimits ? policy.factLimits.keywordMaxLength : 0
  );
  const keywordsNormalized = canonicalSignals.normalizeKeywordEntries(
    keywords,
    policy.factLimits ? policy.factLimits.keywordsMax : 0
  );
  const tags = normalizeListEntries(
    payload && payload.tags,
    policy.factLimits ? policy.factLimits.tagsMax : 0,
    policy.factLimits ? policy.factLimits.tagMaxLength : 0
  );

  const priority = normalizePriority(payload && payload.priority, policy);
  const suggestedPriority = normalizeSuggestedPriority(payload && payload.suggestedPriority);
  let noveltyScore = clampScore(payload && payload.noveltyScore);
  let obviousness = clampScore(payload && payload.obviousness);
  const interactionCountRaw = Number.isFinite(payload && payload.interactionCount)
    ? Math.max(0, Math.floor(payload.interactionCount))
    : 0;
  const systems = canonicalSignals.normalizeSystemsList(payload && payload.systems);
  const derivedSystems = canonicalSignals.extractSystemsFromText(textLower);
  let mergedSystems = canonicalSignals.normalizeSystemsList([].concat(systems, derivedSystems, payload && payload.system));
  const keywordFamilies = canonicalSignals.extractFamiliesFromText((keywordsNormalized || []).join(' '));
  const keywordFamilyHints = canonicalSignals.getKeywordFamilyHints(keywordsNormalized);
  const systemFamilies = canonicalSignals.deriveFamiliesFromSystems(mergedSystems);
  const derivedFamilies = canonicalSignals.extractFamiliesFromText(textLower);
  const mergedFamilies = canonicalSignals.normalizeFamilyList([].concat(
    payload && payload.mechanicFamilies,
    keywordFamilies,
    keywordFamilyHints,
    systemFamilies,
    derivedFamilies
  ));
  const familySystems = canonicalSignals.deriveSystemsFromFamilies(mergedFamilies);
  mergedSystems = canonicalSignals.normalizeSystemsList([].concat(mergedSystems, familySystems));
  const interactionCountFinal = mergedSystems.length;
  const roleTags = scoring.computeRoleTags(
    textLower,
    interactionCountFinal,
    mergedSystems.length,
    mergedFamilies.length
  );

  let scoreStep = scoring.applyObviousnessBoost(textLower, noveltyScore, obviousness);
  recordScoreStep('obviousnessBoost', noveltyScore, obviousness, scoreStep.noveltyScore, scoreStep.obviousness);
  ({ noveltyScore, obviousness } = scoreStep);

  scoreStep = scoring.applyTemplatePenalty(textLower, noveltyScore, obviousness);
  recordScoreStep('templatePenalty', noveltyScore, obviousness, scoreStep.noveltyScore, scoreStep.obviousness, {
    applied: !!scoreStep.shape,
    shape: scoreStep.shape || null
  });
  ({ noveltyScore, obviousness } = scoreStep);

  scoreStep = scoring.applyAbilityTemplatePenalty(textLower, noveltyScore, obviousness);
  recordScoreStep('abilityTemplatePenalty', noveltyScore, obviousness, scoreStep.noveltyScore, scoreStep.obviousness, {
    applied: !!scoreStep.abilityPenaltyApplied
  });
  ({ noveltyScore, obviousness } = scoreStep);

  scoreStep = scoring.applySpecificityBonus(textLower, noveltyScore, obviousness);
  recordScoreStep('specificityBonus', noveltyScore, obviousness, scoreStep.noveltyScore, scoreStep.obviousness, {
    applied: !!scoreStep.specificityBonusApplied
  });
  ({ noveltyScore, obviousness } = scoreStep);

  scoreStep = scoring.applyGameplayImplicationBoost(
    textLower,
    interactionCountFinal,
    mergedSystems.length,
    noveltyScore,
    obviousness
  );
  recordScoreStep('gameplayImplicationBoost', noveltyScore, obviousness, scoreStep.noveltyScore, scoreStep.obviousness, {
    applied: !!scoreStep.implicationBoostApplied
  });
  ({ noveltyScore, obviousness } = scoreStep);

  scoreStep = scoring.applyEmergentConsequenceBonus(textLower, noveltyScore, obviousness);
  recordScoreStep('emergentConsequenceBonus', noveltyScore, obviousness, scoreStep.noveltyScore, scoreStep.obviousness, {
    applied: !!scoreStep.emergentBonusApplied
  });
  ({ noveltyScore, obviousness } = scoreStep);

  scoreStep = scoring.applyOptimizationChainBoost(
    textLower,
    interactionCountFinal,
    mergedSystems.length,
    noveltyScore,
    obviousness
  );
  recordScoreStep('optimizationChainBoost', noveltyScore, obviousness, scoreStep.noveltyScore, scoreStep.obviousness, {
    applied: !!scoreStep.optimizationBoostApplied
  });
  ({ noveltyScore, obviousness } = scoreStep);

  scoreStep = scoring.applyMultiStepBoost(textLower, noveltyScore, obviousness);
  recordScoreStep('multiStepBoost', noveltyScore, obviousness, scoreStep.noveltyScore, scoreStep.obviousness, {
    applied: !!scoreStep.multiStepApplied
  });
  ({ noveltyScore, obviousness } = scoreStep);

  scoreStep = scoring.applyDeepImplicationBoost(
    textLower,
    interactionCountFinal,
    mergedSystems.length,
    noveltyScore,
    obviousness
  );
  recordScoreStep('deepImplicationBoost', noveltyScore, obviousness, scoreStep.noveltyScore, scoreStep.obviousness, {
    applied: !!scoreStep.deepBoostApplied
  });
  ({ noveltyScore, obviousness } = scoreStep);
  const depthSignals = scoring.computeSystemicDepth(textLower, interactionCountFinal, mergedSystems.length);
  const grounding = groundingComputer.computeGroundingSignals(
    textLower,
    contextLower,
    interactionCountFinal,
    mergedSystems.length,
    mergedFamilies.length,
    keywordsNormalized.length
  );
  scoreStep = scoring.applyFailureConstraintBonus(
    textLower,
    noveltyScore,
    obviousness,
    grounding.anchor
  );
  recordScoreStep('failureConstraintBonus', noveltyScore, obviousness, scoreStep.noveltyScore, scoreStep.obviousness, {
    applied: !!scoreStep.failureBonusApplied
  });
  ({ noveltyScore, obviousness } = scoreStep);
  grounding.procedural = groundingComputer.computeProceduralFlag(textLower, grounding);
  grounding.recoveredImplication = groundingComputer.computeRecoveryFlag(grounding);
  grounding.mechanicShape = groundingComputer.buildMechanicShape(grounding);
  const mechanicCore = groundingComputer.buildMechanicCore(
    grounding,
    mergedSystems,
    mergedFamilies,
    keywordsNormalized
  );
  const compositionHints = groundingComputer.buildCompositionHints(grounding, mechanicCore);
  grounding.operationalContinuation = Boolean(
    compositionHints && compositionHints.utility && compositionHints.utility.operational
  );
  if (depthSignals.depthScore === 0) {
    const penaltyStep = filters.applyShallowActionPenalty(
      textLower,
      interactionCountFinal,
      mergedSystems.length,
      noveltyScore,
      obviousness
    );
    recordScoreStep('shallowActionPenalty', noveltyScore, obviousness, penaltyStep.noveltyScore, penaltyStep.obviousness, {
      applied: !!penaltyStep.shallowPenaltyApplied
    });
    ({ noveltyScore, obviousness } = penaltyStep);
  }
  const workflowStep = filters.applyWorkflowPenalty(
    textLower,
    interactionCountFinal,
    mergedSystems.length,
    noveltyScore,
    obviousness
  );
  recordScoreStep('workflowPenalty', noveltyScore, obviousness, workflowStep.noveltyScore, workflowStep.obviousness, {
    applied: !!workflowStep.workflowPenaltyApplied
  });
  ({ noveltyScore, obviousness } = workflowStep);

  scoreStep = scoring.applyExperiencedGate(
    textLower,
    mergedFamilies,
    noveltyScore,
    obviousness
  );
  recordScoreStep('experiencedGate', noveltyScore, obviousness, scoreStep.noveltyScore, scoreStep.obviousness, {
    applied: !!scoreStep.experiencedGateApplied
  });
  ({ noveltyScore, obviousness } = scoreStep);
  const narrationStep = filters.applyNarrationPenalty(noveltyScore, obviousness, grounding);
  recordScoreStep('narrationPenalty', noveltyScore, obviousness, narrationStep.noveltyScore, narrationStep.obviousness, {
    applied: !!grounding.narrationPenaltyApplied
  });
  ({ noveltyScore, obviousness } = narrationStep);

  const adviceStep = filters.applyAdvicePenalty(noveltyScore, obviousness, grounding);
  recordScoreStep('advicePenalty', noveltyScore, obviousness, adviceStep.noveltyScore, adviceStep.obviousness, {
    applied: !!grounding.advicePenaltyApplied
  });
  ({ noveltyScore, obviousness } = adviceStep);

  const proceduralStep = filters.applyProceduralPenalty(noveltyScore, obviousness, grounding);
  recordScoreStep('proceduralPenalty', noveltyScore, obviousness, proceduralStep.noveltyScore, proceduralStep.obviousness, {
    applied: !!grounding.proceduralPenaltyApplied
  });
  ({ noveltyScore, obviousness } = proceduralStep);

  const missingAnchorStep = filters.applyMissingAnchorPenalty(noveltyScore, obviousness, grounding, roleTags);
  recordScoreStep('missingAnchorPenalty', noveltyScore, obviousness, missingAnchorStep.noveltyScore, missingAnchorStep.obviousness, {
    applied: grounding.demotionReason === 'missing-anchor'
  });
  ({ noveltyScore, obviousness } = missingAnchorStep);

  const evergreenPenalty = filters.applyEvergreenTightening(textLower, noveltyScore, obviousness);
  recordScoreStep('evergreenPenalty', noveltyScore, obviousness, evergreenPenalty.noveltyScore, evergreenPenalty.obviousness, {
    applied: !!evergreenPenalty.evergreenPenaltyApplied,
    hardDrop: !!evergreenPenalty.hardDrop
  });
  noveltyScore = evergreenPenalty.noveltyScore;
  obviousness = evergreenPenalty.obviousness;
  if (evergreenPenalty.hardDrop) {
    return { ok: false, error: 'evergreen-drop' };
  }
  const dependencyPenalty = filters.applyDependencySuppression(
    textLower,
    interactionCountFinal,
    mergedSystems.length,
    noveltyScore,
    obviousness
  );
  recordScoreStep('dependencyPenalty', noveltyScore, obviousness, dependencyPenalty.noveltyScore, dependencyPenalty.obviousness, {
    applied: !!dependencyPenalty.dependencyPenaltyApplied,
    hardDrop: !!dependencyPenalty.hardDrop
  });
  noveltyScore = dependencyPenalty.noveltyScore;
  obviousness = dependencyPenalty.obviousness;
  if (dependencyPenalty.hardDrop) {
    return { ok: false, error: 'dependency-gate' };
  }
  const resourcePenalty = filters.applyResourcePenalty(
    textLower,
    interactionCountFinal,
    mergedSystems.length,
    noveltyScore,
    obviousness
  );
  recordScoreStep('resourcePenalty', noveltyScore, obviousness, resourcePenalty.noveltyScore, resourcePenalty.obviousness, {
    applied: !!resourcePenalty.resourcePenaltyApplied
  });
  noveltyScore = resourcePenalty.noveltyScore;
  obviousness = resourcePenalty.obviousness;
  const finalPriority = decideFinalPriority(
    priority,
    suggestedPriority,
    noveltyScore,
    obviousness,
    interactionCountFinal,
    mergedSystems.length
  );
  let priorityWithCap = resourcePenalty.resourcePenaltyApplied
    ? Math.min(finalPriority, 2)
    : finalPriority;
  if (dependencyPenalty.dependencyPenaltyApplied) {
    priorityWithCap = Math.min(priorityWithCap, 2);
  }
  if (evergreenPenalty.evergreenPenaltyApplied) {
    priorityWithCap = Math.min(priorityWithCap, 2);
  }
  const confidence = Number.isFinite(payload && payload.confidence)
    ? Math.max(0, Math.min(1, payload.confidence))
    : null;

  const transformedText = filters.applyMechanicFirstReframe(text, grounding);
  if (transformedText !== text) grounding.transformed = true;
  grounding.representationStats = groundingComputer.computeRepresentationStats(transformedText, grounding, mechanicCore);
  const compressionRatio = contextWindow && contextWindow.length
    ? Number((transformedText.length / contextWindow.length).toFixed(3))
    : null;
  grounding.compressionRatio = compressionRatio;
  grounding.compressed = Boolean(compressionRatio && compressionRatio < 0.6 && grounding.anchorScope === 'text');
  if (grounding.transformed) grounding.representation = 'transformed';
  else if (grounding.anchorScope === 'local') grounding.representation = 'inferred';
  else if (grounding.anchorScope === 'text') grounding.representation = grounding.compressed ? 'compressed' : 'extractive';
  else grounding.representation = 'synthetic';

  const fact = {
    text: transformedText,
    keywords,
    tags,
    priority: priorityWithCap
  };

  const chunkId = Number.isFinite(Number(payload && payload._chunkId))
    ? Number(payload._chunkId)
    : 0;
  if (chunkId) fact._chunkId = chunkId;

  if (payload && payload.id) fact.id = normalizeText(payload.id);
  if (payload && payload.system) fact.system = normalizeText(payload.system);
  if (payload && payload.gameStage) fact.gameStage = normalizeText(payload.gameStage);
  if (sourceType) fact.sourceType = sourceType;
  if (confidence !== null) fact.confidence = confidence;
  if (suggestedPriority) fact.suggestedPriority = `P${suggestedPriority}`;
  if (noveltyScore !== null) fact.noveltyScore = noveltyScore;
  if (obviousness !== null) fact.obviousness = obviousness;
  if (interactionCountFinal) fact.interactionCount = interactionCountFinal;
  if (mergedSystems.length) fact.systems = mergedSystems;
  if (mergedFamilies.length) fact.mechanicFamilies = mergedFamilies;
  if (keywordsNormalized.length) fact.keywordsNormalized = keywordsNormalized;
  if (mergedFamilies.length) fact.systemsNormalized = mergedFamilies;
  if (mechanicCore && mechanicCore.partial) fact.mechanicCore = mechanicCore;
  const evergreen = !filters.isTimeBoundMetadata(textLower) && !filters.isLiveServiceContamination(textLower)
    && (filters.hasGameplaySignal(textLower)
      || matchesAny(scoring.getRetentionPatternBundle().emergentConsequence, textLower)
      || matchesAny(scoring.getRetentionPatternBundle().tradeoffImplication, textLower)
      || mergedSystems.length > 0
      || mergedFamilies.length > 0);
  fact.evergreen = !!evergreen;

  if (roleTags.length) fact.roleTags = roleTags;

  if (depthSignals.depthScore && grounding.anchor) {
    fact.systemicDepth = depthSignals.depthScore;
    fact.depthSignals = Object.entries({
      chain: depthSignals.chainSignal,
      emergent: depthSignals.emergentSignal,
      spread: depthSignals.spreadSignal
    }).filter(([, value]) => value).map(([key]) => key);
  }

  fact._grounding = {
    anchor: grounding.anchor,
    anchorScope: grounding.anchorScope,
    anchorInText: grounding.anchorInText,
    anchorInLocal: grounding.anchorInLocal,
    hasEntity: grounding.hasEntity,
    hasCondition: grounding.hasCondition,
    hasEffect: grounding.hasEffect,
    syntheticNarration: grounding.syntheticNarration,
    adviceTone: grounding.adviceTone,
    failureConstraint: grounding.failureConstraint,
    stateTransition: grounding.stateTransition,
    downstreamImpact: grounding.downstreamImpact,
    constraintChain: grounding.constraintChain,
    causalChain: grounding.causalChain,
    multiStep: grounding.multiStep,
    continuationScope: grounding.continuationScope,
    procedural: grounding.procedural,
    recoveredImplication: grounding.recoveredImplication,
    operationalContinuation: grounding.operationalContinuation,
    mechanicShape: grounding.mechanicShape,
    mechanicCore,
    compositionHints,
    representationStats: grounding.representationStats,
    transformed: !!grounding.transformed,
    representation: grounding.representation,
    compressed: !!grounding.compressed,
    compressionRatio: grounding.compressionRatio,
    narrationPenaltyApplied: !!grounding.narrationPenaltyApplied,
    advicePenaltyApplied: !!grounding.advicePenaltyApplied,
    proceduralPenaltyApplied: !!grounding.proceduralPenaltyApplied,
    demotionReason: grounding.demotionReason || ''
  };

  const layerInfo = assignKnowledgeLayer(fact);
  fact.layer = layerInfo.layer;
  fact.retentionScoreA = layerInfo.retentionScoreA;
  fact.retentionScoreB = layerInfo.retentionScoreB;

  if (traceNormalize) {
    fact._trace = {
      scoringSteps,
      retentionAttributionA: retentionEngine.computeRetentionAttribution(fact),
      retentionAttributionB: retentionEngine.computeRetentionAttributionB(fact)
    };
  }

  if (traceNormalize && policy.traceUtility) {
    fact.utilitySignals = detectUtilitySignals(textLower);
  }

  return { ok: true, fact };
}

function normalizeFactListRaw(list, policyInput) {
  const policy = policyInput || {};
  const facts = [];
  const dropReasons = {};
  let dropped = 0;
  const entries = Array.isArray(list) ? list : [];
  for (const entry of entries) {
    const result = normalizeFactPayload(entry, policy);
    if (!result.ok) {
      dropped += 1;
      dropReasons[result.error] = (dropReasons[result.error] || 0) + 1;
      continue;
    }
    facts.push(result.fact);
  }
  return { facts, dropped, dropReasons };
}

function normalizeFactListRawDetailed(list, policyInput) {
  const policy = policyInput || {};
  const facts = [];
  const dropReasons = {};
  const items = [];
  let dropped = 0;
  const entries = Array.isArray(list) ? list : [];
  for (const entry of entries) {
    const result = normalizeFactPayload(entry, policy);
    if (!result.ok) {
      dropped += 1;
      dropReasons[result.error] = (dropReasons[result.error] || 0) + 1;
      items.push({ ok: false, error: result.error, input: entry });
      continue;
    }
    facts.push(result.fact);
    items.push({ ok: true, fact: result.fact, input: entry });
  }
  return { facts, dropped, dropReasons, items };
}

function applyRetentionShaping(facts) {
  retentionEngine.applyRetentionShaping(facts);
}

function normalizeFactList(list, policyInput) {
  const raw = normalizeFactListRaw(list, policyInput);
  const deduped = applyDedupe(raw.facts, policyInput, { normalizeTextKey, tokenizeText });
  applyRetentionShaping(deduped.facts);
  return {
    facts: deduped.facts,
    dropped: raw.dropped + deduped.dropped,
    dropReasons: mergeDropReasons(raw.dropReasons, deduped.dropReasons),
    exactDeduped: deduped.exactDeduped,
    nearDuplicateMarked: deduped.nearDuplicateMarked,
    nearDuplicateDropped: deduped.nearDuplicateDropped
  };
}

module.exports = {
  normalizeFactPayload,
  normalizeFactList,
  normalizeFactListRaw,
  normalizeFactListRawDetailed,
  applyDedupe,
  applyRetentionShaping,
  mergeDropReasons,
  getTemplateShape,
  computeRetentionScore,
  computeRetentionScoreB,
  assignKnowledgeLayer,
  applyP1Cap,
  applyTemplateRepetitionPenalty,
  decideFinalPriority,
  validateRepresentationStability
};
