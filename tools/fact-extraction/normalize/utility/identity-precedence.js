function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function classifyIdentityPrecedence(options) {
  const archetype = Array.isArray(options.utilityArchetype) ? options.utilityArchetype : [];
  const operationalIdentity = Array.isArray(options.operationalIdentity) ? options.operationalIdentity : [];
  const representation = options.representation || '';
  const repStats = options.representationStats || {};
  const grounding = options.grounding || {};

  const standalonePresent = archetype.includes('standalone-mechanic');
  const operationalPresent = operationalIdentity.length > 0;

  const compactness = Number.isFinite(repStats.coreDrivenCompactness)
    ? repStats.coreDrivenCompactness
    : 0;

  let standaloneScore = standalonePresent ? 0.5 : 0;
  let operationalScore = operationalPresent ? 0.5 : 0;

  if (representation === 'synthetic') standaloneScore += 0.2;
  if (compactness >= 0.6) standaloneScore += 0.2;
  if (compactness >= 0.8) standaloneScore += 0.1;

  if (grounding.operationalContinuation) operationalScore += 0.2;
  if (grounding.stateTransition) operationalScore += 0.2;
  if (grounding.downstreamImpact || grounding.constraintChain || grounding.causalChain) {
    operationalScore += 0.1;
  }
  operationalScore += Math.min(0.2, operationalIdentity.length * 0.05);

  standaloneScore = clamp(standaloneScore, 0, 1);
  operationalScore = clamp(operationalScore, 0, 1);

  let primary = null;
  let secondary = null;
  if (standaloneScore === 0 && operationalScore === 0) {
    primary = null;
    secondary = null;
  } else if (standaloneScore >= operationalScore) {
    primary = standalonePresent ? 'standalone' : 'operational';
    secondary = operationalPresent ? 'operational' : null;
  } else {
    primary = operationalPresent ? 'operational' : 'standalone';
    secondary = standalonePresent ? 'standalone' : null;
  }

  const identityCompetition = {
    standaloneScore: Number(standaloneScore.toFixed(3)),
    operationalScore: Number(operationalScore.toFixed(3)),
    dominanceScore: Number((standaloneScore - operationalScore).toFixed(3))
  };

  return {
    primaryRepresentationIdentity: primary,
    secondaryRepresentationIdentity: secondary,
    identityDominanceScore: identityCompetition.dominanceScore,
    identityCompetition
  };
}

module.exports = {
  classifyIdentityPrecedence
};
