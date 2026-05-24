const { getTemplateShape } = require('./normalize');

function bucketize(value) {
  if (!Number.isFinite(value)) return 'unknown';
  if (value < 0.2) return '0-0.2';
  if (value < 0.4) return '0.2-0.4';
  if (value < 0.6) return '0.4-0.6';
  if (value < 0.8) return '0.6-0.8';
  return '0.8-1.0';
}

function increment(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry || '').trim()).filter(Boolean);
}

function collectTopKeys(counts, limit) {
  return Object.entries(counts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

function buildChunkCohesionDiagnostics(facts, chunkDiagnostics = [], options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : 8;
  const chunkInfo = new Map();
  const chunkMeta = new Map();

  for (const entry of chunkDiagnostics) {
    if (!entry || !entry.chunkId) continue;
    chunkMeta.set(entry.chunkId, {
      tokenEstimate: Number(entry.tokenEstimate || 0),
      headingLines: Number(entry.headingLines || 0)
    });
  }

  for (const fact of facts || []) {
    const chunkId = Number(fact._chunkId || 0);
    if (!chunkId) continue;
    if (!chunkInfo.has(chunkId)) {
      chunkInfo.set(chunkId, { facts: [] });
    }
    chunkInfo.get(chunkId).facts.push(fact);
  }

  const chunkStats = [];
  for (const [chunkId, data] of chunkInfo.entries()) {
    const factList = Array.isArray(data.facts) ? data.facts : [];
    const familyCounts = {};
    const systemCounts = {};
    const keywordCounts = {};
    let multiSystemFacts = 0;

    for (const fact of factList) {
      const families = normalizeList(fact.mechanicFamilies);
      const systems = normalizeList(fact.systems);
      const keywords = normalizeList(fact.keywordsNormalized).length
        ? normalizeList(fact.keywordsNormalized)
        : normalizeList(fact.keywords);

      for (const family of families) increment(familyCounts, family);
      for (const system of systems) increment(systemCounts, system);
      for (const keyword of keywords) increment(keywordCounts, keyword);
      if (systems.length > 1) multiSystemFacts += 1;
    }

    const dominantFamilies = collectTopKeys(familyCounts, 2);
    const dominantKeywords = collectTopKeys(keywordCounts, 3);
    let driftCount = 0;
    for (const fact of factList) {
      const families = normalizeList(fact.mechanicFamilies);
      const keywords = normalizeList(fact.keywordsNormalized).length
        ? normalizeList(fact.keywordsNormalized)
        : normalizeList(fact.keywords);

      const matchesFamily = dominantFamilies.length
        ? families.some((family) => dominantFamilies.includes(family))
        : false;
      const matchesKeyword = dominantKeywords.length
        ? keywords.some((keyword) => dominantKeywords.includes(keyword))
        : false;

      if (!matchesFamily && !matchesKeyword) driftCount += 1;
    }

    const headingLines = chunkMeta.get(chunkId) ? chunkMeta.get(chunkId).headingLines : 0;
    const headingConsistency = headingLines <= 1
      ? 1
      : Math.max(0.2, 1 / headingLines);

    chunkStats.push({
      chunkId,
      facts: factList.length,
      topicSpread: Object.keys(keywordCounts).length,
      familyDiversity: Object.keys(familyCounts).length,
      systemsSpread: Object.keys(systemCounts).length,
      headingLines,
      headingConsistency,
      crossTopicDrift: factList.length ? driftCount / factList.length : 0,
      dominantFamilies,
      dominantKeywords,
      multiSystemFacts,
      tokenEstimate: chunkMeta.get(chunkId) ? chunkMeta.get(chunkId).tokenEstimate : 0
    });
  }

  const totalChunks = chunkStats.length;
  const summary = chunkStats.reduce((acc, stat) => {
    acc.topicSpread += stat.topicSpread;
    acc.familyDiversity += stat.familyDiversity;
    acc.systemsSpread += stat.systemsSpread;
    acc.headingConsistency += stat.headingConsistency;
    acc.crossTopicDrift += stat.crossTopicDrift;
    acc.facts += stat.facts;
    acc.multiSystemFacts += stat.multiSystemFacts;
    return acc;
  }, {
    topicSpread: 0,
    familyDiversity: 0,
    systemsSpread: 0,
    headingConsistency: 0,
    crossTopicDrift: 0,
    facts: 0,
    multiSystemFacts: 0
  });

  const topChunks = chunkStats
    .slice()
    .sort((a, b) => {
      if (b.crossTopicDrift !== a.crossTopicDrift) return b.crossTopicDrift - a.crossTopicDrift;
      if (b.topicSpread !== a.topicSpread) return b.topicSpread - a.topicSpread;
      return b.familyDiversity - a.familyDiversity;
    })
    .slice(0, Math.max(1, limit));

  return {
    summary: {
      chunks: totalChunks,
      avgTopicSpread: totalChunks ? summary.topicSpread / totalChunks : 0,
      avgFamilyDiversity: totalChunks ? summary.familyDiversity / totalChunks : 0,
      avgSystemsSpread: totalChunks ? summary.systemsSpread / totalChunks : 0,
      avgHeadingConsistency: totalChunks ? summary.headingConsistency / totalChunks : 0,
      avgCrossTopicDrift: totalChunks ? summary.crossTopicDrift / totalChunks : 0,
      avgFactsPerChunk: totalChunks ? summary.facts / totalChunks : 0,
      multiSystemFactShare: summary.facts ? summary.multiSystemFacts / summary.facts : 0
    },
    topChunks
  };
}

function buildQualityDiagnostics(facts) {
  const priority = { P1: 0, P2: 0, P3: 0 };
  const families = {};
  const systems = { single: 0, multi: 0, none: 0 };
  const obviousness = {};
  const novelty = {};
  const templateShapes = {};
  const timeBound = { yes: 0, no: 0 };
  const evergreen = { yes: 0, no: 0 };
  const layers = { A: 0, B: 0, unknown: 0 };
  const layerADepth = {
    total: 0,
    depthAvg: 0,
    depthHighShare: 0,
    chainSignalShare: 0,
    emergentSignalShare: 0,
    spreadSignalShare: 0,
    shallowVsDeepRatio: 0
  };
  const grounding = {
    total: 0,
    implicationTotal: 0,
    anchorCoverage: 0,
    anchorTextShare: 0,
    anchorLocalShare: 0,
    groundedImplicationShare: 0,
    syntheticNarrationShare: 0,
    adviceToneShare: 0,
    adviceToneUnanchoredShare: 0,
    recommendationStyleShare: 0,
    mechanicFirstShare: 0,
    proceduralShare: 0,
    downstreamImpactShare: 0,
    stateTransitionShare: 0,
    constraintChainShare: 0,
    recoveredImplicationShare: 0,
    transformedShare: 0,
    representationShares: {
      extractive: 0,
      inferred: 0,
      compressed: 0,
      transformed: 0,
      synthetic: 0
    },
    failureConstraintShare: 0,
    explicitImplicationShare: 0,
    inferredImplicationShare: 0,
    extractiveShare: 0,
    localGroundedShare: 0,
    syntheticShare: 0,
    recommendationVsMechanicRatio: 0,
    implicationRecoveryRate: 0,
    demotionReasons: {
      missingAnchor: 0,
      syntheticNarration: 0,
      adviceTone: 0
    },
    byLayer: {
      A: { total: 0, adviceTone: 0, mechanicFirst: 0, failureConstraint: 0, explicitImplication: 0, inferredImplication: 0, procedural: 0 },
      B: { total: 0, adviceTone: 0, mechanicFirst: 0, failureConstraint: 0, explicitImplication: 0, inferredImplication: 0, procedural: 0 }
    }
  };
  const keywordAnchors = {};

  for (const fact of facts) {
    if (fact.priority === 3) priority.P1 += 1;
    else if (fact.priority === 2) priority.P2 += 1;
    else priority.P3 += 1;

    const familyList = Array.isArray(fact.mechanicFamilies) ? fact.mechanicFamilies : [];
    for (const family of familyList) {
      increment(families, family);
    }

    const systemList = Array.isArray(fact.systems) ? fact.systems : [];
    if (!systemList.length) systems.none += 1;
    else if (systemList.length === 1) systems.single += 1;
    else systems.multi += 1;

    increment(obviousness, bucketize(fact.obviousness));
    increment(novelty, bucketize(fact.noveltyScore));

    const shape = getTemplateShape(String(fact.text || '').toLowerCase());
    if (shape) increment(templateShapes, shape);

    if (fact.evergreen) evergreen.yes += 1;
    else evergreen.no += 1;

    if (fact.layer === 'A') layers.A += 1;
    else if (fact.layer === 'B') layers.B += 1;
    else layers.unknown += 1;

    if (fact.layer === 'A') {
      layerADepth.total += 1;
      const depth = Number.isFinite(fact.systemicDepth) ? fact.systemicDepth : 0;
      layerADepth.depthAvg += depth;
      if (depth >= 0.5) layerADepth.depthHighShare += 1;
      const depthSignals = Array.isArray(fact.depthSignals) ? fact.depthSignals : [];
      if (depthSignals.includes('chain')) layerADepth.chainSignalShare += 1;
      if (depthSignals.includes('emergent')) layerADepth.emergentSignalShare += 1;
      if (depthSignals.includes('spread')) layerADepth.spreadSignalShare += 1;
      const roleTags = Array.isArray(fact.roleTags) ? fact.roleTags : [];
      if (roleTags.includes('workflow') && !roleTags.includes('gameplay_implication') && depth === 0) {
        layerADepth.shallowVsDeepRatio += 1;
      }
    }

    if (fact.layer === 'A' || fact.layer === 'B') {
      const layerKey = fact.layer === 'A' ? 'A' : 'B';
      grounding.byLayer[layerKey].total += 1;
      const groundingInfo = fact._grounding || {};
      if (groundingInfo.adviceTone) grounding.byLayer[layerKey].adviceTone += 1;
      if (groundingInfo.hasCondition && groundingInfo.hasEffect && groundingInfo.anchor) {
        grounding.byLayer[layerKey].mechanicFirst += 1;
      }
      if (groundingInfo.failureConstraint) grounding.byLayer[layerKey].failureConstraint += 1;
      if (groundingInfo.procedural) grounding.byLayer[layerKey].procedural += 1;
      if (groundingInfo.anchorScope === 'text') grounding.byLayer[layerKey].explicitImplication += 1;
      if (groundingInfo.anchorScope === 'local') grounding.byLayer[layerKey].inferredImplication += 1;
    }

    if (fact.layer === 'A') {
      grounding.total += 1;
      const roleTags = Array.isArray(fact.roleTags) ? fact.roleTags : [];
      const groundingInfo = fact._grounding || {};
      if (groundingInfo.anchor) grounding.anchorCoverage += 1;
      if (groundingInfo.anchorScope === 'text') grounding.anchorTextShare += 1;
      if (groundingInfo.anchorScope === 'local') grounding.anchorLocalShare += 1;
      if (groundingInfo.hasCondition && groundingInfo.hasEffect && groundingInfo.anchor) {
        grounding.mechanicFirstShare += 1;
      }
      if (groundingInfo.adviceTone) {
        grounding.adviceToneShare += 1;
        if (!groundingInfo.anchor) grounding.adviceToneUnanchoredShare += 1;
      }
      if (groundingInfo.procedural) grounding.proceduralShare += 1;
      if (groundingInfo.downstreamImpact) grounding.downstreamImpactShare += 1;
      if (groundingInfo.stateTransition) grounding.stateTransitionShare += 1;
      if (groundingInfo.constraintChain) grounding.constraintChainShare += 1;
      if (groundingInfo.recoveredImplication) grounding.recoveredImplicationShare += 1;
      if (groundingInfo.transformed) grounding.transformedShare += 1;
      if (groundingInfo.representation && grounding.representationShares[groundingInfo.representation] !== undefined) {
        grounding.representationShares[groundingInfo.representation] += 1;
      }
      if (groundingInfo.failureConstraint) grounding.failureConstraintShare += 1;
      if (roleTags.includes('gameplay_implication')) {
        grounding.implicationTotal += 1;
        if (groundingInfo.anchor) grounding.groundedImplicationShare += 1;
        if (!groundingInfo.anchor && groundingInfo.syntheticNarration) {
          grounding.syntheticNarrationShare += 1;
        }
        if (groundingInfo.anchorScope === 'text') {
          grounding.extractiveShare += 1;
          grounding.explicitImplicationShare += 1;
        } else if (groundingInfo.anchorScope === 'local') {
          grounding.localGroundedShare += 1;
          grounding.inferredImplicationShare += 1;
        }
        else grounding.syntheticShare += 1;
      }
      if (groundingInfo.demotionReason === 'missing-anchor') {
        grounding.demotionReasons.missingAnchor += 1;
      }
      if (groundingInfo.demotionReason === 'advice-tone') {
        grounding.demotionReasons.adviceTone += 1;
      }
      if (groundingInfo.syntheticNarration && !groundingInfo.anchor) {
        grounding.demotionReasons.syntheticNarration += 1;
      }
    }

    const normalizedKeywords = Array.isArray(fact.keywordsNormalized) ? fact.keywordsNormalized : [];
    for (const keyword of normalizedKeywords) {
      increment(keywordAnchors, keyword);
    }

    const textLower = String(fact.text || '').toLowerCase();
    if (textLower.match(/\b\d{4}\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b|\bseason(al)?\b|\bpatch\s*\d+(\.\d+)*\b|\bversion\s*\d+(\.\d+)*\b|\bupdate\s*\d+(\.\d+)*\b|\brelease\b[^.]{0,20}\b(schedule|window|date)\b|\brollout\b|\bavailability\b[^.]{0,20}\b(window|period)\b|\bevent\b[^.]{0,20}\b(window|period|schedule|timing)\b|\bpromotion\b/)) {
      timeBound.yes += 1;
    } else {
      timeBound.no += 1;
    }
  }

  const topTemplateShapes = Object.entries(templateShapes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([shape, count]) => ({ shape, count }));

  if (layerADepth.total) {
    layerADepth.depthAvg = Number((layerADepth.depthAvg / layerADepth.total).toFixed(3));
    layerADepth.depthHighShare = Number((layerADepth.depthHighShare / layerADepth.total).toFixed(3));
    layerADepth.chainSignalShare = Number((layerADepth.chainSignalShare / layerADepth.total).toFixed(3));
    layerADepth.emergentSignalShare = Number((layerADepth.emergentSignalShare / layerADepth.total).toFixed(3));
    layerADepth.spreadSignalShare = Number((layerADepth.spreadSignalShare / layerADepth.total).toFixed(3));
    layerADepth.shallowVsDeepRatio = Number((layerADepth.shallowVsDeepRatio / layerADepth.total).toFixed(3));
  }

  if (grounding.total) {
    grounding.anchorCoverage = Number((grounding.anchorCoverage / grounding.total).toFixed(3));
    grounding.anchorTextShare = Number((grounding.anchorTextShare / grounding.total).toFixed(3));
    grounding.anchorLocalShare = Number((grounding.anchorLocalShare / grounding.total).toFixed(3));
    grounding.adviceToneShare = Number((grounding.adviceToneShare / grounding.total).toFixed(3));
    grounding.adviceToneUnanchoredShare = Number((grounding.adviceToneUnanchoredShare / grounding.total).toFixed(3));
    grounding.recommendationStyleShare = grounding.adviceToneShare;
    grounding.mechanicFirstShare = Number((grounding.mechanicFirstShare / grounding.total).toFixed(3));
    grounding.proceduralShare = Number((grounding.proceduralShare / grounding.total).toFixed(3));
    grounding.downstreamImpactShare = Number((grounding.downstreamImpactShare / grounding.total).toFixed(3));
    grounding.stateTransitionShare = Number((grounding.stateTransitionShare / grounding.total).toFixed(3));
    grounding.constraintChainShare = Number((grounding.constraintChainShare / grounding.total).toFixed(3));
    grounding.recoveredImplicationShare = Number((grounding.recoveredImplicationShare / grounding.total).toFixed(3));
    grounding.transformedShare = Number((grounding.transformedShare / grounding.total).toFixed(3));
    Object.keys(grounding.representationShares).forEach((key) => {
      grounding.representationShares[key] = Number((grounding.representationShares[key] / grounding.total).toFixed(3));
    });
    grounding.failureConstraintShare = Number((grounding.failureConstraintShare / grounding.total).toFixed(3));
    grounding.recommendationVsMechanicRatio = grounding.mechanicFirstShare
      ? Number((grounding.recommendationStyleShare / grounding.mechanicFirstShare).toFixed(3))
      : 0;
  }
  if (grounding.implicationTotal) {
    grounding.groundedImplicationShare = Number((grounding.groundedImplicationShare / grounding.implicationTotal).toFixed(3));
    grounding.syntheticNarrationShare = Number((grounding.syntheticNarrationShare / grounding.implicationTotal).toFixed(3));
    grounding.extractiveShare = Number((grounding.extractiveShare / grounding.implicationTotal).toFixed(3));
    grounding.localGroundedShare = Number((grounding.localGroundedShare / grounding.implicationTotal).toFixed(3));
    grounding.syntheticShare = Number((grounding.syntheticShare / grounding.implicationTotal).toFixed(3));
    grounding.explicitImplicationShare = Number((grounding.explicitImplicationShare / grounding.implicationTotal).toFixed(3));
    grounding.inferredImplicationShare = Number((grounding.inferredImplicationShare / grounding.implicationTotal).toFixed(3));
    grounding.implicationRecoveryRate = Number((grounding.recoveredImplicationShare / grounding.implicationTotal).toFixed(3));
  }
  ['A', 'B'].forEach((key) => {
    const entry = grounding.byLayer[key];
    if (!entry.total) return;
    entry.adviceTone = Number((entry.adviceTone / entry.total).toFixed(3));
    entry.mechanicFirst = Number((entry.mechanicFirst / entry.total).toFixed(3));
    entry.failureConstraint = Number((entry.failureConstraint / entry.total).toFixed(3));
    entry.explicitImplication = Number((entry.explicitImplication / entry.total).toFixed(3));
    entry.inferredImplication = Number((entry.inferredImplication / entry.total).toFixed(3));
    entry.procedural = Number((entry.procedural / entry.total).toFixed(3));
  });

  return {
    priority,
    families,
    systems,
    obviousness,
    novelty,
    topTemplateShapes,
    timeBound,
    evergreen,
    layers,
    layerADepth,
    grounding,
    keywordAnchors
  };
}

module.exports = {
  buildQualityDiagnostics,
  buildChunkCohesionDiagnostics
};
