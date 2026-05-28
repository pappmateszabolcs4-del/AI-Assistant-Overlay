const fs = require('fs');
const path = require('path');
const { classifyOperationalSelectivity } = require('../../normalize/utility/operational-selectivity');
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

function getPreservationInterpretation(item, model) {
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

function getSelectivity(item, model, interpretation) {
  const existing = getStage(item, 'operationalSelectivity', null);
  if (existing) return existing;

  const grounding = getGrounding(item);
  const composition = getComposition(item);
  return classifyOperationalSelectivity({
    grounding,
    representationStats: composition.representationStats || {},
    utilityArchetype: getUtilityArchetype(item),
    operationalIdentity: getOperationalIdentity(item),
    runtimeUtilityClass: getRuntimeUtilityClass(item),
    runtimeStructure: getRuntimeStructure(item),
    closureMetrics: getClosureMetrics(item),
    preservationModel: model,
    preservationInterpretation: interpretation
  });
}

function isKept(item) {
  return item && item.status === 'kept';
}

function isRetained(item) {
  const retention = getStage(item, 'retention', null);
  return !!(retention && retention.retained);
}

function isContinuityBearing(item) {
  return getUtilityArchetype(item).includes('continuity-bearing');
}

function isTransitionBearing(item) {
  const runtime = getRuntimeStructure(item);
  const bounded = runtime.boundedContinuation || {};
  const types = Array.isArray(runtime.continuationType) ? runtime.continuationType : [];
  return !!bounded.transition || types.includes('operational-transition');
}

function hasRuntimeFlag(item, flag) {
  const runtime = getRuntimeStructure(item);
  return !!runtime[flag];
}

function isTrueOperational(selectivity, model) {
  return selectivity.operationalStrength >= 0.6
    && selectivity.continuityImportance >= 0.5
    && selectivity.runtimeOperationalValue >= 0.5
    && selectivity.boundedOperationalConfidence >= 0.5
    && model.transitionCritical;
}

function isNoisyOperational(selectivity) {
  return selectivity.operationalStrength >= 0.4
    && selectivity.localClosureBias >= 0.6
    && selectivity.continuityImportance < 0.4
    && selectivity.runtimeOperationalValue < 0.4;
}

function buildOperationalValueMetrics(classes, metrics) {
  return {
    routingCriticality: Number((classes.includes('routing-critical') ? 1 : 0).toFixed(3)),
    interruptionSeverity: Number((classes.includes('interruption-sensitive') ? 1 : 0).toFixed(3)),
    dependencyImportance: Number((classes.includes('dependency-resolution') ? 1 : 0).toFixed(3)),
    recoveryImportance: Number((classes.includes('recovery-significant') ? 1 : 0).toFixed(3)),
    continuationSensitivity: Number(((metrics.propagationDepth || 0) > 0 ? 1 : 0).toFixed(3)),
    operationalPropagationWeight: Number((metrics.operationalClosureCost || 0).toFixed(3)),
    boundedOperationalValue: Number((classes.includes('state-transition') ? 1 : 0).toFixed(3))
  };
}

function buildSplitStats(list, predicate) {
  return {
    retained: rate(list.filter(isRetained), predicate),
    dropped: rate(list.filter((item) => !isRetained(item)), predicate),
    continuityBearing: rate(list.filter(isContinuityBearing), predicate)
  };
}

function buildDiagnostics(trace) {
  const items = [
    ...((trace.seed && trace.seed.items) || []),
    ...((trace.pages || []).flatMap((page) => page.items || []))
  ];

  const kept = items.filter(isKept);
  const records = kept.map((item) => {
    const model = getPreservationModel(item);
    const interpretation = getPreservationInterpretation(item, model);
    const selectivity = getSelectivity(item, model, interpretation);
    const metrics = getClosureMetrics(item);
    return {
      item,
      model,
      interpretation,
      selectivity,
      operationalValue: buildOperationalValueMetrics(getRuntimeUtilityClass(item), metrics)
    };
  });

  const trueOperational = (record) => isTrueOperational(record.selectivity, record.model);
  const noisyOperational = (record) => isNoisyOperational(record.selectivity);

  const split = {
    trueOperational: buildSplitStats(records.map((r) => r.item), (item) => {
      const record = records.find((entry) => entry.item.id === item.id);
      return trueOperational(record);
    }),
    noisyOperational: buildSplitStats(records.map((r) => r.item), (item) => {
      const record = records.find((entry) => entry.item.id === item.id);
      return noisyOperational(record);
    }),
    transitionCritical: buildSplitStats(records.map((r) => r.item), (item) => {
      const record = records.find((entry) => entry.item.id === item.id);
      return record.model.transitionCritical;
    }),
    standaloneOperationalOverlap: buildSplitStats(records.map((r) => r.item), (item) => {
      const record = records.find((entry) => entry.item.id === item.id);
      return record.selectivity.standaloneDominanceRisk >= 0.6
        && record.selectivity.operationalStrength >= 0.6;
    })
  };

  const distributions = {
    operationalStrengthHigh: rate(kept, (item) => {
      const record = records.find((entry) => entry.item.id === item.id);
      return record.selectivity.operationalStrength >= 0.6;
    }),
    operationalNoiseHigh: rate(kept, (item) => {
      const record = records.find((entry) => entry.item.id === item.id);
      return record.selectivity.operationalNoiseRisk >= 0.6;
    }),
    boundedOperationalConfidenceHigh: rate(kept, (item) => {
      const record = records.find((entry) => entry.item.id === item.id);
      return record.selectivity.boundedOperationalConfidence >= 0.6;
    }),
    transitionCritical: rate(kept, (item) => {
      const record = records.find((entry) => entry.item.id === item.id);
      return record.model.transitionCritical;
    }),
    runtimeOperationalValueHigh: rate(kept, (item) => {
      const record = records.find((entry) => entry.item.id === item.id);
      return record.selectivity.runtimeOperationalValue >= 0.6;
    })
  };

  const operationalValueAggregates = {
    routingCriticality: rate(kept, (item) => {
      const record = records.find((entry) => entry.item.id === item.id);
      return record.operationalValue.routingCriticality > 0;
    }),
    interruptionSeverity: rate(kept, (item) => {
      const record = records.find((entry) => entry.item.id === item.id);
      return record.operationalValue.interruptionSeverity > 0;
    }),
    dependencyImportance: rate(kept, (item) => {
      const record = records.find((entry) => entry.item.id === item.id);
      return record.operationalValue.dependencyImportance > 0;
    }),
    recoveryImportance: rate(kept, (item) => {
      const record = records.find((entry) => entry.item.id === item.id);
      return record.operationalValue.recoveryImportance > 0;
    }),
    continuationSensitivity: rate(kept, (item) => {
      const record = records.find((entry) => entry.item.id === item.id);
      return record.operationalValue.continuationSensitivity > 0;
    }),
    operationalPropagationWeight: rate(kept, (item) => {
      const record = records.find((entry) => entry.item.id === item.id);
      return record.operationalValue.operationalPropagationWeight >= 0.5;
    }),
    boundedOperationalValue: rate(kept, (item) => {
      const record = records.find((entry) => entry.item.id === item.id);
      return record.operationalValue.boundedOperationalValue > 0;
    })
  };

  return {
    meta: {
      totals: {
        items: items.length,
        kept: kept.length,
        continuityBearing: kept.filter(isContinuityBearing).length,
        transitionBearing: kept.filter(isTransitionBearing).length
      }
    },
    trueOperationalDiscrimination: split.trueOperational,
    noisyOperationalDetection: split.noisyOperational,
    operationalDistributions: distributions,
    operationalValueAggregates,
    transitionCriticalSelectivity: split.transitionCritical,
    standaloneOperationalOverlap: split.standaloneOperationalOverlap
  };
}

function formatStat(label, stat) {
  return `- ${label}: ${stat.hits}/${stat.total} = ${stat.rate}`;
}

function formatSplitBlock(label, block) {
  return [
    `**${label}**`,
    formatStat('retained', block.retained),
    formatStat('dropped', block.dropped),
    formatStat('continuity-bearing', block.continuityBearing)
  ];
}

function formatSection(title, lines) {
  return [`## ${title}`, '', ...lines, ''].join('\n');
}

function buildMarkdown(diagnostics, inputPath) {
  const totals = diagnostics.meta.totals;
  const lines = [];
  lines.push('# Operational Selectivity Diagnostics');
  lines.push('');
  lines.push(`Input: ${inputPath}`);
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push(`- items: ${totals.items}`);
  lines.push(`- kept: ${totals.kept}`);
  lines.push(`- continuity-bearing: ${totals.continuityBearing}`);
  lines.push(`- transition-bearing: ${totals.transitionBearing}`);
  lines.push('');

  lines.push(formatSection(
    '1) True Operational Continuity Discrimination',
    formatSplitBlock('true operational continuity', diagnostics.trueOperationalDiscrimination)
  ));

  lines.push(formatSection(
    '2) Noisy Operational Closure Detection',
    formatSplitBlock('noisy operational closure', diagnostics.noisyOperationalDetection)
  ));

  lines.push(formatSection(
    '3) Runtime Operational Value Modeling',
    [
      formatStat('routingCriticality', diagnostics.operationalValueAggregates.routingCriticality),
      formatStat('interruptionSeverity', diagnostics.operationalValueAggregates.interruptionSeverity),
      formatStat('dependencyImportance', diagnostics.operationalValueAggregates.dependencyImportance),
      formatStat('recoveryImportance', diagnostics.operationalValueAggregates.recoveryImportance),
      formatStat('continuationSensitivity', diagnostics.operationalValueAggregates.continuationSensitivity),
      formatStat('operationalPropagationWeight', diagnostics.operationalValueAggregates.operationalPropagationWeight),
      formatStat('boundedOperationalValue', diagnostics.operationalValueAggregates.boundedOperationalValue)
    ]
  ));

  lines.push(formatSection(
    '4) Operational Selectivity Diagnostics',
    [
      formatStat('operationalStrength high', diagnostics.operationalDistributions.operationalStrengthHigh),
      formatStat('operationalNoiseRisk high', diagnostics.operationalDistributions.operationalNoiseHigh),
      formatStat('boundedOperationalConfidence high', diagnostics.operationalDistributions.boundedOperationalConfidenceHigh),
      formatStat('transitionCritical', diagnostics.operationalDistributions.transitionCritical),
      formatStat('runtimeOperationalValue high', diagnostics.operationalDistributions.runtimeOperationalValueHigh)
    ]
  ));

  lines.push(formatSection(
    '5) Transition-Critical Selectivity',
    formatSplitBlock('transition-critical', diagnostics.transitionCriticalSelectivity)
  ));

  lines.push(formatSection(
    '6) Standalone-Operational Overlap',
    formatSplitBlock('standalone-operational overlap', diagnostics.standaloneOperationalOverlap)
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
  const jsonPath = path.join(baseDir, 'operational-selectivity-diagnostics.json');
  const mdPath = path.join(baseDir, 'operational-selectivity-diagnostics.md');

  writeJson(jsonPath, diagnostics);
  writeText(mdPath, buildMarkdown(diagnostics, inputPath));

  console.log(`Operational selectivity diagnostics saved to ${jsonPath}`);
  console.log(`Operational selectivity summary saved to ${mdPath}`);
}

main();
