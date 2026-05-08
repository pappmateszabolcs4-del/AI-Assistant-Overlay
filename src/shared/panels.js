const PANEL_IDS = ['ask', 'history', 'settings'];

function normalizePanelId(panelId) {
  const pid = String(panelId || '').toLowerCase();
  if (PANEL_IDS.includes(pid)) return pid;
  return null;
}

module.exports = {
  PANEL_IDS,
  normalizePanelId
};
