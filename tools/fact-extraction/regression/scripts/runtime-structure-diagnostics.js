const fs = require('fs');
const path = require('path');

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

function getUtilityArchetype(item) {
  const archetype = getStage(item, 'utilityArchetype', []);
  return Array.isArray(archetype) ? archetype : [];
}

function getRuntimeStructure(item) {
  return getStage(item, 'runtimeStructure', {});
}

function isKept(item) {
  return item && item.status === 'kept';
}

function isRetained(item) {
  const retention = getStage(item, 'retention', null);
  return !!(retention && retention.retained);
}

function isTransformed(item) {
  const grounding = getGrounding(item);
  return !!grounding.transformed;
}

function isPartialRecovery(item) {
  const grounding = getGrounding(item);
  return !!grounding.recoveredImplication;
}

function isContinuityBearing(item) {
  return getUtilityArchetype(item).includes('continuity-bearing');
}

function hasRuntimeFlag(item, flag) {
  const runtime = getRuntimeStructure(item);
  return !!runtime[flag];
}

function hasContinuationType(item, type) {
  const runtime = getRuntimeStructure(item);
  const types = Array.isArray(runtime.continuationType) ? runtime.continuationType : [];
  return types.includes(type);
}

function hasBoundedContinuation(item) {
  const runtime = getRuntimeStructure(item);
  const bounded = runtime.boundedContinuation || {};
  return !!(bounded.condition || bounded.transition || bounded.consequence);
}

function hasBoundedField(item, key) {
  const runtime = getRuntimeStructure(item);
  const bounded = runtime.boundedContinuation || {};
  return !!bounded[key];
}

function buildPersistence(groups, predicate) {
  return {
    retained: rate(groups.retained, predicate),
    dropped: rate(groups.dropped, predicate),
    continuityBearing: rate(groups.continuityBearing, predicate)
  };
}

function buildSurvivability(set) {
  return {
    retained: rate(set, isRetained),
    dropped: rate(set, (item) => !isRetained(item)),
    transformed: rate(set, isTransformed),
    partialRecovery: rate(set, isPartialRecovery)
  };
}

function buildBoundedPersistence(set, predicate) {
  return {
    retained: rate(set, (item) => predicate(item) && isRetained(item)),
    dropped: rate(set, (item) => predicate(item) && !isRetained(item)),
    transformed: rate(set, (item) => predicate(item) && isTransformed(item))
  };
}

function formatStat(label, stat) {
  return `- ${label}: ${stat.hits}/${stat.total} = ${stat.rate}`;
}

function formatSection(title, lines) {
  return [`## ${title}`, '', ...lines, ''].join('\n');
}

function formatPersistenceBlock(label, block) {
  return [
    `**${label}**`,
    formatStat('retained', block.retained),
    formatStat('dropped', block.dropped),
    formatStat('continuity-bearing', block.continuityBearing)
  ];
}

function formatSurvivabilityBlock(label, block) {
  return [
    `**${label}**`,
    formatStat('retained', block.retained),
    formatStat('dropped', block.dropped),
    formatStat('transformed', block.transformed),
    formatStat('partial-recovery', block.partialRecovery)
  ];
}

