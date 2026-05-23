const fs = require('fs');
const path = require('path');
const readline = require('readline');

function parseArgs(argv) {
  const args = {};
  const list = Array.isArray(argv) ? argv : [];
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = list[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function normalizeGameKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function buildOutputPath(gameName, outPath) {
  if (outPath) return path.resolve(outPath);
  const key = normalizeGameKey(gameName) || 'unknown';
  return path.join(process.cwd(), 'out', `reviewed-facts-${key}.json`);
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function hashText(value) {
  let hash = 5381;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i);
    hash &= 0xffffffff;
  }
  return (hash >>> 0).toString(16);
}

function ensureFactId(fact, index) {
  if (fact.id) return fact.id;
  const seed = `${fact.text || ''}::${fact.sourceType || ''}::${index}`;
  return `fact-${hashText(seed)}`;
}

function formatList(list) {
  const items = Array.isArray(list) ? list : [];
  return items.length ? items.join(', ') : '-';
}

function cloneFact(fact) {
  return JSON.parse(JSON.stringify(fact || {}));
}

function buildReviewOrder(facts) {
  const groups = new Map();
  const ungrouped = [];

  for (const fact of facts) {
    const groupKey = fact && fact.nearDuplicateGroup ? String(fact.nearDuplicateGroup) : '';
    if (groupKey) {
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(fact);
    } else {
      ungrouped.push(fact);
    }
  }

  const ordered = [];
  const groupSizes = new Map();

  const groupKeys = Array.from(groups.keys()).sort();
  for (const groupKey of groupKeys) {
    const groupFacts = groups.get(groupKey) || [];
    groupFacts.sort((a, b) => {
      const scoreA = Number.isFinite(a && a.nearDuplicateScore) ? a.nearDuplicateScore : 0;
      const scoreB = Number.isFinite(b && b.nearDuplicateScore) ? b.nearDuplicateScore : 0;
      return scoreB - scoreA;
    });
    groupSizes.set(groupKey, groupFacts.length);
    ordered.push(...groupFacts);
  }

  if (ungrouped.length) {
    groupSizes.set('UNGROUPED', ungrouped.length);
    ordered.push(...ungrouped);
  }

  return { ordered, groupSizes };
}

async function reviewInteractive(facts) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

  const reviewData = buildReviewOrder(facts);
  const orderedFacts = reviewData.ordered.map((fact, index) => {
    const cloned = cloneFact(fact);
    cloned.id = ensureFactId(cloned, index);
    return cloned;
  });
  const groupSizes = reviewData.groupSizes;

  const decisions = [];
  const decisionIndex = new Map();
  const decisionById = new Map();

  let lastGroup = null;

  const setDecision = (decision) => {
    if (!decision || !decision.id) return;
    if (decisionIndex.has(decision.id)) {
      const idx = decisionIndex.get(decision.id);
      decisions[idx] = decision;
    } else {
      decisionIndex.set(decision.id, decisions.length);
      decisions.push(decision);
    }
    decisionById.set(decision.id, decision);
  };

  let i = 0;
  while (i < orderedFacts.length) {
    const current = orderedFacts[i];

    const groupKey = current && current.nearDuplicateGroup ? String(current.nearDuplicateGroup) : 'UNGROUPED';
    const isGrouped = groupKey !== 'UNGROUPED';
    if (groupKey !== lastGroup) {
      const size = groupSizes.get(groupKey) || 0;
      if (lastGroup !== null) {
        // eslint-disable-next-line no-console
        console.log('');
      }
      const label = isGrouped
        ? `=== Similar group ${groupKey} (${size} facts) ===`
        : `=== UNGROUPED (${size} facts) ===`;
      // eslint-disable-next-line no-console
      console.log(label);
      lastGroup = groupKey;
    }

    // eslint-disable-next-line no-console
    console.log(`\n[${i + 1}/${orderedFacts.length}] ${current.text || '(missing text)'}`);
    if (isGrouped) {
      const score = Number.isFinite(current.nearDuplicateScore)
        ? current.nearDuplicateScore.toFixed(2)
        : 'n/a';
      // eslint-disable-next-line no-console
      console.log(`  similar: ${groupKey} (score ${score})`);
    }
    // eslint-disable-next-line no-console
    console.log(`  keywords: ${formatList(current.keywords)}`);
    // eslint-disable-next-line no-console
    console.log(`  tags: ${formatList(current.tags)}`);
    // eslint-disable-next-line no-console
    console.log(`  priority: ${current.priority}`);

    const existingDecision = decisionById.get(current.id);
    if (existingDecision) {
      // eslint-disable-next-line no-console
      console.log(`  current decision: ${existingDecision.action}`);
    }

    let action = null;
    let note = '';

    while (!action) {
      const input = (await ask('Action [a]pprove [r]eject [s]kip [e]dit [t]ags [p]riority [b]ack [n]ext [q]uit: '))
        .trim()
        .toLowerCase();

      if (input === 'q') {
        rl.close();
        return { orderedFacts, decisions };
      }

      if (input === 'b') {
        if (i > 0) {
          i -= 1;
        } else {
          // eslint-disable-next-line no-console
          console.log('Already at the first item.');
        }
        action = 'nav-back';
        continue;
      }

      if (input === 'n') {
        action = 'skip';
        note = '';
        break;
      }

      if (input === 'a') action = 'approve';
      if (input === 'r') action = 'reject';
      if (input === 's') action = 'skip';

      if (input === 'e') {
        const nextText = (await ask('New text (empty to keep): ')).trim();
        if (nextText) current.text = nextText;
        action = 'rewrite';
      }

      if (input === 't') {
        const nextTags = (await ask('Tags (comma separated, empty to keep): ')).trim();
        if (nextTags) {
          current.tags = nextTags.split(',').map((v) => v.trim()).filter(Boolean);
        }
        action = 'retag';
      }

      if (input === 'p') {
        const nextPriority = (await ask('Priority (1-3, empty to keep): ')).trim();
        if (nextPriority) {
          const parsed = Number.parseInt(nextPriority, 10);
          if (Number.isFinite(parsed)) current.priority = parsed;
        }
        action = 'reprioritize';
      }
    }

    if (action === 'nav-back') {
      continue;
    }

    if (action !== 'skip' || note) {
      note = (await ask('Note (optional): ')).trim();
    }

    setDecision({
      id: current.id,
      action,
      note,
      timestamp: Date.now()
    });

    i += 1;
  }

  rl.close();
  return { orderedFacts, decisions };
}

