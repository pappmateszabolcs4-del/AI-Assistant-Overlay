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

function buildCoreText(fact) {
  const core = fact && fact.mechanicCore ? fact.mechanicCore : null;
  if (!core || !core.partial) return '';
  if (core.coreText) return `Core: ${core.coreText}`;
  const entities = Array.isArray(core.entities) ? core.entities.join(', ') : '';
  return [
    entities ? `Entities: ${entities}` : '',
    core.hasCondition ? 'Condition: yes' : '',
    core.hasEffect ? 'Effect: yes' : '',
    core.stateTransition ? 'Transition: yes' : '',
    core.constraint ? 'Constraint: yes' : '',
    core.downstream ? 'Downstream: yes' : ''
  ].filter(Boolean).join(' | ');
}

function computeCoreOverlap(coreA, coreB) {
  if (!coreA || !coreB) return 0;
  const entitiesA = new Set(Array.isArray(coreA.entities) ? coreA.entities : []);
  const entitiesB = new Set(Array.isArray(coreB.entities) ? coreB.entities : []);
  let entityOverlap = 0;
  for (const entity of entitiesA) {
    if (entitiesB.has(entity)) entityOverlap += 1;
  }
  const entityUnion = entitiesA.size + entitiesB.size - entityOverlap;
  const entityScore = entityUnion ? entityOverlap / entityUnion : 0;
  const flags = ['hasCondition', 'hasEffect', 'stateTransition', 'constraint', 'downstream'];
  let sharedFlags = 0;
  let totalFlags = 0;
  for (const flag of flags) {
    const aVal = !!coreA[flag];
    const bVal = !!coreB[flag];
    if (aVal || bVal) totalFlags += 1;
    if (aVal && bVal) sharedFlags += 1;
  }
  const flagScore = totalFlags ? sharedFlags / totalFlags : 0;
  return Math.min(1, (entityScore * 0.6) + (flagScore * 0.4));
}

