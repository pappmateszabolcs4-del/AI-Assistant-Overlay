const fs = require('fs');
const path = require('path');

const CACHE_TTL_MS = Number(process.env.GAME_META_CACHE_TTL_MS || 5 * 60 * 1000);

let cachedEntries = [];
let cachedAt = 0;

function normalizePath(value) {
  if (!value) return '';
  return path.normalize(String(value)).replace(/\\+$/g, '').toLowerCase();
}

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return null;
  }
}

function parseVdfValue(vdf, key) {
  const regex = new RegExp(`"${key}"\\s+"([^"]+)"`, 'i');
  const match = vdf.match(regex);
  return match ? match[1] : '';
}

function getSteamRoot() {
  const pf86 = process.env['ProgramFiles(x86)'];
  const pf = process.env.ProgramFiles;
  const candidates = [
    pf86 && path.join(pf86, 'Steam'),
    pf && path.join(pf, 'Steam')
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function getSteamLibraryFolders() {
  const root = getSteamRoot();
  if (!root) return [];
  const libraryFile = path.join(root, 'steamapps', 'libraryfolders.vdf');
  const raw = safeReadFile(libraryFile);
  if (!raw) return [];

  const folders = new Set();
  const pathRegex = /"path"\s+"([^"]+)"/gi;
  let match = null;
  while ((match = pathRegex.exec(raw)) !== null) {
    if (match[1]) folders.add(match[1]);
  }

  if (!folders.size) {
    const legacyRegex = /"\d+"\s+"([^"]+)"/g;
    while ((match = legacyRegex.exec(raw)) !== null) {
      if (match[1]) folders.add(match[1]);
    }
  }

  const list = [...folders].filter(Boolean);
  if (root) list.unshift(root);
  return list;
}

function loadSteamEntries() {
  const entries = [];
  const libraries = getSteamLibraryFolders();
  for (const lib of libraries) {
    const steamApps = path.join(lib, 'steamapps');
    if (!fs.existsSync(steamApps)) continue;
    const files = fs.readdirSync(steamApps).filter((name) => name.startsWith('appmanifest_') && name.endsWith('.acf'));
    for (const file of files) {
      const fullPath = path.join(steamApps, file);
      const raw = safeReadFile(fullPath);
      if (!raw) continue;
      const appId = parseVdfValue(raw, 'appid');
      const title = parseVdfValue(raw, 'name');
      const installDir = parseVdfValue(raw, 'installdir');
      if (!title || !installDir) continue;
      const installPath = path.join(steamApps, 'common', installDir);
      entries.push({
        source: 'steam',
        appId,
        title,
        installPath
      });
    }
  }
  return entries;
}

function getEpicManifestDir() {
  const programData = process.env.ProgramData || 'C:\\ProgramData';
  return path.join(programData, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
}

function loadEpicEntries() {
  const entries = [];
  const manifestDir = getEpicManifestDir();
  if (!fs.existsSync(manifestDir)) return entries;
  const files = fs.readdirSync(manifestDir).filter((name) => name.endsWith('.item'));
  for (const file of files) {
    const fullPath = path.join(manifestDir, file);
    const raw = safeReadFile(fullPath);
    if (!raw) continue;
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      continue;
    }
    if (!data) continue;
    const installPath = data.InstallLocation || data.InstallPath || '';
    const title = data.DisplayName || data.AppName || '';
    const appId = data.AppName || data.CatalogItemId || '';
    if (!installPath || !title) continue;
    entries.push({
      source: 'epic',
      appId,
      title,
      installPath
    });
  }
  return entries;
}

function loadMetadataEntries() {
  const entries = [];
  entries.push(...loadSteamEntries());
  entries.push(...loadEpicEntries());
  return entries;
}

function refreshCacheIfNeeded() {
  const now = Date.now();
  if (cachedEntries.length && (now - cachedAt) < CACHE_TTL_MS) return;
  cachedEntries = loadMetadataEntries();
  cachedAt = now;
}

function resolveMetadataForProcess(processInfo) {
  if (!processInfo || !processInfo.path) return null;
  refreshCacheIfNeeded();
  if (!cachedEntries.length) return null;

  const processPath = normalizePath(processInfo.path);
  let best = null;
  for (const entry of cachedEntries) {
    if (!entry || !entry.installPath) continue;
    const installPath = normalizePath(entry.installPath);
    if (!installPath) continue;
    if (processPath.startsWith(installPath)) {
      if (!best || installPath.length > best.installPath.length) {
        best = {
          source: entry.source,
          appId: entry.appId || '',
          title: entry.title || '',
          installPath: entry.installPath
        };
      }
    }
  }

  return best;
}

module.exports = {
  resolveMetadataForProcess
};
