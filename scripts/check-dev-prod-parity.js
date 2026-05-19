const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const DEV_ONLY_START = "<!-- dev-only:start -->";
const DEV_ONLY_END = "<!-- dev-only:end -->";

const IGNORE_DIRS = new Set([
  ".git",
  ".vscode",
  "backups",
  "node_modules",
  "out",
  "dist",
  "coverage",
]);

function readNormalized(filePath) {
  return fs.readFileSync(filePath, "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
}

function stripDevOnlyBlocks(text, label) {
  let output = text;
  let startIndex = output.indexOf(DEV_ONLY_START);

  while (startIndex !== -1) {
    const endIndex = output.indexOf(DEV_ONLY_END, startIndex + DEV_ONLY_START.length);
    if (endIndex === -1) {
      return {
        text: output,
        error: `Unclosed dev-only block in ${label}`,
      };
    }

    let sliceStart = startIndex;
    let sliceEnd = endIndex + DEV_ONLY_END.length;

    if (sliceStart > 0 && output[sliceStart - 1] === "\n") {
      sliceStart -= 1;
    }
    if (sliceEnd < output.length && output[sliceEnd] === "\n") {
      sliceEnd += 1;
    }

    output = output.slice(0, sliceStart) + output.slice(sliceEnd);
    startIndex = output.indexOf(DEV_ONLY_START);
  }

  if (output.includes(DEV_ONLY_END)) {
    return {
      text: output,
      error: `Orphan dev-only end marker in ${label}`,
    };
  }

  return { text: output, error: null };
}

function isDevArtifact(filePath) {
  const name = path.basename(filePath).toLowerCase();
  return (
    name.includes(".dev.") ||
    name.endsWith(".dev.html") ||
    name.endsWith(".dev.js") ||
    name.endsWith(".dev.css")
  );
}

function walkDir(dir, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walkDir(path.join(dir, entry.name), results);
      continue;
    }

    const filePath = path.join(dir, entry.name);
    results.push(filePath);
  }
}

let hasFailure = false;

const allFiles = [];
walkDir(ROOT, allFiles);
const unexpectedDevFiles = allFiles.filter((filePath) => {
  if (!isDevArtifact(filePath)) return false;
  return true;
});

if (unexpectedDevFiles.length > 0) {
  hasFailure = true;
  console.error("Unexpected dev-only files found:");
  for (const filePath of unexpectedDevFiles) {
    console.error(`- ${filePath}`);
  }
}

const overlayPath = path.join(ROOT, "overlay.html");
if (!fs.existsSync(overlayPath)) {
  hasFailure = true;
  console.error("Missing required file: overlay.html");
} else {
  const overlayText = readNormalized(overlayPath);
  const overlayStrip = stripDevOnlyBlocks(overlayText, "overlay.html");
  if (overlayStrip.error) {
    hasFailure = true;
    console.error(`FAIL: ${overlayStrip.error}`);
  } else {
    console.log("OK: overlay.html dev-only markers are balanced");
  }
}

if (hasFailure) {
  process.exit(1);
}
