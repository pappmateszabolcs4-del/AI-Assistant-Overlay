// Overlay UI logic.

// Specialization level csuszka
const specializationSlider = document.getElementById('specializationLevel');
const specValue = document.getElementById('specValue');

on(specializationSlider, 'input', () => {
  specValue.textContent = specializationSlider.value;
  localStorage.setItem(STORAGE_KEYS.OVERLAY_SPECIALIZATION_LEVEL, specializationSlider.value);
});

// Specialization level betoltese
const savedSpecLevel = localStorage.getItem(STORAGE_KEYS.OVERLAY_SPECIALIZATION_LEVEL) || '3';
specializationSlider.value = savedSpecLevel;
specValue.textContent = savedSpecLevel;

// Hotkey-t global szinten blokkoljuk az overlay-ben
on(document, 'keydown', (e) => {
  // Ctrl+Shift+K - blokkoljuk az overlay-ben
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'K') {
    e.preventDefault();
    e.stopPropagation();
    // If the user is currently holding a panel header (pending detach gesture),
    // cancel it before hiding the overlay. Otherwise the stale state can cause
    // an unintended detach when the overlay is shown again.
    try { window.__cancelAnyDetachGesture && window.__cancelAnyDetachGesture(); } catch (_) {}
    cleanupOverlay();
    fireAndForget(IPC_CHANNELS.CLOSE_OVERLAY);
    return false;
  }
}, true);  // Capture phase, hogy biztosan fogja el

// Mikrofon funkcio
var micBtn = document.getElementById('micBtn');
var status = document.getElementById('status');
var questionInput = document.getElementById('questionInput');
var askBtn = document.getElementById('askBtn');

let recording = false;
let recognition = null; // Web Speech API (deprecated, now using Whisper)
let mediaRecorder = null; // MediaRecorder for Whisper audio capture
let currentScreenshot = null; // Base64 image data
var currentGameContext = null;
let devToolsEnabled = true;
const GAME_TEMPLATE_OPTIONS_LIMIT = 5;
const ANSWER_STYLE_OPTIONS = [
  { id: 'short', labelKey: 'answerStyleShort' },
  { id: 'steps', labelKey: 'answerStyleSteps' },
  { id: 'deep', labelKey: 'answerStyleDeep' }
];
const DEFAULT_ANSWER_STYLE = 'steps';
let gameTemplateOptions = [];
let gameTemplateDraft = null;
let gameTemplateLabel = null;
let gameTemplateHint = null;
let gameTemplateNameInput = null;
let gameTemplateOptionsLabel = null;
let gameTemplateOptionsHint = null;
let gameTemplateOptionsList = null;
let gameTemplateOptionsLimit = null;
let gameTemplateStyleLabel = null;
let gameTemplateStyleHint = null;
let gameTemplateStyleSelect = null;
let gameTemplateCustomLabel = null;
let gameTemplateText = null;
let gameTemplateLoadBtn = null;
let gameTemplateUseCurrentBtn = null;
let gameTemplateSaveBtn = null;
let gameTemplateDeleteBtn = null;
let gameTemplateStatus = null;
let lastAutoTemplateGame = '';
let addFactBtn = null;
let factModal = null;
let factModalTitle = null;
let factModalHint = null;
let factGameLabel = null;
let factGameInput = null;
let factTextLabel = null;
let factTextInput = null;
let factKeywordsLabel = null;
let factKeywordsInput = null;
let factTagsLabel = null;
let factTagsInput = null;
let factModalStatus = null;
let factModalCancel = null;
let factModalSave = null;
let answerStyleLabel = null;
let answerStyleHint = null;
let answerStyleSelect = null;

function getUserFacingErrorMessage(rawError) {
  const msg = String(rawError || '').trim();
  if (!msg) return '';
  const lower = msg.toLowerCase();

  if (msg === 'overlay-missing') return t().errorOverlayMissing || msg;
  if (msg === 'window-missing') return t().errorWindowMissing || msg;
  if (lower.includes('nincs elerheto kepernyo') || lower.includes('no screen')) {
    return t().errorNoScreen || msg;
  }
  if (msg === 'openai-not-initialized' || msg === 'openai-key-missing') {
    return t().errorOpenAiKey || msg;
  }
  if (lower.includes('openai') && (lower.includes('kulcs') || lower.includes('api key') || lower.includes('api kulcs'))) {
    return t().errorOpenAiKey || msg;
  }

  return '';
}

let visionAllowOnceKey = null;

function normalizeVisionGameKey(value) {
  return String(value || '').trim().toLowerCase();
}

function parseVisionListInput(text) {
  const entries = String(text || '')
    .split(/\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const unique = [];
  entries.forEach((entry) => {
    if (!unique.includes(entry)) unique.push(entry);
  });
  return unique;
}

function loadVisionList(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

function persistVisionList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list || []));
  } catch (_) {}
}

function isGameInVisionList(gameName, list) {
  const key = normalizeVisionGameKey(gameName);
  if (!key) return false;
  return list.some((entry) => normalizeVisionGameKey(entry) === key);
}

function readVisionEnabled() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VISION_ENABLED);
    if (raw === null) return false;
    return raw === 'true';
  } catch (_) {
    return false;
  }
}

function writeVisionEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEYS.VISION_ENABLED, enabled ? 'true' : 'false');
  } catch (_) {}
}

function readAiDiagnosticsEnabled() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AI_DIAGNOSTICS_ENABLED);
    return raw === 'true';
  } catch (_) {
    return false;
  }
}

function writeAiDiagnosticsEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEYS.AI_DIAGNOSTICS_ENABLED, enabled ? 'true' : 'false');
  } catch (_) {}
}

function syncAiDiagnosticsEnabled(enabled) {
  try { invokeMain(IPC_CHANNELS.SET_AI_DIAGNOSTICS, { enabled: !!enabled }); } catch (_) {}
}

const DIAGNOSTICS_STORE_LIMIT = 1000;

function loadDiagnosticsStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AI_DIAGNOSTICS_STORE);
    if (!raw) return { promptTrim: [], promptTrimSim: [], modelStrategy: [], requests: [], responses: [], violations: [], latency: [] };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? parsed
      : { promptTrim: [], promptTrimSim: [], modelStrategy: [], requests: [], responses: [], violations: [], latency: [] };
  } catch (_) {
    return { promptTrim: [], promptTrimSim: [], modelStrategy: [], requests: [], responses: [], violations: [], latency: [] };
  }
}

function saveDiagnosticsStore(store) {
  try {
    localStorage.setItem(STORAGE_KEYS.AI_DIAGNOSTICS_STORE, JSON.stringify(store || {}));
  } catch (_) {}
}

function pushDiagnosticsEntry(list, entry) {
  if (!Array.isArray(list)) return;
  list.push(entry);
  if (list.length > DIAGNOSTICS_STORE_LIMIT) {
    list.splice(0, list.length - DIAGNOSTICS_STORE_LIMIT);
  }
}

function recordDiagnosticsEvent(payload) {
  if (!payload || !readAiDiagnosticsEnabled()) return;
  const store = loadDiagnosticsStore();
  const event = String(payload.event || '').trim();
  if (event === 'prompt-trim-preview') {
    pushDiagnosticsEntry(store.promptTrim, payload);
  } else if (event === 'prompt-trim-simulated') {
    pushDiagnosticsEntry(store.promptTrimSim, payload);
  } else if (event === 'model-strategy-preview') {
    pushDiagnosticsEntry(store.modelStrategy, payload);
  } else if (event === 'request') {
    pushDiagnosticsEntry(store.requests, payload);
  } else if (event === 'response') {
    pushDiagnosticsEntry(store.responses, payload);
  } else if (event === 'entity-whitelist-violation') {
    pushDiagnosticsEntry(store.violations, payload);
  }
  saveDiagnosticsStore(store);
}

function recordLatencySample(durationMs, hasImage) {
  if (!readAiDiagnosticsEnabled()) return;
  const store = loadDiagnosticsStore();
  const sample = {
    ts: Date.now(),
    durationMs: Math.max(0, Math.round(Number(durationMs) || 0)),
    hasImage: !!hasImage
  };
  pushDiagnosticsEntry(store.latency, sample);
  saveDiagnosticsStore(store);
}

function exportDiagnosticsForShare(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const store = loadDiagnosticsStore();
  const pickLast = (list) => (Array.isArray(list) && list.length ? list[list.length - 1] : null);
  const payload = {
    request: pickLast(store.requests),
    response: pickLast(store.responses),
    whitelistViolation: pickLast(store.violations)
  };
  const text = JSON.stringify(payload, null, 2);
  if (opts.copy !== false && navigator && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  return text;
}

function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return String(Math.round(num));
}

function formatRate(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0%';
  return `${Math.round(num * 100)}%`;
}

function getP95(samples) {
  if (!samples.length) return 0;
  const sorted = samples.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
  return sorted[idx];
}

function renderDiagTable(tableEl, rows) {
  if (!tableEl) return;
  tableEl.innerHTML = '';
  rows.forEach((row) => {
    const rowEl = document.createElement('div');
    rowEl.className = row.isHeader ? 'dev-tools-table-row header' : 'dev-tools-table-row';
    row.cells.forEach((cell) => {
      const cellEl = document.createElement('div');
      cellEl.className = 'dev-tools-table-cell';
      cellEl.textContent = cell;
      rowEl.appendChild(cellEl);
    });
    tableEl.appendChild(rowEl);
  });
}

function renderDiagList(listEl, items, emptyText) {
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'dev-tools-item';
    empty.textContent = emptyText;
    listEl.appendChild(empty);
    return;
  }
  items.forEach((text) => {
    const item = document.createElement('div');
    item.className = 'dev-tools-item';
    item.textContent = text;
    listEl.appendChild(item);
  });
}

function renderPromptBudgetSummary(store) {
  if (!diagPromptBudgetTable) return;
  const entries = Array.isArray(store.promptTrim) ? store.promptTrim : [];
  if (!entries.length) {
    diagPromptBudgetTable.textContent = t().diagPromptBudgetEmpty || 'No prompt trim data.';
    return;
  }
  const segmentStats = new Map();
  let totalCount = 0;
  let totalChars = 0;
  let totalMax = 0;
  entries.forEach((entry) => {
    if (!entry || !Array.isArray(entry.segments)) return;
    const entryTotal = Number(entry.totalChars) || 0;
    totalCount += 1;
    totalChars += entryTotal;
    if (entryTotal > totalMax) totalMax = entryTotal;
    entry.segments.forEach((segment) => {
      const id = String(segment && segment.id || 'unknown');
      const chars = Number(segment && segment.chars) || 0;
      const stat = segmentStats.get(id) || { count: 0, total: 0, max: 0 };
      stat.count += 1;
      stat.total += chars;
      stat.max = Math.max(stat.max, chars);
      segmentStats.set(id, stat);
    });
  });
  const rows = [{
    isHeader: true,
    cells: [t().diagPromptBudgetSegment || 'Segment', t().diagPromptBudgetAvg || 'Avg chars', t().diagPromptBudgetMax || 'Max chars']
  }];
  if (totalCount) {
    rows.push({
      isHeader: false,
      cells: [t().diagPromptBudgetTotal || 'Total', formatNumber(totalChars / totalCount), formatNumber(totalMax)]
    });
  }
  const segmentRows = Array.from(segmentStats.entries())
    .map(([id, stat]) => ({ id, avg: stat.total / Math.max(1, stat.count), max: stat.max }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 8);
  segmentRows.forEach((row) => {
    rows.push({
      isHeader: false,
      cells: [row.id, formatNumber(row.avg), formatNumber(row.max)]
    });
  });
  renderDiagTable(diagPromptBudgetTable, rows);
}

function renderIntentBreakdown(store) {
  const entries = Array.isArray(store.promptTrim) ? store.promptTrim : [];
  const intentStats = new Map();
  entries.forEach((entry) => {
    const intent = String(entry && entry.intent || 'unknown');
    const total = Number(entry && entry.totalChars) || 0;
    const stat = intentStats.get(intent) || { count: 0, total: 0 };
    stat.count += 1;
    stat.total += total;
    intentStats.set(intent, stat);
  });
  const items = Array.from(intentStats.entries())
    .map(([intent, stat]) => ({
      intent,
      count: stat.count,
      avg: stat.total / Math.max(1, stat.count)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((item) => `${item.intent}: avg ${formatNumber(item.avg)} chars (${item.count})`);
  renderDiagList(diagIntentBreakdownList, items, t().diagIntentBreakdownEmpty || 'No intent data.');
}

function renderFactLoadSummary(store) {
  const requests = Array.isArray(store.requests) ? store.requests : [];
  const responses = Array.isArray(store.responses) ? store.responses : [];
  const pairs = Math.min(requests.length, responses.length);
  if (!pairs) {
    renderDiagList(diagFactLoadList, [], t().diagFactLoadEmpty || 'No fact stats yet.');
    return;
  }
  const startReq = requests.length - pairs;
  const startRes = responses.length - pairs;
  let factsWith = 0;
  let factsWithCount = 0;
  let factsWithTooGeneric = 0;
  let factsZero = 0;
  let factsZeroTooGeneric = 0;
  for (let i = 0; i < pairs; i += 1) {
    const req = requests[startReq + i] || {};
    const res = responses[startRes + i] || {};
    const factsCount = Number(req.factsCount) || 0;
    const tooGeneric = !!res.tooGeneric;
    if (factsCount > 0) {
      factsWith += factsCount;
      factsWithCount += 1;
      if (tooGeneric) factsWithTooGeneric += 1;
    } else {
      factsZero += 1;
      if (tooGeneric) factsZeroTooGeneric += 1;
    }
  }
  const items = [
    `${t().diagFactLoadPairs || 'Paired samples'}: ${pairs}`,
    `${t().diagFactLoadWithFacts || 'Facts > 0'}: avg ${formatNumber(factsWith / Math.max(1, factsWithCount))}, ${t().diagFactLoadTooGeneric || 'too generic'} ${formatRate(factsWithTooGeneric / Math.max(1, factsWithCount))}`,
    `${t().diagFactLoadNoFacts || 'Facts = 0'}: ${t().diagFactLoadTooGeneric || 'too generic'} ${formatRate(factsZeroTooGeneric / Math.max(1, factsZero))}`
  ];
  renderDiagList(diagFactLoadList, items, t().diagFactLoadEmpty || 'No fact stats yet.');
}

function renderLatencySummary(store) {
  const samples = Array.isArray(store.latency) ? store.latency : [];
  if (!samples.length) {
    renderDiagList(diagLatencyList, [], t().diagLatencyEmpty || 'No latency samples yet.');
    return;
  }
  const withImage = samples.filter((sample) => sample.hasImage);
  const withoutImage = samples.filter((sample) => !sample.hasImage);
  const avg = (list) => list.reduce((sum, sample) => sum + (Number(sample.durationMs) || 0), 0) / Math.max(1, list.length);
  const p95 = (list) => getP95(list.map((sample) => Number(sample.durationMs) || 0));
  const items = [
    `${t().diagLatencySamples || 'Samples'}: ${samples.length}`,
    `${t().diagLatencyNoImage || 'Text-only'}: avg ${formatNumber(avg(withoutImage))}ms, p95 ${formatNumber(p95(withoutImage))}ms (${withoutImage.length})`,
    `${t().diagLatencyWithImage || 'With image'}: avg ${formatNumber(avg(withImage))}ms, p95 ${formatNumber(p95(withImage))}ms (${withImage.length})`
  ];
  renderDiagList(diagLatencyList, items, t().diagLatencyEmpty || 'No latency samples yet.');
}

function buildTrimExport(store) {
  if (!diagTrimExportOutput) return;
  const entries = Array.isArray(store.promptTrimSim) ? store.promptTrimSim : [];
  if (!entries.length) {
    diagTrimExportOutput.value = t().diagTrimExportEmpty || 'No trim snapshots yet.';
    return;
  }
  const snapshot = entries.slice(-20);
  diagTrimExportOutput.value = JSON.stringify(snapshot, null, 2);
}

function refreshDiagnosticsUI() {
  const store = loadDiagnosticsStore();
  renderPromptBudgetSummary(store);
  renderIntentBreakdown(store);
  renderFactLoadSummary(store);
  renderLatencySummary(store);
}

function normalizeAnswerStyle(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'short' || raw === 'steps' || raw === 'deep') return raw;
  return '';
}

function readGlobalAnswerStyle() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OVERLAY_ANSWER_STYLE);
    const normalized = normalizeAnswerStyle(raw);
    return normalized || DEFAULT_ANSWER_STYLE;
  } catch (_) {
    return DEFAULT_ANSWER_STYLE;
  }
}

