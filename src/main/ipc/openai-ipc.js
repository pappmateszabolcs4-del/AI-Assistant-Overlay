const { IPC_CHANNELS } = require('../../shared/ipc-channels');

function registerOpenAiIpc(deps) {
  const { ipcMain, openaiService } = deps;

  ipcMain.handle(IPC_CHANNELS.PROCESS_TEXT, async (_event, text, lang, specializationLevel, imageData, gameContext) => {
    return openaiService.processText({ text, lang, specializationLevel, imageData, gameContext });
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
}

module.exports = {
  registerOpenAiIpc
};
