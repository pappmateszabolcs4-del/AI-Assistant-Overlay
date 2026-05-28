const fs = require('fs');
const path = require('path');
const { writeStableJson, writeText, formatPercent } = require('./snapshot-utils');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadThresholds(filePath) {
  return readJson(filePath);
}

function classifyDrift(delta, thresholds) {
  const abs = Math.abs(delta);
  if (abs >= thresholds.break) return 'architecture-break';
  if (abs >= thresholds.regression) return 'regression-risk';
  if (abs >= thresholds.notable) return 'notable-drift';
  if (abs >= thresholds.minor) return 'minor-drift';
  return 'stable';
}

function flattenMetrics(snapshot) {
  const flattened = {};
  const categories = snapshot.metrics || {};
  Object.keys(categories).forEach((group) => {
    const groupMetrics = categories[group] || {};
    Object.keys(groupMetrics).forEach((key) => {
      flattened[`metrics.${group}.${key}`] = groupMetrics[key];
    });
  });
  flattened['totals.facts'] = snapshot.totals.facts;
  flattened['totals.factsA'] = snapshot.totals.factsA;
  flattened['totals.factsB'] = snapshot.totals.factsB;
  return flattened;
}

function selectThreshold(metric, thresholds, value) {
  if (thresholds.metricOverrides && thresholds.metricOverrides[metric]) {
    return thresholds.metricOverrides[metric];
  }
  if (Number.isInteger(value)) return thresholds.count;
  return thresholds.ratio;
}

function compareSnapshots(baseSnapshot, currentSnapshot, thresholds) {
  const base = flattenMetrics(baseSnapshot);
  const current = flattenMetrics(currentSnapshot);
  const metrics = {};
  const levels = {
    stable: 0,
    'minor-drift': 0,
    'notable-drift': 0,
    'regression-risk': 0,
    'architecture-break': 0
  };

  Object.keys(base).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(current, key)) return;
    const before = base[key];
    const after = current[key];
    if (!Number.isFinite(before) || !Number.isFinite(after)) return;
    const delta = Number((after - before).toFixed(6));
    const thresholdSet = selectThreshold(key, thresholds, before);
    const status = classifyDrift(delta, thresholdSet);
    levels[status] += 1;
    metrics[key] = {
      before,
      after,
      delta,
      status
    };
  });

  return { metrics, levels };
}

function formatValue(key, value) {
  if (key.startsWith('metrics') && typeof value === 'number' && value <= 1) {
    return formatPercent(value);
  }
  return String(value);
}

function buildSummary(result, baseMeta, currentMeta) {
  const summary = [];
  summary.push(`# Regression Diff: ${baseMeta.label} -> ${currentMeta.label}`);
  summary.push('');
  summary.push(`Base: ${baseMeta.createdAt}`);
  summary.push(`Current: ${currentMeta.createdAt}`);
  summary.push('');
  summary.push('## Drift Summary');
  Object.entries(result.levels).forEach(([level, count]) => {
    summary.push(`- ${level}: ${count}`);
  });
  summary.push('');
  summary.push('## Notable Deltas');
  const ordered = Object.entries(result.metrics)
    .filter(([, entry]) => entry.status !== 'stable')
    .sort((a, b) => Math.abs(b[1].delta) - Math.abs(a[1].delta))
    .slice(0, 25);
  if (!ordered.length) {
    summary.push('- none');
    summary.push('');
    return summary.join('\n');
  }
  for (const [key, entry] of ordered) {
    summary.push(`- ${key}: ${formatValue(key, entry.before)} -> ${formatValue(key, entry.after)} (${entry.delta.toFixed(4)}) [${entry.status}]`);
  }
  summary.push('');
  return summary.join('\n');
}

function main() {
  const basePath = process.argv[2];
  const currentPath = process.argv[3];
  const thresholdPath = process.argv[4] || path.join(__dirname, '..', 'configs', 'thresholds.json');
  if (!basePath || !currentPath) {
    // eslint-disable-next-line no-console
    console.error('Usage: node compare-snapshots.js <base.json> <current.json> [thresholds.json]');
    process.exit(1);
  }
  const baseSnapshot = readJson(basePath);
  const currentSnapshot = readJson(currentPath);
  const thresholds = loadThresholds(thresholdPath);
  const result = compareSnapshots(baseSnapshot, currentSnapshot, thresholds);

  const diffLabel = `${baseSnapshot.meta.label}__${currentSnapshot.meta.label}`;
  const diffDir = path.join(__dirname, '..', 'diffs');
  const diffPath = path.join(diffDir, `${diffLabel}.json`);
  const summaryPath = path.join(__dirname, '..', 'summaries', `${diffLabel}.md`);
  writeStableJson(diffPath, {
    base: baseSnapshot.meta,
    current: currentSnapshot.meta,
    levels: result.levels,
    metrics: result.metrics
  });
  writeText(summaryPath, buildSummary(result, baseSnapshot.meta, currentSnapshot.meta));

  // eslint-disable-next-line no-console
  console.log(`Diff saved: ${diffPath}`);
  // eslint-disable-next-line no-console
  console.log(`Summary saved: ${summaryPath}`);
}

main();
