const { IPC_CHANNELS } = require('../../shared/ipc-channels');

function registerOpenAiIpc(deps) {
  const { ipcMain, openaiService } = deps;

  ipcMain.handle(IPC_CHANNELS.PROCESS_TEXT, async (_event, text, lang, specializationLevel, imageData, gameContext, answerStyle) => {
    return openaiService.processText({ text, lang, specializationLevel, imageData, gameContext, answerStyle });
  });

  ipcMain.handle(IPC_CHANNELS.PROCESS_AUDIO, async (_event, audioBuffer, language = 'hu', specializationLevel = 3) => {
    return openaiService.processAudio({ audioBuffer, language, specializationLevel });
  });

  ipcMain.handle(IPC_CHANNELS.SET_OPENAI_KEY, async (_event, apiKey) => {
    return openaiService.setOpenAIKey(apiKey);
  });

  ipcMain.handle(IPC_CHANNELS.GET_OPENAI_STATUS, async () => {
    return openaiService.getOpenAIStatus();
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_OPENAI_KEY, async () => {
    return openaiService.deleteOpenAIKey();
  });

  ipcMain.handle(IPC_CHANNELS.TRANSLATE_UI_TEXT, async (_event, payload) => {
    return openaiService.translateUiText(payload);
  });
}

module.exports = {
  registerOpenAiIpc
};