function writeGlobalAnswerStyle(style) {
  const normalized = normalizeAnswerStyle(style) || DEFAULT_ANSWER_STYLE;
  try {
    localStorage.setItem(STORAGE_KEYS.OVERLAY_ANSWER_STYLE, normalized);
  } catch (_) {}
}

function loadAutoSeedDecisions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GAME_TEMPLATE_AUTOSEED_DECISIONS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function saveAutoSeedDecisions(decisions) {
  try {
    localStorage.setItem(STORAGE_KEYS.GAME_TEMPLATE_AUTOSEED_DECISIONS, JSON.stringify(decisions || {}));
  } catch (_) {}
}

function updateVisionSettingsUI() {
  if (visionEnableToggle) {
    visionEnableToggle.checked = readVisionEnabled();
  }
  if (visionAllowListInput) {
    visionAllowListInput.value = loadVisionList(STORAGE_KEYS.VISION_ALLOWLIST).join('\n');
  }
  if (visionDenyListInput) {
    visionDenyListInput.value = loadVisionList(STORAGE_KEYS.VISION_DENYLIST).join('\n');
  }
}

function closeVisionConsentModal() {
  if (!visionConsentModal || !visionConsentModal.classList.contains('active')) return;
  visionConsentModal.classList.remove('active');
}

function showVisionConsentModal(gameName) {
  if (!visionConsentModal) return Promise.resolve('cancel');
  const displayName = gameName || (t().visionConsentUnknownGame || 'Unknown game');
  const template = t().visionConsentModalMessage || 'Allow Vision analysis for "{game}"?';
  if (visionConsentTitle) visionConsentTitle.textContent = t().visionConsentModalTitle || 'Vision consent';
  if (visionConsentMessage) visionConsentMessage.textContent = template.replace('{game}', displayName);

  const hasGame = !!normalizeVisionGameKey(gameName);
  if (visionConsentAllowAlways) visionConsentAllowAlways.style.display = hasGame ? 'inline-flex' : 'none';
  if (visionConsentDenyAlways) visionConsentDenyAlways.style.display = hasGame ? 'inline-flex' : 'none';

  return new Promise((resolve) => {
    const finalize = (result) => {
      closeVisionConsentModal();
      resolve(result);
    };

    const onceHandler = () => finalize('once');
    const allowHandler = () => finalize('allow');
    const denyHandler = () => finalize('deny');
    const cancelHandler = () => finalize('cancel');

    if (visionConsentAllowOnce) visionConsentAllowOnce.onclick = onceHandler;
    if (visionConsentAllowAlways) visionConsentAllowAlways.onclick = allowHandler;
    if (visionConsentDenyAlways) visionConsentDenyAlways.onclick = denyHandler;
    if (visionConsentCancel) visionConsentCancel.onclick = cancelHandler;

    visionConsentModal.onclick = (ev) => {
      if (ev && ev.target === visionConsentModal) cancelHandler();
    };

    visionConsentModal.classList.add('active');
  });
}

function parseFactListInput(value) {
  return String(value || '')
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function closeFactModal() {
  if (!factModal || !factModal.classList.contains('active')) return;
  factModal.classList.remove('active');
}

async function showFactModal() {
  if (!factModal) return;
  const templateGame = await ensureTemplateDraftSaved();
  const resolvedGame = currentGameContext || templateGame || '';
  if (factGameInput && !factGameInput.value) {
    factGameInput.value = resolvedGame || '';
  }
  if (factModalStatus) factModalStatus.textContent = '';
  factModal.classList.add('active');
}

async function saveFactFromModal() {
  if (!factModal) return;
  const game = String(factGameInput ? factGameInput.value : '').trim();
  const text = String(factTextInput ? factTextInput.value : '').trim();
  const keywords = parseFactListInput(factKeywordsInput ? factKeywordsInput.value : '');
  const tags = parseFactListInput(factTagsInput ? factTagsInput.value : '');

  if (!game) {
    if (factModalStatus) factModalStatus.textContent = t().factModalMissingGame || 'Missing game name.';
    return;
  }
  if (!text) {
    if (factModalStatus) factModalStatus.textContent = t().factModalMissingText || 'Missing fact text.';
    return;
  }

  const response = await invokeMain(IPC_CHANNELS.ADD_GAME_FACT, {
    game,
    text,
    keywords,
    tags
  });

  if (!response || !response.success) {
    const err = response && response.error ? response.error : t().unknownError || 'Unknown error';
    if (factModalStatus) factModalStatus.textContent = `${t().factModalErrorPrefix || 'Error: '}${err}`;
    return;
  }

  if (factModalStatus) factModalStatus.textContent = t().factModalSaved || 'Saved.';
  if (factTextInput) factTextInput.value = '';
  if (factKeywordsInput) factKeywordsInput.value = '';
  if (factTagsInput) factTagsInput.value = '';
  closeFactModal();
}

async function ensureVisionConsent() {
  if (!readVisionEnabled()) {
    status.textContent = t().visionConsentDisabled;
    return false;
  }

  if (!currentGameContext) {
    await requestGameContext();
  }

  const templateGame = await ensureTemplateDraftSaved();
  const resolvedGameContext = currentGameContext || templateGame || null;

  const gameName = currentGameContext || '';
  const allowList = loadVisionList(STORAGE_KEYS.VISION_ALLOWLIST);
  const denyList = loadVisionList(STORAGE_KEYS.VISION_DENYLIST);

  if (isGameInVisionList(gameName, denyList)) {
    status.textContent = (t().visionConsentDenied || '').replace('{game}', gameName || '');
    return false;
  }

  if (isGameInVisionList(gameName, allowList)) {
    return true;
  }

  const normalizedKey = normalizeVisionGameKey(gameName);
  if (visionAllowOnceKey && (visionAllowOnceKey === '__any__' || visionAllowOnceKey === normalizedKey)) {
    return true;
  }

  const choice = await showVisionConsentModal(gameName);
  if (choice === 'once') {
    visionAllowOnceKey = normalizedKey || '__any__';
    return true;
  }
  if (choice === 'allow' && normalizedKey) {
    if (!isGameInVisionList(gameName, allowList)) {
      allowList.push(gameName);
      persistVisionList(STORAGE_KEYS.VISION_ALLOWLIST, allowList);
      updateVisionSettingsUI();
    }
    return true;
  }
  if (choice === 'deny' && normalizedKey) {
    if (!isGameInVisionList(gameName, denyList)) {
      denyList.push(gameName);
      persistVisionList(STORAGE_KEYS.VISION_DENYLIST, denyList);
      updateVisionSettingsUI();
    }
    status.textContent = (t().visionConsentDenied || '').replace('{game}', gameName || '');
    return false;
  }

  if (t().visionConsentCanceled) status.textContent = t().visionConsentCanceled;
  return false;
}

// Editable Note Panel (separate window)
const NOTE_PANEL_BOUNDS_KEY = STORAGE_KEYS.NOTE_PANEL_BOUNDS;
let notePanelBounds = null; // { x, y, width, height } in screen coords

function loadNotePanelBounds() {
  const saved = localStorage.getItem(NOTE_PANEL_BOUNDS_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object') {
      notePanelBounds = {
        x: typeof parsed.x === 'number' ? parsed.x : Number(parsed.x),
        y: typeof parsed.y === 'number' ? parsed.y : Number(parsed.y),
        width: typeof parsed.width === 'number' ? parsed.width : Number(parsed.width),
        height: typeof parsed.height === 'number' ? parsed.height : Number(parsed.height)
      };
      if (!Number.isFinite(notePanelBounds.x)) notePanelBounds.x = 120;
      if (!Number.isFinite(notePanelBounds.y)) notePanelBounds.y = 120;
      if (!Number.isFinite(notePanelBounds.width)) notePanelBounds.width = 420;
      if (!Number.isFinite(notePanelBounds.height)) notePanelBounds.height = 280;
    }
  } catch (_) {
    notePanelBounds = null;
  }
}

function saveNotePanelBounds() {
  if (!notePanelBounds) return;
  try {
    localStorage.setItem(NOTE_PANEL_BOUNDS_KEY, JSON.stringify(notePanelBounds));
  } catch (_) {}
}

async function openNotePanel() {
  const labels = {
    title: t().notePanelTitle || '📝 Note',
    placeholder: t().notePanelPlaceholder || 'Write a note...'
  };
  await invokeMain(IPC_CHANNELS.NOTE_PANEL_OPEN, {
    labels
  });
}

ipcRenderer.on(IPC_CHANNELS.NOTE_PANEL_BOUNDS, (_event, payload) => {
  if (!payload || !payload.bounds) return;
  const b = payload.bounds;
  if (typeof b.x !== 'number' || typeof b.y !== 'number' || typeof b.width !== 'number' || typeof b.height !== 'number') return;
  notePanelBounds = { x: b.x, y: b.y, width: b.width, height: b.height };
  saveNotePanelBounds();
});

// Vision controls
const screenshotBtn = document.getElementById('screenshotBtn');
const clearImageBtn = document.getElementById('clearImageBtn');
const screenshotPreview = document.getElementById('screenshotPreview');
const screenshotInfo = document.getElementById('screenshotInfo');
const visionEnableToggle = document.getElementById('visionEnableToggle');
const visionAllowListInput = document.getElementById('visionAllowListInput');
const visionDenyListInput = document.getElementById('visionDenyListInput');
const visionConsentSaveBtn = document.getElementById('visionConsentSaveBtn');
const visionConsentResetBtn = document.getElementById('visionConsentResetBtn');
const aiDiagnosticsLabel = document.getElementById('aiDiagnosticsLabel');
const aiDiagnosticsToggle = document.getElementById('aiDiagnosticsToggle');
const aiDiagnosticsToggleLabel = document.getElementById('aiDiagnosticsToggleLabel');
const aiDiagnosticsHint = document.getElementById('aiDiagnosticsHint');
const diagPanelLabel = document.getElementById('diagPanelLabel');
const diagRefreshBtn = document.getElementById('diagRefreshBtn');
const diagClearBtn = document.getElementById('diagClearBtn');
const diagHint = document.getElementById('diagHint');
const diagPromptBudgetLabel = document.getElementById('diagPromptBudgetLabel');
const diagPromptBudgetTable = document.getElementById('diagPromptBudgetTable');
const diagTrimExportLabel = document.getElementById('diagTrimExportLabel');
const diagTrimExportBtn = document.getElementById('diagTrimExportBtn');
const diagTrimExportOutput = document.getElementById('diagTrimExportOutput');
const diagTrimExportHint = document.getElementById('diagTrimExportHint');
const diagIntentBreakdownLabel = document.getElementById('diagIntentBreakdownLabel');
const diagIntentBreakdownList = document.getElementById('diagIntentBreakdownList');
const diagFactLoadLabel = document.getElementById('diagFactLoadLabel');
const diagFactLoadList = document.getElementById('diagFactLoadList');
const diagLatencyLabel = document.getElementById('diagLatencyLabel');
const diagLatencyList = document.getElementById('diagLatencyList');
const devToolsLabel = document.getElementById('devToolsLabel');
const devToolsHint = document.getElementById('devToolsHint');
const perfHudToggleLabel = document.getElementById('perfHudToggleLabel');
const factRequestsLabel = document.getElementById('factRequestsLabel');
const factRequestsGameLabel = document.getElementById('factRequestsGameLabel');
const factRequestsGameInput = document.getElementById('factRequestsGameInput');
const factRequestsRefreshBtn = document.getElementById('factRequestsRefreshBtn');
const factRequestsList = document.getElementById('factRequestsList');
const hotGamesLabel = document.getElementById('hotGamesLabel');
const hotGamesRefreshBtn = document.getElementById('hotGamesRefreshBtn');
const hotGamesList = document.getElementById('hotGamesList');

const visionConsentModal = document.getElementById('visionConsentModal');
const visionConsentTitle = document.getElementById('visionConsentTitle');
const visionConsentMessage = document.getElementById('visionConsentMessage');
const visionConsentAllowOnce = document.getElementById('visionConsentAllowOnce');
const visionConsentAllowAlways = document.getElementById('visionConsentAllowAlways');
const visionConsentDenyAlways = document.getElementById('visionConsentDenyAlways');
const visionConsentCancel = document.getElementById('visionConsentCancel');

addFactBtn = document.getElementById('addFactBtn');
factModal = document.getElementById('factModal');
factModalTitle = document.getElementById('factModalTitle');
factModalHint = document.getElementById('factModalHint');
factGameLabel = document.getElementById('factGameLabel');
factGameInput = document.getElementById('factGameInput');
factTextLabel = document.getElementById('factTextLabel');
factTextInput = document.getElementById('factTextInput');
factKeywordsLabel = document.getElementById('factKeywordsLabel');
factKeywordsInput = document.getElementById('factKeywordsInput');
factTagsLabel = document.getElementById('factTagsLabel');
factTagsInput = document.getElementById('factTagsInput');
factModalStatus = document.getElementById('factModalStatus');
factModalCancel = document.getElementById('factModalCancel');
factModalSave = document.getElementById('factModalSave');

// Collapsible sections toggle
const floatingHost = document.getElementById('floating-panels');
// Ensure clean state after reload
floatingHost.innerHTML = '';
document.querySelectorAll('.collapsible-section').forEach((section) => {
  section.__floatingContent = null;
});
document.querySelectorAll('.section-content').forEach((content) => {
  content.classList.remove('open');
  content.style.display = 'none';
  content.style.left = '';
  content.style.top = '';
  content.style.height = '';
  content.style.minWidth = '';
  content.style.visibility = '';
  content.style.maxHeight = `${getPopupMaxHeightPx()}px`;
  const homeSection = content.__homeSection || content.closest('.collapsible-section');
  if (homeSection && homeSection !== content.parentElement) {
    homeSection.appendChild(content);
  }
  content.__homeSection = homeSection;
  content.__anchorBtn = null;
});

let clickThroughState = null;
let overlayHovered = false;
let forceInteractiveCount = 0;
let interactionHoldUntil = 0;
let lastPointerClientX = 0;
let lastPointerClientY = 0;
let hoverEvalFrame = null;

