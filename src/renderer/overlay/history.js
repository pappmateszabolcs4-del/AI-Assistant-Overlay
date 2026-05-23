// History + pinned panels state.

var conversationHistory = []; // History array
var expandedHistoryKey = null; // Currently expanded history entry timestamp
var pinnedTabs = new Set(); // Set of pinned tab IDs
var savedHistoryIds = new Set();
var savedHistoryEntries = [];

const LEGACY_HISTORY_POPUP_PINNED = 'historyPopupPinned';
const LEGACY_HISTORY_POPUP_LAST_INDEX = 'historyPopupLastIndex';

// Pinned history boxes (drag out from history list)
// NOTE: these are rendered as separate always-on-top windows (not limited by overlay window size).
const PINNED_HISTORY_KEY = STORAGE_KEYS.PINNED_HISTORY;
const PINNED_HISTORY_MAX = 3;
var pinnedHistoryBoxes = []; // [{ ts, x, y, width, height }], screen coords

// History controls (removed - now in tab)
let historyList = document.getElementById('historyList');
let clearHistoryBtn = document.getElementById('clearHistoryBtn');
let historySearchInput = document.getElementById('historySearchInput');
let historyPinnedOnlyToggle = document.getElementById('historyPinnedOnlyToggle');
let historySearchMeta = document.getElementById('historySearchMeta');
let historySavedSection = document.getElementById('historySavedSection');
let historySavedHeaderBtn = document.getElementById('historySavedHeaderBtn');
let historySavedHeaderLabel = document.getElementById('historySavedHeaderLabel');
let historySavedCount = document.getElementById('historySavedCount');
let historySavedBody = document.getElementById('historySavedBody');
let historySavedList = document.getElementById('historySavedList');
let historyElementsReady = false;
let historySearchQuery = '';
let historyPinnedOnly = false;
let historySearchTimer = null;
let savedHistoryExpanded = false;

function normalizeSearchText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function historyEntryMatches(entry, normalizedQuery) {
  if (!normalizedQuery) return true;
  const haystack = normalizeSearchText(`${entry.question || ''} ${entry.answer || ''}`);
  return haystack.includes(normalizedQuery);
}

function updateHistorySearchLabels() {
  if (historySearchInput) {
    historySearchInput.placeholder = t().historySearchPlaceholder || '';
  }
  if (historyPinnedOnlyToggle) {
    const label = document.getElementById('historyPinnedOnlyLabel');
    if (label) label.textContent = t().historyPinnedOnlyLabel || label.textContent || '';
  }
  if (historySavedHeaderLabel) {
    historySavedHeaderLabel.textContent = t().historySavedHeader || 'Saved history';
  }
}

function setSavedHistoryExpanded(nextValue) {
  savedHistoryExpanded = !!nextValue;
  if (!historySavedSection) return;
  historySavedSection.classList.toggle('collapsed', !savedHistoryExpanded);
  if (historySavedHeaderBtn) {
    historySavedHeaderBtn.setAttribute('aria-expanded', savedHistoryExpanded ? 'true' : 'false');
  }
  if (historySavedBody) {
    historySavedBody.setAttribute('aria-hidden', savedHistoryExpanded ? 'false' : 'true');
  }
}

function updateSavedHistoryCount(countText) {
  if (!historySavedCount) return;
  historySavedCount.textContent = countText || '';
  historySavedCount.style.display = countText ? 'inline-flex' : 'none';
}

async function loadSavedHistory() {
  try {
    const res = await invokeMain(IPC_CHANNELS.HISTORY_SAVED_GET);
    if (res && res.success && Array.isArray(res.items)) {
      savedHistoryIds = new Set(res.items.map((item) => item && item.id).filter((id) => typeof id === 'number'));
      savedHistoryEntries = res.items
        .filter((item) => item && typeof item.id === 'number')
        .map((item) => ({
          timestamp: item.id,
          question: item.question || '',
          answer: item.answer || '',
          hasImage: !!item.hasImage
        }));
      renderHistory();
    }
  } catch (_) {}
}

function isHistorySaved(ts) {
  return savedHistoryIds.has(ts);
}

