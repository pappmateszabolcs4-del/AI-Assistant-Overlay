const { matchesBlockedPattern } = require('./policy');

const TUTORIAL_PATTERNS = [
  /\buse (the )?[^.]{1,40} menu to\b/i,
  /\butilize (the )?[^.]{1,40} menu to\b/i,
  /\bselect (the )?area\b/i,
  /\bclick (the )?[^.]{1,40}\b/i,
  /\bpress (the )?[^.]{1,40}\b/i,
  /\bopen (the )?[^.]{1,40}\b/i,
  /\bgo to (the )?[^.]{1,40}\b/i,
  /\bcreate (a )?[^.]{1,40} zone to\b/i,
  /\bdesignate (a )?[^.]{1,40} zone to\b/i,
  /\bkeep an eye on\b/i,
  /\bmake sure to\b/i,
  /\bensure you\b/i,
  /\bremember to\b/i
];

const GENERIC_PATTERNS = [
  /\bprioritize\b/i,
  /\bbalanc(e|ing)\b/i,
  /\btrade-?offs?\b/i,
  /\bis crucial\b/i,
  /\bis essential\b/i,
  /\bcan lead to\b/i,
  /\bmay lead to\b/i,
  /\bto avoid\b/i,
  /\bto prevent\b/i,
  /\boptimi[sz]e\b/i,
  /\bmanage\b/i,
  /\bmonitor\b/i,
  /\binvest\b/i,
  /\bweigh\b/i
];

const WEAK_TRADEOFF_TEMPLATES = [
  /\b(improves|increases|boosts|enhances|helps)\b[^.]{0,80}\b(but|however)\b[^.]{0,80}\b(resources?|time|power|materials?|food|energy)\b/i,
  /\b(provides|adds|gives|offers)\b[^.]{0,80}\b(but|however)\b[^.]{0,80}\b(resources?|time|power|materials?|food|energy)\b/i,
  /\ballows\b[^.]{0,80}\b(but|however)\b[^.]{0,80}\b(resources?|time|power|materials?|food|energy|risk)\b/i,
  /\b(building|constructing|using)\b[^.]{0,60}\b(costs|consumes|requires)\b[^.]{0,40}\b(resources?|time|power|materials?|food|energy)\b/i,
  /\b(defenses?|turrets?)\b[^.]{0,60}\b(costs|consumes|requires)\b[^.]{0,40}\b(resources?|time|power|materials?|food|energy)\b/i
];

const LOW_SIGNAL_PATTERNS = [
  /\barmor\b[^.]{0,40}\b(reduces|reducing)\b[^.]{0,40}\bdamage\b/i,
  /\bresearch\b[^.]{0,40}\b(unlocks?|unlocking)\b[^.]{0,40}\b(technology|tech)\b/i,
  /\bsolar\b[^.]{0,40}\b(requires|needs)\b[^.]{0,40}\bsunlight\b/i,
  /\bwalls?\b[^.]{0,40}\b(requires|needs)\b[^.]{0,40}\b(wood|stone)\b/i,
  /\b(requires|needs)\b[^.]{0,40}\b(resources?|materials?)\b/i,
  /\b(consumes|costs)\b[^.]{0,40}\b(resources?|materials?)\b/i,
  /\b(requires|needs)\b[^.]{0,40}\bcomponents?\b/i,
  /\bblocked\b[^.]{0,40}\bwithout\b[^.]{0,40}\bresources?\b/i
];

const LIVE_SERVICE_PATTERNS = [
  /\bpatch\b/i,
  /\bhotfix\b/i,
  /\bupdate\b[^.]{0,40}\bnotes?\b/i,
  /\bseason\b/i,
  /\bbattle pass\b/i,
  /\bshop\b/i,
  /\bstore\b/i,
  /\bcosmetic\b/i,
  /\bskin\b/i,
  /\bskins\b/i,
  /\brotation\b/i,
  /\bpromot(e|ion|ional)\b/i,
  /\bevent\b[^.]{0,40}\b(announcement|schedule|timing)\b/i,
  /\brelease\b[^.]{0,40}\bdate\b/i,
  /\broadmap\b/i,
  /\bpre-?order\b/i,
  /\bdlc\b/i,
  /\bmonetization\b/i
];

const WIKI_EDITORIAL_PATTERNS = [
  /\bview source\b/i,
  /\bedit (this )?page\b/i,
  /\bpage history\b/i,
  /\brecent changes\b/i,
  /\bcommunity portal\b/i,
  /\buser (talk|page)\b/i,
  /\bhelp (portal|page)\b/i,
  /\bnamespace\b/i,
  /\bcategory\b/i,
  /\bsearch\b/i,
  /\bwiki\b[^.]{0,40}\bnavigation\b/i,
  /\bmain page\b/i,
  /\brandom article\b/i,
  /\bwhat links here\b/i,
  /\bspecial pages?\b/i
];

const TIME_BOUND_PATTERNS = [
  /\b\d{4}\b/i,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  /\bseason(al)?\b/i,
  /\bpatch\s*\d+(\.\d+)*\b/i,
  /\bversion\s*\d+(\.\d+)*\b/i,
  /\bupdate\s*\d+(\.\d+)*\b/i,
  /\brelease\b[^.]{0,20}\b(schedule|window|date)\b/i,
  /\brollout\b/i,
  /\bavailability\b[^.]{0,20}\b(window|period)\b/i,
  /\bevent\b[^.]{0,20}\b(window|period|schedule|timing)\b/i,
  /\bpromotion\b/i
];

const EVERGREEN_MECHANIC_PATTERNS = [
  /\bcooldown\b/i,
  /\btradeoff\b/i,
  /\bpositioning\b/i,
  /\bline of sight\b/i,
  /\bresource\b/i,
  /\bobjective\b/i,
  /\bmovement\b/i,
  /\bcombat\b/i,
  /\bability\b/i,
  /\bsynergy\b/i,
  /\binteraction\b/i
];

const LORE_NARRATIVE_PATTERNS = [
  /\bfaction\b[^.]{0,40}\b(history|founding|origins?)\b/i,
  /\bempire\b[^.]{0,40}\b(founding|rise|fall)\b/i,
  /\bkingdom\b[^.]{0,40}\b(founding|succession|dynasty)\b/i,
  /\bpolitic(al|s)\b/i,
  /\bworldbuilding\b/i,
  /\blore\b/i,
  /\bmyth\b/i,
  /\blegend\b/i,
  /\bchronicle\b/i,
  /\bhistory\b/i
];