// Main-process assist: when mouse-forwarding gets re-enabled (after cursor leaves a child window),
// we may not get a move event before the user clicks. Accept a pushed cursor position and
// re-evaluate hover/click-through immediately.
try {
  ipcRenderer.on(IPC_CHANNELS.OVERLAY_CURSOR_SCREEN_POINT, (_event, payload) => {
    try {
      if (__isDetachedPanelWindow) return;
      if (!payload || !payload.bounds) return;
      const sx = Number(payload.x);
      const sy = Number(payload.y);
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;
      const b = payload.bounds;
      const bx = Number(b.x);
      const by = Number(b.y);
      if (!Number.isFinite(bx) || !Number.isFinite(by)) return;

      lastPointerClientX = sx - bx;
      lastPointerClientY = sy - by;
      // Run immediately so the next click has the right ignore-mouse state.
      evaluateHoverFromPoint(lastPointerClientX, lastPointerClientY);
    } catch (_) {}
  });
} catch (_) {}

function getPopupMaxHeightPx() {
  const gutter = 12;
  return Math.max(260, Math.round(window.innerHeight - gutter * 2));
}

function syncClickThrough(allowThrough) {
  if (__isDetachedPanelWindow || (typeof __isBlockWindow !== 'undefined' && __isBlockWindow)) return;
  // After an interaction (resize/drag), keep the window interactive briefly.
  // This prevents a common failure mode where pointerup happens outside the window
  // (due to pointer capture), we immediately go click-through, and the next click
  // on the handle never reaches the window unless the user moves the mouse first.
  if (Date.now() < interactionHoldUntil) {
    allowThrough = false;
  }
  if (clickThroughState === allowThrough) return;
  clickThroughState = allowThrough;
  fireAndForget(IPC_CHANNELS.SET_CLICK_THROUGH, allowThrough);
}

function holdInteractive(ms = 600) {
  const until = Date.now() + Math.max(0, ms | 0);
  interactionHoldUntil = Math.max(interactionHoldUntil, until);
  overlayHovered = true;
  syncClickThrough(false);
}

window.__holdInteractive = holdInteractive;

function pushForceInteractive() {
  forceInteractiveCount += 1;
  overlayHovered = true;
  syncClickThrough(false);
}

function popForceInteractive() {
  forceInteractiveCount = Math.max(0, forceInteractiveCount - 1);
  if (forceInteractiveCount > 0) return;
  setTimeout(() => {
    if (forceInteractiveCount > 0) return;
    if (Date.now() < interactionHoldUntil) {
      overlayHovered = true;
      syncClickThrough(false);
      return;
    }
    const el = document.elementFromPoint(lastPointerClientX, lastPointerClientY);
    overlayHovered = isInteractiveTarget(el) || isPointOverInteractiveRect(lastPointerClientX, lastPointerClientY);
    syncClickThrough(!overlayHovered);
  }, 0);
}

window.__pushForceInteractive = pushForceInteractive;
window.__popForceInteractive = popForceInteractive;

const INTERACTIVE_SELECTOR = [
  '#dragHandle',
  '.resize-handle-right',
  '.resize-handle-bottom',
  '.section-header',
  '.section-content',
  '.popup-resize-handle',
  '.history-item',
  'button',
  'input',
  'select',
  'textarea',
  'a[href]',
  '[role="button"]'
].join(',');

function isInteractiveTarget(target) {
  if (!target) return false;
  const el = target.nodeType === 1 ? target : target.parentElement;
  if (!el) return false;

  // Modal is always interactive when open
  if (confirmModal && confirmModal.classList.contains('active') && confirmModal.contains(el)) {
    return true;
  }
  if (visionConsentModal && visionConsentModal.classList.contains('active') && visionConsentModal.contains(el)) {
    return true;
  }
  if (factModal && factModal.classList.contains('active') && factModal.contains(el)) {
    return true;
  }

  // Only treat specific UI elements as interactive.
  // This prevents the whole overlay window from blocking clicks in "empty" areas.
  const hit = el.closest(INTERACTIVE_SELECTOR);
  if (!hit) return false;
  // Ensure it's within our overlay UI
  if (overlayContainer && overlayContainer.contains(hit)) return true;
  if (floatingHost && floatingHost.contains(hit)) return true;
  if (confirmModal && confirmModal.contains(hit)) return true;
  if (visionConsentModal && visionConsentModal.contains(hit)) return true;
  if (factModal && factModal.contains(hit)) return true;
  return false;
}

function isPointOverInteractiveRect(clientX, clientY) {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
  const roots = [];
  if (overlayContainer) roots.push(overlayContainer);
  if (floatingHost) roots.push(floatingHost);
  if (confirmModal) roots.push(confirmModal);
  if (visionConsentModal) roots.push(visionConsentModal);
  if (factModal) roots.push(factModal);

  for (const root of roots) {
    const nodes = root.querySelectorAll(INTERACTIVE_SELECTOR);
    for (const node of nodes) {
      if (!node || typeof node.getBoundingClientRect !== 'function') continue;
      if (node.getClientRects().length === 0) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return true;
      }
    }
  }

  return false;
}

