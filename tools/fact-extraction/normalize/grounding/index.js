const { createSignalComputer } = require('../shared/signals');
const { createRepresentationComputer } = require('../shared/representation');
const { buildCompositionHints } = require('../composition/composition-hints');
const { grounding: groundingPatterns, scoring: scoringPatterns, filters: filterPatterns } = require('../shared/patterns');
const { matchesAny } = require('../shared/utils');

const GENERIC_TOKENS = new Set([
  'resource', 'resources', 'time', 'power', 'materials', 'material', 'food', 'energy',
  'defense', 'defenses', 'health', 'mood', 'risk', 'tradeoff', 'strategy', 'management',
  'efficiency', 'productivity', 'safety', 'colony', 'colonies', 'colonist', 'colonists',
  'building', 'buildings', 'research', 'system', 'mechanic', 'mechanics', 'game', 'play',
  'early', 'mid', 'late'
]);

function createGroundingComputer(options) {
  const normalizeText = options.normalizeText;
  const tokenizeText = options.tokenizeText;

  const representationComputer = createRepresentationComputer({
    normalizeText,
    tokenizeText
  });

  const signalComputer = createSignalComputer({
    matchesAny,
    tokenizeText,
    genericTokens: GENERIC_TOKENS,
    patterns: {
      condition: groundingPatterns.CONDITION_PATTERNS,
      dependencyGating: groundingPatterns.DEPENDENCY_GATING_PATTERNS,
      stateChange: groundingPatterns.STATE_CHANGE_PATTERNS,
      emergentConsequence: scoringPatterns.EMERGENT_CONSEQUENCE_PATTERNS,
      tradeoffImplication: scoringPatterns.TRADEOFF_IMPLICATION_PATTERNS,
      failureBehavior: scoringPatterns.FAILURE_BEHAVIOR_PATTERNS,
      stateTransition: groundingPatterns.STATE_TRANSITION_PATTERNS,
      downstreamImpact: groundingPatterns.DOWNSTREAM_IMPACT_PATTERNS,
      constraintChain: groundingPatterns.CONSTRAINT_CHAIN_PATTERNS,
      failureConstraint: groundingPatterns.FAILURE_CONSTRAINT_PATTERNS,
      causalChain: groundingPatterns.CAUSAL_CHAIN_PATTERNS,
      multiStep: groundingPatterns.MULTI_STEP_PATTERNS,
      syntheticNarration: groundingPatterns.SYNTHETIC_NARRATION_PATTERNS,
      adviceTone: groundingPatterns.ADVICE_TONE_PATTERNS
    }
  });

  const computeProceduralFlag = (textLower, grounding) => {
    if (!grounding) return false;
    const lacksImpact = !grounding.hasEffect
      && !grounding.failureConstraint
      && !grounding.stateTransition
      && !grounding.downstreamImpact
      && !grounding.constraintChain;
    if (!lacksImpact) return false;
    const workflowSignal = matchesAny(scoringPatterns.SUPPORTING_SIGNAL_PATTERNS, textLower)
      || matchesAny(groundingPatterns.DEPENDENCY_GATING_PATTERNS, textLower)
      || matchesAny(scoringPatterns.RESOURCE_DEPENDENCY_PATTERNS, textLower)
      || matchesAny(filterPatterns.TUTORIAL_PATTERNS, textLower)
      || grounding.adviceTone;
    return workflowSignal;
  };

  const computeRecoveryFlag = (grounding) => {
    if (!grounding || !grounding.anchor || !grounding.hasCondition || !grounding.hasEffect) return false;
    if (grounding.multiStep) return false;
    return grounding.downstreamImpact
      || grounding.constraintChain
      || grounding.failureConstraint
      || grounding.stateTransition
      || grounding.causalChain;
  };

  const buildMechanicShape = (grounding) => {
    return representationComputer.buildMechanicShape(grounding);
  };

  const buildMechanicCore = (grounding, systems, families, keywordsNormalized) => {
    return representationComputer.buildMechanicCore(
      grounding,
      systems,
      families,
      keywordsNormalized
    );
  };

  const computeRepresentationStats = (text, grounding, core) => {
    return representationComputer.computeRepresentationStats(text, grounding, core);
  };

  const buildCompositionHintsLocal = (grounding, mechanicCore) => {
    return buildCompositionHints(grounding, mechanicCore);
  };

  return {
    hasSpecificSignal: signalComputer.hasSpecificSignal,
    hasMechanisticEntity: signalComputer.hasMechanisticEntity,
    detectGroundingSignals: signalComputer.detectGroundingSignals,
    computeGroundingSignals: signalComputer.computeGroundingSignals,
    computeProceduralFlag,
    computeRecoveryFlag,
    buildMechanicShape,
    buildMechanicCore,
    buildCompositionHints: buildCompositionHintsLocal,
    computeRepresentationStats
  };
}

module.exports = {
  createGroundingComputer
};