const GAMEPLAY_SIGNAL_PATTERNS = [
  /\bability\b/i,
  /\bskill\b/i,
  /\bcooldown\b/i,
  /\bdamage\b/i,
  /\bresource\b/i,
  /\bcombat\b/i,
  /\bweapon\b/i,
  /\barmor\b/i,
  /\bmovement\b/i,
  /\bpositioning\b/i,
  /\bobjective\b/i,
  /\btradeoff\b/i,
  /\bresearch\b/i,
  /\bcraft(ing)?\b/i,
  /\bbuild(ing)?\b/i,
  /\bquest\b/i,
  /\bloot\b/i,
  /\bcurrency\b/i
];

const NON_ACTIONABLE_PATTERNS = [
  /\bfounding\b/i,
  /\bempire\b/i,
  /\bpolitic(al|s)\b/i,
  /\bhistory\b/i,
  /\blineage\b/i,
  /\bmyth\b/i,
  /\blegend\b/i,
  /\bchronicle\b/i
];

const KEYWORD_NORMALIZATION = {
  cooldown: 'tempo_window',
  timing: 'tempo_window',
  window: 'tempo_window',
  burst: 'tempo_window',
  execute: 'tempo_window',
  rotation: 'tempo_window',
  stamina: 'tempo_window',
  los: 'information_control',
  vision: 'information_control',
  scouting: 'information_control',
  recon: 'information_control',
  intel: 'information_control',
  awareness: 'information_control',
  positioning: 'spatial_tactics',
  flanking: 'spatial_tactics',
  cover: 'spatial_tactics',
  chokepoint: 'spatial_tactics',
  objective: 'objective_control',
  capture: 'objective_control',
  tradeoff: 'risk_reward',
  opportunity: 'risk_reward',
  risk: 'risk_reward',
  reward: 'risk_reward',
  synergy: 'ability_synergy',
  combo: 'ability_synergy',
  buff: 'ability_synergy',
  debuff: 'ability_synergy'
};

const KEYWORD_FAMILY_MAP = {
  tempo_window: 'tempo_management',
  information_control: 'information_control',
  spatial_tactics: 'spatial_tactics',
  objective_control: 'objective_control',
  risk_reward: 'risk_reward',
  ability_synergy: 'ability_synergy'
};

const GAMEPLAY_IMPACT_PATTERNS = [
  /\bdamage\b/i,
  /\bcooldown\b/i,
  /\bability\b/i,
  /\bskill\b/i,
  /\bweapon\b/i,
  /\barmor\b/i,
  /\bmovement\b/i,
  /\bobjective\b/i,
  /\bmatch\b/i,
  /\braid\b/i,
  /\bresource\b/i,
  /\bpower\b/i,
  /\btradeoff\b/i
];

const GENERIC_TOKENS = new Set([
  'resource', 'resources', 'time', 'power', 'materials', 'material', 'food', 'energy',
  'defense', 'defenses', 'health', 'mood', 'risk', 'tradeoff', 'strategy', 'management',
  'efficiency', 'productivity', 'safety', 'colony', 'colonies', 'colonist', 'colonists',
  'building', 'buildings', 'research', 'system', 'mechanic', 'mechanics', 'game', 'play',
  'early', 'mid', 'late'
]);

const CANONICAL_SYSTEMS = new Set([
  'combat',
  'economy',
  'crafting',
  'research',
  'power',
  'farming',
  'food',
  'morale',
  'medicine',
  'mobility',
  'automation',
  'temperature',
  'raids',
  'trade',
  'construction',
  'resource',
  'defense',
  'abilities',
  'social',
  'exploration',
  'survival'
]);

const SYSTEM_ALIASES = {
  weapons: 'combat',
  weapon: 'combat',
  shooting: 'combat',
  melee: 'combat',
  raids: 'combat',
  electricity: 'power',
  energy: 'power',
  battery: 'power',
  batteries: 'power',
  grid: 'power',
  farming: 'farming',
  crops: 'farming',
  hydroponics: 'farming',
  agriculture: 'farming',
  food: 'food',
  cooking: 'food',
  meals: 'food',
  production: 'crafting',
  crafting: 'crafting',
  fabrication: 'crafting',
  mining: 'resource',
  resources: 'resource',
  construction: 'construction',
  building: 'construction',
  buildings: 'construction',
  medicine: 'medicine',
  medical: 'medicine',
  health: 'medicine',
  morale: 'morale',
  mood: 'morale',
  recreation: 'morale',
  movement: 'mobility',
  travel: 'mobility',
  caravan: 'mobility',
  trade: 'trade',
  economy: 'economy',
  social: 'social',
  diplomacy: 'social',
  temperature: 'temperature',
  heat: 'temperature',
  cold: 'temperature',
  abilities: 'abilities',
  psycast: 'abilities',
  psycasts: 'abilities',
  automation: 'automation',
  survival: 'survival',
  exploration: 'exploration'
};

const OBVIOUSNESS_BOOST_PATTERNS = [
  /\brequires power\b/i,
  /\bprovides power\b/i,
  /\bgenerates energy\b/i,
  /\bstores resources\b/i,
  /\bimproves defense\b/i,
  /\bincreases efficiency\b/i,
  /\bused for crafting\b/i,
  /\bhelps production\b/i
];

const RESOURCE_DEPENDENCY_PATTERNS = [
  /\brequires (steel|wood|components|materials?|resources?)\b/i,
  /\brequires components\b/i,
  /\brequires materials\b/i,
  /\bconsumes (materials?|resources?)\b/i,
  /\bblocked by lack of (materials?|resources?|components|wood|steel)\b/i,
  /\bblocked without (materials?|resources?|components|wood|steel)\b/i
];

