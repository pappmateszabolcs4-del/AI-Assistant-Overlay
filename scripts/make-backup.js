const fs = require('fs');
const path = require('path');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function makeTimestamp(d = new Date()) {
  const yyyy = d.getFullYear();
  const MM = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const HH = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${yyyy}${MM}${dd}-${HH}${mm}${ss}`;
}

function safeCopyFile(src, dest) {
  fs.copyFileSync(src, dest);
}

function main() {
  const files = process.argv.slice(2);
  const targetFiles = files.length > 0 ? files : [
    'main.js',
    'overlay.html',
    'index.html',
    'note-panel.html',
    'info-panel.html',
    'pinned-history.html'
  ];

  const root = path.resolve(__dirname, '..');
  const backupDir = path.join(root, 'backups');
  if (!fs.existsSync(backupDir)) {
    throw new Error(`Backup directory not found: ${backupDir}`);
  }

  const timestamp = makeTimestamp();

  for (const file of targetFiles) {
    const src = path.join(root, file);
    if (!fs.existsSync(src)) {
      // eslint-disable-next-line no-console
      console.warn(`Skipping ${file} (not found)`);
      continue;
    }

    const destName = `${file}.backup.${timestamp}`;
    const dest = path.join(backupDir, destName);
    safeCopyFile(src, dest);
    // eslint-disable-next-line no-console
    console.log(`Saved ${file} -> ${dest}`);
  }
}

try {
  main();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(`Backup failed: ${err.message}`);
  process.exit(1);
}