async function saveHistoryEntry(entry) {
  if (!entry) return false;
  try {
    const payload = {
      timestamp: entry.timestamp,
      question: entry.question,
      answer: entry.answer,
      hasImage: !!entry.hasImage,
      language: currentLanguage,
      gameContext: typeof currentGameContext === 'string' ? currentGameContext : ''
    };
    const res = await invokeMain(IPC_CHANNELS.HISTORY_SAVED_ADD, payload);
    if (res && res.success) {
      savedHistoryIds.add(entry.timestamp);
      if (!savedHistoryEntries.some((item) => item && item.timestamp === entry.timestamp)) {
        savedHistoryEntries.unshift({
          timestamp: entry.timestamp,
          question: entry.question || '',
          answer: entry.answer || '',
          hasImage: !!entry.hasImage
        });
      }
      if (typeof status !== 'undefined' && status) {
        status.textContent = t().historySaved || 'Saved.';
      }
      renderHistory();
      return true;
    }
  } catch (_) {}
  return false;
}

async function removeSavedHistoryEntry(entry) {
  if (!entry) return false;
  try {
    const res = await invokeMain(IPC_CHANNELS.HISTORY_SAVED_REMOVE, { id: entry.timestamp });
    if (res && res.success) {
      savedHistoryIds.delete(entry.timestamp);
      savedHistoryEntries = savedHistoryEntries.filter((item) => item && item.timestamp !== entry.timestamp);
      if (typeof status !== 'undefined' && status) {
        status.textContent = t().historyUnsaved || 'Removed.';
      }
      renderHistory();
      return true;
    }
  } catch (_) {}
  return false;
}

function updateHistorySearchMeta(count) {
  if (!historySearchMeta) return;
  const template = t().historySearchResults || 'Results: {count}';
  historySearchMeta.textContent = template.replace('{count}', String(count));
}

function initHistoryElements() {
  historyList = document.getElementById('historyList');
  clearHistoryBtn = document.getElementById('clearHistoryBtn');
  historySearchInput = document.getElementById('historySearchInput');
  historyPinnedOnlyToggle = document.getElementById('historyPinnedOnlyToggle');
  historySearchMeta = document.getElementById('historySearchMeta');
  historySavedSection = document.getElementById('historySavedSection');
  historySavedHeaderBtn = document.getElementById('historySavedHeaderBtn');
  historySavedHeaderLabel = document.getElementById('historySavedHeaderLabel');
  historySavedCount = document.getElementById('historySavedCount');
  historySavedBody = document.getElementById('historySavedBody');
  historySavedList = document.getElementById('historySavedList');
  if (clearHistoryBtn && !clearHistoryBtn.__historyBound) {
    clearHistoryBtn.__historyBound = true;
    on(clearHistoryBtn, 'click', () => {
      showConfirmModal(
        t().confirmTitle,
        t().confirmClearHistory,
        () => {
          conversationHistory = [];
          expandedHistoryKey = null;
          saveHistory();
          renderHistory();
          if (typeof status !== 'undefined' && status) {
            status.textContent = t().historyCleared;
          }
        }
      );
    });
  }
  if (historySearchInput && !historySearchInput.__historySearchBound) {
    historySearchInput.__historySearchBound = true;
    on(historySearchInput, 'input', () => {
      if (historySearchTimer) clearTimeout(historySearchTimer);
      historySearchTimer = setTimeout(() => {
        historySearchTimer = null;
        historySearchQuery = historySearchInput.value || '';
        renderHistory();
      }, 150);
    });
  }
  if (historyPinnedOnlyToggle && !historyPinnedOnlyToggle.__historySearchBound) {
    historyPinnedOnlyToggle.__historySearchBound = true;
    on(historyPinnedOnlyToggle, 'change', () => {
      historyPinnedOnly = !!historyPinnedOnlyToggle.checked;
      renderHistory();
    });
  }
  if (historySavedHeaderBtn && !historySavedHeaderBtn.__historySavedBound) {
    historySavedHeaderBtn.__historySavedBound = true;
    on(historySavedHeaderBtn, 'click', () => {
      setSavedHistoryExpanded(!savedHistoryExpanded);
    });
  }
  updateHistorySearchLabels();
  setSavedHistoryExpanded(savedHistoryExpanded);
  historyElementsReady = true;
}

window.__initHistoryElements = initHistoryElements;

// Tab controls (legacy - kept for pinning functionality)
// The tab buttons and contents are no longer in the DOM, so we skip initialization
const tabBtns = []; // document.querySelectorAll('.tab-btn') - no longer used
const tabContents = []; // document.querySelectorAll('.tab-content') - no longer used
const pinnedSections = document.getElementById('pinnedSections');

