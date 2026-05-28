const fs = require('fs');
const path = require('path');
const { classifyPreservationModel } = require('../../normalize/utility/preservation-model');

function parseArgs(argv) {
  const args = {};
  const list = Array.isArray(argv) ? argv : [];
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = list[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function writeText(filePath, content) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, content);
}

function rate(list, predicate) {
  const total = list.length;
  const hits = list.filter(predicate).length;
  const ratio = total ? Number((hits / total).toFixed(3)) : 0;
  return { hits, total, rate: ratio };
}

function getStage(item, key, fallback) {
  if (!item || !item.stages) return fallback;
  const value = item.stages[key];
  return value === undefined ? fallback : value;
}

function getGrounding(item) {
  return getStage(item, 'grounding', {});
}

function getComposition(item) {
  return getStage(item, 'composition', {});
}

function getRuntimeStructure(item) {
  return getStage(item, 'runtimeStructure', {});
}

function getUtilityArchetype(item) {
  const archetype = getStage(item, 'utilityArchetype', []);
  return Array.isArray(archetype) ? archetype : [];
}

function getRuntimeUtilityClass(item) {
  const classes = getStage(item, 'runtimeUtilityClass', []);
  return Array.isArray(classes) ? classes : [];
}

function getOperationalIdentity(item) {
  const identity = getStage(item, 'operationalIdentity', []);
  return Array.isArray(identity) ? identity : [];
}

function getClosureMetrics(item) {
  return getStage(item, 'closureMetrics', {});
}

function getPreservationModel(item) {
  const existing = getStage(item, 'preservationModel', null);
  if (existing) return existing;

  const grounding = getGrounding(item);
  const composition = getComposition(item);
  return classifyPreservationModel({
    grounding,
    representationStats: composition.representationStats || {},
    utilityArchetype: getUtilityArchetype(item),
    operationalIdentity: getOperationalIdentity(item),
    runtimeUtilityClass: getRuntimeUtilityClass(item),
    runtimeStructure: getRuntimeStructure(item),
    closureMetrics: getClosureMetrics(item)
  });
}

function isKept(item) {
  return item && item.status === 'kept';
}

function isRetained(item) {
  const retention = getStage(item, 'retention', null);
  return !!(retention && retention.retained);
}

function hasRuntimeFlag(item, flag) {
  const runtime = getRuntimeStructure(item);
  return !!runtime[flag];
}

function isTransitionBearing(item) {
  const runtime = getRuntimeStructure(item);
  const bounded = runtime.boundedContinuation || {};
  const types = Array.isArray(runtime.continuationType) ? runtime.continuationType : [];
  return !!bounded.transition || types.includes('operational-transition');
}

function compactnessValue(item) {
  const composition = getComposition(item);
  const stats = composition.representationStats || {};
  if (Number.isFinite(stats.coreDrivenCompactness)) return stats.coreDrivenCompactness;
  if (Number.isFinite(stats.representationCompactness)) return stats.representationCompactness;
  return null;
}

function isCompact(item) {
  const value = compactnessValue(item);
  return Number.isFinite(value) && value >= 0.6;
}

function buildBucketStats(list, valueFn, buckets) {
  const out = {};
  for (const bucket of buckets) {
    out[bucket.key] = rate(list, (item) => bucket.predicate(valueFn(item)));
  }
  return out;
}

function buildFlagStats(list, flagFn) {
  const flagged = list.filter(flagFn);
  const unflagged = list.filter((item) => !flagFn(item));
  return {
    flagged: rate(flagged, (item) => !isRetained(item)),
    unflagged: rate(unflagged, (item) => !isRetained(item))
  };
}

function buildCategoryStats(list, predicate) {
  const subset = list.filter(predicate);
  return {
    total: subset.length,
    retained: subset.filter(isRetained).length,
    dropped: subset.filter((item) => !isRetained(item)).length,
    retainedRate: subset.length ? Number((subset.filter(isRetained).length / subset.length).toFixed(3)) : 0,
    droppedRate: subset.length ? Number((subset.filter((item) => !isRetained(item)).length / subset.length).toFixed(3)) : 0
  };
}

