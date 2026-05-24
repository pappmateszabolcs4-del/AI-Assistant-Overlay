const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');
const { loadPolicy, validateSourceType, validateSourceUrl } = require('./policy');
const { fetchUrlText, fetchUrlHtml, extractArticleBody } = require('./fetch');
const { chunkText, extractHierarchicalSections, mergeSectionBudget } = require('./chunker');
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

function logVerbose(args, message) {
  if (!args || !args.verbose) return;
  // eslint-disable-next-line no-console
  console.log(message);
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

function hashId(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 12);
}

function loadState(statePath, seedUrl, game) {
  if (!fs.existsSync(statePath)) return null;
  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    if (!parsed || !parsed.seed || parsed.seed.url !== seedUrl || parsed.seed.game !== game) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function saveState(statePath, state) {
  const payload = {
    ...state,
    updatedAt: new Date().toISOString()
  };
  writeJson(statePath, payload);
}

function normalizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(value) {
  const cleaned = normalizeToken(value);
  if (!cleaned) return [];
  return cleaned.split(' ').filter((token) => token.length >= 3);
}

function slugify(value) {
  const cleaned = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  return cleaned || 'page';
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeFactKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

async function buildNeighborhoodPackage(options) {
  const {
    facts,
    seed,
    selection,
    outputs,
    skipped,
    args,
    policy
  } = options;
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
    },
    skipped: skipped || []
  };
}

