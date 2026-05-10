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
      </div>
    `,
    'history-list': `
      <div class="block-item" id="block-history-list" data-block-id="history-list" data-block-home="history" data-block-title-key="history">
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
    'game-ignore': `
      <div class="specialization-container block-item" id="block-game-ignore" data-block-id="game-ignore" data-block-home="settings" data-block-title-key="gameIgnoreLabel">
        <div class="specialization-label">
          <span id="gameIgnoreLabel">🧹 Kihagyott ablakcímek:</span>
        </div>
        <p id="gameIgnoreHint" style="font-size: 0.8em; color: #8ba3c0; margin-top: 6px; line-height: 1.4;">
          Egy sor = egy minta. Ha a cím tartalmazza, nem lesz játéknak nézve.
        </p>
        <textarea id="gameIgnoreInput" rows="5" style="width: 100%; resize: vertical; margin-top: 6px; padding: 8px; background: rgba(20, 24, 31, 0.85); border: 1px solid rgba(120, 140, 170, 0.35); border-radius: 6px; color: #f5f7fa; font-size: 0.85em;" placeholder="Opera\nGoogle Chrome\nMicrosoft Edge"></textarea>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button id="gameIgnoreApplyBtn" style="flex: 1; padding: 8px; background: rgba(91, 158, 255, 0.2); border: 1px solid rgba(91, 158, 255, 0.4); border-radius: 6px; color: #f5f7fa; cursor: pointer; font-size: 0.9em;">
            ✅ Mentés
          </button>
          <button id="gameIgnoreResetBtn" style="flex: 1; padding: 8px; background: rgba(255, 196, 100, 0.15); border: 1px solid rgba(255, 196, 100, 0.35); border-radius: 6px; color: #f5f7fa; cursor: pointer; font-size: 0.9em;">
            🔄 Alaplista
          </button>
        </div>
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

  const specializationSlider = document.getElementById('specializationLevel');
  const specValue = document.getElementById('specValue');

  const enableTTS = document.getElementById('enableTTS');
  const speechRateInput = document.getElementById('speechRate');
  const speechRateValue = document.getElementById('speechRateValue');

  const gameIgnoreInput = document.getElementById('gameIgnoreInput');
  const gameIgnoreApplyBtn = document.getElementById('gameIgnoreApplyBtn');
  const gameIgnoreResetBtn = document.getElementById('gameIgnoreResetBtn');

  const toggleLayoutBtn = document.getElementById('toggleLayoutBtn');
  const resetLayoutBtn = document.getElementById('resetLayoutBtn');
  const notePanelBtn = document.getElementById('notePanelBtn');
  const notePanelPreview = document.getElementById('notePanelPreview');
  const freeLayoutToggle = document.getElementById('freeLayoutToggle');

  const exportHistoryBtn = document.getElementById('exportHistoryBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');

  const confirmModal = document.getElementById('confirmModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  const modalConfirm = document.getElementById('modalConfirm');
  const modalCancel = document.getElementById('modalCancel');

  let recording = false;
  let mediaRecorder = null;
  let currentScreenshot = null;
  let currentGameContext = null;
  let pendingConfirmAction = null;

  const DEFAULT_GAME_IGNORE_TITLES = [
    'Google Chrome',
    'Chrome',
    'Microsoft Edge',
    'Edge',
    'Opera',
    'Firefox',
    'Mozilla Firefox',
    'Brave',
    'Vivaldi',
    'Discord',
    'Visual Studio Code',
    'VS Code'
  ];

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

  function normalizeGameIgnoreInput(text) {
    return String(text || '')
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  function loadGameIgnoreList() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.GAME_DETECT_IGNORE_LIST);
      if (!raw) return [...DEFAULT_GAME_IGNORE_TITLES];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed.filter((entry) => typeof entry === 'string' && entry.trim());
    } catch (_) {}
    return [...DEFAULT_GAME_IGNORE_TITLES];
  }

  function persistGameIgnoreList(list) {
    try {
      localStorage.setItem(STORAGE_KEYS.GAME_DETECT_IGNORE_LIST, JSON.stringify(list));
    } catch (_) {}
  }

  function sendGameIgnoreListToMain(list) {
    try { invokeMain(IPC_CHANNELS.SET_GAME_DETECT_IGNORE_LIST, list); } catch (_) {}
  }

  function applyGameIgnoreList(list, options = {}) {
    const normalized = Array.isArray(list)
      ? list.map((entry) => String(entry).trim()).filter(Boolean)
      : [];

    if (gameIgnoreInput) {
      gameIgnoreInput.value = normalized.join('\n');
    }

    if (options.persist) {
      persistGameIgnoreList(normalized);
    }

    sendGameIgnoreListToMain(normalized);
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
    if (lower.includes('openai') && (lower.includes('kulcs') || lower.includes('api key') || lower.includes('api kulcs'))) {
      return t().errorOpenAiKey || msg;
    }

    return '';
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
    const gameIgnoreLabel = document.getElementById('gameIgnoreLabel');
    if (gameIgnoreLabel) gameIgnoreLabel.textContent = t().gameIgnoreLabel || gameIgnoreLabel.textContent;
    const gameIgnoreHint = document.getElementById('gameIgnoreHint');
    if (gameIgnoreHint) gameIgnoreHint.textContent = t().gameIgnoreHint || gameIgnoreHint.textContent;
    if (gameIgnoreInput) gameIgnoreInput.placeholder = t().gameIgnorePlaceholder || gameIgnoreInput.placeholder;
    if (gameIgnoreApplyBtn) gameIgnoreApplyBtn.textContent = t().gameIgnoreApply || gameIgnoreApplyBtn.textContent;
    if (gameIgnoreResetBtn) gameIgnoreResetBtn.textContent = t().gameIgnoreReset || gameIgnoreResetBtn.textContent;
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

    status.textContent = currentScreenshot ? t().analyzingImage : t().thinking;
    askBtn.disabled = true;
    try {
      const specLevel = specializationSlider ? parseInt(specializationSlider.value) : 3;
      const result = await invokeMain(IPC_CHANNELS.PROCESS_TEXT, text, currentLanguage, specLevel, currentScreenshot, currentGameContext);
      if (result.success) {
        status.textContent = t().responseReady;
        const aiResponse = document.getElementById('aiResponse');
        const responseContainer = document.getElementById('responseContainer');
        if (aiResponse) aiResponse.textContent = result.response;
        if (responseContainer) responseContainer.style.display = 'block';
        speakResponse(result.response);
        if (typeof addToHistory === 'function') addToHistory(text, result.response, !!currentScreenshot);
      } else {
        const friendly = getUserFacingErrorMessage(result.error);
        status.textContent = t().genericErrorPrefix + (friendly || result.error);
      }
    } catch (err) {
      const friendly = getUserFacingErrorMessage(err && err.message);
      status.textContent = t().apiErrorPrefix + (friendly || (err && err.message) || t().unknownError);
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

  if (gameIgnoreInput) {
    applyGameIgnoreList(loadGameIgnoreList(), { persist: true });
  }

  if (gameIgnoreApplyBtn) {
    on(gameIgnoreApplyBtn, 'click', () => {
      const list = normalizeGameIgnoreInput(gameIgnoreInput ? gameIgnoreInput.value : '');
      applyGameIgnoreList(list, { persist: true });
    });
  }

  if (gameIgnoreResetBtn) {
    on(gameIgnoreResetBtn, 'click', () => {
      applyGameIgnoreList(DEFAULT_GAME_IGNORE_TITLES, { persist: true });
    });
  }

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
          localStorage.removeItem(STORAGE_KEYS.OVERLAY_POSITION_X);
          localStorage.removeItem(STORAGE_KEYS.OVERLAY_POSITION_Y);
          localStorage.removeItem(STORAGE_KEYS.OVERLAY_LAYOUT_MODE);
          localStorage.removeItem(STORAGE_KEYS.PINNED_TABS);
          localStorage.removeItem(STORAGE_KEYS.PINNED_HISTORY);
          localStorage.removeItem(STORAGE_KEYS.NOTE_PANEL_BOUNDS);
          localStorage.removeItem(STORAGE_KEYS.BLOCK_LAYOUTS);
          localStorage.removeItem(STORAGE_KEYS.BLOCK_FREE_LAYOUT);
          localStorage.removeItem('overlayWidgetCompositionMode');

          fireAndForget(IPC_CHANNELS.PINNED_HISTORY_CLOSE_ALL);
          fireAndForget(IPC_CHANNELS.NOTE_PANEL_CLOSE);
          fireAndForget(IPC_CHANNELS.DETACHED_PANEL_CLOSE_ALL);
          fireAndForget(IPC_CHANNELS.WINDOW_ACTION, 'reset-position');
          setTimeout(() => {
            try { location.reload(); } catch (_) {}
          }, 100);
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

              if (!currentGameContext) {
                await requestGameContext();
              }

              try {
                const processResult = await invokeMain(IPC_CHANNELS.PROCESS_TEXT, transcript, currentLanguage, specLevel, currentScreenshot, currentGameContext);
                if (processResult.success) {
                  const aiResponse = document.getElementById('aiResponse');
                  const responseContainer = document.getElementById('responseContainer');
                  if (aiResponse) aiResponse.textContent = processResult.response;
                  if (responseContainer) responseContainer.style.display = 'block';
                  speakResponse(processResult.response);
                  if (typeof addToHistory === 'function') addToHistory(transcript, processResult.response, !!currentScreenshot);
                } else if (status) {
                  const friendly = getUserFacingErrorMessage(processResult.error);
                  status.textContent = t().genericErrorPrefix + (friendly || processResult.error);
                }
              } catch (err) {
                if (status) {
                  const friendly = getUserFacingErrorMessage(err && err.message);
                  status.textContent = t().apiErrorPrefix + (friendly || (err && err.message) || t().unknownError);
                }
              }
            } else if (status) {
              const friendly = getUserFacingErrorMessage(result.error);
              status.textContent = t().transcriptionErrorPrefix + (friendly || result.error);
            }
          } catch (err) {
            if (status) {
              const friendly = getUserFacingErrorMessage(err && err.message);
              status.textContent = t().audioProcessingErrorPrefix + (friendly || (err && err.message) || t().unknownError);
            }
          } finally {
            micBtn.textContent = t().mic;
            recording = false;
          }
        };

        mediaRecorder.start();
      } catch (err) {
        if (status) {
          const friendly = getUserFacingErrorMessage(err && err.message);
          status.textContent = t().microphoneErrorPrefix + (friendly || (err && err.message) || t().unknownError);
        }
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
        } else if (status) {
          const friendly = getUserFacingErrorMessage(result.error);
          status.textContent = t().screenshotError + (friendly || result.error);
        }
      } catch (err) {
        if (status) {
          const friendly = getUserFacingErrorMessage(err && err.message);
          status.textContent = t().screenshotError + (friendly || (err && err.message) || t().unknownError);
        }
      }
    });
  }

  if (clearImageBtn) {
    on(clearImageBtn, 'click', () => {
      currentScreenshot = null;
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
  });

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
      refreshVoices();
    };
    window.speechSynthesis.getVoices();
  }
}
