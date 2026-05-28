const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildSnapshot, writeSnapshotFiles, loadInputs } = require('./build-snapshot');

function logStage(message) {
  // eslint-disable-next-line no-console
  console.log(`[STAGE] ${message}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildArgs(config) {
  const args = [
    '--seed', config.seed,
    '--game', config.game,
    '--sourceType', config.sourceType
  ];
  const extra = config.args || {};
  Object.entries(extra).forEach(([key, value]) => {
    if (value === false || value === null || value === undefined) return;
    if (value === true) {
      args.push(`--${key}`);
      return;
    }
    args.push(`--${key}`, String(value));
  });
  if (config.outDir) {
    args.push('--outDir', config.outDir);
  }
  return args;
}

function runNeighborhood(config) {
  const scriptPath = path.join(__dirname, '..', '..', 'neighborhood-run.js');
  const args = buildArgs(config);
  logStage(`enter RUN_NEIGHBORHOOD seed=${config.seed} game=${config.game}`);
  const result = spawnSync('node', [scriptPath, ...args], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`neighborhood-run failed (${result.status})`);
  }
  logStage('exit RUN_NEIGHBORHOOD');
}

function resolveOutputPaths(config) {
  const outDir = config.outDir
    ? path.resolve(process.cwd(), config.outDir)
    : path.join(process.cwd(), 'out', 'neighborhood');
  const gameDir = path.join(outDir, config.game);
  return {
    diagnostics: path.join(gameDir, 'package', 'diagnostics.json'),
    allFacts: path.join(gameDir, 'package', 'all-facts.json')
  };
}

function main() {
  const configPath = process.argv[2];
  const label = process.argv[3];
  if (!configPath || !label) {
    // eslint-disable-next-line no-console
    console.error('Usage: node run-neighborhood-snapshot.js <config.json> <label>');
    process.exit(1);
  }

  const config = readJson(configPath);
  runNeighborhood(config);

  logStage('enter SNAPSHOT_LOAD_INPUTS');
  const paths = resolveOutputPaths(config);
  const inputs = loadInputs(paths);
  logStage('exit SNAPSHOT_LOAD_INPUTS');

  logStage('enter SNAPSHOT_BUILD');
  const snapshot = buildSnapshot({
    diagnostics: inputs.diagnostics,
    totals: inputs.totals,
    meta: {
      label,
      seed: config.seed,
      game: config.game,
      sourceType: config.sourceType,
      configName: config.name || path.basename(configPath),
      createdAt: new Date().toISOString()
    }
  });
  logStage('exit SNAPSHOT_BUILD');

  logStage('enter SNAPSHOT_WRITE');
  const outputDir = path.join(__dirname, '..');
  const output = writeSnapshotFiles(snapshot, outputDir);
  logStage('exit SNAPSHOT_WRITE');
  // eslint-disable-next-line no-console
  console.log(`Snapshot saved: ${output.snapshotPath}`);
  // eslint-disable-next-line no-console
  console.log(`Summary saved: ${output.summaryPath}`);
}

main();
