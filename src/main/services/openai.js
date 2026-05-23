const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');
const { getTemplateEntryForGame } = require('./game-template-store');
const { addFactRequest, loadMentionables, updateUsage } = require('./game-facts-store');
const { IPC_CHANNELS } = require('../../shared/ipc-channels');
const { isDev } = require('../../shared/app-env');
const {
  AI_MODELS,
  AI_KNOWLEDGE_MODES,
  AI_MODEL_LABELS,
  AI_TIMEOUT_FALLBACK,
  AI_DIAG_PREFIX,
  AI_DIAG_EVENTS,
  AI_MODEL_REASON_CODES,
  AI_ERROR_CODES,
  AI_INTENT_UNKNOWN,
  AI_INTENT_ROUTING_ISSUES,
  AI_PROMPT_SEGMENTS,
  AI_PROMPT_TRIM_POLICY,
  AI_DIAG_PREVIEW_MAX_CHARS
} = require('../../shared/ai-constants');
const {
  getDetailPromptConfig,
  getMaxTokensForDetailLevel,
  normalizeAiLang,
  getStrictPolicyText,
  getAntiHallucinationText,
  getKnowledgeTemplates: getKnowledgeTemplatesText,
  getEntityWhitelistTemplates,
  getGameContextPromptText,
  getTemplatePromptLabels: getTemplatePromptLabelsText,
  getTemplateSectionLabels: getTemplateSectionLabelsText,
  getTemplateGuidanceIntro: getTemplateGuidanceIntroText,
  getProfilePromptLabels: getProfilePromptLabelsText,
  getIntentRoutingDefaultHeader,
  getVisionPromptTemplates,
  getDefaultGameTemplate: getDefaultGameTemplateText,
  getNoLinkAccessPrompt: getNoLinkAccessPromptText,
  getAnswerStyleTemplates,
  getFactsHeaderText,
  getNameGuardTemplates,
  getCharacterNegationMarkers,
  getUserMentionableMarkers,
  getEntityMarkerPatterns,
  getEntityStopWords,
  getEntityRedactionText,
  getEntityRedactionReplacement,
  getHighRiskIntents,
  getHighRiskPatterns,
  getTroubleshootPatterns,
  getMultiTurnHints,
  getOpenAiLogText,
  getUiTranslationSystemPrompt,
  getSystemBasePrompt,
  getStrictOverridePrompt
} = require('../../shared/i18n/ai-text');
const TEMPLATE_OPTIONS_PATH = path.join(__dirname, '../../../data/game-template-options.json');
const TEMPLATE_OPTIONS_TTL_MS = Number(process.env.GAME_TEMPLATE_OPTIONS_TTL_MS || 10 * 1000);
const INTENT_ROUTING_PATH = path.join(__dirname, '../../../data/intent-routing.json');
const INTENT_ROUTING_TTL_MS = Number(process.env.INTENT_ROUTING_TTL_MS || 10 * 1000);
const RESPONSE_TEMPLATES_PATH = path.join(__dirname, '../../../data/response-templates.json');
const RESPONSE_TEMPLATES_TTL_MS = Number(process.env.RESPONSE_TEMPLATES_TTL_MS || 10 * 1000);
const GAME_DATA_DIR = path.join(__dirname, '../../../data/games');
const GAME_DATA_TTL_MS = Number(process.env.GAME_DATA_TTL_MS || 10 * 1000);
let cachedTemplateOptions = null;
let cachedTemplateOptionsAt = 0;
let cachedIntentRouting = null;
let cachedIntentRoutingAt = 0;
let cachedResponseTemplates = null;
let cachedResponseTemplatesAt = 0;
const cachedGameProfiles = new Map();
const cachedGameFacts = new Map();

