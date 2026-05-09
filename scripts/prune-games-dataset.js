const fs = require('fs');
const path = require('path');

const DATASET_PATH = path.join(__dirname, '..', 'data', 'games.json');

const MAX_ALIASES = 8;
const MAX_KEYWORDS = 12;
const MIN_ALIAS_LEN = 2;
const MAX_ALIAS_LEN = 64;
const MIN_KEYWORD_LEN = 4;
const MAX_KEYWORD_LEN = 32;

const COMMON_TERMS = new Set([
  'game', 'games', 'gaming', 'player', 'players', 'play', 'playing', 'build', 'guide', 'tips',
  'patch', 'update', 'meta', 'ranked', 'match', 'matches', 'online', 'offline', 'singleplayer',
  'multiplayer', 'co-op', 'coop', 'pvp', 'pve', 'story', 'mode', 'modes', 'level', 'levels',
  'quest', 'quests', 'mission', 'missions', 'item', 'items', 'loot', 'gear', 'weapon', 'weapons',
  'skill', 'skills', 'talent', 'talents', 'perk', 'perks', 'class', 'classes', 'boss', 'bosses'
]);

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function uniquePreserveOrder(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = normalizeKey(item);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(String(item).trim());
  }
  return result;
}

function pruneAliases(aliases) {
  const list = Array.isArray(aliases) ? aliases : [];
  const cleaned = uniquePreserveOrder(list)
    .filter((value) => value.length >= MIN_ALIAS_LEN && value.length <= MAX_ALIAS_LEN);
  return cleaned.slice(0, MAX_ALIASES);
}

function pruneKeywords(keywords) {
  const list = Array.isArray(keywords) ? keywords : [];
  const cleaned = uniquePreserveOrder(list)
    .map((value) => value.trim())
    .filter((value) => value.length >= MIN_KEYWORD_LEN && value.length <= MAX_KEYWORD_LEN)
    .filter((value) => !COMMON_TERMS.has(normalizeKey(value)));
  return cleaned.slice(0, MAX_KEYWORDS);
}

function pruneDataset(dataset) {
  const games = Array.isArray(dataset?.games) ? dataset.games : [];
  const prunedGames = games.map((game) => ({
    id: game.id,
    name: game.name,
    aliases: pruneAliases(game.aliases),
    keywords: pruneKeywords(game.keywords)
  }));

  return {
    source: dataset?.source || 'IGDB',
    generatedAt: new Date().toISOString(),
    count: prunedGames.length,
    games: prunedGames
  };
}

function main() {
  if (!fs.existsSync(DATASET_PATH)) {
    console.error(`[PRUNE] Dataset not found at ${DATASET_PATH}`);
    process.exitCode = 1;
    return;
  }

  const raw = fs.readFileSync(DATASET_PATH, 'utf8');
  const dataset = JSON.parse(raw);
  const pruned = pruneDataset(dataset);
  const json = JSON.stringify(pruned)
    .replace(/[\u2028\u2029\u0085]/g, '\\n')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  fs.writeFileSync(DATASET_PATH, json, 'utf8');
  console.log(`[PRUNE] Dataset saved to ${DATASET_PATH}`);
}

main();
