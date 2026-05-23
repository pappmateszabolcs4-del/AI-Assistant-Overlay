const fs = require('fs');
const path = require('path');
const { loadPolicy, validateSourceType, validateSourceUrl } = require('./policy');
const { fetchUrlText } = require('./fetch');
const { chunkText } = require('./chunker');
const { extractFactsFromChunk } = require('./extractor');
const { normalizeFactList } = require('./normalize');

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

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

function normalizeGameKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function buildOutputPath(gameName, outPath) {
  if (outPath) return path.resolve(outPath);
  const key = normalizeGameKey(gameName) || 'unknown';
  return path.join(process.cwd(), 'out', `facts-${key}.json`);
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const game = String(args.game || '').trim();
  if (!game) {
    // eslint-disable-next-line no-console
    console.error('Missing --game');
    process.exit(1);
  }

  const sourceTypeRaw = String(args.sourceType || 'user').trim();
  const policyInfo = loadPolicy(args.policy);
  const policy = policyInfo.policy;
  const sourceCheck = validateSourceType(sourceTypeRaw, policy);
  if (!sourceCheck.ok) {
    // eslint-disable-next-line no-console
    console.error(`Source type rejected: ${sourceCheck.error}`);
    process.exit(1);
  }
  const sourceType = sourceCheck.sourceType;

  if (args.in && args.url) {
    // eslint-disable-next-line no-console
    console.error('Use only one input source: --in or --url');
    process.exit(1);
  }

  let input = '';
  let sourceUrlHost = '';
  if (args.url) {
    const urlCheck = validateSourceUrl(args.url, policy);
    if (!urlCheck.ok) {
      // eslint-disable-next-line no-console
      console.error(`Source URL rejected: ${urlCheck.error}`);
      process.exit(1);
    }
    sourceUrlHost = urlCheck.host || '';
    const maxBytes = Number.isFinite(Number(args.maxBytes)) ? Number(args.maxBytes) : undefined;
    const userAgent = args.userAgent ? String(args.userAgent) : undefined;
    input = await fetchUrlText(urlCheck.url, { maxBytes, userAgent });
  } else if (args.in) {
    input = fs.readFileSync(path.resolve(args.in), 'utf8');
  } else {
    input = await readStdin();
  }

  if (!String(input || '').trim()) {
    // eslint-disable-next-line no-console
    console.error('Missing input text (use --in or pipe via stdin).');
    process.exit(1);
  }

  const chunks = chunkText(input, { minTokens: 500, maxTokens: 1500 });
  const extracted = [];
  const extractionDiagnostics = [];
  const enableLlm = !!args.llm && !args.noLLM;
  const model = args.model ? String(args.model).trim() : '';
  const allowEnv = !!args.allowEnv;
  const keytarService = args.keytarService ? String(args.keytarService).trim() : '';
  const keytarAccount = args.keytarAccount ? String(args.keytarAccount).trim() : '';
  const verbose = !!args.verbose;
  const timeoutMs = Number.isFinite(Number(args.llmTimeoutSec))
    ? Number(args.llmTimeoutSec) * 1000
    : 0;

  let index = 0;
  for (const chunk of chunks) {
    index += 1;
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log(`Chunk ${index}/${chunks.length} (tokens ~${chunk.tokenEstimate})`);
    }
    const result = await extractFactsFromChunk(chunk, {
      enableLlm,
      game,
      sourceType,
      model,
      policy,
      timeoutMs,
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
      extracted.push(...result.facts.map((fact) => ({ ...fact, sourceType })));
    }
  }

  const normalized = normalizeFactList(extracted, policy);
  const diagnostics = {
    chunks: chunks.length,
    extracted: extracted.length,
    kept: normalized.facts.length,
    dropped: normalized.dropped,
    dropReasons: normalized.dropReasons,
    dedupe: {
      exactDropped: normalized.exactDeduped || 0,
      nearDuplicateMarked: normalized.nearDuplicateMarked || 0
    },
    llmEnabled: enableLlm,
    policyLoaded: policyInfo.loaded,
    policyPath: policyInfo.path,
    chunkDiagnostics: extractionDiagnostics
  };
  const output = {
    game,
    sourceType,
    sourceUrlHost: sourceUrlHost || null,
    extractedAt: new Date().toISOString(),
    facts: normalized.facts,
    diagnostics
  };

  if (args.dryRun) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const outPath = buildOutputPath(game, args.out);
  ensureDir(outPath);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  // eslint-disable-next-line no-console
  console.log(`Saved facts to ${outPath}`);

  if (args.diagOut) {
    const diagOutPath = path.resolve(args.diagOut);
    if (args.diagPurgeDays) {
      const purgeDays = Number(args.diagPurgeDays);
      if (Number.isFinite(purgeDays)) purgeOldFiles(path.dirname(diagOutPath), purgeDays);
    }
    ensureDir(diagOutPath);
    const diagPayload = {
      game,
      sourceType,
      sourceUrlHost: sourceUrlHost || null,
      extractedAt: output.extractedAt,
      diagnostics
    };
    fs.writeFileSync(diagOutPath, JSON.stringify(diagPayload, null, 2));
    // eslint-disable-next-line no-console
    console.log(`Saved diagnostics to ${diagOutPath}`);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