function extractAnchorLinks(html, baseUrl, allowExternal) {
  const body = extractArticleBody(html);
  const anchors = [];
  const anchorPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(body)) !== null) {
    const href = decodeHtmlEntities(String(match[1] || '').trim());
    const text = decodeHtmlEntities(String(match[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
    let absolute;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch (_) {
      continue;
    }
    if (!allowExternal) {
      try {
        const baseHost = new URL(baseUrl).host;
        const targetHost = new URL(absolute).host;
        if (baseHost !== targetHost) continue;
      } catch (_) {
        continue;
      }
    }
    anchors.push({ url: absolute, text });
  }
  return anchors;
}

function isUiLinkText(text) {
  const lower = String(text || '').toLowerCase();
  if (!lower) return true;
  if (lower.length < 3) return true;
  return /\b(edit|view|history|help|portal|category|file|image|template|user|login|logout|search|home|contents|tools|navigation|special)\b/i.test(lower);
}

function isSpecialWikiUrl(urlValue) {
  try {
    const parsed = new URL(urlValue);
    const path = parsed.pathname.toLowerCase();
    if (path.includes('special:')) return true;
    if (path.includes('/special:')) return true;
    if (path.includes('/w/index.php')) {
      const title = parsed.searchParams.get('title') || '';
      if (String(title).toLowerCase().startsWith('special:')) return true;
    }
  } catch (_) {
    return false;
  }
  return false;
}

function detectLanguageCode(urlValue) {
  try {
    const parsed = new URL(urlValue);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (!parts.length) return '';
    const last = parts[parts.length - 1];
    if (/^[a-z]{2}(-[a-z]{2})?$/.test(last)) return last;
    return '';
  } catch (_) {
    return '';
  }
}

function scoreLink(anchor, seedSignals) {
  const textTokens = tokenize(anchor.text);
  const urlTokens = tokenize(anchor.url);
  const tokens = new Set(textTokens.concat(urlTokens));
  if (!tokens.size) {
    return {
      score: 0,
      detail: {
        matchedFamilies: 0,
        matchedSystems: 0,
        matchedKeywords: 0,
        matchedHeadings: 0,
        matchedHighSignal: 0,
        densityBoost: 0
      }
    };
  }
  let score = 0;
  let matchedFamilies = 0;
  let matchedSystems = 0;
  let matchedKeywords = 0;
  let matchedHeadings = 0;
  let matchedHighSignal = 0;

  for (const token of tokens) {
    if (seedSignals.families.has(token)) { score += 0.3; matchedFamilies += 1; }
    if (seedSignals.systems.has(token)) { score += 0.25; matchedSystems += 1; }
    if (seedSignals.keywords.has(token)) { score += 0.2; matchedKeywords += 1; }
    if (seedSignals.headings && seedSignals.headings.has(token)) { score += 0.15; matchedHeadings += 1; }
    if (seedSignals.highSignal && seedSignals.highSignal.has(token)) { score += 0.12; matchedHighSignal += 1; }
  }

  if (anchor.text && anchor.text.length >= 8) score += 0.05;
  if (textTokens.length >= 2) score += 0.05;

  const densityBoost = seedSignals.density
    ? Math.min(0.2, seedSignals.density / 80)
    : 0;
  score += densityBoost;

  return {
    score: Math.min(1, score),
    detail: {
      matchedFamilies,
      matchedSystems,
      matchedKeywords,
      matchedHeadings,
      matchedHighSignal,
      densityBoost: Number(densityBoost.toFixed(3))
    }
  };
}

function collectSeedSignals(facts) {
  const families = new Set();
  const systems = new Set();
  const keywords = new Set();
  const highSignal = new Set();
  const list = Array.isArray(facts) ? facts : [];
  for (const fact of list) {
    for (const family of fact.mechanicFamilies || []) {
      tokenize(family).forEach((token) => families.add(token));
    }
    for (const system of fact.systems || []) {
      tokenize(system).forEach((token) => systems.add(token));
    }
    for (const keyword of fact.keywordsNormalized || []) {
      tokenize(keyword).forEach((token) => keywords.add(token));
    }
    for (const keyword of fact.keywords || []) {
      tokenize(keyword).forEach((token) => keywords.add(token));
    }
    if (fact.layer === 'A' || (Array.isArray(fact.roleTags) && fact.roleTags.includes('gameplay_implication'))) {
      for (const family of fact.mechanicFamilies || []) {
        tokenize(family).forEach((token) => highSignal.add(token));
      }
      for (const system of fact.systems || []) {
        tokenize(system).forEach((token) => highSignal.add(token));
      }
      for (const keyword of fact.keywordsNormalized || []) {
        tokenize(keyword).forEach((token) => highSignal.add(token));
      }
    }
  }
  return { families, systems, keywords, headings: new Set(), highSignal, density: 0 };
}

async function runExtraction(text, options) {
  const { game, sourceType, policy, args } = options;
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
  const timeoutMs = Number.isFinite(Number(args.llmTimeoutSec))
    ? Number(args.llmTimeoutSec) * 1000
    : 0;

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

  let chunkIndex = 0;
  let chunkTokenTotal = 0;
  for (const chunk of chunks) {
    chunkIndex += 1;
    chunkTokenTotal += Number(chunk.tokenEstimate || 0);
    logVerbose(args, `Chunk ${chunkIndex}/${chunks.length} (tokens ~${chunk.tokenEstimate})`);
    // eslint-disable-next-line no-await-in-loop
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
      extracted.push(...result.facts.map((fact) => ({
        ...fact,
        sourceType,
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

  return {
    facts: outputFacts,
    diagnostics: {
      chunks: chunks.length,
      chunkTokenTotal,
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
      llmEnabled: enableLlm
    }
  };
}

async function runSectionIngestion(html, options) {
  const { game, sourceType, policy, args } = options;
  const rawSections = extractHierarchicalSections(html);
  const sectionMax = Number.isFinite(Number(args.sectionMaxSections)) ? Number(args.sectionMaxSections) : 60;
  const sections = mergeSectionBudget(rawSections, sectionMax);
  const sectionFacts = [];
  const sectionDiagnostics = [];

  for (const section of sections) {
    const sectionText = String(section.text || '').trim();
    if (!sectionText) continue;
    logVerbose(args, `Section: ${section.sectionPath || section.heading || 'untitled'}`);
    // eslint-disable-next-line no-await-in-loop
    const result = await runExtraction(sectionText, { game, sourceType, policy, args });
    const sectionPath = section.sectionPath || '';
    const sectionHeading = section.heading || '';
    const factsWithSection = result.facts.map((fact) => ({
      ...fact,
      sectionPath,
      sectionHeading,
      sectionId: section.sectionId,
      parentSectionId: section.parentSectionId,
      sectionDepth: section.depth
    }));
    sectionFacts.push(...factsWithSection);
    const tokenCount = section.tokenEstimate || 0;
    const density = tokenCount ? Number(((result.facts.length / tokenCount) * 1000).toFixed(3)) : 0;
    sectionDiagnostics.push({
      sectionId: section.sectionId,
      parentSectionId: section.parentSectionId,
      depth: section.depth,
      sectionPath,
      heading: sectionHeading,
      tokens: tokenCount,
      kept: result.facts.length,
      densityPer1kTokens: density,
      chunkCohesion: result.diagnostics.chunkCohesion,
      diagnostics: result.diagnostics
    });
  }

  const canonicalizeEnabled = !args.noCanonicalize;
  const allowEnv = !!args.allowEnv;
  const keytarService = args.keytarService ? String(args.keytarService).trim() : '';
  const keytarAccount = args.keytarAccount ? String(args.keytarAccount).trim() : '';
  const canonicalized = await canonicalizeFacts(sectionFacts, {
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
  const avgTokens = sections.length
    ? Number((sections.reduce((sum, sec) => sum + (sec.tokenEstimate || 0), 0) / sections.length).toFixed(2))
    : 0;
  const shortSections = sections.filter((sec) => Number(sec.tokenEstimate || 0) > 0 && Number(sec.tokenEstimate || 0) < 200).length;

  return {
    facts: deduped.facts,
    diagnostics: {
      sections: sections.length,
      sectionBudget: sectionMax,
      avgSectionTokens: avgTokens,
      shortSectionShare: sections.length ? Number((shortSections / sections.length).toFixed(3)) : 0,
      quality: buildQualityDiagnostics(deduped.facts),
      canonicalization: canonicalized.diagnostics || { enabled: false },
      sectionRuns: sectionDiagnostics
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const seedUrl = String(args.seed || args.seedUrl || '').trim();
  const game = String(args.game || '').trim();
  if (!seedUrl || !game) {
    // eslint-disable-next-line no-console
    console.error('Missing --seed and/or --game');
    process.exit(1);
  }

  const policyInfo = loadPolicy(args.policy);
  const policy = policyInfo.policy;
  const sourceTypeRaw = String(args.sourceType || 'user').trim();
  const sourceCheck = validateSourceType(sourceTypeRaw, policy);
  if (!sourceCheck.ok) {
    // eslint-disable-next-line no-console
    console.error(`Source type rejected: ${sourceCheck.error}`);
    process.exit(1);
  }
  const sourceType = sourceCheck.sourceType;

  const urlCheck = validateSourceUrl(seedUrl, policy);
  if (!urlCheck.ok) {
    // eslint-disable-next-line no-console
    console.error(`Source URL rejected: ${urlCheck.error}`);
    process.exit(1);
  }

  const maxBytes = Number.isFinite(Number(args.maxBytes)) ? Number(args.maxBytes) : undefined;
  const sectionMaxBytes = Number.isFinite(Number(args.sectionMaxBytes))
    ? Number(args.sectionMaxBytes)
    : (maxBytes ? Math.max(maxBytes, 4 * 1024 * 1024) : 4 * 1024 * 1024);
  const userAgent = args.userAgent ? String(args.userAgent) : undefined;
  const allowExternal = !!args.allowExternal;
  const maxPages = Number.isFinite(Number(args.maxPages)) ? Number(args.maxPages) : 10;
  const minScore = Number.isFinite(Number(args.minScore)) ? Number(args.minScore) : 0.12;
  const fallbackScore = Number.isFinite(Number(args.fallbackScore)) ? Number(args.fallbackScore) : 0.05;

  logVerbose(args, `Fetching seed HTML: ${urlCheck.url}`);
  const seedHtml = await fetchUrlHtml(urlCheck.url, { maxBytes, userAgent });
  logVerbose(args, 'Fetching seed text');
  const seedText = await fetchUrlText(urlCheck.url, { maxBytes, userAgent });
  logVerbose(args, 'Extracting seed facts');
  const seedResult = await runExtraction(seedText, {
    game,
    sourceType,
    policy,
    args
  });

  const seedSignals = collectSeedSignals(seedResult.facts);
  const seedSections = extractHierarchicalSections(seedHtml);
  for (const section of seedSections) {
    const heading = section.heading || '';
    tokenize(heading).forEach((token) => seedSignals.headings.add(token));
  }
  const seedTokenTotal = seedResult.diagnostics && seedResult.diagnostics.chunkTokenTotal
    ? seedResult.diagnostics.chunkTokenTotal
    : 0;
  seedSignals.density = seedTokenTotal
    ? Number(((seedResult.facts.length / seedTokenTotal) * 1000).toFixed(3))
    : 0;
  const anchors = extractAnchorLinks(seedHtml, urlCheck.url, allowExternal)
    .filter((anchor) => !isUiLinkText(anchor.text));
  const seedLang = detectLanguageCode(urlCheck.url);
  const unique = new Map();
  for (const anchor of anchors) {
    const linkLang = detectLanguageCode(anchor.url);
    if (linkLang && (!seedLang || linkLang !== seedLang)) continue;
    if (isSpecialWikiUrl(anchor.url)) continue;
    if (!unique.has(anchor.url)) unique.set(anchor.url, anchor);
  }

  const scored = Array.from(unique.values()).map((anchor) => {
    const scoredLink = scoreLink(anchor, seedSignals);
    return {
      ...anchor,
      score: Number(scoredLink.score.toFixed(3)),
      scoreDetail: scoredLink.detail
    };
  }).filter((entry) => entry.score > 0);

  scored.sort((a, b) => b.score - a.score);

  let selected = scored.filter((entry) => entry.score >= minScore);
  if (!selected.length && scored.length) {
    selected = scored.filter((entry) => entry.score >= fallbackScore).slice(0, Math.max(1, Math.min(3, maxPages)));
  }
  if (maxPages > 0 && selected.length > maxPages) {
    selected = selected.slice(0, maxPages);
  }

  const outDir = args.outDir ? path.resolve(args.outDir) : path.join(process.cwd(), 'out', 'neighborhood');
  const outputs = [];
  const combinedFacts = new Map();
  const skippedPages = [];
  for (const entry of selected) {
    logVerbose(args, `Fetching page: ${entry.url}`);
    let pageText;
    try {
      // eslint-disable-next-line no-await-in-loop
      pageText = await fetchUrlText(entry.url, { maxBytes, userAgent });
    } catch (err) {
      const reason = err && err.message ? err.message : 'error';
      if (reason === 'source-too-large') {
        logVerbose(args, `Oversized page, switching to section ingestion: ${entry.url}`);
        try {
          // eslint-disable-next-line no-await-in-loop
          const pageHtml = await fetchUrlHtml(entry.url, { maxBytes: sectionMaxBytes, userAgent });
          // eslint-disable-next-line no-await-in-loop
          const result = await runSectionIngestion(pageHtml, { game, sourceType, policy, args });
          const factsWithSource = result.facts.map((fact) => ({
            ...fact,
            sourceUrl: entry.url
          }));
          const slug = slugify(new URL(entry.url).pathname.split('/').pop());
          const outputPath = path.join(outDir, game, `${slug}.json`);
          ensureDir(outputPath);
          fs.writeFileSync(outputPath, JSON.stringify({
            game,
            sourceType,
            sourceUrl: entry.url,
            extractedAt: new Date().toISOString(),
            facts: factsWithSource,
            diagnostics: result.diagnostics
          }, null, 2));
          outputs.push({
            url: entry.url,
            linkText: entry.text,
            score: entry.score,
            outputPath,
            kept: factsWithSource.length,
            sectionIngestion: true,
            sectionDiagnostics: result.diagnostics
          });
          mergeFacts(combinedFacts, factsWithSource);
          continue;
        } catch (sectionErr) {
          const sectionReason = sectionErr && sectionErr.message ? sectionErr.message : 'error';
          logVerbose(args, `Skipping page (section ingestion failed): ${entry.url} (${sectionReason})`);
          skippedPages.push({
            url: entry.url,
            linkText: entry.text,
            score: entry.score,
            reason: `section-${sectionReason}`
          });
          continue;
        }
      }
      logVerbose(args, `Skipping page (fetch failed): ${entry.url} (${reason})`);
      skippedPages.push({
        url: entry.url,
        linkText: entry.text,
        score: entry.score,
        reason
      });
      continue;
    }
    logVerbose(args, 'Extracting page facts');
    // eslint-disable-next-line no-await-in-loop
    const result = await runExtraction(pageText, { game, sourceType, policy, args });
    const factsWithSource = result.facts.map((fact) => ({
      ...fact,
      sourceUrl: entry.url
    }));
    const slug = slugify(new URL(entry.url).pathname.split('/').pop());
    const outputPath = path.join(outDir, game, `${slug}.json`);
    ensureDir(outputPath);
    fs.writeFileSync(outputPath, JSON.stringify({
      game,
      sourceType,
      sourceUrl: entry.url,
      extractedAt: new Date().toISOString(),
      facts: factsWithSource,
      diagnostics: result.diagnostics
    }, null, 2));
    outputs.push({
      url: entry.url,
      linkText: entry.text,
      score: entry.score,
      outputPath,
      kept: result.facts.length
    });
    mergeFacts(combinedFacts, factsWithSource);
  }

  const seedFactsWithSource = seedResult.facts.map((fact) => ({
    ...fact,
    sourceUrl: urlCheck.url
  }));
  mergeFacts(combinedFacts, seedFactsWithSource);

  const report = {
    seed: {
      url: urlCheck.url,
      game,
      sourceType,
      kept: seedResult.facts.length,
      diagnostics: seedResult.diagnostics
    },
    selection: {
      candidates: scored.length,
      selected: outputs.length,
      skipped: skippedPages.length,
      maxPages,
      minScore,
      fallbackScore
    },
    selected: outputs,
    skipped: skippedPages,
    ignored: scored.slice(outputs.length).slice(0, 20)
  };

  const mergedFacts = Array.from(combinedFacts.values());
  const packagePayload = await buildNeighborhoodPackage({
    facts: mergedFacts,
    seed: report.seed,
    selection: report.selection,
    outputs,
    skipped: report.skipped,
    args,
    policy
  });
  const summary = packagePayload.summary;

  const reportPath = args.report
    ? path.resolve(args.report)
    : path.join(outDir, game, 'neighborhood-report.json');
  writeJson(reportPath, report);

  const summaryPath = path.join(outDir, game, 'neighborhood-summary.json');
  writeJson(summaryPath, summary);

  const packageDir = path.join(outDir, game, 'package');
  const allFactsPath = path.join(packageDir, 'all-facts.json');
  const diagnosticsPath = path.join(packageDir, 'diagnostics.json');
  const skippedPath = path.join(packageDir, 'skipped-pages.json');
  const pagesPath = path.join(packageDir, 'page-outputs.json');

  writeJson(allFactsPath, packagePayload.allFacts);
  writeJson(diagnosticsPath, packagePayload.diagnostics);
  writeJson(skippedPath, packagePayload.skipped || []);
  writeJson(pagesPath, outputs.map((entry) => ({
    url: entry.url,
    outputPath: entry.outputPath,
    kept: entry.kept,
    sectionIngestion: !!entry.sectionIngestion
  })));
  // eslint-disable-next-line no-console
  console.log(`Neighborhood report saved to ${reportPath}`);
  // eslint-disable-next-line no-console
  console.log(`Neighborhood summary saved to ${summaryPath}`);
  // eslint-disable-next-line no-console
  console.log(`Neighborhood package saved to ${packageDir}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
