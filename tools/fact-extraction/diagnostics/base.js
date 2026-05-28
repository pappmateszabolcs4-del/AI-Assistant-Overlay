const { getTemplateShape } = require('../normalize/shared/template-shapes');
const { bucketize, increment } = require('./utils');

const TIME_BOUND_REGEX = /\b\d{4}\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b|\bseason(al)?\b|\bpatch\s*\d+(\.\d+)*\b|\bversion\s*\d+(\.\d+)*\b|\bupdate\s*\d+(\.\d+)*\b|\brelease\b[^.]{0,20}\b(schedule|window|date)\b|\brollout\b|\bavailability\b[^.]{0,20}\b(window|period)\b|\bevent\b[^.]{0,20}\b(window|period|schedule|timing)\b|\bpromotion\b/;

function initBaseDiagnostics() {
  return {
    priority: { P1: 0, P2: 0, P3: 0 },
    families: {},
    systems: { single: 0, multi: 0, none: 0 },
    obviousness: {},
    novelty: {},
    templateShapes: {},
    timeBound: { yes: 0, no: 0 },
    evergreen: { yes: 0, no: 0 },
    layers: { A: 0, B: 0, unknown: 0 },
    layerADepth: {
      total: 0,
      depthAvg: 0,
      depthHighShare: 0,
      chainSignalShare: 0,
      emergentSignalShare: 0,
      spreadSignalShare: 0,
      shallowVsDeepRatio: 0
    },
    keywordAnchors: {}
  };
}

function updateBaseDiagnostics(state, fact) {
  if (fact.priority === 3) state.priority.P1 += 1;
  else if (fact.priority === 2) state.priority.P2 += 1;
  else state.priority.P3 += 1;

  const familyList = Array.isArray(fact.mechanicFamilies) ? fact.mechanicFamilies : [];
  for (const family of familyList) {
    increment(state.families, family);
  }

  const systemList = Array.isArray(fact.systems) ? fact.systems : [];
  if (!systemList.length) state.systems.none += 1;
  else if (systemList.length === 1) state.systems.single += 1;
  else state.systems.multi += 1;

  increment(state.obviousness, bucketize(fact.obviousness));
  increment(state.novelty, bucketize(fact.noveltyScore));

  const shape = getTemplateShape(String(fact.text || '').toLowerCase());
  if (shape) increment(state.templateShapes, shape);

  if (fact.evergreen) state.evergreen.yes += 1;
  else state.evergreen.no += 1;

  if (fact.layer === 'A') state.layers.A += 1;
  else if (fact.layer === 'B') state.layers.B += 1;
  else state.layers.unknown += 1;

  if (fact.layer === 'A') {
    state.layerADepth.total += 1;
    const depth = Number.isFinite(fact.systemicDepth) ? fact.systemicDepth : 0;
    state.layerADepth.depthAvg += depth;
    if (depth >= 0.5) state.layerADepth.depthHighShare += 1;
    const depthSignals = Array.isArray(fact.depthSignals) ? fact.depthSignals : [];
    if (depthSignals.includes('chain')) state.layerADepth.chainSignalShare += 1;
    if (depthSignals.includes('emergent')) state.layerADepth.emergentSignalShare += 1;
    if (depthSignals.includes('spread')) state.layerADepth.spreadSignalShare += 1;
    const roleTags = Array.isArray(fact.roleTags) ? fact.roleTags : [];
    if (roleTags.includes('workflow') && !roleTags.includes('gameplay_implication') && depth === 0) {
      state.layerADepth.shallowVsDeepRatio += 1;
    }
  }

  const normalizedKeywords = Array.isArray(fact.keywordsNormalized) ? fact.keywordsNormalized : [];
  for (const keyword of normalizedKeywords) {
    increment(state.keywordAnchors, keyword);
  }

  const textLower = String(fact.text || '').toLowerCase();
  if (TIME_BOUND_REGEX.test(textLower)) state.timeBound.yes += 1;
  else state.timeBound.no += 1;
}

function finalizeBaseDiagnostics(state) {
  const topTemplateShapes = Object.entries(state.templateShapes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([shape, count]) => ({ shape, count }));

  if (state.layerADepth.total) {
    state.layerADepth.depthAvg = Number((state.layerADepth.depthAvg / state.layerADepth.total).toFixed(3));
    state.layerADepth.depthHighShare = Number((state.layerADepth.depthHighShare / state.layerADepth.total).toFixed(3));
    state.layerADepth.chainSignalShare = Number((state.layerADepth.chainSignalShare / state.layerADepth.total).toFixed(3));
    state.layerADepth.emergentSignalShare = Number((state.layerADepth.emergentSignalShare / state.layerADepth.total).toFixed(3));
    state.layerADepth.spreadSignalShare = Number((state.layerADepth.spreadSignalShare / state.layerADepth.total).toFixed(3));
    state.layerADepth.shallowVsDeepRatio = Number((state.layerADepth.shallowVsDeepRatio / state.layerADepth.total).toFixed(3));
  }

  return { topTemplateShapes };
}

module.exports = {
  initBaseDiagnostics,
  updateBaseDiagnostics,
  finalizeBaseDiagnostics
};
