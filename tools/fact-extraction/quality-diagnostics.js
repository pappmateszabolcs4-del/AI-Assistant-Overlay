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

function buildQualityDiagnostics(facts) {
  const priority = { P1: 0, P2: 0, P3: 0 };
  const families = {};
  const systems = { single: 0, multi: 0, none: 0 };
  const obviousness = {};
  const novelty = {};
  const templateShapes = {};
  const timeBound = { yes: 0, no: 0 };
  const evergreen = { yes: 0, no: 0 };
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

  return {
    priority,
    families,
    systems,
    obviousness,
    novelty,
    topTemplateShapes,
    timeBound,
    evergreen,
    keywordAnchors
  };
}

module.exports = {
  buildQualityDiagnostics
};
