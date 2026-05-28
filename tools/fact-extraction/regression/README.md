# Regression Infra (Fact Extraction)

Purpose: deterministic regression visibility and behavior drift detection.

## Folder layout

- snapshots/ : canonical JSON snapshots (stable serialization)
- summaries/ : diff-friendly MD summaries
- diffs/ : JSON diff outputs
- configs/ : run configs + thresholds
- scripts/ : regression scripts

## Quick start

Create a baseline snapshot:

```bash
node tools/fact-extraction/regression/scripts/run-neighborhood-snapshot.js \
  tools/fact-extraction/regression/configs/neighborhood-default.json \
  baseline
```

Create a current snapshot:

```bash
node tools/fact-extraction/regression/scripts/run-neighborhood-snapshot.js \
  tools/fact-extraction/regression/configs/neighborhood-default.json \
  current
```

Compare snapshots:

```bash
node tools/fact-extraction/regression/scripts/compare-snapshots.js \
  tools/fact-extraction/regression/snapshots/baseline.json \
  tools/fact-extraction/regression/snapshots/current.json
```

Notes:
- Keep configs deterministic (seed, game, sourceType, args).
- Snapshots are stable JSON for machine parity; summaries are human review.
- Thresholds are in configs/thresholds.json.
