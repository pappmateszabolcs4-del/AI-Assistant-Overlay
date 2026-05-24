const fs = require('fs');
const path = require('path');
const { loadPolicy, validateSourceType, validateSourceUrl } = require('./policy');
const { fetchUrlText } = require('./fetch');
const { chunkText, isHeadingLine, analyzeTextStructure } = require('./chunker');
const { extractFactsFromChunk } = require('./extractor');
const { normalizeFactListRaw, applyDedupe, applyRetentionShaping, mergeDropReasons } = require('./normalize');
const { canonicalizeFacts } = require('./canonicalize');
const { buildQualityDiagnostics, buildChunkCohesionDiagnostics } = require('./quality-diagnostics');

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

function normalizeGameKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildOutputPath(gameName, baseDir) {
  const key = normalizeGameKey(gameName) || 'unknown';
  const dir = baseDir ? path.resolve(baseDir) : path.join(process.cwd(), 'out');
  return path.join(dir, `facts-${key}.json`);
}

function purgeOldFiles(dirPath, maxAgeDays) {
  if (!maxAgeDays || maxAgeDays <= 0) return;
  const dir = path.resolve(dirPath);
  if (!fs.existsSync(dir)) return;
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  for (const entry of fs.readdirSync(dir)) {
    const filePath = path.join(dir, entry);
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (_) {
      continue;
    }
    if (!stat.isFile()) continue;
    if (now - stat.mtimeMs > maxAgeMs) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
  }
}

function loadList(listPath) {
  const raw = fs.readFileSync(path.resolve(listPath), 'utf8');
  const parsed = JSON.parse(raw || '[]');
  return Array.isArray(parsed) ? parsed : [];
}

function countHeadingLines(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let count = 0;
  for (const line of lines) {
    if (isHeadingLine(line)) count += 1;
  }
  return count;
}

async function readInput(entry, policy, args) {
  if (entry.url) {
    const urlCheck = validateSourceUrl(entry.url, policy);
    if (!urlCheck.ok) {
      return { ok: false, error: `source-url-${urlCheck.error}` };
    }
    const maxBytes = Number.isFinite(Number(args.maxBytes)) ? Number(args.maxBytes) : undefined;
    const userAgent = args.userAgent ? String(args.userAgent) : undefined;
    const text = await fetchUrlText(urlCheck.url, { maxBytes, userAgent });
    return { ok: true, text, sourceUrlHost: urlCheck.host || '' };
  }

  if (entry.in) {
    const text = fs.readFileSync(path.resolve(entry.in), 'utf8');
    return { ok: true, text, sourceUrlHost: '' };
  }

  return { ok: false, error: 'missing-input' };
}

