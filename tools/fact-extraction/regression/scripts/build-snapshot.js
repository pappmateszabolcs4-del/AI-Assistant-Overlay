const fs = require('fs');
const path = require('path');
const { writeStableJson, writeText, formatPercent } = require('./snapshot-utils');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function pick(obj, key, fallback = null) {
  if (!obj || typeof obj !== 'object') return fallback;
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : fallback;
}

function buildSnapshot(inputs) {
  const diagnostics = inputs.diagnostics;
  const totals = inputs.totals;
  const quality = diagnostics.quality || {};
  const canonicalization = diagnostics.canonicalization || {};

  const representation = {
    totalFacts: totals.facts,
    factsA: totals.factsA,
    factsB: totals.factsB,
    layerDistribution: {
      A: totals.factsA,
      B: totals.factsB
    },
    coreCoverageShare: pick(quality.coreDiagnostics, 'coreCoverageShare', 0),
    coreDrivenCompactShare: pick(quality.representationQuality, 'coreDrivenCompactShare', 0),
    fragmentationScore: pick(quality.runtimeDiagnostics, 'fragmentationScore', 0),
    retrievalPackability: pick(quality.runtimeDiagnostics, 'retrievalPackability', 0),
    representationDrift: pick(canonicalization, 'representationDriftBetweenMerged', 0)
  };

  const composition = {
    compositionCoverage: pick(quality.compositionDiagnostics, 'compositionCoverage', 0),
    localPropagationShare: pick(quality.grounding, 'localPropagationShare', 0),
    downstreamImpactShare: pick(quality.grounding, 'downstreamImpactShare', 0),
    operationalContinuityScore: pick(quality.runtimeDiagnostics, 'operationalContinuityScore', 0),
    compositionUtility: pick(quality.runtimeDiagnostics, 'compositionUtility', 0),
    constraintChainShare: pick(quality.grounding, 'constraintChainShare', 0)
  };

  const grounding = {
    anchorCoverage: pick(quality.grounding, 'anchorCoverage', 0),
    groundedImplicationShare: pick(quality.grounding, 'groundedImplicationShare', 0),
    syntheticNarrationShare: pick(quality.grounding, 'syntheticNarrationShare', 0),
    recommendationVsMechanicRatio: pick(quality.grounding, 'recommendationVsMechanicRatio', 0),
    proceduralShare: pick(quality.grounding, 'proceduralShare', 0)
  };

  const canonical = {
    semanticMergeRate: pick(canonicalization, 'semanticMergeRate', 0),
    coreMergeShare: pick(canonicalization, 'coreMergeShare', 0),
    coreGuardMergeShare: pick(canonicalization, 'coreGuardMergeShare', 0),
    avgCoreOverlap: pick(canonicalization, 'avgCoreOverlap', 0),
    wordingVsMechanicSimilarity: pick(canonicalization, 'wordingVsMechanicSimilarity', 0),
    lowSimilarityCoreMergeShare: pick(canonicalization, 'lowSimilarityCoreMergeShare', 0)
  };

  const runtime = {
    retrievalStitchingPressure: pick(quality.runtimeDiagnostics, 'retrievalStitchingPressure', 0),
    answerCompositionFriendliness: pick(quality.compositionDiagnostics, 'answerUtilityShare', 0),
    localContinuationRecoverability: pick(quality.compositionDiagnostics, 'continuationLocalShare', 0)
  };

  const safety = {
    propagationWithoutAnchor: pick(quality.compositionDiagnostics, 'propagationWithoutAnchor', 0),
    syntheticNarrationShare: pick(quality.grounding, 'syntheticNarrationShare', 0),
    compositionDriftRisk: pick(quality.compositionDiagnostics, 'compositionDrift', 0),
    compositionFalsePositiveRisk: pick(quality.compositionDiagnostics, 'compositionFalsePositiveRisk', 0)
  };

  return {
    meta: inputs.meta,
    totals,
    metrics: {
      representation,
      composition,
      grounding,
      canonical,
      runtime,
      safety
    }
  };
}

