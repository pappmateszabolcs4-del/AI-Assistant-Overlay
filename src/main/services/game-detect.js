const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function createGameDetectService(deps) {
  const { registry, screen } = deps;

  const ALWAYS_IGNORE_PATTERNS = [
    /AIGameAssistant/i,
    /AI Game Assistant/i
  ];

  // Known game patterns (120+ popular games)
  const gamePatterns = [
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

  const DATASET_PATH = path.join(__dirname, '../../../data/games.json');
  let cachedDataset = null;
  let cachedIndex = null;
  let warnedMissingDataset = false;

  const COMMON_TERMS = new Set([
    'game', 'games', 'gaming', 'player', 'players', 'play', 'playing', 'build', 'guide', 'tips',
    'patch', 'update', 'meta', 'ranked', 'match', 'matches', 'online', 'offline', 'singleplayer',
    'multiplayer', 'co-op', 'coop', 'pvp', 'pve', 'story', 'mode', 'modes', 'level', 'levels',
    'quest', 'quests', 'mission', 'missions', 'item', 'items', 'loot', 'gear', 'weapon', 'weapons',
    'skill', 'skills', 'talent', 'talents', 'perk', 'perks', 'class', 'classes', 'boss', 'bosses'
  ]);

  const SHORT_STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'at', 'by', 'from', 'with'
  ]);

  function normalizeText(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeCompact(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '')
      .trim();
  }

  function tokenize(text) {
    const normalized = normalizeText(text);
    if (!normalized) return [];
    return normalized
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !COMMON_TERMS.has(token));
  }

  function hasWholeWord(text, word) {
    if (!text || !word) return false;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`);
    return regex.test(text);
  }

  function normalizeList(items) {
    if (!Array.isArray(items)) return [];
    const unique = new Set();
    for (const item of items) {
      const value = typeof item === 'string' ? item : item?.name;
      if (value) unique.add(value.trim());
    }
    return [...unique].filter(Boolean);
  }

  function loadDataset() {
    if (cachedDataset) return cachedDataset;
    try {
      if (!fs.existsSync(DATASET_PATH)) {
        if (!warnedMissingDataset) {
          console.warn(`[GAME-DETECT] Dataset not found at ${DATASET_PATH}. Falling back to regex patterns.`);
          warnedMissingDataset = true;
        }
        cachedDataset = { games: [] };
        return cachedDataset;
      }
      const raw = fs.readFileSync(DATASET_PATH, 'utf8');
      cachedDataset = JSON.parse(raw);
      return cachedDataset;
    } catch (err) {
      if (!warnedMissingDataset) {
        console.warn(`[GAME-DETECT] Failed to load dataset: ${err.message}`);
        warnedMissingDataset = true;
      }
      cachedDataset = { games: [] };
      return cachedDataset;
    }
  }

  function buildGameIndex() {
    if (cachedIndex) return cachedIndex;
    const dataset = loadDataset();
    const games = Array.isArray(dataset?.games) ? dataset.games : [];
    cachedIndex = games.map((game) => {
      const name = game?.name || '';
      const aliases = normalizeList(game?.aliases);
      const keywords = normalizeList(game?.keywords);
      const normalizedName = normalizeText(name);
      return {
        name,
        normalizedName,
        nameTokens: tokenize(name),
        aliasPhrases: aliases.map(normalizeText).filter(Boolean),
        keywordPhrases: keywords.map(normalizeText).filter(Boolean),
        compactNames: [normalizeCompact(name), ...aliases.map(normalizeCompact)].filter(Boolean)
      };
    });
    return cachedIndex;
  }

  function allTokensPresent(textTokens, requiredTokens) {
    if (!requiredTokens.length) return false;
    const tokenSet = new Set(textTokens);
    return requiredTokens.every((token) => tokenSet.has(token));
  }

  function scoreGameMatch(game, textNormalized, textTokens) {
    let score = 0;
    const shortName = (game.normalizedName || '').length <= 3;
    let hasNameSignal = false;
    const nameTokenCount = game.normalizedName ? game.normalizedName.split(' ').length : 0;
    let matchScore = 0;

    if (game.normalizedName && (!shortName || !SHORT_STOPWORDS.has(game.normalizedName)) && hasWholeWord(textNormalized, game.normalizedName)) {
      matchScore = Math.max(matchScore, 10 + nameTokenCount);
      hasNameSignal = true;
    }

    for (const alias of game.aliasPhrases) {
      if (!alias) continue;
      const aliasIsShort = alias.length <= 3;
      if (aliasIsShort && SHORT_STOPWORDS.has(alias)) continue;
      if (hasWholeWord(textNormalized, alias)) {
        const aliasTokenCount = alias.split(' ').length;
        matchScore = Math.max(matchScore, 9 + aliasTokenCount);
        hasNameSignal = true;
        break;
      }
    }

    if (matchScore < 8 && allTokensPresent(textTokens, game.nameTokens)) {
      matchScore = Math.max(matchScore, 6 + nameTokenCount);
      hasNameSignal = true;
    }

    score += matchScore;

    if (shortName && !hasNameSignal) {
      return 0;
    }

    let keywordHits = 0;
    if (hasNameSignal) {
      for (const term of game.keywordPhrases) {
        if (!term || term.length < 4 || COMMON_TERMS.has(term)) continue;
        if (textNormalized.includes(term)) keywordHits += 1;
        if (keywordHits >= 4) break;
      }
    }
    score += keywordHits;

    return score;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const rows = a.length + 1;
    const cols = b.length + 1;
    const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));
    for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
    for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
    for (let i = 1; i < rows; i += 1) {
      for (let j = 1; j < cols; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[rows - 1][cols - 1];
  }

  function fuzzyMatchName(textTokens, gameIndex) {
    const candidates = textTokens.filter((token) => token.length >= 6);
    if (!candidates.length) return null;

    let best = null;
    let secondBest = null;

    for (const game of gameIndex) {
      for (const name of game.compactNames) {
        if (!name || name.length < 6) continue;
        for (const token of candidates) {
          const compactToken = normalizeCompact(token);
          if (!compactToken) continue;
          if (Math.abs(compactToken.length - name.length) > 3) continue;
          const distance = levenshtein(compactToken, name);
          if (distance > 3) continue;
          const candidate = { name: game.name, distance, length: name.length };
          if (!best || distance < best.distance || (distance === best.distance && name.length > best.length)) {
            secondBest = best;
            best = candidate;
          } else if (!secondBest || distance < secondBest.distance) {
            secondBest = candidate;
          }
        }
      }
    }

    if (!best) return null;
    if (secondBest && secondBest.distance === best.distance) return null;
    return best.name;
  }

  function shouldIgnoreWindowTitle(windowTitle) {
    if (!windowTitle) return true;
    for (const pattern of ALWAYS_IGNORE_PATTERNS) {
      if (pattern.test(windowTitle)) return true;
    }

    const ignoreList = Array.isArray(registry.gameDetectIgnoreList)
      ? registry.gameDetectIgnoreList
      : [];
    if (!ignoreList.length) return false;

    const lowered = windowTitle.toLowerCase();
    for (const entry of ignoreList) {
      const cleaned = String(entry || '').trim();
      if (!cleaned) continue;
      if (lowered.includes(cleaned.toLowerCase())) return true;
    }
    return false;
  }

  function extractGameName(windowTitle) {
    if (!windowTitle) return null;

    if (shouldIgnoreWindowTitle(windowTitle)) return null;

    const datasetMatch = matchGameFromText(windowTitle);
    if (datasetMatch) {
      return datasetMatch;
    }

    for (const { pattern, name } of gamePatterns) {
      if (pattern.test(windowTitle)) {
        return name;
      }
    }

    // Ha nem ismert játék, de van "játék" szó benne vagy ismert platformok (Steam, Epic)
    if (windowTitle.includes('Steam') || windowTitle.includes('Epic Games')) {
      // Próbáljuk meg kiszűrni a játék nevét a cím elejéből
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

  function rememberGameDisplayFromCursor() {
    try {
      const pt = screen.getCursorScreenPoint();
      const display = screen.getDisplayNearestPoint(pt);
      if (display && typeof display.id !== 'undefined') {
        registry.lastKnownGameDisplayId = display.id;
        registry.lastKnownGameDisplayAt = Date.now();
      }
    } catch (_) {}
  }

  function matchGameFromText(text) {
    if (!text) return null;
    const textNormalized = normalizeText(text);
    const textTokens = tokenize(text);
    const gameIndex = buildGameIndex();

    if (gameIndex.length) {
      let best = null;
      let secondBest = null;
      for (const game of gameIndex) {
        const score = scoreGameMatch(game, textNormalized, textTokens);
        if (score <= 0) continue;
        const nameLength = (game.normalizedName || '').length;
        if (!best || score > best.score || (score === best.score && nameLength > best.nameLength)) {
          secondBest = best;
          best = { name: game.name, score, nameLength };
        } else if (!secondBest || score > secondBest.score || (score === secondBest.score && nameLength > secondBest.nameLength)) {
          secondBest = { name: game.name, score, nameLength };
        }
      }

      if (best && (best.score >= 8 || (best.score >= 4 && (!secondBest || best.score - secondBest.score >= 2)))) {
        return best.name;
      }

      const fuzzy = fuzzyMatchName(textTokens, gameIndex);
      if (fuzzy) return fuzzy;
      return null;
    }

    for (const { pattern, name } of gamePatterns) {
      if (pattern.test(text)) {
        return name;
      }
    }
    return null;
  }

  function getPreferredOverlayDisplay() {
    try {
      const now = Date.now();
      if (registry.lastKnownGameDisplayId != null && (now - registry.lastKnownGameDisplayAt) < 10 * 60 * 1000) {
        const displays = screen.getAllDisplays();
        const match = displays.find((d) => d && d.id === registry.lastKnownGameDisplayId);
        if (match) return match;
      }
    } catch (_) {}
    try {
      return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    } catch (_) {
      return screen.getPrimaryDisplay();
    }
  }

  function tryGetDisplayForGameWindow(gameName) {
    try {
      if (!gameName) return null;
      const scriptPath = path.join(__dirname, '..', '..', '..', 'get-window-bounds.ps1');
      const safe = String(gameName).replace(/"/g, '');
      const raw = execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -TitleContains "${safe}"`,
        { encoding: 'utf8', timeout: 2000, windowsHide: true }
      ).trim();
      if (!raw || raw === '{}' ) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data.left !== 'number' || typeof data.top !== 'number' || typeof data.right !== 'number' || typeof data.bottom !== 'number') {
        return null;
      }
      const cx = Math.round((data.left + data.right) / 2);
      const cy = Math.round((data.top + data.bottom) / 2);
      return screen.getDisplayNearestPoint({ x: cx, y: cy });
    } catch (_) {
      return null;
    }
  }

  // Detect current game function (used on startup and hotkey)
  function detectCurrentGame(force = false) {
    try {
      const now = Date.now();
      if (!force && (now - registry.lastGameDetectAt) < 800) {
        return;
      }
      registry.lastGameDetectAt = now;

      let detected = false;

      const activeScriptPath = path.join(__dirname, '..', '..', '..', 'get-active-window.ps1');
      const windowTitle = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${activeScriptPath}"`, {
        encoding: 'utf8',
        timeout: 2000,
        windowsHide: true
      }).trim();

      if (windowTitle) {
        const gameFromActive = extractGameName(windowTitle);
        if (gameFromActive) {
          registry.currentDetectedGame = gameFromActive;
          rememberGameDisplayFromCursor();
          detected = true;
        }
      }

      // Ha az aktív ablak nem játék (pl. VS Code), akkor végigszkenneljük az összes ablak címet
      if (!registry.currentDetectedGame) {
        const listScriptPath = path.join(__dirname, '..', '..', '..', 'get-window-titles.ps1');
        const titlesRaw = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${listScriptPath}"`, {
          encoding: 'utf8',
          timeout: 2000,
          windowsHide: true
        });
        const titles = titlesRaw
          .split(/\r?\n/)
          .map((t) => t.trim())
          .filter(Boolean);

        for (const title of titles) {
          const game = extractGameName(title);
          if (game) {
            registry.currentDetectedGame = game;
            detected = true;
            break;
          }
        }
      }

      if (!detected) {
        registry.currentDetectedGame = null;
      }
    } catch (error) {
      console.error('[GAME] Detection failed:', error.message);
    }
  }

  return {
    extractGameName,
    matchGameFromText,
    detectCurrentGame,
    getPreferredOverlayDisplay,
    tryGetDisplayForGameWindow
  };
}

module.exports = {
  createGameDetectService
};
