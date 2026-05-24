const fs = require('fs');
const path = require('path');
const { loadPolicy, validateSourceType, validateSourceUrl } = require('./policy');
const { fetchUrlText } = require('./fetch');
const { chunkText } = require('./chunker');
const { extractFactsFromChunk } = require('./extractor');
const { normalizeFactListRaw, applyDedupe, applyRetentionShaping, mergeDropReasons } = require('./normalize');
const { canonicalizeFacts } = require('./canonicalize');
const { buildQualityDiagnostics } = require('./quality-diagnostics');

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
  const chunks = chunkText(text, { minTokens: 500, maxTokens: 1500, maxChunks });
  const extracted = [];
  const extractionDiagnostics = [];
  const enableLlm = !!args.llm && !args.noLLM;
  const model = args.model ? String(args.model).trim() : '';
  const allowEnv = !!args.allowEnv;
  const keytarService = args.keytarService ? String(args.keytarService).trim() : '';
  const keytarAccount = args.keytarAccount ? String(args.keytarAccount).trim() : '';

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
      ...result.diagnostics
    });
    if (Array.isArray(result.facts)) {
      extracted.push(...result.facts.map((fact) => ({ ...fact, sourceType: sourceCheck.sourceType })));
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

  const output = {
    game,
    sourceType: sourceCheck.sourceType,
    sourceUrlHost: inputResult.sourceUrlHost || null,
    extractedAt: new Date().toISOString(),
    facts: deduped.facts,
    diagnostics: {
      chunks: chunks.length,
      extracted: extracted.length,
      kept: deduped.facts.length,
      dropped: rawNormalized.dropped + deduped.dropped,
      dropReasons: mergeDropReasons(rawNormalized.dropReasons, deduped.dropReasons),
      dedupe: {
        exactDropped: deduped.exactDeduped || 0,
        nearDuplicateMarked: deduped.nearDuplicateMarked || 0,
        nearDuplicateDropped: deduped.nearDuplicateDropped || 0
      },
      canonicalization: canonicalized.diagnostics || { enabled: false },
      quality: buildQualityDiagnostics(deduped.facts),
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
    tier
  };
}

function mergeCounts(target, source) {
  const out = target || {};
  Object.entries(source || {}).forEach(([key, value]) => {
    out[key] = (out[key] || 0) + Number(value || 0);
  });
  return out;
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
    }
  }

  const report = {
    ranAt: new Date().toISOString(),
    total: results.length,
    success: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    diagnosticsSummary: {
      dropReasons: dropReasonTotals,
      tiers: tierTotals
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
