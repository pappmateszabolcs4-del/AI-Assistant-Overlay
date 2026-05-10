// Uses global ipcRenderer/IPC_CHANNELS/STORAGE_KEYS/PANEL_IDS/normalizePanelId from ipc-helpers.

// Panel order (Ask/History/Settings) persistence + swapping.
// The header "slots" are the DOM order of .collapsible-section elements in .sections-container.
const PANEL_ORDER_STORAGE_KEY = STORAGE_KEYS.OVERLAY_PANEL_ORDER;
let panelOrder = null;

function getDefaultPanelOrderFromDom() {
  const container = document.querySelector('.sections-container');
  if (!container) return [...PANEL_IDS];
  const fromDom = Array.from(container.querySelectorAll('.collapsible-section[data-panel]'))
    .map((el) => normalizePanelId(el.getAttribute('data-panel')))
    .filter(Boolean);
  const unique = [];
  for (const pid of fromDom) {
    if (!unique.includes(pid)) unique.push(pid);
  }
  for (const pid of PANEL_IDS) {
    if (!unique.includes(pid)) unique.push(pid);
  }
  return unique;
}

function loadPanelOrder() {
  const fallback = getDefaultPanelOrderFromDom();
  try {
    const raw = localStorage.getItem(PANEL_ORDER_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const normalized = [];
    for (const item of parsed) {
      const pid = normalizePanelId(item);
      if (pid && !normalized.includes(pid)) normalized.push(pid);
    }
    for (const pid of PANEL_IDS) {
      if (!normalized.includes(pid)) normalized.push(pid);
    }
    return normalized;
  } catch (_) {
    return fallback;
  }
}

function savePanelOrder(order) {
  try {
    localStorage.setItem(PANEL_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch (_) {}
}

function applyPanelOrder(order) {
  const container = document.querySelector('.sections-container');
  if (!container) return;
  const map = new Map();
  container.querySelectorAll('.collapsible-section[data-panel]').forEach((section) => {
    const pid = normalizePanelId(section.getAttribute('data-panel'));
    if (pid) map.set(pid, section);
  });
  for (const pid of order) {
    const el = map.get(pid);
    if (el) container.appendChild(el);
  }
}

function swapPanelOrder(fromPanelId, toPanelId) {
  const fromPid = normalizePanelId(fromPanelId);
  const toPid = normalizePanelId(toPanelId);
  if (!fromPid || !toPid || fromPid === toPid) return;
  if (!panelOrder) panelOrder = loadPanelOrder();
  const fromIdx = panelOrder.indexOf(fromPid);
  const toIdx = panelOrder.indexOf(toPid);
  if (fromIdx < 0 || toIdx < 0) return;
  const next = [...panelOrder];
  next[fromIdx] = toPid;
  next[toIdx] = fromPid;
  panelOrder = next;
  applyPanelOrder(panelOrder);
  savePanelOrder(panelOrder);
  try { scheduleRepositionPopups(); } catch (_) {}
}

function initPanelOrderPersistence() {
  if (__isDetachedPanelWindow || (typeof __isBlockWindow !== 'undefined' && __isBlockWindow)) return;
  panelOrder = loadPanelOrder();
  applyPanelOrder(panelOrder);
  savePanelOrder(panelOrder);

  ipcRenderer.on(IPC_CHANNELS.OVERLAY_PANEL_SWAP, (_event, payload) => {
    const fromPid = payload && payload.fromPanelId;
    const toPid = payload && payload.toPanelId;
    swapPanelOrder(fromPid, toPid);
  });
}

initPanelOrderPersistence();