const EMERGENT_CONSEQUENCE_PATTERNS = [
  /\breduces morale\b/i,
  /\blimits mobility\b/i,
  /\bincreases raid vulnerability\b/i,
  /\bdepletes supplies\b/i,
  /\bstrains power grid\b/i,
  /\bcreates bottlenecks\b/i,
  /\bcauses downtime\b/i,
  /\blimits night operations\b/i,
  /\bincreases maintenance burden\b/i,
  /\bblocks recovery\b/i,
  /\bweakens defenses\b/i,
  /\bcreates resource pressure\b/i,
  /\bincreases risk during raids\b/i,
  /\breduces treatment quality\b/i
];

const TRADEOFF_IMPLICATION_PATTERNS = [
  /\btradeoff\b/i,
  /\brisk\b/i,
  /\bvulnerab(le|ility)\b/i,
  /\breduces\b/i,
  /\blimits\b/i,
  /\bpenalty\b/i,
  /\bstrain(s)?\b/i,
  /\boverload(s)?\b/i,
  /\bdeplete(s|d)?\b/i,
  /\bdowntime\b/i,
  /\bslows?\b/i,
  /\bdelays?\b/i,
  /\bmorale\b/i,
  /\bmood\b/i,
  /\braid(s)?\b/i
];

const TEMPLATE_SHAPE_PATTERNS = [
  { key: 'requires_x', pattern: /\brequires\b[^.]{1,60}\b/i },
  { key: 'blocked_without', pattern: /\bblocked without\b/i },
  { key: 'blocked_by_lack', pattern: /\bblocked by lack of\b/i },
  { key: 'consumes_resources', pattern: /\bconsumes\b[^.]{1,60}\b(resources?|materials?)\b/i },
  { key: 'requires_materials', pattern: /\brequires\b[^.]{1,60}\bmaterials?\b/i },
  { key: 'requires_components', pattern: /\brequires\b[^.]{1,60}\bcomponents?\b/i }
];

const ABILITY_TEMPLATE_PATTERNS = [
  /\brequires timing\b/i,
  /\brequires positioning\b/i,
  /\brequires\b[^.]{0,40}\bto avoid\b/i,
  /\bwithout\b[^.]{0,40}\bability\b/i
];

const SPECIFICITY_BONUS_PATTERNS = [
  /\bline of sight\b/i,
  /\bpositioning\b/i,
  /\bflanking\b/i,
  /\bchokepoint\b/i,
  /\binfo(rmation)? asymmetr(y|ic)\b/i,
  /\btradeoff\b/i,
  /\bopportunity cost\b/i,
  /\bresource pressure\b/i,
  /\bcontextual\b/i,
  /\bwindow\b[^.]{0,20}\b(cooldown|timing)\b/i
];

const MECHANIC_FAMILIES = new Set([
  'power_infrastructure',
  'medical_systems',
  'food_systems',
  'defense_systems',
  'production_systems',
  'logistics_systems',
  'research_progression',
  'housing_colony',
  'morale_psychology',
  'environmental_survival',
  'economy_trade',
  'mobility_travel',
  'combat_operations',
  'automation_control',
  'resource_extraction',
  'information_control',
  'spatial_tactics',
  'tempo_management',
  'risk_reward',
  'character_progression',
  'ability_synergy',
  'stealth_detection',
  'team_coordination',
  'survivability',
  'objective_control'
]);

const FAMILY_ALIASES = {
  power: 'power_infrastructure',
  electricity: 'power_infrastructure',
  energy: 'power_infrastructure',
  battery: 'power_infrastructure',
  batteries: 'power_infrastructure',
  generator: 'power_infrastructure',
  generators: 'power_infrastructure',
  grid: 'power_infrastructure',
  hospital: 'medical_systems',
  medicine: 'medical_systems',
  medical: 'medical_systems',
  treatment: 'medical_systems',
  surgery: 'medical_systems',
  food: 'food_systems',
  farming: 'food_systems',
  crops: 'food_systems',
  hydroponics: 'food_systems',
  irrigation: 'food_systems',
  defense: 'defense_systems',
  defenses: 'defense_systems',
  turret: 'defense_systems',
  turrets: 'defense_systems',
  wall: 'defense_systems',
  walls: 'defense_systems',
  production: 'production_systems',
  crafting: 'production_systems',
  fabrication: 'production_systems',
  logistics: 'logistics_systems',
  hauling: 'logistics_systems',
  storage: 'logistics_systems',
  research: 'research_progression',
  tech: 'research_progression',
  housing: 'housing_colony',
  shelter: 'housing_colony',
  colony: 'housing_colony',
  morale: 'morale_psychology',
  mood: 'morale_psychology',
  recreation: 'morale_psychology',
  temperature: 'environmental_survival',
  heat: 'environmental_survival',
  cold: 'environmental_survival',
  survival: 'environmental_survival',
  economy: 'economy_trade',
  trade: 'economy_trade',
  market: 'economy_trade',
  mobility: 'mobility_travel',
  travel: 'mobility_travel',
  caravan: 'mobility_travel',
  combat: 'combat_operations',
  raid: 'combat_operations',
  raids: 'combat_operations',
  automation: 'automation_control',
  mechanitor: 'automation_control',
  mining: 'resource_extraction',
  extraction: 'resource_extraction',
  scouting: 'information_control',
  vision: 'information_control',
  recon: 'information_control',
  intel: 'information_control',
  stealth: 'stealth_detection',
  detection: 'stealth_detection',
  cover: 'spatial_tactics',
  flanking: 'spatial_tactics',
  positioning: 'spatial_tactics',
  chokepoint: 'spatial_tactics',
  los: 'spatial_tactics',
  tempo: 'tempo_management',
  cooldown: 'tempo_management',
  timing: 'tempo_management',
  window: 'tempo_management',
  burst: 'tempo_management',
  execute: 'tempo_management',
  rotation: 'tempo_management',
  iframe: 'tempo_management',
  stamina: 'tempo_management',
  risk: 'risk_reward',
  reward: 'risk_reward',
  loot: 'risk_reward',
  extraction_point: 'risk_reward',
  progression: 'character_progression',
  gear: 'character_progression',
  talent: 'character_progression',
  skill: 'character_progression',
  synergy: 'ability_synergy',
  combo: 'ability_synergy',
  chaining: 'ability_synergy',
  buff: 'ability_synergy',
  debuff: 'ability_synergy',
  team: 'team_coordination',
  squad: 'team_coordination',
  revive: 'survivability',
  sustain: 'survivability',
  objective: 'objective_control',
  capture: 'objective_control',
  control: 'objective_control'
};

