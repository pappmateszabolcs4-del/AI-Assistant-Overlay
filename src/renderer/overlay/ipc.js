// IPC handlers that stitch overlay state to the main process.

ipcRenderer.on(IPC_CHANNELS.CLEANUP_OVERLAY, () => {
  cleanupOverlay();
});

ipcRenderer.on(IPC_CHANNELS.SET_LANGUAGE, (event, lang) => {
  const nextLang = lang || 'en';
  setLanguage(nextLang);
  try {
    localStorage.setItem(STORAGE_KEYS.OVERLAY_LANGUAGE, nextLang);
  } catch (_) {}
  updateOverlayText();
  refreshVoices();
  __bootLangReady = true;
  __maybeFinishBoot();

  // Retry a few times if voices aren't loaded yet (Web Speech API async loading)
  let retryCount = 0;
  const retryInterval = setInterval(() => {
    if (!selectedVoice && retryCount < 5) {
      refreshVoices();
      retryCount++;
    } else {
      clearInterval(retryInterval);
    }
  }, 100); // retry every 100ms
});

ipcRenderer.on(IPC_CHANNELS.SET_SPEECH_RATE, (event, rate) => {
  currentSpeechRate = rate || 100;
  if (typeof setSpeechRateUI === 'function') {
    setSpeechRateUI(currentSpeechRate);
  }
});

// Játék kontextus fogadása
ipcRenderer.on(IPC_CHANNELS.SET_GAME_CONTEXT, (event, gameName) => {
  currentGameContext = gameName;
  console.log(`Game context set: ${gameName}`);
});
