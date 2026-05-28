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

function avg(list, valueFn) {
  if (!list.length) return 0;
  const sum = list.reduce((acc, item) => acc + valueFn(item), 0);
  return Number((sum / list.length).toFixed(3));
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

function getContinuationDepth(item) {
  const metrics = getClosureMetrics(item);
  return Number.isFinite(metrics.propagationDepth) ? metrics.propagationDepth : 0;
}

function getContinuationFanout(item) {
  const metrics = getClosureMetrics(item);
  return Number.isFinite(metrics.continuationFanout) ? metrics.continuationFanout : 0;
}

function isTransitionBearing(item) {
  const runtime = getRuntimeStructure(item);
  const bounded = runtime.boundedContinuation || {};
  const types = Array.isArray(runtime.continuationType) ? runtime.continuationType : [];
  return !!bounded.transition || types.includes('operational-transition');
}

function graphRiskScore(item, model) {
  const depth = getContinuationDepth(item);
  const fanout = getContinuationFanout(item);
  const propagation = hasRuntimeFlag(item, 'propagationAware');
  let score = 0;
  if (depth >= 2) score += 0.4;
  if (fanout >= 2) score += 0.3;
  if (propagation) score += 0.2;
  if (model.propagationSensitivity >= 0.6) score += 0.1;
  return Math.min(1, Number(score.toFixed(3)));
}

function reasoningRiskScore(item, model) {
  let score = 0;
  if (model.continuationBurden >= 0.6) score += 0.4;
  if (model.propagationSensitivity >= 0.6) score += 0.3;
  if (getContinuationDepth(item) >= 3) score += 0.3;
  return Math.min(1, Number(score.toFixed(3)));
}

function classifyPreservationCategory(item, model) {
  const runtime = getRuntimeStructure(item);
  const transitionCritical = model.transitionCritical;
  const bounded = model.boundedOperationalClosure;
  const burdenHigh = model.continuationBurden >= 0.6;
  const propagationHigh = model.propagationSensitivity >= 0.6;
  const graphRisk = graphRiskScore(item, model) >= 0.6;

  if (transitionCritical && bounded && !propagationHigh && !burdenHigh && !graphRisk) {
    return 'safe-local-preservation';
  }
  if (transitionCritical && bounded) return 'bounded-transition-preservation';
  if (runtime.operationalFragment && !propagationHigh && !graphRisk) return 'operational-fragment-safe';
  if (propagationHigh) return 'propagation-risk';
  if (graphRisk) return 'graph-risk';
  return 'recursive-risk';
}

function buildBoundednessDiagnostics(list, modelMap) {
  return {
    continuationDepth: {
      zero: rate(list, (item) => getContinuationDepth(item) === 0),
      one: rate(list, (item) => getContinuationDepth(item) === 1),
      twoPlus: rate(list, (item) => getContinuationDepth(item) >= 2)
    },
    propagationTendency: rate(list, (item) => hasRuntimeFlag(item, 'propagationAware')),
    recursiveRiskTendency: rate(list, (item) => getContinuationDepth(item) >= 3),
    graphificationTendency: rate(list, (item) => graphRiskScore(item, modelMap.get(item.id)) >= 0.6)
  };
}

function buildCandidateSpace(list, modelMap) {
  return {
    boundedPreservable: rate(list, (item) => {
      const model = modelMap.get(item.id);
      return model.transitionCritical
        && model.boundedOperationalClosure
        && model.propagationSensitivity < 0.6
        && model.continuationBurden < 0.6;
    }),
    operationallyFragile: rate(list, (item) => {
      const model = modelMap.get(item.id);
      return model.continuationBurden >= 0.6 && !isRetained(item);
    }),
    propagationSensitive: rate(list, (item) => modelMap.get(item.id).propagationSensitivity >= 0.6),
    graphRisk: rate(list, (item) => graphRiskScore(item, modelMap.get(item.id)) >= 0.6),
    reasoningRisk: rate(list, (item) => reasoningRiskScore(item, modelMap.get(item.id)) >= 0.6)
  };
}

function buildContinuationBurdenAnalysis(list, modelMap) {
  return {
    localOneStep: rate(list, (item) => {
      const model = modelMap.get(item.id);
      return model.continuationBurden < 0.3 && getContinuationDepth(item) <= 1;
    }),
    chainedDependency: rate(list, (item) => {
      const model = modelMap.get(item.id);
      return model.continuationBurden >= 0.3 && model.continuationBurden < 0.6
        && getContinuationDepth(item) >= 1;
    }),
    routingPropagation: rate(list, (item) => hasRuntimeFlag(item, 'propagationAware') && modelMap.get(item.id).propagationSensitivity >= 0.6),
    interruptionPropagation: rate(list, (item) => {
      const classes = getRuntimeUtilityClass(item);
      return classes.includes('interruption-sensitive') && modelMap.get(item.id).propagationSensitivity >= 0.6;
    })
  };
}

function buildTaxonomy(list, modelMap) {
  const buckets = {};
  for (const item of list) {
    const model = modelMap.get(item.id);
    const category = classifyPreservationCategory(item, model);
    if (!buckets[category]) {
      buckets[category] = { items: [] };
    }
    buckets[category].items.push(item);
  }

  const result = {};
  for (const [category, bucket] of Object.entries(buckets)) {
    result[category] = {
      total: bucket.items.length,
      retained: bucket.items.filter(isRetained).length,
      dropped: bucket.items.filter((item) => !isRetained(item)).length,
      retainedRate: bucket.items.length
        ? Number((bucket.items.filter(isRetained).length / bucket.items.length).toFixed(3))
        : 0,
      droppedRate: bucket.items.length
        ? Number((bucket.items.filter((item) => !isRetained(item)).length / bucket.items.length).toFixed(3))
        : 0
    };
  }

  return result;
}

function buildFeasibilityMatrix(list, modelMap) {
  const categories = ['safe-local-preservation', 'bounded-transition-preservation', 'operational-fragment-safe', 'propagation-risk', 'graph-risk', 'recursive-risk'];
  const matrix = {};

  for (const category of categories) {
    const subset = list.filter((item) => classifyPreservationCategory(item, modelMap.get(item.id)) === category);
    const graphRiskRate = avg(subset, (item) => graphRiskScore(item, modelMap.get(item.id)));
    const reasoningRiskRate = avg(subset, (item) => reasoningRiskScore(item, modelMap.get(item.id)));
    const dropRate = subset.length
      ? Number((subset.filter((item) => !isRetained(item)).length / subset.length).toFixed(3))
      : 0;
    const boundednessConfidence = Number((1 - Math.max(graphRiskRate, reasoningRiskRate)).toFixed(3));

    matrix[category] = {
      total: subset.length,
      graphRisk: graphRiskRate,
      reasoningRisk: reasoningRiskRate,
      collapseReductionPotential: dropRate,
      boundednessConfidence
    };
  }

  return matrix;
}

function buildDiagnostics(trace) {
  const items = [
    ...((trace.seed && trace.seed.items) || []),
    ...((trace.pages || []).flatMap((page) => page.items || []))
  ];

  const kept = items.filter(isKept);
  const modelMap = new Map();
  for (const item of kept) {
    modelMap.set(item.id, getPreservationModel(item));
  }

  return {
    meta: {
      totals: {
        items: items.length,
        kept: kept.length,
        transitionBearing: kept.filter(isTransitionBearing).length
      }
    },
    preservationSafeCandidateSpace: buildCandidateSpace(kept, modelMap),
    continuationBurdenAnalysis: buildContinuationBurdenAnalysis(kept, modelMap),
    safePreservationTaxonomy: buildTaxonomy(kept, modelMap),
    boundednessDiagnostics: buildBoundednessDiagnostics(kept, modelMap),
    preservationFeasibilityMatrix: buildFeasibilityMatrix(kept, modelMap)
  };
}

function formatStat(label, stat) {
  return `- ${label}: ${stat.hits}/${stat.total} = ${stat.rate}`;
}

function formatCategoryStats(label, stats) {
  return [
    `**${label}**`,
    `- total: ${stats.total}`,
    `- retained: ${stats.retained}`,
    `- dropped: ${stats.dropped}`,
    `- retained rate: ${stats.retainedRate}`,
    `- dropped rate: ${stats.droppedRate}`
  ];
}

function formatSection(title, lines) {
  return [`## ${title}`, '', ...lines, ''].join('\n');
}

function buildMarkdown(diagnostics, inputPath) {
  const totals = diagnostics.meta.totals;
  const lines = [];
  lines.push('# Safe Bounded Preservation Design');
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
    '1) Preservation-Safe Candidate Space',
    [
      formatStat('bounded-preservable', diagnostics.preservationSafeCandidateSpace.boundedPreservable),
      '',
      formatStat('operationally-fragile', diagnostics.preservationSafeCandidateSpace.operationallyFragile),
      '',
      formatStat('propagation-sensitive', diagnostics.preservationSafeCandidateSpace.propagationSensitive),
      '',
      formatStat('graph-risk', diagnostics.preservationSafeCandidateSpace.graphRisk),
      '',
      formatStat('reasoning-risk', diagnostics.preservationSafeCandidateSpace.reasoningRisk)
    ]
  ));

  lines.push(formatSection(
    '2) Continuation Burden Analysis',
    [
      formatStat('local one-step continuation', diagnostics.continuationBurdenAnalysis.localOneStep),
      '',
      formatStat('chained operational dependency', diagnostics.continuationBurdenAnalysis.chainedDependency),
      '',
      formatStat('routing propagation', diagnostics.continuationBurdenAnalysis.routingPropagation),
      '',
      formatStat('interruption propagation', diagnostics.continuationBurdenAnalysis.interruptionPropagation)
    ]
  ));

  lines.push(formatSection(
    '3) Safe Preservation Taxonomy',
    [
      ...formatCategoryStats('safe-local-preservation', diagnostics.safePreservationTaxonomy['safe-local-preservation'] || {
        total: 0,
        retained: 0,
        dropped: 0,
        retainedRate: 0,
        droppedRate: 0
      }),
      '',
      ...formatCategoryStats('bounded-transition-preservation', diagnostics.safePreservationTaxonomy['bounded-transition-preservation'] || {
        total: 0,
        retained: 0,
        dropped: 0,
        retainedRate: 0,
        droppedRate: 0
      }),
      '',
      ...formatCategoryStats('operational-fragment-safe', diagnostics.safePreservationTaxonomy['operational-fragment-safe'] || {
        total: 0,
        retained: 0,
        dropped: 0,
        retainedRate: 0,
        droppedRate: 0
      }),
      '',
      ...formatCategoryStats('propagation-risk', diagnostics.safePreservationTaxonomy['propagation-risk'] || {
        total: 0,
        retained: 0,
        dropped: 0,
        retainedRate: 0,
        droppedRate: 0
      }),
      '',
      ...formatCategoryStats('graph-risk', diagnostics.safePreservationTaxonomy['graph-risk'] || {
        total: 0,
        retained: 0,
        dropped: 0,
        retainedRate: 0,
        droppedRate: 0
      }),
      '',
      ...formatCategoryStats('recursive-risk', diagnostics.safePreservationTaxonomy['recursive-risk'] || {
        total: 0,
        retained: 0,
        dropped: 0,
        retainedRate: 0,
        droppedRate: 0
      })
    ]
  ));

  lines.push(formatSection(
    '4) Boundedness Diagnostics',
    [
      '**continuation depth tendency**',
      formatStat('depth=0', diagnostics.boundednessDiagnostics.continuationDepth.zero),
      formatStat('depth=1', diagnostics.boundednessDiagnostics.continuationDepth.one),
      formatStat('depth>=2', diagnostics.boundednessDiagnostics.continuationDepth.twoPlus),
      '',
      formatStat('propagation tendency', diagnostics.boundednessDiagnostics.propagationTendency),
      formatStat('recursive-risk tendency', diagnostics.boundednessDiagnostics.recursiveRiskTendency),
      formatStat('graphification tendency', diagnostics.boundednessDiagnostics.graphificationTendency)
    ]
  ));

  const matrixLines = [];
  matrixLines.push('| category | total | graph-risk | reasoning-risk | collapse-reduction | boundedness |');
  matrixLines.push('| --- | --- | --- | --- | --- | --- |');
  for (const [category, stats] of Object.entries(diagnostics.preservationFeasibilityMatrix)) {
    matrixLines.push(`| ${category} | ${stats.total} | ${stats.graphRisk} | ${stats.reasoningRisk} | ${stats.collapseReductionPotential} | ${stats.boundednessConfidence} |`);
  }

  lines.push(formatSection(
    '5) Preservation Feasibility Matrix',
    matrixLines
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
  const jsonPath = path.join(baseDir, 'safe-bounded-preservation-design.json');
  const mdPath = path.join(baseDir, 'safe-bounded-preservation-design.md');

  writeJson(jsonPath, diagnostics);
  writeText(mdPath, buildMarkdown(diagnostics, inputPath));

  console.log(`Safe bounded preservation diagnostics saved to ${jsonPath}`);
  console.log(`Safe bounded preservation summary saved to ${mdPath}`);
}

main();