const SYSTEM_TO_FAMILY = {
  power: 'power_infrastructure',
  medicine: 'medical_systems',
  food: 'food_systems',
  defense: 'defense_systems',
  crafting: 'production_systems',
  research: 'research_progression',
  morale: 'morale_psychology',
  trade: 'economy_trade',
  mobility: 'mobility_travel',
  combat: 'combat_operations',
  automation: 'automation_control',
  resource: 'resource_extraction'
};

function looksTutorial(text) {
  for (const pattern of TUTORIAL_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

function looksGeneric(text) {
  for (const pattern of GENERIC_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

function looksWeakTradeoffTemplate(text) {
  for (const pattern of WEAK_TRADEOFF_TEMPLATES) {
    if (pattern.test(text)) return true;
  }
  return false;
}

function isWikiEditorialContamination(text) {
  return matchesAny(WIKI_EDITORIAL_PATTERNS, text);
}

function isNonActionableGameplay(text) {
  if (!matchesAny(NON_ACTIONABLE_PATTERNS, text)) return false;
  if (matchesAny(GAMEPLAY_SIGNAL_PATTERNS, text)) return false;
  if (matchesAny(EMERGENT_CONSEQUENCE_PATTERNS, text)) return false;
  if (matchesAny(TRADEOFF_IMPLICATION_PATTERNS, text)) return false;
  return true;
}

function isLoreNonActionable(text) {
  if (!matchesAny(LORE_NARRATIVE_PATTERNS, text)) return false;
  if (matchesAny(GAMEPLAY_SIGNAL_PATTERNS, text)) return false;
  if (matchesAny(EMERGENT_CONSEQUENCE_PATTERNS, text)) return false;
  if (matchesAny(TRADEOFF_IMPLICATION_PATTERNS, text)) return false;
  return true;
}

function isTimeBoundMetadata(text) {
  if (!matchesAny(TIME_BOUND_PATTERNS, text)) return false;
  if (matchesAny(EVERGREEN_MECHANIC_PATTERNS, text)) return false;
  if (matchesAny(EMERGENT_CONSEQUENCE_PATTERNS, text)) return false;
  if (matchesAny(TRADEOFF_IMPLICATION_PATTERNS, text)) return false;
  return true;
}

function isLiveServiceContamination(text) {
  if (!matchesAny(LIVE_SERVICE_PATTERNS, text)) return false;
  if (matchesAny(GAMEPLAY_IMPACT_PATTERNS, text)) return false;
  if (matchesAny(EMERGENT_CONSEQUENCE_PATTERNS, text)) return false;
  if (matchesAny(TRADEOFF_IMPLICATION_PATTERNS, text)) return false;
  return true;
}

function isHardLowSignal(text) {
  if (!matchesAny(LOW_SIGNAL_PATTERNS, text)) return false;
  if (matchesAny(EMERGENT_CONSEQUENCE_PATTERNS, text)) return false;
  if (matchesAny(TRADEOFF_IMPLICATION_PATTERNS, text)) return false;
  return true;
}

function hasSpecificSignal(text) {
  const tokens = tokenizeText(text);
  const unique = new Set();
  for (const token of tokens) {
    if (GENERIC_TOKENS.has(token)) continue;
    if (token.length < 4) continue;
    unique.add(token);
  }
  return unique.size >= 2;
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTextKey(value) {
  return normalizeText(value).toLowerCase();
}

function tokenizeText(value) {
  const cleaned = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!cleaned) return [];
  return cleaned.split(' ').filter((token) => token.length >= 3);
}

function buildTokenSet(tokens) {
  const set = new Set();
  for (const token of tokens) set.add(token);
  return set;
}

function computeTokenOverlap(a, b) {
  if (!a.size || !b.size) return { similarity: 0, overlap: 0 };
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let overlap = 0;
  for (const token of small) {
    if (large.has(token)) overlap += 1;
  }
  const union = a.size + b.size - overlap;
  const similarity = union ? overlap / union : 0;
  return { similarity, overlap };
}

function hashText(value) {
  let hash = 5381;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i);
    hash &= 0xffffffff;
  }
  return (hash >>> 0).toString(16);
}

function normalizeListEntries(list, maxEntries, maxLength) {
  const source = Array.isArray(list) ? list : [];
  const dedupe = new Map();
  for (const entry of source) {
    const normalized = normalizeText(entry);
    if (!normalized) continue;
    const trimmed = maxLength ? normalized.slice(0, maxLength).trim() : normalized;
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!dedupe.has(key)) dedupe.set(key, trimmed);
  }
  const values = Array.from(dedupe.values());
  return typeof maxEntries === 'number' && maxEntries >= 0 ? values.slice(0, maxEntries) : values;
}

function normalizeKeywordEntries(list, maxEntries) {
  const source = Array.isArray(list) ? list : [];
  const dedupe = new Map();
  for (const entry of source) {
    const normalized = normalizeText(entry).toLowerCase();
    if (!normalized) continue;
    const mapped = KEYWORD_NORMALIZATION[normalized] || normalized;
    if (!dedupe.has(mapped)) dedupe.set(mapped, mapped);
  }
  const values = Array.from(dedupe.values());
  return typeof maxEntries === 'number' && maxEntries >= 0 ? values.slice(0, maxEntries) : values;
}

function mergeDropReasons(base, extra) {
  const output = { ...(base || {}) };
  Object.entries(extra || {}).forEach(([key, value]) => {
    output[key] = (output[key] || 0) + Number(value || 0);
  });
  return output;
}

function normalizePriority(value, policy) {
  if (!policy || !policy.priority) return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const raw = value.trim().toUpperCase();
    if (raw === 'P1') return policy.priority.max;
    if (raw === 'P2') return Math.max(policy.priority.min, Math.min(policy.priority.max, policy.priority.max - 1));
    if (raw === 'P3') return policy.priority.min;
  }
  const numeric = Number.isFinite(value) ? value : policy.priority.default;
  return Math.max(policy.priority.min, Math.min(policy.priority.max, numeric));
}

