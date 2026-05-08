// Use var so the binding is available globally across scripts.
var ipcRenderer = require('electron').ipcRenderer;
globalThis.ipcRenderer = ipcRenderer;

const { IPC_CHANNELS } = require('./src/shared/ipc-channels');
const { STORAGE_KEYS } = require('./src/shared/storage-keys');
const { PANEL_IDS, normalizePanelId } = require('./src/shared/panels');

globalThis.IPC_CHANNELS = IPC_CHANNELS;
globalThis.STORAGE_KEYS = STORAGE_KEYS;
globalThis.PANEL_IDS = PANEL_IDS;
globalThis.normalizePanelId = normalizePanelId;

function invokeMain(channel, ...args) {
  try {
    return ipcRenderer.invoke(channel, ...args);
  } catch (err) {
    console.error(`[IPC] ${channel} failed:`, err);
    throw err;
  }
}

function fireAndForget(channel, ...args) {
  invokeMain(channel, ...args).catch(() => {});
}

function on(target, eventName, handler, options) {
  if (!target) return;
  target.addEventListener(eventName, handler, options);
}

globalThis.invokeMain = invokeMain;
globalThis.fireAndForget = fireAndForget;
globalThis.on = on;