async function runEntry(entry, policyInfo, policy, args) {
  const game = String(entry.game || '').trim();
  if (!game) return { ok: false, error: 'missing-game' };
  const tier = String(entry.tier || '').trim().toUpperCase();

  const sourceTypeRaw = String(entry.sourceType || args.sourceType || 'user').trim();
  const sourceCheck = validateSourceType(sourceTypeRaw, policy);
  if (!sourceCheck.ok) return { ok: false, error: sourceCheck.error };

  const inputResult = await readInput(entry, policy, args);
  if (!inputResult.ok) return { ok: false, error: inputResult.error };

  const text = String(inputResult.text || '').trim();
  if (!text) return { ok: false, error: 'empty-input' };

  const maxChunks = Number.isFinite(Number(args.maxChunks))
    ? Number(args.maxChunks)
    : (Number.isFinite(Number(args.chunks)) ? Number(args.chunks) : 10);
  const ingestionStats = analyzeTextStructure(text);
  const chunks = chunkText(text, { minTokens: 500, maxTokens: 1500, maxChunks });
  const extracted = [];
  const extractionDiagnostics = [];
  const enableLlm = !!args.llm && !args.noLLM;
  const model = args.model ? String(args.model).trim() : '';
  const allowEnv = !!args.allowEnv;
  const keytarService = args.keytarService ? String(args.keytarService).trim() : '';
  const keytarAccount = args.keytarAccount ? String(args.keytarAccount).trim() : '';

  function normalizeContextText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function buildLocalContextWindow(factText, chunkText) {
    const source = normalizeContextText(chunkText);
    const target = normalizeContextText(factText).toLowerCase();
    if (!source || !target) return '';
    const stopWords = new Set([
      'the', 'and', 'that', 'with', 'from', 'this', 'into', 'they', 'their', 'your',
      'about', 'there', 'which', 'while', 'when', 'where', 'what', 'will', 'should',
      'would', 'could', 'have', 'has', 'had', 'been', 'were', 'them', 'then', 'than',
      'also', 'only', 'does', 'doesn', 'into', 'over', 'under', 'more', 'most'
    ]);
    const tokens = target
      .split(/[^a-z0-9]+/g)
      .filter((token) => token.length >= 4 && !stopWords.has(token));
    if (!tokens.length) return '';
    const sourceLower = source.toLowerCase();
    let hitIndex = -1;
    for (const token of tokens) {
      const idx = sourceLower.indexOf(token);
      if (idx !== -1) {
        hitIndex = idx;
        break;
      }
    }
    if (hitIndex === -1) return '';
    const windowRadius = 140;
    const start = Math.max(0, hitIndex - windowRadius);
    const end = Math.min(source.length, hitIndex + windowRadius);
    return source.slice(start, end).trim();
  }

  for (const chunk of chunks) {
    const result = await extractFactsFromChunk(chunk, {
      enableLlm,
      game,
      sourceType: sourceCheck.sourceType,
      model,
      policy,
      allowEnv,
      keytarService,
      keytarAccount
    });
    extractionDiagnostics.push({
      chunkId: chunk.chunkId,
      tokenEstimate: chunk.tokenEstimate,
      headingLines: countHeadingLines(chunk.text),
      ...result.diagnostics
    });
    if (Array.isArray(result.facts)) {
      extracted.push(...result.facts.map((fact) => ({
        ...fact,
        sourceType: sourceCheck.sourceType,
        _chunkId: chunk.chunkId,
        _contextWindow: buildLocalContextWindow(fact && fact.text, chunk.text)
      })));
    }
  }

  const rawNormalized = normalizeFactListRaw(extracted, policy);
  const canonicalizeEnabled = !args.noCanonicalize;
  const canonicalized = await canonicalizeFacts(rawNormalized.facts, {
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
  const chunkCohesion = buildChunkCohesionDiagnostics(rawNormalized.facts, extractionDiagnostics, {
    limit: Number.isFinite(Number(args.chunkDiagTop)) ? Number(args.chunkDiagTop) : undefined
  });
  const outputFacts = deduped.facts.map(({ _chunkId, _grounding, ...rest }) => rest);

  const output = {
    game,
    sourceType: sourceCheck.sourceType,
    sourceUrlHost: inputResult.sourceUrlHost || null,
    extractedAt: new Date().toISOString(),
    facts: outputFacts,
    diagnostics: {
      chunks: chunks.length,
      extracted: extracted.length,
      kept: outputFacts.length,
      dropped: rawNormalized.dropped + deduped.dropped,
      dropReasons: mergeDropReasons(rawNormalized.dropReasons, deduped.dropReasons),
      dedupe: {
        exactDropped: deduped.exactDeduped || 0,
        nearDuplicateMarked: deduped.nearDuplicateMarked || 0,
        nearDuplicateDropped: deduped.nearDuplicateDropped || 0
      },
      canonicalization: canonicalized.diagnostics || { enabled: false },
      quality: buildQualityDiagnostics(deduped.facts),
      chunkCohesion,
      ingestion: ingestionStats,
      llmEnabled: enableLlm,
      policyLoaded: policyInfo.loaded,
      policyPath: policyInfo.path,
      chunkDiagnostics: extractionDiagnostics
    }
  };

  const outPath = entry.out
    ? path.resolve(entry.out)
    : buildOutputPath(game, args.outDir);
  ensureDir(outPath);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  return {
    ok: true,
    outputPath: outPath,
    kept: deduped.facts.length,
    dropped: rawNormalized.dropped + deduped.dropped,
    dropReasons: mergeDropReasons(rawNormalized.dropReasons, deduped.dropReasons),
    tier,
    familyBundle: buildFamilyBundleStats(outputFacts)
  };
}

function mergeCounts(target, source) {
  const out = target || {};
  Object.entries(source || {}).forEach(([key, value]) => {
    out[key] = (out[key] || 0) + Number(value || 0);
  });
  return out;
}

function buildFamilyBundleStats(facts) {
  const familyFactCounts = {};
  const pairCounts = {};
  const entryFamilies = new Set();
  const factList = Array.isArray(facts) ? facts : [];

  for (const fact of factList) {
    const families = Array.isArray(fact.mechanicFamilies) ? fact.mechanicFamilies : [];
    const unique = Array.from(new Set(families.map((value) => String(value || '').trim()).filter(Boolean)));
    if (!unique.length) continue;
    for (const family of unique) {
      familyFactCounts[family] = (familyFactCounts[family] || 0) + 1;
      entryFamilies.add(family);
    }
    for (let i = 0; i < unique.length; i += 1) {
      for (let j = i + 1; j < unique.length; j += 1) {
        const a = unique[i];
        const b = unique[j];
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    }
  }

  return {
    factCount: factList.length,
    familyFactCounts,
    pairCounts,
    entryFamilies: Array.from(entryFamilies)
  };
}

function collectTopCounts(counts, limit) {
  return Object.entries(counts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.list) {
    // eslint-disable-next-line no-console
    console.error('Missing --list');
    process.exit(1);
  }

  const policyInfo = loadPolicy(args.policy);
  const policy = policyInfo.policy;
  if (args.outDir && args.purgeDays) {
    const purgeDays = Number(args.purgeDays);
    if (Number.isFinite(purgeDays)) purgeOldFiles(args.outDir, purgeDays);
  }

  const entries = loadList(args.list);
  const results = [];
  const dropReasonTotals = {};
  const tierTotals = {};
  const familyFactTotals = {};
  const familyEntryTotals = {};
  const familyPairTotals = {};
  let familyEntries = 0;
  let familyFacts = 0;
  for (const entry of entries) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runEntry(entry, policyInfo, policy, args);
    results.push({
      game: entry.game || '',
      ok: result.ok,
      outputPath: result.outputPath || null,
      kept: result.kept || 0,
      dropped: result.dropped || 0,
      tier: result.tier || null,
      error: result.ok ? null : result.error
    });

    if (result.ok) {
      mergeCounts(dropReasonTotals, result.dropReasons);
      if (result.tier) {
        tierTotals[result.tier] = (tierTotals[result.tier] || 0) + 1;
      }
      if (result.familyBundle) {
        familyEntries += 1;
        familyFacts += Number(result.familyBundle.factCount || 0);
        mergeCounts(familyFactTotals, result.familyBundle.familyFactCounts);
        mergeCounts(familyPairTotals, result.familyBundle.pairCounts);
        for (const family of result.familyBundle.entryFamilies || []) {
          familyEntryTotals[family] = (familyEntryTotals[family] || 0) + 1;
        }
      }
    }
  }

  const report = {
    ranAt: new Date().toISOString(),
    total: results.length,
    success: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    diagnosticsSummary: {
      dropReasons: dropReasonTotals,
      tiers: tierTotals,
      familyBundles: {
        entries: familyEntries,
        facts: familyFacts,
        topFamiliesByFact: collectTopCounts(familyFactTotals, 12),
        topFamiliesByEntry: collectTopCounts(familyEntryTotals, 12),
        topPairs: collectTopCounts(familyPairTotals, 12)
      }
    },
    results
  };

  const reportPath = args.report
    ? path.resolve(args.report)
    : path.join(process.cwd(), 'out', 'batch-report.json');
  ensureDir(reportPath);
  if (args.purgeDays) {
    const purgeDays = Number(args.purgeDays);
    if (Number.isFinite(purgeDays)) purgeOldFiles(path.dirname(reportPath), purgeDays);
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  // eslint-disable-next-line no-console
  console.log(`Batch report saved to ${reportPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