function normalizeSuggestedPriority(value) {
  if (!value) return 0;
  const raw = String(value).trim().toUpperCase();
  if (raw === 'P1') return 3;
  if (raw === 'P2') return 2;
  if (raw === 'P3') return 1;
  return 0;
}

function clampScore(value) {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function normalizeSystemsList(value) {
  const list = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const normalized = normalizeText(item).toLowerCase();
    if (!normalized) continue;
    const alias = SYSTEM_ALIASES[normalized] || normalized;
    const trimmed = alias.slice(0, 24).trim();
    if (!trimmed || seen.has(trimmed)) continue;
    if (!CANONICAL_SYSTEMS.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= 4) break;
  }
  return out;
}

function extractSystemsFromText(text) {
  const tokens = tokenizeText(text);
  const found = [];
  const seen = new Set();
  for (const token of tokens) {
    const alias = SYSTEM_ALIASES[token] || token;
    if (!CANONICAL_SYSTEMS.has(alias)) continue;
    if (seen.has(alias)) continue;
    seen.add(alias);
    found.push(alias);
    if (found.length >= 4) break;
  }
  return found;
}

function normalizeFamilyList(value) {
  const list = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const normalized = normalizeText(item).toLowerCase();
    if (!normalized) continue;
    const alias = FAMILY_ALIASES[normalized] || normalized;
    if (!MECHANIC_FAMILIES.has(alias)) continue;
    if (seen.has(alias)) continue;
    seen.add(alias);
    out.push(alias);
    if (out.length >= 4) break;
  }
  return out;
}

function extractFamiliesFromText(text) {
  const tokens = tokenizeText(text);
  const found = [];
  const seen = new Set();
  for (const token of tokens) {
    const alias = FAMILY_ALIASES[token] || token;
    if (!MECHANIC_FAMILIES.has(alias)) continue;
    if (seen.has(alias)) continue;
    seen.add(alias);
    found.push(alias);
    if (found.length >= 4) break;
  }
  return found;
}

function applyObviousnessBoost(text, noveltyScore, obviousness) {
  let boostHits = 0;
  for (const pattern of OBVIOUSNESS_BOOST_PATTERNS) {
    if (pattern.test(text)) boostHits += 1;
  }
  if (!boostHits) return { noveltyScore, obviousness };
  const boostedObviousness = Math.min(1, (obviousness ?? 0.4) + 0.12 * boostHits);
  const reducedNovelty = Math.max(0, (noveltyScore ?? 0.5) - 0.1 * boostHits);
  return { noveltyScore: reducedNovelty, obviousness: boostedObviousness };
}

function matchesAny(patterns, text) {
  for (const pattern of patterns) {
    if (pattern.test(text)) return true;
  }
  return false;
}

function getTemplateShape(text) {
  for (const entry of TEMPLATE_SHAPE_PATTERNS) {
    if (entry.pattern.test(text)) return entry.key;
  }
  return '';
}

function applyTemplatePenalty(text, noveltyScore, obviousness) {
  const shape = getTemplateShape(text);
  if (!shape) return { noveltyScore, obviousness, shape };
  const boostedObviousness = Math.min(1, (obviousness ?? 0.4) + 0.1);
  const reducedNovelty = Math.max(0, (noveltyScore ?? 0.5) - 0.05);
  return { noveltyScore: reducedNovelty, obviousness: boostedObviousness, shape };
}

function applyAbilityTemplatePenalty(text, noveltyScore, obviousness) {
  if (!matchesAny(ABILITY_TEMPLATE_PATTERNS, text)) {
    return { noveltyScore, obviousness, abilityPenaltyApplied: false };
  }
  const boostedObviousness = Math.min(1, (obviousness ?? 0.4) + 0.08);
  const reducedNovelty = Math.max(0, (noveltyScore ?? 0.5) - 0.06);
  return { noveltyScore: reducedNovelty, obviousness: boostedObviousness, abilityPenaltyApplied: true };
}

function applySpecificityBonus(text, noveltyScore, obviousness) {
  if (!matchesAny(SPECIFICITY_BONUS_PATTERNS, text)) {
    return { noveltyScore, obviousness, specificityBonusApplied: false };
  }
  const boostedNovelty = Math.min(1, (noveltyScore ?? 0.5) + 0.1);
  const reducedObviousness = Math.max(0, (obviousness ?? 0.5) - 0.05);
  return { noveltyScore: boostedNovelty, obviousness: reducedObviousness, specificityBonusApplied: true };
}

function applyEmergentConsequenceBonus(text, noveltyScore, obviousness) {
  if (!matchesAny(EMERGENT_CONSEQUENCE_PATTERNS, text)) {
    return { noveltyScore, obviousness, emergentBonusApplied: false };
  }
  const boostedNovelty = Math.min(1, (noveltyScore ?? 0.5) + 0.15);
  const reducedObviousness = Math.max(0, (obviousness ?? 0.5) - 0.1);
  return { noveltyScore: boostedNovelty, obviousness: reducedObviousness, emergentBonusApplied: true };
}

function shouldApplyResourcePenalty(text, interactionCount, systemsCount) {
  if (!matchesAny(RESOURCE_DEPENDENCY_PATTERNS, text)) return false;
  if (matchesAny(EMERGENT_CONSEQUENCE_PATTERNS, text)) return false;
  if (matchesAny(TRADEOFF_IMPLICATION_PATTERNS, text)) return false;
  if (interactionCount >= 2 || systemsCount >= 2) return false;
  return true;
}

function applyResourcePenalty(text, interactionCount, systemsCount, noveltyScore, obviousness) {
  if (!shouldApplyResourcePenalty(text, interactionCount, systemsCount)) {
    return { noveltyScore, obviousness, resourcePenaltyApplied: false };
  }
  const boostedObviousness = Math.min(1, (obviousness ?? 0.4) + 0.15);
  const reducedNovelty = Math.max(0, (noveltyScore ?? 0.5) - 0.1);
  return { noveltyScore: reducedNovelty, obviousness: boostedObviousness, resourcePenaltyApplied: true };
}

