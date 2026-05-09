const { createRendererI18n } = require('./src/shared/i18n/renderer-i18n');

// UI translations and language state.
var currentLanguage = 'en';
var currentSpeechRate = 100;
var selectedVoice = null;

const i18n = createRendererI18n({
  lang: currentLanguage,
  onUpdate: () => {
    if (typeof updateOverlayText === 'function') {
      updateOverlayText();
    }
  }
});

function setLanguage(nextLang) {
  currentLanguage = nextLang || 'en';
  i18n.setLang(currentLanguage);
}

function t() {
  return i18n.t();
}