// Keep overlay interactive while native selects are open.
on(document, 'focusin', (event) => {
  const el = event && event.target;
  if (el && (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
    pushForceInteractive();
  }
}, true);

on(document, 'focusout', (event) => {
  const el = event && event.target;
  if (el && (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
    setTimeout(() => {
      popForceInteractive();
    }, 0);
  }
}, true);

let selectHoldActive = false;
let selectHoldTimer = null;

function releaseSelectHold() {
  if (!selectHoldActive) return;
  selectHoldActive = false;
  if (selectHoldTimer) {
    clearTimeout(selectHoldTimer);
    selectHoldTimer = null;
  }
  popForceInteractive();
}

on(document, 'pointerdown', (event) => {
  const el = event && event.target;
  if (el && el.tagName === 'SELECT') {
    if (!selectHoldActive) {
      selectHoldActive = true;
      pushForceInteractive();
    }
    if (selectHoldTimer) clearTimeout(selectHoldTimer);
    selectHoldTimer = setTimeout(() => {
      releaseSelectHold();
    }, 2000);
  }
}, true);

on(document, 'pointerup', (event) => {
  const el = event && event.target;
  if (el && el.tagName === 'SELECT') {
    releaseSelectHold();
  }
}, true);

on(document, 'pointercancel', (event) => {
  const el = event && event.target;
  if (el && el.tagName === 'SELECT') {
    releaseSelectHold();
  }
}, true);

function evaluateHoverFromPoint(clientX, clientY) {
  if (forceInteractiveCount > 0) return;
  if (Date.now() < interactionHoldUntil) {
    overlayHovered = true;
    syncClickThrough(false);
    return;
  }
  const el = document.elementFromPoint(clientX, clientY);
  overlayHovered = isInteractiveTarget(el) || isPointOverInteractiveRect(clientX, clientY);
  syncClickThrough(!overlayHovered);
}

function scheduleHoverEvaluation() {
  if (hoverEvalFrame) return;
  hoverEvalFrame = requestAnimationFrame(() => {
    hoverEvalFrame = null;
    evaluateHoverFromPoint(lastPointerClientX, lastPointerClientY);
  });
}

on(document, 'pointerover', (event) => {
  if (overlayHovered) return;
  if (isInteractiveTarget(event.target)) {
    overlayHovered = true;
    syncClickThrough(false);
  }
}, true);

on(document, 'pointerout', (event) => {
  if (forceInteractiveCount > 0) return;
  if (Date.now() < interactionHoldUntil) return;
  if (!overlayHovered) return;
  if (!isInteractiveTarget(event.target)) return;
  if (isInteractiveTarget(event.relatedTarget)) return;
  overlayHovered = false;
  syncClickThrough(true);
}, true);

on(document, 'pointermove', (event) => {
  lastPointerClientX = event.clientX;
  lastPointerClientY = event.clientY;
  scheduleHoverEvaluation();
}, true);

// Start click-through by default; we enable interactivity only when hovering real UI.
syncClickThrough(true);

function positionPopup(content, headerBtn, isReposition = false) {
  const rect = headerBtn.getBoundingClientRect();
  const minPopupWidth = 140;
  const popupWidth = Math.max(rect.width, minPopupWidth);
  content.style.minWidth = `${popupWidth}px`;
  content.style.maxWidth = `${popupWidth}px`;

  // Keep maxHeight in sync with the current overlay window size.
  // Without this, if a popup is opened while the overlay is temporarily in a small
  // header-only height, it can remain capped ("shrunk") even after the window expands.
  content.style.maxHeight = `${getPopupMaxHeightPx()}px`;

  if (!isReposition) {
    content.style.visibility = 'hidden';
    content.style.display = 'flex';
    content.style.height = 'auto';
    floatingHost.appendChild(content);
    content.classList.add('open');
  }

  requestAnimationFrame(() => {
    // If the popup was previously sized in a temporarily-small overlay height (header-only),
    // it may have an explicit pixel height set. On resize/reposition we must release it
    // so the popup can grow again, unless the user explicitly resized it.
    if (isReposition && !content.__userResizedHeight) {
      content.style.height = 'auto';
    }
    const popupRect = content.getBoundingClientRect();
    const measuredWidth = popupRect.width;
    const gutter = 12;
    const gap = 8;
    let left = rect.left;
    if (left + popupRect.width > window.innerWidth - gutter) {
      left = window.innerWidth - gutter - measuredWidth;
    }
    if (left < gutter) left = gutter;

    const desiredTop = rect.bottom + gap;
    const maxHeightCap = getPopupMaxHeightPx();
    const spaceBelow = window.innerHeight - gutter - desiredTop;
    const spaceAbove = rect.top - gutter - gap;
    const availableBelow = Math.max(0, Math.min(spaceBelow, maxHeightCap));
    const availableAbove = Math.max(0, Math.min(spaceAbove, maxHeightCap));

    let placeBelow = true;
    if (!availableBelow && availableAbove) {
      placeBelow = false;
    } else if (availableBelow && availableAbove) {
      placeBelow = availableBelow >= availableAbove;
    }

    let top = desiredTop;
    if (placeBelow) {
      const maxHeight = availableBelow || Math.min(maxHeightCap, popupRect.height);
      content.style.maxHeight = `${Math.round(maxHeight)}px`;
      const actualHeight = Math.min(popupRect.height, maxHeight);
      content.style.height = `${Math.round(actualHeight)}px`;
      top = Math.max(gutter, desiredTop);
    } else {
      const maxHeight = availableAbove || Math.min(maxHeightCap, popupRect.height);
      const actualHeight = Math.min(popupRect.height, maxHeight);
      content.style.maxHeight = `${Math.round(maxHeight)}px`;
      content.style.height = `${Math.round(actualHeight)}px`;
      top = Math.max(gutter, rect.top - gap - actualHeight);
    }

    content.style.left = `${Math.round(left)}px`;
    content.style.top = `${Math.round(top)}px`;
    content.style.visibility = 'visible';
  });
}

function closePopup(content, section, toggleEl) {
  if (!content) return;
  content.classList.remove('open');
  content.style.left = '';
  content.style.top = '';
  content.style.minWidth = '';
  content.style.visibility = '';
  content.style.height = '';
  content.style.maxHeight = `${getPopupMaxHeightPx()}px`;
  content.__userResizedHeight = false;
  content.style.display = 'none';
  content.__anchorBtn = null;
  if (toggleEl) toggleEl.classList.remove('open');
  if (section) {
    section.appendChild(content);
    section.__floatingContent = null;
  }
}

function toggleSection(event, headerBtn) {
  event.stopPropagation();
  event.preventDefault();
  if (headerBtn && headerBtn.__suppressToggleOnce) {
    headerBtn.__suppressToggleOnce = false;
    return;
  }
  const section = headerBtn.parentElement;
  if (!section) return;
  let content = section.querySelector('.section-content');
  if (!content && section.__floatingContent) {
    content = section.__floatingContent;
  }
  const toggle = headerBtn.querySelector('.section-toggle');
  if (!toggle || !content) return;
  const isOpen = content.classList.contains('open');

  if (isOpen) {
    closePopup(content, section, toggle);
    return;
  }

  // Mark home section and anchor once
  if (!content.__homeSection) content.__homeSection = section;
  section.__floatingContent = content;
  content.__anchorBtn = headerBtn;

  const shouldExpandForPopup = !__isDetachedPanelWindow
    && !section.classList.contains('panel-detached')
    && !document.body.classList.contains('header-only')
    && !document.body.classList.contains('dock-preview')
    && window.innerHeight < 240;

  if (shouldExpandForPopup) {
    try { sendOverlayResizeBatched({ height: 500, __debug: { reason: 'popup-open-expand' } }); } catch (_) {}
  }

  toggle.classList.add('open');
  positionPopup(content, headerBtn);
}

// Reposition open popups on window resize (e.g., during dragging overlay edges)
let repositionFrame = null;
function scheduleRepositionPopups() {
  if (repositionFrame) return;
  repositionFrame = requestAnimationFrame(() => {
    document.querySelectorAll('.section-content.open').forEach((openEl) => {
      const anchor = openEl.__anchorBtn;
      if (anchor && document.body.contains(anchor)) {
        positionPopup(openEl, anchor, true);
      }
    });
    repositionFrame = null;
  });
}
on(window, 'resize', scheduleRepositionPopups);

// Popup resize handling (vertical only)
let popupResizeState = null;

function startPopupResize(e) {
  // Detached panel windows should resize the BrowserWindow itself, not the popup content.
  // (The detached content is flex-stretched and content-height resizing feels jumpy.)
  if (__isDetachedPanelWindow) return;
  e.stopPropagation();
  e.preventDefault();
  // Keep overlay interactive during popup resize.
  pushForceInteractive();
  const content = e.currentTarget.parentElement;
  if (!content || !content.classList.contains('section-content')) return;
  const rect = content.getBoundingClientRect();
  content.__userResizedHeight = true;
  popupResizeState = {
    target: content,
    startY: e.clientY,
    startHeight: rect.height
  };
  content.style.maxHeight = 'none';
  on(document, 'mousemove', doPopupResize);
  on(document, 'mouseup', stopPopupResize, { once: true });
}

function doPopupResize(e) {
  if (!popupResizeState) return;
  const deltaY = e.clientY - popupResizeState.startY;
  let newHeight = popupResizeState.startHeight + deltaY;
  const minH = 200;
  const gutter = 12;
  const maxH = window.innerHeight - gutter - popupResizeState.target.getBoundingClientRect().top;
  newHeight = Math.max(minH, Math.min(maxH, newHeight));
  popupResizeState.target.style.height = `${Math.round(newHeight)}px`;
}

function stopPopupResize() {
  if (popupResizeState && popupResizeState.target) {
    const rect = popupResizeState.target.getBoundingClientRect();
    const gutter = 12;
    const available = window.innerHeight - gutter - Math.max(rect.top, gutter);
    popupResizeState.target.style.maxHeight = `${Math.max(200, Math.round(available))}px`;
  }
  popupResizeState = null;
  document.removeEventListener('mousemove', doPopupResize);
  scheduleRepositionPopups();
  popForceInteractive();
}

// Attach popup resize handles
document.querySelectorAll('.popup-resize-handle').forEach((handle) => {
  on(handle, 'mousedown', startPopupResize);
});

// Detached panel window: resize the BrowserWindow by dragging the handle.
if (__isDetachedPanelWindow) {
  let detachedResizeState = null;

  function evToScreenY(ev) {
    if (typeof ev.screenY === 'number') return Math.round(ev.screenY);
    return Math.round(window.screenY + (typeof ev.clientY === 'number' ? ev.clientY : 0));
  }

  function startDetachedWindowResize(ev) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    const handle = ev.currentTarget;
    ev.preventDefault();
    ev.stopPropagation();
    pushForceInteractive();

    detachedResizeState = {
      pointerId: ev.pointerId,
      startScreenY: evToScreenY(ev),
      startX: window.screenX,
      startY: window.screenY,
      startWidth: window.innerWidth,
      startHeight: window.innerHeight
    };

    try { handle.setPointerCapture(detachedResizeState.pointerId); } catch (_) {}
  }

  function moveDetachedWindowResize(ev) {
    if (!detachedResizeState || ev.pointerId !== detachedResizeState.pointerId) return;
    ev.preventDefault();
    const dy = evToScreenY(ev) - detachedResizeState.startScreenY;
    const nextHeight = Math.max(120, Math.round(detachedResizeState.startHeight + dy));
    ipcRenderer.send(IPC_CHANNELS.DETACHED_PANEL_SET_BOUNDS, {
      x: detachedResizeState.startX,
      y: detachedResizeState.startY,
      width: detachedResizeState.startWidth,
      height: nextHeight
    });
  }

  function endDetachedWindowResize(ev) {
    if (!detachedResizeState || ev.pointerId !== detachedResizeState.pointerId) return;
    const handle = ev.currentTarget;
    try { handle.releasePointerCapture(detachedResizeState.pointerId); } catch (_) {}
    detachedResizeState = null;
    holdInteractive(800);
    popForceInteractive();
  }

  function cancelDetachedWindowResize(ev) {
    if (!detachedResizeState || ev.pointerId !== detachedResizeState.pointerId) return;
    const handle = ev.currentTarget;
    try { handle.releasePointerCapture(detachedResizeState.pointerId); } catch (_) {}
    detachedResizeState = null;
    holdInteractive(800);
    popForceInteractive();
  }

  document.querySelectorAll('.popup-resize-handle').forEach((handle) => {
    on(handle, 'pointerdown', startDetachedWindowResize);
    on(handle, 'pointermove', moveDetachedWindowResize);
    on(handle, 'pointerup', endDetachedWindowResize);
    on(handle, 'pointercancel', cancelDetachedWindowResize);
  });

  // Add side + corner resize handles (like Note/Info windows)
  try {
    const host = document.getElementById('overlay-container');
    if (host) {
      const right = document.createElement('div');
      right.className = 'detached-resize-handle detached-resize-handle-right';
      const corner = document.createElement('div');
      corner.className = 'detached-resize-handle detached-resize-handle-corner';

      host.appendChild(right);
      host.appendChild(corner);

      // Prevent side resize handles from overlapping the draggable header.
      // This avoids cursor/hover instability around the dock button area.
      const headerEl = document.querySelector('.collapsible-section.panel-active .section-header');
      const headerH = headerEl ? Math.max(0, Math.ceil(headerEl.getBoundingClientRect().height)) : 0;
      if (headerH > 0) {
        right.style.top = `${headerH}px`;
      }

      const MIN_W = 200;
      const MIN_H = 120;

      let edgeResizeState = null;
      let pendingBounds = null;
      let boundsRaf = null;

      function requestSetBounds(bounds) {
        pendingBounds = bounds;
        if (boundsRaf) return;
        boundsRaf = requestAnimationFrame(() => {
          boundsRaf = null;
          const next = pendingBounds;
          pendingBounds = null;
          if (!next) return;
          ipcRenderer.send(IPC_CHANNELS.DETACHED_PANEL_SET_BOUNDS, next);
        });
      }

      function beginEdgeResize(ev, edge) {
        if (ev.pointerType === 'mouse' && ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        pushForceInteractive();

        const pt = getReliableScreenPoint(ev);
        edgeResizeState = {
          pointerId: ev.pointerId,
          edge,
          startScreenX: pt.x,
          startScreenY: pt.y,
          startBounds: {
            x: window.screenX,
            y: window.screenY,
            width: window.innerWidth,
            height: window.innerHeight
          }
        };
        try { ev.currentTarget.setPointerCapture(edgeResizeState.pointerId); } catch (_) {}
      }

      function moveEdgeResize(ev) {
        if (!edgeResizeState || ev.pointerId !== edgeResizeState.pointerId) return;
        ev.preventDefault();
        ev.stopPropagation();

        const pt = getReliableScreenPoint(ev);
        const dx = pt.x - edgeResizeState.startScreenX;
        const dy = pt.y - edgeResizeState.startScreenY;
        const b = edgeResizeState.startBounds;

        let nextX = b.x;
        let nextY = b.y;
        let nextW = b.width;
        let nextH = b.height;

        if (edgeResizeState.edge === 'right') {
          nextW = b.width + dx;
        } else if (edgeResizeState.edge === 'corner') {
          nextW = b.width + dx;
          nextH = b.height + dy;
        }

        nextW = Math.max(MIN_W, Math.round(nextW));
        nextH = Math.max(MIN_H, Math.round(nextH));

        requestSetBounds({ x: Math.round(nextX), y: Math.round(nextY), width: nextW, height: nextH });
      }

      function endEdgeResize(ev) {
        if (!edgeResizeState || ev.pointerId !== edgeResizeState.pointerId) return;
        ev.preventDefault();
        ev.stopPropagation();
        try { ev.currentTarget.releasePointerCapture(edgeResizeState.pointerId); } catch (_) {}
        edgeResizeState = null;
        holdInteractive(800);
        popForceInteractive();
      }

      function cancelEdgeResize(ev) {
        if (!edgeResizeState || ev.pointerId !== edgeResizeState.pointerId) return;
        try { ev.currentTarget.releasePointerCapture(edgeResizeState.pointerId); } catch (_) {}
        edgeResizeState = null;
        holdInteractive(800);
        popForceInteractive();
      }

      const edgeHandles = [
        { el: right, edge: 'right' },
        { el: corner, edge: 'corner' }
      ];
      edgeHandles.forEach(({ el, edge }) => {
        on(el, 'pointerdown', (ev) => beginEdgeResize(ev, edge));
        on(el, 'pointermove', moveEdgeResize);
        on(el, 'pointerup', endEdgeResize);
        on(el, 'pointercancel', cancelEdgeResize);
      });
    }
  } catch (_) {}
}

// Cleanup funkcio - cuando window hide-olodik
function cleanupOverlay() {
  // Speech recognition leallitasa
  if (recognition) {
    recognition.stop();
    recognition = null;
  }

  // State resetelese (csak a folyamatban levo dolgok)
  recording = false;
  micBtn.textContent = t().mic;
  status.textContent = t().statusIdle;
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // NE toroljuk:
  // - currentScreenshot - maradjon meg
  // - screenshotPreview - lathato marad
  // - responseContainer - valasz megmarad
  // - questionInput - kerdes szoveg megmarad

  // Igy amikor ujra kinyitod, latod az elozo valaszt es screenshot-ot!
}

// Full clear funkcio - MINDEN torlese (manualis)
function clearAll() {
  // Speech recognition leallitasa
  if (recognition) {
    recognition.stop();
    recognition = null;
  }

  // State resetelese
  recording = false;
  micBtn.textContent = t().mic;
  status.textContent = t().statusIdle;
  questionInput.value = '';
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // Screenshot torlese
  currentScreenshot = null;
  screenshotPreview.style.display = 'none';
  screenshotPreview.src = '';
  clearImageBtn.style.display = 'none';
  screenshotInfo.textContent = t().statusIdle;

  // Response container elrejtese
  document.getElementById('responseContainer').style.display = 'none';
  document.getElementById('aiResponse').textContent = t().statusIdle;
}

// Bezárás
const closeBtn = document.getElementById('closeBtn');
on(closeBtn, 'click', () => {
  // If a detach drag is in-flight, cancel it before hiding; otherwise the
  // panel can end up in a stuck state after close/reopen.
  try { window.__cancelAnyDetachGesture && window.__cancelAnyDetachGesture(); } catch (_) {}
  cleanupOverlay();
  fireAndForget(IPC_CHANNELS.CLOSE_OVERLAY);
});

function updateInfoButtonText() {
  if (!infoBtn) return;
  infoBtn.title = (t().infoBtnTitle || t().infoTitle || 'Info');
}

async function openInfoPanel() {
  // Open a movable, note-panel-like window instead of a modal.
  try {
    await invokeMain(IPC_CHANNELS.INFO_PANEL_OPEN, {});
  } catch (_) {}
  holdInteractive(300);
}

on(infoBtn, 'click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  openInfoPanel();
});

function speakResponse(text) {
  const enableTTS = document.getElementById('enableTTS');
  if (!enableTTS || !enableTTS.checked) return;

  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  const langTag = mapSpeechLang(currentLanguage);
  utterance.lang = langTag;
  const voice = selectedVoice || getBestVoice(langTag);
  if (voice) {
    utterance.voice = voice;
  } else {
    console.warn(`[TTS] No voice found for language: ${langTag}. Using system default.`);
  }
  utterance.rate = 1.0;
  utterance.volume = Math.min(currentSpeechRate / 100, 1.0); // Fix: volume must be 0-1
  window.speechSynthesis.speak(utterance);
}

function mapSpeechLang(lang) {
  switch (lang) {
    case 'hu': return 'hu-HU';
    case 'de': return 'de-DE';
    case 'ru': return 'ru-RU';
    case 'fr': return 'fr-FR';
    case 'zh': return 'zh-CN';
    case 'en':
    default: return 'en-US';
  }
}

function getBestVoice(langTag) {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  if (!voices.length) return null;

  // 1. Exact match first (hu-HU, en-US, de-DE, etc.)
  let match = voices.find(v => v.lang === langTag);
  if (match) return match;

  // 2. Base language match (hu, en, de, etc.)
  const base = langTag.split('-')[0];
  match = voices.find(v => v.lang && v.lang.split('-')[0] === base);
  if (match) return match;

  // 3. Fallback to English if requested language not available
  if (langTag !== 'en-US') {
    match = voices.find(v => v.lang === 'en-US' || v.lang.startsWith('en-'));
    if (match) {
      console.log(`[TTS] Fallback: Using ${match.name} (${match.lang}) instead of ${langTag}`);
      return match;
    }
  }

  // 4. Last resort: use first available voice
  return voices[0] || null;
}

function refreshVoices() {
  const langTag = mapSpeechLang(currentLanguage);
  selectedVoice = getBestVoice(langTag);
  if (!selectedVoice) {
    console.warn(`[TTS] No voice available for ${currentLanguage} (${langTag}). Install language pack in Windows.`);
  } else {
    console.log(`[TTS] Selected voice: ${selectedVoice.name} (${selectedVoice.lang})`);
  }
}

function updatePlaceholder() {
  questionInput.placeholder = t().placeholder;
}

// Content filter - tiltott kulcsszavak eszlelese
function containsForbiddenContent(text) {
  const lowerText = text.toLowerCase();

  // Tiltott kulcsszavak (minden nyelven) - CSAK NON-GAME kontextusban!
  const forbidden = [
    // Illegális dolgok (EN/HU/DE/RU/FR/ZH) - DE: gaming context OK!
    'real hack', 'real crack', 'pirate software', 'real bomb', 'real weapon', 'kill real people', 'real murder', 'real drugs',
    'valódi fegyver', 'valódi bomba', 'valódi drog', 'emberek megölése',
    'echte waffe', 'echte bombe', 'menschen töten',
    'настоящее оружие', 'настоящая бомба', 'убийство людей',
    'vraie arme', 'vraie bombe', 'tuer des gens',
    '真实武器', '真实炸弹', '杀人',

    // Szexuális tartalom (EN/HU/DE/RU/FR/ZH)
    'porn', 'sex', 'nude', 'nsfw', 'xxx', 'adult content', 'erotic',
    'szex', 'pornó', 'meztelen', 'erotikus',
    'porno', 'nackt', 'erotisch',
    'порно', 'секс', 'эротика',
    'sexe', 'nu', 'érotique',
    '色情', '性', '裸体',

    // Prompt injection (EN/HU/DE/RU/FR/ZH)
    'ignore previous', 'ignore all', 'new instructions', 'forget everything',
    'you are now', 'act as', 'pretend to be', 'roleplay as',
    'hagyd figyelmen kívül', 'új utasítás', 'felejts el mindent',
    'ignoriere vorherige', 'neue anweisungen',
    'игнорируй предыдущие', 'новые инструкции',
    'ignore précédent', 'nouvelles instructions',
    '忽略以前', '新指令'
  ];

  // Ellenorzes
  for (const word of forbidden) {
    if (lowerText.includes(word)) {
      return true;
    }
  }

  return false;
}

function updateOverlayText() {
  const titleEl = document.querySelector('h2');
  if (titleEl) {
    titleEl.textContent = t().title;
  }
  if (t().title) {
    document.title = t().title;
  }
  if (dragHandle) {
    const dragLabel = t().dragHandleLabel || '⇕ Move overlay';
    dragHandle.dataset.label = dragLabel;
    dragHandle.title = dragLabel;
  }
  updateInfoButtonText();
  const askHeaderLabel = document.getElementById('askHeaderLabel');
  if (askHeaderLabel) askHeaderLabel.textContent = t().tabAsk;
  const historyHeaderLabel = document.getElementById('historyHeaderLabel');
  if (historyHeaderLabel) historyHeaderLabel.textContent = t().tabHistory;
  const settingsHeaderLabel = document.getElementById('settingsHeaderLabel');
  if (settingsHeaderLabel) settingsHeaderLabel.textContent = t().tabSettings;
  micBtn.textContent = t().mic;
  askBtn.textContent = t().ask;
  screenshotBtn.textContent = t().screenshot;
  clearImageBtn.textContent = t().clearImage;
  clearHistoryBtn.textContent = t().clearHistory;
  // Tab buttons removed - now using collapsible sections
  const answerLabel = document.getElementById('answerLabel');
  if (answerLabel) answerLabel.textContent = t().answer;
  const askTtsLabel = document.getElementById('askTtsLabel');
  if (askTtsLabel) askTtsLabel.textContent = t().askTtsLabel;
  document.getElementById('specLabel').textContent = t().specializationLabel;
  const specDetail = document.getElementById('specDetail');
  if (specDetail) specDetail.textContent = t().specializationDetail || specDetail.textContent;
  const ttsLabel = document.getElementById('ttsLabel');
  if (ttsLabel) ttsLabel.textContent = t().ttsLabel || ttsLabel.textContent;
  const speechRateLabel = document.getElementById('speechRateLabel');
  if (speechRateLabel) speechRateLabel.textContent = t().speechRate || speechRateLabel.textContent;
  const dataLabel = document.getElementById('dataLabel');
  if (dataLabel) dataLabel.textContent = t().dataLabel || dataLabel.textContent;
  const exportHistoryBtn = document.getElementById('exportHistoryBtn');
  if (exportHistoryBtn) exportHistoryBtn.textContent = t().exportHistory || exportHistoryBtn.textContent;
  const clearAllBtn = document.getElementById('clearAllBtn');
  if (clearAllBtn) clearAllBtn.textContent = t().clearAllData || clearAllBtn.textContent;
  const visionEnableLabel = document.getElementById('visionEnableLabel');
  if (visionEnableLabel) visionEnableLabel.textContent = t().visionEnableLabel || visionEnableLabel.textContent;
  if (devToolsLabel) devToolsLabel.textContent = t().devToolsLabel || devToolsLabel.textContent;
  if (devToolsHint) devToolsHint.textContent = t().devToolsHint || devToolsHint.textContent;
  if (aiDiagnosticsLabel) aiDiagnosticsLabel.textContent = t().aiDiagnosticsLabel || aiDiagnosticsLabel.textContent;
  if (aiDiagnosticsToggleLabel) aiDiagnosticsToggleLabel.textContent = t().aiDiagnosticsToggle || aiDiagnosticsToggleLabel.textContent;
  if (aiDiagnosticsHint) aiDiagnosticsHint.textContent = t().aiDiagnosticsHint || aiDiagnosticsHint.textContent;
  if (diagPanelLabel) diagPanelLabel.textContent = t().diagPanelLabel || diagPanelLabel.textContent;
  if (diagRefreshBtn) diagRefreshBtn.textContent = t().diagRefresh || diagRefreshBtn.textContent;
  if (diagClearBtn) diagClearBtn.textContent = t().diagClear || diagClearBtn.textContent;
  if (diagHint) diagHint.textContent = t().diagHint || diagHint.textContent;
  if (diagPromptBudgetLabel) diagPromptBudgetLabel.textContent = t().diagPromptBudgetLabel || diagPromptBudgetLabel.textContent;
  if (diagTrimExportLabel) diagTrimExportLabel.textContent = t().diagTrimExportLabel || diagTrimExportLabel.textContent;
  if (diagTrimExportBtn) diagTrimExportBtn.textContent = t().diagTrimExportBtn || diagTrimExportBtn.textContent;
  if (diagTrimExportHint) diagTrimExportHint.textContent = t().diagTrimExportHint || diagTrimExportHint.textContent;
  if (diagIntentBreakdownLabel) diagIntentBreakdownLabel.textContent = t().diagIntentBreakdownLabel || diagIntentBreakdownLabel.textContent;
  if (diagFactLoadLabel) diagFactLoadLabel.textContent = t().diagFactLoadLabel || diagFactLoadLabel.textContent;
  if (diagLatencyLabel) diagLatencyLabel.textContent = t().diagLatencyLabel || diagLatencyLabel.textContent;
  if (perfHudToggleLabel) perfHudToggleLabel.textContent = t().perfHudToggle || perfHudToggleLabel.textContent;
  if (factRequestsLabel) factRequestsLabel.textContent = t().factRequestsLabel || factRequestsLabel.textContent;
  if (factRequestsGameLabel) factRequestsGameLabel.textContent = t().factRequestsGameLabel || factRequestsGameLabel.textContent;
  if (factRequestsRefreshBtn) factRequestsRefreshBtn.textContent = t().factRequestsRefresh || factRequestsRefreshBtn.textContent;
  if (factRequestsGameInput) factRequestsGameInput.placeholder = t().factRequestsGamePlaceholder || factRequestsGameInput.placeholder;
  if (hotGamesLabel) hotGamesLabel.textContent = t().hotGamesLabel || hotGamesLabel.textContent;
  if (hotGamesRefreshBtn) hotGamesRefreshBtn.textContent = t().hotGamesRefresh || hotGamesRefreshBtn.textContent;
  const visionConsentHint = document.getElementById('visionConsentHint');
  if (visionConsentHint) visionConsentHint.textContent = t().visionConsentHint || visionConsentHint.textContent;
  const visionAllowListLabel = document.getElementById('visionAllowListLabel');
  if (visionAllowListLabel) visionAllowListLabel.textContent = t().visionAllowListLabel || visionAllowListLabel.textContent;
  const visionDenyListLabel = document.getElementById('visionDenyListLabel');
  if (visionDenyListLabel) visionDenyListLabel.textContent = t().visionDenyListLabel || visionDenyListLabel.textContent;
  if (visionAllowListInput) visionAllowListInput.placeholder = t().visionAllowListPlaceholder || visionAllowListInput.placeholder;
  if (visionDenyListInput) visionDenyListInput.placeholder = t().visionDenyListPlaceholder || visionDenyListInput.placeholder;
  if (visionConsentSaveBtn) visionConsentSaveBtn.textContent = t().visionConsentSave || visionConsentSaveBtn.textContent;
  if (visionConsentResetBtn) visionConsentResetBtn.textContent = t().visionConsentReset || visionConsentResetBtn.textContent;
  if (visionConsentTitle) visionConsentTitle.textContent = t().visionConsentModalTitle || visionConsentTitle.textContent;
  if (visionConsentAllowOnce) visionConsentAllowOnce.textContent = t().visionConsentAllowOnce || visionConsentAllowOnce.textContent;
  if (visionConsentAllowAlways) visionConsentAllowAlways.textContent = t().visionConsentAllowAlways || visionConsentAllowAlways.textContent;
  if (visionConsentDenyAlways) visionConsentDenyAlways.textContent = t().visionConsentDenyAlways || visionConsentDenyAlways.textContent;
  if (visionConsentCancel) visionConsentCancel.textContent = t().visionConsentCancel || visionConsentCancel.textContent;
  const gameTemplateLabelEl = document.getElementById('gameTemplateLabel');
  if (gameTemplateLabelEl) gameTemplateLabelEl.textContent = t().gameTemplateLabel || gameTemplateLabelEl.textContent;
  const gameTemplateHintEl = document.getElementById('gameTemplateHint');
  if (gameTemplateHintEl) gameTemplateHintEl.textContent = t().gameTemplateHint || gameTemplateHintEl.textContent;
  const gameTemplateOptionsLabelEl = document.getElementById('gameTemplateOptionsLabel');
  if (gameTemplateOptionsLabelEl) gameTemplateOptionsLabelEl.textContent = t().gameTemplateOptionsLabel || gameTemplateOptionsLabelEl.textContent;
  const gameTemplateOptionsHintEl = document.getElementById('gameTemplateOptionsHint');
  if (gameTemplateOptionsHintEl) gameTemplateOptionsHintEl.textContent = t().gameTemplateOptionsHint || gameTemplateOptionsHintEl.textContent;
  const gameTemplateOptionsLimitEl = document.getElementById('gameTemplateOptionsLimit');
  if (gameTemplateOptionsLimitEl) {
    const limitTemplate = t().gameTemplateOptionsLimit || 'Max {count} options.';
    gameTemplateOptionsLimitEl.textContent = limitTemplate.replace('{count}', String(GAME_TEMPLATE_OPTIONS_LIMIT));
  }
  const gameTemplateStyleLabelEl = document.getElementById('gameTemplateStyleLabel');
  if (gameTemplateStyleLabelEl) gameTemplateStyleLabelEl.textContent = t().gameTemplateStyleLabel || gameTemplateStyleLabelEl.textContent;
  const gameTemplateStyleHintEl = document.getElementById('gameTemplateStyleHint');
  if (gameTemplateStyleHintEl) gameTemplateStyleHintEl.textContent = t().gameTemplateStyleHint || gameTemplateStyleHintEl.textContent;
  const gameTemplateCustomLabelEl = document.getElementById('gameTemplateCustomLabel');
  if (gameTemplateCustomLabelEl) gameTemplateCustomLabelEl.textContent = t().gameTemplateCustomLabel || gameTemplateCustomLabelEl.textContent;
  const gameTemplateNameInputEl = document.getElementById('gameTemplateNameInput');
  if (gameTemplateNameInputEl) gameTemplateNameInputEl.placeholder = t().gameTemplateNamePlaceholder || gameTemplateNameInputEl.placeholder;
  const gameTemplateTextEl = document.getElementById('gameTemplateText');
  if (gameTemplateTextEl) gameTemplateTextEl.placeholder = t().gameTemplateTextPlaceholder || gameTemplateTextEl.placeholder;
  const gameTemplateLoadBtnEl = document.getElementById('gameTemplateLoadBtn');
  if (gameTemplateLoadBtnEl) gameTemplateLoadBtnEl.textContent = t().gameTemplateLoad || gameTemplateLoadBtnEl.textContent;
  const gameTemplateUseCurrentBtnEl = document.getElementById('gameTemplateUseCurrentBtn');
  if (gameTemplateUseCurrentBtnEl) gameTemplateUseCurrentBtnEl.textContent = t().gameTemplateUseCurrent || gameTemplateUseCurrentBtnEl.textContent;
  const gameTemplateSaveBtnEl = document.getElementById('gameTemplateSaveBtn');
  if (gameTemplateSaveBtnEl) gameTemplateSaveBtnEl.textContent = t().gameTemplateSave || gameTemplateSaveBtnEl.textContent;
  const gameTemplateDeleteBtnEl = document.getElementById('gameTemplateDeleteBtn');
  if (gameTemplateDeleteBtnEl) gameTemplateDeleteBtnEl.textContent = t().gameTemplateDelete || gameTemplateDeleteBtnEl.textContent;
  const answerStyleLabelEl = document.getElementById('answerStyleLabel');
  if (answerStyleLabelEl) answerStyleLabelEl.textContent = t().answerStyleLabel || answerStyleLabelEl.textContent;
  const answerStyleHintEl = document.getElementById('answerStyleHint');
  if (answerStyleHintEl) answerStyleHintEl.textContent = t().answerStyleHint || answerStyleHintEl.textContent;
  if (answerStyleSelect) {
    renderAnswerStyleSelect(answerStyleSelect, readGlobalAnswerStyle(), false);
  }
  if (gameTemplateStyleSelect) {
    const currentStyle = gameTemplateStyleSelect.value || '';
    renderAnswerStyleSelect(gameTemplateStyleSelect, currentStyle, true);
  }
  renderGameTemplateOptions();
  if (addFactBtn) addFactBtn.textContent = t().addFactBtn || addFactBtn.textContent;
  if (factModalTitle) factModalTitle.textContent = t().factModalTitle || factModalTitle.textContent;
  if (factModalHint) factModalHint.textContent = t().factModalHint || factModalHint.textContent;
  if (factGameLabel) factGameLabel.textContent = t().factGameLabel || factGameLabel.textContent;
  if (factGameInput) factGameInput.placeholder = t().factGamePlaceholder || factGameInput.placeholder;
  if (factTextLabel) factTextLabel.textContent = t().factTextLabel || factTextLabel.textContent;
  if (factTextInput) factTextInput.placeholder = t().factTextPlaceholder || factTextInput.placeholder;
  if (factKeywordsLabel) factKeywordsLabel.textContent = t().factKeywordsLabel || factKeywordsLabel.textContent;
  if (factKeywordsInput) factKeywordsInput.placeholder = t().factKeywordsPlaceholder || factKeywordsInput.placeholder;
  if (factTagsLabel) factTagsLabel.textContent = t().factTagsLabel || factTagsLabel.textContent;
  if (factTagsInput) factTagsInput.placeholder = t().factTagsPlaceholder || factTagsInput.placeholder;
  if (factModalCancel) factModalCancel.textContent = t().factModalCancel || factModalCancel.textContent;
  if (factModalSave) factModalSave.textContent = t().factModalSave || factModalSave.textContent;
  const versionLabel = document.getElementById('versionLabel');
  if (versionLabel) versionLabel.textContent = t().versionLabel || versionLabel.textContent;
  const versionLine1 = document.getElementById('versionLine1');
  if (versionLine1) versionLine1.textContent = t().versionLine1 || versionLine1.textContent;
  const versionLine2 = document.getElementById('versionLine2');
  if (versionLine2) versionLine2.textContent = t().versionLine2 || versionLine2.textContent;
  const layoutLabel = document.getElementById('layoutLabel');
  if (layoutLabel) layoutLabel.textContent = t().layoutLabel || '🧩 Layout mode:';
  const notePanelLabel = document.getElementById('notePanelLabel');
  if (notePanelLabel) notePanelLabel.textContent = t().notePanelBtn || notePanelLabel.textContent;
  const compositionModeLabel = document.getElementById('compositionModeLabel');
  if (compositionModeLabel) compositionModeLabel.textContent = t().compositionModeLabel || compositionModeLabel.textContent;
  const perfHudLabel = document.getElementById('perfHudLabel');
  if (perfHudLabel) perfHudLabel.textContent = t().perfHudLabel || perfHudLabel.textContent;
  const debugMapLabel = document.getElementById('debugMapLabel');
  if (debugMapLabel) debugMapLabel.textContent = t().debugMapLabel || debugMapLabel.textContent;
  if (typeof window.__updateDebugMapText === 'function') {
    try { window.__updateDebugMapText(); } catch (_) {}
  }
  document.getElementById('resetLayoutBtn').textContent = t().resetLayout;
  const notePanelBtn = document.getElementById('notePanelBtn');
  if (notePanelBtn) notePanelBtn.textContent = t().notePanelEdit || t().notePanelBtn || '✏️ Edit';
  updateNotePanelPreview();
  try { window.__updatePerfHudLabel && window.__updatePerfHudLabel(); } catch (_) {}
  updateVisionSettingsUI();
  updateLayoutToggleText();
  updatePlaceholder();
  renderHistory(); // Re-render history with new language
  updatePinnedUI();
  syncPinnedHistoryWindows();
  if (devToolsEnabled) {
    loadFactRequests();
    loadHotGames();
  }
}

function updateNotePanelPreview() {
  const notePanelPreview = document.getElementById('notePanelPreview');
  if (!notePanelPreview) return;
  let text = '';
  try {
    const rawList = localStorage.getItem(STORAGE_KEYS.NOTES_LIST);
    const list = rawList ? JSON.parse(rawList) : [];
    const activeId = localStorage.getItem(STORAGE_KEYS.NOTES_ACTIVE_ID);
    if (Array.isArray(list) && list.length) {
      const active = list.find((note) => note && note.id === activeId) || list[0];
      text = active && typeof active.content === 'string' ? active.content : '';
    } else {
      text = localStorage.getItem(STORAGE_KEYS.NOTE_PANEL_TEXT) || '';
    }
  } catch (_) {
    text = '';
  }
  if (text && text.trim()) {
    notePanelPreview.textContent = text;
    notePanelPreview.classList.remove('is-empty');
  } else {
    notePanelPreview.textContent = t().notePanelPlaceholder || '';
    notePanelPreview.classList.add('is-empty');
  }
}

function readSpeechRateSetting() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
    if (!raw) return 100;
    const parsed = JSON.parse(raw);
    const rate = Number(parsed && parsed.speechRate);
    if (!Number.isFinite(rate)) return 100;
    return Math.max(0, Math.min(100, Math.round(rate)));
  } catch (_) {
    return 100;
  }
}

