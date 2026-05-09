const { ipcRenderer } = require('electron');
const { IPC_CHANNELS } = require('../ipc-channels');
const { STORAGE_KEYS } = require('../storage-keys');
const { DEFAULT_LANG, getUiText, getMissingKeys, normalizeLang } = require('./ui-text');

const OVERRIDES_STORAGE_KEY = STORAGE_KEYS.UI_TEXT_OVERRIDES || 'uiTextOverrides';

function readOverrides() {
  try {
    const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeOverrides(overrides) {
  try {
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides || {}));
  } catch (_) {}
}

function getLangOverrides(allOverrides, lang) {
  if (!allOverrides || typeof allOverrides !== 'object') return {};
  const normalized = normalizeLang(lang);
  const entry = allOverrides[normalized];
  return entry && typeof entry === 'object' ? entry : {};
}

function createRendererI18n(options = {}) {
  let currentLang = normalizeLang(options.lang || DEFAULT_LANG);
  let overrides = readOverrides();
  let bundle = getUiText(currentLang, getLangOverrides(overrides, currentLang));

  async function ensureTranslations(lang) {
    const normalized = normalizeLang(lang || currentLang);
    const langOverrides = getLangOverrides(overrides, normalized);
    const missingKeys = getMissingKeys(normalized, langOverrides);
    if (!missingKeys.length || normalized === DEFAULT_LANG) return false;

    const entries = missingKeys.map((key) => ({ key, text: getUiText(DEFAULT_LANG)[key] }));
    let result = null;
    try {
      result = await ipcRenderer.invoke(IPC_CHANNELS.TRANSLATE_UI_TEXT, {
        lang: normalized,
        entries
      });
    } catch (_) {
      return false;
    }

    if (!result || !result.success || !result.translations) return false;

    overrides = readOverrides();
    const updated = { ...(getLangOverrides(overrides, normalized) || {}) };
    for (const [key, value] of Object.entries(result.translations)) {
      if (typeof value === 'string' && value.trim()) {
        updated[key] = value;
      }
    }
    overrides[normalized] = updated;
    writeOverrides(overrides);

    bundle = getUiText(normalized, updated);
    if (typeof options.onUpdate === 'function') {
      options.onUpdate(bundle);
    }
    return true;
  }

  function setLang(nextLang) {
    currentLang = normalizeLang(nextLang || DEFAULT_LANG);
    overrides = readOverrides();
    bundle = getUiText(currentLang, getLangOverrides(overrides, currentLang));
    if (typeof options.onUpdate === 'function') {
      options.onUpdate(bundle);
    }
    return ensureTranslations(currentLang);
  }

  function t() {
    return bundle;
  }

  return {
    t,
    setLang,
    ensureTranslations
  };
}

module.exports = {
  createRendererI18n
};
