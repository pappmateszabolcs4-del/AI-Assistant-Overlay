const fs = require('fs');
const path = require('path');
const { DEFAULT_LANG, normalizeLang } = require('./ui-text');

const SUPPORTED_AI_LANGS = ['hu', 'en', 'de', 'ru', 'fr', 'zh', 'es', 'it', 'pl'];
const AI_TEXT_DIR = path.join(__dirname, '../../../data/ai-text');
const AI_TEXT_CACHE = new Map();
const AI_TEXT_MERGED_CACHE = new Map();

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function loadLanguageData(language) {
  const normalized = normalizeLang(language);
  if (AI_TEXT_CACHE.has(normalized)) return AI_TEXT_CACHE.get(normalized);
  const filePath = path.join(AI_TEXT_DIR, `${normalized}.json`);
  const data = readJsonFile(filePath);
  AI_TEXT_CACHE.set(normalized, data);
  return data;
}

function mergeDeep(base, override) {
  if (!override || typeof override !== 'object') return base;
  if (Array.isArray(base) || Array.isArray(override)) {
    return Array.isArray(override) && override.length ? override.slice() : base;
  }
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const baseValue = base ? base[key] : undefined;
    if (Array.isArray(value)) {
      result[key] = value.slice();
    } else if (value && typeof value === 'object') {
      result[key] = mergeDeep(baseValue && typeof baseValue === 'object' ? baseValue : {}, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function getMergedAiText(lang) {
  const language = normalizeLang(lang);
  if (AI_TEXT_MERGED_CACHE.has(language)) return AI_TEXT_MERGED_CACHE.get(language);
  const base = loadLanguageData(DEFAULT_LANG);
  if (language === DEFAULT_LANG) {
    AI_TEXT_MERGED_CACHE.set(language, base);
    return base;
  }
  const override = loadLanguageData(language);
  const merged = mergeDeep(base, override);
  AI_TEXT_MERGED_CACHE.set(language, merged);
  return merged;
}

function getBaseAndExtra(lang) {
  const language = normalizeLang(lang);
  const base = loadLanguageData(DEFAULT_LANG);
  const extra = language === DEFAULT_LANG ? {} : loadLanguageData(language);
  return { base, extra };
}

function getDetailPromptConfig(lang, level) {
  const data = getMergedAiText(lang);
  const map = data.detailMap || {};
  const resolvedLevel = Math.max(1, Math.min(5, level || 3));
  return map[String(resolvedLevel)] || map[resolvedLevel] || map['3'] || map[3] || { suffix: '', maxTokens: 1600 };
}

function normalizeAiLang(lang) {
  const normalized = normalizeLang(lang);
  return SUPPORTED_AI_LANGS.includes(normalized) ? normalized : DEFAULT_LANG;
}

function getMaxTokensForDetailLevel(lang, level) {
  const detail = getDetailPromptConfig(lang, level);
  const maxTokens = Number.isFinite(detail && detail.maxTokens) ? detail.maxTokens : 1600;
  return Math.max(1, maxTokens);
}

function getStrictPolicyText(lang) {
  const data = getMergedAiText(lang);
  return data.strictPolicy || '';
}

function getAntiHallucinationText(lang) {
  const data = getMergedAiText(lang);
  return data.antiHallucination || '';
}

function getKnowledgeTemplates(lang) {
  const data = getMergedAiText(lang);
  return data.knowledgeTemplates || {};
}

function getEntityWhitelistTemplates(lang) {
  const data = getMergedAiText(lang);
  return data.entityWhitelistTemplates || {};
}

function getEntityRedactionText(lang) {
  const data = getMergedAiText(lang);
  return data.entityRedactionText || '';
}

function getEntityRedactionReplacement(lang, kind) {
  const data = getMergedAiText(lang);
  const replacements = data.entityRedactionReplacements || {};
  if (!replacements || typeof replacements !== 'object') return '';
  if (kind && replacements[kind]) return replacements[kind];
  return replacements.generic || '';
}

function getGameContextPromptText(lang, gameName) {
  if (!gameName) return '';
  const data = getMergedAiText(lang);
  const template = data.gameContextPrompt || '';
  return template.replace(/\{game\}/g, gameName);
}

function getTemplatePromptLabels(lang) {
  const data = getMergedAiText(lang);
  return data.templatePromptLabels || {};
}

function getTemplateSectionLabels(lang) {
  const data = getMergedAiText(lang);
  return data.templateSectionLabels || {};
}

function getTemplateGuidanceIntro(lang) {
  const data = getMergedAiText(lang);
  return data.templateGuidanceIntro || '';
}

function getProfilePromptLabels(lang) {
  const data = getMergedAiText(lang);
  return data.profilePromptLabels || {};
}

function getIntentRoutingDefaultHeader(lang) {
  const data = getMergedAiText(lang);
  return data.intentRoutingHeader || '';
}

function getVisionPromptTemplates(lang) {
  const data = getMergedAiText(lang);
  return data.visionPrompts || {};
}

function getDefaultGameTemplate(lang) {
  const data = getMergedAiText(lang);
  return data.defaultGameTemplate || '';
}

function getNoLinkAccessPrompt(lang) {
  const data = getMergedAiText(lang);
  return data.noLinkAccessPrompt || '';
}

function getAnswerStyleTemplates(lang) {
  const data = getMergedAiText(lang);
  return data.answerStyleTemplates || {};
}

function getFactsHeaderText(lang) {
  const data = getMergedAiText(lang);
  return data.factsHeader || '';
}

function getNameGuardTemplates(lang) {
  const data = getMergedAiText(lang);
  return data.nameGuardTemplates || {};
}

function getCharacterNegationMarkers(lang) {
  const { base, extra } = getBaseAndExtra(lang);
  const baseList = Array.isArray(base.characterNegationMarkers) ? base.characterNegationMarkers : [];
  const extraList = Array.isArray(extra.characterNegationMarkers) ? extra.characterNegationMarkers : [];
  return baseList.concat(extraList);
}

function getUserMentionableMarkers(lang) {
  const { base, extra } = getBaseAndExtra(lang);
  const baseList = Array.isArray(base.userMentionableMarkers) ? base.userMentionableMarkers : [];
  const extraList = Array.isArray(extra.userMentionableMarkers) ? extra.userMentionableMarkers : [];
  return baseList.concat(extraList);
}

function getEntityMarkerPatterns(lang) {
  const { base, extra } = getBaseAndExtra(lang);
  const baseList = Array.isArray(base.entityMarkerPatterns) ? base.entityMarkerPatterns : [];
  const extraList = Array.isArray(extra.entityMarkerPatterns) ? extra.entityMarkerPatterns : [];
  return baseList.concat(extraList);
}

function getEntityStopWords(lang) {
  const { base, extra } = getBaseAndExtra(lang);
  const baseList = Array.isArray(base.entityStopWords) ? base.entityStopWords : [];
  const extraList = Array.isArray(extra.entityStopWords) ? extra.entityStopWords : [];
  return baseList.concat(extraList);
}

function getHighRiskIntents() {
  const data = getMergedAiText(DEFAULT_LANG);
  const list = Array.isArray(data.highRiskIntents) ? data.highRiskIntents : [];
  return list.slice();
}

function getHighRiskPatterns(lang) {
  const { base, extra } = getBaseAndExtra(lang);
  const baseList = Array.isArray(base.highRiskPatterns) ? base.highRiskPatterns : [];
  const extraList = Array.isArray(extra.highRiskPatterns) ? extra.highRiskPatterns : [];
  return baseList.concat(extraList);
}

function getTroubleshootPatterns(lang) {
  const { base, extra } = getBaseAndExtra(lang);
  const baseList = Array.isArray(base.troubleshootPatterns) ? base.troubleshootPatterns : [];
  const extraList = Array.isArray(extra.troubleshootPatterns) ? extra.troubleshootPatterns : [];
  return baseList.concat(extraList);
}

function getMultiTurnHints(lang) {
  const { base, extra } = getBaseAndExtra(lang);
  const baseList = Array.isArray(base.multiTurnHints) ? base.multiTurnHints : [];
  const extraList = Array.isArray(extra.multiTurnHints) ? extra.multiTurnHints : [];
  return baseList.concat(extraList);
}

function getOpenAiLogText() {
  const data = getMergedAiText(DEFAULT_LANG);
  const source = data.openAiLogText && typeof data.openAiLogText === 'object' ? data.openAiLogText : {};
  return { ...source };
}

function getUiTranslationSystemPrompt() {
  const data = getMergedAiText(DEFAULT_LANG);
  return data.uiTranslationSystemPrompt || '';
}

function getSystemBasePrompt(lang) {
  const data = getMergedAiText(lang);
  return data.systemBasePrompt || '';
}

function getStrictOverridePrompt(lang) {
  const data = getMergedAiText(lang);
  return data.strictOverridePrompt || '';
}

module.exports = {
  getDetailPromptConfig,
  normalizeAiLang,
  getMaxTokensForDetailLevel,
  getStrictPolicyText,
  getAntiHallucinationText,
  getKnowledgeTemplates,
  getEntityWhitelistTemplates,
  getEntityRedactionText,
  getEntityRedactionReplacement,
  getGameContextPromptText,
  getTemplatePromptLabels,
  getTemplateSectionLabels,
  getTemplateGuidanceIntro,
  getProfilePromptLabels,
  getIntentRoutingDefaultHeader,
  getVisionPromptTemplates,
  getDefaultGameTemplate,
  getNoLinkAccessPrompt,
  getAnswerStyleTemplates,
  getFactsHeaderText,
  getNameGuardTemplates,
  getCharacterNegationMarkers,
  getUserMentionableMarkers,
  getEntityMarkerPatterns,
  getEntityStopWords,
  getHighRiskIntents,
  getHighRiskPatterns,
  getTroubleshootPatterns,
  getMultiTurnHints,
  getOpenAiLogText,
  getUiTranslationSystemPrompt,
  getSystemBasePrompt,
  getStrictOverridePrompt
};
