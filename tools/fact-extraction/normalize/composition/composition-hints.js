function buildCompositionHints(grounding, mechanicCore) {
  if (!grounding || !grounding.anchor) return null;
  if (!grounding.hasCondition || !grounding.hasEffect) return null;
  if (grounding.multiStep) return null;
  const continuationSignal = grounding.downstreamImpact
    || grounding.constraintChain
    || grounding.failureConstraint
    || grounding.stateTransition
    || grounding.causalChain;
  if (!continuationSignal) return null;
  const transition = grounding.stateTransition ? 'state-transition' : 'effect';
  let continuation = '';
  if (grounding.downstreamImpact) continuation = 'downstream';
  else if (grounding.constraintChain || grounding.causalChain) continuation = 'constraint-chain';
  else if (grounding.failureConstraint) continuation = 'failure-constraint';
  else if (grounding.stateTransition) continuation = 'state-transition';
  const coreKey = mechanicCore ? mechanicCore.coreKey : '';
  const entities = mechanicCore && Array.isArray(mechanicCore.entities)
    ? mechanicCore.entities.slice(0, 4)
    : [];
  const coreCoverage = mechanicCore && Number.isFinite(mechanicCore.coverage) ? mechanicCore.coverage : 0;
  const coreEntities = mechanicCore && Array.isArray(mechanicCore.entities) ? mechanicCore.entities.length : 0;
  const structuralCore = Boolean(mechanicCore && mechanicCore.structuralCore);
  const retrievalUtility = coreCoverage >= 3 || coreEntities >= 2;
  const answerUtility = structuralCore || (grounding.mechanicShape && grounding.mechanicShape.structuralCore);
  const operationalUtility = continuationSignal;
  return {
    condition: true,
    transition,
    continuation,
    entities,
    coreKey,
    oneStep: true,
    continuationScope: grounding.continuationScope || 'none',
    utility: {
      retrieval: retrievalUtility,
      answer: answerUtility,
      operational: operationalUtility
    }
  };
}

module.exports = {
  buildCompositionHints
};