function buildDiagnostics(trace) {
  const items = [
    ...((trace.seed && trace.seed.items) || []),
    ...((trace.pages || []).flatMap((page) => page.items || []))
  ];

  const kept = items.filter(isKept);
  const models = new Map();
  for (const item of kept) {
    models.set(item.id, getPreservationModel(item));
  }

  const transitionBearing = kept.filter(isTransitionBearing);

  const preservationCandidates = {
    transitionCritical: rate(kept, (item) => models.get(item.id).transitionCritical),
    continuationBurden: buildBucketStats(
      kept,
      (item) => models.get(item.id).continuationBurden,
      [
        { key: 'low', predicate: (value) => value < 0.3 },
        { key: 'mid', predicate: (value) => value >= 0.3 && value < 0.6 },
        { key: 'high', predicate: (value) => value >= 0.6 }
      ]
    ),
    boundedOperationalClosure: rate(kept, (item) => models.get(item.id).boundedOperationalClosure),
    standaloneCollapseRisk: buildBucketStats(
      kept,
      (item) => models.get(item.id).standaloneCollapseRisk,
      [
        { key: 'low', predicate: (value) => value < 0.3 },
        { key: 'mid', predicate: (value) => value >= 0.3 && value < 0.6 },
        { key: 'high', predicate: (value) => value >= 0.6 }
      ]
    ),
    propagationSensitivity: buildBucketStats(
      kept,
      (item) => models.get(item.id).propagationSensitivity,
      [
        { key: 'low', predicate: (value) => value < 0.3 },
        { key: 'mid', predicate: (value) => value >= 0.3 && value < 0.6 },
        { key: 'high', predicate: (value) => value >= 0.6 }
      ]
    )
  };

  const collapseRiskInteraction = {
    collapseRiskHigh: buildFlagStats(kept, (item) => models.get(item.id).standaloneCollapseRisk >= 0.6),
    compactnessHigh: buildFlagStats(kept, isCompact),
    standaloneDominance: buildFlagStats(kept, (item) => hasRuntimeFlag(item, 'localClosureDominant')),
    transitionBearing: buildFlagStats(kept, isTransitionBearing),
    propagationAware: buildFlagStats(kept, (item) => hasRuntimeFlag(item, 'propagationAware'))
  };

  const transitionBearingDropped = transitionBearing.filter((item) => !isRetained(item));
  const simulationCandidates = transitionBearing.filter((item) => {
    const model = models.get(item.id);
    return model.transitionCritical && model.standaloneCollapseRisk >= 0.6;
  });
  const simulationDropped = transitionBearingDropped.filter((item) => simulationCandidates.includes(item));

  const preservationSimulation = {
    transitionBearingTotal: transitionBearing.length,
    transitionBearingDropped: transitionBearingDropped.length,
    candidates: simulationCandidates.length,
    candidatesDropped: simulationDropped.length,
    candidateDropShare: transitionBearingDropped.length
      ? Number((simulationDropped.length / transitionBearingDropped.length).toFixed(3))
      : 0
  };

  const preservationTaxonomy = {
    boundedPreservable: buildCategoryStats(kept, (item) => {
      const model = models.get(item.id);
      return model.transitionCritical && model.boundedOperationalClosure && model.standaloneCollapseRisk < 0.6;
    }),
    standaloneCollapseProne: buildCategoryStats(kept, (item) => models.get(item.id).standaloneCollapseRisk >= 0.6),
    transitionCritical: buildCategoryStats(kept, (item) => models.get(item.id).transitionCritical),
    propagationSensitive: buildCategoryStats(kept, (item) => models.get(item.id).propagationSensitivity >= 0.6),
    operationallyFragile: buildCategoryStats(kept, (item) => {
      const model = models.get(item.id);
      return model.continuationBurden >= 0.6 && !isRetained(item);
    }),
    localClosureStable: buildCategoryStats(kept, (item) => hasRuntimeFlag(item, 'localClosureDominant') && isRetained(item))
  };

  const safeBoundary = buildCategoryStats(kept, (item) => {
    const model = models.get(item.id);
    return model.transitionCritical
      && model.boundedOperationalClosure
      && model.propagationSensitivity < 0.6
      && model.continuationBurden < 0.6;
  });

  return {
    meta: {
      totals: {
        items: items.length,
        kept: kept.length,
        transitionBearing: transitionBearing.length
      }
    },
    preservationCandidates,
    collapseRiskInteraction,
    preservationSimulation,
    preservationTaxonomy,
    safeStabilizationBoundary: safeBoundary
  };
}

function formatStat(label, stat) {
  return `- ${label}: ${stat.hits}/${stat.total} = ${stat.rate}`;
}

function formatBucketBlock(label, buckets) {
  return [
    `**${label}**`,
    formatStat('low', buckets.low),
    formatStat('mid', buckets.mid),
    formatStat('high', buckets.high)
  ];
}

function formatFlagBlock(label, block) {
  return [
    `**${label}**`,
    formatStat('collapse rate (flagged)', block.flagged),
    formatStat('collapse rate (unflagged)', block.unflagged)
  ];
}

function formatCategoryBlock(label, block) {
  return [
    `**${label}**`,
    `- total: ${block.total}`,
    `- retained: ${block.retained}`,
    `- dropped: ${block.dropped}`,
    `- retained rate: ${block.retainedRate}`,
    `- dropped rate: ${block.droppedRate}`
  ];
}

