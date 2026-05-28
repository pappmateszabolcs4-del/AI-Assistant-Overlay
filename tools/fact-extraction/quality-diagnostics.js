const { buildChunkCohesionDiagnostics } = require('./diagnostics/chunk-cohesion');
const { initBaseDiagnostics, updateBaseDiagnostics, finalizeBaseDiagnostics } = require('./diagnostics/base');
const { initGroundingDiagnostics, updateGroundingDiagnostics, finalizeGroundingDiagnostics } = require('./diagnostics/grounding');
const { initRepresentationDiagnostics, updateRepresentationDiagnostics, finalizeRepresentationDiagnostics } = require('./diagnostics/representation');
const { initCompositionDiagnostics, updateCompositionDiagnostics, finalizeCompositionDiagnostics } = require('./diagnostics/composition');
const { initCoreDiagnostics, updateCoreDiagnostics, finalizeCoreDiagnostics } = require('./diagnostics/core');
const { buildRuntimeDiagnostics } = require('./diagnostics/runtime');

function buildQualityDiagnostics(facts) {
  const base = initBaseDiagnostics();
  const grounding = initGroundingDiagnostics();
  const representationQuality = initRepresentationDiagnostics();
  const compositionDiagnostics = initCompositionDiagnostics();
  const coreDiagnostics = initCoreDiagnostics();

  for (const fact of facts) {
    updateBaseDiagnostics(base, fact);
    updateGroundingDiagnostics(grounding, fact);
    updateRepresentationDiagnostics(representationQuality, fact);
    updateCompositionDiagnostics(compositionDiagnostics, fact);
    updateCoreDiagnostics(coreDiagnostics, fact);
  }

  const { topTemplateShapes } = finalizeBaseDiagnostics(base);
  finalizeGroundingDiagnostics(grounding);
  finalizeRepresentationDiagnostics(representationQuality);
  finalizeCompositionDiagnostics(compositionDiagnostics);
  finalizeCoreDiagnostics(coreDiagnostics);

  const runtimeDiagnostics = buildRuntimeDiagnostics({
    grounding,
    representationQuality,
    compositionDiagnostics,
    coreDiagnostics
  });

  return {
    priority: base.priority,
    families: base.families,
    systems: base.systems,
    obviousness: base.obviousness,
    novelty: base.novelty,
    topTemplateShapes,
    timeBound: base.timeBound,
    evergreen: base.evergreen,
    layers: base.layers,
    layerADepth: base.layerADepth,
    grounding,
    representationQuality,
    compositionDiagnostics,
    runtimeDiagnostics,
    coreDiagnostics,
    keywordAnchors: base.keywordAnchors
  };
}

module.exports = {
  buildQualityDiagnostics,
  buildChunkCohesionDiagnostics
};