function createOpenAIService(deps) {
  const {
    OpenAI,
    keytar,
    registry,
    detectCurrentGame,
    matchGameFromText,
    getCurrentLanguage
  } = deps;

  const { game } = registry;

  let openai = null;

  function normalizeLanguage(lang) {
    return normalizeAiLang(lang);
  }

  function getDefaultGameTemplate(lang) {
    return getDefaultGameTemplateText(lang);
  }

  function normalizeAnswerStyle(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'short' || raw === 'steps' || raw === 'deep') return raw;
    return '';
  }

  function buildAnswerStylePrompt(style, lang) {
    const normalized = normalizeAnswerStyle(style);
    if (!normalized) return '';
    const selected = getAnswerStyleTemplates(lang);
    return selected[normalized] || '';
  }

  function normalizeGameKey(gameName) {
    const raw = String(gameName || '').toLowerCase();
    if (!raw) return '';
    return raw
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  function truncateForLog(text, maxChars) {
    const raw = String(text || '');
    const limit = Number.isFinite(maxChars) ? Math.max(0, maxChars) : 0;
    if (!limit || raw.length <= limit) return raw;
    return `${raw.slice(0, limit)}…`;
  }

  function getGameDataDirs() {
    const dirs = [];
    try {
      dirs.push(path.join(app.getPath('userData'), 'games'));
    } catch (_) {}
    dirs.push(GAME_DATA_DIR);
    return dirs;
  }

  function loadResponseTemplates() {
    const now = Date.now();
    if (cachedResponseTemplates && (now - cachedResponseTemplatesAt) < RESPONSE_TEMPLATES_TTL_MS) {
      return cachedResponseTemplates;
    }
    try {
      if (!fs.existsSync(RESPONSE_TEMPLATES_PATH)) {
        cachedResponseTemplates = { default: null };
        cachedResponseTemplatesAt = now;
        return cachedResponseTemplates;
      }
      const raw = fs.readFileSync(RESPONSE_TEMPLATES_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      cachedResponseTemplates = parsed && typeof parsed === 'object' ? parsed : { default: null };
      cachedResponseTemplatesAt = now;
      return cachedResponseTemplates;
    } catch (_) {
      cachedResponseTemplates = { default: null };
      cachedResponseTemplatesAt = now;
      return cachedResponseTemplates;
    }
  }

  function getResponseTemplate(intentId, lang) {
    const templates = loadResponseTemplates();
    const language = normalizeLanguage(lang);
    const base = templates && templates.default ? templates.default : null;
    const specific = intentId && templates && templates[intentId] ? templates[intentId] : null;
    const chosen = specific || base || {};
    const prompts = chosen && chosen.prompts && typeof chosen.prompts === 'object' ? chosen.prompts : {};
    const prompt = prompts[language] || prompts.en || '';
    const deterministic = chosen && chosen.deterministic ? chosen.deterministic : null;
    return {
      id: intentId || 'default',
      prompt: String(prompt || '').trim(),
      deterministic,
      useFacts: chosen && typeof chosen.useFacts === 'boolean' ? chosen.useFacts : false,
      useProfile: chosen && typeof chosen.useProfile === 'boolean' ? chosen.useProfile : false,
      maxFacts: Number.isFinite(chosen && chosen.maxFacts) ? Math.max(0, chosen.maxFacts) : 0
    };
  }

  function loadGameProfile(gameName) {
    const key = normalizeGameKey(gameName);
    if (!key) return null;
    const now = Date.now();
    const cached = cachedGameProfiles.get(key);
    if (cached && (now - cached.at) < GAME_DATA_TTL_MS) {
      return cached.data;
    }
    try {
      const baseDirs = getGameDataDirs();
      for (const baseDir of baseDirs) {
        const directPath = path.join(baseDir, key, 'profile.json');
        if (fs.existsSync(directPath)) {
          const raw = fs.readFileSync(directPath, 'utf8');
          const parsed = JSON.parse(raw);
          const data = parsed && typeof parsed === 'object' ? parsed : null;
          cachedGameProfiles.set(key, { data, at: now });
          return data;
        }
      }
      for (const baseDir of baseDirs) {
        const fallbackPath = path.join(baseDir, '_default', 'profile.json');
        if (fs.existsSync(fallbackPath)) {
          const raw = fs.readFileSync(fallbackPath, 'utf8');
          const parsed = JSON.parse(raw);
          const data = parsed && typeof parsed === 'object' ? parsed : null;
          cachedGameProfiles.set(key, { data, at: now });
          return data;
        }
      }
      cachedGameProfiles.set(key, { data: null, at: now });
      return null;
    } catch (_) {
      cachedGameProfiles.set(key, { data: null, at: now });
      return null;
    }
  }

  function loadGameFacts(gameName) {
    const key = normalizeGameKey(gameName);
    if (!key) return [];
    const now = Date.now();
    const cached = cachedGameFacts.get(key);
    if (cached && (now - cached.at) < GAME_DATA_TTL_MS) {
      return cached.data;
    }
    try {
      const baseDirs = getGameDataDirs();
      for (const baseDir of baseDirs) {
        const directPath = path.join(baseDir, key, 'facts.json');
        if (fs.existsSync(directPath)) {
          const raw = fs.readFileSync(directPath, 'utf8');
          const parsed = JSON.parse(raw);
          const list = Array.isArray(parsed && parsed.facts) ? parsed.facts : [];
          cachedGameFacts.set(key, { data: list, at: now });
          return list;
        }
      }
      for (const baseDir of baseDirs) {
        const fallbackPath = path.join(baseDir, '_default', 'facts.json');
        if (fs.existsSync(fallbackPath)) {
          const raw = fs.readFileSync(fallbackPath, 'utf8');
          const parsed = JSON.parse(raw);
          const list = Array.isArray(parsed && parsed.facts) ? parsed.facts : [];
          cachedGameFacts.set(key, { data: list, at: now });
          return list;
        }
      }
      cachedGameFacts.set(key, { data: [], at: now });
      return [];
    } catch (_) {
      cachedGameFacts.set(key, { data: [], at: now });
      return [];
    }
  }

  function normalizeFactText(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function tokenizeText(text) {
    const normalized = normalizeFactText(text);
    if (!normalized) return [];
    return normalized
      .split(/[^\p{L}\p{N}]+/gu)
      .filter(Boolean);
  }

  function scoreFact(fact, text, tokens, intentId) {
    if (!fact || !fact.text) return 0;
    const keywords = []
      .concat(Array.isArray(fact.keywords) ? fact.keywords : [])
      .concat(Array.isArray(fact.tags) ? fact.tags : []);
    let score = 0;
    const normalizedTokens = Array.isArray(tokens) ? tokens : [];
    const tokenMatchesKeyword = (keyword) => {
      if (!keyword) return false;
      if (keyword.includes(' ')) return text.includes(keyword);
      if (normalizedTokens.includes(keyword)) return true;
      if (keyword.length < 4) return false;
      return normalizedTokens.some((token) => token.startsWith(keyword) || keyword.startsWith(token));
    };
    for (const raw of keywords) {
      const keyword = normalizeFactText(raw);
      if (!keyword) continue;
      if (tokenMatchesKeyword(keyword)) score += 2;
    }
    if (!keywords.length || score === 0) {
      const factTokens = tokenizeText(fact.text);
      let hits = 0;
      for (const token of factTokens) {
        if (normalizedTokens.includes(token)) {
          hits += 1;
        } else if (token.length >= 4 && normalizedTokens.some((entry) => entry.startsWith(token) || token.startsWith(entry))) {
          hits += 1;
        }
      }
      if (hits > 0) score += Math.min(4, hits);
    }
    if (intentId && Array.isArray(fact.tags) && fact.tags.includes(intentId)) {
      score += 1;
    }
    const priority = Number.isFinite(fact.priority) ? fact.priority : 0;
    return score + priority * 0.1;
  }

  function selectFacts(text, facts, intentId, maxFacts) {
    const normalized = normalizeFactText(text);
    const tokens = tokenizeText(text);
    const limit = Number.isFinite(maxFacts) ? Math.max(0, maxFacts) : 0;
    const scored = facts
      .map((fact) => ({
        fact,
        score: scoreFact(fact, normalized, tokens, intentId)
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, limit || 0).map((entry) => entry.fact);
    return selected;
  }

  function buildFactsPrompt(facts, lang) {
    if (!Array.isArray(facts) || !facts.length) return '';
    const header = getFactsHeaderText(lang);
    const lines = facts
      .map((fact) => String(fact && fact.text || '').trim())
      .filter((text) => text);
    if (!lines.length) return '';
    return `${header}\n- ${lines.join('\n- ')}`;
  }

  function extractAllowedNamesFromFacts(facts) {
    if (!Array.isArray(facts) || !facts.length) return [];
    const joined = facts.map((fact) => String(fact && fact.text || '').trim()).join(' ');
    if (!joined) return [];
    return extractPotentialNames(joined);
  }

  function extractCharacterNameSets(facts, lang) {
    if (!Array.isArray(facts)) return { verified: [], forbidden: [] };
    const verified = new Set();
    const forbidden = new Set();
    const quotedPatterns = [/"([^"]{2,60})"/g, /'([^']{2,60})'/g];
    const negationMarkers = getCharacterNegationMarkers(lang);
    for (const fact of facts) {
      const tags = Array.isArray(fact && fact.tags) ? fact.tags : [];
      const keywords = Array.isArray(fact && fact.keywords) ? fact.keywords : [];
      const tagText = tags.concat(keywords).join(' ').toLowerCase();
      const isCharacterFact = tagText.includes('karakter') || tagText.includes('character');
      if (!isCharacterFact) continue;
      const text = String(fact && fact.text || '').trim();
      if (!text) continue;
      const normalized = normalizeFactText(text);
      const isNegation = negationMarkers.some((marker) => normalized.includes(marker));
      for (const pattern of quotedPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const candidate = String(match[1] || '').trim();
          if (!candidate) continue;
          if (isNegation) {
            forbidden.add(candidate);
          } else {
            verified.add(candidate);
          }
        }
      }
    }
    for (const name of forbidden) {
      verified.delete(name);
    }
    return { verified: Array.from(verified), forbidden: Array.from(forbidden) };
  }

  function buildNameGuardPrompt(verifiedNames, forbiddenNames, lang) {
    const verifiedList = Array.isArray(verifiedNames) ? verifiedNames : [];
    const forbiddenList = Array.isArray(forbiddenNames) ? forbiddenNames : [];
    const lines = [];
    const templates = getNameGuardTemplates(lang);
    if (verifiedList.length) {
      lines.push(templates.verified.replace('{names}', verifiedList.join(', ')));
    }
    if (forbiddenList.length) {
      lines.push(templates.forbidden.replace('{names}', forbiddenList.join(', ')));
    }
    if (!verifiedList.length && forbiddenList.length) {
      lines.push(templates.onlyForbidden);
    }
    if (lines.length) {
      return lines.join(' ');
    }
    return templates.noVerified;
  }

  function extractUserMentionables(text, lang) {
    const raw = String(text || '').trim();
    if (!raw) return [];
    const results = new Set();
    const quotedPatterns = [/"([^"]{2,60})"/g, /'([^']{2,60})'/g];
    for (const pattern of quotedPatterns) {
      let match;
      while ((match = pattern.exec(raw)) !== null) {
        const candidate = String(match[1] || '').trim();
        if (candidate) results.add(candidate);
      }
    }
    const listMarkers = getUserMentionableMarkers(lang);
    const markerRegex = new RegExp(`(?:${listMarkers.join('|')})\\s*:\\s*([^\n]+)`, 'i');
    const listMatch = raw.match(markerRegex);
    if (listMatch && listMatch[1]) {
      const parts = listMatch[1].split(/[,;]+/g);
      for (const part of parts) {
        const candidate = String(part || '').trim();
        if (candidate) results.add(candidate);
      }
    }
    return Array.from(results).slice(0, 12);
  }

  function extractMentionableEntities(text, lang) {
    const raw = String(text || '').trim();
    if (!raw) return [];
    const patterns = getEntityMarkerPatterns(lang);
    const entities = [];
    for (const pattern of patterns) {
      const markerRegex = new RegExp(`(?:${pattern.markers.join('|')})\\s*:\\s*([^\\n]+)`, 'i');
      const match = raw.match(markerRegex);
      if (!match || !match[1]) continue;
      const parts = match[1].split(/[,;]+/g);
      for (const part of parts) {
        const name = String(part || '').trim();
        if (!name) continue;
        entities.push({ name, entityType: pattern.type });
      }
    }
    return entities.slice(0, 12);
  }

  function normalizeNameToken(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '')
      .trim();
  }

  function normalizeCandidateTokens(candidate) {
    return String(candidate || '')
      .split(/\s+/g)
      .map(normalizeNameToken)
      .filter(Boolean);
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getCandidateCounts(text, candidate) {
    const escaped = escapeRegExp(candidate);
    const wordPattern = new RegExp(`\\b${escaped}\\b`, 'g');
    const startPattern = new RegExp(`(^|[.!?]\\s+)["'\(]*${escaped}\\b`, 'g');
    const count = (text.match(wordPattern) || []).length;
    const starts = (text.match(startPattern) || []).length;
    return { count, starts };
  }

  function extractPotentialNames(text) {
    const raw = String(text || '').trim();
    if (!raw) return [];
    const candidates = new Set();
    const pattern = /(^|[^\p{L}])([\p{Lu}][\p{L}\p{N}'-]{2,}(?:\s+[\p{Lu}][\p{L}\p{N}'-]{2,})*)/gu;
    let match;
    while ((match = pattern.exec(raw)) !== null) {
      const candidate = String(match[2] || '').trim();
      if (candidate) candidates.add(candidate);
    }
    return Array.from(candidates).slice(0, 25);
  }

  function isEntityLikeCandidate(text, candidate) {
    if (!candidate) return false;
    const escaped = escapeRegExp(candidate);
    const quotedPattern = new RegExp(`["']${escaped}["']`);
    if (quotedPattern.test(text)) return true;
    const counts = getCandidateCounts(text, candidate);
    const sentenceStartOnly = counts.count > 0 && counts.count === counts.starts;
    if (counts.count === 1 && sentenceStartOnly) return false;
    if (candidate.includes(' ')) return true;
    if (/[0-9]/.test(candidate)) return true;
    if (/[-/]/.test(candidate)) return counts.count >= 2;
    return counts.count >= 2;
  }

  function isListHeadingCandidate(text, candidate) {
    if (!candidate) return false;
    const escaped = escapeRegExp(candidate);
    const pattern = new RegExp(`(^|\n)\s*(?:[-*•]|\d+\.)\s+${escaped}\b`, 'i');
    return pattern.test(text);
  }

  function isLikelyLocationCandidate(candidate, lang) {
    if (!candidate) return false;
    const text = candidate.toLowerCase();
    if (text.includes(' forest') || text.includes(' cave') || text.includes(' dungeon') || text.includes(' ruins') || text.includes(' temple') || text.includes(' valley')) {
      return true;
    }
    if (text.includes(' zone') || text.includes(' area') || text.includes(' stage') || text.includes(' level') || text.includes(' map')) {
      return true;
    }
    if (lang === 'hu') {
      if (/[\-](ban|ben|ba|be|bol|rol|hoz|hez|hoz|ra|re|nal|nel)\b/i.test(candidate)) return true;
    }
    return false;
  }

  const REDACTION_CONTEXT_KEYWORDS = {
    en: {
      character: ['character', 'hero', 'class', 'boss', 'tank', 'healer', 'dps'],
      item: ['item', 'gear', 'weapon', 'armor', 'shield', 'bow', 'sword', 'staff', 'ring', 'amulet', 'trinket'],
      skill: ['skill', 'ability', 'ultimate', 'spell', 'perk', 'talent']
    },
    hu: {
      character: ['karakter', 'hos', 'hős', 'kaszt', 'osztaly', 'osztály', 'boss'],
      item: ['fegyver', 'pancel', 'páncél', 'targy', 'tárgy', 'felszereles', 'felszerelés', 'pajzs', 'kard', 'ij', 'íj', 'gyuru', 'gyűrű'],
      skill: ['kepesseg', 'képesség', 'skill', 'varazslat', 'varázslat', 'talent', 'perk']
    }
  };

  function getRedactionContextWindow(text, candidate) {
    const body = String(text || '').toLowerCase();
    const target = String(candidate || '').toLowerCase();
    if (!body || !target) return '';
    const index = body.indexOf(target);
    if (index < 0) return '';
    const start = Math.max(0, index - 40);
    const end = Math.min(body.length, index + target.length + 40);
    return body.slice(start, end);
  }

  function resolveRedactionKind(answer, candidate, lang) {
    const context = getRedactionContextWindow(answer, candidate);
    const keywords = REDACTION_CONTEXT_KEYWORDS[lang] || REDACTION_CONTEXT_KEYWORDS.en;
    const hasAny = (list) => Array.isArray(list) && list.some((entry) => context.includes(entry));
    if (hasAny(keywords.character)) return 'character';
    if (hasAny(keywords.item)) return 'item';
    if (hasAny(keywords.skill)) return 'skill';
    if (isLikelyLocationCandidate(candidate, lang)) return 'location';
    return 'generic';
  }

  function resolveRedactionReplacement(answer, candidate, lang, fallback) {
    const kind = resolveRedactionKind(answer, candidate, lang);
    const replacement = getEntityRedactionReplacement(lang, kind)
      || getEntityRedactionReplacement(lang, 'generic');
    return replacement || fallback || 'that in-game element';
  }

  function enforceEntityWhitelist(answer, allowedNames, lang) {
    const allowed = Array.isArray(allowedNames) ? allowedNames : [];
    if (!allowed.length) return { adjusted: answer, violated: false, offenders: [], suspects: [] };
    const baseAnswer = String(answer || '');
    const normalizedAllowed = new Set(allowed.map(normalizeNameToken).filter(Boolean));
    const stopWords = new Set(getEntityStopWords(lang));
    const redactionText = getEntityRedactionText(lang);
    const isSingleStartOnly = (text, candidate) => {
      const counts = getCandidateCounts(text, candidate);
      return counts.count === 1 && counts.starts === 1;
    };
    const candidates = extractPotentialNames(answer);
    const offenders = new Set();
    const suspects = new Set();
    for (const candidate of candidates) { 
      const normalized = normalizeNameToken(candidate);
      if (!normalized || stopWords.has(normalized)) continue;
      const tokens = normalizeCandidateTokens(candidate);
      if (!tokens.length || tokens.every((token) => stopWords.has(token))) continue;
      if (!candidate.includes(' ') && isListHeadingCandidate(answer, candidate)) {
        suspects.add(candidate);
        continue;
      }
      if (!candidate.includes(' ') && isSingleStartOnly(answer, candidate)) continue;
      if (normalizedAllowed.has(normalized)) continue;
      if (isEntityLikeCandidate(answer, candidate)) {
        offenders.add(candidate);
      } else {
        suspects.add(candidate);
      }
    }
    if (!offenders.size) {
      return {
        adjusted: answer,
        violated: false,
        offenders: [],
        suspects: Array.from(suspects)
      };
    }
    let redactedAnswer = String(answer || '');
    for (const offender of offenders) {
      const escaped = escapeRegExp(offender);
      const replacement = resolveRedactionReplacement(baseAnswer, offender, lang, redactionText);
      redactedAnswer = redactedAnswer.replace(new RegExp(`\\b${escaped}\\b`, 'g'), replacement);
    }
    redactedAnswer = redactedAnswer
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .trim();
    return {
      adjusted: redactedAnswer,
      violated: true,
      offenders: Array.from(offenders),
      suspects: Array.from(suspects)
    };
  }

  function buildEntityWhitelistPrompt(verifiedNames, mentionableNames, lang) {
    const verified = Array.isArray(verifiedNames) ? verifiedNames : [];
    const mentionable = Array.isArray(mentionableNames) ? mentionableNames : [];
    const selected = getEntityWhitelistTemplates(lang);
    const lines = [selected.title];
    if (verified.length) {
      lines.push(selected.verified.replace('{names}', verified.join(', ')));
    }
    if (mentionable.length) {
      lines.push(selected.mentionable.replace('{names}', mentionable.join(', ')));
    }
    return lines.join(' ');
  }

  function resolveKnowledgeMode(factsSelected, hasGameContext) {
    if (Array.isArray(factsSelected) && factsSelected.length) return AI_KNOWLEDGE_MODES.verified;
    if (hasGameContext) return AI_KNOWLEDGE_MODES.partial;
    return AI_KNOWLEDGE_MODES.unknown;
  }

  function isHighRiskQuestion(text, intentId, lang) {
    const intent = String(intentId || '').trim();
    const highRiskIntents = new Set(getHighRiskIntents());
    if (highRiskIntents.has(intent)) return true;
    const normalized = normalizeIntentText(text);
    const patterns = getHighRiskPatterns(lang);
    return patterns.some((entry) => normalized.includes(entry));
  }

  function getKnowledgeTemplates(lang) {
    return getKnowledgeTemplatesText(lang);
  }

  function applyKnowledgeTemplate(answer, lang, mode) {
    const templates = getKnowledgeTemplates(lang);
    const notice = mode === AI_KNOWLEDGE_MODES.verified ? '' : templates.notice;
    const body = String(answer || '').trim();
    if (!body) return '';
    if (notice) {
      return `${body}\n\n${notice}`;
    }
    return body;
  }

  function buildProfilePrompt(profile, lang) {
    if (!profile || typeof profile !== 'object') return '';
    const systems = profile.systems && typeof profile.systems === 'object' ? profile.systems : {};
    const enabled = Object.keys(systems).filter((key) => systems[key] === true);
    const notes = String(profile.notes || '').trim();
    if (!enabled.length && !notes) return '';
    const label = getProfilePromptLabelsText(lang);
    const header = label.header;
    const lines = [];
    if (enabled.length) {
      lines.push(`${label.systems}: ${enabled.join(', ')}`);
    }
    if (notes) {
      lines.push(`${label.notes}: ${notes}`);
    }
    return `${header}\n- ${lines.join('\n- ')}`;
  }

  function loadIntentRouting() {
    const now = Date.now();
    if (cachedIntentRouting && (now - cachedIntentRoutingAt) < INTENT_ROUTING_TTL_MS) {
      return cachedIntentRouting;
    }
    try {
      if (!fs.existsSync(INTENT_ROUTING_PATH)) {
        cachedIntentRouting = { headers: {}, routes: [] };
        cachedIntentRoutingAt = now;
        return cachedIntentRouting;
      }
      const raw = fs.readFileSync(INTENT_ROUTING_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      const routes = Array.isArray(parsed && parsed.routes) ? parsed.routes : [];
      const headers = parsed && parsed.headers && typeof parsed.headers === 'object' ? parsed.headers : {};
      cachedIntentRouting = { headers, routes };
      validateIntentRouting(cachedIntentRouting);
      cachedIntentRoutingAt = now;
      return cachedIntentRouting;
    } catch (_) {
      cachedIntentRouting = { headers: {}, routes: [] };
      cachedIntentRoutingAt = now;
      return cachedIntentRouting;
    }
  }

  function validateIntentRouting(routing) {
    if (!shouldLogDiagnostics()) return;
    const issues = [];
    const seenIds = new Set();
    const routes = Array.isArray(routing && routing.routes) ? routing.routes : [];
    for (const route of routes) {
      const id = String(route && route.id || '').trim();
      if (!id) {
        issues.push(AI_INTENT_ROUTING_ISSUES.routeMissingId);
      } else if (seenIds.has(id)) {
        issues.push(`${AI_INTENT_ROUTING_ISSUES.duplicateIdPrefix}${id}`);
      } else {
        seenIds.add(id);
      }
      const patterns = Array.isArray(route && route.patterns) ? route.patterns : [];
      if (!patterns.length) {
        issues.push(`${AI_INTENT_ROUTING_ISSUES.missingPatternsPrefix}${id || AI_INTENT_UNKNOWN}`);
      }
      const prompts = route && route.prompts && typeof route.prompts === 'object' ? route.prompts : null;
      if (!prompts || (!prompts.en && !prompts.hu)) {
        issues.push(`${AI_INTENT_ROUTING_ISSUES.missingPromptsPrefix}${id || AI_INTENT_UNKNOWN}`);
      }
    }
    if (issues.length) {
      logAiDiagnostics({ event: AI_DIAG_EVENTS.intentRoutingValidation, issues });
    }
  }

  function getIntentRoutingRules() {
    const routing = loadIntentRouting();
    const routes = Array.isArray(routing.routes) ? routing.routes : [];
    return routes
      .slice()
      .sort((a, b) => {
        const aPriority = Number.isFinite(a && a.priority) ? a.priority : Number.MAX_SAFE_INTEGER;
        const bPriority = Number.isFinite(b && b.priority) ? b.priority : Number.MAX_SAFE_INTEGER;
        return aPriority - bPriority;
      });
  }

  function normalizeIntentText(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function classifyIntent(text) {
    const normalized = normalizeIntentText(text);
    const tokens = normalized ? normalized.split(' ') : [];
    const rules = getIntentRoutingRules();
    for (const rule of rules) {
      const intentId = String(rule && rule.id || '').trim();
      if (!intentId) continue;
      const patterns = Array.isArray(rule.patterns) ? rule.patterns : [];
      for (const rawPattern of patterns) {
        const pattern = normalizeIntentText(rawPattern);
        if (!pattern) continue;
        const isPhrase = pattern.includes(' ');
        const isShortToken = pattern.length <= 3;
        const matched = isPhrase
          ? normalized.includes(pattern)
          : (isShortToken ? tokens.includes(pattern) : tokens.includes(pattern));
        if (matched) {
          return { intent: intentId, matched: true, matchedBy: pattern };
        }
      }
    }
    return { intent: AI_INTENT_UNKNOWN, matched: false, matchedBy: null };
  }

  function getIntentRoutingPrompt(intentInfo, lang, gameContext) {
    if (!intentInfo || !intentInfo.intent || intentInfo.intent === AI_INTENT_UNKNOWN) return '';
    const routing = loadIntentRouting();
    const language = normalizeLanguage(lang);
    const headers = routing && routing.headers && typeof routing.headers === 'object' ? routing.headers : {};
    const header = headers[language] || headers.en || getIntentRoutingDefaultHeader(language);
    const routes = Array.isArray(routing && routing.routes) ? routing.routes : [];
    const route = routes.find((entry) => String(entry && entry.id || '') === intentInfo.intent);
    if (!route) return '';
    const prompts = route && route.prompts && typeof route.prompts === 'object' ? route.prompts : {};
    const rawPrompt = prompts[language] || prompts.en || '';
    if (!rawPrompt) return '';
    if (typeof rawPrompt === 'string') {
      return `${header}\n- ${rawPrompt}`;
    }
    const withGame = String(rawPrompt.withGame || '').trim();
    const noGame = String(rawPrompt.noGame || '').trim();
    const selected = gameContext ? withGame : noGame;
    if (!selected) return '';
    return `${header}\n- ${selected}`;
  }

  function pickDeterministicText(deterministic, lang, gameContext) {
    if (!deterministic) return '';
    if (deterministic && typeof deterministic === 'object' && deterministic.enabled === false) return '';
    const language = normalizeLanguage(lang);
    const localized = (deterministic && typeof deterministic === 'object')
      ? (deterministic[language] || deterministic.en || null)
      : deterministic;
    if (!localized) return '';
    if (typeof localized === 'string') return localized.replace(/\{game\}/g, String(gameContext || '').trim());
    const withGame = String(localized.withGame || '').trim();
    const noGame = String(localized.noGame || '').trim();
    const selected = gameContext ? withGame : noGame;
    if (!selected) return '';
    if (gameContext) return selected.replace(/\{game\}/g, String(gameContext || '').trim());
    return selected;
  }

  function buildDeterministicResponse(intentInfo, responseTemplate, lang, gameContext) {
    if (!intentInfo || !intentInfo.intent || !responseTemplate) return '';
    return pickDeterministicText(responseTemplate.deterministic, lang, gameContext);
  }

  function shouldLogDiagnostics() {
    return !!(registry.ai && registry.ai.diagnosticsEnabled);
  }

  function logAiDiagnostics(entry) {
    if (!shouldLogDiagnostics()) return;
    const payload = {
      ts: Date.now(),
      ...entry
    };
    console.log(AI_DIAG_PREFIX, JSON.stringify(payload));
    if (!isDev()) return;
    try {
      const overlayWin = registry && registry.core ? registry.core.overlayWin : null;
      if (overlayWin && !overlayWin.isDestroyed()) {
        overlayWin.webContents.send(IPC_CHANNELS.AI_DIAGNOSTICS_EVENT, payload);
      }
    } catch (_) {}
  }

  function analyzePromptTrim(segments) {
    const list = Array.isArray(segments) ? segments : [];
    const normalized = list.map((entry) => {
      const text = String(entry && entry.text || '');
      return {
        id: entry && entry.id ? String(entry.id) : AI_INTENT_UNKNOWN,
        required: !!(entry && entry.required),
        chars: text.length,
        text
      };
    });
    const totalChars = normalized.reduce((sum, entry) => sum + entry.chars, 0);
    const capIssues = [];
    normalized.forEach((entry) => {
      const cap = AI_PROMPT_TRIM_POLICY.segmentCaps[entry.id];
      if (Number.isFinite(cap) && entry.chars > cap) {
        capIssues.push({ id: entry.id, chars: entry.chars, cap, overBy: entry.chars - cap });
      }
    });
    let remaining = Math.max(0, totalChars - AI_PROMPT_TRIM_POLICY.totalMaxChars);
    const suggestions = [];
    if (remaining > 0) {
      AI_PROMPT_TRIM_POLICY.trimOrder.forEach((id) => {
        if (remaining <= 0) return;
        const entry = normalized.find((item) => item.id === id);
        if (!entry || entry.required) return;
        const trim = Math.min(entry.chars, remaining);
        if (trim > 0) {
          suggestions.push({ id, trimChars: trim });
          remaining -= trim;
        }
      });
    }
    return {
      totalChars,
      totalMaxChars: AI_PROMPT_TRIM_POLICY.totalMaxChars,
      overTotal: Math.max(0, totalChars - AI_PROMPT_TRIM_POLICY.totalMaxChars),
      capIssues,
      suggestedTrim: suggestions,
      remainingOver: remaining,
      segments: normalized.map((entry) => ({ id: entry.id, chars: entry.chars, required: entry.required }))
    };
  }

  function buildTrimPreview(segments) {
    const list = Array.isArray(segments) ? segments : [];
    const state = list.map((entry) => {
      const text = String(entry && entry.text || '');
      return {
        id: entry && entry.id ? String(entry.id) : AI_INTENT_UNKNOWN,
        required: !!(entry && entry.required),
        original: text,
        text
      };
    });
    const trims = [];

    state.forEach((entry) => {
      const cap = AI_PROMPT_TRIM_POLICY.segmentCaps[entry.id];
      if (Number.isFinite(cap) && entry.text.length > cap) {
        const removed = entry.text.length - cap;
        entry.text = entry.text.slice(0, cap).trimEnd();
        trims.push({ id: entry.id, removedChars: removed, reason: 'cap' });
      }
    });

    const totalChars = state.reduce((sum, entry) => sum + entry.text.length, 0);
    let remaining = Math.max(0, totalChars - AI_PROMPT_TRIM_POLICY.totalMaxChars);
    if (remaining > 0) {
      AI_PROMPT_TRIM_POLICY.trimOrder.forEach((id) => {
        if (remaining <= 0) return;
        const entry = state.find((item) => item.id === id);
        if (!entry || entry.required || entry.text.length === 0) return;
        const trim = Math.min(entry.text.length, remaining);
        if (trim > 0) {
          entry.text = entry.text.slice(0, entry.text.length - trim).trimEnd();
          trims.push({ id, removedChars: trim, reason: 'total' });
          remaining -= trim;
        }
      });
    }

    const previewText = state.map((entry) => entry.text).join('');
    return {
      previewText: truncateForLog(previewText, AI_DIAG_PREVIEW_MAX_CHARS),
      trims,
      originalChars: state.reduce((sum, entry) => sum + entry.original.length, 0),
      trimmedChars: state.reduce((sum, entry) => sum + entry.text.length, 0),
      remainingOver: remaining
    };
  }

  function isTooGeneric(response, gameContext, specializationLevel, lang) {
    if (!gameContext) return false;
    const body = String(response || '').trim();
    if (!body) return false;
    const strictUnknown = getKnowledgeTemplates(lang).strictUnknown;
    if (strictUnknown && body.includes(strictUnknown)) return false;
    const gameName = String(gameContext || '').toLowerCase();
    const hasGameName = gameName && body.toLowerCase().includes(gameName);
    const level = Math.max(1, Math.min(5, specializationLevel || 3));
    const minLenByLevel = { 1: 120, 2: 220, 3: 360, 4: 520, 5: 700 };
    const minLen = minLenByLevel[level] || 220;
    return !hasGameName && body.length < minLen;
  }

  function finalizeResponseText(response) {
    const body = String(response || '').trim();
    if (!body) return '';
    if (/[.!?\u2026]$/.test(body)) return body;
    const lastSentence = body.match(/([\s\S]*[.!?\u2026])[^.!?\u2026]*$/);
    if (lastSentence && lastSentence[1]) {
      return lastSentence[1].trim();
    }
    if (body.length > 1) return `${body}.`;
    return body;
  }

  function loadTemplateOptions() {
    const now = Date.now();
    if (cachedTemplateOptions && (now - cachedTemplateOptionsAt) < TEMPLATE_OPTIONS_TTL_MS) {
      return cachedTemplateOptions;
    }
    try {
      if (!fs.existsSync(TEMPLATE_OPTIONS_PATH)) {
        cachedTemplateOptions = [];
        cachedTemplateOptionsAt = now;
        return cachedTemplateOptions;
      }
      const raw = fs.readFileSync(TEMPLATE_OPTIONS_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      cachedTemplateOptions = Array.isArray(parsed) ? parsed : [];
      cachedTemplateOptionsAt = now;
      return cachedTemplateOptions;
    } catch (_) {
      cachedTemplateOptions = [];
      cachedTemplateOptionsAt = now;
      return cachedTemplateOptions;
    }
  }

  function getTemplateOptionPrompt(optionId, lang) {
    const list = loadTemplateOptions();
    const entry = list.find((opt) => opt && opt.id === optionId);
    if (!entry || !entry.prompt) return '';
    const language = normalizeLanguage(lang);
    const map = entry.prompt || {};
    return map[language] || map.en || '';
  }

  function getTemplateSectionLabels(lang) {
    return getTemplateSectionLabelsText(lang);
  }

  function getTemplateGuidanceIntro(lang) {
    return getTemplateGuidanceIntroText(lang);
  }

  function buildTemplatePrompt(entry, lang) {
    if (!entry) return '';
    const optionIds = Array.isArray(entry.options) ? entry.options.map((id) => String(id)) : [];
    const optionLines = optionIds
      .map((id) => getTemplateOptionPrompt(id, lang))
      .filter((text) => text && String(text).trim())
      .map((text) => `- ${String(text).trim()}`);
    const custom = entry.template ? String(entry.template).trim() : '';
    if (!optionLines.length && !custom) return '';
    const intro = getTemplateGuidanceIntro(lang);
    const lines = [];
    if (optionLines.length) {
      lines.push(...optionLines);
    }
    if (custom) {
      lines.push(`- ${custom}`);
    }
    return `\n\n${intro}\n${lines.join('\n')}`;
  }

  function getSystemPrompt(lang, specializationLevel = 3) {
    const level = Math.max(1, Math.min(5, specializationLevel || 3));
    const language = normalizeLanguage(lang);
    const details = getDetailPromptConfig(language, level);

    // SZIGORÚ CONTENT POLICY - CSAK JÁTÉKOK!
    const strictPolicy = getStrictPolicyText(language);
    const antiHallucination = `\n\n${getAntiHallucinationText(language)}`;
    const basePrompt = getSystemBasePrompt(language);
    return `${basePrompt} ${details.suffix}${strictPolicy}${antiHallucination}`;
  }

  async function initializeOpenAI() {
    const logText = getOpenAiLogText();
    try {
      let apiKey = process.env.OPENAI_API_KEY || '';
      let source = '.env (FEJLESZTÉSI MÓD)';

      if (!apiKey) {
        apiKey = await keytar.getPassword('AIGameAssistant', 'openai-api-key');
        source = 'keytar';
      }

      if (!apiKey) {
        console.warn(logText.openaiMissingKey);
        return false;
      }

      openai = new OpenAI({ apiKey });
      console.log(logText.openaiInitSource.replace('{source}', source));
      return true;
    } catch (err) {
      console.error(logText.openaiInitError, err.message);
      return false;
    }
  }

  function getGameContextPrompt(lang, gameName) {
    return getGameContextPromptText(lang, gameName);
  }

  function getTemplatePromptLabels(lang) {
    return getTemplatePromptLabelsText(lang);
  }

  function getVisionPrompts(lang, questionText) {
    const selected = getVisionPromptTemplates(lang);
    return {
      system: selected.system,
      user: selected.user.replace('{question}', String(questionText || '').trim())
    };
  }

  function hasExternalLink(text) {
    return /https?:\/\//i.test(String(text || ''));
  }

  function shouldUseHighModel(payload) {
    const text = String(payload && payload.text || '');
    const lang = payload && payload.lang;
    if (payload && payload.imageData) return true;

    const normalized = normalizeFactText(text);
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    const commaCount = (text.match(/,/g) || []).length;
    if (text.length >= 100) return true;
    if (wordCount >= 120) return true;
    if (commaCount >= 8) return true;
    if (normalized.includes('karakterek:') && commaCount >= 5) return true;

    const troubleshootPatterns = getTroubleshootPatterns(lang);
    if (troubleshootPatterns.some((entry) => normalized.includes(entry))) return true;

    if (/(^|\b)mod(s|ok|ded|ding)?\b/i.test(text)) return true;
    if (/(^|\b)mod\b/i.test(text) && /(load order|compat|conflict)/i.test(text)) return true;

    const multiTurnHints = getMultiTurnHints(lang);
    if (multiTurnHints.some((entry) => normalized.includes(entry))) return true;

    return false;
  }

  function getModelStrategyDiagnostics(payload) {
    const text = String(payload && payload.text || '');
    const hasImage = !!(payload && payload.imageData);
    const lang = payload && payload.lang;
    const normalized = normalizeFactText(text);
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    const commaCount = (text.match(/,/g) || []).length;
    const isLong = text.length >= 100 || wordCount >= 120;
    const isListHeavy = commaCount >= 8 || (normalized.includes('karakterek:') && commaCount >= 5);
    const troubleshoot = getTroubleshootPatterns(lang).some((entry) => normalized.includes(entry));
    const hasModKeywords = /(\bmod(s|ok|ded|ding)?\b)/i.test(text)
      || (/(^|\b)mod\b/i.test(text) && /(load order|compat|conflict)/i.test(text));
    const multiTurn = getMultiTurnHints(lang).some((entry) => normalized.includes(entry));

    const reasons = [];
    if (hasImage) reasons.push(AI_MODEL_REASON_CODES.hasImage);
    if (isLong) reasons.push(AI_MODEL_REASON_CODES.longInput);
    if (isListHeavy) reasons.push(AI_MODEL_REASON_CODES.listHeavy);
    if (troubleshoot) reasons.push(AI_MODEL_REASON_CODES.troubleshoot);
    if (hasModKeywords) reasons.push(AI_MODEL_REASON_CODES.modSupport);
    if (multiTurn) reasons.push(AI_MODEL_REASON_CODES.multiTurn);

    const wouldUseHighModel = hasImage || isLong || isListHeavy || troubleshoot || hasModKeywords || multiTurn;
    const recommendedModel = wouldUseHighModel ? AI_MODELS.highQuality : AI_MODELS.baseText;
    const timeoutFallback = hasImage ? AI_TIMEOUT_FALLBACK.vision : AI_TIMEOUT_FALLBACK.text;
    return {
      recommendedModel,
      wouldUseHighModel,
      reasons,
      timeoutFallback,
      metrics: {
        textLength: text.length,
        wordCount,
        commaCount,
        hasImage
      }
    };
  }

  function getNoLinkAccessPrompt(lang) {
    return getNoLinkAccessPromptText(lang);
  }

  async function processText(payload) {
    const { text, lang, specializationLevel, imageData, gameContext, answerStyle } = payload || {};
    const logText = getOpenAiLogText();
    try {
      // Prefer explicit renderer-provided context, but fall back to cached detection.
      let resolvedGameContext = gameContext || game.currentDetectedGame;
      if (!resolvedGameContext && typeof matchGameFromText === 'function') {
        resolvedGameContext = matchGameFromText(text);
      }
      const intentInfo = classifyIntent(text);
      const resolvedLanguage = lang || getCurrentLanguage();
      const responseTemplate = getResponseTemplate(intentInfo.intent, resolvedLanguage);
      const resolvedAnswerStyle = normalizeAnswerStyle(answerStyle);
      const deterministicResponse = buildDeterministicResponse(
        intentInfo,
        responseTemplate,
        resolvedLanguage,
        resolvedGameContext
      );
      if (deterministicResponse) {
        logAiDiagnostics({
          event: AI_DIAG_EVENTS.request,
          intent: intentInfo.intent,
          intentMatched: intentInfo.matched,
          intentMatchedBy: intentInfo.matchedBy,
          intentRoutingApplied: false,
          responseTemplateId: responseTemplate.id,
          responseTemplateApplied: true,
          responseTemplateUseFacts: false,
          responseTemplateUseProfile: false,
          factsCount: 0,
          profileUsed: false,
          gameContext: resolvedGameContext || null,
          detectScore: typeof game.lastDetectScore === 'number' ? game.lastDetectScore : null,
          detectReasons: Array.isArray(game.lastDetectReasons) ? game.lastDetectReasons : null,
          detectSignalCount: typeof game.lastDetectSignalCount === 'number' ? game.lastDetectSignalCount : null,
          detectSource: game.lastDetectSource || null,
          templateType: 'none',
          templateOptionsCount: 0,
          templateHasCustom: false,
          specializationLevel: specializationLevel || 3,
          answerStyle: resolvedAnswerStyle || null,
          hasImage: !!imageData,
          modelSelected: AI_MODEL_LABELS.deterministic
        });
        logAiDiagnostics({
          event: AI_DIAG_EVENTS.response,
          model: AI_MODEL_LABELS.deterministic,
          responseLength: String(deterministicResponse || '').length,
          tooGeneric: isTooGeneric(deterministicResponse, resolvedGameContext, specializationLevel || 3, resolvedLanguage)
        });
        return { response: deterministicResponse, success: true };
      }
      if (!openai) {
        throw new Error(AI_ERROR_CODES.openaiNotInitialized);
      }
      const detectScore = typeof game.lastDetectScore === 'number' ? game.lastDetectScore : null;
      const detectReasons = Array.isArray(game.lastDetectReasons) ? game.lastDetectReasons : null;
      const detectSignalCount = typeof game.lastDetectSignalCount === 'number' ? game.lastDetectSignalCount : null;
      const detectSource = game.lastDetectSource || null;
      let templateType = 'none';
      let templateOptionsCount = 0;
      let templateHasCustom = false;
      let resolvedTemplateEntry = null;
      const processingLog = logText.gptProcessing
        .replace('{text}', truncateForLog(text, 220))
        .replace('{level}', String(specializationLevel || 3))
        .replace('{hasImage}', String(!!imageData))
        .replace('{game}', resolvedGameContext || logText.unknownGame);
      console.log(processingLog);
      const modelStrategy = getModelStrategyDiagnostics(payload || {});
      const useHighModel = shouldUseHighModel(payload || {});
      const selectedModel = useHighModel ? AI_MODELS.highQuality : AI_MODELS.baseText;
      let systemPrompt = getSystemPrompt(resolvedLanguage, specializationLevel || 3);
      const promptSegments = [
        { id: AI_PROMPT_SEGMENTS.systemBase, text: systemPrompt, required: true }
      ];
      if (hasExternalLink(text)) {
        const noLinkPrompt = getNoLinkAccessPrompt(resolvedLanguage);
        systemPrompt += `\n\n${noLinkPrompt}`;
        promptSegments.push({ id: AI_PROMPT_SEGMENTS.noLink, text: `\n\n${noLinkPrompt}` });
      }
      if (resolvedGameContext) {
        const gameContextPrompt = getGameContextPrompt(resolvedLanguage, resolvedGameContext);
        const strictOverridePrompt = getStrictOverridePrompt(resolvedLanguage);
        systemPrompt += gameContextPrompt;
        promptSegments.push({ id: AI_PROMPT_SEGMENTS.gameContext, text: gameContextPrompt, required: true });
        systemPrompt += `\n\n${strictOverridePrompt}`;
        promptSegments.push({ id: AI_PROMPT_SEGMENTS.strictOverride, text: `\n\n${strictOverridePrompt}` });
        resolvedTemplateEntry = getTemplateEntryForGame(resolvedGameContext);
        const templatePrompt = buildTemplatePrompt(resolvedTemplateEntry, resolvedLanguage);
        const templateLabels = getTemplatePromptLabels(resolvedLanguage);
        if (templatePrompt) {
          templateType = 'game-template';
          templateOptionsCount = Array.isArray(resolvedTemplateEntry && resolvedTemplateEntry.options) ? resolvedTemplateEntry.options.length : 0;
          templateHasCustom = !!(resolvedTemplateEntry && resolvedTemplateEntry.template && String(resolvedTemplateEntry.template).trim());
          const gameTemplatePrompt = `\n\n${templateLabels.gameTemplate}${templatePrompt}`;
          systemPrompt += gameTemplatePrompt;
          promptSegments.push({ id: AI_PROMPT_SEGMENTS.gameTemplate, text: gameTemplatePrompt });
        } else {
          templateType = 'generic-template';
          const generalTemplatePrompt = `\n\n${templateLabels.generalTemplate}\n${getDefaultGameTemplate(resolvedLanguage)}`;
          systemPrompt += generalTemplatePrompt;
          promptSegments.push({ id: AI_PROMPT_SEGMENTS.generalTemplate, text: generalTemplatePrompt });
        }
        console.log(logText.gameContextInjected.replace('{game}', resolvedGameContext));
      }
      const templateStyle = normalizeAnswerStyle(resolvedTemplateEntry && resolvedTemplateEntry.answerStyle);
      const answerStylePrompt = buildAnswerStylePrompt(templateStyle || resolvedAnswerStyle, resolvedLanguage);
      if (answerStylePrompt) {
        const answerStyleSegment = `\n\n${answerStylePrompt}`;
        systemPrompt += answerStyleSegment;
        promptSegments.push({ id: AI_PROMPT_SEGMENTS.answerStyle, text: answerStyleSegment });
      }
      const intentRoutingPrompt = getIntentRoutingPrompt(intentInfo, resolvedLanguage, resolvedGameContext);
      const intentRoutingApplied = !!intentRoutingPrompt;
      if (intentRoutingApplied) {
        const intentSegment = `\n\n${intentRoutingPrompt}`;
        systemPrompt += intentSegment;
        promptSegments.push({ id: AI_PROMPT_SEGMENTS.intentRouting, text: intentSegment });
      }
      const responseTemplatePrompt = responseTemplate.prompt;
      const responseTemplateApplied = !!responseTemplatePrompt;
      if (responseTemplateApplied) {
        const responseTemplateSegment = `\n\n${responseTemplatePrompt}`;
        systemPrompt += responseTemplateSegment;
        promptSegments.push({ id: AI_PROMPT_SEGMENTS.responseTemplate, text: responseTemplateSegment });
      }
      let profileUsed = false;
      if (resolvedGameContext && responseTemplate.useProfile) {
        const profilePrompt = buildProfilePrompt(loadGameProfile(resolvedGameContext), resolvedLanguage);
        if (profilePrompt) {
          const profileSegment = `\n\n${profilePrompt}`;
          systemPrompt += profileSegment;
          promptSegments.push({ id: AI_PROMPT_SEGMENTS.profile, text: profileSegment });
          profileUsed = true;
        }
      }
      let factsSelected = [];
      let nameSets = { verified: [], forbidden: [] };
      if (resolvedGameContext && responseTemplate.useFacts) {
        const facts = loadGameFacts(resolvedGameContext);
        factsSelected = selectFacts(text, facts, intentInfo.intent, responseTemplate.maxFacts);
        const factsPrompt = buildFactsPrompt(factsSelected, resolvedLanguage);
        if (factsPrompt) {
          const factsSegment = `\n\n${factsPrompt}`;
          systemPrompt += factsSegment;
          promptSegments.push({ id: AI_PROMPT_SEGMENTS.facts, text: factsSegment });
        }
        nameSets = extractCharacterNameSets(facts, resolvedLanguage);
        const nameGuardPrompt = buildNameGuardPrompt(
          nameSets.verified,
          nameSets.forbidden,
          resolvedLanguage
        );
        if (nameGuardPrompt) {
          const nameGuardSegment = `\n\n${nameGuardPrompt}`;
          systemPrompt += nameGuardSegment;
          promptSegments.push({ id: AI_PROMPT_SEGMENTS.nameGuard, text: nameGuardSegment, required: true });
        }
        logAiDiagnostics({
          event: AI_DIAG_EVENTS.factsVerifiedNames,
          gameContext: resolvedGameContext || null,
          verifiedNameCount: nameSets.verified.length,
          verifiedNames: nameSets.verified,
          forbiddenNameCount: nameSets.forbidden.length,
          forbiddenNames: nameSets.forbidden
        });
      }
      const savedMentionables = resolvedGameContext ? loadMentionables(resolvedGameContext) : { names: [] };
      const savedMentionableNames = Array.isArray(savedMentionables && savedMentionables.names)
        ? savedMentionables.names
        : [];
      const mentionableNames = Array.from(new Set(extractUserMentionables(text, resolvedLanguage).concat(savedMentionableNames)));
      const mentionableEntities = extractMentionableEntities(text, resolvedLanguage);
      const mentionableEntityNames = mentionableEntities.map((entity) => entity && entity.name).filter(Boolean);
      const factDerivedNames = extractAllowedNamesFromFacts(factsSelected);
      const normalizedForbidden = new Set(nameSets.forbidden.map(normalizeNameToken).filter(Boolean));
      const filteredFactNames = factDerivedNames.filter((name) => !normalizedForbidden.has(normalizeNameToken(name)));
      const enforcementWhitelist = nameSets.verified
        .concat(mentionableNames)
        .concat(mentionableEntityNames)
        .concat(filteredFactNames)
        .concat(resolvedGameContext ? [resolvedGameContext] : []);
      if (resolvedGameContext && responseTemplate.useFacts && !factsSelected.length && mentionableEntities.length) {
        const limitedEntities = mentionableEntities.slice(0, 8);
        for (const entity of limitedEntities) {
          addFactRequest(resolvedGameContext, {
            text: entity.name,
            intent: intentInfo.intent,
            reason: 'user-entity-seed',
            tags: [intentInfo.intent, 'seed', entity.entityType].filter(Boolean),
            entityType: entity.entityType,
            source: 'user',
            reliability: 'user'
          });
        }
      }
      const knowledgeModeBase = resolveKnowledgeMode(factsSelected, !!resolvedGameContext);
      const highRiskQuestion = isHighRiskQuestion(text, intentInfo.intent, resolvedLanguage);
      let knowledgeMode = knowledgeModeBase;
      let strictMode = false;
      if (highRiskQuestion && knowledgeMode !== AI_KNOWLEDGE_MODES.verified) {
        strictMode = true;
        knowledgeMode = AI_KNOWLEDGE_MODES.unknown;
      }
      const whitelistPrompt = buildEntityWhitelistPrompt(
        nameSets.verified,
        mentionableNames,
        resolvedLanguage
      );
      if (whitelistPrompt) {
        const whitelistSegment = `\n\n${whitelistPrompt}`;
        systemPrompt += whitelistSegment;
        promptSegments.push({ id: AI_PROMPT_SEGMENTS.whitelist, text: whitelistSegment, required: true });
      }
      if (isDev() && shouldLogDiagnostics()) {
        const trimReport = analyzePromptTrim(promptSegments);
        const trimPreview = buildTrimPreview(promptSegments);
        logAiDiagnostics({
          event: AI_DIAG_EVENTS.promptTrimPreview,
          gameContext: resolvedGameContext || null,
          intent: intentInfo.intent,
          ...trimReport
        });
        logAiDiagnostics({
          event: AI_DIAG_EVENTS.promptTrimSimulated,
          gameContext: resolvedGameContext || null,
          intent: intentInfo.intent,
          ...trimPreview
        });
        logAiDiagnostics({
          event: AI_DIAG_EVENTS.modelStrategyPreview,
          gameContext: resolvedGameContext || null,
          intent: intentInfo.intent,
          selectedModel,
          ...modelStrategy
        });
      }
      if (strictMode && knowledgeMode === AI_KNOWLEDGE_MODES.unknown) {
        const strictAnswer = getKnowledgeTemplates(resolvedLanguage).strictUnknown;
        const guardedStrict = applyKnowledgeTemplate(strictAnswer, resolvedLanguage, knowledgeMode);
        if (resolvedGameContext) {
          addFactRequest(resolvedGameContext, {
            text,
            intent: intentInfo.intent,
            reason: 'strict-unknown-high-risk',
            tags: [intentInfo.intent, 'high-risk']
          });
          updateUsage(resolvedGameContext, {
            intent: intentInfo.intent,
            highRisk: true,
            strictUnknown: true,
            unknown: true,
            knowledgeMode
          });
        }
        logAiDiagnostics({
          event: AI_DIAG_EVENTS.response,
          model: AI_MODEL_LABELS.guarded,
          responseLength: String(guardedStrict || '').length,
          tooGeneric: isTooGeneric(guardedStrict, resolvedGameContext, specializationLevel || 3, resolvedLanguage)
        });
        return { response: guardedStrict, success: true };
      }
      logAiDiagnostics({
          event: AI_DIAG_EVENTS.request,
        intent: intentInfo.intent,
        intentMatched: intentInfo.matched,
        intentMatchedBy: intentInfo.matchedBy,
        intentRoutingApplied,
        responseTemplateId: responseTemplate.id,
        responseTemplateApplied,
        responseTemplateUseFacts: responseTemplate.useFacts,
        responseTemplateUseProfile: responseTemplate.useProfile,
        factsCount: factsSelected.length,
        knowledgeMode,
        strictMode,
        highRiskQuestion,
        profileUsed,
        gameContext: resolvedGameContext || null,
        detectScore,
        detectReasons,
        detectSignalCount,
        detectSource,
        templateType,
        templateOptionsCount,
        templateHasCustom,
        specializationLevel: specializationLevel || 3,
        answerStyle: templateStyle || resolvedAnswerStyle || null,
        hasImage: !!imageData,
        modelSelected: selectedModel
      });
      const maxTokens = getMaxTokensForDetailLevel(resolvedLanguage, specializationLevel || 3);
      if (imageData) {
        const visionPrompts = getVisionPrompts(resolvedLanguage, text);
        const visionSystemPrompt = systemPrompt + `\n\n${visionPrompts.system}`;
        const visionUserPrompt = visionPrompts.user;
        const completion = await openai.chat.completions.create({
          model: AI_MODELS.highQuality,
          messages: [
            { role: 'system', content: visionSystemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: visionUserPrompt },
                { type: 'image_url', image_url: { url: imageData, detail: 'high' } }
              ]
            }
          ],
          max_tokens: maxTokens
        });
        const aiResponse = finalizeResponseText(completion.choices[0].message.content);
        const whitelistCheck = enforceEntityWhitelist(aiResponse, enforcementWhitelist, resolvedLanguage);
        if (whitelistCheck.violated) {
          knowledgeMode = AI_KNOWLEDGE_MODES.unknown;
        }
        const guardedResponse = applyKnowledgeTemplate(whitelistCheck.adjusted, resolvedLanguage, knowledgeMode);
        console.log(logText.visionAnswer, guardedResponse);
        logAiDiagnostics({
          event: AI_DIAG_EVENTS.response,
          model: AI_MODELS.highQuality,
          responseLength: String(guardedResponse || '').length,
          tooGeneric: isTooGeneric(guardedResponse, resolvedGameContext, specializationLevel || 3, resolvedLanguage),
          whitelistViolated: !!whitelistCheck.violated,
          whitelistOffenders: whitelistCheck.offenders || [],
          whitelistSuspects: whitelistCheck.suspects || []
        });
        if (whitelistCheck.violated) {
          logAiDiagnostics({
            event: AI_DIAG_EVENTS.entityWhitelistViolation,
            gameContext: resolvedGameContext || null,
            offenders: whitelistCheck.offenders
          });
          if (resolvedGameContext) {
            addFactRequest(resolvedGameContext, {
              text,
              intent: intentInfo.intent,
              reason: AI_DIAG_EVENTS.entityWhitelistViolation,
              tags: [intentInfo.intent, 'correction'].concat(whitelistCheck.offenders || []),
              source: 'community',
              reliability: 'community'
            });
          }
        }
        if (resolvedGameContext) {
          updateUsage(resolvedGameContext, {
            intent: intentInfo.intent,
            highRisk: highRiskQuestion,
            strictUnknown: false,
            unknown: knowledgeMode !== AI_KNOWLEDGE_MODES.verified,
            knowledgeMode
          });
        }
        return { response: guardedResponse, success: true };
      }
      const completion = await openai.chat.completions.create({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        max_tokens: maxTokens
      });
      const aiResponse = finalizeResponseText(completion.choices[0].message.content);
      const whitelistCheck = enforceEntityWhitelist(aiResponse, enforcementWhitelist, resolvedLanguage);
      if (whitelistCheck.violated) {
        knowledgeMode = AI_KNOWLEDGE_MODES.unknown;
      }
      const guardedResponse = applyKnowledgeTemplate(whitelistCheck.adjusted, resolvedLanguage, knowledgeMode);
      console.log(logText.answer, guardedResponse);
      logAiDiagnostics({
        event: AI_DIAG_EVENTS.response,
        model: selectedModel,
        responseLength: String(guardedResponse || '').length,
        tooGeneric: isTooGeneric(guardedResponse, resolvedGameContext, specializationLevel || 3, resolvedLanguage),
        whitelistViolated: !!whitelistCheck.violated,
        whitelistOffenders: whitelistCheck.offenders || [],
        whitelistSuspects: whitelistCheck.suspects || []
      });
      if (whitelistCheck.violated) {
        logAiDiagnostics({
            event: AI_DIAG_EVENTS.entityWhitelistViolation,
          gameContext: resolvedGameContext || null,
          offenders: whitelistCheck.offenders
        });
        if (resolvedGameContext) {
          addFactRequest(resolvedGameContext, {
            text,
            intent: intentInfo.intent,
            reason: AI_DIAG_EVENTS.entityWhitelistViolation,
            tags: [intentInfo.intent, 'correction'].concat(whitelistCheck.offenders || []),
            source: 'community',
            reliability: 'community'
          });
        }
      }
      if (resolvedGameContext) {
        updateUsage(resolvedGameContext, {
          intent: intentInfo.intent,
          highRisk: highRiskQuestion,
          strictUnknown: false,
          unknown: knowledgeMode !== AI_KNOWLEDGE_MODES.verified,
          knowledgeMode
        });
      }
      return { response: guardedResponse, success: true };
    } catch (err) {
      console.error(logText.aiError, err.message);
      return { success: false, error: err.message };
    }
  }

  async function processAudio(payload) {
    const { audioBuffer, language = 'hu', specializationLevel = 3 } = payload || {};
    const audioPath = path.join(os.tmpdir(), `audio_${Date.now()}.webm`);
    const logText = getOpenAiLogText();
    try {
      if (!openai) {
        throw new Error(AI_ERROR_CODES.openaiNotInitialized);
      }
      const buffer = Buffer.from(audioBuffer);
      fs.writeFileSync(audioPath, buffer);
      console.log(logText.audioProcessing);
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1'
      });
      const text = transcription.text;
      console.log(logText.audioTranscript, text);
      return { success: true, transcript: text, language, specializationLevel };
    } catch (err) {
      console.error(logText.audioError, err);
      return { success: false, error: err.message };
    } finally {
      try {
        fs.unlinkSync(audioPath);
      } catch (e) {
        // ignore
      }
    }
  }

  async function setOpenAIKey(apiKey) {
    const logText = getOpenAiLogText();
    try {
      if (!apiKey) {
        await keytar.deletePassword('AIGameAssistant', 'openai-api-key');
        openai = null;
        return { success: true, message: AI_ERROR_CODES.openaiKeyDeleted };
      }
      await keytar.setPassword('AIGameAssistant', 'openai-api-key', apiKey);
      openai = new OpenAI({ apiKey });
      console.log(logText.openaiKeySaved);
      return { success: true, message: AI_ERROR_CODES.openaiKeySaved };
    } catch (err) {
      console.error(logText.openaiKeySaveError, err.message);
      return { success: false, error: err.message };
    }
  }

  async function getOpenAIStatus() {
    const hasKey = await keytar.getPassword('AIGameAssistant', 'openai-api-key');
    return { configured: !!hasKey };
  }

  async function deleteOpenAIKey() {
    const logText = getOpenAiLogText();
    try {
      await keytar.deletePassword('AIGameAssistant', 'openai-api-key');
      openai = null;
      console.log(logText.openaiKeyDeleted);
      return { success: true };
    } catch (err) {
      console.error(logText.openaiKeyDeleteError, err.message);
      return { success: false, error: err.message };
    }
  }

  async function translateUiText(payload) {
    const { lang, entries } = payload || {};
    if (!openai) {
      return { success: false, error: AI_ERROR_CODES.openaiNotInitialized };
    }
    const targetLang = normalizeLanguage(lang);
    if (targetLang === 'en') {
      return { success: true, translations: {} };
    }
    const safeEntries = Array.isArray(entries)
      ? entries
          .map((entry) => ({
            key: String(entry && entry.key || '').trim(),
            text: String(entry && entry.text || '').trim()
          }))
          .filter((entry) => entry.key && entry.text)
      : [];
    if (!safeEntries.length) {
      return { success: true, translations: {} };
    }

    try {
      const systemPrompt = getUiTranslationSystemPrompt();
      const logText = getOpenAiLogText();
      const userPayload = JSON.stringify({
        targetLanguage: targetLang,
        entries: safeEntries
      });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPayload }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });

      const content = completion && completion.choices && completion.choices[0]
        ? completion.choices[0].message && completion.choices[0].message.content
        : null;
      if (!content) {
        return { success: false, error: AI_ERROR_CODES.emptyTranslationResponse };
      }
      const parsed = JSON.parse(content);
      const translations = parsed && parsed.translations ? parsed.translations : parsed;
      if (!translations || typeof translations !== 'object') {
        return { success: false, error: AI_ERROR_CODES.invalidTranslationResponse };
      }
      return { success: true, translations };
    } catch (err) {
      const logText = getOpenAiLogText();
      console.error(logText.uiTranslationError, err.message);
      return { success: false, error: err.message };
    }
  }

  return {
    normalizeLanguage,
    getSystemPrompt,
    initializeOpenAI,
    processText,
    processAudio,
    translateUiText,
    setOpenAIKey,
    getOpenAIStatus,
    deleteOpenAIKey
  };
}

module.exports = {
  createOpenAIService
};
