# Fact Tool - Very Simple Guide (URL Only)

This is a step-by-step guide for the fact extraction tools.

## 1) Open the terminal

In VS Code: Terminal -> New Terminal

## 2) Go to the project folder

```bash
cd D:\AIGameAssistant_new
```

## 3) Run fact extraction (URL)

```bash
node tools\fact-extraction\fact-extract.js --game "My Game" --sourceType official --url "https://example.com/wiki/page" --out .\out\my-game-facts.json --llm --verbose --llmTimeoutSec 60
```

Result file:

```
D:\AIGameAssistant_new\out\my-game-facts.json
```

Notes:
- Exact duplicate facts are removed automatically.
- Near-duplicate facts are dropped when they match the near-duplicate threshold.
- Weak tradeoff templates can be dropped as low-signal.
- The extractor can add novelty/obviousness/system fields; normalize may override priority.
- Canonicalization (semantic clustering) is enabled by default; use --noCanonicalize to skip.
- Use --canonicalDiagTop 5 to log top candidate diagnostics in output.
- Diagnostics now include a quality summary (priority/family/novelty/obviousness/template shapes).
- Time-bound release/event metadata is filtered unless it clearly describes evergreen gameplay.

## 4) Review the facts (interactive)

```bash
node tools\fact-extraction\review.js --in .\out\my-game-facts.json
```

Keys during review:
- a = approve
- r = reject
- s = skip
- e = edit text
- t = retag
- p = priority
- b = back
- n = next
- q = quit

## 5) Output after review

```
D:\AIGameAssistant_new\out\reviewed-facts-my-game.json
```

## If something fails

- Make sure you are in D:\AIGameAssistant_new
- Make sure the file path is correct
- Make sure the OpenAI key is saved in the app settings
- If it looks stuck, use --verbose and --llmTimeoutSec 60
- If near-duplicate marking is too strict or too loose, adjust data\fact-extraction-policy.json (dedupe settings)
- If canonicalization seems too aggressive, use --canonicalSoft 0.86 --canonicalStrong 0.90 or --noCanonicalize
