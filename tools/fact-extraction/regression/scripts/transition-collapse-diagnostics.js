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

function hasRuntimeFlag(item, flag) {
  const runtime = getRuntimeStructure(item);
  return !!runtime[flag];
}

function hasContinuationType(item, type) {
  const runtime = getRuntimeStructure(item);
  const types = Array.isArray(runtime.continuationType) ? runtime.continuationType : [];
  return types.includes(type);
}

function hasBoundedField(item, key) {
  const runtime = getRuntimeStructure(item);
  const bounded = runtime.boundedContinuation || {};
  return !!bounded[key];
}

function isTransitionBearing(item) {
  return hasBoundedField(item, 'transition') || hasContinuationType(item, 'operational-transition');
}

function isConditionBearing(item) {
  return hasBoundedField(item, 'condition');
}

function isConsequenceBearing(item) {
  return hasBoundedField(item, 'consequence');
}

function getCompactness(item) {
  const composition = getComposition(item);
  const stats = composition.representationStats || {};
  if (Number.isFinite(stats.coreDrivenCompactness)) return stats.coreDrivenCompactness;
  if (Number.isFinite(stats.representationCompactness)) return stats.representationCompactness;
  return null;
}

function isCompact(item, threshold) {
  const value = getCompactness(item);
  if (!Number.isFinite(value)) return false;
  return value >= threshold;
}

function isStandaloneMechanic(item) {
  return getUtilityArchetype(item).includes('standalone-mechanic');
}

function isSynthetic(item) {
  const grounding = getGrounding(item);
  return !!grounding.syntheticNarration;
}

function isShallowIdentity(item) {
  const runtimeClass = getRuntimeUtilityClass(item);
  const identity = getOperationalIdentity(item);
  return runtimeClass.length === 0 && identity.length <= 1;
}