function buildSummary(snapshot) {
  const m = snapshot.metrics;
  return [
    `# Regression Snapshot: ${snapshot.meta.label}`,
    '',
    `Seed: ${snapshot.meta.seed}`,
    `Game: ${snapshot.meta.game}`,
    `Source: ${snapshot.meta.sourceType}`,
    `Created: ${snapshot.meta.createdAt}`,
    '',
    '## Totals',
    `- facts: ${snapshot.totals.facts}`,
    `- factsA: ${snapshot.totals.factsA}`,
    `- factsB: ${snapshot.totals.factsB}`,
    '',
    '## Representation',
    `- coreCoverageShare: ${formatPercent(m.representation.coreCoverageShare)}`,
    `- coreDrivenCompactShare: ${formatPercent(m.representation.coreDrivenCompactShare)}`,
    `- fragmentationScore: ${formatPercent(m.representation.fragmentationScore)}`,
    `- retrievalPackability: ${formatPercent(m.representation.retrievalPackability)}`,
    `- representationDrift: ${m.representation.representationDrift.toFixed(3)}`,
    '',
    '## Composition',
    `- compositionCoverage: ${formatPercent(m.composition.compositionCoverage)}`,
    `- localPropagationShare: ${formatPercent(m.composition.localPropagationShare)}`,
    `- downstreamImpactShare: ${formatPercent(m.composition.downstreamImpactShare)}`,
    `- operationalContinuityScore: ${formatPercent(m.composition.operationalContinuityScore)}`,
    `- compositionUtility: ${formatPercent(m.composition.compositionUtility)}`,
    `- constraintChainShare: ${formatPercent(m.composition.constraintChainShare)}`,
    '',
    '## Grounding',
    `- anchorCoverage: ${formatPercent(m.grounding.anchorCoverage)}`,
    `- groundedImplicationShare: ${formatPercent(m.grounding.groundedImplicationShare)}`,
    `- syntheticNarrationShare: ${formatPercent(m.grounding.syntheticNarrationShare)}`,
    `- recommendationVsMechanicRatio: ${m.grounding.recommendationVsMechanicRatio.toFixed(3)}`,
    `- proceduralShare: ${formatPercent(m.grounding.proceduralShare)}`,
    '',
    '## Canonicalization',
    `- semanticMergeRate: ${m.canonical.semanticMergeRate.toFixed(3)}`,
    `- coreMergeShare: ${m.canonical.coreMergeShare.toFixed(3)}`,
    `- coreGuardMergeShare: ${m.canonical.coreGuardMergeShare.toFixed(3)}`,
    `- avgCoreOverlap: ${m.canonical.avgCoreOverlap.toFixed(3)}`,
    `- wordingVsMechanicSimilarity: ${m.canonical.wordingVsMechanicSimilarity.toFixed(3)}`,
    `- lowSimilarityCoreMergeShare: ${m.canonical.lowSimilarityCoreMergeShare.toFixed(3)}`,
    '',
    '## Runtime',
    `- retrievalStitchingPressure: ${formatPercent(m.runtime.retrievalStitchingPressure)}`,
    `- answerCompositionFriendliness: ${formatPercent(m.runtime.answerCompositionFriendliness)}`,
    `- localContinuationRecoverability: ${formatPercent(m.runtime.localContinuationRecoverability)}`,
    '',
    '## Safety',
    `- propagationWithoutAnchor: ${formatPercent(m.safety.propagationWithoutAnchor)}`,
    `- syntheticNarrationShare: ${formatPercent(m.safety.syntheticNarrationShare)}`,
    `- compositionDriftRisk: ${formatPercent(m.safety.compositionDriftRisk)}`,
    `- compositionFalsePositiveRisk: ${formatPercent(m.safety.compositionFalsePositiveRisk)}`,
    ''
  ].join('\n');
}

function writeSnapshotFiles(snapshot, outputDir) {
  const snapshotPath = path.join(outputDir, 'snapshots', `${snapshot.meta.label}.json`);
  const summaryPath = path.join(outputDir, 'summaries', `${snapshot.meta.label}.md`);
  writeStableJson(snapshotPath, snapshot);
  writeText(summaryPath, buildSummary(snapshot));
  return { snapshotPath, summaryPath };
}

function loadInputs(paths) {
  const diagnostics = readJson(paths.diagnostics);
  const allFacts = readJson(paths.allFacts);
  return {
    diagnostics,
    totals: allFacts.totals || { facts: 0, factsA: 0, factsB: 0 }
  };
}

module.exports = {
  buildSnapshot,
  buildSummary,
  writeSnapshotFiles,
  loadInputs
};