function computeRetentionScore(fact) {
  const novelty = Number.isFinite(fact.noveltyScore) ? fact.noveltyScore : 0.5;
  const obvious = Number.isFinite(fact.obviousness) ? fact.obviousness : 0.5;
  const interaction = Number.isFinite(fact.interactionCount)
    ? fact.interactionCount
    : (Array.isArray(fact.systems) ? fact.systems.length : 0);
  const interactionBonus = Math.min(0.2, interaction * 0.05);
  const textLower = normalizeTextKey(fact.text);
  const templatePenalty = looksWeakTradeoffTemplate(textLower) ? 0.2 : 0;
  let onboardingPenalty = 0;
  for (const pattern of OBVIOUSNESS_BOOST_PATTERNS) {
    if (pattern.test(textLower)) onboardingPenalty += 0.04;
  }
  onboardingPenalty = Math.min(0.12, onboardingPenalty);
  return novelty - obvious + interactionBonus - templatePenalty - onboardingPenalty;
}

function applyP1Cap(facts) {
  const total = facts.length;
  if (!total) return;
  const maxRatio = 0.2;
  const targetRatio = 0.15;
  const maxP1 = Math.ceil(total * maxRatio);
  const targetP1 = Math.ceil(total * targetRatio);
  const p1Indices = [];
  for (let i = 0; i < facts.length; i += 1) {
    if (facts[i].priority === 3) p1Indices.push(i);
  }
  if (p1Indices.length <= maxP1) return;
  const scored = p1Indices.map((index) => {
    const fact = facts[index];
    return {
      index,
      retentionScore: computeRetentionScore(fact),
      obviousness: Number.isFinite(fact.obviousness) ? fact.obviousness : 0.5,
      novelty: Number.isFinite(fact.noveltyScore) ? fact.noveltyScore : 0.5,
      interaction: Number.isFinite(fact.interactionCount) ? fact.interactionCount : 0
    };
  });
  scored.sort((a, b) => {
    if (a.retentionScore !== b.retentionScore) return a.retentionScore - b.retentionScore;
    if (a.obviousness !== b.obviousness) return b.obviousness - a.obviousness;
    if (a.novelty !== b.novelty) return a.novelty - b.novelty;
    return a.interaction - b.interaction;
  });
  const downgradeCount = Math.max(0, p1Indices.length - targetP1);
  for (let i = 0; i < downgradeCount; i += 1) {
    const fact = facts[scored[i].index];
    fact.priority = 2;
  }
}

function applyTemplateRepetitionPenalty(facts) {
  const shapeCounts = {};
  const shapes = new Array(facts.length);
  for (let i = 0; i < facts.length; i += 1) {
    const textLower = normalizeTextKey(facts[i].text);
    const shape = getTemplateShape(textLower);
    shapes[i] = shape;
    if (!shape) continue;
    shapeCounts[shape] = (shapeCounts[shape] || 0) + 1;
  }

  for (let i = 0; i < facts.length; i += 1) {
    const shape = shapes[i];
    if (!shape) continue;
    const count = shapeCounts[shape] || 0;
    const extra = Math.max(0, count - 3);
    if (!extra) continue;

    const fact = facts[i];
    let novelty = Number.isFinite(fact.noveltyScore) ? fact.noveltyScore : 0.5;
    let obvious = Number.isFinite(fact.obviousness) ? fact.obviousness : 0.5;
    novelty = Math.max(0, novelty - 0.02 * extra);
    obvious = Math.min(1, obvious + 0.02 * extra);
    fact.noveltyScore = novelty;
    fact.obviousness = obvious;

    const suggestedPriority = normalizeSuggestedPriority(fact.suggestedPriority);
    const systemsCount = Array.isArray(fact.systems) ? fact.systems.length : 0;
    const interactionCount = Number.isFinite(fact.interactionCount)
      ? fact.interactionCount
      : systemsCount;
    let recomputed = decideFinalPriority(
      fact.priority,
      suggestedPriority,
      novelty,
      obvious,
      interactionCount,
      systemsCount
    );
    if (shouldApplyResourcePenalty(normalizeTextKey(fact.text), interactionCount, systemsCount)) {
      recomputed = Math.min(recomputed, 2);
    }
    fact.priority = recomputed;
  }
}

function decideFinalPriority(basePriority, suggestedPriority, noveltyScore, obviousness, interactionCount, systemsCount) {
  let priority = Number.isFinite(basePriority) ? basePriority : 2;
  if (suggestedPriority) priority = suggestedPriority;

  if (Number.isFinite(obviousness)) {
    if (obviousness >= 0.75) priority = Math.min(priority, 1);
    else if (obviousness >= 0.6) priority = Math.min(priority, 2);
  }

  if (Number.isFinite(noveltyScore)) {
    const strongNovelty = noveltyScore >= 0.75;
    const lowObvious = Number.isFinite(obviousness) ? obviousness <= 0.35 : false;
    if (strongNovelty && (interactionCount >= 2 || lowObvious)) {
      priority = Math.max(priority, 3);
    }
  }

  if (interactionCount >= 2 && Number.isFinite(obviousness) && obviousness <= 0.5) {
    priority = Math.max(priority, 2);
  }

  if (systemsCount >= 2 && Number.isFinite(obviousness) && obviousness <= 0.5) {
    priority = Math.max(priority, 2);
  }

  return Math.max(1, Math.min(3, priority));
}

function hasRejectedPayloadFields(payload, rejectFields) {
  const list = Array.isArray(rejectFields) ? rejectFields : [];
  for (const field of list) {
    if (!field) continue;
    if (payload && Object.prototype.hasOwnProperty.call(payload, field)) {
      const value = payload[field];
      if (typeof value === 'string' && value.trim()) return field;
      if (Array.isArray(value) && value.length) return field;
      if (value && typeof value === 'object') return field;
    }
  }
  return '';
}

