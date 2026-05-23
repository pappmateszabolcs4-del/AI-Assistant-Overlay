const AI_MODELS = {
  baseText: 'gpt-4o-mini',
  highQuality: 'gpt-4o'
};

const AI_KNOWLEDGE_MODES = {
  verified: 'VERIFIED',
  partial: 'PARTIAL',
  unknown: 'UNKNOWN'
};

const AI_MODEL_LABELS = {
  deterministic: 'deterministic',
  guarded: 'guarded'
};

const AI_TIMEOUT_FALLBACK = {
  vision: 'vision-fallback-to-text',
  text: 'text-fallback-basic'
};

const AI_DIAG_PREFIX = '[AI-DIAG]';

const AI_DIAG_EVENTS = {
  request: 'request',
  response: 'response',
  factsVerifiedNames: 'facts-verified-names',
  promptTrimPreview: 'prompt-trim-preview',
  promptTrimSimulated: 'prompt-trim-simulated',
  modelStrategyPreview: 'model-strategy-preview',
  entityWhitelistViolation: 'entity-whitelist-violation',
  intentRoutingValidation: 'intent-routing-validation'
};

const AI_MODEL_REASON_CODES = {
  hasImage: 'has-image',
  longInput: 'long-input',
  listHeavy: 'list-heavy',
  troubleshoot: 'troubleshoot',
  modSupport: 'mod-support',
  multiTurn: 'multi-turn'
};

const AI_ERROR_CODES = {
  openaiNotInitialized: 'openai-not-initialized',
  openaiKeyDeleted: 'openai-key-deleted',
  openaiKeySaved: 'openai-key-saved',
  emptyTranslationResponse: 'empty-translation-response',
  invalidTranslationResponse: 'invalid-translation-response'
};

const AI_INTENT_UNKNOWN = 'unknown';

const AI_INTENT_ROUTING_ISSUES = {
  routeMissingId: 'route-missing-id',
  duplicateIdPrefix: 'duplicate-id:',
  missingPatternsPrefix: 'missing-patterns:',
  missingPromptsPrefix: 'missing-prompts:'
};

const AI_PROMPT_SEGMENTS = {
  systemBase: 'systemBase',
  noLink: 'noLink',
  gameContext: 'gameContext',
  strictOverride: 'strictOverride',
  gameTemplate: 'gameTemplate',
  generalTemplate: 'generalTemplate',
  answerStyle: 'answerStyle',
  intentRouting: 'intentRouting',
  responseTemplate: 'responseTemplate',
  profile: 'profile',
  facts: 'facts',
  nameGuard: 'nameGuard',
  whitelist: 'whitelist'
};

const AI_PROMPT_TRIM_POLICY = {
  totalMaxChars: Number(process.env.PROMPT_TRIM_TOTAL_MAX_CHARS || 12000),
  segmentCaps: {
    [AI_PROMPT_SEGMENTS.answerStyle]: 400,
    [AI_PROMPT_SEGMENTS.intentRouting]: 1200,
    [AI_PROMPT_SEGMENTS.responseTemplate]: 1400,
    [AI_PROMPT_SEGMENTS.gameTemplate]: 2200,
    [AI_PROMPT_SEGMENTS.generalTemplate]: 1400,
    [AI_PROMPT_SEGMENTS.facts]: 2000,
    [AI_PROMPT_SEGMENTS.profile]: 1200,
    [AI_PROMPT_SEGMENTS.whitelist]: 800,
    [AI_PROMPT_SEGMENTS.nameGuard]: 800,
    [AI_PROMPT_SEGMENTS.noLink]: 400,
    [AI_PROMPT_SEGMENTS.strictOverride]: 320,
    [AI_PROMPT_SEGMENTS.gameContext]: 1200
  },
  trimOrder: [
    AI_PROMPT_SEGMENTS.answerStyle,
    AI_PROMPT_SEGMENTS.intentRouting,
    AI_PROMPT_SEGMENTS.responseTemplate,
    AI_PROMPT_SEGMENTS.gameTemplate,
    AI_PROMPT_SEGMENTS.generalTemplate,
    AI_PROMPT_SEGMENTS.facts,
    AI_PROMPT_SEGMENTS.profile,
    AI_PROMPT_SEGMENTS.whitelist,
    AI_PROMPT_SEGMENTS.nameGuard,
    AI_PROMPT_SEGMENTS.noLink,
    AI_PROMPT_SEGMENTS.strictOverride
  ]
};

const AI_DIAG_PREVIEW_MAX_CHARS = Number(process.env.DIAG_PREVIEW_MAX_CHARS || 800);

module.exports = {
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
};