function writeSpeechRateSetting(rate) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = parsed && typeof parsed === 'object' ? parsed : {};
    next.speechRate = Math.max(0, Math.min(100, Math.round(rate)));
    localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(next));
  } catch (_) {}
}

function setSpeechRateUI(nextRate) {
  const speechRateInput = document.getElementById('speechRate');
  const speechRateValue = document.getElementById('speechRateValue');
  const normalized = Math.max(0, Math.min(100, Math.round(Number(nextRate) || 0)));
  if (speechRateInput) speechRateInput.value = String(normalized);
  if (speechRateValue) speechRateValue.textContent = String(normalized);
}

window.setSpeechRateUI = setSpeechRateUI;

const speechRateInput = document.getElementById('speechRate');
if (speechRateInput) {
  const initialRate = readSpeechRateSetting();
  currentSpeechRate = initialRate;
  setSpeechRateUI(initialRate);
  speechRateInput.addEventListener('input', () => {
    const next = Math.max(0, Math.min(100, Math.round(Number(speechRateInput.value) || 0)));
    currentSpeechRate = next;
    setSpeechRateUI(next);
    writeSpeechRateSetting(next);
    fireAndForget(IPC_CHANNELS.SET_SPEECH_RATE, next);
  });
}

async function askQuestion() {
  const text = questionInput.value.trim();
  if (!text) {
    status.textContent = t().typeQuestion;
    return;
  }

  if (!currentGameContext) {
    await requestGameContext();
  }

  // Content filter ellenorzes
  if (containsForbiddenContent(text)) {
    status.textContent = t().forbiddenContent;
    return;
  }

  if (currentScreenshot) {
    const allowed = await ensureVisionConsent();
    if (!allowed) return;
  }

  if (currentScreenshot) {
    status.textContent = t().analyzingImage;
  } else {
    status.textContent = t().thinking;
  }

  const templateGame = await ensureTemplateDraftSaved();
  const resolvedGameContext = currentGameContext || templateGame || null;
  await maybeAutoSeedTemplate(resolvedGameContext);
  const answerStyle = await resolveAnswerStyleForGame(resolvedGameContext);

  askBtn.disabled = true;
  const latencyStart = Date.now();
  const latencyHasImage = !!currentScreenshot;
  try {
    const result = await invokeMain(IPC_CHANNELS.PROCESS_TEXT, text, currentLanguage, parseInt(specializationSlider.value), currentScreenshot, resolvedGameContext, answerStyle);
    if (result.success) {
      status.textContent = t().responseReady;
      document.getElementById('aiResponse').textContent = result.response;
      document.getElementById('responseContainer').style.display = 'block';
      speakResponse(result.response);

      // Add to history
      addToHistory(text, result.response, !!currentScreenshot);
    } else {
      const friendly = getUserFacingErrorMessage(result.error);
      status.textContent = t().genericErrorPrefix + (friendly || result.error);
    }
  } catch (err) {
    const friendly = getUserFacingErrorMessage(err && err.message);
    status.textContent = t().apiErrorPrefix + (friendly || (err && err.message) || t().unknownError);
  } finally {
    askBtn.disabled = false;
    recordLatencySample(Date.now() - latencyStart, latencyHasImage);
  }
}

