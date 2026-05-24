const OpenAI = require('openai');
const keytar = require('keytar');

let cachedClient = null;

function getClient(apiKey, baseUrl) {
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({ apiKey, baseURL: baseUrl || undefined });
  return cachedClient;
}

async function resolveApiKey(options = {}) {
  const service = String(options.keytarService || 'AIGameAssistant').trim();
  const account = String(options.keytarAccount || 'openai-api-key').trim();
  if (service && account) {
    const stored = await keytar.getPassword(service, account);
    if (stored) return stored;
  }
  if (options.allowEnv) {
    const envKey = process.env.OPENAI_API_KEY || '';
    if (envKey) return envKey;
  }
  return '';
}

function normalizeKeywordList(value) {
  const list = Array.isArray(value) ? value : [];
  const out = new Set();
  for (const item of list) {
    const normalized = String(item || '').trim().toLowerCase();
    if (normalized) out.add(normalized);
  }
  return out;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function systemsOverlap(a, b) {
  const listA = Array.isArray(a) ? a : [];
  const listB = Array.isArray(b) ? b : [];
  if (!listA.length || !listB.length) return false;
  const setB = new Set(listB);
  for (const item of listA) {
    if (setB.has(item)) return true;
  }
  return false;
}

function familiesOverlap(a, b) {
  const listA = Array.isArray(a) ? a : [];
  const listB = Array.isArray(b) ? b : [];
  if (!listA.length || !listB.length) return false;
  const setB = new Set(listB);
  for (const item of listA) {
    if (setB.has(item)) return true;
  }
  return false;
}

function keywordOverlap(a, b) {
  const setA = normalizeKeywordList(a);
  const setB = normalizeKeywordList(b);
  if (!setA.size || !setB.size) return 0;
  let overlap = 0;
  for (const item of setA) {
    if (setB.has(item)) overlap += 1;
  }
  return overlap;
}

function pushTopCandidates(list, item, limit) {
  if (!limit) return;
  list.push(item);
  list.sort((a, b) => b.similarity - a.similarity);
  if (list.length > limit) list.length = limit;
}

function scoreAdvanced(fact) {
  const novelty = Number.isFinite(fact.noveltyScore) ? fact.noveltyScore : 0.5;
  const obvious = Number.isFinite(fact.obviousness) ? fact.obviousness : 0.5;
  const interaction = Number.isFinite(fact.interactionCount)
    ? fact.interactionCount
    : (Array.isArray(fact.systems) ? fact.systems.length : 0);
  const priority = Number.isFinite(fact.priority) ? fact.priority : 2;
  return (priority * 0.6) + novelty - obvious + Math.min(0.4, interaction * 0.1);
}

function scoreBeginner(fact) {
  const obvious = Number.isFinite(fact.obviousness) ? fact.obviousness : 0.5;
  const novelty = Number.isFinite(fact.noveltyScore) ? fact.noveltyScore : 0.5;
  const priority = Number.isFinite(fact.priority) ? fact.priority : 2;
  return (3 - priority) + obvious - (novelty * 0.5);
}

function pickRepresentatives(cluster, strongThreshold) {
  const sorted = [...cluster].sort((a, b) => scoreAdvanced(b.fact) - scoreAdvanced(a.fact));
  const advanced = sorted[0];
  let beginner = null;
  const beginnerCandidates = cluster
    .filter((item) => item.fact.priority === 1)
    .sort((a, b) => scoreBeginner(b.fact) - scoreBeginner(a.fact));
  if (beginnerCandidates.length) {
    const candidate = beginnerCandidates[0];
    if (candidate !== advanced && candidate.similarityTo(advanced) < strongThreshold) {
      beginner = candidate;
    }
  }
  return { advanced, beginner };
}

async function embedTexts(texts, options) {
  const apiKey = await resolveApiKey(options);
  if (!apiKey) return { ok: false, error: 'missing-api-key' };
  const model = options.model || process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
  const client = getClient(apiKey, process.env.OPENAI_BASE_URL);
  const batchSize = Number.isFinite(options.batchSize) ? options.batchSize : 64;
  const embeddings = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const slice = texts.slice(i, i + batchSize);
    const response = await client.embeddings.create({ model, input: slice });
    const data = response && response.data ? response.data : [];
    for (const item of data) {
      embeddings.push(item.embedding);
    }
  }

  if (embeddings.length !== texts.length) {
    return { ok: false, error: 'embedding-count-mismatch' };
  }
  return { ok: true, embeddings, model };
}

