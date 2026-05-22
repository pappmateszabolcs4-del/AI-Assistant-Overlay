const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

const CACHE_TTL_MS = Number(process.env.GAME_TEMPLATE_CACHE_TTL_MS || 10 * 1000);
const TEMPLATE_FILE_NAME = 'game-templates.json';

let cachedTemplates = null;
let cachedAt = 0;

function normalizeTemplateKey(value) {
  return String(value || '').trim().toLowerCase();
}

function getTemplatesPath() {
  try {
    return path.join(app.getPath('userData'), TEMPLATE_FILE_NAME);
  } catch (_) {
    return path.join(os.tmpdir(), TEMPLATE_FILE_NAME);
  }
}

function loadTemplates() {
  const now = Date.now();
  if (cachedTemplates && (now - cachedAt) < CACHE_TTL_MS) return cachedTemplates;

  const filePath = getTemplatesPath();
  try {
    if (!fs.existsSync(filePath)) {
      cachedTemplates = { version: 1, templates: [] };
      cachedAt = now;
      return cachedTemplates;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const templates = Array.isArray(parsed && parsed.templates) ? parsed.templates : [];
    cachedTemplates = { version: 1, templates };
    cachedAt = now;
    return cachedTemplates;
  } catch (_) {
    cachedTemplates = { version: 1, templates: [] };
    cachedAt = now;
    return cachedTemplates;
  }
}

function saveTemplates(payload) {
  const filePath = getTemplatesPath();
  const data = {
    version: 1,
    templates: Array.isArray(payload && payload.templates) ? payload.templates : []
  };
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  cachedTemplates = data;
  cachedAt = Date.now();
  return data;
}

function listTemplates() {
  return loadTemplates().templates;
}

function getTemplateEntryForGame(gameName) {
  if (!gameName) return null;
  const key = normalizeTemplateKey(gameName);
  const templates = listTemplates();
  for (const entry of templates) {
    if (!entry || !entry.game) continue;
    const entryKey = normalizeTemplateKey(entry.game);
    if (entryKey && entryKey === key) return entry;
    const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
    for (const alias of aliases) {
      if (normalizeTemplateKey(alias) === key) return entry;
    }
  }
  return null;
}

function getTemplateForGame(gameName) {
  const entry = getTemplateEntryForGame(gameName);
  if (!entry || !entry.template) return '';
  return String(entry.template).trim();
}

function normalizeAnswerStyle(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'short' || raw === 'steps' || raw === 'deep') return raw;
  return '';
}

function upsertTemplate(gameName, template, aliases, options, answerStyle, autoSeededAt) {
  const game = String(gameName || '').trim();
  const body = String(template || '').trim();
  const optionList = Array.isArray(options) ? options.filter(Boolean) : [];
  const styleInputProvided = typeof answerStyle !== 'undefined';
  const normalizedStyle = styleInputProvided ? normalizeAnswerStyle(answerStyle) : '';
  const hasStyle = !!normalizedStyle;
  if (!game) return { success: false, error: 'missing-game' };
  if (!body && optionList.length === 0 && !hasStyle) {
    return { success: false, error: 'missing-template' };
  }

  const templates = listTemplates();
  const key = normalizeTemplateKey(game);
  const idx = templates.findIndex((entry) => normalizeTemplateKey(entry && entry.game) === key);
  const existing = idx >= 0 ? templates[idx] : null;
  const resolvedStyle = styleInputProvided ? normalizedStyle : normalizeAnswerStyle(existing && existing.answerStyle);
  const resolvedAutoSeededAt = Number.isFinite(autoSeededAt)
    ? autoSeededAt
    : (Number.isFinite(existing && existing.autoSeededAt) ? existing.autoSeededAt : null);
  const entry = {
    game,
    template: body,
    aliases: Array.isArray(aliases) ? aliases.filter(Boolean) : [],
    options: optionList,
    answerStyle: resolvedStyle,
    autoSeededAt: resolvedAutoSeededAt,
    updatedAt: Date.now()
  };

  if (idx >= 0) templates[idx] = entry;
  else templates.push(entry);

  saveTemplates({ templates });
  return { success: true };
}

function deleteTemplate(gameName) {
  const key = normalizeTemplateKey(gameName);
  if (!key) return { success: false, error: 'missing-game' };
  const templates = listTemplates().filter((entry) => normalizeTemplateKey(entry && entry.game) !== key);
  saveTemplates({ templates });
  return { success: true };
}

module.exports = {
  listTemplates,
  getTemplateEntryForGame,
  getTemplateForGame,
  upsertTemplate,
  deleteTemplate
};
