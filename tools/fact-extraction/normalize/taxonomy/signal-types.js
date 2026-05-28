module.exports = {
  anchors: [
    'hasEntity',
    'hasCondition',
    'hasEffect',
    'anchor',
    'anchorScope',
    'anchorInText',
    'anchorInLocal'
  ],
  grounding: [
    'stateTransition',
    'downstreamImpact',
    'constraintChain',
    'failureConstraint',
    'causalChain',
    'multiStep',
    'continuationScope'
  ],
  representation: [
    'mechanicShape',
    'mechanicCore',
    'representation',
    'representationStats',
    'compressed',
    'compressionRatio'
  ],
  composition: [
    'compositionHints',
    'operationalContinuation'
  ],
  retention: [
    'noveltyScore',
    'obviousness',
    'priority',
    'systemicDepth',
    'depthSignals'
  ],
  canonical: [
    'systems',
    'mechanicFamilies',
    'keywordsNormalized',
    'coreKey',
    'coreText'
  ]
};