function buildDiagnostics(trace) {
  const items = [
    ...((trace.seed && trace.seed.items) || []),
    ...((trace.pages || []).flatMap((page) => page.items || []))
  ];

  const kept = items.filter(isKept);
  const retained = kept.filter(isRetained);
  const dropped = kept.filter((item) => !isRetained(item));
  const transformed = kept.filter(isTransformed);
  const partialRecovery = kept.filter(isPartialRecovery);
  const continuityBearing = kept.filter(isContinuityBearing);

  const groups = { retained, dropped, continuityBearing };

  const runtimeStructurePersistence = {
    continuationLinked: buildPersistence(groups, (item) => hasRuntimeFlag(item, 'continuationLinked')),
    propagationAware: buildPersistence(groups, (item) => hasRuntimeFlag(item, 'propagationAware')),
    operationalFragment: buildPersistence(groups, (item) => hasRuntimeFlag(item, 'operationalFragment')),
    localClosureDominant: buildPersistence(groups, (item) => hasRuntimeFlag(item, 'localClosureDominant'))
  };

  const continuationSurvivability = {
    continuationBearing: buildSurvivability(continuityBearing),
    continuationLinked: buildSurvivability(kept.filter((item) => hasRuntimeFlag(item, 'continuationLinked'))),
    boundedContinuation: buildSurvivability(kept.filter(hasBoundedContinuation))
  };

  const operationalFragmentStability = {
    operationalFragmentPersistence: runtimeStructurePersistence.operationalFragment,
    fragmentSurvivability: {
      routingNetwork: buildSurvivability(kept.filter((item) => hasContinuationType(item, 'routing-network'))),
      dependencyPropagation: buildSurvivability(kept.filter((item) => hasContinuationType(item, 'dependency-propagation'))),
      interruptionFlow: buildSurvivability(kept.filter((item) => hasContinuationType(item, 'interruption-flow')))
    },
    propagationAwareCollapseRate: rate(
      kept.filter((item) => hasRuntimeFlag(item, 'propagationAware')),
      (item) => !isRetained(item)
    )
  };

  const closureDominanceInteractions = {
    overlaps: {
      localClosureDominant_with_continuationLinked: buildPersistence(
        groups,
        (item) => hasRuntimeFlag(item, 'localClosureDominant') && hasRuntimeFlag(item, 'continuationLinked')
      ),
      localClosureDominant_with_operationalFragment: buildPersistence(
        groups,
        (item) => hasRuntimeFlag(item, 'localClosureDominant') && hasRuntimeFlag(item, 'operationalFragment')
      ),
      localClosureDominant_with_propagationAware: buildPersistence(
        groups,
        (item) => hasRuntimeFlag(item, 'localClosureDominant') && hasRuntimeFlag(item, 'propagationAware')
      )
    },
    collapsePatterns: {
      localClosureDominantDropped: rate(
        kept.filter((item) => hasRuntimeFlag(item, 'localClosureDominant')),
        (item) => !isRetained(item)
      )
    },
    flatteningPatterns: {
      localClosureDominantOperationalFragment: rate(
        kept.filter((item) => hasRuntimeFlag(item, 'localClosureDominant')),
        (item) => hasRuntimeFlag(item, 'operationalFragment')
      )
    },
    standaloneDominanceInteractions: {
      localClosureDominantPersistence: runtimeStructurePersistence.localClosureDominant
    }
  };

  const boundedContinuationDiagnostics = {
    condition: buildBoundedPersistence(kept, (item) => hasBoundedField(item, 'condition')),
    transition: buildBoundedPersistence(kept, (item) => hasBoundedField(item, 'transition')),
    consequence: buildBoundedPersistence(kept, (item) => hasBoundedField(item, 'consequence'))
  };

  return {
    meta: {
      totals: {
        items: items.length,
        kept: kept.length,
        retained: retained.length,
        dropped: dropped.length,
        transformed: transformed.length,
        partialRecovery: partialRecovery.length,
        continuityBearing: continuityBearing.length
      }
    },
    runtimeStructurePersistence,
    continuationSurvivability,
    operationalFragmentStability,
    closureDominanceInteractions,
    boundedContinuationDiagnostics
  };
}

