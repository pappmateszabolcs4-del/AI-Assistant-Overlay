const fs = require('fs');
const path = require('path');
const { classifyPreservationInterpretation } = require('../../normalize/utility/preservation-interpretation');
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

function getInterpretation(item) {
  const existing = getStage(item, 'preservationInterpretation', null);
  if (existing) return existing;

  const grounding = getGrounding(item);
  const composition = getComposition(item);
  return classifyPreservationInterpretation({
    grounding,
    representationStats: composition.representationStats || {},
    utilityArchetype: getUtilityArchetype(item),
    operationalIdentity: getOperationalIdentity(item),
    runtimeUtilityClass: getRuntimeUtilityClass(item),
    runtimeStructure: getRuntimeStructure(item),
    closureMetrics: getClosureMetrics(item),
    preservationModel: getPreservationModel(item)
  });
}

function isKept(item) {
  return item && item.status === 'kept';
}

function isRetained(item) {
  const retention = getStage(item, 'retention', null);
  return !!(retention && retention.retained);
}

function isTransitionBearing(item) {
  const runtime = getRuntimeStructure(item);
  const bounded = runtime.boundedContinuation || {};
  const types = Array.isArray(runtime.continuationType) ? runtime.continuationType : [];
  return !!bounded.transition || types.includes('operational-transition');
}

function isOperationallyFragile(item, model) {
  return model.continuationBurden >= 0.6 && !isRetained(item);
}

function isBoundedPreservable(item, model) {
  return model.transitionCritical
    && model.boundedOperationalClosure
    && model.continuationBurden < 0.6
    && model.propagationSensitivity < 0.6;
}

function buildInteractionBlock(list, label, predicate, valueFn) {
  const subset = list.filter(predicate);
  return {
    label,
    total: subset.length,
    retainedRate: subset.length ? Number((subset.filter(isRetained).length / subset.length).toFixed(3)) : 0,
    avgStandaloneDominance: avg(subset, (item) => valueFn(item).standaloneDominance),
    avgOperationalFragmentWeight: avg(subset, (item) => valueFn(item).operationalFragmentWeight),
    avgTransitionPotential: avg(subset, (item) => valueFn(item).transitionPreservationPotential),
    avgBoundedness: avg(subset, (item) => valueFn(item).boundednessConfidence),
    avgGraphRisk: avg(subset, (item) => valueFn(item).graphRisk)
  };
}

function buildDiagnostics(trace) {
  const items = [
    ...((trace.seed && trace.seed.items) || []),
    ...((trace.pages || []).flatMap((page) => page.items || []))
  ];

  const kept = items.filter(isKept);
  const interpretationMap = new Map();
  const modelMap = new Map();
  for (const item of kept) {
    const model = getPreservationModel(item);
    modelMap.set(item.id, model);
    interpretationMap.set(item.id, getInterpretation(item));
  }

  const transitionCritical = kept.filter((item) => modelMap.get(item.id).transitionCritical);
  const operationallyFragile = kept.filter((item) => isOperationallyFragile(item, modelMap.get(item.id)));
  const boundedPreservable = kept.filter((item) => isBoundedPreservable(item, modelMap.get(item.id)));

  const interpretationModes = {};
  for (const item of kept) {
    const mode = interpretationMap.get(item.id).interpretationMode;
    interpretationModes[mode] = (interpretationModes[mode] || 0) + 1;
  }

  const interpretationInteraction = [
    buildInteractionBlock(kept, 'transition-critical', (item) => modelMap.get(item.id).transitionCritical, (item) => interpretationMap.get(item.id)),
    buildInteractionBlock(kept, 'operationally-fragile', (item) => isOperationallyFragile(item, modelMap.get(item.id)), (item) => interpretationMap.get(item.id)),
    buildInteractionBlock(kept, 'bounded-preservable', (item) => isBoundedPreservable(item, modelMap.get(item.id)), (item) => interpretationMap.get(item.id)),
    buildInteractionBlock(kept, 'transition-bearing', isTransitionBearing, (item) => interpretationMap.get(item.id))
  ];

  const potentialDiagnostics = {
    transitionPreservationPotential: {
      high: rate(kept, (item) => interpretationMap.get(item.id).transitionPreservationPotential >= 0.6),
      low: rate(kept, (item) => interpretationMap.get(item.id).transitionPreservationPotential < 0.3)
    },
    operationalFragmentPotential: {
      high: rate(kept, (item) => interpretationMap.get(item.id).operationalFragmentWeight >= 0.6),
      low: rate(kept, (item) => interpretationMap.get(item.id).operationalFragmentWeight < 0.3)
    },
    boundednessPotential: {
      high: rate(kept, (item) => interpretationMap.get(item.id).boundednessConfidence >= 0.6),
      low: rate(kept, (item) => interpretationMap.get(item.id).boundednessConfidence < 0.4)
    }
  };

  const safeBoundary = kept.filter((item) => {
    const interp = interpretationMap.get(item.id);
    return interp.interpretationMode !== 'graph-risk-boundary'
      && interp.graphRisk < 0.6
      && interp.boundednessConfidence >= 0.6;
  });

  return {
    meta: {
      totals: {
        items: items.length,
        kept: kept.length,
        transitionBearing: kept.filter(isTransitionBearing).length,
        transitionCritical: transitionCritical.length,
        operationallyFragile: operationallyFragile.length,
        boundedPreservable: boundedPreservable.length
      }
    },
    interpretationModes,
    interpretationInteraction,
    potentialDiagnostics,
    safeInterpretationBoundary: {
      total: safeBoundary.length,
      retained: safeBoundary.filter(isRetained).length,
      dropped: safeBoundary.filter((item) => !isRetained(item)).length,
      retainedRate: safeBoundary.length
        ? Number((safeBoundary.filter(isRetained).length / safeBoundary.length).toFixed(3))
        : 0,
      droppedRate: safeBoundary.length
        ? Number((safeBoundary.filter((item) => !isRetained(item)).length / safeBoundary.length).toFixed(3))
        : 0
    }
  };
}

