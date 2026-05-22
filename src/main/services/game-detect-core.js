const ALWAYS_IGNORE_PATTERNS = [
  /AIGameAssistant/i,
  /AI Game Assistant/i
];

// Known game patterns (120+ popular games)
const GAME_PATTERNS = [
  // === FPS / SHOOTER ===
  { pattern: /Counter-Strike 2/i, name: 'Counter-Strike 2' },
  { pattern: /\bCS2\b/i, name: 'Counter-Strike 2' },
  { pattern: /Call of Duty/i, name: 'Call of Duty' },
  { pattern: /\bCOD\b/i, name: 'Call of Duty' },
  { pattern: /Valorant/i, name: 'Valorant' },
  { pattern: /Apex Legends/i, name: 'Apex Legends' },
  { pattern: /Overwatch/i, name: 'Overwatch' },
  { pattern: /Rainbow Six Siege/i, name: 'Rainbow Six Siege' },
  { pattern: /\bR6\b/i, name: 'Rainbow Six Siege' },
  { pattern: /\bPUBG\b/i, name: 'PUBG: Battlegrounds' },
  { pattern: /Escape from Tarkov/i, name: 'Escape from Tarkov' },
  { pattern: /Hunt: Showdown/i, name: 'Hunt: Showdown' },
  { pattern: /Destiny 2/i, name: 'Destiny 2' },
  { pattern: /The Finals/i, name: 'The Finals' },
  { pattern: /Battlefield/i, name: 'Battlefield' },
  { pattern: /Halo Infinite/i, name: 'Halo Infinite' },
  { pattern: /Titanfall 2/i, name: 'Titanfall 2' },

  // === MOBA / Strategy ===
  { pattern: /League of Legends/i, name: 'League of Legends' },
  { pattern: /Dota 2/i, name: 'Dota 2' },
  { pattern: /Heroes of the Storm/i, name: 'Heroes of the Storm' },
  { pattern: /Smite/i, name: 'Smite' },
  { pattern: /Starcraft (II|2)/i, name: 'Starcraft 2' },
  { pattern: /Age of Empires/i, name: 'Age of Empires' },
  { pattern: /Total War/i, name: 'Total War' },
  { pattern: /Civilization (VI|6)/i, name: 'Civilization 6' },
  { pattern: /Crusader Kings/i, name: 'Crusader Kings' },
  { pattern: /Europa Universalis/i, name: 'Europa Universalis' },

  // === RPG / Action RPG ===
  { pattern: /Elden Ring/i, name: 'Elden Ring' },
  { pattern: /Dark Souls (III|3)/i, name: 'Dark Souls 3' },
  { pattern: /Dark Souls (II|2)/i, name: 'Dark Souls 2' },
  { pattern: /Dark Souls/i, name: 'Dark Souls' },
  { pattern: /Sekiro/i, name: 'Sekiro: Shadows Die Twice' },
  { pattern: /Bloodborne/i, name: 'Bloodborne' },
  { pattern: /The Witcher 3/i, name: 'The Witcher 3' },
  { pattern: /Cyberpunk 2077/i, name: 'Cyberpunk 2077' },
  { pattern: /Skyrim/i, name: 'The Elder Scrolls V: Skyrim' },
  { pattern: /Elder Scrolls Online/i, name: 'The Elder Scrolls Online' },
  { pattern: /Fallout (4|76)/i, name: 'Fallout' },
  { pattern: /Baldur's Gate 3/i, name: "Baldur's Gate 3" },
  { pattern: /Divinity: Original Sin/i, name: 'Divinity: Original Sin' },
  { pattern: /Dragon Age/i, name: 'Dragon Age' },
  { pattern: /Mass Effect/i, name: 'Mass Effect' },
  { pattern: /Monster Hunter/i, name: 'Monster Hunter' },
  { pattern: /Final Fantasy XIV/i, name: 'Final Fantasy XIV' },
  { pattern: /Final Fantasy/i, name: 'Final Fantasy' },
  { pattern: /Persona/i, name: 'Persona' },
  { pattern: /Diablo (IV|4)/i, name: 'Diablo 4' },
  { pattern: /Diablo (III|3)/i, name: 'Diablo 3' },
  { pattern: /Diablo (II|2)/i, name: 'Diablo 2' },
  { pattern: /Path of Exile/i, name: 'Path of Exile' },
  { pattern: /Last Epoch/i, name: 'Last Epoch' },
  { pattern: /Grim Dawn/i, name: 'Grim Dawn' },

  // === Survival / Crafting ===
  { pattern: /Minecraft/i, name: 'Minecraft' },
  { pattern: /Terraria/i, name: 'Terraria' },
  { pattern: /Valheim/i, name: 'Valheim' },
  { pattern: /ARK: Survival/i, name: 'ARK: Survival Evolved' },
  { pattern: /Rust/i, name: 'Rust' },
  { pattern: /7 Days to Die/i, name: '7 Days to Die' },
  { pattern: /The Forest/i, name: 'The Forest' },
  { pattern: /Sons of the Forest/i, name: 'Sons of the Forest' },
  { pattern: /Subnautica/i, name: 'Subnautica' },
  { pattern: /DayZ/i, name: 'DayZ' },
  { pattern: /Project Zomboid/i, name: 'Project Zomboid' },
  { pattern: /V Rising/i, name: 'V Rising' },
  { pattern: /Enshrouded/i, name: 'Enshrouded' },
  { pattern: /Palworld/i, name: 'Palworld' },
  { pattern: /Conan Exiles/i, name: 'Conan Exiles' },

  // === Simulation / Management ===
  { pattern: /Cities: Skylines/i, name: 'Cities: Skylines' },
  { pattern: /Satisfactory/i, name: 'Satisfactory' },
  { pattern: /Factorio/i, name: 'Factorio' },
  { pattern: /Rimworld/i, name: 'RimWorld' },
  { pattern: /Oxygen Not Included/i, name: 'Oxygen Not Included' },
  { pattern: /Stardew Valley/i, name: 'Stardew Valley' },
  { pattern: /Planet (Zoo|Coaster)/i, name: 'Planet Zoo/Coaster' },
  { pattern: /The Sims/i, name: 'The Sims' },
  { pattern: /Farming Simulator/i, name: 'Farming Simulator' },
  { pattern: /Euro Truck Simulator/i, name: 'Euro Truck Simulator' },
  { pattern: /American Truck Simulator/i, name: 'American Truck Simulator' },

  // === Horror ===
  { pattern: /Dead by Daylight/i, name: 'Dead by Daylight' },
  { pattern: /Phasmophobia/i, name: 'Phasmophobia' },
  { pattern: /Lethal Company/i, name: 'Lethal Company' },
  { pattern: /Resident Evil/i, name: 'Resident Evil' },
  { pattern: /Silent Hill/i, name: 'Silent Hill' },
  { pattern: /Outlast/i, name: 'Outlast' },
  { pattern: /Amnesia/i, name: 'Amnesia' },

  // === Roguelike / Roguelite ===
  { pattern: /Hades/i, name: 'Hades' },
  { pattern: /Dead Cells/i, name: 'Dead Cells' },
  { pattern: /Binding of Isaac/i, name: 'The Binding of Isaac' },
  { pattern: /Risk of Rain/i, name: 'Risk of Rain' },
  { pattern: /Slay the Spire/i, name: 'Slay the Spire' },
  { pattern: /Enter the Gungeon/i, name: 'Enter the Gungeon' },
  { pattern: /Vampire Survivors/i, name: 'Vampire Survivors' },
  { pattern: /Brotato/i, name: 'Brotato' },
  { pattern: /Rogue Legacy/i, name: 'Rogue Legacy' },

  // === Battle Royale ===
  { pattern: /Fortnite/i, name: 'Fortnite' },
  { pattern: /Warzone/i, name: 'Call of Duty: Warzone' },
  { pattern: /Fall Guys/i, name: 'Fall Guys' },

  // === MMO ===
  { pattern: /World of Warcraft/i, name: 'World of Warcraft' },
  { pattern: /WoW/i, name: 'World of Warcraft' },
  { pattern: /Guild Wars 2/i, name: 'Guild Wars 2' },
  { pattern: /Black Desert/i, name: 'Black Desert Online' },
  { pattern: /Lost Ark/i, name: 'Lost Ark' },
  { pattern: /New World/i, name: 'New World' },
  { pattern: /RuneScape/i, name: 'RuneScape' },

  // === Platformer / Metroidvania ===
  { pattern: /Hollow Knight/i, name: 'Hollow Knight' },
  { pattern: /Ori and the/i, name: 'Ori' },
  { pattern: /Celeste/i, name: 'Celeste' },
  { pattern: /Shovel Knight/i, name: 'Shovel Knight' },
  { pattern: /Blasphemous/i, name: 'Blasphemous' },

  // === AAA Open World ===
  { pattern: /Grand Theft Auto V/i, name: 'GTA V' },
  { pattern: /GTA V/i, name: 'GTA V' },
  { pattern: /Red Dead Redemption/i, name: 'Red Dead Redemption' },
  { pattern: /Starfield/i, name: 'Starfield' },
  { pattern: /Hogwarts Legacy/i, name: 'Hogwarts Legacy' },
  { pattern: /Spider-Man/i, name: 'Spider-Man' },
  { pattern: /God of War/i, name: 'God of War' },
  { pattern: /Assassin's Creed/i, name: "Assassin's Creed" },
  { pattern: /Far Cry/i, name: 'Far Cry' },
  { pattern: /Watch Dogs/i, name: 'Watch Dogs' },

  // === Racing ===
  { pattern: /Forza Horizon/i, name: 'Forza Horizon' },
  { pattern: /Forza Motorsport/i, name: 'Forza Motorsport' },
  { pattern: /Gran Turismo/i, name: 'Gran Turismo' },
  { pattern: /F1 (2024|2023)/i, name: 'F1' },
  { pattern: /iRacing/i, name: 'iRacing' },
  { pattern: /Assetto Corsa/i, name: 'Assetto Corsa' }
];

const LAUNCHER_SUFFIX_RE = /(steam|epic games|gog|gog galaxy|ubisoft connect|battle\.net|battlenet|ea app|origin|xbox|microsoft store|launcher)$/i;
const TITLE_NOISE_RE = /(beta|early access|demo|playtest|launcher|update|patch|build|directx|dx\d+)$/i;

function normalizeWindowTitle(text) {
  if (!text) return '';
  let cleaned = String(text).replace(/[™®]/g, '');

  cleaned = cleaned.replace(/\s*\(([^)]*)\)\s*/g, (match, inner) => {
    return TITLE_NOISE_RE.test(String(inner || '').trim()) ? ' ' : match;
  });

  cleaned = cleaned.replace(/\s*\[([^\]]*)\]\s*/g, (match, inner) => {
    const trimmed = String(inner || '').trim();
    return TITLE_NOISE_RE.test(trimmed) || LAUNCHER_SUFFIX_RE.test(trimmed) ? ' ' : match;
  });

  cleaned = cleaned.replace(/\b(v|ver|version)\s*\d+(\.\d+){0,3}\b/gi, ' ');

  const separators = [' - ', ' | ', ' — '];
  for (const sep of separators) {
    const idx = cleaned.lastIndexOf(sep);
    if (idx <= 0) continue;
    const suffix = cleaned.slice(idx + sep.length).trim();
    if (LAUNCHER_SUFFIX_RE.test(suffix)) {
      cleaned = cleaned.slice(0, idx);
    }
  }

  cleaned = cleaned.replace(/\s*[-–—]\s*(steam|epic games|gog|gog galaxy|ubisoft connect|battle\.net|battlenet|ea app|origin|xbox|microsoft store)\s*$/i, '');

  return cleaned.replace(/\s+/g, ' ').trim();
}

