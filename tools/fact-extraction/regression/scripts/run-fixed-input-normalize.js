const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { loadPolicy } = require('../../policy');
const {
  normalizeFactListRawDetailed,
  applyDedupe,
  applyRetentionShaping,
  mergeDropReasons
} = require('../../normalize');
const { canonicalizeFacts } = require('../../canonicalize');
const { buildQualityDiagnostics } = require('../../quality-diagnostics');
const { buildSnapshot, writeSnapshotFiles } = require('./build-snapshot');
const { classifyUtilitySignals } = require('../../normalize/utility/classify');
const { classifyOperationalIdentity } = require('../../normalize/utility/operational-identity');
const { classifyIdentityPrecedence } = require('../../normalize/utility/identity-precedence');
const { computeClosureMetrics } = require('../../normalize/utility/closure-metrics');
const { classifyRuntimeStructure } = require('../../normalize/utility/runtime-structure');
const { classifyPreservationModel } = require('../../normalize/utility/preservation-model');
const { classifyPreservationInterpretation } = require('../../normalize/utility/preservation-interpretation');
const { classifyOperationalSelectivity } = require('../../normalize/utility/operational-selectivity');

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
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeJson(filePath, payload) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeFactKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTraceEntry(item, options) {
  const { sourceUrl, origin, finalByKey } = options;
  const inputText = item && item.input ? item.input.text : '';
  const textKey = normalizeFactKey(item && item.ok ? item.fact.text : inputText);
  const chunkId = Number.isFinite(Number(item && item.input && item.input._chunkId))
    ? Number(item.input._chunkId)
    : 0;
  const entry = {
    id: hashId(`${textKey}|${origin}|${sourceUrl || ''}|${chunkId || 0}`),
    origin,
    sourceUrl: sourceUrl || null,
    textKey,
    chunkId: chunkId || null,
    status: item && item.ok ? 'kept' : 'dropped',
    stages: {
      filters: {
        passed: !!(item && item.ok),
        dropReason: item && item.ok ? null : (item && item.error ? item.error : 'unknown')
      }
    }
  };

  if (!item || !item.ok) return entry;

  const fact = item.fact || {};
  const grounding = fact._grounding || {};
  const retained = finalByKey.has(textKey);
  const finalFact = retained ? finalByKey.get(textKey) : null;

  entry.stages.grounding = {
    anchor: grounding.anchor || false,
    anchorScope: grounding.anchorScope || null,
    anchorInText: grounding.anchorInText || false,
    anchorInLocal: grounding.anchorInLocal || false,
    hasEntity: grounding.hasEntity || false,
    hasCondition: grounding.hasCondition || false,
    hasEffect: grounding.hasEffect || false,
    syntheticNarration: grounding.syntheticNarration || false,
    adviceTone: grounding.adviceTone || false,
    failureConstraint: grounding.failureConstraint || false,
    stateTransition: grounding.stateTransition || false,
    downstreamImpact: grounding.downstreamImpact || false,
    constraintChain: grounding.constraintChain || false,
    causalChain: grounding.causalChain || false,
    multiStep: grounding.multiStep || false,
    continuationScope: grounding.continuationScope || null,
    procedural: grounding.procedural || false,
    recoveredImplication: grounding.recoveredImplication || false,
    operationalContinuation: grounding.operationalContinuation || false,
    representation: grounding.representation || null,
    transformed: grounding.transformed || false,
    compressed: grounding.compressed || false
  };

  entry.stages.scoring = {
    priority: Number.isFinite(fact.priority) ? fact.priority : null,
    suggestedPriority: fact.suggestedPriority || null,
    noveltyScore: Number.isFinite(fact.noveltyScore) ? fact.noveltyScore : null,
    obviousness: Number.isFinite(fact.obviousness) ? fact.obviousness : null,
    interactionCount: Number.isFinite(fact.interactionCount) ? fact.interactionCount : null,
    systemicDepth: Number.isFinite(fact.systemicDepth) ? fact.systemicDepth : null,
    roleTags: Array.isArray(fact.roleTags) ? fact.roleTags : []
  };

  entry.stages.composition = {
    compositionHints: grounding.compositionHints || null,
    mechanicShape: grounding.mechanicShape || null,
    mechanicCore: fact.mechanicCore || null,
    representationStats: grounding.representationStats || null
  };

  entry.stages.utilitySignals = fact.utilitySignals || null;
    if (fact.utilitySignals) {
      const utilityLabels = classifyUtilitySignals({
        utilitySignals: fact.utilitySignals,
        grounding,
        representationStats: grounding.representationStats
      });
      entry.stages.utilityArchetype = utilityLabels.utilityArchetype;
      entry.stages.runtimeUtilityClass = utilityLabels.runtimeUtilityClass;
      entry.stages.operationalIdentity = classifyOperationalIdentity({
        utilitySignals: fact.utilitySignals,
        grounding,
        runtimeUtilityClass: utilityLabels.runtimeUtilityClass
      });
      const identityPrecedence = classifyIdentityPrecedence({
        utilityArchetype: utilityLabels.utilityArchetype,
        operationalIdentity: entry.stages.operationalIdentity,
        representation: grounding.representation,
        representationStats: grounding.representationStats,
        grounding
      });
      entry.stages.primaryRepresentationIdentity = identityPrecedence.primaryRepresentationIdentity;
      entry.stages.secondaryRepresentationIdentity = identityPrecedence.secondaryRepresentationIdentity;
      entry.stages.identityDominanceScore = identityPrecedence.identityDominanceScore;
      entry.stages.identityCompetition = identityPrecedence.identityCompetition;
      const closureMetrics = computeClosureMetrics({
        grounding,
        representationStats: grounding.representationStats,
        utilityArchetype: utilityLabels.utilityArchetype,
        operationalIdentity: entry.stages.operationalIdentity,
        runtimeUtilityClass: utilityLabels.runtimeUtilityClass
      });
      entry.stages.closureMetrics = closureMetrics;
      entry.stages.runtimeStructure = classifyRuntimeStructure({
        grounding,
        utilityArchetype: utilityLabels.utilityArchetype,
        operationalIdentity: entry.stages.operationalIdentity,
        runtimeUtilityClass: utilityLabels.runtimeUtilityClass,
        closureMetrics
      });
      entry.stages.preservationModel = classifyPreservationModel({
        grounding,
        representationStats: grounding.representationStats,
        utilityArchetype: utilityLabels.utilityArchetype,
        operationalIdentity: entry.stages.operationalIdentity,
        runtimeUtilityClass: utilityLabels.runtimeUtilityClass,
        runtimeStructure: entry.stages.runtimeStructure,
        closureMetrics
      });
      entry.stages.preservationInterpretation = classifyPreservationInterpretation({
        grounding,
        representationStats: grounding.representationStats,
        utilityArchetype: utilityLabels.utilityArchetype,
        operationalIdentity: entry.stages.operationalIdentity,
        runtimeUtilityClass: utilityLabels.runtimeUtilityClass,
        runtimeStructure: entry.stages.runtimeStructure,
        closureMetrics,
        preservationModel: entry.stages.preservationModel
      });
      entry.stages.operationalSelectivity = classifyOperationalSelectivity({
        grounding,
        representationStats: grounding.representationStats,
        utilityArchetype: utilityLabels.utilityArchetype,
        operationalIdentity: entry.stages.operationalIdentity,
        runtimeUtilityClass: utilityLabels.runtimeUtilityClass,
        runtimeStructure: entry.stages.runtimeStructure,
        closureMetrics,
        preservationModel: entry.stages.preservationModel,
        preservationInterpretation: entry.stages.preservationInterpretation
      });
    } else {
      entry.stages.utilityArchetype = null;
      entry.stages.runtimeUtilityClass = null;
      entry.stages.operationalIdentity = null;
      entry.stages.primaryRepresentationIdentity = null;
      entry.stages.secondaryRepresentationIdentity = null;
      entry.stages.identityDominanceScore = null;
      entry.stages.identityCompetition = null;
      entry.stages.closureMetrics = null;
      entry.stages.runtimeStructure = null;
      entry.stages.preservationModel = null;
      entry.stages.preservationInterpretation = null;
      entry.stages.operationalSelectivity = null;
    }

  const trace = fact._trace || {};
  entry.stages.penaltyAttribution = trace && (trace.retentionAttributionA || trace.retentionAttributionB)
    ? {
      scoringSteps: Array.isArray(trace.scoringSteps) ? trace.scoringSteps : [],
      retentionA: trace.retentionAttributionA || null,
      retentionB: trace.retentionAttributionB || null
    }
    : null;

  entry.stages.canonicalSignals = {
    systems: Array.isArray(fact.systems) ? fact.systems : [],
    mechanicFamilies: Array.isArray(fact.mechanicFamilies) ? fact.mechanicFamilies : [],
    keywordsNormalized: Array.isArray(fact.keywordsNormalized) ? fact.keywordsNormalized : []
  };

  entry.stages.retention = {
    layer: fact.layer || null,
    retentionScoreA: Number.isFinite(fact.retentionScoreA) ? fact.retentionScoreA : null,
    retentionScoreB: Number.isFinite(fact.retentionScoreB) ? fact.retentionScoreB : null,
    retained,
    finalLayer: finalFact ? finalFact.layer : null,
    finalPriority: finalFact && Number.isFinite(finalFact.priority) ? finalFact.priority : null,
    finalRetentionScoreA: finalFact && Number.isFinite(finalFact.retentionScoreA) ? finalFact.retentionScoreA : null,
    finalRetentionScoreB: finalFact && Number.isFinite(finalFact.retentionScoreB) ? finalFact.retentionScoreB : null,
    priorityAdjusted: !!(finalFact && Number.isFinite(finalFact.priority)
      && Number.isFinite(fact.priority)
      && finalFact.priority !== fact.priority)
  };

  return entry;
}

