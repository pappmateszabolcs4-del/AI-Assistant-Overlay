function createRepresentationComputer(options) {
  const normalizeText = options.normalizeText;
  const tokenizeText = options.tokenizeText;

  const buildMechanicShape = (grounding) => {
    if (!grounding) return null;
    const hasCondition = !!grounding.hasCondition;
    const hasEffect = !!grounding.hasEffect;
    const stateTransition = !!grounding.stateTransition;
    const downstreamImpact = !!grounding.downstreamImpact;
    const constraintChain = !!grounding.constraintChain;
    const failureConstraint = !!grounding.failureConstraint;
    const activeSignals = Number(hasCondition) + Number(hasEffect) + Number(stateTransition)
      + Number(downstreamImpact) + Number(constraintChain) + Number(failureConstraint);
    const structuralCore = hasCondition && hasEffect
      && (stateTransition || downstreamImpact || constraintChain || failureConstraint);
    return {
      hasCondition,
      hasEffect,
      stateTransition,
      downstreamImpact,
      constraintChain,
      failureConstraint,
      activeSignals,
      structuralCore,
      shapeKey: `C${Number(hasCondition)}E${Number(hasEffect)}T${Number(stateTransition)}D${Number(downstreamImpact)}K${Number(constraintChain)}F${Number(failureConstraint)}`
    };
  };

  const buildMechanicCore = (grounding, systems, families, keywordsNormalized) => {
    const entities = [];
    const pushUnique = (value) => {
      const normalized = normalizeText(value).toLowerCase();
      if (!normalized) return;
      if (!entities.includes(normalized)) entities.push(normalized);
    };
    (Array.isArray(systems) ? systems : []).forEach(pushUnique);
    (Array.isArray(families) ? families : []).forEach(pushUnique);
    (Array.isArray(keywordsNormalized) ? keywordsNormalized : []).forEach(pushUnique);
    const limitedEntities = entities.slice(0, 6);
    const core = {
      entities: limitedEntities,
      hasCondition: !!(grounding && grounding.hasCondition),
      hasEffect: !!(grounding && grounding.hasEffect),
      stateTransition: !!(grounding && grounding.stateTransition),
      constraint: !!(grounding && (grounding.failureConstraint || grounding.constraintChain)),
      downstream: !!(grounding && grounding.downstreamImpact),
      structuralCore: !!(grounding && grounding.mechanicShape && grounding.mechanicShape.structuralCore)
    };
    const present = [
      core.entities.length > 0,
      core.hasCondition,
      core.hasEffect,
      core.stateTransition,
      core.constraint,
      core.downstream
    ];
    core.coverage = present.filter(Boolean).length;
    core.partial = core.coverage > 0;
    core.coreKey = `E${core.entities.length}C${Number(core.hasCondition)}E${Number(core.hasEffect)}T${Number(core.stateTransition)}K${Number(core.constraint)}D${Number(core.downstream)}`;
    core.coreText = [
      core.entities.length ? `Entities: ${core.entities.join(', ')}` : '',
      core.hasCondition ? 'Condition: yes' : '',
      core.hasEffect ? 'Effect: yes' : '',
      core.stateTransition ? 'Transition: yes' : '',
      core.constraint ? 'Constraint: yes' : '',
      core.downstream ? 'Downstream: yes' : ''
    ].filter(Boolean).join(' | ');
    return core;
  };

  const countSentences = (text) => {
    const cleaned = String(text || '').trim();
    if (!cleaned) return 0;
    const matches = cleaned.match(/[.!?]+/g);
    return matches ? matches.length : 1;
  };

  const computeRepresentationStats = (text, grounding, core) => {
    const textValue = String(text || '');
    const sentenceCount = countSentences(textValue);
    const tokens = tokenizeText(textValue);
    const tokenCount = tokens.length;
    const uniqueTokenShare = tokenCount ? (new Set(tokens)).size / tokenCount : 0;
    const length = textValue.length;
    const coreCoverage = core && Number.isFinite(core.coverage) ? core.coverage : 0;
    const coreEntities = core && Array.isArray(core.entities) ? core.entities.length : 0;
    let compactnessScore = 1;
    if (length >= 160) compactnessScore -= 0.2;
    if (sentenceCount >= 2) compactnessScore -= 0.2;
    if (grounding && grounding.adviceTone) compactnessScore -= 0.1;
    if (grounding && grounding.syntheticNarration) compactnessScore -= 0.1;
    compactnessScore = Math.max(0, Number(compactnessScore.toFixed(2)));
    let coreDrivenCompactness = compactnessScore;
    if (coreCoverage >= 3) coreDrivenCompactness += 0.1;
    if (coreCoverage === 0) coreDrivenCompactness -= 0.05;
    coreDrivenCompactness = Math.max(0, Math.min(1, Number(coreDrivenCompactness.toFixed(2))));
    return {
      length,
      sentenceCount,
      tokenCount,
      uniqueTokenShare: Number(uniqueTokenShare.toFixed(3)),
      compactnessScore,
      coreDrivenCompactness,
      coreCoverage,
      coreEntities,
      verbose: length >= 160,
      tutorialResidue: !!(grounding && grounding.adviceTone && !grounding.transformed)
    };
  };

  return {
    buildMechanicShape,
    buildMechanicCore,
    computeRepresentationStats
  };
}

module.exports = {
  createRepresentationComputer
};