function computeMechanicShapeOverlap(groundingA, groundingB) {
  const shapeA = groundingA && groundingA.mechanicShape ? groundingA.mechanicShape : null;
  const shapeB = groundingB && groundingB.mechanicShape ? groundingB.mechanicShape : null;
  if (!shapeA || !shapeB) return 0;
  const keys = [
    'hasCondition',
    'hasEffect',
    'stateTransition',
    'downstreamImpact',
    'constraintChain',
    'failureConstraint'
  ];
  let total = 0;
  let shared = 0;
  for (const key of keys) {
    const aVal = !!shapeA[key];
    const bVal = !!shapeB[key];
    if (aVal || bVal) total += 1;
    if (aVal && bVal) shared += 1;
  }
  return total ? shared / total : 0;
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

function getDominantRole(cluster) {
  const counts = {};
  let total = 0;
  for (const item of cluster) {
    const roles = Array.isArray(item.fact.roleTags) ? item.fact.roleTags : [];
    if (!roles.length) continue;
    total += 1;
    for (const role of roles) {
      counts[role] = (counts[role] || 0) + 1;
    }
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length || !total) return null;
  const [role, count] = entries[0];
  const share = count / total;
  return share >= 0.7 ? { role, share: Number(share.toFixed(2)) } : null;
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
    const core = buildCoreText(fact);
    return [
      core || text,
      core ? text : '',
      systems ? `Systems: ${systems}` : '',
      families ? `Families: ${families}` : '',
      keywords ? `Keywords: ${keywords}` : ''
    ].filter(Boolean).join('\n');
  });
  const embedResult = await embedTexts(texts, options);
  if (!embedResult.ok) {
    return { facts, diagnostics: { enabled: true, skipped: true, reason: embedResult.error } };
  }

  const softThreshold = Number.isFinite(options.softThreshold) ? options.softThreshold : 0.74;
  const strongThreshold = Number.isFinite(options.strongThreshold) ? options.strongThreshold : 0.86;
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
  let representationChecks = 0;
  let representationDrift = 0;
  let tutorialVoiceMerged = 0;
  let coreMergeCount = 0;
  let coreGuardMergeCount = 0;
  let lowSimilarityCoreMergeCount = 0;
  let coreOverlapSum = 0;
  let stateTransitionOverlapCount = 0;
  let consequenceOverlapCount = 0;
  let wordingVsMechanicTotal = 0;
  const topCandidates = [];
  for (const item of items) {
    let assigned = false;
    for (const cluster of clusters) {
      const rep = cluster[0];
      const similarity = cosineSimilarity(item.embedding, rep.embedding);
      candidateChecks += 1;
      const hasSystems = systemsOverlap(item.fact.systems, rep.fact.systems);
      const hasFamilies = familiesOverlap(item.fact.mechanicFamilies, rep.fact.mechanicFamilies);
      const keywordHits = keywordOverlap(
        item.fact.keywordsNormalized || item.fact.keywords,
        rep.fact.keywordsNormalized || rep.fact.keywords
      );
      const entityOverlap = hasSystems || hasFamilies || keywordHits >= 1;
      const anchorOverlap = Boolean(item.fact._grounding && item.fact._grounding.anchor)
        && Boolean(rep.fact._grounding && rep.fact._grounding.anchor);
      const stateTransitionOverlap = Boolean(item.fact._grounding && item.fact._grounding.stateTransition)
        && Boolean(rep.fact._grounding && rep.fact._grounding.stateTransition);
      const constraintOverlap = Boolean(item.fact._grounding && item.fact._grounding.failureConstraint)
        && Boolean(rep.fact._grounding && rep.fact._grounding.failureConstraint);
      const consequenceOverlap = Boolean(item.fact._grounding && item.fact._grounding.hasEffect)
        && Boolean(rep.fact._grounding && rep.fact._grounding.hasEffect)
        && (item.fact._grounding.failureConstraint || item.fact._grounding.downstreamImpact
          || item.fact._grounding.stateTransition || item.fact._grounding.constraintChain
          || rep.fact._grounding.failureConstraint || rep.fact._grounding.downstreamImpact
          || rep.fact._grounding.stateTransition || rep.fact._grounding.constraintChain);
      const mechanicShapeOverlap = computeMechanicShapeOverlap(item.fact._grounding, rep.fact._grounding);
      const coreOverlap = computeCoreOverlap(item.fact.mechanicCore, rep.fact.mechanicCore);
      const shapeA = item.fact._grounding ? item.fact._grounding.mechanicShape : null;
      const shapeB = rep.fact._grounding ? rep.fact._grounding.mechanicShape : null;
      const shapeStrength = shapeA && shapeB
        && (shapeA.activeSignals >= 3)
        && (shapeB.activeSignals >= 3);
      const shapeCoreOverlap = mechanicShapeOverlap >= 0.5
        && shapeA && shapeB
        && shapeA.structuralCore
        && shapeB.structuralCore;
      const conditionEffectAligned = Boolean(item.fact._grounding && item.fact._grounding.hasCondition)
        && Boolean(rep.fact._grounding && rep.fact._grounding.hasCondition)
        && Boolean(item.fact._grounding && item.fact._grounding.hasEffect)
        && Boolean(rep.fact._grounding && rep.fact._grounding.hasEffect);
      const mechanicScore = Math.min(1,
        (entityOverlap ? 0.35 : 0)
        + (stateTransitionOverlap ? 0.2 : 0)
        + (consequenceOverlap ? 0.2 : 0)
        + (constraintOverlap ? 0.2 : 0)
        + (mechanicShapeOverlap >= 0.5 ? 0.15 : 0)
        + (shapeStrength ? 0.1 : 0)
        + (conditionEffectAligned ? 0.1 : 0)
        + (coreOverlap >= 0.4 ? 0.2 : 0)
      );
      const structuralOverlap = consequenceOverlap || stateTransitionOverlap || constraintOverlap;
      const mechanicGuard = anchorOverlap
        && (mechanicScore >= 0.65 || (shapeCoreOverlap && structuralOverlap) || coreOverlap >= 0.5);
      const similarityFloor = mechanicGuard ? (softThreshold - 0.12) : softThreshold;
      if (similarity < similarityFloor) {
        rejectReasons.belowSoftThreshold += 1;
        pushTopCandidates(topCandidates, {
          similarity,
          accepted: false,
          reason: 'below-soft-threshold',
          systemsOverlap: hasSystems,
          familyOverlap: hasFamilies,
          keywordOverlap: keywordHits,
          anchorOverlap,
          consequenceOverlap,
          constraintOverlap,
          stateTransitionOverlap,
          shapeCoreOverlap,
          coreOverlap: Number(coreOverlap.toFixed(2)),
          mechanicShapeOverlap: Number(mechanicShapeOverlap.toFixed(2)),
          mechanicScore: Number(mechanicScore.toFixed(2)),
          entityOverlap,
          a: String(item.fact.text || '').slice(0, 80),
          b: String(rep.fact.text || '').slice(0, 80)
        }, diagLimit);
        continue;
      }
      const strongMatch = similarity >= strongThreshold;
      if (!strongMatch
        && (!entityOverlap || (!structuralOverlap && mechanicShapeOverlap < 0.5))
        && !(anchorOverlap && structuralOverlap && similarity >= (softThreshold - 0.02))) {
        rejectReasons.noAnchorOverlap += 1;
        pushTopCandidates(topCandidates, {
          similarity,
          accepted: false,
          reason: 'no-anchor-overlap',
          systemsOverlap: hasSystems,
          familyOverlap: hasFamilies,
          keywordOverlap: keywordHits,
          anchorOverlap,
          consequenceOverlap,
          constraintOverlap,
          stateTransitionOverlap,
          shapeCoreOverlap,
          coreOverlap: Number(coreOverlap.toFixed(2)),
          mechanicShapeOverlap: Number(mechanicShapeOverlap.toFixed(2)),
          mechanicScore: Number(mechanicScore.toFixed(2)),
          entityOverlap,
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
      if (coreOverlap >= 0.4) coreMergeCount += 1;
      if (mechanicGuard) coreGuardMergeCount += 1;
      if (mechanicGuard && similarity < softThreshold) lowSimilarityCoreMergeCount += 1;
      coreOverlapSum += coreOverlap;
      if (stateTransitionOverlap) stateTransitionOverlapCount += 1;
      if (consequenceOverlap) consequenceOverlapCount += 1;
      if ((item.fact._grounding && item.fact._grounding.adviceTone)
        || (rep.fact._grounding && rep.fact._grounding.adviceTone)) {
        tutorialVoiceMerged += 1;
      }
      const repA = item.fact._grounding ? item.fact._grounding.representation : '';
      const repB = rep.fact._grounding ? rep.fact._grounding.representation : '';
      if (repA && repB) {
        representationChecks += 1;
        if (repA !== repB) representationDrift += 1;
      }
      wordingVsMechanicTotal += similarity - mechanicScore;
      pushTopCandidates(topCandidates, {
        similarity,
        accepted: true,
        reason: 'accepted',
        systemsOverlap: hasSystems,
        familyOverlap: hasFamilies,
        keywordOverlap: keywordHits,
        anchorOverlap,
        consequenceOverlap,
        constraintOverlap,
        stateTransitionOverlap,
        shapeCoreOverlap,
        coreOverlap: Number(coreOverlap.toFixed(2)),
        mechanicShapeOverlap: Number(mechanicShapeOverlap.toFixed(2)),
        mechanicScore: Number(mechanicScore.toFixed(2)),
        entityOverlap,
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
    const dominantRole = getDominantRole(cluster);
    if (cluster.length === 1) {
      const fact = cluster[0].fact;
      const roleTags = Array.isArray(fact.roleTags) ? fact.roleTags.slice() : [];
      if (dominantRole && !roleTags.includes(dominantRole.role)) roleTags.push(dominantRole.role);
      output.push({
        ...fact,
        roleTags,
        roleStability: dominantRole || null,
        canonicalClusterId: clusterId,
        canonicalRole: 'solo',
        canonicalClusterSize: 1
      });
      clusterId += 1;
      continue;
    }

    merged += cluster.length - 1;
    const { advanced, beginner } = pickRepresentatives(cluster, strongThreshold);
    if (advanced) {
      const roleTags = Array.isArray(advanced.fact.roleTags) ? advanced.fact.roleTags.slice() : [];
      if (dominantRole && !roleTags.includes(dominantRole.role)) roleTags.push(dominantRole.role);
      output.push({
        ...advanced.fact,
        roleTags,
        roleStability: dominantRole || null,
        canonicalClusterId: clusterId,
        canonicalRole: 'advanced',
        canonicalClusterSize: cluster.length
      });
    }
    if (beginner) {
      const roleTags = Array.isArray(beginner.fact.roleTags) ? beginner.fact.roleTags.slice() : [];
      if (dominantRole && !roleTags.includes(dominantRole.role)) roleTags.push(dominantRole.role);
      output.push({
        ...beginner.fact,
        roleTags,
        roleStability: dominantRole || null,
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
      semanticMergeRate: candidateChecks ? Number((accepted / candidateChecks).toFixed(3)) : 0,
      coreMergeShare: accepted ? Number((coreMergeCount / accepted).toFixed(3)) : 0,
      coreGuardMergeShare: accepted ? Number((coreGuardMergeCount / accepted).toFixed(3)) : 0,
      lowSimilarityCoreMergeShare: accepted
        ? Number((lowSimilarityCoreMergeCount / accepted).toFixed(3))
        : 0,
      avgCoreOverlap: accepted ? Number((coreOverlapSum / accepted).toFixed(3)) : 0,
      representationDriftBetweenMerged: representationChecks
        ? Number((representationDrift / representationChecks).toFixed(3))
        : 0,
      stateTransitionOverlap: accepted ? Number((stateTransitionOverlapCount / accepted).toFixed(3)) : 0,
      consequenceOverlap: accepted ? Number((consequenceOverlapCount / accepted).toFixed(3)) : 0,
      wordingVsMechanicSimilarity: accepted
        ? Number((wordingVsMechanicTotal / accepted).toFixed(3))
        : 0,
      tutorialVoiceMergedShare: accepted ? Number((tutorialVoiceMerged / accepted).toFixed(3)) : 0,
      rejectReasons,
      topCandidates
    }
  };
}

module.exports = {
  canonicalizeFacts
};