// Mikrofon gomb click handler
on(micBtn, 'click', async () => {
  if (recording) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      recording = false;  // Immediately mark as not recording
      micBtn.textContent = t().mic;
      status.textContent = t().processingAudio;
    }
    return;
  }

  // Request microphone permission
  try {
    status.textContent = t().speakNow;
    micBtn.textContent = t().stop;
    recording = true;

    // Capture audio from microphone
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      // Stop microphone
      stream.getTracks().forEach(track => track.stop());

      // Create audio blob
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

      status.textContent = t().processingAudio;

      try {
        // Send to Whisper API via main process
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = Array.from(new Uint8Array(arrayBuffer));

        const result = await invokeMain(IPC_CHANNELS.PROCESS_AUDIO, audioBuffer, currentLanguage, parseInt(specializationSlider.value));

        if (result.success) {
          const transcript = result.transcript;
          status.textContent = t().transcriptPreview.replace('{text}', transcript);
          micBtn.textContent = t().mic;
          recording = false;

          // Content filter ellenorzes
          if (containsForbiddenContent(transcript)) {
            status.textContent = t().forbiddenContent;
            return;
          }

          // Process the transcript as question
          if (currentScreenshot) {
            status.textContent = t().analyzingImage;
          } else {
            status.textContent = t().thinking;
          }

          if (currentScreenshot) {
            const allowed = await ensureVisionConsent();
            if (!allowed) return;
          }

          if (!currentGameContext) {
            await requestGameContext();
          }

              const templateGame = await ensureTemplateDraftSaved();
              const resolvedGameContext = currentGameContext || templateGame || null;

          const latencyStart = Date.now();
          const latencyHasImage = !!currentScreenshot;
          try {
            const answerStyle = await resolveAnswerStyleForGame(resolvedGameContext);
            const processResult = await invokeMain(IPC_CHANNELS.PROCESS_TEXT, transcript, currentLanguage, parseInt(specializationSlider.value), currentScreenshot, resolvedGameContext, answerStyle);

            if (processResult.success) {
              document.getElementById('aiResponse').textContent = processResult.response;
              document.getElementById('responseContainer').style.display = 'block';
              speakResponse(processResult.response);

              // Add to history
              addToHistory(transcript, processResult.response, !!currentScreenshot);
            } else {
              const friendly = getUserFacingErrorMessage(processResult.error);
              status.textContent = t().genericErrorPrefix + (friendly || processResult.error);
            }
          } catch (err) {
            const friendly = getUserFacingErrorMessage(err && err.message);
            status.textContent = t().apiErrorPrefix + (friendly || (err && err.message) || t().unknownError);
          } finally {
            recordLatencySample(Date.now() - latencyStart, latencyHasImage);
          }
        } else {
          const friendly = getUserFacingErrorMessage(result.error);
          status.textContent = t().transcriptionErrorPrefix + (friendly || result.error);
        }
      } catch (err) {
        const friendly = getUserFacingErrorMessage(err && err.message);
        status.textContent = t().audioProcessingErrorPrefix + (friendly || (err && err.message) || t().unknownError);
        console.error('[MIC] Error:', err);
      } finally {
        micBtn.textContent = t().mic;
        recording = false;
      }
    };

    mediaRecorder.start();

  } catch (err) {
    const friendly = getUserFacingErrorMessage(err && err.message);
    status.textContent = t().microphoneErrorPrefix + (friendly || (err && err.message) || t().unknownError);
    micBtn.textContent = t().mic;
    recording = false;
    console.error('[MIC] Permission error:', err);
  }
});

on(askBtn, 'click', askQuestion);
on(questionInput, 'keydown', (e) => {
  if (e.key === 'Enter') {
    askQuestion();
  }
});

// Screenshot button
on(screenshotBtn, 'click', async () => {
  try {
    const allowed = await ensureVisionConsent();
    if (!allowed) return;
    status.textContent = t().screenshotInProgress;
    const result = await invokeMain(IPC_CHANNELS.CAPTURE_SCREENSHOT);
    if (result.success) {
      currentScreenshot = result.imageData;
      screenshotPreview.src = result.imageData;
      screenshotPreview.style.display = 'block';
      clearImageBtn.style.display = 'block';
      screenshotInfo.textContent = t().screenshotReady;
      status.textContent = t().statusIdle;
    } else {
      const friendly = getUserFacingErrorMessage(result.error);
      status.textContent = t().screenshotError + (friendly || result.error);
    }
  } catch (err) {
    const friendly = getUserFacingErrorMessage(err && err.message);
    status.textContent = t().screenshotError + (friendly || (err && err.message) || t().unknownError);
  }
});

// Clear image button
on(clearImageBtn, 'click', () => {
  currentScreenshot = null;
  visionAllowOnceKey = null;
  screenshotPreview.style.display = 'none';
  screenshotPreview.src = '';
  clearImageBtn.style.display = 'none';
  screenshotInfo.textContent = t().statusIdle;
  status.textContent = t().statusIdle;
});

// Start with the correct language immediately on first paint.
// Main sends the persisted language via `set-language` right after load,
// but we also resolve it eagerly here so there is no brief English flash
// before the IPC arrives.
try {
  const storedLang = localStorage.getItem(STORAGE_KEYS.OVERLAY_LANGUAGE);
  if (storedLang && uiText[storedLang]) {
    currentLanguage = storedLang;
  }
} catch (_) {}
updateOverlayText();

// Eager language init counts as "language ready" for boot gating.
// Detached-state still needs to arrive from main before we unhide.
__bootLangReady = true;
__maybeFinishBoot();

// Load conversation history (renderHistory is already called from updateOverlayText)
loadHistory();

async function requestGameContext() {
  try {
    const detectedGame = await invokeMain(IPC_CHANNELS.GET_GAME_CONTEXT);
    if (detectedGame) {
      currentGameContext = detectedGame;
      console.log(`[GAME] Context resolved: ${detectedGame}`);
      applyTemplateGameFromContext(detectedGame);
    }
  } catch (err) {
    console.error('[IPC] get-game-context failed:', err);
  }
}

function applyTemplateGameFromContext(gameName) {
  if (!gameTemplateNameInput) return;
  const next = String(gameName || '').trim();
  if (!next) return;
  const currentValue = String(gameTemplateNameInput.value || '').trim();
  if (!currentValue || currentValue === lastAutoTemplateGame) {
    gameTemplateNameInput.value = next;
    lastAutoTemplateGame = next;
    saveGameTemplateDraftFromUi();
  }
}

// Request current game context on startup (with retry)
requestGameContext();

// Retry after a short delay if not set
setTimeout(() => {
  if (!currentGameContext) {
    console.log('[GAME] No game context yet, retrying...');
    requestGameContext();
  }
}, 500);

// Load pinned tabs
loadPinnedTabs();

// Load note panel persisted bounds (separate window)
loadNotePanelBounds();

// Sync pinned history windows
syncPinnedHistoryWindows();

// Settings: TTS toggle
const enableTTS = document.getElementById('enableTTS');
const savedTTS = localStorage.getItem(STORAGE_KEYS.ENABLE_TTS);
if (savedTTS !== null) {
  enableTTS.checked = savedTTS === 'true';
}
on(enableTTS, 'change', () => {
  localStorage.setItem(STORAGE_KEYS.ENABLE_TTS, enableTTS.checked);
});

gameTemplateLabel = document.getElementById('gameTemplateLabel');
gameTemplateHint = document.getElementById('gameTemplateHint');
gameTemplateNameInput = document.getElementById('gameTemplateNameInput');
gameTemplateOptionsLabel = document.getElementById('gameTemplateOptionsLabel');
gameTemplateOptionsHint = document.getElementById('gameTemplateOptionsHint');
gameTemplateOptionsList = document.getElementById('gameTemplateOptionsList');
gameTemplateOptionsLimit = document.getElementById('gameTemplateOptionsLimit');
gameTemplateStyleLabel = document.getElementById('gameTemplateStyleLabel');
gameTemplateStyleHint = document.getElementById('gameTemplateStyleHint');
gameTemplateStyleSelect = document.getElementById('gameTemplateStyleSelect');
gameTemplateCustomLabel = document.getElementById('gameTemplateCustomLabel');
gameTemplateText = document.getElementById('gameTemplateText');
gameTemplateLoadBtn = document.getElementById('gameTemplateLoadBtn');
gameTemplateUseCurrentBtn = document.getElementById('gameTemplateUseCurrentBtn');
gameTemplateSaveBtn = document.getElementById('gameTemplateSaveBtn');
gameTemplateDeleteBtn = document.getElementById('gameTemplateDeleteBtn');
gameTemplateStatus = document.getElementById('gameTemplateStatus');
answerStyleLabel = document.getElementById('answerStyleLabel');
answerStyleHint = document.getElementById('answerStyleHint');
answerStyleSelect = document.getElementById('answerStyleSelect');

function normalizeGameDetectMapping(text) {
  return String(text || '').trim();
}

function loadGameDetectMappings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GAME_DETECT_MAPPINGS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function persistGameDetectMappings(list) {
  try {
    localStorage.setItem(STORAGE_KEYS.GAME_DETECT_MAPPINGS, JSON.stringify(list));
  } catch (_) {}
}

function sendGameDetectMappingsToMain(list) {
  try { fireAndForget(IPC_CHANNELS.SET_GAME_DETECT_MAPPINGS, list); } catch (_) {}
}


function upsertGameDetectMapping(match, gameName) {
  const normalizedMatch = normalizeGameDetectMapping(match);
  const normalizedGame = normalizeGameDetectMapping(gameName);
  if (!normalizedMatch || !normalizedGame) return false;
  const list = loadGameDetectMappings();
  const key = normalizedMatch.toLowerCase();
  const idx = list.findIndex((entry) => entry && String(entry.match || '').trim().toLowerCase() === key);
  const entry = { match: normalizedMatch, gameName: normalizedGame, updatedAt: Date.now() };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  persistGameDetectMappings(list);
  sendGameDetectMappingsToMain(list);
  return true;
}

function normalizeGameTemplateName(value) {
  return String(value || '').trim();
}

function findTemplateEntry(templates, gameName) {
  const key = normalizeGameTemplateName(gameName).toLowerCase();
  if (!key) return null;
  const list = Array.isArray(templates) ? templates : [];
  for (const entry of list) {
    if (!entry) continue;
    const entryKey = normalizeGameTemplateName(entry.game).toLowerCase();
    if (entryKey && entryKey === key) return entry;
    const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
    for (const alias of aliases) {
      if (normalizeGameTemplateName(alias).toLowerCase() === key) return entry;
    }
  }
  return null;
}

async function loadGameTemplateForGame(gameName) {
  let response = null;
  try {
    response = await invokeMain(IPC_CHANNELS.GET_GAME_TEMPLATES);
  } catch (_) {
    response = null;
  }
  const entry = response && response.success ? findTemplateEntry(response.templates, gameName) : null;
  if (!gameTemplateText) return false;
  if (entry) {
    gameTemplateText.value = typeof entry.template === 'string' ? entry.template : '';
    applyTemplateOptionSelection(entry.options || []);
    if (gameTemplateStyleSelect) {
      renderAnswerStyleSelect(gameTemplateStyleSelect, entry.answerStyle || '', true);
    }
    if (gameTemplateStatus) gameTemplateStatus.textContent = t().gameTemplateLoaded || 'Template loaded';
    saveGameTemplateDraftFromUi();
    return true;
  }
  gameTemplateText.value = '';
  applyTemplateOptionSelection([]);
  if (gameTemplateStyleSelect) {
    renderAnswerStyleSelect(gameTemplateStyleSelect, '', true);
  }
  saveGameTemplateDraftFromUi();
  return false;
}

function showConfirmModalAsync(title, message, confirmText) {
  return new Promise((resolve) => {
    showConfirmModal(
      title,
      message,
      () => resolve(true),
      confirmText,
      () => resolve(false)
    );
  });
}

async function fetchTemplateEntry(gameName) {
  try {
    const response = await invokeMain(IPC_CHANNELS.GET_GAME_TEMPLATES);
    if (!response || !response.success) return null;
    return findTemplateEntry(response.templates, gameName);
  } catch (_) {
    return null;
  }
}

async function maybeAutoSeedTemplate(gameName) {
  if (!gameName) return;
  if (!devToolsEnabled) return;
  const key = normalizeGameTemplateName(gameName).toLowerCase();
  if (!key) return;
  const decisions = loadAutoSeedDecisions();
  if (decisions[key]) return;
  const existing = await fetchTemplateEntry(gameName);
  if (existing) return;
  const title = t().autoSeedTitle || 'Template defaults';
  const messageTemplate = t().autoSeedMessage || 'Create a per-game template default for "{game}"?';
  const confirmText = t().autoSeedConfirm || 'Enable defaults';
  const message = messageTemplate.replace('{game}', gameName);
  const accepted = await showConfirmModalAsync(title, message, confirmText);
  decisions[key] = { accepted: !!accepted, promptedAt: Date.now() };
  saveAutoSeedDecisions(decisions);
  if (!accepted) return;
  try {
    await invokeMain(IPC_CHANNELS.UPSERT_GAME_TEMPLATE, {
      game: gameName,
      template: '',
      options: getAutoSeedDefaultOptions(),
      answerStyle: readGlobalAnswerStyle(),
      autoSeededAt: Date.now()
    });
  } catch (_) {}
}

