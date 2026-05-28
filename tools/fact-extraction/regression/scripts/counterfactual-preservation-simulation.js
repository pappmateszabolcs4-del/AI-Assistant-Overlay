const fs = require('fs');
const path = require('path');
const { classifyPreservationModel } = require('../../normalize/utility/preservation-model');
const { classifyPreservationInterpretation } = require('../../normalize/utility/preservation-interpretation');

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

function getInterpretation(item, model) {
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
    preservationModel: model
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

function isContinuityBearing(item) {
  return getUtilityArchetype(item).includes('continuity-bearing');
}

function isOperationallyFragile(item, model) {
  return model.continuationBurden >= 0.6 && !isRetained(item);
}

function isSafeInterpretation(interp) {
  return interp.interpretationMode !== 'graph-risk-boundary'
    && interp.graphRisk < 0.6
    && interp.boundednessConfidence >= 0.6;
}

function isInterpretationEligible(interp, model) {
  return isSafeInterpretation(interp)
    && model.transitionCritical
    && interp.transitionPreservationPotential >= 0.6
    && interp.operationalFragmentWeight >= 0.6;
}

function isNoisyPreservation(item, model, interp) {
  const runtime = getRuntimeStructure(item);
  return runtime.localClosureDominant
    && !model.transitionCritical
    && interp.operationalFragmentWeight < 0.5;
}

function buildCounterfactual(items) {
  const kept = items.filter(isKept);
  const counterfactual = kept.map((item) => {
    const model = getPreservationModel(item);
    const interp = getInterpretation(item, model);
    const baselineRetained = isRetained(item);
    const interpretationBoostEligible = isInterpretationEligible(interp, model);
    const simulatedRetained = baselineRetained || interpretationBoostEligible;
    const collapseAvoided = !baselineRetained && simulatedRetained;
    const boundednessPreserved = simulatedRetained && interp.graphRisk < 0.6;
    return {
      item,
      model,
      interp,
      counterfactual: {
        baselineRetained,
        interpretationBoostEligible,
        simulatedRetained,
        collapseAvoided,
        boundednessPreserved,
        graphRiskDelta: Number((interp.graphRisk - (baselineRetained ? interp.graphRisk : interp.graphRisk)).toFixed(3))
      }
    };
  });

  return counterfactual;
}

function buildTaxonomy(records) {
  const taxonomy = {
    safePreservationWin: [],
    boundedCollapseReduction: [],
    graphRiskEscalation: [],
    noisyPreservation: [],
    falseOperationalRetention: []
  };

  for (const record of records) {
    const { item, model, interp, counterfactual } = record;
    if (counterfactual.collapseAvoided && isSafeInterpretation(interp)) {
      taxonomy.safePreservationWin.push(record);
    }
    if (counterfactual.collapseAvoided && interp.boundednessConfidence >= 0.6) {
      taxonomy.boundedCollapseReduction.push(record);
    }
    if (interp.graphRisk >= 0.6) {
      taxonomy.graphRiskEscalation.push(record);
    }
    if (counterfactual.simulatedRetained && isNoisyPreservation(item, model, interp)) {
      taxonomy.noisyPreservation.push(record);
    }
    if (counterfactual.simulatedRetained && !model.transitionCritical && !model.boundedOperationalClosure) {
      taxonomy.falseOperationalRetention.push(record);
    }
  }

  return taxonomy;
}

function buildDiagnostics(trace) {
  const items = [
    ...((trace.seed && trace.seed.items) || []),
    ...((trace.pages || []).flatMap((page) => page.items || []))
  ];

  const kept = items.filter(isKept);
  const records = buildCounterfactual(items);

  const transitionRecords = records.filter((record) => isTransitionBearing(record.item));
  const operationallyFragile = records.filter((record) => isOperationallyFragile(record.item, record.model));
  const continuityBearing = records.filter((record) => isContinuityBearing(record.item));
  const safeBoundary = records.filter((record) => isSafeInterpretation(record.interp));

  const taxonomy = buildTaxonomy(records);

  return {
    meta: {
      totals: {
        items: items.length,
        kept: kept.length,
        transitionBearing: transitionRecords.length,
        operationallyFragile: operationallyFragile.length,
        continuityBearing: continuityBearing.length
      }
    },
    collapseReductionSimulation: {
      transitionCollapseDelta: {
        baselineDropped: transitionRecords.filter((record) => !record.counterfactual.baselineRetained).length,
        simulatedDropped: transitionRecords.filter((record) => !record.counterfactual.simulatedRetained).length
      },
      operationallyFragileSurvivabilityDelta: {
        baselineRetained: operationallyFragile.filter((record) => record.counterfactual.baselineRetained).length,
        simulatedRetained: operationallyFragile.filter((record) => record.counterfactual.simulatedRetained).length
      },
      continuityBearingRetentionDelta: {
        baselineRetained: continuityBearing.filter((record) => record.counterfactual.baselineRetained).length,
        simulatedRetained: continuityBearing.filter((record) => record.counterfactual.simulatedRetained).length
      }
    },
    boundednessPreservation: {
      boundednessPreserved: rate(records, (record) => record.counterfactual.boundednessPreserved),
      graphRiskAverageBaseline: avg(records, (record) => record.interp.graphRisk),
      graphRiskAverageSimulated: avg(records, (record) => record.interp.graphRisk)
    },
    safeInterpretationEffectiveness: {
      safeBoundaryTotal: safeBoundary.length,
      collapseAvoided: safeBoundary.filter((record) => record.counterfactual.collapseAvoided).length,
      boundednessPreserved: safeBoundary.filter((record) => record.counterfactual.boundednessPreserved).length,
      avgGraphRisk: avg(safeBoundary, (record) => record.interp.graphRisk)
    },
    falseStabilization: {
      noisyPreservation: taxonomy.noisyPreservation.length,
      falseOperationalRetention: taxonomy.falseOperationalRetention.length
    },
    counterfactualTaxonomy: {
      safePreservationWin: taxonomy.safePreservationWin.length,
      boundedCollapseReduction: taxonomy.boundedCollapseReduction.length,
      graphRiskEscalation: taxonomy.graphRiskEscalation.length,
      noisyPreservation: taxonomy.noisyPreservation.length,
      falseOperationalRetention: taxonomy.falseOperationalRetention.length
    }
  };
}

function formatSection(title, lines) {
  return [`## ${title}`, '', ...lines, ''].join('\n');
}

function buildMarkdown(diagnostics, inputPath) {
  const totals = diagnostics.meta.totals;
  const lines = [];
  lines.push('# Counterfactual Preservation Simulation');
  lines.push('');
  lines.push(`Input: ${inputPath}`);
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push(`- items: ${totals.items}`);
  lines.push(`- kept: ${totals.kept}`);
  lines.push(`- transition-bearing: ${totals.transitionBearing}`);
  lines.push(`- operationally-fragile: ${totals.operationallyFragile}`);
  lines.push(`- continuity-bearing: ${totals.continuityBearing}`);
  lines.push('');

  const collapse = diagnostics.collapseReductionSimulation;
  lines.push(formatSection(
    '1) Collapse Reduction Simulation',
    [
      `- transition dropped baseline: ${collapse.transitionCollapseDelta.baselineDropped}`,
      `- transition dropped simulated: ${collapse.transitionCollapseDelta.simulatedDropped}`,
      `- operationally-fragile retained baseline: ${collapse.operationallyFragileSurvivabilityDelta.baselineRetained}`,
      `- operationally-fragile retained simulated: ${collapse.operationallyFragileSurvivabilityDelta.simulatedRetained}`,
      `- continuity-bearing retained baseline: ${collapse.continuityBearingRetentionDelta.baselineRetained}`,
      `- continuity-bearing retained simulated: ${collapse.continuityBearingRetentionDelta.simulatedRetained}`
    ]
  ));

  const bounded = diagnostics.boundednessPreservation;
  lines.push(formatSection(
    '2) Boundedness Preservation',
    [
      `- boundedness preserved: ${bounded.boundednessPreserved.hits}/${bounded.boundednessPreserved.total} = ${bounded.boundednessPreserved.rate}`,
      `- graph risk average baseline: ${bounded.graphRiskAverageBaseline}`,
      `- graph risk average simulated: ${bounded.graphRiskAverageSimulated}`
    ]
  ));

  const safe = diagnostics.safeInterpretationEffectiveness;
  lines.push(formatSection(
    '3) Safe Interpretation Effectiveness',
    [
      `- safe boundary total: ${safe.safeBoundaryTotal}`,
      `- collapse avoided: ${safe.collapseAvoided}`,
      `- boundedness preserved: ${safe.boundednessPreserved}`,
      `- avg graph risk: ${safe.avgGraphRisk}`
    ]
  ));

  const falseStab = diagnostics.falseStabilization;
  lines.push(formatSection(
    '4) False Stabilization Analysis',
    [
      `- noisy preservation: ${falseStab.noisyPreservation}`,
      `- false operational retention: ${falseStab.falseOperationalRetention}`
    ]
  ));

  const taxonomy = diagnostics.counterfactualTaxonomy;
  lines.push(formatSection(
    '5) Counterfactual Taxonomy',
    [
      `- safe-preservation-win: ${taxonomy.safePreservationWin}`,
      `- bounded-collapse-reduction: ${taxonomy.boundedCollapseReduction}`,
      `- graph-risk-escalation: ${taxonomy.graphRiskEscalation}`,
      `- noisy-preservation: ${taxonomy.noisyPreservation}`,
      `- false-operational-retention: ${taxonomy.falseOperationalRetention}`
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
  const jsonPath = path.join(baseDir, 'counterfactual-preservation-simulation.json');
  const mdPath = path.join(baseDir, 'counterfactual-preservation-simulation.md');

  writeJson(jsonPath, diagnostics);
  writeText(mdPath, buildMarkdown(diagnostics, inputPath));

  console.log(`Counterfactual simulation saved to ${jsonPath}`);
  console.log(`Counterfactual summary saved to ${mdPath}`);
}

main();