function mergeFacts(target, source) {
  const list = Array.isArray(source) ? source : [];
  for (const fact of list) {
    if (!fact || !fact.text) continue;
    const key = normalizeFactKey(fact.text);
    if (!key) continue;
    if (!target.has(key)) {
      target.set(key, { ...fact });
      continue;
    }
    const existing = target.get(key);
    if (!existing.sourceUrl && fact.sourceUrl) existing.sourceUrl = fact.sourceUrl;
    if (!existing.layer && fact.layer) existing.layer = fact.layer;
    if (!existing.systems && fact.systems) existing.systems = fact.systems;
    if (!existing.mechanicFamilies && fact.mechanicFamilies) existing.mechanicFamilies = fact.mechanicFamilies;
  }
}

function buildFamilyAggregation(facts) {
  const familyCounts = {};
  const familyPairs = {};
  const systemPairs = {};
  const list = Array.isArray(facts) ? facts : [];
  for (const fact of list) {
    const families = Array.isArray(fact.mechanicFamilies) ? fact.mechanicFamilies : [];
    const systems = Array.isArray(fact.systems) ? fact.systems : [];
    const uniqFamilies = Array.from(new Set(families));
    const uniqSystems = Array.from(new Set(systems));
    for (const family of uniqFamilies) {
      familyCounts[family] = (familyCounts[family] || 0) + 1;
    }
    for (let i = 0; i < uniqFamilies.length; i += 1) {
      for (let j = i + 1; j < uniqFamilies.length; j += 1) {
        const a = uniqFamilies[i];
        const b = uniqFamilies[j];
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        familyPairs[key] = (familyPairs[key] || 0) + 1;
      }
    }
    for (let i = 0; i < uniqSystems.length; i += 1) {
      for (let j = i + 1; j < uniqSystems.length; j += 1) {
        const a = uniqSystems[i];
        const b = uniqSystems[j];
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        systemPairs[key] = (systemPairs[key] || 0) + 1;
      }
    }
  }
  return { familyCounts, familyPairs, systemPairs };
}