function clampPinnedBoxPosition(x, y, boxEl = null) {
  // Legacy clamp for DOM-based pinned boxes; kept for the drag-ghost only.
  // Do NOT use it to constrain pinned windows.
  const minVisible = 56;
  const maxW = window.innerWidth;
  const maxH = window.innerHeight;
  const rect = boxEl ? boxEl.getBoundingClientRect() : { width: 360, height: 220 };
  const safeW = Math.max(1, Number(rect.width) || 360);
  const safeH = Math.max(1, Number(rect.height) || 220);
  const minX = -safeW + minVisible;
  const maxX = maxW - minVisible;
  const minY = -safeH + minVisible;
  const maxY = maxH - minVisible;
  const clampedX = Math.min(Math.max(Math.round(x), minX), maxX);
  const clampedY = Math.min(Math.max(Math.round(y), minY), maxY);
  return { x: clampedX, y: clampedY };
}

function loadPinnedHistoryBoxes() {
  const saved = localStorage.getItem(PINNED_HISTORY_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      pinnedHistoryBoxes = parsed
        .filter((it) => it && typeof it.ts === 'number')
        .slice(0, PINNED_HISTORY_MAX)
        .map((it) => ({
          ts: it.ts,
          x: Number(it.x) || 120,
          y: Number(it.y) || 120,
          width: Number(it.width) || 420,
          height: Number(it.height) || 300
        }));
    }
  } catch (_) {
    pinnedHistoryBoxes = [];
  }
}

function savePinnedHistoryBoxes() {
  localStorage.setItem(PINNED_HISTORY_KEY, JSON.stringify(pinnedHistoryBoxes));
}

function removePinnedHistoryBox(ts) {
  pinnedHistoryBoxes = pinnedHistoryBoxes.filter((b) => b.ts !== ts);
  savePinnedHistoryBoxes();
  fireAndForget(IPC_CHANNELS.PINNED_HISTORY_CLOSE, ts);
}

function getHistoryEntryByTimestamp(ts) {
  return conversationHistory.find((e) => e && e.timestamp === ts) || null;
}

function syncPinnedHistoryWindows(filterQuery = '') {
  const normalizedQuery = normalizeSearchText(filterQuery);
  pinnedHistoryBoxes.forEach((box) => {
    const entry = getHistoryEntryByTimestamp(box.ts);
    if (!entry) return;
    if (normalizedQuery && !historyEntryMatches(entry, normalizedQuery)) {
      fireAndForget(IPC_CHANNELS.PINNED_HISTORY_CLOSE, box.ts);
      return;
    }
    const date = new Date(entry.timestamp);
    const timeStr = date.toLocaleString(currentLanguage === 'hu' ? 'hu-HU' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    fireAndForget(IPC_CHANNELS.PINNED_HISTORY_OPEN, {
      ts: box.ts,
      question: entry.question,
      answer: entry.answer || '',
      meta: `🕒 ${timeStr}`,
      language: currentLanguage,
      bounds: {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width || 420),
        height: Math.round(box.height || 300)
      }
    });
  });
}

function pinHistoryEntryAtScreen(ts, screenX, screenY) {
  if (pinnedHistoryBoxes.some((b) => b.ts === ts)) {
    return; // already pinned
  }
  if (pinnedHistoryBoxes.length >= PINNED_HISTORY_MAX) {
    if (status) status.textContent = t().pinnedLimitReached || '⚠️ Max 3 pinned boxes at once.';
    return;
  }
  pinnedHistoryBoxes.push({
    ts,
    x: Math.round(Number(screenX) || 0),
    y: Math.round(Number(screenY) || 0),
    width: 420,
    height: 300
  });
  savePinnedHistoryBoxes();
  syncPinnedHistoryWindows();
}

function pinHistoryEntryAt(ts, x, y) {
  // x/y are client coords inside overlay; convert to screen coords.
  const screenX = Math.round(window.screenX + Number(x || 0));
  const screenY = Math.round(window.screenY + Number(y || 0));
  pinHistoryEntryAtScreen(ts, screenX, screenY);
}

