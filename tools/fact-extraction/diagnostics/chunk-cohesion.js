const { normalizeList, collectTopKeys, increment } = require('./utils');

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

module.exports = {
  buildChunkCohesionDiagnostics
};