function hashId(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 12);
}

async function normalizeRawFacts(rawFacts, policy, args, traceContext) {
  const tracePolicy = traceContext ? { ...policy, traceNormalize: true, traceUtility: true } : policy;
  const rawDetailed = normalizeFactListRawDetailed(rawFacts, tracePolicy);
  const canonicalizeEnabled = !args.noCanonicalize;
  const allowEnv = !!args.allowEnv;
  const keytarService = args.keytarService ? String(args.keytarService).trim() : '';
  const keytarAccount = args.keytarAccount ? String(args.keytarAccount).trim() : '';
  const canonicalized = await canonicalizeFacts(rawDetailed.facts, {
    enableCanonicalize: canonicalizeEnabled,
    model: args.embedModel ? String(args.embedModel).trim() : '',
    allowEnv,
    keytarService,
    keytarAccount,
    softThreshold: Number.isFinite(Number(args.canonicalSoft)) ? Number(args.canonicalSoft) : undefined,
    strongThreshold: Number.isFinite(Number(args.canonicalStrong)) ? Number(args.canonicalStrong) : undefined,
    diagLimit: Number.isFinite(Number(args.canonicalDiagTop)) ? Number(args.canonicalDiagTop) : undefined
  });

  const deduped = applyDedupe(canonicalized.facts, policy);
  applyRetentionShaping(deduped.facts);

  const finalByKey = new Map();
  for (const fact of deduped.facts) {
    const key = normalizeFactKey(fact.text);
    if (key && !finalByKey.has(key)) finalByKey.set(key, fact);
  }

  const traceItems = rawDetailed.items.map((item) => buildTraceEntry(item, {
    sourceUrl: traceContext && traceContext.sourceUrl,
    origin: traceContext && traceContext.origin ? traceContext.origin : 'unknown',
    finalByKey
  }));

  const outputFacts = deduped.facts.map(({ _chunkId, _grounding, _trace, utilitySignals, ...rest }) => rest);
  return {
    facts: outputFacts,
    traceItems,
    diagnostics: {
      extracted: rawFacts.length,
      kept: outputFacts.length,
      dropped: rawDetailed.dropped + deduped.dropped,
      dropReasons: mergeDropReasons(rawDetailed.dropReasons, deduped.dropReasons),
      dedupe: {
        exactDropped: deduped.exactDeduped || 0,
        nearDuplicateMarked: deduped.nearDuplicateMarked || 0,
        nearDuplicateDropped: deduped.nearDuplicateDropped || 0
      },
      canonicalization: canonicalized.diagnostics || { enabled: false },
      quality: buildQualityDiagnostics(deduped.facts)
    }
  };
}

