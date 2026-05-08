const { IPC_CHANNELS } = require('../../shared/ipc-channels');

function getInfoPanelLabels(lang) {
  const L = String(lang || '').toLowerCase();
  const table = {
    hu: {
      title: 'ℹ️ Infó',
      body:
        '• Hotkey: Ctrl+Shift+K – overlay megnyit/zár\n' +
        '• Mozgatás: húzd a felső Ablak mozgatása sávot\n' +
        '• Panelek: külön ablak → külön ablak; visszadokkolás: Dokkolás vagy húzd vissza a fő overlay tetejére\n' +
        '• Mikrofon: Whisper (OpenAI) – többnyelvű; a hang az API-n keresztül kerül feldolgozásra\n' +
        '• Screenshot: csatolj képet → Vision elemzés\n' +
        '• Adatok: előzmények localStorage-ben; a törlés gombok eltávolítják',
      btnClose: 'Bezár'
    },
    en: {
      title: 'ℹ️ Info',
      body:
        '• Hotkey: Ctrl+Shift+K – open/close the overlay\n' +
        '• Move: drag the top “Move overlay” bar\n' +
        '• Panels: detach into separate windows; dock back via Dock or drag onto the overlay header\n' +
        '• Microphone: Whisper (OpenAI) – multilingual; audio is processed via the API\n' +
        '• Screenshot: attach an image → Vision analysis\n' +
        '• Data: history is stored in localStorage; delete buttons remove it',
      btnClose: 'Close'
    },
    de: {
      title: 'ℹ️ Info',
      body:
        '• Hotkey: Ctrl+Shift+K – Overlay öffnen/schließen\n' +
        '• Bewegen: obere „Overlay bewegen“-Leiste ziehen\n' +
        '• Panels: als separate Fenster; zurück andocken via Andocken oder auf die Overlay-Kopfzeile ziehen\n' +
        '• Mikrofon: Whisper (OpenAI) – mehrsprachig; Audio wird über die API verarbeitet\n' +
        '• Screenshot: Bild anhängen → Vision-Analyse\n' +
        '• Daten: Verlauf in localStorage; Löschen-Buttons entfernen ihn',
      btnClose: 'Schließen'
    },
    ru: {
      title: 'ℹ️ Инфо',
      body:
        '• Горячая клавиша: Ctrl+Shift+K — открыть/закрыть оверлей\n' +
        '• Перемещение: тяните верхнюю панель “Move overlay”\n' +
        '• Панели: отдельные окна; вернуть в док — кнопкой Dock или перетащить на верхнюю панель оверлея\n' +
        '• Микрофон: Whisper (OpenAI) — многоязычно; аудио обрабатывается через API\n' +
        '• Скриншот: прикрепите изображение → Vision-анализ\n' +
        '• Данные: история хранится в localStorage; кнопки удаления очищают её',
      btnClose: 'Закрыть'
    },
    fr: {
      title: 'ℹ️ Info',
      body:
        '• Raccourci : Ctrl+Shift+K — ouvrir/fermer l\'overlay\n' +
        '• Déplacer : faites glisser la barre “Move overlay” en haut\n' +
        '• Panneaux : fenêtres séparées; redocker via Dock ou glisser sur l\'en-tête de l\'overlay\n' +
        '• Micro : Whisper (OpenAI) — multilingue; l\'audio est traité via l\'API\n' +
        '• Capture : joindre une image → analyse Vision\n' +
        '• Données : l\'historique est stocké dans localStorage; les boutons de suppression l\'effacent',
      btnClose: 'Fermer'
    },
    zh: {
      title: 'ℹ️ 信息',
      body:
        '• 热键：Ctrl+Shift+K — 打开/关闭覆盖层\n' +
        '• 移动：拖拽顶部“Move overlay”栏\n' +
        '• 面板：可分离为独立窗口；通过 Dock 或拖回覆盖层顶部进行停靠\n' +
        '• 麦克风：Whisper (OpenAI) — 多语言；音频通过 API 处理\n' +
        '• 截图：附加图片 → Vision 分析\n' +
        '• 数据：历史记录存储在 localStorage；删除按钮会清除',
      btnClose: '关闭'
    }
  };
  return table[L] || table.en;
}

