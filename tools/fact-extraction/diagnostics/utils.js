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

module.exports = {
  bucketize,
  increment,
  normalizeList,
  collectTopKeys
};