async function buildNeighborhoodPackage(options) {
  const { facts, seed, selection, outputs, args, policy } = options;
  const allowEnv = !!args.allowEnv;
  const keytarService = args.keytarService ? String(args.keytarService).trim() : '';
  const keytarAccount = args.keytarAccount ? String(args.keytarAccount).trim() : '';
  const neighborhoodCanonicalize = !args.noNeighborhoodCanonicalize;

  let mergedFacts = Array.isArray(facts) ? facts.slice() : [];
  let canonicalDiagnostics = { enabled: false };
  if (neighborhoodCanonicalize) {
    const canonicalized = await canonicalizeFacts(mergedFacts, {
      enableCanonicalize: true,
      model: args.embedModel ? String(args.embedModel).trim() : '',
      allowEnv,
      keytarService,
      keytarAccount,
      softThreshold: Number.isFinite(Number(args.canonicalSoft)) ? Number(args.canonicalSoft) : undefined,
      strongThreshold: Number.isFinite(Number(args.canonicalStrong)) ? Number(args.canonicalStrong) : undefined,
      diagLimit: Number.isFinite(Number(args.canonicalDiagTop)) ? Number(args.canonicalDiagTop) : undefined
    });
    canonicalDiagnostics = canonicalized.diagnostics || { enabled: false };
    mergedFacts = canonicalized.facts || [];
  }

  const deduped = applyDedupe(mergedFacts, policy);
  applyRetentionShaping(deduped.facts);

  const factsWithIds = deduped.facts.map((fact) => ({
    ...fact,
    id: fact.id || hashId(`${fact.text}|${fact.sourceUrl || ''}|${fact.sectionPath || ''}`)
  }));
  const factsA = factsWithIds.filter((fact) => fact.layer === 'A');
  const factsB = factsWithIds.filter((fact) => fact.layer === 'B');
  const aggregation = buildFamilyAggregation(factsWithIds);

  return {
    summary: {
      seed,
      selection,
      sources: outputs.map((entry) => ({
        url: entry.url,
        linkText: entry.linkText,
        score: entry.score,
        kept: entry.kept,
        sectionIngestion: !!entry.sectionIngestion
      })),
      totals: {
        facts: factsWithIds.length,
        factsA: factsA.length,
        factsB: factsB.length
      },
      diagnostics: {
        quality: buildQualityDiagnostics(factsWithIds),
        canonicalization: canonicalDiagnostics,
        aggregation
      },
      factsA,
      factsB
    },
    allFacts: {
      seed,
      totals: {
        facts: factsWithIds.length,
        factsA: factsA.length,
        factsB: factsB.length
      },
      facts: factsWithIds
    },
    diagnostics: {
      seed,
      selection,
      quality: buildQualityDiagnostics(factsWithIds),
      canonicalization: canonicalDiagnostics,
      aggregation
    }
  };
}

