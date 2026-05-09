const test = require('node:test');
const assert = require('node:assert/strict');

const { createGameDetectService } = require('../src/main/services/game-detect');

function createService(overrides = {}) {
  const registry = {
    game: {
      gameDetectIgnoreList: [],
      lastKnownGameDisplayId: null,
      lastKnownGameDisplayAt: 0,
      ...overrides.game
    }
  };

  const screen = {
    getCursorScreenPoint: () => ({ x: 100, y: 100 }),
    getDisplayNearestPoint: () => ({ id: 1 }),
    getPrimaryDisplay: () => ({ id: 0 }),
    getAllDisplays: () => ([{ id: 1 }, { id: 2 }]),
    ...overrides.screen
  };

  return createGameDetectService({ registry, screen });
}

test('matchGameFromText detects dataset names', () => {
  const service = createService();
  const match = service.matchGameFromText('RimWorld');
  assert.equal(match, 'RimWorld');
});

test('extractGameName respects ignore list', () => {
  const service = createService({
    game: {
      gameDetectIgnoreList: ['Visual Studio Code']
    }
  });

  const result = service.extractGameName('Visual Studio Code');
  assert.equal(result, null);
});

test('extractGameName matches known regex patterns', () => {
  const service = createService();
  const result = service.extractGameName('Counter-Strike 2');
  assert.equal(result, 'Counter-Strike 2');
});

test('getPreferredOverlayDisplay returns recent game display', () => {
  const recent = Date.now();
  const service = createService({
    game: {
      lastKnownGameDisplayId: 2,
      lastKnownGameDisplayAt: recent
    },
    screen: {
      getAllDisplays: () => ([{ id: 1 }, { id: 2 }]),
      getDisplayNearestPoint: () => ({ id: 99 })
    }
  });

  const display = service.getPreferredOverlayDisplay();
  assert.equal(display.id, 2);
});