function createInfoPanelManager(deps) {
  const {
    registry,
    BrowserWindow,
    clampWindowToWorkArea,
    getPreferredOverlayDisplay,
    getCurrentLanguage
  } = deps;

  function bringInfoPanelToFront() {
    if (!registry.infoPanelWin || registry.infoPanelWin.isDestroyed()) return;
    try {
      // Keep the info panel above the overlay.
      registry.infoPanelWin.setAlwaysOnTop(true, 'screen-saver', 2);
    } catch (_) {
      try { registry.infoPanelWin.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
    }
    try { registry.infoPanelWin.moveTop(); } catch (_) {}
  }

  function setInfoPanelVisible(visible) {
    if (visible && (!registry.infoPanelWin || registry.infoPanelWin.isDestroyed())) {
      try { createInfoPanelWindow({}); } catch (_) {}
    }
    if (!registry.infoPanelWin || registry.infoPanelWin.isDestroyed()) return;
    try {
      registry.infoPanelVirtualVisible = !!visible;
      if (visible) {
        try {
          if (!registry.infoPanelWin.isVisible()) {
            if (typeof registry.infoPanelWin.showInactive === 'function') registry.infoPanelWin.showInactive();
            else registry.infoPanelWin.show();
          }
        } catch (_) {}
        try { registry.infoPanelWin.setIgnoreMouseEvents(true, { forward: true }); } catch (_) {}
        if (typeof registry.infoPanelWin.setOpacity === 'function') {
          try { registry.infoPanelWin.setOpacity(1); } catch (_) {}
        }
        try { bringInfoPanelToFront(); } catch (_) {}
      } else {
        try { registry.infoPanelWin.setIgnoreMouseEvents(true); } catch (_) {}
        if (typeof registry.infoPanelWin.setOpacity === 'function') {
          try { registry.infoPanelWin.setOpacity(0); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  function closeInfoPanelWindow() {
    if (!registry.infoPanelWin || registry.infoPanelWin.isDestroyed()) {
      registry.infoPanelWin = null;
      return;
    }
    try { registry.infoPanelWin.destroy(); } catch (_) {}
    registry.infoPanelWin = null;
  }

  function createInfoPanelWindow(payload) {
    if (registry.infoPanelWin && !registry.infoPanelWin.isDestroyed()) {
      try { registry.infoPanelWin.webContents.send(IPC_CHANNELS.INFO_PANEL_INIT, payload || {}); } catch (_) {}
      return registry.infoPanelWin;
    }

    const bounds = (payload && payload.bounds) ? payload.bounds : (registry.infoPanelLastBounds || null);
    const width = Math.max(240, Math.round((bounds && bounds.width) || 440));
    const height = Math.max(140, Math.round((bounds && bounds.height) || 300));
    let x = typeof (bounds && bounds.x) === 'number' ? Math.round(bounds.x) : undefined;
    let y = typeof (bounds && bounds.y) === 'number' ? Math.round(bounds.y) : undefined;

    if (typeof x !== 'number' || typeof y !== 'number') {
      try {
        const display = getPreferredOverlayDisplay();
        const area = display && display.workArea ? display.workArea : require('electron').screen.getPrimaryDisplay().workArea;
        x = Math.round(area.x + Math.max(0, (area.width - width) / 2));
        y = Math.round(area.y + Math.max(0, (area.height - height) / 2));
      } catch (_) {}
    }

    const clampedPos = (typeof x === 'number' && typeof y === 'number')
      ? clampWindowToWorkArea(x, y, width, height, 0)
      : null;

    registry.infoPanelWin = new BrowserWindow({
      width,
      height,
      x: clampedPos ? clampedPos.x : x,
      y: clampedPos ? clampedPos.y : y,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focusable: true,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    registry.infoPanelWin.loadFile('info-panel.html');
    registry.infoPanelWin.webContents.on('did-finish-load', () => {
      try {
        const labels = getInfoPanelLabels(getCurrentLanguage());
        registry.infoPanelWin.webContents.send(IPC_CHANNELS.INFO_PANEL_INIT, { ...(payload || {}), labels });
      } catch (_) {}
    });

    try {
      registry.infoPanelWin.setAlwaysOnTop(true, 'screen-saver', 2);
    } catch (_) {
      registry.infoPanelWin.setAlwaysOnTop(true, 'screen-saver');
    }
    try { registry.infoPanelWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (_) {}

    registry.infoPanelWin.on('closed', () => {
      registry.infoPanelWin = null;
    });

    // Start click-through; the renderer enables interactivity on hover.
    try { registry.infoPanelWin.setIgnoreMouseEvents(true, { forward: true }); } catch (_) {}

    return registry.infoPanelWin;
  }

  return {
    bringInfoPanelToFront,
    setInfoPanelVisible,
    closeInfoPanelWindow,
    createInfoPanelWindow
  };
}

module.exports = {
  createInfoPanelManager
};
