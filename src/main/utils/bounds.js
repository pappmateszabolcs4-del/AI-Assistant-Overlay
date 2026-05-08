const { screen } = require('electron');

function clampWindowToWorkArea(x, y, width, height, gutter = 0) {
  const w = Math.max(1, Math.round(width || 1));
  const h = Math.max(1, Math.round(height || 1));
  const candidateX = Math.round(x || 0);
  const candidateY = Math.round(y || 0);
  const centerPoint = { x: candidateX + Math.round(w / 2), y: candidateY + Math.round(h / 2) };
  const display = screen.getDisplayNearestPoint(centerPoint);
  const area = (display && display.workArea) ? display.workArea : screen.getPrimaryDisplay().workArea;

  const minX = area.x + gutter;
  const minY = area.y + gutter;
  const maxX = area.x + Math.max(0, area.width - w - gutter);
  const maxY = area.y + Math.max(0, area.height - h - gutter);

  return {
    x: Math.min(Math.max(candidateX, minX), maxX),
    y: Math.min(Math.max(candidateY, minY), maxY)
  };
}

function rectsOverlap(workArea, rect) {
  const overlapWidth = Math.max(
    0,
    Math.min(workArea.x + workArea.width, rect.x + rect.width) - Math.max(workArea.x, rect.x)
  );
  const overlapHeight = Math.max(
    0,
    Math.min(workArea.y + workArea.height, rect.y + rect.height) - Math.max(workArea.y, rect.y)
  );
  return overlapWidth >= 40 && overlapHeight >= 40;
}

module.exports = {
  clampWindowToWorkArea,
  rectsOverlap
};