async function canonicalizeFacts(facts, options = {}) {
  const enabled = options.enableCanonicalize !== false;
  if (!enabled) return { facts, diagnostics: { enabled: false } };
  if (!facts.length) return { facts, diagnostics: { enabled: true, clusters: 0 } };

  const texts = facts.map((fact) => {
    const text = String(fact.text || '').trim();
    const systems = Array.isArray(fact.systems) ? fact.systems.slice(0, 4).join(', ') : '';
    const families = Array.isArray(fact.mechanicFamilies) ? fact.mechanicFamilies.slice(0, 4).join(', ') : '';
    const keywordsSource = Array.isArray(fact.keywordsNormalized) ? fact.keywordsNormalized : fact.keywords;
    const keywords = Array.isArray(keywordsSource) ? keywordsSource.slice(0, 6).join(', ') : '';
    return [
      text,
      systems ? `Systems: ${systems}` : '',
      families ? `Families: ${families}` : '',
      keywords ? `Keywords: ${keywords}` : ''
    ].filter(Boolean).join('\n');
  });
  const embedResult = await embedTexts(texts, options);
  if (!embedResult.ok) {
    return { facts, diagnostics: { enabled: true, skipped: true, reason: embedResult.error } };
  }

    const softThreshold = Number.isFinite(options.softThreshold) ? options.softThreshold : 0.78;
  const strongThreshold = Number.isFinite(options.strongThreshold) ? options.strongThreshold : 0.9;
  const diagLimit = Number.isFinite(options.diagLimit) ? options.diagLimit : 5;

  const items = facts.map((fact, index) => ({
    fact,
    embedding: embedResult.embeddings[index]
  }));

  const clusters = [];
  const rejectReasons = {
    belowSoftThreshold: 0,
    noAnchorOverlap: 0
  };
  let candidateChecks = 0;
  let accepted = 0;
  let acceptedStrongNoAnchor = 0;
  const topCandidates = [];
  for (const item of items) {
    let assigned = false;
    for (const cluster of clusters) {
      const rep = cluster[0];
      const similarity = cosineSimilarity(item.embedding, rep.embedding);
      candidateChecks += 1;
      if (similarity < softThreshold) {
        rejectReasons.belowSoftThreshold += 1;
        pushTopCandidates(topCandidates, {
          similarity,
          accepted: false,
          reason: 'below-soft-threshold',
          systemsOverlap: false,
          familyOverlap: false,
          keywordOverlap: 0,
          a: String(item.fact.text || '').slice(0, 80),
          b: String(rep.fact.text || '').slice(0, 80)
        }, diagLimit);
        continue;
      }
      const hasSystems = systemsOverlap(item.fact.systems, rep.fact.systems);
      const hasFamilies = familiesOverlap(item.fact.mechanicFamilies, rep.fact.mechanicFamilies);
      const keywordHits = keywordOverlap(
        item.fact.keywordsNormalized || item.fact.keywords,
        rep.fact.keywordsNormalized || rep.fact.keywords
      );
      const strongMatch = similarity >= strongThreshold;
      if (!strongMatch && !hasSystems && !hasFamilies && keywordHits < 1) {
        rejectReasons.noAnchorOverlap += 1;
        pushTopCandidates(topCandidates, {
          similarity,
          accepted: false,
          reason: 'no-anchor-overlap',
          systemsOverlap: hasSystems,
          familyOverlap: hasFamilies,
          keywordOverlap: keywordHits,
          a: String(item.fact.text || '').slice(0, 80),
          b: String(rep.fact.text || '').slice(0, 80)
        }, diagLimit);
        continue;
      }
      cluster.push({
        ...item,
        similarityTo: (other) => cosineSimilarity(item.embedding, other.embedding)
      });
      if (strongMatch && !hasSystems && !hasFamilies && keywordHits < 1) {
        acceptedStrongNoAnchor += 1;
      }
      accepted += 1;
      pushTopCandidates(topCandidates, {
        similarity,
        accepted: true,
        reason: 'accepted',
        systemsOverlap: hasSystems,
        familyOverlap: hasFamilies,
        keywordOverlap: keywordHits,
        a: String(item.fact.text || '').slice(0, 80),
        b: String(rep.fact.text || '').slice(0, 80)
      }, diagLimit);
      assigned = true;
      break;
    }
    if (!assigned) {
      clusters.push([{ ...item, similarityTo: (other) => cosineSimilarity(item.embedding, other.embedding) }]);
    }
  }

  let merged = 0;
  let retainedBeginner = 0;
  const output = [];
  let clusterId = 1;
  for (const cluster of clusters) {
    if (cluster.length === 1) {
      const fact = cluster[0].fact;
      output.push({ ...fact, canonicalClusterId: clusterId, canonicalRole: 'solo', canonicalClusterSize: 1 });
      clusterId += 1;
      continue;
    }

    merged += cluster.length - 1;
    const { advanced, beginner } = pickRepresentatives(cluster, strongThreshold);
    if (advanced) {
      output.push({
        ...advanced.fact,
        canonicalClusterId: clusterId,
        canonicalRole: 'advanced',
        canonicalClusterSize: cluster.length
      });
    }
    if (beginner) {
      output.push({
        ...beginner.fact,
        canonicalClusterId: clusterId,
        canonicalRole: 'beginner',
        canonicalClusterSize: cluster.length
      });
      retainedBeginner += 1;
    }
    clusterId += 1;
  }

  return {
    facts: output,
    diagnostics: {
      enabled: true,
      model: embedResult.model,
      softThreshold,
      strongThreshold,
      clusters: clusters.length,
      merged,
      retainedBeginner,
      candidateChecks,
      accepted,
      acceptedStrongNoAnchor,
      rejectReasons,
      topCandidates
    }
  };
}

module.exports = {
  canonicalizeFacts
};