function slugify(value) {
  const cleaned = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  return cleaned || 'page';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input;
  const label = args.label;
  if (!inputPath || !label) {
    // eslint-disable-next-line no-console
    console.error('Usage: node run-fixed-input-normalize.js --input <raw-extracted.json> --label <label>');
    process.exit(1);
  }

  const payload = readJson(path.resolve(inputPath));
  const meta = payload.meta || {};
  const game = meta.game || (payload.seed && payload.seed.game) || 'unknown';
  const sourceType = meta.sourceType || (payload.seed && payload.seed.sourceType) || 'user';
  const config = meta.config || {};
  if (args.embedModel === undefined && config.embedModel) args.embedModel = config.embedModel;
  if (args.canonicalSoft === undefined && Number.isFinite(config.canonicalSoft)) {
    args.canonicalSoft = String(config.canonicalSoft);
  }
  if (args.canonicalStrong === undefined && Number.isFinite(config.canonicalStrong)) {
    args.canonicalStrong = String(config.canonicalStrong);
  }
  if (args.canonicalDiagTop === undefined && Number.isFinite(config.canonicalDiagTop)) {
    args.canonicalDiagTop = String(config.canonicalDiagTop);
  }
  if (args.noCanonicalize === undefined && config.noCanonicalize) args.noCanonicalize = true;
  if (args.noNeighborhoodCanonicalize === undefined && config.noNeighborhoodCanonicalize) {
    args.noNeighborhoodCanonicalize = true;
  }

  const policyPath = args.policy || meta.policyPath;
  const policyInfo = loadPolicy(policyPath);
  const policy = policyInfo.policy;

  const outDir = args.outDir
    ? path.resolve(args.outDir)
    : path.join(process.cwd(), 'out', 'fixed-input', label);
  const gameDir = path.join(outDir, game);
  const packageDir = path.join(gameDir, 'package');

  const normalizeTrace = {
    meta: {
      label,
      game,
      sourceType,
      createdAt: new Date().toISOString(),
      inputPath: path.resolve(inputPath)
    },
    seed: null,
    pages: []
  };

  const detailedTrace = {
    meta: normalizeTrace.meta,
    seed: null,
    pages: []
  };

  const seedRaw = payload.seed && Array.isArray(payload.seed.facts) ? payload.seed.facts : [];
  const seedResult = await normalizeRawFacts(seedRaw, policy, args, {
    origin: 'seed',
    sourceUrl: payload.seed && payload.seed.url ? payload.seed.url : meta.seedUrl
  });
  const seed = {
    url: payload.seed && payload.seed.url ? payload.seed.url : meta.seedUrl,
    game,
    sourceType,
    kept: seedResult.facts.length,
    diagnostics: seedResult.diagnostics
  };
  normalizeTrace.seed = {
    url: seed.url,
    extracted: seedResult.diagnostics.extracted,
    kept: seedResult.diagnostics.kept,
    dropped: seedResult.diagnostics.dropped,
    dropReasons: seedResult.diagnostics.dropReasons
  };
  detailedTrace.seed = {
    url: seed.url,
    extracted: seedResult.diagnostics.extracted,
    kept: seedResult.diagnostics.kept,
    dropped: seedResult.diagnostics.dropped,
    dropReasons: seedResult.diagnostics.dropReasons,
    items: seedResult.traceItems
  };

  const outputs = [];
  const combinedFacts = new Map();

  const pages = Array.isArray(payload.outputs) ? payload.outputs : [];
  for (const page of pages) {
    const rawFacts = Array.isArray(page.facts) ? page.facts : [];
    const result = await normalizeRawFacts(rawFacts, policy, args, {
      origin: 'page',
      sourceUrl: page.url
    });
    const factsWithSource = result.facts.map((fact) => ({
      ...fact,
      sourceUrl: page.url
    }));

    const slug = slugify(new URL(page.url).pathname.split('/').pop());
    const outputPath = path.join(gameDir, `${slug}.json`);
    writeJson(outputPath, {
      game,
      sourceType,
      sourceUrl: page.url,
      extractedAt: new Date().toISOString(),
      facts: factsWithSource,
      diagnostics: result.diagnostics
    });

    outputs.push({
      url: page.url,
      linkText: page.linkText,
      score: page.score,
      outputPath,
      kept: factsWithSource.length,
      sectionIngestion: !!page.sectionIngestion
    });
    mergeFacts(combinedFacts, factsWithSource);

    normalizeTrace.pages.push({
      url: page.url,
      extracted: result.diagnostics.extracted,
      kept: result.diagnostics.kept,
      dropped: result.diagnostics.dropped,
      dropReasons: result.diagnostics.dropReasons
    });
    detailedTrace.pages.push({
      url: page.url,
      extracted: result.diagnostics.extracted,
      kept: result.diagnostics.kept,
      dropped: result.diagnostics.dropped,
      dropReasons: result.diagnostics.dropReasons,
      items: result.traceItems
    });
  }

  mergeFacts(combinedFacts, seedResult.facts.map((fact) => ({
    ...fact,
    sourceUrl: seed.url
  })));

  const selection = payload.selection || {
    candidates: outputs.length,
    selected: outputs.length,
    skipped: 0,
    maxPages: outputs.length,
    minScore: null,
    fallbackScore: null
  };

  const packagePayload = await buildNeighborhoodPackage({
    facts: Array.from(combinedFacts.values()),
    seed,
    selection,
    outputs,
    args,
    policy
  });

  writeJson(path.join(gameDir, 'neighborhood-report.json'), {
    seed,
    selection,
    selected: outputs,
    skipped: []
  });
  writeJson(path.join(gameDir, 'neighborhood-summary.json'), packagePayload.summary);
  writeJson(path.join(packageDir, 'all-facts.json'), packagePayload.allFacts);
  writeJson(path.join(packageDir, 'diagnostics.json'), packagePayload.diagnostics);
  writeJson(path.join(packageDir, 'page-outputs.json'), outputs.map((entry) => ({
    url: entry.url,
    outputPath: entry.outputPath,
    kept: entry.kept,
    sectionIngestion: !!entry.sectionIngestion
  })));
  writeJson(path.join(packageDir, 'normalize-trace.json'), normalizeTrace);
  writeJson(path.join(packageDir, 'normalize-trace-detailed.json'), detailedTrace);

  const snapshot = buildSnapshot({
    diagnostics: packagePayload.diagnostics,
    totals: packagePayload.allFacts.totals,
    meta: {
      label,
      seed: seed.url,
      game,
      sourceType,
      configName: 'fixed-input',
      createdAt: new Date().toISOString()
    }
  });
  const output = writeSnapshotFiles(snapshot, path.join(__dirname, '..'));
  // eslint-disable-next-line no-console
  console.log(`Snapshot saved: ${output.snapshotPath}`);
  // eslint-disable-next-line no-console
  console.log(`Summary saved: ${output.summaryPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