function buildMarkdown(diagnostics, inputPath) {
  const lines = [];
  lines.push('# RuntimeStructure Persistence Diagnostics');
  lines.push('');
  lines.push(`Input: ${inputPath}`);
  lines.push('');
  const totals = diagnostics.meta.totals;
  lines.push('## Totals');
  lines.push('');
  lines.push(`- items: ${totals.items}`);
  lines.push(`- kept: ${totals.kept}`);
  lines.push(`- retained: ${totals.retained}`);
  lines.push(`- dropped: ${totals.dropped}`);
  lines.push(`- transformed: ${totals.transformed}`);
  lines.push(`- partial-recovery: ${totals.partialRecovery}`);
  lines.push(`- continuity-bearing: ${totals.continuityBearing}`);
  lines.push('');

  lines.push(formatSection(
    '1) RuntimeStructure Persistence',
    [
      ...formatPersistenceBlock('continuationLinked', diagnostics.runtimeStructurePersistence.continuationLinked),
      '',
      ...formatPersistenceBlock('propagationAware', diagnostics.runtimeStructurePersistence.propagationAware),
      '',
      ...formatPersistenceBlock('operationalFragment', diagnostics.runtimeStructurePersistence.operationalFragment),
      '',
      ...formatPersistenceBlock('localClosureDominant', diagnostics.runtimeStructurePersistence.localClosureDominant)
    ]
  ));

  lines.push(formatSection(
    '2) Continuation Survivability Diagnostics',
    [
      ...formatSurvivabilityBlock('continuation-bearing', diagnostics.continuationSurvivability.continuationBearing),
      '',
      ...formatSurvivabilityBlock('continuation-linked', diagnostics.continuationSurvivability.continuationLinked),
      '',
      ...formatSurvivabilityBlock('boundedContinuation', diagnostics.continuationSurvivability.boundedContinuation)
    ]
  ));

  lines.push(formatSection(
    '3) Operational Fragment Stability',
    [
      ...formatPersistenceBlock('operationalFragment persistence', diagnostics.operationalFragmentStability.operationalFragmentPersistence),
      '',
      ...formatSurvivabilityBlock('routing-network fragment', diagnostics.operationalFragmentStability.fragmentSurvivability.routingNetwork),
      '',
      ...formatSurvivabilityBlock('dependency-propagation fragment', diagnostics.operationalFragmentStability.fragmentSurvivability.dependencyPropagation),
      '',
      ...formatSurvivabilityBlock('interruption-flow fragment', diagnostics.operationalFragmentStability.fragmentSurvivability.interruptionFlow),
      '',
      formatStat('propagation-aware fragment collapse rate', diagnostics.operationalFragmentStability.propagationAwareCollapseRate)
    ]
  ));

  lines.push(formatSection(
    '4) Closure Dominance Interaction Diagnostics',
    [
      ...formatPersistenceBlock('localClosureDominant ∧ continuationLinked', diagnostics.closureDominanceInteractions.overlaps.localClosureDominant_with_continuationLinked),
      '',
      ...formatPersistenceBlock('localClosureDominant ∧ operationalFragment', diagnostics.closureDominanceInteractions.overlaps.localClosureDominant_with_operationalFragment),
      '',
      ...formatPersistenceBlock('localClosureDominant ∧ propagationAware', diagnostics.closureDominanceInteractions.overlaps.localClosureDominant_with_propagationAware),
      '',
      formatStat('localClosureDominant dropped', diagnostics.closureDominanceInteractions.collapsePatterns.localClosureDominantDropped),
      formatStat('localClosureDominant ∧ operationalFragment', diagnostics.closureDominanceInteractions.flatteningPatterns.localClosureDominantOperationalFragment)
    ]
  ));

  lines.push(formatSection(
    '5) BoundedContinuation Diagnostics',
    [
      '**condition persistence**',
      formatStat('retained', diagnostics.boundedContinuationDiagnostics.condition.retained),
      formatStat('dropped', diagnostics.boundedContinuationDiagnostics.condition.dropped),
      formatStat('transformed', diagnostics.boundedContinuationDiagnostics.condition.transformed),
      '',
      '**transition persistence**',
      formatStat('retained', diagnostics.boundedContinuationDiagnostics.transition.retained),
      formatStat('dropped', diagnostics.boundedContinuationDiagnostics.transition.dropped),
      formatStat('transformed', diagnostics.boundedContinuationDiagnostics.transition.transformed),
      '',
      '**consequence persistence**',
      formatStat('retained', diagnostics.boundedContinuationDiagnostics.consequence.retained),
      formatStat('dropped', diagnostics.boundedContinuationDiagnostics.consequence.dropped),
      formatStat('transformed', diagnostics.boundedContinuationDiagnostics.consequence.transformed)
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
  const jsonPath = path.join(baseDir, 'runtime-structure-diagnostics.json');
  const mdPath = path.join(baseDir, 'runtime-structure-diagnostics.md');

  writeJson(jsonPath, diagnostics);
  writeText(mdPath, buildMarkdown(diagnostics, inputPath));

  console.log(`RuntimeStructure diagnostics saved to ${jsonPath}`);
  console.log(`RuntimeStructure summary saved to ${mdPath}`);
}

main();
