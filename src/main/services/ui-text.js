function createUiTextService() {
  function normalizeLang(lang) {
    return String(lang || '').toLowerCase();
  }

  function getNotePanelLabels(lang) {
    const L = normalizeLang(lang);
    const table = {
      hu: { title: '📝 Jegyzet', placeholder: 'Írj ide jegyzetet...' },
      en: { title: '📝 Note', placeholder: 'Write a note...' },
      de: { title: '📝 Notiz', placeholder: 'Schreibe eine Notiz...' },
      ru: { title: '📝 Заметка', placeholder: 'Напишите заметку...' },
      fr: { title: '📝 Note', placeholder: 'Écrivez une note...' },
      zh: { title: '📝 便笺', placeholder: '写点笔记...' }
    };
    return table[L] || table.en;
  }

  function getInfoPanelLabels(lang) {
    const L = normalizeLang(lang);
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

  return {
    getNotePanelLabels,
    getInfoPanelLabels
  };
}

module.exports = {
  createUiTextService
};