function formatSection(title, lines) {
  return [`## ${title}`, '', ...lines, ''].join('\n');
}

function buildMarkdown(diagnostics, inputPath) {
  const totals = diagnostics.meta.totals;
  const lines = [];
  lines.push('# Preservation Model Diagnostics');
  lines.push('');
  lines.push(`Input: ${inputPath}`);
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push(`- items: ${totals.items}`);
  lines.push(`- kept: ${totals.kept}`);
  lines.push(`- transition-bearing: ${totals.transitionBearing}`);
  lines.push('');

  lines.push(formatSection(
    '1) Preservation Candidate Modeling',
    [
      formatStat('transitionCritical', diagnostics.preservationCandidates.transitionCritical),
      '',
      ...formatBucketBlock('continuationBurden', diagnostics.preservationCandidates.continuationBurden),
      '',
      formatStat('boundedOperationalClosure', diagnostics.preservationCandidates.boundedOperationalClosure),
      '',
      ...formatBucketBlock('standaloneCollapseRisk', diagnostics.preservationCandidates.standaloneCollapseRisk),
      '',
      ...formatBucketBlock('propagationSensitivity', diagnostics.preservationCandidates.propagationSensitivity)
    ]
  ));

  lines.push(formatSection(
    '2) Collapse-Risk Interaction Analysis',
    [
      ...formatFlagBlock('collapseRiskHigh', diagnostics.collapseRiskInteraction.collapseRiskHigh),
      '',
      ...formatFlagBlock('compactnessHigh', diagnostics.collapseRiskInteraction.compactnessHigh),
      '',
      ...formatFlagBlock('standaloneDominance', diagnostics.collapseRiskInteraction.standaloneDominance),
      '',
      ...formatFlagBlock('transitionBearing', diagnostics.collapseRiskInteraction.transitionBearing),
      '',
      ...formatFlagBlock('propagationAware', diagnostics.collapseRiskInteraction.propagationAware)
    ]
  ));

  lines.push(formatSection(
    '3) Bounded Preservation Simulation',
    [
      `- transition-bearing total: ${diagnostics.preservationSimulation.transitionBearingTotal}`,
      `- transition-bearing dropped: ${diagnostics.preservationSimulation.transitionBearingDropped}`,
      `- candidates: ${diagnostics.preservationSimulation.candidates}`,
      `- candidates dropped: ${diagnostics.preservationSimulation.candidatesDropped}`,
      `- candidate drop share: ${diagnostics.preservationSimulation.candidateDropShare}`
    ]
  ));

  lines.push(formatSection(
    '4) Preservation Taxonomy',
    [
      ...formatCategoryBlock('bounded-preservable', diagnostics.preservationTaxonomy.boundedPreservable),
      '',
      ...formatCategoryBlock('standalone-collapse-prone', diagnostics.preservationTaxonomy.standaloneCollapseProne),
      '',
      ...formatCategoryBlock('transition-critical', diagnostics.preservationTaxonomy.transitionCritical),
      '',
      ...formatCategoryBlock('propagation-sensitive', diagnostics.preservationTaxonomy.propagationSensitive),
      '',
      ...formatCategoryBlock('operationally-fragile', diagnostics.preservationTaxonomy.operationallyFragile),
      '',
      ...formatCategoryBlock('local-closure-stable', diagnostics.preservationTaxonomy.localClosureStable)
    ]
  ));

  lines.push(formatSection(
    '5) Safe Stabilization Boundary Analysis',
    [
      `- total: ${diagnostics.safeStabilizationBoundary.total}`,
      `- retained: ${diagnostics.safeStabilizationBoundary.retained}`,
      `- dropped: ${diagnostics.safeStabilizationBoundary.dropped}`,
      `- retained rate: ${diagnostics.safeStabilizationBoundary.retainedRate}`,
      `- dropped rate: ${diagnostics.safeStabilizationBoundary.droppedRate}`
    ]
  ));

  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input;
  if (!inputPath) {
    console.error('Missing --input');
    process.exitCode = 1;
    return;
  }

  const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const diagnostics = buildDiagnostics(payload);

  const baseDir = args.out || path.dirname(inputPath);
  const jsonPath = path.join(baseDir, 'preservation-model-diagnostics.json');
  const mdPath = path.join(baseDir, 'preservation-model-diagnostics.md');

  writeJson(jsonPath, diagnostics);
  writeText(mdPath, buildMarkdown(diagnostics, inputPath));

  console.log(`Preservation model diagnostics saved to ${jsonPath}`);
  console.log(`Preservation model summary saved to ${mdPath}`);
}

main();
