function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toUnit(value) {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, 0, 1);
}

function biasToUnit(value) {
  if (!Number.isFinite(value)) return 0;
  return clamp((value + 1) / 2, 0, 1);
}

function classifyOperationalSelectivity(options) {
  const grounding = options.grounding || {};
  const repStats = options.representationStats || {};
  const utilityArchetype = normalizeArray(options.utilityArchetype);
  const operationalIdentity = normalizeArray(options.operationalIdentity);
  const runtimeUtilityClass = normalizeArray(options.runtimeUtilityClass);
  const runtimeStructure = options.runtimeStructure || {};
  const closureMetrics = options.closureMetrics || {};
  const preservationModel = options.preservationModel || {};
  const preservationInterpretation = options.preservationInterpretation || {};

  const compactness = Number.isFinite(repStats.coreDrivenCompactness)
    ? repStats.coreDrivenCompactness
    : (Number.isFinite(repStats.representationCompactness) ? repStats.representationCompactness : 0);

  const operationalStrength = clamp(
    (operationalIdentity.length > 0 ? 0.4 : 0)
      + (runtimeUtilityClass.length > 0 ? 0.3 : 0)
      + (runtimeStructure.operationalFragment ? 0.2 : 0)
      + (grounding.operationalContinuation ? 0.1 : 0),
    0,
    1
  );

  const continuityImportance = clamp(
    (utilityArchetype.includes('continuity-bearing') ? 0.4 : 0)
      + (runtimeStructure.continuationLinked ? 0.3 : 0)
      + (grounding.operationalContinuation ? 0.2 : 0)
      + (runtimeStructure.boundedContinuation && runtimeStructure.boundedContinuation.transition ? 0.1 : 0),
    0,
    1
  );

  const propagationBurden = toUnit(
    Number.isFinite(preservationModel.continuationBurden)
      ? preservationModel.continuationBurden
      : (Number.isFinite(closureMetrics.operationalClosureCost)
        ? closureMetrics.operationalClosureCost
        : 0)
  );

  const localClosureBias = biasToUnit(closureMetrics.localAnswerabilityBias);

  const standaloneDominanceRisk = clamp(
    (utilityArchetype.includes('standalone-mechanic') ? 0.4 : 0)
      + (compactness >= 0.6 ? 0.3 : 0)
      + (runtimeStructure.localClosureDominant ? 0.2 : 0)
      + (localClosureBias >= 0.6 ? 0.1 : 0),
    0,
    1
  );

  const runtimeOperationalValue = clamp(
    (runtimeUtilityClass.includes('routing-critical') ? 0.2 : 0)
      + (runtimeUtilityClass.includes('interruption-sensitive') ? 0.2 : 0)
      + (runtimeUtilityClass.includes('dependency-resolution') ? 0.2 : 0)
      + (runtimeUtilityClass.includes('recovery-significant') ? 0.15 : 0)
      + (runtimeUtilityClass.includes('downstream-impact') ? 0.15 : 0)
      + (runtimeUtilityClass.includes('state-transition') ? 0.1 : 0),
    0,
    1
  );

  const operationalNoiseRisk = clamp(
    (localClosureBias >= 0.6 ? 0.4 : 0)
      + (standaloneDominanceRisk >= 0.6 ? 0.3 : 0)
      + (continuityImportance < 0.4 ? 0.2 : 0)
      + (operationalStrength < 0.5 ? 0.1 : 0),
    0,
    1
  );

  const boundedOperationalConfidence = clamp(
    (preservationInterpretation.boundednessConfidence || 0) * 0.6
      + (runtimeStructure.boundedContinuation ? 0.2 : 0)
      + (propagationBurden < 0.6 ? 0.2 : 0),
    0,
    1
  );

  return {
    operationalStrength: Number(operationalStrength.toFixed(3)),
    continuityImportance: Number(continuityImportance.toFixed(3)),
    propagationBurden: Number(propagationBurden.toFixed(3)),
    localClosureBias: Number(localClosureBias.toFixed(3)),
    standaloneDominanceRisk: Number(standaloneDominanceRisk.toFixed(3)),
    runtimeOperationalValue: Number(runtimeOperationalValue.toFixed(3)),
    operationalNoiseRisk: Number(operationalNoiseRisk.toFixed(3)),
    boundedOperationalConfidence: Number(boundedOperationalConfidence.toFixed(3))
  };
}

module.exports = {
  classifyOperationalSelectivity
};