function shouldIgnoreWindowTitle(windowTitle, ignoreList) {
  if (!windowTitle) return true;
  for (const pattern of ALWAYS_IGNORE_PATTERNS) {
    if (pattern.test(windowTitle)) return true;
  }

  const list = Array.isArray(ignoreList) ? ignoreList : [];
  if (!list.length) return false;

  const lowered = windowTitle.toLowerCase();
  for (const entry of list) {
    const cleaned = String(entry || '').trim();
    if (!cleaned) continue;
    if (lowered.includes(cleaned.toLowerCase())) return true;
  }
  return false;
}

function matchGameFromText(text) {
  if (!text) return null;
  for (const { pattern, name } of GAME_PATTERNS) {
    if (pattern.test(text)) {
      return name;
    }
  }
  return null;
}

function extractGameName(windowTitle, ignoreList) {
  if (!windowTitle) return null;

  if (shouldIgnoreWindowTitle(windowTitle, ignoreList)) return null;

  const normalizedTitle = normalizeWindowTitle(windowTitle) || windowTitle;
  const datasetMatch = matchGameFromText(normalizedTitle);
  if (datasetMatch) {
    return datasetMatch;
  }

  for (const { pattern, name } of GAME_PATTERNS) {
    if (pattern.test(normalizedTitle) || pattern.test(windowTitle)) {
      return name;
    }
  }

  if (normalizedTitle && normalizedTitle !== windowTitle) {
    if (normalizedTitle.length > 3) {
      return normalizedTitle;
    }
  }

  if (windowTitle.includes('Steam') || windowTitle.includes('Epic Games')) {
    const cleaned = windowTitle
      .replace(/\s*-\s*Steam$/i, '')
      .replace(/\s*-\s*Epic Games$/i, '')
      .trim();
    if (cleaned && cleaned.length > 3) {
      return cleaned;
    }
  }

  return null;
}

module.exports = {
  extractGameName,
  matchGameFromText
};
