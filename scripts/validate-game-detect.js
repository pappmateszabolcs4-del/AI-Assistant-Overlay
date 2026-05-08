const path = require('path');

const { createGameDetectService } = require(path.join(__dirname, '..', 'src', 'main', 'services', 'game-detect'));
const casesPath = path.join(__dirname, '..', 'tests', 'game-detect-cases.json');
const cases = require(casesPath).cases || [];

const service = createGameDetectService({
  registry: {},
  screen: {
    getCursorScreenPoint() {
      return { x: 0, y: 0 };
    },
    getDisplayNearestPoint() {
      return { id: 0 };
    },
    getAllDisplays() {
      return [];
    },
    getPrimaryDisplay() {
      return { id: 0 };
    }
  }
});

function matchesExpectation(result, testCase) {
  const normalizedResult = typeof result === 'string' ? result.toLowerCase() : result;
  const normalizedExpect = typeof testCase.expect === 'string' ? testCase.expect.toLowerCase() : testCase.expect;
  if (testCase.expectNull) return result == null;
  if (Array.isArray(testCase.expectOneOf)) {
    return testCase.expectOneOf.map((item) => item.toLowerCase()).includes(normalizedResult);
  }
  if (typeof testCase.expect === 'string') return normalizedResult === normalizedExpect;
  if (testCase.expectAny) return result != null;
  return false;
}

const failures = [];
for (const testCase of cases) {
  const result = service.matchGameFromText(testCase.text);
  if (!matchesExpectation(result, testCase)) {
    failures.push({
      id: testCase.id,
      text: testCase.text,
      expected: testCase.expect || (testCase.expectNull ? 'null' : testCase.expectOneOf),
      actual: result
    });
  }
}

if (failures.length) {
  console.log(`[VALIDATE] Failed ${failures.length}/${cases.length} cases`);
  console.table(failures);
  process.exitCode = 1;
} else {
  console.log(`[VALIDATE] All ${cases.length} cases passed.`);
}