function normalizeFactPayload(payload, policyInput) {
  const policy = policyInput || {};
  const rejectedField = hasRejectedPayloadFields(payload, policy.rejectPayloadFields);
  if (rejectedField) {
    return { ok: false, error: 'raw-source-persistence' };
  }

  const text = normalizeText(payload && payload.text);
  if (!text) return { ok: false, error: 'missing-text' };
  const maxLength = policy.factLimits ? policy.factLimits.textMaxLength : 0;
  if (maxLength && text.length > maxLength) {
    return { ok: false, error: 'text-too-long' };
  }

  const textLower = text.toLowerCase();
  if (matchesBlockedPattern(textLower, policy.hardFilters ? policy.hardFilters.lorePatterns : [])) {
    return { ok: false, error: 'lore-pattern' };
  }
  if (looksTutorial(textLower)) {
    return { ok: false, error: 'tutorial-pattern' };
  }
  if (looksGeneric(textLower)) {
    return { ok: false, error: 'generic-pattern' };
  }
  if (isLoreNonActionable(textLower)) {
    return { ok: false, error: 'lore-nonactionable' };
  }
  if (isNonActionableGameplay(textLower)) {
    return { ok: false, error: 'non-actionable' };
  }
  if (isWikiEditorialContamination(textLower)) {
    return { ok: false, error: 'wiki-editorial' };
  }
  if (isTimeBoundMetadata(textLower)) {
    return { ok: false, error: 'time-bound-metadata' };
  }
  if (isLiveServiceContamination(textLower)) {
    return { ok: false, error: 'live-service' };
  }
  if (isHardLowSignal(textLower)) {
    return { ok: false, error: 'low-signal' };
  }
  if (looksWeakTradeoffTemplate(textLower) && !hasSpecificSignal(textLower)) {
    return { ok: false, error: 'low-signal-template' };
  }

  const sourceType = normalizeText(payload && payload.sourceType || payload && payload.source || 'user').toLowerCase();
  const allowList = policy.sourcePolicy ? policy.sourcePolicy.allowList : [];
  const blockList = policy.sourcePolicy ? policy.sourcePolicy.blockList : [];
  const blockedPatterns = policy.sourcePolicy ? policy.sourcePolicy.blockedPatterns : [];
  if (allowList.length && !allowList.includes(sourceType)) return { ok: false, error: 'source-not-allowed' };
  if (blockList.includes(sourceType)) return { ok: false, error: 'source-blocked' };
  if (matchesBlockedPattern(sourceType, blockedPatterns)) return { ok: false, error: 'source-blocked-pattern' };

  const keywords = normalizeListEntries(
    payload && payload.keywords,
    policy.factLimits ? policy.factLimits.keywordsMax : 0,
    policy.factLimits ? policy.factLimits.keywordMaxLength : 0
  );
  const keywordsNormalized = normalizeKeywordEntries(
    keywords,
    policy.factLimits ? policy.factLimits.keywordsMax : 0
  );
  const tags = normalizeListEntries(
    payload && payload.tags,
    policy.factLimits ? policy.factLimits.tagsMax : 0,
    policy.factLimits ? policy.factLimits.tagMaxLength : 0
  );

  const priority = normalizePriority(payload && payload.priority, policy);
  const suggestedPriority = normalizeSuggestedPriority(payload && payload.suggestedPriority);
  let noveltyScore = clampScore(payload && payload.noveltyScore);
  let obviousness = clampScore(payload && payload.obviousness);
  const interactionCountRaw = Number.isFinite(payload && payload.interactionCount)
    ? Math.max(0, Math.floor(payload.interactionCount))
    : 0;
  const systems = normalizeSystemsList(payload && payload.systems);
  const derivedSystems = extractSystemsFromText(textLower);
  const mergedSystems = normalizeSystemsList([].concat(systems, derivedSystems, payload && payload.system));
  const keywordFamilies = extractFamiliesFromText((keywordsNormalized || []).join(' '));
  const keywordFamilyHints = (keywordsNormalized || [])
    .map((keyword) => KEYWORD_FAMILY_MAP[keyword])
    .filter((family) => family);
  const systemFamilies = mergedSystems
    .map((system) => SYSTEM_TO_FAMILY[system])
    .filter((family) => family);
  const derivedFamilies = extractFamiliesFromText(textLower);
  const mergedFamilies = normalizeFamilyList([].concat(
    payload && payload.mechanicFamilies,
    keywordFamilies,
    keywordFamilyHints,
    systemFamilies,
    derivedFamilies
  ));
  const interactionCountFinal = mergedSystems.length;
  ({ noveltyScore, obviousness } = applyObviousnessBoost(textLower, noveltyScore, obviousness));
  ({ noveltyScore, obviousness } = applyTemplatePenalty(textLower, noveltyScore, obviousness));
  ({ noveltyScore, obviousness } = applyAbilityTemplatePenalty(textLower, noveltyScore, obviousness));
  ({ noveltyScore, obviousness } = applySpecificityBonus(textLower, noveltyScore, obviousness));
  ({ noveltyScore, obviousness } = applyEmergentConsequenceBonus(textLower, noveltyScore, obviousness));
  const resourcePenalty = applyResourcePenalty(
    textLower,
    interactionCountFinal,
    mergedSystems.length,
    noveltyScore,
    obviousness
  );
  noveltyScore = resourcePenalty.noveltyScore;
  obviousness = resourcePenalty.obviousness;
  const finalPriority = decideFinalPriority(
    priority,
    suggestedPriority,
    noveltyScore,
    obviousness,
    interactionCountFinal,
    mergedSystems.length
  );
  const priorityWithCap = resourcePenalty.resourcePenaltyApplied
    ? Math.min(finalPriority, 2)
    : finalPriority;
  const confidence = Number.isFinite(payload && payload.confidence)
    ? Math.max(0, Math.min(1, payload.confidence))
    : null;

  const fact = {
    text,
    keywords,
    tags,
    priority: priorityWithCap
  };

  if (payload && payload.id) fact.id = normalizeText(payload.id);
  if (payload && payload.system) fact.system = normalizeText(payload.system);
  if (payload && payload.gameStage) fact.gameStage = normalizeText(payload.gameStage);
  if (sourceType) fact.sourceType = sourceType;
  if (confidence !== null) fact.confidence = confidence;
  if (suggestedPriority) fact.suggestedPriority = `P${suggestedPriority}`;
  if (noveltyScore !== null) fact.noveltyScore = noveltyScore;
  if (obviousness !== null) fact.obviousness = obviousness;
  if (interactionCountFinal) fact.interactionCount = interactionCountFinal;
  if (mergedSystems.length) fact.systems = mergedSystems;
  if (mergedFamilies.length) fact.mechanicFamilies = mergedFamilies;
  if (keywordsNormalized.length) fact.keywordsNormalized = keywordsNormalized;
  if (mergedFamilies.length) fact.systemsNormalized = mergedFamilies;
  const evergreen = !isTimeBoundMetadata(textLower) && !isLiveServiceContamination(textLower)
    && (matchesAny(GAMEPLAY_SIGNAL_PATTERNS, textLower)
      || matchesAny(EMERGENT_CONSEQUENCE_PATTERNS, textLower)
      || matchesAny(TRADEOFF_IMPLICATION_PATTERNS, textLower));
  fact.evergreen = !!evergreen;

  return { ok: true, fact };
}

