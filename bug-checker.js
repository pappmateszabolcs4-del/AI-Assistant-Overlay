/**
 * AI Game Assistant - Automated Bug Checker
 * 
 * Scans codebase for common architectural mistakes and suggests fixes
 * Run: node bug-checker.js
 */

const fs = require('fs');
const path = require('path');

// Color output
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

// Bug patterns to detect
const bugPatterns = [
  {
    name: 'Focusable Popup Window',
    severity: 'CRITICAL',
    pattern: /new BrowserWindow\([^)]*focusable:\s*true[^)]*alwaysOnTop:\s*true/s,
    file: 'main.js',
    description: 'Focusable + alwaysOnTop windows steal game focus and freeze games',
    fix: 'Use inline UI expansion instead of separate popup windows. Set focusable: false for gaming overlays.'
  },
  {
    name: 'Duplicate Hotkey Registration',
    severity: 'HIGH',
    pattern: /globalShortcut\.register.*\n[\s\S]*?globalShortcut\.register/,
    file: 'main.js',
    description: 'Multiple hotkey registrations cause duplicate callbacks',
    fix: 'Register hotkeys only once in app.whenReady(). Remove IPC-based re-registration.'
  },
  {
    name: 'Window Destroy/Recreate on Toggle',
    severity: 'HIGH',
    pattern: /overlayWin\s*=\s*new BrowserWindow.*\n[\s\S]{0,500}?overlayWin\.destroy\(\)/,
    file: 'main.js',
    description: 'Creating/destroying windows on toggle causes CPU spikes',
    fix: 'Create window once, use hide()/show() for toggling.'
  },
  {
    name: 'Full-Screen Overlay',
    severity: 'CRITICAL',
    pattern: /new BrowserWindow\([^)]*width:\s*screen\.getPrimaryDisplay\(\)\.workAreaSize\.width/,
    file: 'main.js',
    description: 'Full-screen overlays freeze games and capture system input',
    fix: 'Use regional overlay (e.g., 650x600) instead of full-screen.'
  },
  {
    name: 'Missing Translation',
    severity: 'MEDIUM',
    // Only flag likely user-facing literal text (contains at least one ASCII letter).
    // This avoids false positives like clearing textContent to '' or icon-only glyphs.
    // Also ignore template literals (backticks), since they often contain dynamic interpolations.
    pattern: /textContent\s*=\s*['"][^'"]*[A-Za-z][^'"]*['"]\s*;/,
    file: 'overlay.html',
    description: 'Hard-coded text without translation support',
    fix: 'Use t().keyName pattern for all user-facing text.'
  },
  {
    name: 'Native Dialog Usage',
    severity: 'MEDIUM',
    pattern: /\b(confirm|alert|prompt)\s*\(/,
    file: 'overlay.html',
    description: 'Native dialogs are ugly and cannot be translated',
    fix: 'Use custom modal dialogs (showConfirmModal) instead.'
  },
  {
    // IPC duplication is checked via a custom scan in main.js (see runBugChecker).
    // Regex-only detection would create false positives because IPC registration is expected.
    name: 'IPC Listener Duplication',
    severity: 'HIGH',
    pattern: /$^/,
    file: 'main.js',
    description: 'IPC listeners registered multiple times without checks',
    fix: 'Ensure each ipcMain.on/handle channel is registered only once.'
  },
  {
    name: 'Unsafe Content Filtering',
    severity: 'CRITICAL',
    pattern: /forbidden.*=.*\[.*['"]kill['"].*\]/,
    file: 'overlay.html',
    description: 'Over-strict content filter blocks gaming terms',
    fix: 'Use context-aware filtering (e.g., "kill real people" vs "kill zombie").'
  },
  {
    name: 'setIgnoreMouseEvents on webContents',
    severity: 'HIGH',
    pattern: /webContents\.setIgnoreMouseEvents/,
    file: 'main.js',
    description: 'setIgnoreMouseEvents is a BrowserWindow method, not webContents',
    fix: 'Use browserWindow.setIgnoreMouseEvents() instead, or use CSS pointer-events.'
  },
  {
    name: 'Missing Error Handling in IPC',
    severity: 'MEDIUM',
    pattern: /ipcRenderer\.invoke\(['"][^'"]+['"][^)]*\)(?!\s*\.catch)/,
    file: 'overlay.html',
    description: 'IPC invoke without error handling can crash renderer',
    fix: 'Add .catch() or try/catch to all ipcRenderer.invoke() calls.'
  },
  // Orphan Event Handler is checked with a custom scan in overlay.html (see runBugChecker).
  {
    name: 'History Popup Usage (Problematic)',
    severity: 'HIGH',
    pattern: /open-history-popup|createHistoryPopupWindow/,
    file: 'overlay.html',
    description: 'History popup is still in use but causes game freezing (see LEARNINGS.md Issue 14)',
    fix: 'Replace popup with inline expansion in history list to avoid focus stealing.'
  },
  {
    name: 'Large Commented Code Blocks',
    severity: 'LOW',
    pattern: /\/\*[\s\S]{200,}?\*\//,
    file: 'main.js',
    description: 'Large commented code blocks clutter the codebase',
    fix: 'Remove commented code. Use git history if needed.'
  },
  {
    name: 'TODO/FIXME Comments',
    severity: 'LOW',
    pattern: /\/\/\s*(TODO|FIXME|HACK|XXX)/i,
    file: 'main.js',
    description: 'Unresolved TODO/FIXME comments',
    fix: 'Either implement the TODO or remove if obsolete.'
  }
];

// Files to check
const filesToCheck = [
  { path: 'main.js', type: 'main' },
  { path: 'overlay.html', type: 'renderer' },
  { path: 'index.html', type: 'app' }
];

// Check for backup files
function checkBackupFiles() {
  const files = fs.readdirSync(__dirname);
  const backups = files.filter(f => /\.(backup|bak|old)(\.v\d+)?$/.test(f));
  
  if (backups.length > 0) {
    log(colors.cyan, 'ℹ️', `Found ${backups.length} backup file(s) (kept for safety):`);
    backups.forEach(f => console.log(`   - ${f}`));
    console.log(`   ${colors.cyan}ℹ️ Backup files are preserved by policy. Use backups/ timestamped copies for rollback.${colors.reset}\n`);
  }
  
  return backups.length;
}

// Run checks
function runBugChecker() {
  log(colors.cyan, '🔍', colors.bold + 'AI Game Assistant - Bug Checker\n');
  
  let totalIssues = 0;
  let criticalIssues = 0;
  let highIssues = 0;
  
  filesToCheck.forEach(file => {
    const filePath = path.join(__dirname, file.path);
    
    if (!fs.existsSync(filePath)) {
      log(colors.yellow, '⚠️', `Skipping ${file.path} (not found)`);
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    
    console.log(`\n${colors.bold}📄 Checking ${file.path}...${colors.reset}`);
    
    bugPatterns.forEach(bug => {
      if (bug.file !== file.path) return;
      
      let matches;
      if (bug.pattern.global) {
        matches = [...content.matchAll(bug.pattern)];
      } else {
        const match = content.match(bug.pattern);
        matches = match ? [match] : [];
      }
      
      if (matches.length > 0) {
        totalIssues++;
        
        const severityColor = bug.severity === 'CRITICAL' ? colors.red : 
                              bug.severity === 'HIGH' ? colors.yellow : 
                              colors.cyan;
        
        if (bug.severity === 'CRITICAL') criticalIssues++;
        if (bug.severity === 'HIGH') highIssues++;
        
        log(severityColor, '⚠️', `[${bug.severity}] ${bug.name}`);
        console.log(`   ${colors.reset}${bug.description}`);
        console.log(`   ${colors.green}💡 Fix: ${bug.fix}${colors.reset}`);
        
        // Show first occurrence
        const firstMatch = matches[0];
        const lineNumber = content.substring(0, firstMatch.index).split('\n').length;
        console.log(`   ${colors.cyan}📍 Line ~${lineNumber}${colors.reset}`);
        
        if (matches.length > 1) {
          console.log(`   ${colors.yellow}⚠️  Found ${matches.length} occurrences${colors.reset}`);
        }
        console.log('');
      }
    });

    // Custom scan: duplicate IPC registrations in main.js.
    // Goal: flag only when the same ipcMain.on(...) or ipcMain.handle(...) channel is registered
    // more than once. This avoids false positives where many distinct IPC channels are defined.
    if (file.path === 'main.js') {
      const ipcRegex = /ipcMain\.(on|handle)\(\s*['"]([^'\"]+)['"]/g;
      const counts = new Map(); // key: "on:channel" | "handle:channel"
      let m;
      while ((m = ipcRegex.exec(content)) !== null) {
        const method = m[1];
        const channel = m[2];
        const key = `${method}:${channel}`;
        const entry = counts.get(key) || { count: 0, firstIndex: m.index };
        entry.count += 1;
        counts.set(key, entry);
      }

      const duplicates = [...counts.entries()].filter(([, v]) => v.count > 1);
      if (duplicates.length > 0) {
        totalIssues++;
        highIssues++;
        log(colors.yellow, '⚠️', `[HIGH] IPC Listener Duplication`);
        console.log(`   ${colors.reset}Same IPC channel is registered multiple times`);
        console.log(`   ${colors.green}💡 Fix: Ensure each ipcMain.on/handle channel is registered only once.${colors.reset}`);

        // Show first occurrence (approx) for the first duplicated key.
        const firstDup = duplicates[0];
        const firstIndex = firstDup[1].firstIndex;
        const lineNumber = content.substring(0, firstIndex).split('\n').length;
        console.log(`   ${colors.cyan}📍 Line ~${lineNumber}${colors.reset}`);
        console.log(`   ${colors.yellow}⚠️  Found ${duplicates.length} duplicated channel(s)${colors.reset}`);
        console.log('');
      }
    }

    // Custom scan: orphan handlers that wire events via getElementById(...) on a missing DOM id.
    if (file.path === 'overlay.html') {
      const idsInDom = new Set(
        [...content.matchAll(/\bid\s*=\s*['"]([^'"]+)['"]/g)].map(m => m[1])
      );
      const orphanWires = [];
      for (const m of content.matchAll(/getElementById\(['"]([^'"]+)['"]\)\s*\.(?:onclick|addEventListener)\b/g)) {
        const id = m[1];
        if (!idsInDom.has(id)) {
          const lineNumber = content.substring(0, m.index).split('\n').length;
          orphanWires.push({ id, lineNumber });
        }
      }

      if (orphanWires.length > 0) {
        totalIssues++;
        highIssues++;
        log(colors.yellow, '⚠️', `[HIGH] Orphan Event Handler`);
        console.log(`   ${colors.reset}Event handler references element that may not exist in DOM`);
        console.log(`   ${colors.green}💡 Fix: Verify element exists in HTML. Remove handler if element deleted. Check: getElementById("X") must match an element with id="X"${colors.reset}`);
        console.log(`   ${colors.cyan}📍 Line ~${orphanWires[0].lineNumber}${colors.reset}`);
        if (orphanWires.length > 1) {
          console.log(`   ${colors.yellow}⚠️  Found ${orphanWires.length} occurrences${colors.reset}`);
        }
        console.log('');
      }
    }
  });
  
  // Summary
  console.log(`\n${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  if (totalIssues === 0) {
    log(colors.green, '✅', colors.bold + 'No issues found! Code looks clean.');
  } else {
    log(colors.yellow, '📊', colors.bold + `Found ${totalIssues} potential issue(s):`);
    if (criticalIssues > 0) {
      log(colors.red, '🔴', `${criticalIssues} CRITICAL (must fix)`);
    }
    if (highIssues > 0) {
      log(colors.yellow, '🟡', `${highIssues} HIGH (should fix)`);
    }
    if (totalIssues - criticalIssues - highIssues > 0) {
      log(colors.cyan, '🔵', `${totalIssues - criticalIssues - highIssues} MEDIUM (nice to fix)`);
    }
  }
  
  console.log(`${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  
  return totalIssues;
}

// Run the checker
const issueCount = runBugChecker();
const backupCount = checkBackupFiles();

if (backupCount > 0) {
  log(colors.cyan, 'ℹ️', `Run ${colors.bold}npm run cleanup${colors.reset}${colors.cyan} to remove backup files${colors.reset}`);
}

process.exit(issueCount > 0 ? 1 : 0);
