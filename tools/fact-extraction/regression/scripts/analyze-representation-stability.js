const fs = require('fs');
const path = require('path');
const { writeStableJson, writeText, formatPercent } = require('./snapshot-utils');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function pick(obj, pathParts, fallback = 0) {
  let current = obj;
  for (const part of pathParts) {
    if (!current || typeof current !== 'object' || !(part in current)) return fallback;
    current = current[part];
  }
  return current;
}

function safeDiv(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

function toSet(values) {
  return new Set((values || []).filter(Boolean));
}

function jaccard(aSet, bSet) {
  if (!aSet.size && !bSet.size) return 1;
  let intersection = 0;
  aSet.forEach((value) => {
    if (bSet.has(value)) intersection += 1;
  });
  const union = aSet.size + bSet.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function normalizeValue(value) {
  return String(value || '').toLowerCase().trim();
}

function normalizedList(list) {
  return (list || []).map(normalizeValue).filter(Boolean);
}

function signatureFromFact(fact) {
  const core = fact.mechanicCore || {};
  if (core.coreKey) {
    return `coreKey:${core.coreKey}`;
  }
  const entities = normalizedList(core.entities);
  const flags = [
    core.hasCondition ? 'C1' : 'C0',
    core.hasEffect ? 'E1' : 'E0',
    core.stateTransition ? 'T1' : 'T0',
    core.constraint ? 'K1' : 'K0',
    core.downstream ? 'D1' : 'D0',
    core.structuralCore ? 'S1' : 'S0'
  ];
  return `entities:${entities.sort().join('|')}|${flags.join('')}`;
}

function entitySetFromFact(fact) {
  const core = fact.mechanicCore || {};
  const entities = normalizedList(core.entities);
  if (entities.length) return toSet(entities);
  return toSet(normalizedList(fact.keywordsNormalized || fact.keywords || []));
}

function listPageFiles(gameDir) {
  return fs.readdirSync(gameDir)
    .filter((entry) => entry.endsWith('.json'))
    .filter((entry) => !entry.startsWith('neighborhood-'))
    .filter((entry) => entry !== 'package')
    .filter((entry) => fs.statSync(path.join(gameDir, entry)).isFile());
}

function loadFactsByPage(gameDir) {
  const pages = listPageFiles(gameDir);
  const pageFacts = {};
  pages.forEach((file) => {
    const payload = readJson(path.join(gameDir, file));
    const pageKey = file.replace(/\.json$/i, '');
    const facts = Array.isArray(payload.facts) ? payload.facts : [];
    pageFacts[pageKey] = facts.map((fact, index) => ({
      ...fact,
      __page: pageKey,
      __index: index
    }));
  });
  return pageFacts;
}

function flattenFacts(pageFacts) {
  return Object.values(pageFacts).flat();
}

function buildSignatureIndex(facts) {
  const index = new Map();
  facts.forEach((fact) => {
    const signature = signatureFromFact(fact);
    if (!index.has(signature)) {
      index.set(signature, { signature, facts: [], entitySet: new Set() });
    }
    const entry = index.get(signature);
    entry.facts.push(fact);
    const entitySet = entitySetFromFact(fact);
    entitySet.forEach((value) => entry.entitySet.add(value));
  });
  return index;
}

function pickRepresentative(facts) {
  if (!facts.length) return null;
  return facts.slice().sort((a, b) => (b.retentionScoreA || 0) - (a.retentionScoreA || 0))[0];
}

function overlapScore(aList, bList) {
  return jaccard(toSet(normalizedList(aList)), toSet(normalizedList(bList)));
}

function representationScore(baselineFact, currentFact) {
  if (!baselineFact || !currentFact) return 0;
  const sameLayer = baselineFact.layer === currentFact.layer ? 1 : 0;
  const samePriority = baselineFact.priority === currentFact.priority ? 1 : 0;
  const familyOverlap = overlapScore(baselineFact.mechanicFamilies, currentFact.mechanicFamilies);
  const systemOverlap = overlapScore(baselineFact.systemsNormalized, currentFact.systemsNormalized);
  const roleOverlap = overlapScore(baselineFact.roleTags, currentFact.roleTags);
  return (sameLayer + samePriority + familyOverlap + systemOverlap + roleOverlap) / 5;
}

function shapeScore(baselineFact, currentFact) {
  if (!baselineFact || !currentFact) return 0;
  const a = baselineFact.mechanicCore || {};
  const b = currentFact.mechanicCore || {};
  const flags = [
    a.hasCondition === b.hasCondition,
    a.hasEffect === b.hasEffect,
    a.stateTransition === b.stateTransition,
    a.constraint === b.constraint,
    a.downstream === b.downstream,
    a.structuralCore === b.structuralCore,
    a.coverage === b.coverage
  ];
  const matched = flags.filter(Boolean).length;
  return matched / flags.length;
}

function flagMatchScore(aValue, bValue) {
  if (typeof aValue !== 'boolean' || typeof bValue !== 'boolean') return 0;
  return aValue === bValue ? 1 : 0;
}

function operationalRoleOverlap(aFact, bFact) {
  const roleOverlap = overlapScore(aFact.roleTags, bFact.roleTags);
  const systemOverlap = overlapScore(aFact.systemsNormalized, bFact.systemsNormalized);
  const familyOverlap = overlapScore(aFact.mechanicFamilies, bFact.mechanicFamilies);
  return (roleOverlap + systemOverlap + familyOverlap) / 3;
}

function roleTagsOverlap(aFact, bFact) {
  return overlapScore(aFact.roleTags, bFact.roleTags);
}

function systemsOverlapScore(aFact, bFact) {
  return overlapScore(aFact.systemsNormalized, bFact.systemsNormalized);
}

function familiesOverlapScore(aFact, bFact) {
  return overlapScore(aFact.mechanicFamilies, bFact.mechanicFamilies);
}

function consequenceAlignmentScore(aFact, bFact) {
  const a = aFact.mechanicCore || {};
  const b = bFact.mechanicCore || {};
  const matches = [
    flagMatchScore(a.hasEffect, b.hasEffect),
    flagMatchScore(a.downstream, b.downstream),
    flagMatchScore(a.constraint, b.constraint)
  ];
  return matches.reduce((sum, value) => sum + value, 0) / matches.length;
}

function equivalenceScore(baselineFact, currentFact) {
  if (!baselineFact || !currentFact) return { score: 0, parts: null };
  const entityOverlap = jaccard(entitySetFromFact(baselineFact), entitySetFromFact(currentFact));
  const shape = shapeScore(baselineFact, currentFact);
  const conditionEffect = (flagMatchScore(
    (baselineFact.mechanicCore || {}).hasCondition,
    (currentFact.mechanicCore || {}).hasCondition
  ) + flagMatchScore(
    (baselineFact.mechanicCore || {}).hasEffect,
    (currentFact.mechanicCore || {}).hasEffect
  )) / 2;
  const transitionEq = flagMatchScore(
    (baselineFact.mechanicCore || {}).stateTransition,
    (currentFact.mechanicCore || {}).stateTransition
  );
  const consequence = consequenceAlignmentScore(baselineFact, currentFact);
  const operational = operationalRoleOverlap(baselineFact, currentFact);
  const representation = representationScore(baselineFact, currentFact);

  const parts = {
    entityOverlap: Number(entityOverlap.toFixed(3)),
    shapePreservation: Number(shape.toFixed(3)),
    conditionEffectOverlap: Number(conditionEffect.toFixed(3)),
    transitionEquivalence: Number(transitionEq.toFixed(3)),
    consequenceAlignment: Number(consequence.toFixed(3)),
    operationalContinuitySimilarity: Number(operational.toFixed(3)),
    representationConsistency: Number(representation.toFixed(3))
  };

  const score = (
    parts.entityOverlap * 0.2
    + parts.shapePreservation * 0.2
    + parts.conditionEffectOverlap * 0.15
    + parts.transitionEquivalence * 0.1
    + parts.consequenceAlignment * 0.1
    + parts.operationalContinuitySimilarity * 0.15
    + parts.representationConsistency * 0.1
  );

  return { score: Number(score.toFixed(3)), parts };
}

function operationalContinuityScore(baselineFact, currentFact) {
  if (!baselineFact || !currentFact) return { score: 0, parts: null };
  const conditionEffect = (flagMatchScore(
    (baselineFact.mechanicCore || {}).hasCondition,
    (currentFact.mechanicCore || {}).hasCondition
  ) + flagMatchScore(
    (baselineFact.mechanicCore || {}).hasEffect,
    (currentFact.mechanicCore || {}).hasEffect
  )) / 2;
  const transitionEq = flagMatchScore(
    (baselineFact.mechanicCore || {}).stateTransition,
    (currentFact.mechanicCore || {}).stateTransition
  );
  const consequence = consequenceAlignmentScore(baselineFact, currentFact);
  const roleOverlap = roleTagsOverlap(baselineFact, currentFact);
  const systemOverlap = systemsOverlapScore(baselineFact, currentFact);
  const familyOverlap = familiesOverlapScore(baselineFact, currentFact);

  const score = (
    conditionEffect * 0.25
    + transitionEq * 0.2
    + consequence * 0.2
    + roleOverlap * 0.15
    + systemOverlap * 0.1
    + familyOverlap * 0.1
  );

  return {
    score: Number(score.toFixed(3)),
    parts: {
      conditionEffectOverlap: Number(conditionEffect.toFixed(3)),
      transitionEquivalence: Number(transitionEq.toFixed(3)),
      consequenceAlignment: Number(consequence.toFixed(3)),
      roleTagsPersistence: Number(roleOverlap.toFixed(3)),
      systemsContinuity: Number(systemOverlap.toFixed(3)),
      familiesContinuity: Number(familyOverlap.toFixed(3))
    }
  };
}

function summarizeMissingAdded(missingFacts, addedFacts, limit) {
  const summarize = (facts) => facts.slice(0, limit).map((fact) => ({
    page: fact.__page,
    text: fact.text || '',
    signature: signatureFromFact(fact),
    coreText: (fact.mechanicCore && fact.mechanicCore.coreText) || null
  }));
  return {
    missingSamples: summarize(missingFacts),
    addedSamples: summarize(addedFacts)
  };
}

function buildReplacementCandidates(missingIndex, addedIndex, limit) {
  const candidates = [];
  missingIndex.forEach((missingEntry) => {
    let best = null;
    addedIndex.forEach((addedEntry) => {
      const score = jaccard(missingEntry.entitySet, addedEntry.entitySet);
      if (!best || score > best.score) {
        best = { score, addedEntry };
      }
    });
    if (best && best.score >= 0.5) {
      const baselineFact = pickRepresentative(missingEntry.facts);
      const currentFact = pickRepresentative(best.addedEntry.facts);
      candidates.push({
        baselineSignature: missingEntry.signature,
        currentSignature: best.addedEntry.signature,
        entityJaccard: Number(best.score.toFixed(3)),
        baselineSample: baselineFact ? baselineFact.text : null,
        currentSample: currentFact ? currentFact.text : null
      });
    }
  });
  return candidates.sort((a, b) => b.entityJaccard - a.entityJaccard).slice(0, limit);
}

function buildEquivalencePairs(missingIndex, addedIndex, limit) {
  const pairs = [];
  missingIndex.forEach((missingEntry) => {
    const baselineFact = pickRepresentative(missingEntry.facts);
    let best = null;
    addedIndex.forEach((addedEntry) => {
      const currentFact = pickRepresentative(addedEntry.facts);
      const result = equivalenceScore(baselineFact, currentFact);
      if (!best || result.score > best.score) {
        const continuity = operationalContinuityScore(baselineFact, currentFact);
        best = { result, addedEntry, currentFact, continuity };
      }
    });
    if (best) {
      pairs.push({
        baselineSignature: missingEntry.signature,
        currentSignature: best.addedEntry.signature,
        score: best.result.score,
        breakdown: best.result.parts,
        operationalContinuityScore: best.continuity.score,
        operationalContinuityBreakdown: best.continuity.parts,
        baselineSample: baselineFact ? baselineFact.text : null,
        currentSample: best.currentFact ? best.currentFact.text : null
      });
    }
  });
  return pairs.sort((a, b) => b.score - a.score).slice(0, limit);
}

function classifyMechanicLoss(pair) {
  if (!pair || !pair.breakdown) return 'mechanic-loss';
  const parts = pair.breakdown;
  if (pair.score >= 0.75 && parts.entityOverlap >= 0.6 && parts.operationalContinuitySimilarity >= 0.6) {
    return 'preserved';
  }
  if (pair.score >= 0.6 && parts.shapePreservation >= 0.8 && parts.entityOverlap < 0.4) {
    return 'shape-transformed';
  }
  if (pair.score >= 0.45 && (parts.entityOverlap >= 0.3 || parts.operationalContinuitySimilarity >= 0.3)) {
    return 'partial-recovery';
  }
  if (pair.score >= 0.4 && parts.operationalContinuitySimilarity >= 0.4 && parts.representationConsistency < 0.6) {
    return 'semantic-drift';
  }
  if (pair.score >= 0.35 && parts.shapePreservation >= 0.7 && parts.entityOverlap < 0.2) {
    return 'synthetic-substitution';
  }
  return 'mechanic-loss';
}

function buildLossTaxonomy(equivalencePairs, limitPerCategory) {
  const taxonomy = {
    preserved: [],
    'shape-transformed': [],
    'partial-recovery': [],
    'semantic-drift': [],
    'synthetic-substitution': [],
    'mechanic-loss': []
  };
  equivalencePairs.forEach((pair) => {
    const category = classifyMechanicLoss(pair);
    taxonomy[category].push({
      score: pair.score,
      baselineSample: pair.baselineSample,
      currentSample: pair.currentSample,
      breakdown: pair.breakdown
    });
  });

  Object.keys(taxonomy).forEach((key) => {
    taxonomy[key] = taxonomy[key]
      .sort((a, b) => b.score - a.score)
      .slice(0, limitPerCategory);
  });

  const counts = Object.keys(taxonomy).reduce((acc, key) => {
    acc[key] = taxonomy[key].length;
    return acc;
  }, {});

  return { counts, samples: taxonomy };
}

function buildOperationalContinuityAnalysis(missingIndex, addedIndex, limit) {
  const pairs = [];
  missingIndex.forEach((missingEntry) => {
    const baselineFact = pickRepresentative(missingEntry.facts);
    let best = null;
    addedIndex.forEach((addedEntry) => {
      const currentFact = pickRepresentative(addedEntry.facts);
      const result = operationalContinuityScore(baselineFact, currentFact);
      if (!best || result.score > best.score) {
        best = { result, currentFact, addedEntry };
      }
    });
    if (best) {
      pairs.push({
        baselineSignature: missingEntry.signature,
        currentSignature: best.addedEntry.signature,
        score: best.result.score,
        breakdown: best.result.parts,
        baselineSample: baselineFact ? baselineFact.text : null,
        currentSample: best.currentFact ? best.currentFact.text : null
      });
    }
  });

  const scores = pairs.map((pair) => pair.score);
  const avgScore = safeDiv(scores.reduce((sum, value) => sum + value, 0), scores.length);
  const aboveHalf = pairs.filter((pair) => pair.score >= 0.5).length;
  const avgParts = {
    conditionEffectOverlap: 0,
    transitionEquivalence: 0,
    consequenceAlignment: 0,
    roleTagsPersistence: 0,
    systemsContinuity: 0,
    familiesContinuity: 0
  };
  pairs.forEach((pair) => {
    if (!pair.breakdown) return;
    Object.keys(avgParts).forEach((key) => {
      avgParts[key] += pair.breakdown[key] || 0;
    });
  });
  Object.keys(avgParts).forEach((key) => {
    avgParts[key] = Number(safeDiv(avgParts[key], pairs.length).toFixed(3));
  });

  return {
    summary: {
      averageScore: Number(avgScore.toFixed(3)),
      shareAboveHalf: safeDiv(aboveHalf, pairs.length),
      avgParts
    },
    pairs,
    topPairs: pairs.slice().sort((a, b) => b.score - a.score).slice(0, limit),
    bottomPairs: pairs.slice().sort((a, b) => a.score - b.score).slice(0, limit)
  };
}

function buildContinuityMatrix(equivalencePairs) {
  const bands = [
    { key: 'high', min: 0.7 },
    { key: 'mid', min: 0.4 },
    { key: 'low', min: 0 }
  ];
  const byCategory = {
    preserved: [],
    'shape-transformed': [],
    'partial-recovery': [],
    'semantic-drift': [],
    'synthetic-substitution': [],
    'mechanic-loss': []
  };

  equivalencePairs.forEach((pair) => {
    const category = classifyMechanicLoss(pair);
    byCategory[category].push(pair);
  });

  const matrix = {};
  Object.entries(byCategory).forEach(([category, pairs]) => {
    const counts = { total: pairs.length, high: 0, mid: 0, low: 0 };
    pairs.forEach((pair) => {
      const score = pair.operationalContinuityScore || 0;
      const band = bands.find((entry) => score >= entry.min);
      counts[band.key] += 1;
    });
    matrix[category] = counts;
  });

  return matrix;
}

function buildSummary(analysis) {
  const m = analysis.metrics;
  const lines = [];
  lines.push('# Representation Stability Summary');
  lines.push('');
  lines.push(`Baseline: ${analysis.meta.baselineDir}`);
  lines.push(`Current: ${analysis.meta.currentDir}`);
  lines.push(`Created: ${analysis.meta.createdAt}`);
  lines.push('');
  lines.push('## Key Metrics');
  lines.push(`- factReplacementRate: ${formatPercent(m.factReplacementRate)}`);
  lines.push(`- mechanicRecoverability: ${formatPercent(m.mechanicRecoverability)}`);
  lines.push(`- corePersistence: ${formatPercent(m.corePersistence)}`);
  lines.push(`- representationConsistency: ${formatPercent(m.representationConsistency)}`);
  lines.push(`- shapeStability: ${formatPercent(m.shapeStability)}`);
  lines.push(`- operationalContinuityPreservation: ${formatPercent(m.operationalContinuityPreservation.delta)}`);
  lines.push(`- coreCoverageShare: ${formatPercent(m.coreCoverageShare.delta)}`);
  lines.push('');
  lines.push('## Totals');
  lines.push(`- baselineFacts: ${analysis.totals.baselineFacts}`);
  lines.push(`- currentFacts: ${analysis.totals.currentFacts}`);
  lines.push(`- baselinePages: ${analysis.totals.baselinePages}`);
  lines.push(`- currentPages: ${analysis.totals.currentPages}`);
  lines.push('');
  lines.push('## Per-Page Fact Counts');
  Object.entries(analysis.perPage).forEach(([page, entry]) => {
    lines.push(`- ${page}: ${entry.baselineFacts} -> ${entry.currentFacts} (missing ${entry.missingFacts}, added ${entry.addedFacts})`);
  });
  lines.push('');
  lines.push('## Missing Mechanic Samples');
  if (!analysis.samples.missingSamples.length) {
    lines.push('- none');
  } else {
    analysis.samples.missingSamples.forEach((sample) => {
      lines.push(`- ${sample.page}: ${sample.text}`);
    });
  }
  lines.push('');
  lines.push('## Added Mechanic Samples');
  if (!analysis.samples.addedSamples.length) {
    lines.push('- none');
  } else {
    analysis.samples.addedSamples.forEach((sample) => {
      lines.push(`- ${sample.page}: ${sample.text}`);
    });
  }
  lines.push('');
  lines.push('## Replacement Candidates (Entity Jaccard >= 0.5)');
  if (!analysis.replacementCandidates.length) {
    lines.push('- none');
  } else {
    analysis.replacementCandidates.forEach((entry) => {
      lines.push(`- ${entry.entityJaccard}: ${entry.baselineSample} -> ${entry.currentSample}`);
    });
  }
  lines.push('');
  lines.push('## Mechanic Equivalence (Top Pairs)');
  if (!analysis.equivalencePairs.length) {
    lines.push('- none');
  } else {
    analysis.equivalencePairs.forEach((entry) => {
      lines.push(`- ${entry.score}: ${entry.baselineSample} -> ${entry.currentSample}`);
    });
  }
  lines.push('');
  lines.push('## Mechanic Loss Taxonomy');
  Object.entries(analysis.lossTaxonomy.counts).forEach(([key, count]) => {
    lines.push(`- ${key}: ${count}`);
  });
  lines.push('');
  Object.entries(analysis.lossTaxonomy.samples).forEach(([key, samples]) => {
    lines.push(`### ${key}`);
    if (!samples.length) {
      lines.push('- none');
      return;
    }
    samples.forEach((entry) => {
      lines.push(`- ${entry.score}: ${entry.baselineSample} -> ${entry.currentSample}`);
    });
  });
  lines.push('');
  lines.push('## Operational Continuity Equivalence');
  lines.push(`- averageScore: ${formatPercent(analysis.operationalContinuityEquivalence.summary.averageScore)}`);
  lines.push(`- shareAboveHalf: ${formatPercent(analysis.operationalContinuityEquivalence.summary.shareAboveHalf)}`);
  Object.entries(analysis.operationalContinuityEquivalence.summary.avgParts).forEach(([key, value]) => {
    lines.push(`- ${key}: ${formatPercent(value)}`);
  });
  lines.push('');
  lines.push('### Operational Continuity Top Pairs');
  if (!analysis.operationalContinuityEquivalence.topPairs.length) {
    lines.push('- none');
  } else {
    analysis.operationalContinuityEquivalence.topPairs.forEach((entry) => {
      lines.push(`- ${entry.score}: ${entry.baselineSample} -> ${entry.currentSample}`);
    });
  }
  lines.push('');
  lines.push('### Operational Continuity Bottom Pairs');
  if (!analysis.operationalContinuityEquivalence.bottomPairs.length) {
    lines.push('- none');
  } else {
    analysis.operationalContinuityEquivalence.bottomPairs.forEach((entry) => {
      lines.push(`- ${entry.score}: ${entry.baselineSample} -> ${entry.currentSample}`);
    });
  }
  lines.push('');
  lines.push('## Taxonomy x Operational Continuity Matrix');
  Object.entries(analysis.taxonomyContinuityMatrix).forEach(([category, counts]) => {
    lines.push(`- ${category}: total ${counts.total}, high ${counts.high}, mid ${counts.mid}, low ${counts.low}`);
  });
  lines.push('');
  return lines.join('\n');
}

function main() {
  const baselineDir = process.argv[2];
  const currentDir = process.argv[3];
  const label = process.argv[4] || 'baseline__current';

  if (!baselineDir || !currentDir) {
    // eslint-disable-next-line no-console
    console.error('Usage: node analyze-representation-stability.js <baselineGameDir> <currentGameDir> [label]');
    process.exit(1);
  }

  const baselinePageFacts = loadFactsByPage(baselineDir);
  const currentPageFacts = loadFactsByPage(currentDir);
  const baselineFacts = flattenFacts(baselinePageFacts);
  const currentFacts = flattenFacts(currentPageFacts);

  const baselineIndex = buildSignatureIndex(baselineFacts);
  const currentIndex = buildSignatureIndex(currentFacts);

  const baselineSignatures = new Set(baselineIndex.keys());
  const currentSignatures = new Set(currentIndex.keys());

  const missingFacts = baselineFacts.filter((fact) => !currentSignatures.has(signatureFromFact(fact)));
  const addedFacts = currentFacts.filter((fact) => !baselineSignatures.has(signatureFromFact(fact)));

  const matchedSignatures = [...baselineSignatures].filter((signature) => currentSignatures.has(signature));

  const representationScores = [];
  const shapeScores = [];
  matchedSignatures.forEach((signature) => {
    const baselineEntry = baselineIndex.get(signature);
    const currentEntry = currentIndex.get(signature);
    const baselineRep = pickRepresentative(baselineEntry.facts);
    const currentRep = pickRepresentative(currentEntry.facts);
    representationScores.push(representationScore(baselineRep, currentRep));
    shapeScores.push(shapeScore(baselineRep, currentRep));
  });

  const baselineCoreKeys = new Set(baselineFacts.map((fact) => fact.mechanicCore && fact.mechanicCore.coreKey).filter(Boolean));
  const currentCoreKeys = new Set(currentFacts.map((fact) => fact.mechanicCore && fact.mechanicCore.coreKey).filter(Boolean));
  let coreMatches = 0;
  baselineCoreKeys.forEach((key) => {
    if (currentCoreKeys.has(key)) coreMatches += 1;
  });

  const diagnosticsBaseline = readJson(path.join(baselineDir, 'package', 'diagnostics.json'));
  const diagnosticsCurrent = readJson(path.join(currentDir, 'package', 'diagnostics.json'));

  const baselineOperationalContinuity = pick(diagnosticsBaseline, ['quality', 'runtimeDiagnostics', 'operationalContinuityScore'], 0);
  const currentOperationalContinuity = pick(diagnosticsCurrent, ['quality', 'runtimeDiagnostics', 'operationalContinuityScore'], 0);
  const baselineCoreCoverage = pick(diagnosticsBaseline, ['quality', 'coreDiagnostics', 'coreCoverageShare'], 0);
  const currentCoreCoverage = pick(diagnosticsCurrent, ['quality', 'coreDiagnostics', 'coreCoverageShare'], 0);

  const baselineRetentionAvgA = safeDiv(
    baselineFacts.reduce((sum, fact) => sum + (fact.retentionScoreA || 0), 0),
    baselineFacts.length
  );
  const currentRetentionAvgA = safeDiv(
    currentFacts.reduce((sum, fact) => sum + (fact.retentionScoreA || 0), 0),
    currentFacts.length
  );

  const baselineRetentionAvgB = safeDiv(
    baselineFacts.reduce((sum, fact) => sum + (fact.retentionScoreB || 0), 0),
    baselineFacts.length
  );
  const currentRetentionAvgB = safeDiv(
    currentFacts.reduce((sum, fact) => sum + (fact.retentionScoreB || 0), 0),
    currentFacts.length
  );

  const perPage = {};
  Object.keys({ ...baselinePageFacts, ...currentPageFacts }).forEach((page) => {
    const baseFacts = baselinePageFacts[page] || [];
    const curFacts = currentPageFacts[page] || [];
    const baseSignatures = new Set(baseFacts.map(signatureFromFact));
    const curSignatures = new Set(curFacts.map(signatureFromFact));
    const missing = baseFacts.filter((fact) => !curSignatures.has(signatureFromFact(fact)));
    const added = curFacts.filter((fact) => !baseSignatures.has(signatureFromFact(fact)));
    perPage[page] = {
      baselineFacts: baseFacts.length,
      currentFacts: curFacts.length,
      missingFacts: missing.length,
      addedFacts: added.length
    };
  });

  const analysis = {
    meta: {
      baselineDir: path.resolve(baselineDir),
      currentDir: path.resolve(currentDir),
      label,
      createdAt: new Date().toISOString()
    },
    totals: {
      baselineFacts: baselineFacts.length,
      currentFacts: currentFacts.length,
      baselinePages: Object.keys(baselinePageFacts).length,
      currentPages: Object.keys(currentPageFacts).length
    },
    counts: {
      missingFacts: missingFacts.length,
      addedFacts: addedFacts.length,
      missingSignatures: [...baselineSignatures].filter((signature) => !currentSignatures.has(signature)).length,
      addedSignatures: [...currentSignatures].filter((signature) => !baselineSignatures.has(signature)).length
    },
    metrics: {
      factReplacementRate: safeDiv(missingFacts.length, baselineFacts.length),
      mechanicRecoverability: safeDiv(matchedSignatures.length, baselineSignatures.size),
      corePersistence: safeDiv(coreMatches, baselineCoreKeys.size),
      representationConsistency: safeDiv(representationScores.reduce((sum, value) => sum + value, 0), representationScores.length),
      shapeStability: safeDiv(shapeScores.reduce((sum, value) => sum + value, 0), shapeScores.length),
      operationalContinuityPreservation: {
        baseline: baselineOperationalContinuity,
        current: currentOperationalContinuity,
        delta: currentOperationalContinuity - baselineOperationalContinuity
      },
      coreCoverageShare: {
        baseline: baselineCoreCoverage,
        current: currentCoreCoverage,
        delta: currentCoreCoverage - baselineCoreCoverage
      },
      retentionConsistency: {
        averageRetentionScoreA: {
          baseline: baselineRetentionAvgA,
          current: currentRetentionAvgA,
          delta: currentRetentionAvgA - baselineRetentionAvgA
        },
        averageRetentionScoreB: {
          baseline: baselineRetentionAvgB,
          current: currentRetentionAvgB,
          delta: currentRetentionAvgB - baselineRetentionAvgB
        }
      },
      extractionVariance: {
        baselineFacts: baselineFacts.length,
        currentFacts: currentFacts.length,
        deltaFacts: currentFacts.length - baselineFacts.length
      }
    },
    perPage,
    samples: summarizeMissingAdded(missingFacts, addedFacts, 8),
    replacementCandidates: buildReplacementCandidates(
      new Map([...baselineIndex.entries()].filter(([signature]) => !currentSignatures.has(signature)).map(([, entry]) => [entry.signature, entry])),
      new Map([...currentIndex.entries()].filter(([signature]) => !baselineSignatures.has(signature)).map(([, entry]) => [entry.signature, entry])),
      8
    ),
    equivalencePairs: buildEquivalencePairs(
      new Map([...baselineIndex.entries()].filter(([signature]) => !currentSignatures.has(signature)).map(([, entry]) => [entry.signature, entry])),
      new Map([...currentIndex.entries()].filter(([signature]) => !baselineSignatures.has(signature)).map(([, entry]) => [entry.signature, entry])),
      8
    )
  };

  analysis.lossTaxonomy = buildLossTaxonomy(analysis.equivalencePairs, 5);
  analysis.operationalContinuityEquivalence = buildOperationalContinuityAnalysis(
    new Map([...baselineIndex.entries()].filter(([signature]) => !currentSignatures.has(signature)).map(([, entry]) => [entry.signature, entry])),
    new Map([...currentIndex.entries()].filter(([signature]) => !baselineSignatures.has(signature)).map(([, entry]) => [entry.signature, entry])),
    5
  );
  analysis.taxonomyContinuityMatrix = buildContinuityMatrix(analysis.equivalencePairs);

  const outputDir = path.join(__dirname, '..');
  const jsonPath = path.join(outputDir, 'analysis', `representation__${label}.json`);
  const summaryPath = path.join(outputDir, 'summaries', `representation__${label}.md`);

  writeStableJson(jsonPath, analysis);
  writeText(summaryPath, buildSummary(analysis));

  // eslint-disable-next-line no-console
  console.log(`Analysis saved: ${jsonPath}`);
  // eslint-disable-next-line no-console
  console.log(`Summary saved: ${summaryPath}`);
}

main();
