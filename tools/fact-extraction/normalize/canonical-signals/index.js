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

const FAMILY_TO_SYSTEM = {
  power_infrastructure: 'power',
  medical_systems: 'medicine',
  food_systems: 'food',
  defense_systems: 'defense',
  production_systems: 'crafting',
  logistics_systems: 'automation',
  research_progression: 'research',
  morale_psychology: 'morale',
  economy_trade: 'trade',
  mobility_travel: 'mobility',
  combat_operations: 'combat',
  automation_control: 'automation',
  resource_extraction: 'resource'
};

function createCanonicalSignals(options) {
  const normalizeText = options.normalizeText;
  const tokenizeText = options.tokenizeText;

  const normalizeKeywordEntries = (list, maxEntries) => {
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
  };

  const getKeywordFamilyHints = (keywordsNormalized) => {
    return (keywordsNormalized || [])
      .map((keyword) => KEYWORD_FAMILY_MAP[keyword])
      .filter((family) => family);
  };

  const normalizeSystemsList = (value) => {
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
  };

  const extractSystemsFromText = (text) => {
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
  };

  const normalizeFamilyList = (value) => {
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
  };

  const extractFamiliesFromText = (text) => {
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
  };

  const deriveFamiliesFromSystems = (systems) => {
    const list = Array.isArray(systems) ? systems : [];
    return list.map((system) => SYSTEM_TO_FAMILY[system]).filter(Boolean);
  };

  const deriveSystemsFromFamilies = (families) => {
    const list = Array.isArray(families) ? families : [];
    const output = [];
    for (const family of list) {
      const mapped = FAMILY_TO_SYSTEM[family];
      if (mapped) output.push(mapped);
    }
    return output;
  };

  return {
    normalizeKeywordEntries,
    getKeywordFamilyHints,
    normalizeSystemsList,
    extractSystemsFromText,
    normalizeFamilyList,
    extractFamiliesFromText,
    deriveFamiliesFromSystems,
    deriveSystemsFromFamilies
  };
}

module.exports = {
  createCanonicalSignals
};