async function resolveAnswerStyleForGame(gameName) {
  if (!devToolsEnabled) return '';
  const fallback = readGlobalAnswerStyle();
  if (!gameName) return fallback;
  const entry = await fetchTemplateEntry(gameName);
  const style = normalizeAnswerStyle(entry && entry.answerStyle);
  return style || fallback;
}

function setGameTemplateStatus(message) {
  if (gameTemplateStatus) gameTemplateStatus.textContent = message || '';
}

function loadGameTemplateDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GAME_TEMPLATE_DRAFT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function persistGameTemplateDraft(draft) {
  try {
    localStorage.setItem(STORAGE_KEYS.GAME_TEMPLATE_DRAFT, JSON.stringify(draft || {}));
  } catch (_) {}
}

function captureGameTemplateDraft() {
  return {
    name: gameTemplateNameInput ? String(gameTemplateNameInput.value || '') : '',
    text: gameTemplateText ? String(gameTemplateText.value || '') : '',
    options: getSelectedTemplateOptionIds(),
    answerStyle: gameTemplateStyleSelect ? normalizeAnswerStyle(gameTemplateStyleSelect.value) : ''
  };
}

function applyGameTemplateDraft(draft) {
  if (!draft || typeof draft !== 'object') return;
  if (gameTemplateNameInput && typeof draft.name === 'string') {
    gameTemplateNameInput.value = draft.name;
  }
  if (gameTemplateText && typeof draft.text === 'string') {
    gameTemplateText.value = draft.text;
  }
  if (gameTemplateOptionsList && Array.isArray(draft.options)) {
    applyTemplateOptionSelection(draft.options);
  }
  if (gameTemplateStyleSelect && typeof draft.answerStyle === 'string') {
    renderAnswerStyleSelect(gameTemplateStyleSelect, draft.answerStyle, true);
  }
}

function saveGameTemplateDraftFromUi() {
  persistGameTemplateDraft(captureGameTemplateDraft());
}

function refreshGameTemplateDraftFromStorage() {
  gameTemplateDraft = loadGameTemplateDraft();
  applyGameTemplateDraft(gameTemplateDraft);
}

function getTemplateOverrideContext() {
  return normalizeGameTemplateName(gameTemplateNameInput ? gameTemplateNameInput.value : '');
}

async function ensureTemplateDraftSaved() {
  const gameName = getTemplateOverrideContext();
  if (!gameName) return '';
  const templateText = String(gameTemplateText ? gameTemplateText.value : '').trim();
  const selectedOptions = getSelectedTemplateOptionIds();
  const answerStyle = gameTemplateStyleSelect ? normalizeAnswerStyle(gameTemplateStyleSelect.value) : '';
  if (!templateText && selectedOptions.length === 0 && !answerStyle) return gameName;
  try {
    await invokeMain(IPC_CHANNELS.UPSERT_GAME_TEMPLATE, {
      game: gameName,
      template: templateText,
      options: selectedOptions,
      answerStyle
    });
  } catch (_) {}
  return gameName;
}

function getDefaultTemplateOptions() {
  return [
    { id: 'short-steps', labelKey: 'gameTemplateOptShortSteps' },
    { id: 'progression-focus', labelKey: 'gameTemplateOptProgression' },
    { id: 'build-gear', labelKey: 'gameTemplateOptBuilds' },
    { id: 'no-spoilers', labelKey: 'gameTemplateOptNoSpoilers' },
    { id: 'boss-tips', labelKey: 'gameTemplateOptBossTips' },
    { id: 'farming-priority', labelKey: 'gameTemplateOptFarming' }
  ];
}

function getTemplateOptionLabel(option) {
  if (!option) return '';
  const key = option.labelKey;
  if (key && t()[key]) return t()[key];
  return option.label || key || '';
}

function getAnswerStyleLabel(option) {
  if (!option) return '';
  const key = option.labelKey;
  if (key && t()[key]) return t()[key];
  return option.label || key || '';
}

function renderAnswerStyleSelect(selectEl, selectedValue, includeInherit) {
  if (!selectEl) return;
  const current = normalizeAnswerStyle(selectedValue);
  selectEl.innerHTML = '';
  if (includeInherit) {
    const inheritOption = document.createElement('option');
    inheritOption.value = '';
    inheritOption.textContent = t().answerStyleInherit || 'Use global default';
    selectEl.appendChild(inheritOption);
  }
  ANSWER_STYLE_OPTIONS.forEach((option) => {
    const entry = document.createElement('option');
    entry.value = option.id;
    entry.textContent = getAnswerStyleLabel(option);
    selectEl.appendChild(entry);
  });
  if (includeInherit) {
    selectEl.value = current || '';
  } else {
    selectEl.value = current || DEFAULT_ANSWER_STYLE;
  }
}

function getAutoSeedDefaultOptions() {
  return ['short-steps', 'no-spoilers'];
}

function renderGameTemplateOptions() {
  if (!gameTemplateOptionsList) return;
  const selectedBefore = getSelectedTemplateOptionIds();
  gameTemplateOptionsList.innerHTML = '';
  const list = Array.isArray(gameTemplateOptions) ? gameTemplateOptions : [];
  list.forEach((option) => {
    const label = document.createElement('label');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '8px';
    label.style.cursor = 'pointer';
    label.style.color = '#f5f7fa';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.style.width = '16px';
    input.style.height = '16px';
    input.style.cursor = 'pointer';
    input.dataset.optionId = option.id || '';
    input.addEventListener('change', () => {
      const selected = getSelectedTemplateOptionIds();
      if (selected.length > GAME_TEMPLATE_OPTIONS_LIMIT) {
        input.checked = false;
        setGameTemplateStatus((t().gameTemplateOptionLimitReached || 'Max {count} options.').replace('{count}', String(GAME_TEMPLATE_OPTIONS_LIMIT)));
      }
      saveGameTemplateDraftFromUi();
    });
    const span = document.createElement('span');
    span.textContent = getTemplateOptionLabel(option);
    label.appendChild(input);
    label.appendChild(span);
    gameTemplateOptionsList.appendChild(label);
  });
  applyTemplateOptionSelection(selectedBefore);
  if (gameTemplateDraft && Array.isArray(gameTemplateDraft.options)) {
    applyTemplateOptionSelection(gameTemplateDraft.options);
  }
}

try {
  window.__saveGameTemplateDraftFromUi = saveGameTemplateDraftFromUi;
  window.__applyGameTemplateDraftFromStorage = refreshGameTemplateDraftFromStorage;
} catch (_) {}

function getSelectedTemplateOptionIds() {
  if (!gameTemplateOptionsList) return [];
  return Array.from(gameTemplateOptionsList.querySelectorAll('input[type="checkbox"]'))
    .filter((input) => input.checked)
    .map((input) => input.dataset.optionId)
    .filter(Boolean);
}

function applyTemplateOptionSelection(optionIds) {
  if (!gameTemplateOptionsList) return;
  const selected = new Set((optionIds || []).map((id) => String(id)));
  gameTemplateOptionsList.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = selected.has(input.dataset.optionId || '');
  });
}

async function loadGameTemplateOptions() {
  let list = null;
  try {
    const res = await fetch('data/game-template-options.json', { cache: 'no-store' });
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) list = data;
    }
  } catch (_) {
    list = null;
  }
  gameTemplateOptions = Array.isArray(list) && list.length ? list : getDefaultTemplateOptions();
  renderGameTemplateOptions();
}

sendGameDetectMappingsToMain(loadGameDetectMappings());
gameTemplateDraft = loadGameTemplateDraft();
applyGameTemplateDraft(gameTemplateDraft);
loadGameTemplateOptions();

if (answerStyleSelect) {
  renderAnswerStyleSelect(answerStyleSelect, readGlobalAnswerStyle(), false);
  on(answerStyleSelect, 'change', () => {
    writeGlobalAnswerStyle(answerStyleSelect.value);
  });
}

if (gameTemplateStyleSelect) {
  renderAnswerStyleSelect(gameTemplateStyleSelect, '', true);
  on(gameTemplateStyleSelect, 'change', () => {
    saveGameTemplateDraftFromUi();
  });
}

try {
  const { isDev } = require('./src/shared/app-env');
  devToolsEnabled = !!(isDev && isDev());
} catch (_) {
  devToolsEnabled = true;
}

const devToolsBlock = document.getElementById('block-dev-tools');
if (!devToolsEnabled && devToolsBlock) {
  devToolsBlock.style.display = 'none';
}
const answerStyleBlock = document.getElementById('block-answer-style');
if (!devToolsEnabled && answerStyleBlock) {
  answerStyleBlock.style.display = 'none';
}
if (!devToolsEnabled) {
  if (gameTemplateStyleLabel) gameTemplateStyleLabel.style.display = 'none';
  if (gameTemplateStyleHint) gameTemplateStyleHint.style.display = 'none';
  if (gameTemplateStyleSelect) gameTemplateStyleSelect.style.display = 'none';
}

if (visionEnableToggle) {
  visionEnableToggle.checked = readVisionEnabled();
  on(visionEnableToggle, 'change', () => {
    writeVisionEnabled(visionEnableToggle.checked);
    if (!visionEnableToggle.checked) {
      visionAllowOnceKey = null;
    }
  });
}

if (aiDiagnosticsToggle) {
  aiDiagnosticsToggle.checked = readAiDiagnosticsEnabled();
  syncAiDiagnosticsEnabled(aiDiagnosticsToggle.checked);
  on(aiDiagnosticsToggle, 'change', () => {
    writeAiDiagnosticsEnabled(aiDiagnosticsToggle.checked);
    syncAiDiagnosticsEnabled(aiDiagnosticsToggle.checked);
    refreshDiagnosticsUI();
  });
}

try {
  ipcRenderer.on(IPC_CHANNELS.AI_DIAGNOSTICS_EVENT, (_event, payload) => {
    recordDiagnosticsEvent(payload);
    if (devToolsEnabled) refreshDiagnosticsUI();
  });
} catch (_) {}

if (diagRefreshBtn) {
  on(diagRefreshBtn, 'click', () => {
    refreshDiagnosticsUI();
  });
}

if (diagClearBtn) {
  on(diagClearBtn, 'click', () => {
    saveDiagnosticsStore({ promptTrim: [], promptTrimSim: [], modelStrategy: [], requests: [], responses: [], violations: [], latency: [] });
    if (diagTrimExportOutput) diagTrimExportOutput.value = '';
    refreshDiagnosticsUI();
  });
}

if (diagTrimExportBtn) {
  on(diagTrimExportBtn, 'click', () => {
    buildTrimExport(loadDiagnosticsStore());
  });
}

if (devToolsEnabled) {
  refreshDiagnosticsUI();
}

try {
  window.__exportDiagnosticsForShare = exportDiagnosticsForShare;
} catch (_) {}

function getFactRequestStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'accepted') return t().factRequestStatusAccepted || 'Accepted';
  if (normalized === 'rejected') return t().factRequestStatusRejected || 'Rejected';
  return t().factRequestStatusOpen || 'Open';
}

function resolveFactRequestsGame() {
  const manual = String(factRequestsGameInput ? factRequestsGameInput.value : '').trim();
  if (manual) return manual;
  return String(currentGameContext || '').trim();
}

function renderFactRequestsEmpty(message) {
  if (!factRequestsList) return;
  factRequestsList.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'dev-tools-item';
  empty.textContent = message || t().factRequestsEmpty || 'No open requests.';
  factRequestsList.appendChild(empty);
}

function renderFactRequests(requests) {
  if (!factRequestsList) return;
  const list = Array.isArray(requests) ? requests : [];
  if (!list.length) {
    renderFactRequestsEmpty();
    return;
  }
  factRequestsList.innerHTML = '';
  list.forEach((request) => {
    const item = document.createElement('div');
    item.className = 'dev-tools-item';

    const title = document.createElement('div');
    title.className = 'dev-tools-item-title';
    title.textContent = String(request && request.text || '').trim() || 'Untitled';

    const meta = document.createElement('div');
    meta.className = 'dev-tools-item-meta';
    const statusLabel = getFactRequestStatusLabel(request && request.status);
    const intent = String(request && request.intent || '').trim();
    const reason = String(request && request.reason || '').trim();
    const parts = [statusLabel];
    if (intent) parts.push(intent);
    if (reason) parts.push(reason);
    meta.textContent = parts.join(' · ');

    const noteInput = document.createElement('input');
    noteInput.className = 'dev-tools-input';
    noteInput.placeholder = t().factRequestsNotePlaceholder || 'Note (optional)';
    noteInput.value = String(request && request.note || '').trim();

    const actions = document.createElement('div');
    actions.className = 'dev-tools-actions';

    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'dev-tools-action-btn accept';
    acceptBtn.textContent = t().factRequestsApprove || 'Approve';
    on(acceptBtn, 'click', async () => {
      const game = resolveFactRequestsGame();
      if (!game) return;
      await invokeMain(IPC_CHANNELS.UPDATE_GAME_FACT_REQUEST, {
        game,
        id: request.id,
        status: 'accepted',
        note: noteInput.value
      });
      loadFactRequests();
    });

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'dev-tools-action-btn reject';
    rejectBtn.textContent = t().factRequestsReject || 'Reject';
    on(rejectBtn, 'click', async () => {
      const game = resolveFactRequestsGame();
      if (!game) return;
      await invokeMain(IPC_CHANNELS.UPDATE_GAME_FACT_REQUEST, {
        game,
        id: request.id,
        status: 'rejected',
        note: noteInput.value
      });
      loadFactRequests();
    });

    actions.appendChild(acceptBtn);
    actions.appendChild(rejectBtn);

    item.appendChild(title);
    item.appendChild(meta);
    item.appendChild(noteInput);
    item.appendChild(actions);
    factRequestsList.appendChild(item);
  });
}

async function loadFactRequests() {
  if (!devToolsEnabled || !factRequestsList) return;
  const game = resolveFactRequestsGame();
  if (!game) {
    renderFactRequestsEmpty(t().factRequestsMissingGame || 'Set a game name first.');
    return;
  }
  try {
    const response = await invokeMain(IPC_CHANNELS.GET_GAME_FACT_REQUESTS, { game, status: 'open' });
    if (!response || !response.success) {
      renderFactRequestsEmpty(t().factRequestsEmpty || 'No open requests.');
      return;
    }
    renderFactRequests(response.requests || []);
  } catch (_) {
    renderFactRequestsEmpty(t().factRequestsEmpty || 'No open requests.');
  }
}

function renderHotGamesEmpty(message) {
  if (!hotGamesList) return;
  hotGamesList.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'dev-tools-item';
  empty.textContent = message || t().hotGamesEmpty || 'No usage data.';
  hotGamesList.appendChild(empty);
}