function buildComponentPersistence(set, predicate) {
  return {
    retained: rate(set, (item) => predicate(item) && isRetained(item)),
    dropped: rate(set, (item) => predicate(item) && !isRetained(item)),
    transformed: rate(set, (item) => predicate(item) && isTransformed(item)),
    partialRecovery: rate(set, (item) => predicate(item) && isPartialRecovery(item))
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

function accumulateTags(map, tags, value) {
  for (const tag of tags) {
    if (!map.has(tag)) {
      map.set(tag, { total: 0, retained: 0, dropped: 0, localClosureDominant: 0 });
    }
    const entry = map.get(tag);
    entry.total += 1;
    if (value.retained) entry.retained += 1;
    if (value.dropped) entry.dropped += 1;
    if (value.localClosureDominant) entry.localClosureDominant += 1;
  }
}

function buildArchetypeStats(items) {
  const utilityMap = new Map();
  const continuationMap = new Map();

  for (const item of items) {
    const utility = getUtilityArchetype(item);
    const runtime = getRuntimeStructure(item);
    const continuationType = Array.isArray(runtime.continuationType) ? runtime.continuationType : [];
    const value = {
      retained: isRetained(item),
      dropped: !isRetained(item),
      localClosureDominant: hasRuntimeFlag(item, 'localClosureDominant')
    };
    if (utility.length) accumulateTags(utilityMap, utility, value);
    if (continuationType.length) accumulateTags(continuationMap, continuationType, value);
  }

  function finalize(map) {
    const out = [];
    for (const [tag, stats] of map.entries()) {
      out.push({
        tag,
        total: stats.total,
        retained: stats.retained,
        dropped: stats.dropped,
        localClosureDominant: stats.localClosureDominant,
        retainedRate: stats.total ? Number((stats.retained / stats.total).toFixed(3)) : 0,
        droppedRate: stats.total ? Number((stats.dropped / stats.total).toFixed(3)) : 0,
        localClosureDominantRate: stats.total
          ? Number((stats.localClosureDominant / stats.total).toFixed(3))
          : 0
      });
    }
    return out.sort((a, b) => b.total - a.total);
  }

  return {
    utilityArchetype: finalize(utilityMap),
    continuationType: finalize(continuationMap)
  };
}

function buildMatrix(items, families, components) {
  const matrix = {};
  for (const family of families) {
    matrix[family] = {};
    for (const component of components) {
      const subset = items.filter((item) => hasContinuationType(item, family) && component.predicate(item));
      matrix[family][component.key] = buildSurvivability(subset);
    }
  }
  return matrix;
}

function buildCollapseTaxonomy(items) {
  const taxonomy = {};
  function add(key, predicate) {
    taxonomy[key] = rate(items, predicate);
  }

  add('transitionCompression', (item) => isTransformed(item) || getGrounding(item).compressed);
  add('transitionFlattening', (item) => hasRuntimeFlag(item, 'localClosureDominant'));
  add('transitionOmission', (item) => !isConditionBearing(item) && !isConsequenceBearing(item));
  add('stateOnlySurvival', (item) => isConditionBearing(item) && !isConsequenceBearing(item));
  add('consequenceOnlySurvival', (item) => isConsequenceBearing(item) && !isConditionBearing(item));
  add('standaloneCollapse', (item) => isStandaloneMechanic(item) || hasRuntimeFlag(item, 'localClosureDominant'));
  add('routingCollapse', (item) => hasContinuationType(item, 'routing-network'));
  add('dependencyCollapse', (item) => hasContinuationType(item, 'dependency-propagation'));
  add('interruptionCollapse', (item) => hasContinuationType(item, 'interruption-flow'));

  return taxonomy;
}

function buildCollapseInteractions(items) {
  function collapseRate(flagPredicate) {
    const flagged = items.filter(flagPredicate);
    const unflagged = items.filter((item) => !flagPredicate(item));
    return {
      flagged: rate(flagged, (item) => !isRetained(item)),
      unflagged: rate(unflagged, (item) => !isRetained(item))
    };
  }

  return {
    localClosureDominant: collapseRate((item) => hasRuntimeFlag(item, 'localClosureDominant')),
    standaloneMechanic: collapseRate(isStandaloneMechanic),
    compactnessHigh: collapseRate((item) => isCompact(item, 0.6)),
    syntheticRepresentation: collapseRate(isSynthetic),
    shallowUtilityIdentity: collapseRate(isShallowIdentity)
  };
}

function buildDiagnostics(trace) {
  const items = [
    ...((trace.seed && trace.seed.items) || []),
    ...((trace.pages || []).flatMap((page) => page.items || []))
  ];

  const kept = items.filter(isKept);
  const transitionBearing = kept.filter(isTransitionBearing);
  const transitionDropped = transitionBearing.filter((item) => !isRetained(item));

  const transitionPersistence = {
    condition: buildComponentPersistence(kept, isConditionBearing),
    transition: buildComponentPersistence(kept, isTransitionBearing),
    consequence: buildComponentPersistence(kept, isConsequenceBearing)
  };

  const collapseTaxonomy = {
    transitionDropped: buildCollapseTaxonomy(transitionDropped)
  };

  const archetypeAnalysis = buildArchetypeStats(transitionBearing);

  const survivabilityMatrix = buildMatrix(
    transitionBearing,
    ['routing-network', 'interruption-flow', 'dependency-propagation', 'operational-transition'],
    [
      { key: 'condition', predicate: isConditionBearing },
      { key: 'transition', predicate: isTransitionBearing },
      { key: 'consequence', predicate: isConsequenceBearing }
    ]
  );

  const collapseInteractions = buildCollapseInteractions(transitionBearing);

  return {
    meta: {
      totals: {
        items: items.length,
        kept: kept.length,
        transitionBearing: transitionBearing.length,
        transitionDropped: transitionDropped.length
      }
    },
    transitionPersistence,
    collapseTaxonomy,
    archetypeAnalysis,
    survivabilityMatrix,
    collapseInteractions
  };
}

function formatStat(label, stat) {
  return `- ${label}: ${stat.hits}/${stat.total} = ${stat.rate}`;
}

function formatSection(title, lines) {
  return [`## ${title}`, '', ...lines, ''].join('\n');
}

function formatComponentBlock(label, block) {
  return [
    `**${label}**`,
    formatStat('retained', block.retained),
    formatStat('dropped', block.dropped),
    formatStat('transformed', block.transformed),
    formatStat('partial-recovery', block.partialRecovery)
  ];
}

function formatCollapseInteraction(label, block) {
  return [
    `**${label}**`,
    formatStat('collapse rate (flagged)', block.flagged),
    formatStat('collapse rate (unflagged)', block.unflagged)
  ];
}

function formatTaxonomyBlock(taxonomy) {
  const lines = [];
  for (const [key, stat] of Object.entries(taxonomy)) {
    lines.push(formatStat(key, stat));
  }
  return lines;
}

function formatArchetypeTable(label, entries) {
  const lines = [];
  lines.push(`**${label}**`);
  lines.push('');
  lines.push('| tag | total | retained | dropped | localClosureDominant |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const entry of entries) {
    lines.push(`| ${entry.tag} | ${entry.total} | ${entry.retained} | ${entry.dropped} | ${entry.localClosureDominant} |`);
  }
  return lines;
}

function formatMatrix(matrix) {
  const lines = [];
  const families = Object.keys(matrix);
  lines.push('| family | condition retained | transition retained | consequence retained |');
  lines.push('| --- | --- | --- | --- |');
  for (const family of families) {
    const row = matrix[family];
    lines.push(`| ${family} | ${row.condition.retained.rate} | ${row.transition.retained.rate} | ${row.consequence.retained.rate} |`);
  }
  return lines;
}

function buildMarkdown(diagnostics, inputPath) {
  const lines = [];
  const totals = diagnostics.meta.totals;
  lines.push('# Transition Collapse Diagnostics');
  lines.push('');
  lines.push(`Input: ${inputPath}`);
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push(`- items: ${totals.items}`);
  lines.push(`- kept: ${totals.kept}`);
  lines.push(`- transition-bearing: ${totals.transitionBearing}`);
  lines.push(`- transition dropped: ${totals.transitionDropped}`);
  lines.push('');

  lines.push(formatSection(
    '1) Transition Persistence Diagnostics',
    [
      ...formatComponentBlock('condition', diagnostics.transitionPersistence.condition),
      '',
      ...formatComponentBlock('transition', diagnostics.transitionPersistence.transition),
      '',
      ...formatComponentBlock('consequence', diagnostics.transitionPersistence.consequence)
    ]
  ));

  lines.push(formatSection(
    '2) Transition Collapse Taxonomy (transition-bearing dropped)',
    formatTaxonomyBlock(diagnostics.collapseTaxonomy.transitionDropped)
  ));

  lines.push(formatSection(
    '3) Transition-Bearing Archetype Analysis',
    [
      ...formatArchetypeTable('utility archetype', diagnostics.archetypeAnalysis.utilityArchetype),
      '',
      ...formatArchetypeTable('continuation type', diagnostics.archetypeAnalysis.continuationType)
    ]
  ));

  lines.push(formatSection(
    '4) Continuation Component Survivability Matrix (retained rates)',
    formatMatrix(diagnostics.survivabilityMatrix)
  ));

  lines.push(formatSection(
    '5) Collapse Interaction Analysis',
    [
      ...formatCollapseInteraction('localClosureDominant', diagnostics.collapseInteractions.localClosureDominant),
      '',
      ...formatCollapseInteraction('standalone-mechanic', diagnostics.collapseInteractions.standaloneMechanic),
      '',
      ...formatCollapseInteraction('compactness >= 0.6', diagnostics.collapseInteractions.compactnessHigh),
      '',
      ...formatCollapseInteraction('synthetic representation', diagnostics.collapseInteractions.syntheticRepresentation),
      '',
      ...formatCollapseInteraction('shallow utility identity', diagnostics.collapseInteractions.shallowUtilityIdentity)
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
  const jsonPath = path.join(baseDir, 'transition-collapse-diagnostics.json');
  const mdPath = path.join(baseDir, 'transition-collapse-diagnostics.md');

  writeJson(jsonPath, diagnostics);
  writeText(mdPath, buildMarkdown(diagnostics, inputPath));

  console.log(`Transition collapse diagnostics saved to ${jsonPath}`);
  console.log(`Transition collapse summary saved to ${mdPath}`);
}

main();
