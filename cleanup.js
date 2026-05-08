/**
 * AI Game Assistant - Code Cleanup Script
 * 
 * Removes backup files and dead code
 * Run: npm run cleanup
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(color, icon, message) {
  console.log(`${color}${icon} ${message}${colors.reset}`);
}

// Find backup files
function findBackupFiles() {
  const files = fs.readdirSync(__dirname);
  return files.filter(f => /\.(backup|bak|old)(\.v\d+)?$/.test(f));
}

// Find dead code patterns
function findDeadCode() {
  const deadPatterns = [];
  
  // DISABLED: These are still in use, just marked for future removal
  // Only enable after implementing inline expansion replacement
  /*
  deadPatterns.push({
    file: 'main.js',
    pattern: 'createHistoryPopupWindow',
    description: 'History popup window (PLANNED for removal - causes game freeze)'
  });
  deadPatterns.push({
    file: 'main.js',
    pattern: 'historyPopupWin',
    description: 'History popup window references (PLANNED for removal)'
  });
  */
  
  return deadPatterns;
}

// Prompt user
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase().trim());
    });
  });
}

// Main cleanup
async function runCleanup() {
  console.log(`${colors.bold}${colors.cyan}🧹 AI Game Assistant - Code Cleanup${colors.reset}\n`);
  
  // Check backup files - INFORMATIONAL ONLY
  const backups = findBackupFiles();
  
  if (backups.length > 0) {
    log(colors.cyan, 'ℹ️', `Found ${backups.length} backup file(s) (kept for safety):`);
    backups.forEach(f => console.log(`   - ${f}`));
    log(colors.cyan, 'ℹ️', 'Backup files are preserved. Only delete manually if you\'re sure.\n');
  } else {
    log(colors.green, '✅', 'No backup files found\n');
  }
  
  // Check dead code
  const deadCode = findDeadCode();
  
  if (deadCode.length > 0) {
    log(colors.yellow, '💀', `Found ${deadCode.length} dead code pattern(s):`);
    deadCode.forEach(item => {
      console.log(`   - ${colors.bold}${item.file}${colors.reset}: ${item.description}`);
    });
    console.log('');
    log(colors.cyan, 'ℹ️', 'Review and manually remove dead code patterns.');
    log(colors.cyan, 'ℹ️', 'Check LEARNINGS.md for context on why code is obsolete.\n');
  } else {
    log(colors.green, '✅', 'No obvious dead code patterns found\n');
  }
  
  console.log(`${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  log(colors.green, '✨', 'Cleanup complete!');
  console.log(`${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

runCleanup().catch(err => {
  log(colors.red, '❌', `Error: ${err.message}`);
  process.exit(1);
});