function renderHotGames(games) {
  if (!hotGamesList) return;
  const list = Array.isArray(games) ? games : [];
  if (!list.length) {
    renderHotGamesEmpty();
    return;
  }
  hotGamesList.innerHTML = '';
  list.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'dev-tools-item';
    const title = document.createElement('div');
    title.className = 'dev-tools-item-title';
    title.textContent = String(entry && entry.game || '').trim() || 'Unknown';
    const meta = document.createElement('div');
    meta.className = 'dev-tools-item-meta';
    const scoreLabel = t().hotGamesScoreLabel || 'Score';
    meta.textContent = `${scoreLabel}: ${Number(entry && entry.score || 0)}`;
    item.appendChild(title);
    item.appendChild(meta);
    hotGamesList.appendChild(item);
  });
}

async function loadHotGames() {
  if (!devToolsEnabled || !hotGamesList) return;
  try {
    const response = await invokeMain(IPC_CHANNELS.GET_HOT_GAMES, { limit: 8 });
    if (!response || !response.success) {
      renderHotGamesEmpty(t().hotGamesEmpty || 'No usage data.');
      return;
    }
    renderHotGames(response.games || []);
  } catch (_) {
    renderHotGamesEmpty(t().hotGamesEmpty || 'No usage data.');
  }
}

if (factRequestsRefreshBtn) {
  on(factRequestsRefreshBtn, 'click', loadFactRequests);
}
if (hotGamesRefreshBtn) {
  on(hotGamesRefreshBtn, 'click', loadHotGames);
}
if (factRequestsGameInput) {
  on(factRequestsGameInput, 'change', loadFactRequests);
}

if (devToolsEnabled) {
  loadFactRequests();
  loadHotGames();
}

if (visionConsentSaveBtn) {
  on(visionConsentSaveBtn, 'click', () => {
    const allowList = parseVisionListInput(visionAllowListInput ? visionAllowListInput.value : '');
    const denyList = parseVisionListInput(visionDenyListInput ? visionDenyListInput.value : '');
    persistVisionList(STORAGE_KEYS.VISION_ALLOWLIST, allowList);
    persistVisionList(STORAGE_KEYS.VISION_DENYLIST, denyList);
    updateVisionSettingsUI();
    status.textContent = t().visionConsentSaved;
  });
}

if (visionConsentResetBtn) {
  on(visionConsentResetBtn, 'click', () => {
    persistVisionList(STORAGE_KEYS.VISION_ALLOWLIST, []);
    persistVisionList(STORAGE_KEYS.VISION_DENYLIST, []);
    updateVisionSettingsUI();
    status.textContent = t().visionConsentResetDone;
  });
}

if (gameTemplateUseCurrentBtn) {
  on(gameTemplateUseCurrentBtn, 'click', async () => {
    if (!gameTemplateNameInput) return;
    try { await invokeMain(IPC_CHANNELS.FORCE_GAME_DETECT); } catch (_) {}
    if (!currentGameContext) {
      await requestGameContext();
    }
    if (currentGameContext) {
      gameTemplateNameInput.value = currentGameContext;
      saveGameTemplateDraftFromUi();
    }
  });
}

if (gameTemplateLoadBtn) {
  on(gameTemplateLoadBtn, 'click', async () => {
    const gameName = normalizeGameTemplateName(gameTemplateNameInput ? gameTemplateNameInput.value : '');
    if (!gameName) {
      setGameTemplateStatus(t().gameTemplateMissing || 'Enter a game name and template first.');
      return;
    }
    await loadGameTemplateForGame(gameName);
  });
}

if (gameTemplateSaveBtn) {
  on(gameTemplateSaveBtn, 'click', async () => {
    const gameName = normalizeGameTemplateName(gameTemplateNameInput ? gameTemplateNameInput.value : '');
    const templateText = String(gameTemplateText ? gameTemplateText.value : '').trim();
    const selectedOptions = getSelectedTemplateOptionIds();
    const answerStyle = gameTemplateStyleSelect ? normalizeAnswerStyle(gameTemplateStyleSelect.value) : '';
    if (!gameName && !templateText && selectedOptions.length === 0 && !answerStyle) {
      saveGameTemplateDraftFromUi();
      setGameTemplateStatus('');
      return;
    }
    if (!gameName) {
      setGameTemplateStatus(t().gameTemplateMissing || 'Enter a game name and select options or write guidance.');
      return;
    }
    if (!templateText && selectedOptions.length === 0 && !answerStyle) {
      let cleared = null;
      try {
        cleared = await invokeMain(IPC_CHANNELS.DELETE_GAME_TEMPLATE, { game: gameName });
      } catch (_) {
        cleared = null;
      }
      if (cleared && cleared.success) {
        setGameTemplateStatus(t().gameTemplateDeleted || 'Template deleted');
      } else {
        setGameTemplateStatus(t().gameTemplateMissing || 'Enter a game name and select options or write guidance.');
      }
      return;
    }
    let result = null;
    try {
      result = await invokeMain(IPC_CHANNELS.UPSERT_GAME_TEMPLATE, {
        game: gameName,
        template: templateText,
        options: selectedOptions,
        answerStyle
      });
    } catch (_) {
      result = null;
    }
    if (result && result.success) {
      setGameTemplateStatus(t().gameTemplateSaved || 'Template saved');
    } else {
      setGameTemplateStatus(t().gameTemplateMissing || 'Enter a game name and select options or write guidance.');
    }
  });
}

if (gameTemplateDeleteBtn) {
  on(gameTemplateDeleteBtn, 'click', async () => {
    const gameName = normalizeGameTemplateName(gameTemplateNameInput ? gameTemplateNameInput.value : '');
    if (!gameName) {
      setGameTemplateStatus(t().gameTemplateMissing || 'Enter a game name and template first.');
      return;
    }
    let result = null;
    try {
      result = await invokeMain(IPC_CHANNELS.DELETE_GAME_TEMPLATE, { game: gameName });
    } catch (_) {
      result = null;
    }
    if (result && result.success) {
      if (gameTemplateNameInput) gameTemplateNameInput.value = '';
      if (gameTemplateText) gameTemplateText.value = '';
      applyTemplateOptionSelection([]);
      if (gameTemplateStyleSelect) renderAnswerStyleSelect(gameTemplateStyleSelect, '', true);
      setGameTemplateStatus(t().gameTemplateDeleted || 'Template deleted');
    }
  });
}

if (addFactBtn) {
  on(addFactBtn, 'click', async (event) => {
    if (event) event.stopPropagation();
    await showFactModal();
  });
}

if (factModalCancel) {
  on(factModalCancel, 'click', (event) => {
    if (event) event.stopPropagation();
    closeFactModal();
  });
}

if (factModalSave) {
  on(factModalSave, 'click', async (event) => {
    if (event) event.stopPropagation();
    await saveFactFromModal();
  });
}

if (factModal) {
  on(factModal, 'click', (event) => {
    if (event && event.target === factModal) closeFactModal();
  });
}

// Clear all data
// Custom modal functions
let pendingConfirmAction = null;
let pendingConfirmCancel = null;
let pendingConfirmAccepted = false;
const modalContent = confirmModal ? confirmModal.querySelector('.modal-content') : null;
let modalDragState = null;

function centerConfirmModal() {
  if (!modalContent) return;
  const rect = modalContent.getBoundingClientRect();
  const left = Math.max(12, Math.round((window.innerWidth - rect.width) / 2));
  const top = Math.max(12, Math.round((window.innerHeight - rect.height) / 2));
  modalContent.style.left = `${left}px`;
  modalContent.style.top = `${top}px`;
}

function beginModalDrag(ev) {
  if (!modalContent || !modalTitle) return;
  if (ev.button !== 0) return;
  const rect = modalContent.getBoundingClientRect();
  modalDragState = {
    pointerId: ev.pointerId,
    startX: ev.clientX,
    startY: ev.clientY,
    startLeft: rect.left,
    startTop: rect.top,
    width: rect.width,
    height: rect.height
  };
  try { modalTitle.setPointerCapture(ev.pointerId); } catch (_) {}
  ev.preventDefault();
}

function moveModalDrag(ev) {
  if (!modalDragState || ev.pointerId !== modalDragState.pointerId) return;
  const dx = ev.clientX - modalDragState.startX;
  const dy = ev.clientY - modalDragState.startY;
  const maxLeft = Math.max(12, window.innerWidth - modalDragState.width - 12);
  const maxTop = Math.max(12, window.innerHeight - modalDragState.height - 12);
  const nextLeft = Math.min(maxLeft, Math.max(12, modalDragState.startLeft + dx));
  const nextTop = Math.min(maxTop, Math.max(12, modalDragState.startTop + dy));
  modalContent.style.left = `${Math.round(nextLeft)}px`;
  modalContent.style.top = `${Math.round(nextTop)}px`;
}

function endModalDrag(ev) {
  if (!modalDragState || ev.pointerId !== modalDragState.pointerId) return;
  try { modalTitle && modalTitle.releasePointerCapture(ev.pointerId); } catch (_) {}
  modalDragState = null;
}

const closeConfirmModal = () => {
  if (!confirmModal.classList.contains('active')) {
    pendingConfirmAction = null;
    pendingConfirmCancel = null;
    pendingConfirmAccepted = false;
    return;
  }
  confirmModal.classList.remove('active');
  if (!pendingConfirmAccepted && typeof pendingConfirmCancel === 'function') {
    const cancelAction = pendingConfirmCancel;
    pendingConfirmAction = null;
    pendingConfirmCancel = null;
    pendingConfirmAccepted = false;
    cancelAction();
    return;
  }
  pendingConfirmAction = null;
  pendingConfirmCancel = null;
  pendingConfirmAccepted = false;
};

on(modalConfirm, 'click', () => {
  pendingConfirmAccepted = true;
  const action = pendingConfirmAction;
  closeConfirmModal();
  if (action) {
    action();
  }
});

on(modalCancel, 'click', closeConfirmModal);

on(confirmModal, 'click', (e) => {
  if (e.target === confirmModal) {
    closeConfirmModal();
  }
});

function showConfirmModal(title, message, onConfirm, confirmBtnText = null, onCancel = null) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalCancel.textContent = t().btnCancel;
  modalConfirm.textContent = confirmBtnText || t().btnDelete;
  pendingConfirmAction = onConfirm;
  pendingConfirmCancel = typeof onCancel === 'function' ? onCancel : null;
  pendingConfirmAccepted = false;
  confirmModal.classList.add('active');
  centerConfirmModal();
}

if (modalTitle) {
  on(modalTitle, 'pointerdown', beginModalDrag);
  on(modalTitle, 'pointermove', moveModalDrag);
  on(modalTitle, 'pointerup', endModalDrag);
  on(modalTitle, 'pointercancel', endModalDrag);
}

window.clearAllData = function() {
  showConfirmModal(
    t().confirmTitle,
    t().confirmClearAll,
    () => {
      localStorage.clear();
      conversationHistory = [];
      expandedHistoryKey = null;
      pinnedTabs.clear();
      pinnedHistoryBoxes = [];
      fireAndForget(IPC_CHANNELS.PINNED_HISTORY_CLOSE_ALL);
      updatePinnedUI();
      renderPinnedContent();
      renderHistory();
      status.textContent = t().allDataCleared;
    }
  );
};

// Drag handle delegates to OS via -webkit-app-region; track and persist native window position
// IMPORTANT: Only the MAIN overlay window is allowed to persist `overlayPositionX/Y`.
// Detached panel windows use the same origin/localStorage, so if they write these keys,
// the main overlay can "jump" to the detached window position after Ctrl+R/reset.

window.__markOverlayPositionTouched = function __markOverlayPositionTouched() {};

function suppressOverlayPositionPersistenceNow() {
  // No-op: position persistence handled in main process.
}

// Overlay position persistence now lives in the main process (normalized per-monitor layout).

const dragHandleFlushThreshold = 32; // px from top of monitor where the grip should compress

function monitorDragHandlePosition() {
  if (!dragHandle) return;
  const isFlushTop = window.screenY <= dragHandleFlushThreshold;
  dragHandle.classList.toggle('flush-top', isFlushTop);
  requestAnimationFrame(monitorDragHandlePosition);
}

monitorDragHandlePosition();

// Note panel (separate overlay element)
const notePanelBtn = document.getElementById('notePanelBtn');
if (notePanelBtn) {
  on(notePanelBtn, 'click', (ev) => {
    if (ev) ev.stopPropagation();
    openNotePanel().catch((err) => {
      console.error('[NOTE] Failed to open note panel:', err);
    });
  });
}

window.addEventListener('storage', (ev) => {
  if (!ev) return;
  if (ev.key !== STORAGE_KEYS.NOTE_PANEL_TEXT && ev.key !== STORAGE_KEYS.NOTES_LIST && ev.key !== STORAGE_KEYS.NOTES_ACTIVE_ID) return;
  updateNotePanelPreview();
});

if (dragHandle) {
  try {
    ipcRenderer.on(IPC_CHANNELS.OVERLAY_DRAG_READY, (_event, payload) => {
      const ready = !!(payload && payload.ready);
      dragHandle.classList.toggle('drag-ready', ready);
    });
  } catch (_) {}
}

// Reset layout function
const resetLayoutBtn = document.getElementById('resetLayoutBtn');
on(resetLayoutBtn, 'click', () => {
  showConfirmModal(
    t().confirmTitle,
    t().resetLayout,
    () => {
      // Prevent any rAF-based window position tracking from re-saving x/y
      // after we clear the stored layout keys.
      suppressOverlayPositionPersistenceNow();

      // Cancel any in-flight move/resize batching so no late x/y updates can
      // flush right as we reset/reload.
      try { cancelResize && cancelResize(); } catch (_) {}
      try { cancelWindowDrag && cancelWindowDrag(); } catch (_) {}
      try { cancelPendingOverlayResize && cancelPendingOverlayResize(); } catch (_) {}

      // Delegate the full reset to the main process to avoid race conditions.
      fireAndForget(IPC_CHANNELS.RESET_LAYOUT);
    },
    t().btnReset  // Custom button text for reset
  );
});

// Ensure voices are loaded (some engines load async)
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    refreshVoices();
  };
  window.speechSynthesis.getVoices();
}

// Dev reload hardening: intercept Ctrl+R / F5 so we can hide the overlay
// before navigation begins (prevents any single-frame header flicker).
if (!__isDetachedPanelWindow) {
  try {
    on(window, 'keydown', (e) => {
      const key = String(e && e.key || '').toLowerCase();
      const wantsReload = (key === 'r' && (e.ctrlKey || e.metaKey)) || key === 'f5';
      if (!wantsReload) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (_) {}

      // Freeze position persistence during reload. This avoids any late writes
      // from transient states right before navigation.
      suppressOverlayPositionPersistenceNow();

      // Drop any queued move/resize updates before navigation begins.
      try { cancelResize && cancelResize(); } catch (_) {}
      try { cancelWindowDrag && cancelWindowDrag(); } catch (_) {}
      try { cancelPendingOverlayResize && cancelPendingOverlayResize(); } catch (_) {}

      try {
        document.body.style.opacity = '0';
      } catch (_) {}
      try {
        const container = document.getElementById('overlay-container');
        if (container) container.style.display = 'none';
      } catch (_) {}
      try {
        const sections = document.querySelector('.sections-container');
        if (sections) sections.style.display = 'none';
      } catch (_) {}
      setTimeout(() => {
        try { location.reload(); } catch (_) {}
      }, 0);
    }, true);
  } catch (_) {}
}