function normalizeFactListRaw(list, policyInput) {
  const policy = policyInput || {};
  const facts = [];
  const dropReasons = {};
  let dropped = 0;
  const entries = Array.isArray(list) ? list : [];
  for (const entry of entries) {
    const result = normalizeFactPayload(entry, policy);
    if (!result.ok) {
      dropped += 1;
      dropReasons[result.error] = (dropReasons[result.error] || 0) + 1;
      continue;
    }
    facts.push(result.fact);
  }
  return { facts, dropped, dropReasons };
}

function applyDedupe(facts, policyInput) {
  const policy = policyInput || {};
  let dropped = 0;
  let exactDeduped = 0;
  let nearDuplicateMarked = 0;
  let nearDuplicateDropped = 0;
  const dropReasons = {};
  const exactDedupeEnabled = policy.dedupe ? policy.dedupe.exact !== false : true;
  const dedupeMap = new Map();

  const output = [];
  for (const fact of facts) {
    const key = normalizeTextKey(fact.text);
    if (exactDedupeEnabled && key) {
      const existingIndex = dedupeMap.get(key);
      if (typeof existingIndex === 'number') {
        const existing = output[existingIndex];
        existing.keywords = normalizeListEntries(
          (existing.keywords || []).concat(fact.keywords || []),
          policy.factLimits ? policy.factLimits.keywordsMax : 0,
          policy.factLimits ? policy.factLimits.keywordMaxLength : 0
        );
        existing.tags = normalizeListEntries(
          (existing.tags || []).concat(fact.tags || []),
          policy.factLimits ? policy.factLimits.tagsMax : 0,
          policy.factLimits ? policy.factLimits.tagMaxLength : 0
        );
        existing.priority = Math.max(existing.priority || 0, fact.priority || 0);
        if (Number.isFinite(fact.confidence)) {
          if (!Number.isFinite(existing.confidence)) {
            existing.confidence = fact.confidence;
          } else {
            existing.confidence = Math.max(existing.confidence, fact.confidence);
          }
        }
        if (!existing.system && fact.system) existing.system = fact.system;
        if (!existing.gameStage && fact.gameStage) existing.gameStage = fact.gameStage;
        if (!existing.sourceType && fact.sourceType) existing.sourceType = fact.sourceType;
        dropped += 1;
        exactDeduped += 1;
        dropReasons['dedupe-exact'] = (dropReasons['dedupe-exact'] || 0) + 1;
        continue;
      }
      dedupeMap.set(key, output.length);
    }
    output.push(fact);
  }

  const nearDedupe = policy.dedupe && policy.dedupe.nearDuplicate ? policy.dedupe.nearDuplicate : null;
  if (nearDedupe && nearDedupe.enabled) {
    const threshold = Number.isFinite(nearDedupe.threshold) ? nearDedupe.threshold : 0.9;
    const minTokens = Number.isFinite(nearDedupe.minTokens) ? nearDedupe.minTokens : 6;
    const minOverlap = Number.isFinite(nearDedupe.minTokenOverlap) ? nearDedupe.minTokenOverlap : 4;
    const action = String(nearDedupe.action || 'keep').trim().toLowerCase();
    const tokenSets = output.map((fact) => buildTokenSet(tokenizeText(fact.text)));
    const dropIndices = new Set();

    for (let i = 1; i < output.length; i += 1) {
      if (dropIndices.has(i)) continue;
      const tokens = tokenSets[i];
      if (tokens.size < minTokens) continue;
      for (let j = 0; j < i; j += 1) {
        if (dropIndices.has(j)) continue;
        const other = tokenSets[j];
        if (other.size < minTokens) continue;
        const result = computeTokenOverlap(tokens, other);
        if (result.similarity < threshold) continue;
        if (result.overlap < minOverlap) continue;

        if (action === 'drop') {
          dropIndices.add(i);
          dropped += 1;
          nearDuplicateDropped += 1;
          dropReasons['dedupe-near'] = (dropReasons['dedupe-near'] || 0) + 1;
          break;
        }
        const groupId = `nd-${hashText(output[j].text)}`;
        if (!output[j].nearDuplicateGroup) {
          output[j].nearDuplicateGroup = groupId;
        }
        output[i].nearDuplicateGroup = groupId;
        output[i].nearDuplicateScore = Number(result.similarity.toFixed(2));
        nearDuplicateMarked += 1;
        break;
      }
    }

    if (dropIndices.size) {
      const filtered = [];
      for (let i = 0; i < output.length; i += 1) {
        if (!dropIndices.has(i)) filtered.push(output[i]);
      }
      output.length = 0;
      output.push(...filtered);
    }
  }

  return {
    facts: output,
    dropped,
    dropReasons,
    exactDeduped,
    nearDuplicateMarked,
    nearDuplicateDropped
  };
}

function applyRetentionShaping(facts) {
  applyTemplateRepetitionPenalty(facts);
  applyP1Cap(facts);
}

function normalizeFactList(list, policyInput) {
  const raw = normalizeFactListRaw(list, policyInput);
  const deduped = applyDedupe(raw.facts, policyInput);
  applyRetentionShaping(deduped.facts);
  return {
    facts: deduped.facts,
    dropped: raw.dropped + deduped.dropped,
    dropReasons: mergeDropReasons(raw.dropReasons, deduped.dropReasons),
    exactDeduped: deduped.exactDeduped,
    nearDuplicateMarked: deduped.nearDuplicateMarked,
    nearDuplicateDropped: deduped.nearDuplicateDropped
  };
}

module.exports = {
  normalizeFactPayload,
  normalizeFactList,
  normalizeFactListRaw,
  applyDedupe,
  applyRetentionShaping,
  mergeDropReasons,
  getTemplateShape
};
