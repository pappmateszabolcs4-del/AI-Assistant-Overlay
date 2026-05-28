function initGroundingDiagnostics() {
  return {
    total: 0,
    implicationTotal: 0,
    anchorCoverage: 0,
    anchorTextShare: 0,
    anchorLocalShare: 0,
    groundedImplicationShare: 0,
    syntheticNarrationShare: 0,
    adviceToneShare: 0,
    adviceToneUnanchoredShare: 0,
    recommendationStyleShare: 0,
    mechanicFirstShare: 0,
    proceduralShare: 0,
    downstreamImpactShare: 0,
    stateTransitionShare: 0,
    constraintChainShare: 0,
    localPropagationShare: 0,
    recoveredImplicationShare: 0,
    transformedShare: 0,
    structureSignalShare: 0,
    representationShares: {
      extractive: 0,
      inferred: 0,
      compressed: 0,
      transformed: 0,
      synthetic: 0
    },
    failureConstraintShare: 0,
    explicitImplicationShare: 0,
    inferredImplicationShare: 0,
    extractiveShare: 0,
    localGroundedShare: 0,
    syntheticShare: 0,
    recommendationVsMechanicRatio: 0,
    implicationRecoveryRate: 0,
    demotionReasons: {
      missingAnchor: 0,
      syntheticNarration: 0,
      adviceTone: 0
    },
    byLayer: {
      A: { total: 0, adviceTone: 0, mechanicFirst: 0, failureConstraint: 0, explicitImplication: 0, inferredImplication: 0, procedural: 0 },
      B: { total: 0, adviceTone: 0, mechanicFirst: 0, failureConstraint: 0, explicitImplication: 0, inferredImplication: 0, procedural: 0 }
    }
  };
}

function updateGroundingDiagnostics(grounding, fact) {
  if (fact.layer === 'A' || fact.layer === 'B') {
    const layerKey = fact.layer === 'A' ? 'A' : 'B';
    grounding.byLayer[layerKey].total += 1;
    const groundingInfo = fact._grounding || {};
    if (groundingInfo.adviceTone) grounding.byLayer[layerKey].adviceTone += 1;
    if (groundingInfo.hasCondition && groundingInfo.hasEffect && groundingInfo.anchor) {
      grounding.byLayer[layerKey].mechanicFirst += 1;
    }
    if (groundingInfo.failureConstraint) grounding.byLayer[layerKey].failureConstraint += 1;
    if (groundingInfo.procedural) grounding.byLayer[layerKey].procedural += 1;
    if (groundingInfo.anchorScope === 'text') grounding.byLayer[layerKey].explicitImplication += 1;
    if (groundingInfo.anchorScope === 'local') grounding.byLayer[layerKey].inferredImplication += 1;
  }

  if (fact.layer !== 'A') return;

  grounding.total += 1;
  const roleTags = Array.isArray(fact.roleTags) ? fact.roleTags : [];
  const groundingInfo = fact._grounding || {};
  const mechanicShape = groundingInfo.mechanicShape || null;
  const hasStructure = mechanicShape
    && mechanicShape.hasCondition
    && mechanicShape.hasEffect
    && (mechanicShape.stateTransition
      || mechanicShape.downstreamImpact
      || mechanicShape.constraintChain
      || mechanicShape.failureConstraint);
  if (groundingInfo.anchor) grounding.anchorCoverage += 1;
  if (groundingInfo.anchorScope === 'text') grounding.anchorTextShare += 1;
  if (groundingInfo.anchorScope === 'local') grounding.anchorLocalShare += 1;
  if (groundingInfo.hasCondition && groundingInfo.hasEffect && groundingInfo.anchor) {
    grounding.mechanicFirstShare += 1;
  }
  if (groundingInfo.adviceTone) {
    grounding.adviceToneShare += 1;
    if (!groundingInfo.anchor) grounding.adviceToneUnanchoredShare += 1;
  }
  if (groundingInfo.procedural) grounding.proceduralShare += 1;
  if (groundingInfo.downstreamImpact) grounding.downstreamImpactShare += 1;
  if (groundingInfo.stateTransition) grounding.stateTransitionShare += 1;
  if (groundingInfo.constraintChain) grounding.constraintChainShare += 1;
  if (groundingInfo.downstreamImpact || groundingInfo.constraintChain) grounding.localPropagationShare += 1;
  if (groundingInfo.recoveredImplication) grounding.recoveredImplicationShare += 1;
  if (groundingInfo.transformed) grounding.transformedShare += 1;
  if (hasStructure) grounding.structureSignalShare += 1;
  if (groundingInfo.representation && grounding.representationShares[groundingInfo.representation] !== undefined) {
    grounding.representationShares[groundingInfo.representation] += 1;
  }
  if (groundingInfo.failureConstraint) grounding.failureConstraintShare += 1;
  if (roleTags.includes('gameplay_implication')) {
    grounding.implicationTotal += 1;
    if (groundingInfo.anchor) grounding.groundedImplicationShare += 1;
    if (!groundingInfo.anchor && groundingInfo.syntheticNarration) {
      grounding.syntheticNarrationShare += 1;
    }
    if (groundingInfo.anchorScope === 'text') {
      grounding.extractiveShare += 1;
      grounding.explicitImplicationShare += 1;
    } else if (groundingInfo.anchorScope === 'local') {
      grounding.localGroundedShare += 1;
      grounding.inferredImplicationShare += 1;
    }
    else grounding.syntheticShare += 1;
  }
  if (groundingInfo.demotionReason === 'missing-anchor') {
    grounding.demotionReasons.missingAnchor += 1;
  }
  if (groundingInfo.demotionReason === 'advice-tone') {
    grounding.demotionReasons.adviceTone += 1;
  }
  if (groundingInfo.syntheticNarration && !groundingInfo.anchor) {
    grounding.demotionReasons.syntheticNarration += 1;
  }
}