ipcRenderer.on(IPC_CHANNELS.PINNED_HISTORY_BOUNDS, (_event, payload) => {
  if (!payload || typeof payload.ts !== 'number' || !payload.bounds) return;
  const boxRef = pinnedHistoryBoxes.find((b) => b.ts === payload.ts);
  if (!boxRef) return;
  const b = payload.bounds;
  if (typeof b.x === 'number') boxRef.x = b.x;
  if (typeof b.y === 'number') boxRef.y = b.y;
  if (typeof b.width === 'number') boxRef.width = b.width;
  if (typeof b.height === 'number') boxRef.height = b.height;
  savePinnedHistoryBoxes();
});

ipcRenderer.on(IPC_CHANNELS.PINNED_HISTORY_UNPINNED, (_event, payload) => {
  const ts = payload && typeof payload.ts === 'number' ? payload.ts : null;
  if (!ts) return;
  pinnedHistoryBoxes = pinnedHistoryBoxes.filter((b) => b.ts !== ts);
  savePinnedHistoryBoxes();
  renderHistory();
});

ipcRenderer.on(IPC_CHANNELS.REQUEST_HISTORY_DROP_RECTS, (_event, requestId) => {
  const rects = [];
  const offX = window.screenX;
  const offY = window.screenY;

  const historyHeaderBtn = document.getElementById('historyHeaderBtn');
  if (historyHeaderBtn) {
    const r = historyHeaderBtn.getBoundingClientRect();
    rects.push({ left: offX + r.left, top: offY + r.top, right: offX + r.right, bottom: offY + r.bottom });
  }
  const historyPopup = document.querySelector('.section-content.history-section.open');
  if (historyPopup) {
    const r = historyPopup.getBoundingClientRect();
    rects.push({ left: offX + r.left, top: offY + r.top, right: offX + r.right, bottom: offY + r.bottom });
  }

  if (typeof __isBlockWindow !== 'undefined' && __isBlockWindow) {
    const list = document.getElementById('historyList');
    if (list) {
      const r = list.getBoundingClientRect();
      rects.push({ left: offX + r.left, top: offY + r.top, right: offX + r.right, bottom: offY + r.bottom });
    }
  }
  ipcRenderer.send(IPC_CHANNELS.RESPONSE_HISTORY_DROP_RECTS, requestId, rects);
});