function formatStat(label, stat) {
  return `- ${label}: ${stat.hits}/${stat.total} = ${stat.rate}`;
}

function formatSection(title, lines) {
  return [`## ${title}`, '', ...lines, ''].join('\n');
}

function buildMarkdown(diagnostics, inputPath) {
  const totals = diagnostics.meta.totals;
  const lines = [];
  lines.push('# Preservation Interpretation Diagnostics');
  lines.push('');
  lines.push(`Input: ${inputPath}`);
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push(`- items: ${totals.items}`);
  lines.push(`- kept: ${totals.kept}`);
  lines.push(`- transition-bearing: ${totals.transitionBearing}`);
  lines.push(`- transition-critical: ${totals.transitionCritical}`);
  lines.push(`- operationally-fragile: ${totals.operationallyFragile}`);
  lines.push(`- bounded-preservable: ${totals.boundedPreservable}`);
  lines.push('');

  const modeLines = Object.entries(diagnostics.interpretationModes)
    .map(([mode, count]) => `- ${mode}: ${count}`);
  lines.push(formatSection('1) Interpretation Mode Distribution', modeLines));

  const interactionLines = [];
  for (const entry of diagnostics.interpretationInteraction) {
    interactionLines.push(`**${entry.label}**`);
    interactionLines.push(`- total: ${entry.total}`);
    interactionLines.push(`- retained rate: ${entry.retainedRate}`);
    interactionLines.push(`- avg standalone dominance: ${entry.avgStandaloneDominance}`);
    interactionLines.push(`- avg operational fragment weight: ${entry.avgOperationalFragmentWeight}`);
    interactionLines.push(`- avg transition potential: ${entry.avgTransitionPotential}`);
    interactionLines.push(`- avg boundedness: ${entry.avgBoundedness}`);
    interactionLines.push(`- avg graph risk: ${entry.avgGraphRisk}`);
    interactionLines.push('');
  }
  lines.push(formatSection('2) Interpretation Interaction Analysis', interactionLines));

  lines.push(formatSection(
    '3) Preservation Potential Diagnostics',
    [
      '**transition preservation potential**',
      formatStat('high', diagnostics.potentialDiagnostics.transitionPreservationPotential.high),
      formatStat('low', diagnostics.potentialDiagnostics.transitionPreservationPotential.low),
      '',
      '**operational fragment survivability potential**',
      formatStat('high', diagnostics.potentialDiagnostics.operationalFragmentPotential.high),
      formatStat('low', diagnostics.potentialDiagnostics.operationalFragmentPotential.low),
      '',
      '**bounded continuation stability potential**',
      formatStat('high', diagnostics.potentialDiagnostics.boundednessPotential.high),
      formatStat('low', diagnostics.potentialDiagnostics.boundednessPotential.low)
    ]
  ));

  lines.push(formatSection(
    '4) Safe Interpretation Boundary',
    [
      `- total: ${diagnostics.safeInterpretationBoundary.total}`,
      `- retained: ${diagnostics.safeInterpretationBoundary.retained}`,
      `- dropped: ${diagnostics.safeInterpretationBoundary.dropped}`,
      `- retained rate: ${diagnostics.safeInterpretationBoundary.retainedRate}`,
      `- dropped rate: ${diagnostics.safeInterpretationBoundary.droppedRate}`
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
  const jsonPath = path.join(baseDir, 'preservation-interpretation-diagnostics.json');
  const mdPath = path.join(baseDir, 'preservation-interpretation-diagnostics.md');

  writeJson(jsonPath, diagnostics);
  writeText(mdPath, buildMarkdown(diagnostics, inputPath));

  console.log(`Preservation interpretation diagnostics saved to ${jsonPath}`);
  console.log(`Preservation interpretation summary saved to ${mdPath}`);
}

main();
