const OpenAI = require('openai');
const keytar = require('keytar');

let cachedClient = null;

function getClient(apiKey, baseUrl) {
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({ apiKey, baseURL: baseUrl || undefined });
  return cachedClient;
}

function withTimeout(promise, timeoutMs) {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error('llm-timeout'));
      }, timeoutMs);
    })
  ]);
}

async function resolveApiKey(options = {}) {
  const service = String(options.keytarService || 'AIGameAssistant').trim();
  const account = String(options.keytarAccount || 'openai-api-key').trim();
  if (service && account) {
    const stored = await keytar.getPassword(service, account);
    if (stored) return stored;
  }
  if (options.allowEnv) {
    const envKey = process.env.OPENAI_API_KEY || '';
    if (envKey) return envKey;
  }
  return '';
}

function buildSystemPrompt(policy) {
  const maxLen = policy && policy.factLimits ? policy.factLimits.textMaxLength : 240;
  const maxKeywords = policy && policy.factLimits ? policy.factLimits.keywordsMax : 12;
  const maxTags = policy && policy.factLimits ? policy.factLimits.tagsMax : 8;
  return [
    'You extract compact gameplay facts for a game assistant.',
    'Return JSON only, no markdown, no explanations.',
    'Each fact is short, actionable, and focused on gameplay decisions.',
    'No lore, no story, no guide paragraphs.',
    `Fact text must be at most ${maxLen} characters.`,
    `Max ${maxKeywords} keywords and ${maxTags} tags per fact.`,
    'Allowed fields: text, keywords, tags, priority, system, gameStage, confidence.',
    'Priority is 1-3 where 3 is highest.',
    'Output format: {"facts": [ ... ]}.'
  ].join(' ');
}

function buildUserPrompt(chunk, options) {
  const game = String(options.game || '').trim();
  const sourceType = String(options.sourceType || '').trim();
  return [
    `Game: ${game || 'Unknown'}.`,
    `Source type: ${sourceType || 'user'}.`,
    'Extract 3-10 compact gameplay facts from the text below.',
    'Text:',
    String(chunk && chunk.text || '').trim()
  ].join('\n');
}

function extractJsonFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const firstBrace = raw.indexOf('{');
  const firstBracket = raw.indexOf('[');
  let start = -1;
  if (firstBrace === -1) start = firstBracket;
  else if (firstBracket === -1) start = firstBrace;
  else start = Math.min(firstBrace, firstBracket);
  if (start === -1) return null;
  const lastBrace = raw.lastIndexOf('}');
  const lastBracket = raw.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);
  if (end <= start) return null;
  const slice = raw.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (_) {
    return null;
  }
}

function normalizeFactsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.facts)) return payload.facts;
  return [];
}

async function extractFactsFromChunk(chunk, options = {}) {
  if (!options.enableLlm) {
    return { facts: [], diagnostics: { skipped: true, reason: 'llm-disabled' } };
  }
  const apiKey = await resolveApiKey(options);
  if (!apiKey) {
    return { facts: [], diagnostics: { skipped: true, reason: 'missing-api-key' } };
  }

  const model = options.model || process.env.OPENAI_FACT_MODEL || 'gpt-4o-mini';
  const client = getClient(apiKey, process.env.OPENAI_BASE_URL);
  const systemPrompt = buildSystemPrompt(options.policy);
  const userPrompt = buildUserPrompt(chunk, options);
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? options.timeoutMs
    : Number(process.env.OPENAI_FACT_TIMEOUT_MS || 0);

  try {
    const response = await withTimeout(
      client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 800
      }),
      timeoutMs
    );

    const content = response && response.choices && response.choices[0]
      ? response.choices[0].message.content
      : '';
    const parsed = extractJsonFromText(content);
    const facts = normalizeFactsPayload(parsed);
    const usage = response && response.usage ? response.usage : {};
    return {
      facts,
      diagnostics: {
        model,
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      }
    };
  } catch (err) {
    return {
      facts: [],
      diagnostics: { error: err && err.message ? err.message : String(err) }
    };
  }
}

module.exports = {
  extractFactsFromChunk
};