function pointInRect(clientX, clientY, rect) {
  if (!rect) return false;
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function isPointInHistoryDropZone(clientX, clientY) {
  const historyHeaderBtn = document.getElementById('historyHeaderBtn');
  if (historyHeaderBtn && pointInRect(clientX, clientY, historyHeaderBtn.getBoundingClientRect())) {
    return true;
  }
  const historyPopup = document.querySelector('.section-content.history-section.open');
  if (historyPopup && pointInRect(clientX, clientY, historyPopup.getBoundingClientRect())) {
    return true;
  }
  return false;
}

// Load pinned tabs from localStorage
function loadPinnedTabs() {
  const saved = localStorage.getItem(STORAGE_KEYS.PINNED_TABS);
  if (saved) {
    try {
      pinnedTabs = new Set(JSON.parse(saved));
      updatePinnedUI();
    } catch (e) {
      pinnedTabs = new Set();
    }
  }
}

// Do NOT persist pinned history across app launches.
// Always start clean (unpinned) and close any pinned windows left open during reload.
// IMPORTANT: only the MAIN overlay window should do this.
// Detached panel windows also load overlay.html, and must NOT clear global pinned state.
const isBlockWindow = (typeof __isBlockWindow !== 'undefined' && __isBlockWindow);
if (!__isDetachedPanelWindow && !isBlockWindow) {
  pinnedHistoryBoxes = [];
  try { localStorage.removeItem(PINNED_HISTORY_KEY); } catch (_) {}
  if (typeof fireAndForget === 'function') {
    fireAndForget(IPC_CHANNELS.PINNED_HISTORY_CLOSE_ALL);
  }
} else {
  loadPinnedHistoryBoxes();
}

// Save pinned tabs to localStorage
function savePinnedTabs() {
  localStorage.setItem(STORAGE_KEYS.PINNED_TABS, JSON.stringify([...pinnedTabs]));
}

// Toggle pin on tab
function togglePin(tabId) {
  if (pinnedTabs.has(tabId)) {
    pinnedTabs.delete(tabId);
  } else {
    pinnedTabs.add(tabId);
  }
  savePinnedTabs();
  updatePinnedUI();
  renderPinnedContent();
}

// Update pin UI (icons)
function updatePinnedUI() {
  tabBtns.forEach(btn => {
    const tabId = btn.getAttribute('data-tab');
    if (pinnedTabs.has(tabId)) {
      btn.classList.add('pinned');
    } else {
      btn.classList.remove('pinned');
    }
  });
}

// Render pinned content
function renderPinnedContent() {
  pinnedSections.innerHTML = '';

  pinnedTabs.forEach(tabId => {
    const tabContent = document.getElementById(tabId);
    if (!tabContent) return;

    const clone = tabContent.cloneNode(true);
    clone.id = `pinned-${tabId}`;
    clone.classList.remove('tab-content', 'active');
    clone.classList.add('pinned-section');

    // Add title
    const title = document.createElement('div');
    title.className = 'section-title';
    const tabBtn = document.querySelector(`[data-tab="${tabId}"]`);
    title.textContent = tabBtn ? tabBtn.textContent.trim() : '';

    const wrapper = document.createElement('div');
    wrapper.className = 'pinned-section';
    wrapper.appendChild(title);
    wrapper.appendChild(clone);

    pinnedSections.appendChild(wrapper);
  });
}

// Tab switching
function switchTab(tabId) {
  tabBtns.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  tabContents.forEach(content => {
    if (content.id === tabId) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
}

// Tab button click handlers
tabBtns.forEach(btn => {
  on(btn, 'click', (e) => {
    const tabId = btn.getAttribute('data-tab');

    // Right-click or Ctrl+click = toggle pin
    if (e.ctrlKey || e.button === 2) {
      e.preventDefault();
      togglePin(tabId);
    } else {
      // Normal click = switch tab
      switchTab(tabId);
    }
  });

  // Prevent context menu on right-click
  on(btn, 'contextmenu', (e) => {
    e.preventDefault();
    const tabId = btn.getAttribute('data-tab');
    togglePin(tabId);
  });
});

// Load history from localStorage
function loadHistory() {
  if (typeof __isBlockWindow !== 'undefined' && __isBlockWindow) {
    return;
  }
  const saved = localStorage.getItem(STORAGE_KEYS.CONVERSATION_HISTORY);
  console.log('[HISTORY] Loading from localStorage:', saved ? `${saved.length} chars, ${JSON.parse(saved).length} items` : 'NULL');
  if (saved) {
    try {
      conversationHistory = JSON.parse(saved);
      console.log('[HISTORY] Loaded successfully:', conversationHistory.length, 'items');
    } catch (e) {
      console.error('[HISTORY] Parse error:', e);
      conversationHistory = [];
    }
  } else {
    console.log('[HISTORY] No saved history found');
  }
}

// Save history to localStorage
function saveHistory() {
  if (typeof __isBlockWindow !== 'undefined' && __isBlockWindow) {
    fireAndForget(IPC_CHANNELS.HISTORY_SET, conversationHistory);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.CONVERSATION_HISTORY, JSON.stringify(conversationHistory));
  console.log('[HISTORY] Saved to localStorage:', conversationHistory.length, 'items');
}

async function syncHistoryFromMain() {
  if (typeof __isBlockWindow === 'undefined' || !__isBlockWindow) return;
  try {
    const res = await invokeMain(IPC_CHANNELS.HISTORY_GET);
    if (res && res.success && Array.isArray(res.history)) {
      conversationHistory = res.history;
      if (!historyElementsReady) initHistoryElements();
      renderHistory();
    }
  } catch (_) {}
}

window.syncHistoryFromMain = syncHistoryFromMain;

if (typeof __isBlockWindow !== 'undefined' && __isBlockWindow) {
  setTimeout(() => {
    try { syncHistoryFromMain(); } catch (_) {}
  }, 0);
}

// Add to history
function addToHistory(question, answer, hasImage = false) {
  const entry = {
    question: question,
    answer: answer,
    timestamp: Date.now(),
    hasImage: hasImage
  };

  conversationHistory.unshift(entry); // Add to beginning

  // Keep max 20 items
  if (conversationHistory.length > 20) {
    conversationHistory = conversationHistory.slice(0, 20);
  }

  saveHistory();
  renderHistory();
}

function createHistoryItem(entry, index, pinnedSet, options = {}) {
  const allowPin = options.allowPin !== false;
  const date = new Date(entry.timestamp);
  const timeStr = date.toLocaleString(currentLanguage === 'hu' ? 'hu-HU' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const imageIndicator = entry.hasImage ? '📸 ' : '';
  const pinIndicator = pinnedSet.has(entry.timestamp) ? '📌 ' : '';
  const normalizedAnswer = (entry.answer || '').replace(/\s+/g, ' ').trim();
  const previewAnswer = normalizedAnswer.length > 140 ? `${normalizedAnswer.slice(0, 140)}…` : normalizedAnswer;
  const isExpanded = expandedHistoryKey === entry.timestamp;

  const item = document.createElement('div');
  item.className = `history-item${isExpanded ? ' active' : ''}`;
  item.dataset.index = String(index);

  const questionEl = document.createElement('div');
  questionEl.className = 'history-question';
  const questionStrong = document.createElement('strong');
  questionStrong.textContent = `❓ ${pinIndicator}${imageIndicator}${entry.question}`;
  questionEl.appendChild(questionStrong);

  const previewEl = document.createElement('div');
  previewEl.className = 'history-preview';
  previewEl.textContent = `💬 ${previewAnswer}`;

  const metaEl = document.createElement('div');
  metaEl.className = 'history-meta';
  const timeEl = document.createElement('span');
  timeEl.className = 'history-time';
  timeEl.textContent = `🕒 ${timeStr}`;
  const toggleEl = document.createElement('span');
  toggleEl.className = 'history-toggle';
  toggleEl.textContent = isExpanded ? t().historyHideDetails : t().historyShowDetails;
  const actionsEl = document.createElement('div');
  actionsEl.className = 'history-actions';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'history-action-btn';
  const isSaved = isHistorySaved(entry.timestamp);
  saveBtn.textContent = isSaved ? (t().historyUnsave || 'Remove') : (t().historySave || 'Save');
  on(saveBtn, 'click', (ev) => {
    ev.stopPropagation();
    if (isHistorySaved(entry.timestamp)) {
      removeSavedHistoryEntry(entry);
    } else {
      saveHistoryEntry(entry);
    }
  });
  on(saveBtn, 'pointerdown', (ev) => {
    ev.stopPropagation();
  });
  actionsEl.appendChild(saveBtn);
  metaEl.appendChild(timeEl);
  metaEl.appendChild(actionsEl);
  metaEl.appendChild(toggleEl);

  const fullEl = document.createElement('div');
  fullEl.className = 'history-full';
  const fullQLabel = document.createElement('div');
  fullQLabel.className = 'history-full-label';
  fullQLabel.textContent = t().historyPopupQuestion;
  const fullQBlock = document.createElement('div');
  fullQBlock.className = 'history-full-block';
  fullQBlock.textContent = entry.question;
  const fullALabel = document.createElement('div');
  fullALabel.className = 'history-full-label';
  fullALabel.textContent = t().historyPopupAnswer;
  const fullABlock = document.createElement('div');
  fullABlock.className = 'history-full-block';
  fullABlock.textContent = entry.answer || '';
  fullEl.appendChild(fullQLabel);
  fullEl.appendChild(fullQBlock);
  fullEl.appendChild(fullALabel);
  fullEl.appendChild(fullABlock);

  item.appendChild(questionEl);
  item.appendChild(previewEl);
  item.appendChild(metaEl);
  item.appendChild(fullEl);

  let pullState = null;
  let suppressClickUntil = 0;

  if (allowPin) {
    // When pulling a history entry out into a pinned window, keep the cursor
    // inside the pinned window header (not outside the top-left corner).
    const PULL_OUT_GRAB_OFFSET_X = 210;
    const PULL_OUT_GRAB_OFFSET_Y = 18;

    on(item, 'pointerdown', (ev) => {
      if (ev.button !== 0) return;
      pushForceInteractive();
      pullState = {
        pointerId: ev.pointerId,
        startX: ev.clientX,
        startY: ev.clientY,
        ts: entry.timestamp,
        moved: false,
        pinned: false,
        noSelect: false
      };
      try { item.setPointerCapture(pullState.pointerId); } catch (_) {}
    });

    on(item, 'pointermove', (ev) => {
      if (!pullState || ev.pointerId !== pullState.pointerId) return;
      const dx = ev.clientX - pullState.startX;
      const dy = ev.clientY - pullState.startY;
      const dist2 = dx * dx + dy * dy;

      // Once the pointer actually moves, suppress text selection.
      if (!pullState.noSelect && dist2 > 1) {
        pullState.noSelect = true;
        document.body.classList.add('pulling-history');
        ev.preventDefault();
      }

      const threshold2 = 9 * 9;
      if (!pullState.moved && dist2 > threshold2) {
        pullState.moved = true;
        suppressClickUntil = Date.now() + 400;

        // Respect max pinned
        if (pinnedHistoryBoxes.length >= PINNED_HISTORY_MAX) {
          if (status) status.textContent = t().pinnedLimitReached || '⚠️ Max 3 pinned boxes at once.';
          pullState = null;
          return;
        }

        // Create the pinned WINDOW immediately (DOM ghosts are clipped by the overlay window).
        const baseScreenX = (typeof ev.screenX === 'number') ? ev.screenX : (window.screenX + ev.clientX);
        const baseScreenY = (typeof ev.screenY === 'number') ? ev.screenY : (window.screenY + ev.clientY);
        const startWinX = Math.round(baseScreenX - PULL_OUT_GRAB_OFFSET_X);
        const startWinY = Math.round(baseScreenY - PULL_OUT_GRAB_OFFSET_Y);
        // Create pinned window in a special "dragging" mode so it can't steal the pointer.
        if (pinnedHistoryBoxes.some((b) => b.ts === pullState.ts)) {
          // already pinned
        } else {
          if (pinnedHistoryBoxes.length >= PINNED_HISTORY_MAX) {
            if (status) status.textContent = t().pinnedLimitReached || '⚠️ Max 3 pinned boxes at once.';
            pullState = null;
            return;
          }
          pinnedHistoryBoxes.push({ ts: pullState.ts, x: startWinX, y: startWinY, width: 420, height: 300 });
          savePinnedHistoryBoxes();
          // Open pinned window with dragging=true so it ignores mouse until drop.
          const entryRef = getHistoryEntryByTimestamp(pullState.ts);
          const date = entryRef ? new Date(entryRef.timestamp) : null;
          const timeStr = date ? date.toLocaleString(currentLanguage === 'hu' ? 'hu-HU' : 'en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : '';
          fireAndForget(IPC_CHANNELS.PINNED_HISTORY_OPEN, {
            ts: pullState.ts,
            question: entry.question,
            answer: entry.answer || '',
            meta: timeStr ? `🕒 ${timeStr}` : '…',
            language: currentLanguage,
            bounds: { x: startWinX, y: startWinY, width: 420, height: 300 },
            dragging: true
          });
        }
        pullState.pinned = true;
        try { item.setPointerCapture(pullState.pointerId); } catch (_) {}
        ev.preventDefault();
        ev.stopPropagation();
      }

      if (pullState && pullState.pinned) {
        const baseScreenX = (typeof ev.screenX === 'number') ? ev.screenX : (window.screenX + ev.clientX);
        const baseScreenY = (typeof ev.screenY === 'number') ? ev.screenY : (window.screenY + ev.clientY);
        const nextWinX = Math.round(baseScreenX - PULL_OUT_GRAB_OFFSET_X);
        const nextWinY = Math.round(baseScreenY - PULL_OUT_GRAB_OFFSET_Y);
        // Move the pinned window with the cursor.
        if (ipcRenderer && typeof ipcRenderer.send === 'function') {
          ipcRenderer.send(IPC_CHANNELS.PINNED_HISTORY_MOVE_BY_TS, pullState.ts, nextWinX, nextWinY);
        } else {
          fireAndForget(IPC_CHANNELS.PINNED_HISTORY_MOVE_BY_TS, pullState.ts, nextWinX, nextWinY);
        }
        ev.preventDefault();
      }
    });

    on(item, 'pointerup', (ev) => {
      if (!pullState || ev.pointerId !== pullState.pointerId) return;
      // If we pinned during drag, it's already created and positioned.
      if (pullState.pinned) {
        fireAndForget(IPC_CHANNELS.PINNED_HISTORY_END_DRAG, pullState.ts);
        renderHistory();
      }
      try { item.releasePointerCapture(pullState.pointerId); } catch (_) {}
      document.body.classList.remove('pulling-history');
      pullState = null;
      popForceInteractive();
    });

    on(item, 'pointercancel', (ev) => {
      if (!pullState || ev.pointerId !== pullState.pointerId) return;
      // If cancel happens after pin creation, remove it.
      if (pullState.pinned) {
        removePinnedHistoryBox(pullState.ts);
      }
      try { item.releasePointerCapture(pullState.pointerId); } catch (_) {}
      document.body.classList.remove('pulling-history');
      pullState = null;
      popForceInteractive();
    });
  }

  on(item, 'click', () => {
    if (Date.now() < suppressClickUntil) return;
    toggleHistoryItem(entry.timestamp);
  });

  return item;
}

// Render history list
function renderHistory() {
  if (!historyElementsReady) initHistoryElements();
  if (!historyList) return;
  updateHistorySearchLabels();
  historyList.textContent = '';
  if (historySavedList) historySavedList.textContent = '';

  const pinnedSet = new Set(pinnedHistoryBoxes.map((b) => b.ts));
  const normalizedQuery = normalizeSearchText(historySearchQuery);
  let entries = conversationHistory.slice();
  const savedEntriesAll = savedHistoryEntries.slice();
  const savedEntries = normalizedQuery
    ? savedEntriesAll.filter((entry) => historyEntryMatches(entry, normalizedQuery))
    : savedEntriesAll;

  if (historyPinnedOnly) {
    entries = entries.filter((entry) => pinnedSet.has(entry.timestamp));
  } else {
    entries = entries.filter((entry) => !pinnedSet.has(entry.timestamp));
  }

  if (normalizedQuery) {
    entries = entries.filter((entry) => historyEntryMatches(entry, normalizedQuery));
  }

  updateHistorySearchMeta(entries.length);

  if (historySavedList) {
    if (savedEntries.length === 0) {
      const emptySaved = document.createElement('p');
      emptySaved.style.color = '#8ba3c0';
      emptySaved.style.textAlign = 'center';
      emptySaved.style.padding = '12px 8px 6px';
      emptySaved.textContent = t().historySavedEmpty || t().noHistory;
      historySavedList.appendChild(emptySaved);
    } else {
      savedEntries.forEach((entry, index) => {
        const item = createHistoryItem(entry, index, pinnedSet, { allowPin: false });
        historySavedList.appendChild(item);
      });
    }
  }

  if (savedEntriesAll.length > 0) {
    const visibleCount = savedEntries.length;
    const totalCount = savedEntriesAll.length;
    const countValue = normalizedQuery && visibleCount !== totalCount
      ? `${visibleCount}/${totalCount}`
      : String(totalCount);
    const countTemplate = t().historySavedCount || '{count}';
    updateSavedHistoryCount(countTemplate.replace('{count}', countValue));
  } else {
    updateSavedHistoryCount('');
  }

  if (conversationHistory.length === 0) {
    const empty = document.createElement('p');
    empty.style.color = '#8ba3c0';
    empty.style.textAlign = 'center';
    empty.style.padding = '20px';
    empty.textContent = t().noHistory;
    historyList.appendChild(empty);
    return;
  }

  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.style.color = '#8ba3c0';
    empty.style.textAlign = 'center';
    empty.style.padding = '20px';
    empty.textContent = t().historySearchNoResults || t().noHistory;
    historyList.appendChild(empty);
    if (!__isDetachedPanelWindow && !isBlockWindow) {
      syncPinnedHistoryWindows(historySearchQuery);
    }
    return;
  }

  entries.forEach((entry, index) => {
    const item = createHistoryItem(entry, index, pinnedSet, { allowPin: true });
    historyList.appendChild(item);
  });

  if (!__isDetachedPanelWindow && !isBlockWindow) {
    syncPinnedHistoryWindows(historySearchQuery);
  }
}

function toggleHistoryItem(timestamp) {
  expandedHistoryKey = expandedHistoryKey === timestamp ? null : timestamp;
  renderHistory();
}

// Legacy popup state cleanup (inline history replaces external popup)
localStorage.removeItem(LEGACY_HISTORY_POPUP_PINNED);
localStorage.removeItem(LEGACY_HISTORY_POPUP_LAST_INDEX);

if (!historyElementsReady) initHistoryElements();

loadSavedHistory();

// Export history
window.exportHistory = function() {
  const dataStr = JSON.stringify(conversationHistory, null, 2);
  const dataBlob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `game-assistant-history-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  status.textContent = t().historyExported;
};

window.addEventListener('storage', (ev) => {
  if (!ev || !ev.key) return;
  if (ev.key === PINNED_HISTORY_KEY) {
    loadPinnedHistoryBoxes();
    renderHistory();
  }
});

