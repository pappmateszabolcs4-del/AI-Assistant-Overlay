// Block-only renderer logic.

const __blockParams = new URLSearchParams(window.location.search || '');
const __blockIdParam = (__blockParams.get('block') || '').toLowerCase();

if (typeof __isBlockWindow !== 'undefined' && __isBlockWindow && __blockIdParam) {
  const blockRoot = document.getElementById('block-root');

  const BLOCK_TEMPLATES = {
    'ask-main': `
      <div class="block-item" id="block-ask-main" data-block-id="ask-main" data-block-home="ask" data-block-title-key="tabAsk">
        <button id="micBtn">🎤 Mikrofon</button>
        <input type="text" id="questionInput" placeholder="Írj ide kérdést..." />
        <button id="askBtn">💬 Kérdés küldése</button>

        <div class="vision-controls">
          <button class="vision-btn" id="screenshotBtn">📸 Screenshot</button>
          <button class="vision-btn" id="clearImageBtn" style="display: none;">🗑️ Törlés</button>
        </div>
        <img id="screenshotPreview" alt="Screenshot preview" />
        <p class="screenshot-info" id="screenshotInfo"></p>
        <p id="status"></p>
        <div id="responseContainer" style="display: none;">
          <p id="answerLabel">🤖 AI Válasz:</p>
          <p id="aiResponse"></p>
        </div>
        <div class="fact-capture-actions" style="display: flex; gap: 8px; margin-top: 8px;">
          <button id="addFactBtn" style="flex: 1; padding: 8px; background: rgba(91, 158, 255, 0.2); border: 1px solid rgba(91, 158, 255, 0.4); border-radius: 6px; color: #f5f7fa; cursor: pointer; font-size: 0.9em;">
            ➕ Új tény
          </button>
        </div>
        <div class="vision-consent-block">
          <label class="vision-consent-toggle">
            <input type="checkbox" id="visionEnableToggle" style="width: 18px; height: 18px; cursor: pointer;">
            <span id="visionEnableLabel">Vision elemzes engedelyezese</span>
          </label>
          <p class="vision-consent-hint" id="visionConsentHint"></p>
          <div class="vision-consent-columns">
            <div class="vision-consent-col">
              <div class="vision-consent-subtitle" id="visionAllowListLabel">Mindig engedelyezett jatekok</div>
              <textarea id="visionAllowListInput" rows="4" style="width: 100%; resize: vertical; margin-top: 6px; padding: 8px; background: rgba(20, 24, 31, 0.85); border: 1px solid rgba(120, 140, 170, 0.35); border-radius: 6px; color: #f5f7fa; font-size: 0.85em;"></textarea>
            </div>
            <div class="vision-consent-col">
              <div class="vision-consent-subtitle" id="visionDenyListLabel">Soha nem engedelyezett jatekok</div>
              <textarea id="visionDenyListInput" rows="4" style="width: 100%; resize: vertical; margin-top: 6px; padding: 8px; background: rgba(20, 24, 31, 0.85); border: 1px solid rgba(120, 140, 170, 0.35); border-radius: 6px; color: #f5f7fa; font-size: 0.85em;"></textarea>
            </div>
          </div>
          <div class="vision-consent-actions">
            <button id="visionConsentSaveBtn" style="flex: 1; padding: 8px; background: rgba(91, 158, 255, 0.2); border: 1px solid rgba(91, 158, 255, 0.4); border-radius: 6px; color: #f5f7fa; cursor: pointer; font-size: 0.9em;">
              ✅ Mentés
            </button>
            <button id="visionConsentResetBtn" style="flex: 1; padding: 8px; background: rgba(255, 196, 100, 0.15); border: 1px solid rgba(255, 196, 100, 0.35); border-radius: 6px; color: #f5f7fa; cursor: pointer; font-size: 0.9em;">
              🔄 Alaplista
            </button>
          </div>
        </div>
      </div>
    `,
    'history-list': `
      <div class="block-item" id="block-history-list" data-block-id="history-list" data-block-home="history" data-block-title-key="history">
        <div class="history-search" id="historySearch">
          <input type="text" id="historySearchInput" placeholder="" />
          <label class="history-search-toggle">
            <input type="checkbox" id="historyPinnedOnlyToggle" />
            <span id="historyPinnedOnlyLabel"></span>
          </label>
        </div>
        <div class="history-search-meta" id="historySearchMeta"></div>
        <div id="historyList"></div>
      </div>
    `,
    'history-actions': `
      <div class="block-item" id="block-history-actions" data-block-id="history-actions" data-block-home="history" data-block-title-key="clearHistory">
        <div class="history-controls">
          <button class="history-clear-btn" id="clearHistoryBtn">🗑️ Előzmények törlése</button>
        </div>
      </div>
    `,
    'spec': `
      <div class="specialization-container block-item" id="block-spec" data-block-id="spec" data-block-home="settings" data-block-title-key="specializationLabel">
        <div class="specialization-label">
          <span id="specLabel">🎯 Játék Specifikusság:</span>
          <span class="specialization-value"><span id="specValue">3</span>/5</span>
        </div>
        <input type="range" id="specializationLevel" min="1" max="5" value="3">
        <p id="specDetail" style="font-size: 0.8em; color: #8ba3c0; margin-top: 8px; line-height: 1.4;">
          1 = Rövid válaszok | 3 = Részletes | 5 = Maximális részletesség
        </p>
      </div>
    `,
    'tts': `
      <div class="specialization-container block-item" id="block-tts" data-block-id="tts" data-block-home="settings" data-block-title-key="ttsLabel">
        <div class="specialization-label">
          <span id="ttsLabel">🔊 Hangos válaszok:</span>
        </div>
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: #f5f7fa;">
          <input type="checkbox" id="enableTTS" checked style="width: 18px; height: 18px; cursor: pointer;">
          <span id="askTtsLabel">AI válasz felolvasása</span>
        </label>
        <div class="tts-volume">
          <div class="tts-volume-label">
            <span id="speechRateLabel">🔊 Beszéd hangereje:</span>
            <span id="speechRateValue" class="tts-volume-value">100</span>
          </div>
          <input type="range" id="speechRate" value="100" min="0" max="100">
        </div>
      </div>
    `,
    'data': `
      <div class="specialization-container block-item" id="block-data" data-block-id="data" data-block-home="settings" data-block-title-key="dataLabel">
        <div class="specialization-label">
          <span id="dataLabel">💾 Adatok:</span>
        </div>
        <button id="exportHistoryBtn" style="width: 100%; margin-bottom: 8px; padding: 8px; background: rgba(91, 158, 255, 0.2); border: 1px solid rgba(91, 158, 255, 0.4); border-radius: 6px; color: #f5f7fa; cursor: pointer; font-size: 0.9em;">
          📥 Előzmények exportálása
        </button>
        <button id="clearAllBtn" style="width: 100%; padding: 8px; background: rgba(255, 100, 100, 0.2); border: 1px solid rgba(255, 100, 100, 0.4); border-radius: 6px; color: #ff6464; cursor: pointer; font-size: 0.9em;">
          🗑️ Minden adat törlése
        </button>
      </div>
    `,
    'ai-diagnostics': `
      <div class="specialization-container block-item" id="block-ai-diagnostics" data-block-id="ai-diagnostics" data-block-home="settings" data-block-title-key="aiDiagnosticsLabel">
        <div class="specialization-label">
          <span id="aiDiagnosticsLabel">🧪 AI diagnosztika</span>
        </div>
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: #f5f7fa;">
          <input type="checkbox" id="aiDiagnosticsToggle" style="width: 18px; height: 18px; cursor: pointer;">
          <span id="aiDiagnosticsToggleLabel">Helyi diagnosztika engedélyezése</span>
        </label>
        <p id="aiDiagnosticsHint" style="font-size: 0.8em; color: #8ba3c0; margin-top: 6px; line-height: 1.4;"></p>
      </div>
    `,
    'game-template': `
      <div class="specialization-container block-item" id="block-game-template" data-block-id="game-template" data-block-home="ask" data-block-title-key="gameTemplateLabel">
        <div class="specialization-label">
          <span id="gameTemplateLabel">🎮 Játék template</span>
        </div>
        <p id="gameTemplateHint" style="font-size: 0.8em; color: #8ba3c0; margin-top: 6px; line-height: 1.4;"></p>
        <input type="text" id="gameTemplateNameInput" style="width: 100%; margin-top: 6px; padding: 8px; background: rgba(20, 24, 31, 0.85); border: 1px solid rgba(120, 140, 170, 0.35); border-radius: 6px; color: #f5f7fa; font-size: 0.85em;" placeholder="" />
        <div class="specialization-label" style="margin-top: 8px;">
          <span id="gameTemplateOptionsLabel">✅ Választható irányok</span>
        </div>
        <p id="gameTemplateOptionsHint" style="font-size: 0.8em; color: #8ba3c0; margin-top: 4px; line-height: 1.4;"></p>
        <div id="gameTemplateOptionsList" style="display: grid; gap: 6px; margin-top: 6px;"></div>
        <p id="gameTemplateOptionsLimit" style="font-size: 0.75em; color: #6f839c; margin-top: 4px; line-height: 1.4;"></p>
        <div class="specialization-label" style="margin-top: 8px;">
          <span id="gameTemplateCustomLabel">Egyedi útmutató</span>
        </div>
        <textarea id="gameTemplateText" rows="6" style="width: 100%; resize: vertical; margin-top: 6px; padding: 8px; background: rgba(20, 24, 31, 0.85); border: 1px solid rgba(120, 140, 170, 0.35); border-radius: 6px; color: #f5f7fa; font-size: 0.85em;" placeholder=""></textarea>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button id="gameTemplateLoadBtn" style="flex: 1; padding: 8px; background: rgba(91, 158, 255, 0.2); border: 1px solid rgba(91, 158, 255, 0.4); border-radius: 6px; color: #f5f7fa; cursor: pointer; font-size: 0.9em;">
            📥 Betöltés
          </button>
          <button id="gameTemplateUseCurrentBtn" style="flex: 1; padding: 8px; background: rgba(120, 140, 170, 0.2); border: 1px solid rgba(120, 140, 170, 0.35); border-radius: 6px; color: #f5f7fa; cursor: pointer; font-size: 0.9em;">
            🎯 Aktuális játék
          </button>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button id="gameTemplateSaveBtn" style="flex: 1; padding: 8px; background: rgba(91, 158, 255, 0.2); border: 1px solid rgba(91, 158, 255, 0.4); border-radius: 6px; color: #f5f7fa; cursor: pointer; font-size: 0.9em;">
            ✅ Mentés
          </button>
          <button id="gameTemplateDeleteBtn" style="flex: 1; padding: 8px; background: rgba(255, 100, 100, 0.15); border: 1px solid rgba(255, 100, 100, 0.35); border-radius: 6px; color: #ffb0b0; cursor: pointer; font-size: 0.9em;">
            🗑️ Törlés
          </button>
        </div>
        <p id="gameTemplateStatus" style="font-size: 0.8em; color: #8ba3c0; margin-top: 6px; line-height: 1.4;"></p>
      </div>
    `,
    'layout': `
      <div class="specialization-container block-item" id="block-layout" data-block-id="layout" data-block-home="settings" data-block-title-key="layoutMode">
        <div class="specialization-label">
          <span id="layoutLabel">🧩 Layout:</span>
        </div>
        <button class="reset-layout-btn" id="toggleLayoutBtn"></button>
        <button class="reset-layout-btn" id="resetLayoutBtn">
          🔄 Alapértelmezett elrendezés visszaállítása
        </button>
      </div>
    `,
    'note': `
      <div class="specialization-container block-item" id="block-note" data-block-id="note" data-block-home="settings" data-block-title-key="notePanelBtn">
        <div class="specialization-label">
          <span id="notePanelLabel">📝 Jegyzet panel</span>
        </div>
        <div class="note-preview" id="notePanelPreview"></div>
        <button class="reset-layout-btn" id="notePanelBtn"></button>
      </div>
    `,
    'free-layout': `
      <div class="specialization-container block-item" id="block-free-layout" data-block-id="free-layout" data-block-home="settings" data-block-title-key="compositionModeLabel">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: #f5f7fa;">
          <input type="checkbox" id="freeLayoutToggle" style="width: 18px; height: 18px; cursor: pointer;">
          <span id="compositionModeLabel">Composition mode</span>
        </label>
      </div>
    `,
    'version': `
      <div class="specialization-container block-item" id="block-version" data-block-id="version" data-block-home="settings" data-block-title-key="versionLabel">
        <div class="specialization-label">
          <span id="versionLabel">ℹ️ Verzió:</span>
        </div>
        <p style="font-size: 0.85em; color: #8ba3c0;">
          AI Game Assistant v1.0.0<br>
          © 2026 - Gaming AI Helper
        </p>
      </div>
    `
  };

  if (blockRoot) {
    blockRoot.innerHTML = BLOCK_TEMPLATES[__blockIdParam] || `<div class="block-item">Missing block: ${__blockIdParam}</div>`;
  }

  try { window.__initHistoryElements && window.__initHistoryElements(); } catch (_) {}

  // History drag helpers used by history.js in block windows.
  globalThis.pushForceInteractive = function() {};
  globalThis.popForceInteractive = function() {};

  const micBtn = document.getElementById('micBtn');
  globalThis.status = document.getElementById('status');
  const status = globalThis.status;
  const questionInput = document.getElementById('questionInput');
  const askBtn = document.getElementById('askBtn');
  const screenshotBtn = document.getElementById('screenshotBtn');
  const clearImageBtn = document.getElementById('clearImageBtn');
  const screenshotPreview = document.getElementById('screenshotPreview');
  const screenshotInfo = document.getElementById('screenshotInfo');
  const addFactBtn = document.getElementById('addFactBtn');
  const factModal = document.getElementById('factModal');
  const factModalTitle = document.getElementById('factModalTitle');
  const factModalHint = document.getElementById('factModalHint');
  const factGameLabel = document.getElementById('factGameLabel');
  const factGameInput = document.getElementById('factGameInput');
  const factTextLabel = document.getElementById('factTextLabel');
  const factTextInput = document.getElementById('factTextInput');
  const factKeywordsLabel = document.getElementById('factKeywordsLabel');
  const factKeywordsInput = document.getElementById('factKeywordsInput');
  const factTagsLabel = document.getElementById('factTagsLabel');
  const factTagsInput = document.getElementById('factTagsInput');
  const factModalStatus = document.getElementById('factModalStatus');
  const factModalCancel = document.getElementById('factModalCancel');
  const factModalSave = document.getElementById('factModalSave');

  const specializationSlider = document.getElementById('specializationLevel');
  const specValue = document.getElementById('specValue');

  const enableTTS = document.getElementById('enableTTS');
  const speechRateInput = document.getElementById('speechRate');
  const speechRateValue = document.getElementById('speechRateValue');

  const gameTemplateLabel = document.getElementById('gameTemplateLabel');
  const gameTemplateHint = document.getElementById('gameTemplateHint');
  const gameTemplateNameInput = document.getElementById('gameTemplateNameInput');
  const gameTemplateOptionsLabel = document.getElementById('gameTemplateOptionsLabel');
  const gameTemplateOptionsHint = document.getElementById('gameTemplateOptionsHint');
  const gameTemplateOptionsList = document.getElementById('gameTemplateOptionsList');
  const gameTemplateOptionsLimit = document.getElementById('gameTemplateOptionsLimit');
  const gameTemplateCustomLabel = document.getElementById('gameTemplateCustomLabel');
  const gameTemplateText = document.getElementById('gameTemplateText');
  const gameTemplateLoadBtn = document.getElementById('gameTemplateLoadBtn');
  const gameTemplateUseCurrentBtn = document.getElementById('gameTemplateUseCurrentBtn');
  const gameTemplateSaveBtn = document.getElementById('gameTemplateSaveBtn');
  const gameTemplateDeleteBtn = document.getElementById('gameTemplateDeleteBtn');
  const gameTemplateStatus = document.getElementById('gameTemplateStatus');
  const GAME_TEMPLATE_OPTIONS_LIMIT = 5;
  let gameTemplateOptions = [];
  let gameTemplateDraft = null;

  const visionEnableToggle = document.getElementById('visionEnableToggle');
  const visionAllowListInput = document.getElementById('visionAllowListInput');
  const visionDenyListInput = document.getElementById('visionDenyListInput');
  const visionConsentSaveBtn = document.getElementById('visionConsentSaveBtn');
  const visionConsentResetBtn = document.getElementById('visionConsentResetBtn');

  const toggleLayoutBtn = document.getElementById('toggleLayoutBtn');
  const resetLayoutBtn = document.getElementById('resetLayoutBtn');
  const notePanelBtn = document.getElementById('notePanelBtn');
  const notePanelPreview = document.getElementById('notePanelPreview');
  const freeLayoutToggle = document.getElementById('freeLayoutToggle');

  const exportHistoryBtn = document.getElementById('exportHistoryBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const aiDiagnosticsLabel = document.getElementById('aiDiagnosticsLabel');
  const aiDiagnosticsToggle = document.getElementById('aiDiagnosticsToggle');
  const aiDiagnosticsToggleLabel = document.getElementById('aiDiagnosticsToggleLabel');
  const aiDiagnosticsHint = document.getElementById('aiDiagnosticsHint');

  const confirmModal = document.getElementById('confirmModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  const modalConfirm = document.getElementById('modalConfirm');
  const modalCancel = document.getElementById('modalCancel');

  const visionConsentModal = document.getElementById('visionConsentModal');
  const visionConsentTitle = document.getElementById('visionConsentTitle');
  const visionConsentMessage = document.getElementById('visionConsentMessage');
  const visionConsentAllowOnce = document.getElementById('visionConsentAllowOnce');
  const visionConsentAllowAlways = document.getElementById('visionConsentAllowAlways');
  const visionConsentDenyAlways = document.getElementById('visionConsentDenyAlways');
  const visionConsentCancel = document.getElementById('visionConsentCancel');

  let recording = false;
  let mediaRecorder = null;
  let currentScreenshot = null;
  let currentGameContext = null;
  let pendingConfirmAction = null;
  let lastAutoTemplateGame = '';


  function showConfirmModal(title, message, onConfirm, confirmBtnText = null) {
    if (!confirmModal) return;
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalCancel.textContent = t().btnCancel;
    modalConfirm.textContent = confirmBtnText || t().btnDelete;
    pendingConfirmAction = onConfirm;
    confirmModal.classList.add('active');
  }

  function closeConfirmModal() {
    if (!confirmModal || !confirmModal.classList.contains('active')) {
      pendingConfirmAction = null;
      return;
    }
    confirmModal.classList.remove('active');
    pendingConfirmAction = null;
  }

  if (modalConfirm) {
    on(modalConfirm, 'click', () => {
      const action = pendingConfirmAction;
      closeConfirmModal();
      if (action) action();
    });
  }

  if (modalCancel) {
    on(modalCancel, 'click', closeConfirmModal);
  }

  if (confirmModal) {
    on(confirmModal, 'click', (e) => {
      if (e.target === confirmModal) closeConfirmModal();
    });
  }

  globalThis.showConfirmModal = showConfirmModal;

  let visionAllowOnceKey = null;

  function normalizeGameKey(value) {
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

  function isGameInList(gameName, list) {
    const key = normalizeGameKey(gameName);
    if (!key) return false;
    return list.some((entry) => normalizeGameKey(entry) === key);
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

    const hasGame = !!normalizeGameKey(gameName);
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
      showUserWarning(t().visionConsentDisabled);
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

    if (isGameInList(gameName, denyList)) {
      showUserWarning((t().visionConsentDenied || '').replace('{game}', gameName || ''));
      return false;
    }

    if (isGameInList(gameName, allowList)) {
      return true;
    }

    const normalizedKey = normalizeGameKey(gameName);
    if (visionAllowOnceKey && (visionAllowOnceKey === '__any__' || visionAllowOnceKey === normalizedKey)) {
      return true;
    }

    const choice = await showVisionConsentModal(gameName);
    if (choice === 'once') {
      visionAllowOnceKey = normalizedKey || '__any__';
      return true;
    }
    if (choice === 'allow' && normalizedKey) {
      if (!isGameInList(gameName, allowList)) {
        allowList.push(gameName);
        persistVisionList(STORAGE_KEYS.VISION_ALLOWLIST, allowList);
        updateVisionSettingsUI();
      }
      return true;
    }
    if (choice === 'deny' && normalizedKey) {
      if (!isGameInList(gameName, denyList)) {
        denyList.push(gameName);
        persistVisionList(STORAGE_KEYS.VISION_DENYLIST, denyList);
        updateVisionSettingsUI();
      }
      showUserWarning((t().visionConsentDenied || '').replace('{game}', gameName || ''));
      return false;
    }

    if (t().visionConsentCanceled) showUserWarning(t().visionConsentCanceled);
    return false;
  }
  function getTemplateOverrideContext() {
    return normalizeGameTemplateName(gameTemplateNameInput ? gameTemplateNameInput.value : '');
  }
  async function ensureTemplateDraftSaved() {
    const gameName = getTemplateOverrideContext();
    if (!gameName) return '';
    const templateText = String(gameTemplateText ? gameTemplateText.value : '').trim();
    const selectedOptions = getSelectedTemplateOptionIds();
    if (!templateText && selectedOptions.length === 0) return gameName;
    try {
      await invokeMain(IPC_CHANNELS.UPSERT_GAME_TEMPLATE, {
        game: gameName,
        template: templateText,
        options: selectedOptions
      });
    } catch (_) {}
    return gameName;
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
      options: getSelectedTemplateOptionIds()
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
  }

  function saveGameTemplateDraftFromUi() {
    persistGameTemplateDraft(captureGameTemplateDraft());
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
          setGameTemplateStatus((t().gameTemplateOptionLimitReached || 'Max {count} options.')
            .replace('{count}', String(GAME_TEMPLATE_OPTIONS_LIMIT)));
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
      setGameTemplateStatus(t().gameTemplateLoaded || 'Template loaded');
      saveGameTemplateDraftFromUi();
      return true;
    }
    gameTemplateText.value = '';
    applyTemplateOptionSelection([]);
    saveGameTemplateDraftFromUi();
    return false;
  }

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

  const toastHost = document.getElementById('toastHost');
  const errorModal = document.getElementById('errorModal');
  const errorModalTitle = document.getElementById('errorModalTitle');
  const errorModalMessage = document.getElementById('errorModalMessage');
  const errorModalDetails = document.getElementById('errorModalDetails');
  const errorModalDetailsToggle = document.getElementById('errorModalDetailsToggle');
  const errorModalClose = document.getElementById('errorModalClose');
  const errorModalAction = document.getElementById('errorModalAction');
  let lastToastKey = '';
  let lastToastAt = 0;

  function resolveErrorInfo(rawError) {
    const msg = String(rawError || '').trim();
    if (!msg) {
      return { message: t().unknownError || 'Unknown error', code: 'unknown', critical: false };
    }
    const lower = msg.toLowerCase();
    const isKeyMissing = msg === 'openai-not-initialized'
      || msg === 'openai-key-missing'
      || lower.includes('invalid_api_key')
      || lower.includes('api key')
      || lower.includes('api kulcs')
      || (lower.includes('openai') && lower.includes('kulcs'))
      || lower.includes('401');

    if (isKeyMissing) {
      return { message: t().errorOpenAiKey || msg, code: 'openai-key', critical: true };
    }
    if (lower.includes('rate limit') || lower.includes('429')) {
      return { message: t().errorRateLimit || msg, code: 'rate-limit', critical: false };
    }
    if (lower.includes('insufficient_quota') || lower.includes('quota')) {
      return { message: t().errorQuota || msg, code: 'quota', critical: false };
    }
    if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('etimedout') || lower.includes('aborterror')) {
      return { message: t().errorTimeout || msg, code: 'timeout', critical: false };
    }
    if (lower.includes('network') || lower.includes('econnreset') || lower.includes('enotfound') || lower.includes('fetch') || lower.includes('eai_again')) {
      return { message: t().errorNetwork || msg, code: 'network', critical: false };
    }

    const friendly = getUserFacingErrorMessage(msg);
    if (friendly) return { message: friendly, code: 'friendly', critical: false };

    return { message: msg, code: 'raw', critical: false };
  }

  function canOpenSettingsPanel() {
    return !!document.querySelector('.collapsible-section[data-panel="settings"] .section-header');
  }

  function showToast(options) {
    if (!toastHost) return;
    const opts = options && typeof options === 'object' ? options : {};
    const title = String(opts.title || '').trim();
    const message = String(opts.message || '').trim();
    if (!message) return;

    const toastKey = `${title}::${message}`;
    const now = Date.now();
    if (toastKey === lastToastKey && now - lastToastAt < 1200) return;
    lastToastKey = toastKey;
    lastToastAt = now;

    const toast = document.createElement('div');
    toast.className = `toast toast-${opts.kind || 'warn'}`;
    if (title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'toast-title';
      titleEl.textContent = title;
      toast.appendChild(titleEl);
    }
    const messageEl = document.createElement('div');
    messageEl.className = 'toast-message';
    messageEl.textContent = message;
    toast.appendChild(messageEl);

    if (opts.actionLabel && typeof opts.onAction === 'function') {
      const actions = document.createElement('div');
      actions.className = 'toast-actions';
      const btn = document.createElement('button');
      btn.className = 'toast-btn';
      btn.type = 'button';
      btn.textContent = opts.actionLabel;
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        try { opts.onAction(); } catch (_) {}
        toast.remove();
      });
      actions.appendChild(btn);
      toast.appendChild(actions);
    }

    let timeoutId = null;
    const cleanup = () => {
      if (toast.__cleaned) return;
      toast.__cleaned = true;
      if (timeoutId) clearTimeout(timeoutId);
      toast.remove();
    };
    toast.__dismiss = cleanup;

    const scheduleTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => cleanup(), 6000);
    };

    scheduleTimeout();
    toast.addEventListener('click', cleanup);
    toast.addEventListener('mouseenter', () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
    });
    toast.addEventListener('mouseleave', scheduleTimeout);

    toastHost.appendChild(toast);
    const toasts = Array.from(toastHost.querySelectorAll('.toast'));
    if (toasts.length > 3) {
      toasts.slice(0, toasts.length - 3).forEach((el) => {
        if (el && typeof el.__dismiss === 'function') el.__dismiss();
        else el.remove();
      });
    }
  }

  function showErrorModal(payload, action) {
    if (!errorModal) return;
    let allowDetails = true;
    try {
      const { isDev } = require('./src/shared/app-env');
      allowDetails = !!(isDev && isDev());
    } catch (_) {
      allowDetails = true;
    }

    const title = payload && payload.title ? payload.title : (t().errorTitle || 'Error');
    const message = payload && payload.message ? payload.message : '';
    const details = payload && payload.details ? String(payload.details) : '';

    if (errorModalTitle) errorModalTitle.textContent = title;
    if (errorModalMessage) errorModalMessage.textContent = message;

    if (errorModalDetailsToggle) {
      errorModalDetailsToggle.style.display = allowDetails && details ? 'block' : 'none';
      errorModalDetailsToggle.textContent = t().errorDetailsShow || 'Details';
    }
    if (errorModalDetails) {
      errorModalDetails.textContent = allowDetails ? details : '';
      errorModalDetails.classList.remove('active');
    }

    if (errorModalClose) {
      errorModalClose.textContent = t().errorActionClose || t().btnClose || 'Close';
      errorModalClose.onclick = () => errorModal.classList.remove('active');
    }
    if (errorModalAction) {
      if (action && action.label) {
        errorModalAction.style.display = '';
        errorModalAction.textContent = action.label;
        errorModalAction.onclick = () => {
          try { action.onAction && action.onAction(); } catch (_) {}
          errorModal.classList.remove('active');
        };
      } else {
        errorModalAction.style.display = 'none';
        errorModalAction.onclick = null;
      }
    }

    if (errorModalDetailsToggle && errorModalDetails) {
      errorModalDetailsToggle.onclick = () => {
        const expanded = errorModalDetails.classList.toggle('active');
        errorModalDetailsToggle.textContent = expanded
          ? (t().errorDetailsHide || 'Hide details')
          : (t().errorDetailsShow || 'Details');
      };
    }

    errorModal.classList.add('active');
  }

  function showUserError(rawError, options = {}) {
    const info = resolveErrorInfo(rawError);
    const prefix = options.prefixKey && t()[options.prefixKey]
      ? t()[options.prefixKey]
      : (options.prefix || '');
    if (status) status.textContent = `${prefix}${info.message}`;

    const canSettings = canOpenSettingsPanel();
    const actionLabel = info.code === 'openai-key' && canSettings
      ? (t().errorActionOpenSettings || 'Open settings')
      : null;
    const action = info.code === 'openai-key' && canSettings
      ? () => {
        try {
          const headerBtn = document.querySelector('.collapsible-section[data-panel="settings"] .section-header');
          if (headerBtn && typeof toggleSection === 'function') {
            toggleSection(new Event('click'), headerBtn);
          }
        } catch (_) {}
      }
      : null;

    showToast({
      title: t().errorTitle || 'Error',
      message: info.message,
      kind: info.critical ? 'error' : 'warn',
      actionLabel,
      onAction: action
    });

    if (info.critical) {
      showErrorModal(
        { title: t().errorTitle || 'Error', message: info.message, details: String(rawError || '') },
        actionLabel ? { label: actionLabel, onAction: action } : null
      );
    }
  }

  function showUserWarning(message) {
    const msg = String(message || '').trim();
    if (!msg) return;
    if (status) status.textContent = msg;
    showToast({ title: t().errorTitle || 'Notice', message: msg, kind: 'warn' });
  }

  function containsForbiddenContent(text) {
    const lowerText = text.toLowerCase();
    const forbidden = [
      'real hack', 'real crack', 'pirate software', 'real bomb', 'real weapon', 'kill real people', 'real murder', 'real drugs',
      'valódi fegyver', 'valódi bomba', 'valódi drog', 'emberek megölése',
      'echte waffe', 'echte bombe', 'menschen töten',
      'настоящее оружие', 'настоящая бомба', 'убийство людей',
      'vraie arme', 'vraie bombe', 'tuer des gens',
      '真实武器', '真实炸弹', '杀人',
      'porn', 'sex', 'nude', 'nsfw', 'xxx', 'adult content', 'erotic',
      'szex', 'pornó', 'meztelen', 'erotikus',
      'porno', 'nackt', 'erotisch',
      'порно', 'секс', 'эротика',
      'sexe', 'nu', 'érotique',
      '色情', '性', '裸体',
      'ignore previous', 'ignore all', 'new instructions', 'forget everything',
      'you are now', 'act as', 'pretend to be', 'roleplay as',
      'hagyd figyelmen kívül', 'új utasítás', 'felejts el mindent',
      'ignoriere vorherige', 'neue anweisungen',
      'игнорируй предыдущие', 'новые инструкции',
      'ignore précédent', 'nouvelles instructions',
      '忽略以前', '新指令'
    ];

    for (const word of forbidden) {
      if (lowerText.includes(word)) return true;
    }
    return false;
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

    let match = voices.find(v => v.lang === langTag);
    if (match) return match;

    const base = langTag.split('-')[0];
    match = voices.find(v => v.lang && v.lang.split('-')[0] === base);
    if (match) return match;

    if (langTag !== 'en-US') {
      match = voices.find(v => v.lang === 'en-US' || v.lang.startsWith('en-'));
      if (match) return match;
    }

    return voices[0] || null;
  }

  function refreshVoices() {
    const langTag = mapSpeechLang(currentLanguage);
    selectedVoice = getBestVoice(langTag);
  }

  function speakResponse(text) {
    if (!enableTTS || !enableTTS.checked) return;
    if (!window.speechSynthesis) return;

    const utterance = new SpeechSynthesisUtterance(text);
    const langTag = mapSpeechLang(currentLanguage);
    utterance.lang = langTag;
    const voice = selectedVoice || getBestVoice(langTag);
    if (voice) utterance.voice = voice;
    utterance.rate = 1.0;
    utterance.volume = Math.min(currentSpeechRate / 100, 1.0);
    window.speechSynthesis.speak(utterance);
  }

  function updateLayoutToggleText(mode) {
    if (!toggleLayoutBtn) return;
    let label = t().layoutHorizontal || 'Horizontal';
    if (mode === 'compact') label = t().layoutCompact || 'Compact (2+1)';
    if (mode === 'stacked') label = t().layoutStacked || 'Stacked';
    toggleLayoutBtn.textContent = `${t().layoutMode || '🧩 Layout mode'}: ${label}`;
  }

  function updateBlockText() {
    if (micBtn) micBtn.textContent = t().mic;
    if (askBtn) askBtn.textContent = t().ask;
    if (screenshotBtn) screenshotBtn.textContent = t().screenshot;
    if (clearImageBtn) clearImageBtn.textContent = t().clearImage;
    const answerLabel = document.getElementById('answerLabel');
    if (answerLabel) answerLabel.textContent = t().answer;
    const askTtsLabel = document.getElementById('askTtsLabel');
    if (askTtsLabel) askTtsLabel.textContent = t().askTtsLabel;
    const specLabel = document.getElementById('specLabel');
    if (specLabel) specLabel.textContent = t().specializationLabel;
    const specDetail = document.getElementById('specDetail');
    if (specDetail) specDetail.textContent = t().specializationDetail || specDetail.textContent;
    const ttsLabel = document.getElementById('ttsLabel');
    if (ttsLabel) ttsLabel.textContent = t().ttsLabel || ttsLabel.textContent;
    const speechRateLabel = document.getElementById('speechRateLabel');
    if (speechRateLabel) speechRateLabel.textContent = t().speechRate || speechRateLabel.textContent;
    const dataLabel = document.getElementById('dataLabel');
    if (dataLabel) dataLabel.textContent = t().dataLabel || dataLabel.textContent;
    if (exportHistoryBtn) exportHistoryBtn.textContent = t().exportHistory || exportHistoryBtn.textContent;
    if (clearAllBtn) clearAllBtn.textContent = t().clearAllData || clearAllBtn.textContent;
    if (aiDiagnosticsLabel) aiDiagnosticsLabel.textContent = t().aiDiagnosticsLabel || aiDiagnosticsLabel.textContent;
    if (aiDiagnosticsToggleLabel) aiDiagnosticsToggleLabel.textContent = t().aiDiagnosticsToggle || aiDiagnosticsToggleLabel.textContent;
    if (aiDiagnosticsHint) aiDiagnosticsHint.textContent = t().aiDiagnosticsHint || aiDiagnosticsHint.textContent;
    const visionEnableLabel = document.getElementById('visionEnableLabel');
    if (visionEnableLabel) visionEnableLabel.textContent = t().visionEnableLabel || visionEnableLabel.textContent;
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
    if (gameTemplateLabel) gameTemplateLabel.textContent = t().gameTemplateLabel || gameTemplateLabel.textContent;
    if (gameTemplateHint) gameTemplateHint.textContent = t().gameTemplateHint || gameTemplateHint.textContent;
    if (gameTemplateOptionsLabel) gameTemplateOptionsLabel.textContent = t().gameTemplateOptionsLabel || gameTemplateOptionsLabel.textContent;
    if (gameTemplateOptionsHint) gameTemplateOptionsHint.textContent = t().gameTemplateOptionsHint || gameTemplateOptionsHint.textContent;
    if (gameTemplateOptionsLimit) {
      const limitTemplate = t().gameTemplateOptionsLimit || 'Max {count} options.';
      gameTemplateOptionsLimit.textContent = limitTemplate.replace('{count}', String(GAME_TEMPLATE_OPTIONS_LIMIT));
    }
    if (gameTemplateCustomLabel) gameTemplateCustomLabel.textContent = t().gameTemplateCustomLabel || gameTemplateCustomLabel.textContent;
    if (gameTemplateNameInput) gameTemplateNameInput.placeholder = t().gameTemplateNamePlaceholder || gameTemplateNameInput.placeholder;
    if (gameTemplateText) gameTemplateText.placeholder = t().gameTemplateTextPlaceholder || gameTemplateText.placeholder;
    if (gameTemplateLoadBtn) gameTemplateLoadBtn.textContent = t().gameTemplateLoad || gameTemplateLoadBtn.textContent;
    if (gameTemplateUseCurrentBtn) gameTemplateUseCurrentBtn.textContent = t().gameTemplateUseCurrent || gameTemplateUseCurrentBtn.textContent;
    if (gameTemplateSaveBtn) gameTemplateSaveBtn.textContent = t().gameTemplateSave || gameTemplateSaveBtn.textContent;
    if (gameTemplateDeleteBtn) gameTemplateDeleteBtn.textContent = t().gameTemplateDelete || gameTemplateDeleteBtn.textContent;
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
    const layoutLabel = document.getElementById('layoutLabel');
    if (layoutLabel) layoutLabel.textContent = t().layoutLabel || layoutLabel.textContent;
    const notePanelLabel = document.getElementById('notePanelLabel');
    if (notePanelLabel) notePanelLabel.textContent = t().notePanelBtn || notePanelLabel.textContent;
    const compositionModeLabel = document.getElementById('compositionModeLabel');
    if (compositionModeLabel) compositionModeLabel.textContent = t().compositionModeLabel || compositionModeLabel.textContent;
    if (notePanelBtn) notePanelBtn.textContent = t().notePanelEdit || t().notePanelBtn || '✏️ Edit';
    if (questionInput) questionInput.placeholder = t().placeholder;
    if (typeof renderHistory === 'function') renderHistory();
    updateNotePanelPreview();
    updateVisionSettingsUI();
  }

  function updateNotePanelPreview() {
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

  globalThis.updateOverlayText = updateBlockText;

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
    const normalized = Math.max(0, Math.min(100, Math.round(Number(nextRate) || 0)));
    if (speechRateInput) speechRateInput.value = String(normalized);
    if (speechRateValue) speechRateValue.textContent = String(normalized);
  }

  async function requestGameContext() {
    try {
      const detectedGame = await invokeMain(IPC_CHANNELS.GET_GAME_CONTEXT);
      if (detectedGame) currentGameContext = detectedGame;
    } catch (_) {}
  }

  async function askQuestion() {
    if (!questionInput || !status || !askBtn) return;
    const text = questionInput.value.trim();
    if (!text) {
      status.textContent = t().typeQuestion;
      return;
    }

    if (!currentGameContext) {
      await requestGameContext();
    }

    if (containsForbiddenContent(text)) {
      status.textContent = t().forbiddenContent;
      return;
    }

    if (currentScreenshot) {
      const allowed = await ensureVisionConsent();
      if (!allowed) return;
    }

    status.textContent = currentScreenshot ? t().analyzingImage : t().thinking;
    askBtn.disabled = true;
    try {
      const specLevel = specializationSlider ? parseInt(specializationSlider.value) : 3;
      const templateGame = await ensureTemplateDraftSaved();
      const resolvedGameContext = currentGameContext || templateGame || null;
      const result = await invokeMain(IPC_CHANNELS.PROCESS_TEXT, text, currentLanguage, specLevel, currentScreenshot, resolvedGameContext);
      if (result.success) {
        status.textContent = t().responseReady;
        const aiResponse = document.getElementById('aiResponse');
        const responseContainer = document.getElementById('responseContainer');
        if (aiResponse) aiResponse.textContent = result.response;
        if (responseContainer) responseContainer.style.display = 'block';
        speakResponse(result.response);
        if (typeof addToHistory === 'function') addToHistory(text, result.response, !!currentScreenshot);
      } else {
        showUserError(result.error, { prefixKey: 'genericErrorPrefix' });
      }
    } catch (err) {
      showUserError(err && err.message, { prefixKey: 'apiErrorPrefix' });
    } finally {
      askBtn.disabled = false;
    }
  }

  if (specializationSlider && specValue) {
    const savedSpecLevel = localStorage.getItem(STORAGE_KEYS.OVERLAY_SPECIALIZATION_LEVEL) || '3';
    specializationSlider.value = savedSpecLevel;
    specValue.textContent = savedSpecLevel;
    on(specializationSlider, 'input', () => {
      specValue.textContent = specializationSlider.value;
      localStorage.setItem(STORAGE_KEYS.OVERLAY_SPECIALIZATION_LEVEL, specializationSlider.value);
    });
  }

  if (enableTTS) {
    const savedTTS = localStorage.getItem(STORAGE_KEYS.ENABLE_TTS);
    if (savedTTS !== null) enableTTS.checked = savedTTS === 'true';
    on(enableTTS, 'change', () => {
      localStorage.setItem(STORAGE_KEYS.ENABLE_TTS, enableTTS.checked);
    });
  }

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



  if (gameTemplateNameInput) {
    on(gameTemplateNameInput, 'input', saveGameTemplateDraftFromUi);
  }

  if (gameTemplateText) {
    on(gameTemplateText, 'input', saveGameTemplateDraftFromUi);
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
        setGameTemplateStatus(t().gameTemplateMissing || 'Enter a game name and select options or write guidance.');
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
      if (!gameName && !templateText && selectedOptions.length === 0) {
        saveGameTemplateDraftFromUi();
        setGameTemplateStatus('');
        return;
      }
      if (!gameName) {
        setGameTemplateStatus(t().gameTemplateMissing || 'Enter a game name and select options or write guidance.');
        return;
      }
      if (!templateText && selectedOptions.length === 0) {
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
          options: selectedOptions
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
        setGameTemplateStatus(t().gameTemplateMissing || 'Enter a game name and select options or write guidance.');
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
        saveGameTemplateDraftFromUi();
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
    });
  }

  if (visionConsentSaveBtn) {
    on(visionConsentSaveBtn, 'click', () => {
      const allowList = parseVisionListInput(visionAllowListInput ? visionAllowListInput.value : '');
      const denyList = parseVisionListInput(visionDenyListInput ? visionDenyListInput.value : '');
      persistVisionList(STORAGE_KEYS.VISION_ALLOWLIST, allowList);
      persistVisionList(STORAGE_KEYS.VISION_DENYLIST, denyList);
      updateVisionSettingsUI();
      if (status && t().visionConsentSaved) status.textContent = t().visionConsentSaved;
    });
  }

  if (visionConsentResetBtn) {
    on(visionConsentResetBtn, 'click', () => {
      persistVisionList(STORAGE_KEYS.VISION_ALLOWLIST, []);
      persistVisionList(STORAGE_KEYS.VISION_DENYLIST, []);
      updateVisionSettingsUI();
      if (status && t().visionConsentResetDone) status.textContent = t().visionConsentResetDone;
    });
  }

  gameTemplateDraft = loadGameTemplateDraft();
  applyGameTemplateDraft(gameTemplateDraft);
  loadGameTemplateOptions();

  if (toggleLayoutBtn) {
    const LAYOUT_STORAGE_KEY = STORAGE_KEYS.OVERLAY_LAYOUT_MODE;
    const LAYOUT_MODES = ['horizontal', 'compact', 'stacked'];
    let currentLayoutMode = localStorage.getItem(LAYOUT_STORAGE_KEY) || 'horizontal';
    if (!LAYOUT_MODES.includes(currentLayoutMode)) currentLayoutMode = 'horizontal';
    updateLayoutToggleText(currentLayoutMode);

    on(toggleLayoutBtn, 'click', () => {
      const idx = LAYOUT_MODES.indexOf(currentLayoutMode);
      const next = LAYOUT_MODES[(idx + 1) % LAYOUT_MODES.length];
      currentLayoutMode = next;
      localStorage.setItem(LAYOUT_STORAGE_KEY, next);
      updateLayoutToggleText(next);
      try { invokeMain(IPC_CHANNELS.OVERLAY_LAYOUT_SET, { mode: next }); } catch (_) {}
    });
  }

  if (resetLayoutBtn) {
    on(resetLayoutBtn, 'click', () => {
      showConfirmModal(
        t().confirmTitle,
        t().resetLayout,
        () => {
          fireAndForget(IPC_CHANNELS.RESET_LAYOUT);
        },
        t().btnReset
      );
    });
  }

  if (notePanelBtn) {
    on(notePanelBtn, 'click', () => {
      const labels = {
        title: t().notePanelTitle || '📝 Note',
        placeholder: t().notePanelPlaceholder || 'Write a note...'
      };
      fireAndForget(IPC_CHANNELS.NOTE_PANEL_OPEN, { labels });
    });
  }

  if (notePanelPreview) {
    updateNotePanelPreview();
  }

  window.addEventListener('storage', (ev) => {
    if (!ev) return;
    if (ev.key !== STORAGE_KEYS.NOTE_PANEL_TEXT && ev.key !== STORAGE_KEYS.NOTES_LIST && ev.key !== STORAGE_KEYS.NOTES_ACTIVE_ID) return;
    updateNotePanelPreview();
  });

  if (freeLayoutToggle) {
    const raw = localStorage.getItem(STORAGE_KEYS.BLOCK_FREE_LAYOUT);
    if (raw !== null) freeLayoutToggle.checked = raw === 'true';
    on(freeLayoutToggle, 'change', () => {
      localStorage.setItem(STORAGE_KEYS.BLOCK_FREE_LAYOUT, freeLayoutToggle.checked ? 'true' : 'false');
      localStorage.setItem('overlayWidgetCompositionMode', freeLayoutToggle.checked ? 'true' : 'false');
    });
  }

  if (exportHistoryBtn) {
    on(exportHistoryBtn, 'click', () => {
      if (typeof conversationHistory === 'undefined') return;
      const dataStr = JSON.stringify(conversationHistory || [], null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `game-assistant-history-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      if (status) status.textContent = t().historyExported;
    });
  }

  if (clearAllBtn) {
    on(clearAllBtn, 'click', () => {
      showConfirmModal(
        t().confirmTitle,
        t().confirmClearAll,
        () => {
          localStorage.clear();
          if (typeof conversationHistory !== 'undefined') {
            conversationHistory = [];
          }
          if (typeof expandedHistoryKey !== 'undefined') {
            expandedHistoryKey = null;
          }
          if (typeof pinnedTabs !== 'undefined' && pinnedTabs && pinnedTabs.clear) {
            pinnedTabs.clear();
          }
          if (typeof pinnedHistoryBoxes !== 'undefined') {
            pinnedHistoryBoxes = [];
          }
          fireAndForget(IPC_CHANNELS.PINNED_HISTORY_CLOSE_ALL);
          if (typeof renderHistory === 'function') renderHistory();
          if (status) status.textContent = t().allDataCleared;
        }
      );
    });
  }

  if (micBtn) {
    on(micBtn, 'click', async () => {
      if (recording) {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
          recording = false;
          micBtn.textContent = t().mic;
          if (status) status.textContent = t().processingAudio;
        }
        return;
      }

      try {
        if (status) status.textContent = t().speakNow;
        micBtn.textContent = t().stop;
        recording = true;

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
          stream.getTracks().forEach(track => track.stop());

          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          if (status) status.textContent = t().processingAudio;

          try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = Array.from(new Uint8Array(arrayBuffer));
            const specLevel = specializationSlider ? parseInt(specializationSlider.value) : 3;
            const result = await invokeMain(IPC_CHANNELS.PROCESS_AUDIO, audioBuffer, currentLanguage, specLevel);

            if (result.success) {
              const transcript = result.transcript;
              if (status) status.textContent = t().transcriptPreview.replace('{text}', transcript);
              micBtn.textContent = t().mic;
              recording = false;

              if (containsForbiddenContent(transcript)) {
                if (status) status.textContent = t().forbiddenContent;
                return;
              }

              if (currentScreenshot && status) {
                status.textContent = t().analyzingImage;
              } else if (status) {
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

              try {
                const processResult = await invokeMain(IPC_CHANNELS.PROCESS_TEXT, transcript, currentLanguage, specLevel, currentScreenshot, resolvedGameContext);
                if (processResult.success) {
                  const aiResponse = document.getElementById('aiResponse');
                  const responseContainer = document.getElementById('responseContainer');
                  if (aiResponse) aiResponse.textContent = processResult.response;
                  if (responseContainer) responseContainer.style.display = 'block';
                  speakResponse(processResult.response);
                  if (typeof addToHistory === 'function') addToHistory(transcript, processResult.response, !!currentScreenshot);
                  } else {
                    showUserError(processResult.error, { prefixKey: 'genericErrorPrefix' });
                  }
                } catch (err) {
                  showUserError(err && err.message, { prefixKey: 'apiErrorPrefix' });
                }
              } else {
                showUserError(result.error, { prefixKey: 'transcriptionErrorPrefix' });
              }
            } catch (err) {
              showUserError(err && err.message, { prefixKey: 'audioProcessingErrorPrefix' });
          } finally {
            micBtn.textContent = t().mic;
            recording = false;
          }
        };

        mediaRecorder.start();
      } catch (err) {
        showUserError(err && err.message, { prefixKey: 'microphoneErrorPrefix' });
        micBtn.textContent = t().mic;
        recording = false;
      }
    });
  }

  if (askBtn) {
    on(askBtn, 'click', askQuestion);
  }

  if (questionInput) {
    on(questionInput, 'keydown', (e) => {
      if (e.key === 'Enter') askQuestion();
    });
  }

  if (screenshotBtn) {
    on(screenshotBtn, 'click', async () => {
      try {
        const allowed = await ensureVisionConsent();
        if (!allowed) return;
        if (status) status.textContent = t().screenshotInProgress;
        const result = await invokeMain(IPC_CHANNELS.CAPTURE_SCREENSHOT);
        if (result.success) {
          currentScreenshot = result.imageData;
          if (screenshotPreview) {
            screenshotPreview.src = result.imageData;
            screenshotPreview.style.display = 'block';
          }
          if (clearImageBtn) clearImageBtn.style.display = 'block';
          if (screenshotInfo) screenshotInfo.textContent = t().screenshotReady;
          if (status) status.textContent = t().statusIdle;
        } else {
          showUserError(result.error, { prefix: t().screenshotError || '' });
        }
      } catch (err) {
        showUserError(err && err.message, { prefix: t().screenshotError || '' });
      }
    });
  }

  if (clearImageBtn) {
    on(clearImageBtn, 'click', () => {
      currentScreenshot = null;
      visionAllowOnceKey = null;
      if (screenshotPreview) {
        screenshotPreview.style.display = 'none';
        screenshotPreview.src = '';
      }
      clearImageBtn.style.display = 'none';
      if (screenshotInfo) screenshotInfo.textContent = t().statusIdle;
      if (status) status.textContent = t().statusIdle;
    });
  }

  try {
    const storedLang = localStorage.getItem(STORAGE_KEYS.OVERLAY_LANGUAGE);
    if (storedLang) currentLanguage = storedLang;
  } catch (_) {}

  updateBlockText();
  if (typeof syncHistoryFromMain === 'function') {
    syncHistoryFromMain();
  } else if (typeof loadHistory === 'function') {
    loadHistory();
    if (typeof renderHistory === 'function') renderHistory();
  } else {
    setTimeout(() => {
      if (typeof syncHistoryFromMain === 'function') {
        syncHistoryFromMain();
      }
    }, 0);
  }
  requestGameContext();

  ipcRenderer.on(IPC_CHANNELS.SET_LANGUAGE, (_event, lang) => {
    const nextLang = lang || 'en';
    setLanguage(nextLang);
    try { localStorage.setItem(STORAGE_KEYS.OVERLAY_LANGUAGE, nextLang); } catch (_) {}
    updateBlockText();
    refreshVoices();
  });

  ipcRenderer.on(IPC_CHANNELS.SET_SPEECH_RATE, (_event, rate) => {
    currentSpeechRate = rate || 100;
    setSpeechRateUI(currentSpeechRate);
  });

  ipcRenderer.on(IPC_CHANNELS.SET_GAME_CONTEXT, (_event, gameName) => {
    currentGameContext = gameName;
    applyTemplateGameFromContext(gameName);
  });

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
      refreshVoices();
    };
    window.speechSynthesis.getVoices();
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