function reviewBatch(facts, mode) {
  const reviewData = buildReviewOrder(facts);
  const orderedFacts = reviewData.ordered.map(cloneFact);
  const approved = [];
  const rejected = [];
  const pending = [];
  const decisions = [];

  for (let i = 0; i < orderedFacts.length; i += 1) {
    const current = orderedFacts[i];
    current.id = ensureFactId(current, i);

    let action = 'skip';
    if (mode === 'approve-all') action = 'approve';
    if (mode === 'reject-all') action = 'reject';

    decisions.push({
      id: current.id,
      action,
      note: '',
      timestamp: Date.now()
    });

    if (action === 'approve') approved.push(current);
    else if (action === 'reject') rejected.push(current);
    else pending.push(current);
  }

  return { approved, rejected, pending, decisions };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.in ? path.resolve(args.in) : null;
  if (!inputPath) {
    // eslint-disable-next-line no-console
    console.error('Missing --in input file');
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const parsed = JSON.parse(raw || '{}');
  const facts = Array.isArray(parsed && parsed.facts) ? parsed.facts : [];
  const game = parsed && parsed.game ? String(parsed.game) : '';
  const sourceType = parsed && parsed.sourceType ? String(parsed.sourceType) : '';

  const mode = String(args.mode || '').trim().toLowerCase();
  const shouldInteractive = process.stdin.isTTY && (!mode || mode === 'interactive');

  const reviewResult = shouldInteractive
    ? await reviewInteractive(facts)
    : reviewBatch(facts, mode || 'approve-all');

  let approved = [];
  let rejected = [];
  let pending = [];
  let decisions = reviewResult.decisions || [];

  if (shouldInteractive) {
    const decisionById = new Map();
    for (const decision of decisions) {
      if (decision && decision.id) decisionById.set(decision.id, decision);
    }

    const orderedFacts = Array.isArray(reviewResult.orderedFacts)
      ? reviewResult.orderedFacts
      : facts.map(cloneFact);

    for (const fact of orderedFacts) {
      const decision = decisionById.get(fact.id);
      if (!decision || decision.action === 'skip') {
        pending.push(fact);
      } else if (decision.action === 'reject') {
        rejected.push(fact);
      } else {
        approved.push(fact);
      }
    }
  } else {
    approved = reviewResult.approved || [];
    rejected = reviewResult.rejected || [];
    pending = reviewResult.pending || [];
  }

  const output = {
    game,
    sourceType,
    reviewedAt: new Date().toISOString(),
    facts: approved,
    rejected,
    pending,
    decisions
  };

  if (args.dryRun) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const outPath = buildOutputPath(game, args.out);
  ensureDir(outPath);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  // eslint-disable-next-line no-console
  console.log(`Saved review output to ${outPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