function finalizeGroundingDiagnostics(grounding) {
  if (grounding.total) {
    grounding.anchorCoverage = Number((grounding.anchorCoverage / grounding.total).toFixed(3));
    grounding.anchorTextShare = Number((grounding.anchorTextShare / grounding.total).toFixed(3));
    grounding.anchorLocalShare = Number((grounding.anchorLocalShare / grounding.total).toFixed(3));
    grounding.adviceToneShare = Number((grounding.adviceToneShare / grounding.total).toFixed(3));
    grounding.adviceToneUnanchoredShare = Number((grounding.adviceToneUnanchoredShare / grounding.total).toFixed(3));
    grounding.recommendationStyleShare = grounding.adviceToneShare;
    grounding.mechanicFirstShare = Number((grounding.mechanicFirstShare / grounding.total).toFixed(3));
    grounding.proceduralShare = Number((grounding.proceduralShare / grounding.total).toFixed(3));
    grounding.downstreamImpactShare = Number((grounding.downstreamImpactShare / grounding.total).toFixed(3));
    grounding.stateTransitionShare = Number((grounding.stateTransitionShare / grounding.total).toFixed(3));
    grounding.constraintChainShare = Number((grounding.constraintChainShare / grounding.total).toFixed(3));
    grounding.localPropagationShare = Number((grounding.localPropagationShare / grounding.total).toFixed(3));
    grounding.recoveredImplicationShare = Number((grounding.recoveredImplicationShare / grounding.total).toFixed(3));
    grounding.transformedShare = Number((grounding.transformedShare / grounding.total).toFixed(3));
    grounding.structureSignalShare = Number((grounding.structureSignalShare / grounding.total).toFixed(3));
    Object.keys(grounding.representationShares).forEach((key) => {
      grounding.representationShares[key] = Number((grounding.representationShares[key] / grounding.total).toFixed(3));
    });
    grounding.failureConstraintShare = Number((grounding.failureConstraintShare / grounding.total).toFixed(3));
    grounding.recommendationVsMechanicRatio = grounding.mechanicFirstShare
      ? Number((grounding.recommendationStyleShare / grounding.mechanicFirstShare).toFixed(3))
      : 0;
  }
  if (grounding.implicationTotal) {
    grounding.groundedImplicationShare = Number((grounding.groundedImplicationShare / grounding.implicationTotal).toFixed(3));
    grounding.syntheticNarrationShare = Number((grounding.syntheticNarrationShare / grounding.implicationTotal).toFixed(3));
    grounding.extractiveShare = Number((grounding.extractiveShare / grounding.implicationTotal).toFixed(3));
    grounding.localGroundedShare = Number((grounding.localGroundedShare / grounding.implicationTotal).toFixed(3));
    grounding.syntheticShare = Number((grounding.syntheticShare / grounding.implicationTotal).toFixed(3));
    grounding.explicitImplicationShare = Number((grounding.explicitImplicationShare / grounding.implicationTotal).toFixed(3));
    grounding.inferredImplicationShare = Number((grounding.inferredImplicationShare / grounding.implicationTotal).toFixed(3));
    grounding.implicationRecoveryRate = Number((grounding.recoveredImplicationShare / grounding.implicationTotal).toFixed(3));
  }
  ['A', 'B'].forEach((key) => {
    const entry = grounding.byLayer[key];
    if (!entry.total) return;
    entry.adviceTone = Number((entry.adviceTone / entry.total).toFixed(3));
    entry.mechanicFirst = Number((entry.mechanicFirst / entry.total).toFixed(3));
    entry.failureConstraint = Number((entry.failureConstraint / entry.total).toFixed(3));
    entry.explicitImplication = Number((entry.explicitImplication / entry.total).toFixed(3));
    entry.inferredImplication = Number((entry.inferredImplication / entry.total).toFixed(3));
    entry.procedural = Number((entry.procedural / entry.total).toFixed(3));
  });
}

module.exports = {
  initGroundingDiagnostics,
  updateGroundingDiagnostics,
  finalizeGroundingDiagnostics
};
