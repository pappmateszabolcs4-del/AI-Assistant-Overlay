const { UTILITY_PATTERNS } = require('./patterns');

function matchPatterns(patterns, text) {
  let hits = 0;
  const evidence = [];
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      hits += 1;
      if (evidence.length < 3) evidence.push(pattern.source);
    }
  }
  return { hits, evidence };
}

function buildSignal(name, patterns, text) {
  const { hits, evidence } = matchPatterns(patterns, text);
  if (!hits) {
    return {
      detected: false,
      confidence: 0,
      evidence: [],
      patternFamily: name
    };
  }
  const confidence = Math.min(0.95, 0.5 + hits * 0.1);
  return {
    detected: true,
    confidence: Number(confidence.toFixed(2)),
    evidence,
    patternFamily: name
  };
}

function detectUtilitySignals(textLower) {
  const text = String(textLower || '');
  return {
    continuityBearing: buildSignal('continuityBearing', UTILITY_PATTERNS.continuityBearing, text),
    operationalDependency: buildSignal('operationalDependency', UTILITY_PATTERNS.operationalDependency, text),
    routingSignificance: buildSignal('routingSignificance', UTILITY_PATTERNS.routingSignificance, text),
    recoverySignificance: buildSignal('recoverySignificance', UTILITY_PATTERNS.recoverySignificance, text),
    interruptionSensitive: buildSignal('interruptionSensitive', UTILITY_PATTERNS.interruptionSensitive, text),
    downstreamOperationalEffect: buildSignal('downstreamOperationalEffect', UTILITY_PATTERNS.downstreamOperationalEffect, text)
  };
}

module.exports = {
  detectUtilitySignals
};
