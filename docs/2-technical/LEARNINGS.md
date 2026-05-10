# AI Game Assistant - Development Learnings

## 🚨 CRITICAL: Documentation & Organization Standard (effective 2026-02-07)

This document is a **single source of truth** and must remain **English-only**.

Required structure going forward:
1. **Foundations & standards first** (rules, policies, patterns).
2. **Daily logs second**, strictly ordered:
  - By date ascending.
  - Within the same date: **Morning → Afternoon → Evening → Night**.

If older content exists in another language or duplicated form, translate or consolidate it. Do not keep parallel copies.

### ✅ REQUIRED: Daily Log Entry Template (use this format)

When adding new work logs, append them under **Daily Logs (Chronological)** using this exact structure so entries remain sortable and readable.

```markdown
### YYYY-MM-DD (Morning | Afternoon | Evening | Night)

#### Summary
- What changed:
- Why:
- Impact:

#### Details
- Implementation notes:
- Edge cases:

#### Files touched
- [path/to/file.ext](path/to/file.ext)

#### Backups
- Created via scripts/make-backup.ps1 before changes
- Never auto-delete or prompt-delete anything from backups/

#### Verification
- How it was tested (manual / script / in-game):

#### Follow-ups
- TODO:
```

## 🎯 Project Vision: Customer-First Product

**CRITICAL**: This is NOT a personal project - this will be DISTRIBUTED to END USERS.

**Every decision must prioritize:**
- ✅ **Security First** - Zero vulnerabilities, safe dependencies, secure API handling
- ✅ **User Experience** - Intuitive, reliable, polished UI/UX
- ✅ **Stability** - Production-ready code quality, comprehensive error handling
- ✅ **Privacy** - Secure credential storage (keytar), no data leaks, transparent data usage

**Development Mindset**: Build as if releasing to thousands of users tomorrow. No shortcuts, no "good enough for me" - it must be "good enough for anyone."

---

## 🧭 Core Principles: Customizable and Non-Hardcoded

**These are REQUIRED going forward.** They apply to all UI, behavior, and settings work.

### 1) Customization-First (Everything adjustable)
**Goal:** Users must be able to tune the experience to their needs. If it is user-facing, expect a control for it.

**Implications:**
- Prefer settings/toggles/sliders over fixed behavior.
- UI layout, sizes, and visibility should be adjustable when feasible.
- Defaults are fine, but they must be overrideable.
- Respect persistence: user choices should survive restarts.

**Examples:**
- Overlay layout and position are user-controlled where feasible.
- Voice output settings (volume, enable/disable) are adjustable.
- Any new feature includes configuration if it affects UX.

### 2) No Hardcoded Values (Configuration instead)
**Goal:** Avoid fixed magic numbers or fixed text that cannot be customized or tuned later.

**Implications:**
- Replace magic numbers with settings, constants, or computed values.
- Keep layout constraints configurable (min/max width/height, margins, spacing).
- Avoid hardcoding copy that should be translated or customizable.

**Examples:**
- Replace fixed size limits with user-configurable limits or screen-based bounds.
- Use translation keys for all user-facing text.
- Use persisted settings instead of inline constants.

**Non-negotiable:** If a new change introduces a hardcoded UX constraint, it must be justified and documented, or replaced with a configurable option.

---

## Session Overview
**Date**: February 4-5, 2026  
**Status**: STABLE - Regional overlay with zero interference + Vision AI + Content Security + Custom Modals + Full Translations + Draggable Overlay + Reset Layout + Game Context Detection

**Latest Features (Feb 5, 2026 Evening):**
- ✅ Game context detection (active-win) - Auto-detects what game user is playing
- ✅ Draggable overlay with persistent position
- ✅ Reset Layout button with proper confirmation
- ✅ Custom modal dialogs (no native confirm/alert)
- ✅ Full 6-language support for all features
- ✅ Gaming-aware content filter (allows game mechanics terms)
- ✅ Tab pinning system with localStorage
- ✅ Conversation history (20 items)
- ✅ Screenshot analysis with GPT-4o Vision

## 🌍 CRITICAL RULE: Universal Translation Policy

### ⚠️ MANDATORY FOR ALL NEW FEATURES
**Every new UI element, message, or user-facing text MUST be translated to ALL 6 supported languages:**
1. 🇭🇺 Hungarian (hu)
2. 🇬🇧 English (en)
3. 🇩🇪 German (de)
4. 🇷🇺 Russian (ru)
5. 🇫🇷 French (fr)
6. 🇨🇳 Chinese (zh)

**No exceptions.** If you add:
- A new button label
- An error message
- A confirmation dialog
- A status text
- Any user-visible content

**→ Add it to the `uiText` object in overlay.html with ALL 6 language keys**

**Example:**
```javascript
const uiText = {
  hu: { newFeature: '<Hungarian translation>' },
  en: { newFeature: 'New feature' },
  de: { newFeature: '<German translation>' },
  ru: { newFeature: '<Russian translation>' },
  fr: { newFeature: '<French translation>' },
  zh: { newFeature: '<Chinese translation>' }
};
```

**Why this matters:**
- Users rely on consistent language experience
- Mixing languages (e.g., "Confirmation" in English modal when app is in Hungarian) breaks immersion
- Incomplete translations look unprofessional

---

## 🎨 UI Pattern: Custom Modal Dialogs

### ❌ NEVER Use Native Dialogs
**Bad:** `confirm()`, `alert()`, `prompt()`
- Ugly, inconsistent styling
- Can't be translated dynamically
- Don't match app theme
- Break user experience

### ✅ ALWAYS Use Custom Modals
**Implementation (overlay.html):**

**1. CSS Styling:**
```css
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  display: none; /* Hidden by default */
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-overlay.active {
  display: flex; /* Show when active */
}

.modal-content {
  background: rgba(26, 31, 46, 0.95);
  border: 1px solid rgba(91, 158, 255, 0.4);
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
}
```

**2. HTML Structure:**
```html
<div class="modal-overlay" id="confirmModal">
  <div class="modal-content">
    <div class="modal-title" id="modalTitle"></div>
    <div class="modal-message" id="modalMessage"></div>
    <div class="modal-buttons">
      <button class="modal-btn modal-btn-cancel" id="modalCancel"></button>
      <button class="modal-btn modal-btn-confirm" id="modalConfirm"></button>
    </div>
  </div>
</div>
```

**3. JavaScript Function:**
```javascript
function showConfirmModal(title, message, onConfirm) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalCancel.textContent = t().btnCancel; // Translated
  modalConfirm.textContent = t().btnDelete; // Translated
  
  // Full screen for better visibility
  ipcRenderer.send('window-action', 'maximize-temp');
  confirmModal.classList.add('active');
  
  const closeModal = () => {
    confirmModal.classList.remove('active');
    ipcRenderer.send('window-action', 'restore-temp');
  };
  
  modalConfirm.onclick = () => {
    closeModal();
    onConfirm();
  };
  
  modalCancel.onclick = closeModal;
  confirmModal.onclick = (e) => {
    if (e.target === confirmModal) closeModal();
  };
}
```

**4. IPC Handler (main.js):**
```javascript
let overlayOriginalBounds = null;
ipcMain.on('window-action', (event, action) => {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  
  switch (action) {
    case 'maximize-temp':
      overlayOriginalBounds = overlayWin.getBounds();
      overlayWin.maximize();
      break;
    case 'restore-temp':
      if (overlayOriginalBounds) {
        overlayWin.setBounds(overlayOriginalBounds);
        overlayOriginalBounds = null;
      }
      break;
  }
});
```

**5. Usage Example:**
```javascript
clearHistoryBtn.onclick = () => {
  showConfirmModal(
    t().confirmTitle,      // "⚠️ Confirmation"
    t().confirmClearHistory, // Fully translated message
    () => {
      // Action on confirm
      conversationHistory = [];
      saveHistory();
      renderHistory();
    }
  );
};
```

**Benefits:**
- ✅ Full theme integration (dark mode, colors, fonts)
- ✅ Dynamic translation support
- ✅ Full-screen backdrop for visibility
- ✅ Smooth animations
- ✅ Consistent UX across all confirmations
- ✅ Professional appearance

**Translation Keys Required:**
```javascript
confirmTitle: '⚠️ Confirmation',
confirmClearHistory: 'Are you sure you want to clear all history?',
confirmClearAll: 'Are you sure you want to clear ALL data?',
btnCancel: 'Cancel',
btnDelete: 'Delete'
```

---

## Security & Content Policy (Feb 5, 2026)

### 🚨 STRICT GAMING-ONLY POLICY
The application enforces a multi-layer content security system:

**Layer 1: Client-side Input Validation (overlay.html)**
- Forbidden keyword detection (English + Hungarian)
- Blocks: illegal activities, sexual content, prompt injections
- Immediate rejection before API call

**Layer 2: AI System Prompt (main.js)**
- Explicit VIDEO GAME ASSISTANT ONLY policy
- Hardcoded refusal message for non-gaming topics
- Prevents jailbreak attempts ("ignore previous instructions", etc.)

**Layer 3: OpenAI Safety Filter**
- Additional safeguard from OpenAI's moderation API

**Forbidden Topics:**
❌ Real-world illegal activities, harm, violence
❌ Sexual, explicit, adult content (NSFW)
❌ Personal information, hacking real systems
❌ Political, religious, controversial topics
❌ Medical, legal, financial advice
❌ Roleplaying outside of game assistant scope
❌ Prompt injection attacks

**Allowed Topics:**
✅ Video game strategies, tips, walkthroughs
✅ Game mechanics, items, characters, bosses
✅ Gaming hardware, peripherals, settings
✅ Esports, gaming culture

**Refusal Message (standardized):**
"Sorry, I only answer video game-related questions. Please ask about games!"

---

## Critical Issues & Solutions

### Issue 1: Application Froze on Startup
**Symptom**: Main window was destroyed immediately on app ready  
**Root Cause**: Erroneous cleanup code in `app.whenReady()` calling `destroy()` too early  
**Solution**: Remove automatic window destruction; only destroy on actual close events  
**Lesson**: IPC listeners must be registered ONCE using a flag to prevent duplicates

### Issue 2: Double Overlay Rendering
**Symptom**: Overlay panel appeared twice/stacked visually  
**Root Cause**: CSS nested fixed positioning + transparent body creating double layer effect  
**Solution**: Simplified CSS - body transparent, container relative positioning only  
**Lesson**: Avoid nested fixed positioning in overlay; use flexbox centering instead

### Issue 3: Unwanted Auto-Show on Startup
**Symptom**: Overlay appeared automatically when app started  
**Root Cause**: `ready-to-show` event handler calling `show()` automatically  
**Solution**: Set `show: false` on window creation; let hotkey/button trigger visibility  
**Lesson**: Separate window load events from visibility control

### Issue 4: Duplicate Hotkey Callbacks (Early Feb 4)
**Symptom**: Single hotkey press triggered callback multiple times  
**Root Cause**: TWO registration points:
  - `registerHotkey()` from `app.whenReady()`
  - `register-hotkey` IPC handler triggered by settings save  
**Solution**: Removed IPC re-registration; single registration at startup only  
**Lesson**: Hotkey changes only take effect on restart (simpler than hot-reload)

### Issue 5: Rapid CPU Spikes on Hotkey Press
**Symptom**: CPU usage spiked significantly each time hotkey was pressed  
**Root Cause**: Full window destroy/recreate on every toggle  
**Solution**: Pre-create overlay once at startup; use `hide()`/`show()` toggle only  
**Lesson**: Window lifecycle is expensive; minimize creation/destruction cycles

### Issue 6: Enum Overlay Cascading (Late Feb 4) ⭐️ CRITICAL
**Symptom**: Hotkey callback triggered multiple times in rapid sequence (loop-like behavior)  
**Root Cause**: Full-screen overlay window + `focusable: false` caused system event weirdness  
**Solution**: Changed to regional window (550x450) instead of full-screen  
**Lesson**: Full-screen overlay windows behave like system tools (e.g., Snipping Tool) - can freeze input

### Issue 7: Underlying Games/Videos Froze
**Symptom**: YouTube/games became unresponsive when overlay opened  
**Root Cause**: Full-screen overlay window captured Windows input system (like screenshotting)  
**Solution**: Regional overlay (550x450px) doesn't capture system input  
**Lesson**: Never use full-screen transparent overlay for game assistant - use regional window

### Issue 8: Main App Window Appeared on Hotkey Press
**Symptom**: Hitting hotkey showed both overlay AND main app window  
**Root Cause**: Hotkey handler called `win.focus()` to keep window active  
**Solution**: Removed `win.focus()` from hotkey handler  
**Lesson**: App window should be invisible by default; let user click icon to show it

## Architecture Decisions

### ✅ What Works Well

**Regional Overlay Window**
```javascript
// 550x450 transparent window, centered on screen
// Centered manually after layout
overlayWin.setPosition(x, y);
```
- No freezing of games
- Games/videos still receive input
- Stays on top with `alwaysOnTop: true`
- Clean visual appearance

**Hide/Show Toggle (not destroy/recreate)**
```javascript
if (overlayWin.isVisible()) {
  overlayWin.hide();
} else {
  overlayWin.show();
}
```
- No CPU spikes
- No visual flicker
- Instant response

**IPC Cleanup on Hide**
```javascript
overlayWin.webContents.send('cleanup-overlay');
overlayWin.hide();
```
- Recording stops cleanly
- Media streams properly released
- UI state reset
- Ready for next toggle

**Flag-Based Debounce**
```javascript
if (isHotkeyProcessing) return; // Check FIRST
isHotkeyProcessing = true;
// ... do work ...
setTimeout(() => { isHotkeyProcessing = false; }, 500);
```
- Prevents double-trigger
- Simpler than timeout-based
- Works reliably

### ❌ What Didn't Work

| Approach | Problem | Why |
|----------|---------|-----|
| Full-screen overlay | Games freeze | System input capture like Snipping Tool |
| `focusable: true` | Steals focus | Overlay becomes active, games unfocused |
| `pointer-events: none` on body | Needed hacks | Extra CSS rules to make buttons work |
| Destroy/recreate on toggle | CPU spikes | Window init is expensive |
| Timeout-based debounce | Duplicate triggers | Callback executes before timeout set |
| Pre-init + auto-show | Auto-appear | Showed on startup unwanted |
| `win.focus()` on hotkey | App pops up | User doesn't want main window |

## Performance Metrics

### Before Optimization
- CPU spike: ~15-20% on each hotkey press (destroy/recreate)
- Visible flicker: 200-300ms
- Videos freeze: YES

### After Optimization
- CPU spike: <2% (hide/show only)
- Visible flicker: None
- Videos freeze: NO

## Deployment Checklist

- [x] Main window starts hidden (`show: false`)
- [x] Overlay window is regional (550x450, centered)
- [x] Hotkey only toggles overlay, doesn't show app
- [x] Cleanup IPC called before overlay hide
- [x] No fullscreen overlay - prevents input capture
- [x] `focusable: false` on overlay window
- [x] Single hotkey registration at startup
- [x] Flag-based debounce (300-500ms)
- [x] Proper cleanup on app quit (destroy all windows, unregister hotkeys)
- [x] README updated with patterns and pitfalls
- [x] Backup files created (.v2 versions)

## Code Patterns to Remember

### Safe Hotkey Registration
```javascript
const hotkeyCallback = () => {
  if (isHotkeyProcessing) return; // Early exit
  isHotkeyProcessing = true;
  setTimeout(() => { isHotkeyProcessing = false; }, 500);
  
  // Logic here
};

const success = globalShortcut.register('CommandOrControl+Shift+K', hotkeyCallback);
if (!success) console.error('Hotkey registration failed');
```

### Regional Overlay Creation
```javascript
overlayWin = new BrowserWindow({
  width: 550,
  height: 450,
  frame: false,
  transparent: true,
  focusable: false,      // CRITICAL
  alwaysOnTop: true,
  skipTaskbar: true,
  show: false
});

// Center on screen
const { width, height } = screen.getPrimaryDisplay().workAreaSize;
overlayWin.setPosition(
  Math.round((width - 550) / 2),
  Math.round((height - 450) / 2)
);
```

### Overlay Cleanup
```javascript
// In renderer (overlay.html)
ipcRenderer.on('cleanup-overlay', () => {
  if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  recording = false;
  micBtn.textContent = '🎤 Mikrofon';
  status.textContent = '';
});

// In main.js
overlayWin.webContents.send('cleanup-overlay');
overlayWin.hide();
```

## Future Improvements & TODO List

### ✅ Completed
1. Voice recognition with multi-language support
2. Regional overlay window (550x450)
3. Customizable hotkeys
4. AI assistant with OpenAI integration
5. Game specialization levels (1-5)
6. **Vision AI** - Screenshot + AI analysis (GPT-4o Vision)
7. **Content Security** - Gaming-only policy, multi-layer filtering
8. **Conversation History** - Saves last 20 Q&A pairs with timestamps
   - LocalStorage persistence
   - Click to reload previous answers
   - Image indicator for vision queries
   - Multi-language date formatting
   - Clear history function

### 🚧 In Progress
1. **Vision capabilities** - Screenshot/video analysis with AI vision
   - Screenshot capture from game ✅
   - Video recording from game
   - Question input alongside visual content ✅
   - Send image + question to AI for analysis ✅
   - Support for game map sections, puzzles, etc. ✅
   - **CRITICAL FIX (Feb 5)**: Added explicit prompts to bypass OpenAI safety filter
     - System prompt clarifies: "VIDEO GAME SCREENSHOTS with virtual characters"
     - User prompt emphasizes: "NOT real people, game graphics only"
     - Prevents false positives where AI refuses game character analysis

### 📋 TODO
1. **Remember window positions** - Save overlay position per-monitor setup
2. **Game-specific profiles** - Save different AI settings per game
3. ~~**History/conversation memory**~~ - ✅ COMPLETED (Feb 5, 2026)
4. **Screenshot annotations** - Draw on screenshots before sending
5. **Performance optimizations** - Reduce memory footprint
2. **Customizable overlay layout** - Let users adjust layout and panel arrangement
3. **Keyboard input passthrough** - Some keys might still need passing through
4. **Multiple monitor support** - Open overlay on active screen only
5. **Recording device selection** - Let users choose mic input
6. **Audio output** - Play feedback sounds for recording start/stop
7. **Gesture support** - Alt+Tab handling for overlay
8. **Window preview** - Show upcoming recording time before start
9. URGENT!!!! **Editable overlay note panel** – Add a floating, user-editable overlay panel (like pinned history, but for notes or custom content). Users can create, edit, and move their own notes anywhere on screen.


## Session Statistics

- **Total issues found**: 8
- **Critical issues**: 2 (full-screen freeze, duplicate loop)
- **Time to stable**: ~4 hours
- **Files modified**: main.js, index.html, overlay.html, user guide
- **Backups created**: 4 (.v2, .v3 versions)

## Key Takeaway

**Regional overlay windows are the solution for game assistants.** Full-screen overlays interfere with system input and freeze games (just like Windows screenshotting tool). The final architecture uses a small, centered, non-focusable regional window that doesn't interfere with the underlying application while remaining always-on-top and responsive to hotkeys.

---

## 🧹 Code Hygiene & Maintenance Rules

### CRITICAL: Zero Tolerance for Dead Code
**Rule**: If code is abandoned/obsolete, DELETE it immediately. Don't comment it out, don't keep "just in case".

**Why**:
- Git history preserves everything - you can always recover
- Dead code confuses future developers (including yourself)
- Commented blocks clutter reading flow
- "Temporary" comments become permanent

### Automated Cleanup Tools

**Bug Checker** (`npm run check`):
- Scans for architectural anti-patterns
- Detects dead code patterns
- Flags missing translations
- Checks error handling
- Exit code 1 if issues found

**Code Cleanup** (`npm run cleanup`):
- Reports dead code patterns and potential cleanup targets
- Must remain **backup-safe**: it must not auto-delete or prompt-delete files from `backups/`
- Suggests manual cleanup tasks

### Workflow for New Features

1. **Before implementing**:
   - Run `npm run check` to ensure baseline is clean
  - Document approach in the learnings log

2. **During implementation**:
   - Keep only working code in files
   - Use git commits for experiments (not commented blocks)
  - Avoid ad-hoc copies in the project root (`*.old`, `*.bak`, `file copy.html`); use `backups/` + git instead

3. **After completion**:
   - Remove all abandoned attempts (e.g., popup window code)
   - Run `npm run check` to verify no issues introduced
  - Update the learnings log with results
  - Keep backups; delete only manually after explicit review (if ever)

### Files That Should NOT Exist

❌ **Ad-hoc copies in the project root** (confusing and easy to overwrite accidentally):
- `*.bak`, `*.old`, `*.tmp`, `index copy.html`, etc.

✅ **Backups in `backups/` are allowed and expected**:
- Use `scripts/make-backup.ps1` to create timestamped backups
- Never auto-delete backups

❌ **Dead Code**:
- Commented-out function blocks >10 lines
- Unused imports/dependencies
- Orphaned IPC handlers (no sender)
- Functions with no callers

❌ **TODO Hell**:
- `// TODO: implement later` (>1 month old)
- `// FIXME: this is broken` (without issue ticket)
- `// HACK: temporary solution` (>1 week old)

### What to Keep

✅ **Short inline comments** explaining WHY (not WHAT)
✅ **JSDoc comments** for public APIs
✅ **Learnings log entries** for abandoned approaches (explains WHY it failed)
✅ **Bug patterns in bug-checker.js** to prevent future mistakes

### Current Dead Code to Remove

Based on Feb 5, 2026 experiments:

**✅ Status update (Feb 6, 2026)**
- Inline history expansion is fully live; popup-era code (`createHistoryPopupWindow`, `historyPopupWin`) is no longer referenced anywhere.
- `registerIpcHandlers()` in [main.js](main.js#L29-L260) now wires every `ipcMain.handle` once during app startup, so the historical listener duplication issues are gone.
- Popup-era artifacts (`history-popup.html`, `popup-preload.js`) were deleted on 2026-02-08 after confirming zero runtime references.

**Priority 1 - REPLACE FIRST (then delete)**:
- [x] Implement inline history expansion in overlay.html
- [x] Remove `ipcRenderer.send('open-history-popup')` call
- [x] THEN remove `createHistoryPopupWindow()` in main.js
- [x] THEN remove all `historyPopupWin` references
- [x] THEN remove `ipcMain.on('open-history-popup')` handler
- [x] THEN delete `popup-preload.js` file

**Priority 2 - Safe to delete NOW**:
**Priority 2 - Backup policy**:
- Backups are preserved. Do not delete automatically.

**Priority 3 - REVIEW & CLEAN**:
- [ ] Large commented code blocks in main.js
- [ ] Unused IPC handlers (check if renderer calls them)
- [ ] Old TODO comments (implement or delete)

### Maintenance Schedule

**Daily** (when coding):
- Remove failed attempts same session
- Keep only working implementations

**Weekly** (before push/PR):
- Run `npm run cleanup` (reporting only; backup-safe)
- Review and remove old TODOs
- Update the learnings log

**Monthly**:
- Audit all IPC handlers (ensure bidirectional use)
- Review dependencies (remove unused)
- Check for new anti-patterns to add to bug-checker.js

### Code Size Guidelines

**Target Sizes** (maintainability threshold):
- Single file: <2500 lines
- Single function: <100 lines
- CSS block: <50 rules per selector

**When to Refactor**:
- File >2500 lines → Split into modules
- Function >100 lines → Extract subfunctions
- Copy-pasted code >3 times → Create utility function

**Current Status** (Feb 5, 2026):
- main.js: ~1280 lines ✅ (healthy)
- overlay.html: ~1946 lines ✅ (healthy)
- No refactoring needed yet

**Action Plan**:
Run `npm run cleanup` (reporting only; backup-safe) → Remove popup code → Update the learnings log

---
## Issue 17: Orphan Event Handlers Cascading Failure (FIXED)
**Date Fixed**: Feb 5, 2026  
**Severity**: 🔴 CRITICAL

### Problem
When HTML element deleted but JavaScript handler still exists:
```javascript
document.getElementById('clearAllBtn').onclick = ... // clearAllBtn doesn't exist!
```
This throws `TypeError: Cannot set properties of null`, breaking ALL subsequent handlers.

### Root Cause
During UI refactor (tab-based → collapsible), button `clearAllBtn` was removed from HTML but handler stayed in JavaScript. First page load crashed before other handlers registered.

### Solution Implemented
✅ Created `bug-checker.js` with **orphan handler detection**

✅ Added to CI/CD: `npm run check` finds orphans automatically

### Prevention Checklist
- [ ] Before HTML refactor: List all `getElementById` references
- [ ] After deletion: Delete corresponding JavaScript handler
- [ ] Run `npm run check` to verify no orphans
- [ ] Test in app before commit

---

## Issue 18: Web Speech API Network Dependency (FIXED)
**Date Fixed**: Feb 5, 2026  
**Severity**: 🟡 MEDIUM

### Problem
Chrome/Electron Web Speech Recognition requires **online Google Cloud connection**. Fails with "network" error even when microphone working and permission granted.

### Solution Implemented
✅ **Switched to OpenAI Whisper API** (`process-audio` handler)

**Implementation**:
- Replaced `SpeechRecognition` with `MediaRecorder` API
- Captures audio blob from microphone
- Sends to `ipcRenderer.invoke('process-audio', audioBuffer)`
- main.js processes with OpenAI Whisper, returns transcript

### Specialization Level Integration
Audio processing now respects the 1-5 slider (specialized context level), same as text queries.

---

## Issue 19: Game Detection Early Initialization (FIXED)
**Date Fixed**: Feb 5, 2026  
**Severity**: 🟡 MEDIUM

### Problem
`currentDetectedGame` was **null** when overlay first showed because game detection only ran in hotkey handler, not at app startup.

### Solution Implemented
✅ **Extract game detection to standalone function**

Game detection now called at:
1. App startup: `app.whenReady() → detectCurrentGame()`
2. Hotkey pressed: `detectCurrentGame()`
3. Overlay shown: `overlayWin.show() → detectCurrentGame()`

**Benefits**:
- App start: Immediately detects game ✅
- Hotkey: Refreshes if game changed ✅
- Overlay show: Detects if user launched game AFTER app start ✅

---

## Issue 20: GPU Memory Leak - System Resource Starvation (FIXED) 🚨 CRITICAL
**Date Discovered**: Feb 5, 2026 (Evening)  
**Date Fixed**: Feb 5, 2026 (Night)  
**Severity**: 🔴 CRITICAL (System-wide impact)

### Problem
**Symptom**: After using the app, Discord and ChatGPT would become unresponsive/freeze
- Discord: Perpetually loading, UI frozen
- ChatGPT web: Browser stuck, slow load times
- Opera GX: Laggy rendering
- Windows system: General slowdown

**Investigation**:
Initial diagnostics seemed fine:
- Ping: 3-4ms (excellent)
- DNS resolve: Working
- Internet connectivity: ✅ Good
- Browser caches: Cleared

But Discord status meter showed: **Telekom - PROBLEMS 🔴** and **Discord - PROBLEMS 🔴**

**Root Cause**: NOT network-related, but **GPU/system-level resource hogging**

### The Culprit: Aggressive Chromium Flags

In `main.js` lines 8-11 (added during optimization attempts):
```javascript
// ❌ BAD - System-level resource starvation
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('renderer-process-limit', '1');
```

These flags had unintended side effects:

1. **`CalculateNativeWinOcclusion` (disabled)**
   - Purpose: Tell Chromium window state to GPU
   - **Effect**: Broke GPU occlusion detection
   - **Result**: Overlay thought it was always visible, allocated max GPU
   - **Impact**: Starved Discord/Chrome GPU memory

2. **`renderer-process-limit = 1`**
   - Purpose: Limit renderer processes (memory save)
   - **Effect**: Forced ALL rendering to single process
   - **Result**: Monopolized GPU pipeline
   - **Impact**: Discord/Chrome couldn't access GPU, froze

3. **Combined Effect**:
   ```
   AI Game Assistant
   ├─ GPU: 50%+ (monopolized)
   ├─ Shared memory: ~30 MB
   └─ GPU cache priority: Max
   
   Discord + Chrome
   ├─ GPU: 0% (blocked)
   ├─ Memory: Queued/timeout
   └─ Result: FREEZE
   ```

### Why This Worked in Testing
- **Terraria**: On separate GPU from Discord
- **Single-game scenario**: No competing app load
- **Short sessions**: System hadn't accumulated GPU fragmentation
- **Fresh boot**: GPU memory clean

But in real usage (Discord + ChatGPT + Game):
- All three apps compete for GPU
- Windows scheduler couldn't arbitrate
- Result: One app freezes others

### Solution Implemented

**1. Removed Aggressive Flags** (lines 8-11 deleted):
```javascript
// ✅ REMOVED - No aggressive flags
app.commandLine.appendSwitch('enable-features', 'V8CodeCaching'); // Safe optimization only
```

**2. Implemented Graceful Shutdown**:
```javascript
// ✅ NEW - Cleanup function
function cleanup() {
  globalShortcut.unregisterAll();  // Release hotkey
  overlayWin?.destroy();           // Release GPU/memory
  win?.destroy();                  // Clean main window
}

// Hook to all exit paths
app.on('before-quit', cleanup);
process.on('exit', cleanup);
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
```

**3. Safe Always-On-Top Mode**:
```javascript
// ✅ CHANGED - 'screen-saver' → 'floating'
overlay  Win.setAlwaysOnTop(true, 'floating');  // Less aggressive
```

**4. Voice Loading Retry**:
```javascript
// ✅ NEW - Handle Web Speech API async loading
ipcRenderer.on('set-language', (event, lang) => {
  currentLanguage = lang;
  updateOverlayText();
  refreshVoices();
  
  // Retry 5x if voices not loaded yet
  let retryCount = 0;
  const retryInterval = setInterval(() => {
    if (!selectedVoice && retryCount < 5) {
      refreshVoices();
      retryCount++;
    } else {
      clearInterval(retryInterval);
    }
  }, 100);
});
```

**5. HTML Performance Optimization**:
```html
<!-- ✅ NEW - Prevent expensive DOM operations -->
<script>
  // Monitor long tasks
  if (window.PerformanceObserver) {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          console.warn('[Perf] Long task:', entry.duration + 'ms');
        }
      }
    }).observe({entryTypes: ['longtask']});
  }
  
  // Throttle async operations
  let asyncCount = 0;
  window.setTimeout = function(...args) {
    if (++asyncCount > 100) {
      console.warn('[Memory] High async operations:', asyncCount);
    }
    return originalSetTimeout.apply(this, args);
  };
</script>
```

### Verification

**After Fix**:
- ✅ Discord: Loads normally, responsive
- ✅ ChatGPT: Quick load, working fine
- ✅ Opera GX: Fast rendering
- ✅ System: No slowdown
- ✅ App: Still overlays properly, no impact

### Windows System Recovery (Manual)

For users who experienced freezing:

```powershell
# 1. Kill processes
Get-Process electron,Discord,chrome | Stop-Process -Force

# 2. Clear GPU caches
Remove-Item "$env:APPDATA\Discord\Cache" -Recurse -Force
Remove-Item "$env:LOCALAPPDATA\Google\Chrome\User Data\GrpcChannels" -Recurse -Force

# 3. GPU driver reset
net stop "NVIDIA Display Driver Service"
Start-Sleep -Seconds 3
net start "NVIDIA Display Driver Service"

# 4. Network reset
ipconfig /flushdns
ipconfig /release
ipconfig /renew

# 5. Full restart
Restart-Computer -Force
```

### Lesson Learned

**❌ NEVER use aggressive Chromium flags for optimization:**
- `disable-features` affects GPU scheduling
- `renderer-process-limit` monopolizes GPU pipeline
- `sandbox` mode interferes with window focus
- System-level flags have ripple effects

**✅ DO focus on code-level optimization:**
- Lazy loading (load on demand)
- Memory cleanup (destroy unused objects)
- Graceful shutdown (proper resource release)
- Passive optimization (V8CodeCaching)

**Pattern to Remember**:
```
❌ WRONG: System-level flags (affect entire Chromium)
✅ RIGHT: Code-level optimization (affects only this app)
```

### Impact Assessment

| Aspect | Before | After | Change |
|--------|--------|-------|--------|
| Discord stability | ❌ Freeze | ✅ OK | FIXED |
| GPU usage | 50%+ | 10-15% | -70% |
| System responsiveness | Laggy | Smooth | FIXED |
| Overlay functionality | Working | Working | NO CHANGE |
| TTS support | Retry needed | With fallback | IMPROVED |

### Prevention

**Future optimization attempts must:**
1. ✅ Add to the learnings log (document the attempt)
2. ✅ Test with Discord open (check for freeze)
3. ✅ Run speedtest after (verify DNS/network unaffected)
4. ✅ Monitor GPU/CPU (check resource impact)
5. ✅ Revert if any system slowdown detected

**Rule**: "If it fixes one problem but breaks something else, it's not a fix." (Principle of Least Surprise)

---


## Daily Logs (Chronological)

Use the **Daily Log Entry Template** in the CRITICAL section above.

### 2026-02-04 (Evening)

#### Specialization Level Enhancement
**Problem**: Token limits were too low (50-250), responses weren't detailed enough for professional game assistance  
**Solution**: Increased token limits to match GPT-3.5-turbo's 4096 max output:
- Level 1: 800 tokens
- Level 2: 1600 tokens  
- Level 3: 2400 tokens
- Level 4: 3200 tokens
- Level 5: 4096 tokens (maximum)

**Prompts updated** to explicitly request detailed, multi-paragraph responses with specific game mechanics, builds, tactics, boss strategies, etc.

#### Overlay UI Improvements
**Problem**: Response area too small, text hard to read  
**Solution**:
- Overlay window size: 550x450 → 650x600 pixels
- Response container min-height: 80px → 250px
- Font size: 0.95em → 1.05em
- Line height: 1.4 → 1.6
- Padding increased for better spacing

**Result**: Much more readable responses, especially for detailed 5-level answers (4096 tokens)

---

### 2026-02-05 (Evening → Night)

#### Updates (Feb 5, 2026 - Evening)

#### Issue 9: Draggable Overlay Implementation
**Goal**: Allow users to move overlay to avoid blocking gameplay  
**Solution Implemented**:
1. **Drag Handle** - Added centered top handle (☰ icon) with CSS:
  ```css
  .drag-handle {
    cursor: move;
    -webkit-app-region: drag; /* Electron window drag */
  }
  ```
2. **Position Persistence** - Save drag position to localStorage:
  ```javascript
  localStorage.setItem('overlayPositionX', x);
  localStorage.setItem('overlayPositionY', y);
  ```
3. **Load Saved Position** - On startup, restore saved coordinates:
  ```javascript
  overlayContainer.style.position = 'fixed';
  overlayContainer.style.left = savedX + 'px';
  overlayContainer.style.top = savedY + 'px';
  ```

**CRITICAL Lesson**: Position must be set on BOTH:
- CSS (`overlayContainer.style.left/top`) - for visual positioning
- Electron Window API (`overlayWin.setPosition(x, y)`) - for actual window position

**Why**: If only CSS is changed, drag works but window doesn't actually move. If only Electron API is used, position resets on reload.

#### Issue 10: Reset Layout Button Implementation
**Problem**: Users need to restore default overlay position/size after moving it  
**Failed Approach #1**: Just `location.reload()` - position stays dragged
**Failed Approach #2**: Reset CSS only - Electron window stays in wrong position
**Failed Approach #3**: Reset CSS + reload - still doesn't center

**Working Solution**:
1. Clear localStorage position data
2. Send IPC message to main process: `ipcRenderer.send('window-action', 'reset-position')`
3. Main process resets Electron window position:
  ```javascript
  case 'reset-position':
    const display = require('electron').screen.getPrimaryDisplay();
    const { width, height } = display.workAreaSize;
    const x = Math.round((width - 650) / 2);
    const y = Math.round((height - 600) / 2);
    overlayWin.setPosition(x, y);
    overlayWin.setSize(650, 600);
    break;
  ```
4. THEN reload page: `setTimeout(() => location.reload(), 100)`

**Key Insight**: Electron window position is controlled by main process, not renderer. Must use IPC to reset window coordinates.

#### Issue 11: Modal Button Text Consistency
**Problem**: Reset Layout confirmation showed "Delete" button (wrong context)  
**Solution**: Add optional parameter to `showConfirmModal()`:
```javascript
function showConfirmModal(title, message, onConfirm, confirmBtnText = null) {
  modalConfirm.textContent = confirmBtnText || t().btnDelete;
}

// Usage
showConfirmModal(t().confirmTitle, t().resetLayout, callback, t().btnReset);
```

**Translations Added**:
- `btnDelete`: For destructive actions (Clear History, Clear All Data)
- `btnReset`: For reset actions (Reset Layout)
- Properly translated in all 6 languages

**Lesson**: Generic modal dialogs need context-specific button text to avoid confusion.

#### Issue 12: Content Filter Gaming-Awareness
**Problem**: Filter blocked "kill", "weapon", "bomb" even in gaming context (Minecraft, FPS games)  
**Bad Implementation**: Blanket keyword blocking
```javascript
forbidden = ['kill', 'weapon', 'bomb'] // TOO STRICT
```

**Fixed Implementation**: Context-aware filtering
```javascript
forbidden = [
  'kill real people', 'real weapon', 'real bomb', // Real-world harm
  // Game terms like "kill mob", "craft weapon" are allowed
]
```

---

### 2026-05-08 (Evening)

#### Summary
- What changed: Split IPC handlers into focused modules and updated the refactor plan.
- Why: Phase 1 IPC extraction is complete and easier to maintain.
- Impact: register.js now delegates; IPC behavior unchanged; accidental map file removed.

#### Details
- Implementation notes: register.js keeps shared helper functions and wires overlay/detached/pinned/note/info/openai IPC modules.
- Edge cases: No functional changes intended; handler routing preserved.

#### Files touched
- [src/main/ipc/register.js](src/main/ipc/register.js)
- [src/main/ipc/overlay-ipc.js](src/main/ipc/overlay-ipc.js)
- [src/main/ipc/detached-ipc.js](src/main/ipc/detached-ipc.js)
- [src/main/ipc/pinned-ipc.js](src/main/ipc/pinned-ipc.js)
- [src/main/ipc/note-ipc.js](src/main/ipc/note-ipc.js)
- [src/main/ipc/info-ipc.js](src/main/ipc/info-ipc.js)
- [src/main/ipc/openai-ipc.js](src/main/ipc/openai-ipc.js)

#### Backups
- Created via scripts/make-backup.ps1 before changes
- Never auto-delete or prompt-delete anything from backups/

#### Verification
- npm run validate:games
- npm run check

#### Follow-ups
- TODO: Continue Phase 1 window/module extraction.

**Lesson**: Gaming AI assistant must distinguish between:
- ✅ In-game mechanics: "kill zombie", "craft sword", "build bomb in Minecraft"
- ❌ Real-world harm: "kill people", "build real bomb"

Add "real" prefix to forbidden terms to preserve gaming vocabulary.

---

### 2026-05-09 (Evening)

#### Summary
- What changed: Added a configurable game detection ignore list UI and context-aware error messages.
- Why: Reduce false game detections from non-game windows and make failures easier to understand.
- Impact: Game context is now user-tunable; renderer errors are localized and more actionable.

#### Details
- Added Settings UI for window-title ignore patterns (per-line, persisted, IPC-synced).
- Game detection now applies the ignore list and clears stale context when no match exists.
- Renderer maps common error codes/messages to translated status lines.

#### Files touched
- [overlay.html](overlay.html)
- [src/renderer/overlay/ui.js](src/renderer/overlay/ui.js)
- [src/renderer/overlay/translations.js](src/renderer/overlay/translations.js)
- [src/main/services/game-detect.js](src/main/services/game-detect.js)
- [src/main/ipc/overlay-ipc.js](src/main/ipc/overlay-ipc.js)
- [src/shared/ipc-channels.js](src/shared/ipc-channels.js)
- [src/shared/storage-keys.js](src/shared/storage-keys.js)

#### Backups
- Created via scripts/make-backup.ps1 before changes
- Never auto-delete or prompt-delete anything from backups/

#### Verification
- Tests not run (not requested)

#### Follow-ups
- Consider adding an optional “active window only” toggle for detection.

---

### 2026-05-09 (Night)

#### Summary
- What changed: Unified UI translations across overlay, main window, note/info, and pinned history; added runtime translation fallback for missing keys.
- Why: Remove drift between windows and ensure new UI strings are always translatable.
- Impact: One shared registry powers all UI text, with auto-fill for missing translations via OpenAI.

#### Details
- Added a shared UI registry + renderer helper with OpenAI translation fallback and local override cache.
- Migrated overlay, main settings, note/info, and pinned history to the shared bundle.
- Removed the legacy main-process UI label service and switched IPC payloads to language-only.

#### Files touched
- [src/shared/i18n/ui-text.js](src/shared/i18n/ui-text.js)
- [src/shared/i18n/renderer-i18n.js](src/shared/i18n/renderer-i18n.js)
- [index.html](index.html)
- [overlay.html](overlay.html)
- [src/renderer/overlay/translations.js](src/renderer/overlay/translations.js)
- [src/renderer/overlay/history.js](src/renderer/overlay/history.js)
- [note-panel.html](note-panel.html)
- [info-panel.html](info-panel.html)
- [pinned-history.html](pinned-history.html)
- [src/main/services/openai.js](src/main/services/openai.js)
- [src/main/ipc/openai-ipc.js](src/main/ipc/openai-ipc.js)
- [src/main/ipc/overlay-ipc.js](src/main/ipc/overlay-ipc.js)
- [src/main/index.js](src/main/index.js)

#### Backups
- Not created (work continued without new backup request)

#### Verification
- npm run check

#### Follow-ups
- Consider splitting UI registry by domain (overlay, detached, pinned, note/info).

---

### 2026-05-09 (Night)

#### Summary
- What changed: Split main-process registry into domain buckets and updated all consumers; tightened detached dock behavior and removed a race that caused duplicate header slots.
- Why: Improve maintainability of shared state and make dock/undock UX deterministic.
- Impact: Registry access is consistent across windows/IPCs/services; detached panels dock only via main header or dock button; no duplicate panel slots after re-detach.

#### Details
- Registry now uses domain-scoped buckets: core/overlay/game/detached/pinned/note/info, with updates across window managers, IPC modules, and services.
- Detached docking uses header-only dock rects and requires real pointer movement before drop.
- Fixed DETACHED_PANEL_SHOWN race by always honoring the event, even if it arrives before pending state is set.

#### Files touched
- [src/main/state/registry.js](src/main/state/registry.js)
- [src/main/windows/overlay.js](src/main/windows/overlay.js)
- [src/main/windows/detached.js](src/main/windows/detached.js)
- [src/main/windows/detached-visibility.js](src/main/windows/detached-visibility.js)
- [src/main/windows/detached-state.js](src/main/windows/detached-state.js)
- [src/main/windows/pinned.js](src/main/windows/pinned.js)
- [src/main/windows/note.js](src/main/windows/note.js)
- [src/main/windows/info.js](src/main/windows/info.js)
- [src/main/windows/main-window.js](src/main/windows/main-window.js)
- [src/main/ipc/overlay-ipc.js](src/main/ipc/overlay-ipc.js)
- [src/main/ipc/detached-ipc.js](src/main/ipc/detached-ipc.js)
- [src/main/ipc/pinned-ipc.js](src/main/ipc/pinned-ipc.js)
- [src/main/ipc/note-ipc.js](src/main/ipc/note-ipc.js)
- [src/main/ipc/info-ipc.js](src/main/ipc/info-ipc.js)
- [src/main/ipc/register.js](src/main/ipc/register.js)
- [src/main/services/openai.js](src/main/services/openai.js)
- [src/main/services/game-detect.js](src/main/services/game-detect.js)
- [src/main/index.js](src/main/index.js)
- [src/renderer/overlay/detach.js](src/renderer/overlay/detach.js)

#### Backups
- Not created (targeted edits only)

#### Verification
- Tests not run (not requested)

#### Follow-ups
- TODO: Run `npm run check` before release.

---

### 2026-05-09 (Night)

#### Summary
- What changed: Pruned and minified the offline IGDB dataset; updated the build script and added a local prune script.
- Why: Reduce dataset size and load cost while preserving match quality.
- Impact: data/games.json is substantially smaller and quicker to load, with validation still passing.

#### Details
- Added alias/keyword caps, length filters, and common-term removal to keep signal-heavy tokens.
- Build now drops unused summary fields and writes a minified dataset.
- Added a local prune script for existing datasets without IGDB credentials.
- Size delta: 6,781,184 → 1,214,098 bytes (~82% smaller).

#### Files touched
- [scripts/build-igdb-dataset.js](scripts/build-igdb-dataset.js)
- [scripts/prune-games-dataset.js](scripts/prune-games-dataset.js)
- [data/games.json](data/games.json)
- [docs/3-overview/TODO.md](docs/3-overview/TODO.md)

#### Backups
- Not created (targeted edits only)

#### Verification
- npm run validate:games

#### Follow-ups
- Consider optional gzip packaging for distribution builds.

---

### 2026-05-09 (Night)

#### Summary
- What changed: Added basic unit tests for core game detection paths and wired the Node test runner.
- Why: Establish a minimal safety net for critical detection logic.
- Impact: Quick regression checks are now available via `npm test`.

#### Details
- Added `node --test` runner to package scripts.
- Covered dataset match, ignore list, regex fallback, and preferred display selection.

#### Files touched
- [package.json](package.json)
- [tests/game-detect.test.js](tests/game-detect.test.js)
- [docs/3-overview/TODO.md](docs/3-overview/TODO.md)

#### Backups
- Not created (targeted edits only)

#### Verification
- npm test

#### Follow-ups
- Consider adding IPC error mapping tests and dataset prune coverage.

---

### 2026-05-10 (Evening)

#### Summary
- What changed: Removed the legacy widget manager system, consolidated layout state under blocks, and refreshed docs to reflect the block-based UI.
- Why: Widgets were superseded by movable blocks + block windows, and the remaining code paths caused maintenance overhead.
- Impact: Cleaner IPC/state wiring, fewer unused files, and documentation aligned with the current block layout.

#### Details
- Dropped widget IPC channels, window managers, and renderer helpers.
- Added legacy free-layout migration to the block layout key.
- Removed widget-specific CSS and i18n strings.
- Updated overview/changelog/audit docs to reflect block layout and cleanup.

#### Files touched
- [src/main/index.js](src/main/index.js)
- [src/main/windows/overlay.js](src/main/windows/overlay.js)
- [src/main/windows/main-window.js](src/main/windows/main-window.js)
- [src/main/app/hotkeys.js](src/main/app/hotkeys.js)
- [src/main/app/lifecycle.js](src/main/app/lifecycle.js)
- [src/main/ipc/overlay-ipc.js](src/main/ipc/overlay-ipc.js)
- [src/main/ipc/register.js](src/main/ipc/register.js)
- [src/shared/ipc-channels.js](src/shared/ipc-channels.js)
- [src/shared/storage-keys.js](src/shared/storage-keys.js)
- [src/shared/i18n/ui-text.js](src/shared/i18n/ui-text.js)
- [src/renderer/overlay/blocks.js](src/renderer/overlay/blocks.js)
- [src/renderer/overlay/blocks-window.js](src/renderer/overlay/blocks-window.js)
- [overlay.css](overlay.css)
- [README.md](README.md)
- [docs/3-overview/TODO.md](docs/3-overview/TODO.md)
- [docs/3-overview/CHANGELOG.md](docs/3-overview/CHANGELOG.md)
- [docs/2-technical/AUDIT_REPORT.md](docs/2-technical/AUDIT_REPORT.md)

#### Backups
- Not created (targeted edits only)

#### Verification
- Tests not run (not requested)

#### Follow-ups
- Consider running `npm run check` before release.

---

### 2026-05-10 (Night)

#### Summary
- What changed: Added a dedicated TTS volume slider to the overlay and aligned volume limits across UI and IPC.
- Why: The existing speech slider was mislabeled and mixed rate/volume behavior.
- Impact: Users can control TTS volume consistently, and the value stays within 0-100.

#### Details
- Added overlay-side volume UI and storage syncing.
- Clamped volume to 0-100 in main and renderer.
- Synced the main settings slider and overlay on open.

#### Files touched
- [overlay.html](overlay.html)
- [overlay.css](overlay.css)
- [src/renderer/overlay/ui.js](src/renderer/overlay/ui.js)
- [src/renderer/overlay/ipc.js](src/renderer/overlay/ipc.js)
- [src/main/ipc/overlay-ipc.js](src/main/ipc/overlay-ipc.js)
- [index.html](index.html)
- [docs/3-overview/TODO.md](docs/3-overview/TODO.md)
- [docs/3-overview/CHANGELOG.md](docs/3-overview/CHANGELOG.md)

#### Backups
- Not created (targeted edits only)

#### Verification
- Tests not run (not requested)

#### Follow-ups
- Consider separating speech rate vs volume if needed in the future.

---

#### Issue 13: Game Context Detection (Feb 5, 2026 Evening)
**Feature**: Auto-detect what game the user is playing and hyper-focus AI responses

**Implementation**:
1. **Package**: `active-win` (detects active window title)
2. **Trigger**: When hotkey pressed, query active window
3. **Game extraction**: Pattern matching against 30+ known games + Steam/Epic detection
4. **Context injection**: Add to system prompt: `"User is playing [GAME]. Focus ALL answers on this game only."`

**Code Flow**:
```javascript
// main.js - hotkeyCallback
const window = await activeWin();
const gameName = extractGameName(window.title); // "Terraria", "Counter-Strike 2", etc
overlayWin.webContents.send('set-game-context', gameName);

// overlay.html - process-text
ipcRenderer.invoke('process-text', text, lang, level, screenshot, currentGameContext);

// main.js - process-text handler
if (gameContext) {
  systemPrompt += `Focus ALL answers specifically on "${gameContext}"`;
}
```

**Benefits**:
- ✅ No generic "gaming tips" - AI knows exact game
- ✅ Accurate item names, boss mechanics, meta strategies
- ✅ Game-specific patch knowledge (e.g., CS2 vs CS:GO differences)
- ✅ Better UX - user doesn't need to specify game in every question

**Security Note**: `active-win@7.7.2` installed with `npm audit fix --force` to eliminate 6 high severity vulnerabilities (tar, node-gyp dependencies). Production-ready security is mandatory for customer distribution.

---

#### Code Organization & Refactoring Strategy

##### Current File Sizes (Feb 5, 2026)
- `overlay.html`: ~1946 lines (CSS ~700, HTML ~100, JS ~1100)
- `main.js`: ~729 lines
- **Status**: ✅ MANAGEABLE - No immediate refactoring needed

##### When to Refactor?
**DO NOT refactor until:**
- Any file exceeds **2500+ lines**
- **3+ developers** working on the same file
- Need to write **unit tests** for isolated logic
- Multiple overlay types needed (game-specific overlays)

**Current approach is GOOD because:**
- Fast load time (no module bundler needed)
- Simple debugging (one file = one context)
- Quick iteration (no build step)
- Electron handles single-file overlay efficiently

##### Future Refactoring Plan
**When file size becomes unmanageable (2500+ lines), use this structure:**

```
src/
├── main/
│   ├── index.js              # Main process entry
│   ├── handlers/
│   │   ├── ipc-handlers.js   # IPC message handlers
│   │   ├── hotkey-handlers.js # Global hotkey logic
│   │   └── window-manager.js # Overlay window lifecycle
│   └── utils/
│       └── openai-client.js  # OpenAI API wrapper
├── renderer/
│   ├── overlay.html          # HTML structure only
│   ├── styles/
│   │   ├── base.css          # Global styles
│   │   ├── components.css    # Tab, modal, button styles
│   │   └── animations.css    # Transitions, effects
│   └── scripts/
│       ├── ui.js             # UI state management
│       ├── translations.js   # 6-language system
│       ├── modal.js          # Custom modal logic
│       ├── tabs.js           # Tab switching & pinning
│       ├── history.js        # Conversation history
│       └── drag.js           # Draggable overlay logic
└── shared/
   └── constants.js          # Shared constants (token limits, etc)
```

**Build Tool (if refactoring):**
- Use **Vite** or **esbuild** (fast, modern)
- Avoid Webpack (too complex for Electron)
- Keep build step minimal

**Migration Strategy:**
1. Move CSS to separate files first (low risk)
2. Extract JavaScript modules one at a time
3. Test after each extraction
4. Keep HTML as single file longest (it's smallest)

**CRITICAL**: Only refactor when absolutely necessary. Over-engineering creates more bugs than it solves.

---

#### TODO for Next Session

##### ✅ COMPLETED (Feb 5, 2026 Evening)
1. ~~Draggable Overlay Elements~~ - DONE
2. ~~Reset Layout Button~~ - DONE
3. ~~History/conversation memory~~ - DONE
4. ~~Game-Specific Context Detection~~ - DONE (active-win, 30+ games supported)
5. ~~Security audit fix~~ - DONE (0 vulnerabilities, production-ready)
6. ~~Automated Bug Checker~~ - DONE (bug-checker.js, detects 10+ anti-patterns)

##### Priority 1: Fix History Viewing (Inline Expansion)
✅ **Completed on 2026-02-06** — history now expands inline; details in the "Feb 6, 2026 - Inline History Expansion" section.
**Current Problem**: Click on history item opens broken popup that freezes game
**Solution**: Replace popup with inline expansion in history list
- Click history item → expand full content below preview
- No new windows, no focus stealing
- Scroll within history tab to view full conversation
- Simple toggle (click again to collapse)

**Implementation Plan**:
1. Remove `createHistoryPopupWindow()` function entirely
2. Add `.history-full` div to each history item (display: none by default)
3. Toggle `display: block` on click
4. Add collapse animation
5. Test with borderless/fullscreen games

---

#### Late Evening (Session 2) → Night

#### Updates (Feb 5, 2026 - Evening Session 2)

##### UI Refactor: Compact Collapsible Layout
**Problem**: Overlay was 650x600, taking up half the screen in games like Terraria
**Solution**: Replace tab-based layout with horizontal collapsible sections

**Changes Made**:
1. **HTML Structure**:
  - Removed: Tab buttons (`.tab-btn`) and tab containers
  - Added: Collapsible sections (`.collapsible-section`) for Ask, History, Settings
  - Each section has header with toggle button (▼ icon)
  - Content hidden by default, expands on click

2. **CSS Layout**:
  - Changed from flex column to CSS Grid (3 columns)
  - Sections displayed horizontally: `grid-template-columns: 1fr 1fr 1fr`
  - Each section takes 1/3 of width
  - Smooth expand/collapse: `max-height: 0` → `max-height: 800px`
  - Header padding reduced: 16px → 14px, font: 1em → 0.95em

3. **Window Size**:
  - Old: 650x600 (portrait)
  - New: 1100x500 (wider, shorter)
  - Fits comfortably on side of game without covering gameplay

4. **JavaScript**:
  - Added `toggleSection(headerBtn)` function
  - Toggles `.open` class on content and toggle icon
  - Icon rotates on expand (▼ → ▲)

**Benefits**:
- ✅ Compact height (500px instead of 600px)
- ✅ No content bleeding down screen
- ✅ All sections visible at once
- ✅ Smooth expand/collapse animations
- ✅ Still responsive to game overlay

**Code Pattern** (collapsible sections):
```html
<div class="collapsible-section">
  <button class="section-header" onclick="toggleSection(this)">
   <span>💬 Ask</span>
   <span class="section-toggle">▼</span>
  </button>
  <div class="section-content">
   <div class="section-content-inner">
    <!-- Content here, only visible when expanded -->
   </div>
  </div>
</div>
```

**Testing**:
- ✅ App starts without errors
- ✅ 3 sections visible and functional (Ask, History, Settings)
- ✅ Sections expand/collapse smoothly
- ✅ Duplicate "AI answer read-aloud" removed
- ✅ Single screenshot delete button
- ✅ Clean header layout (drag handle + X button)
- ✅ All buttons functional

#### Issue 15: Orphan Event Handler Bug (Feb 5, 2026 Night) ⚠️ CRITICAL
**Symptom**: After removing HTML element, all buttons stopped working
**Root Cause**: JavaScript still had event handler for deleted element
```javascript
// HTML removed this:
// <button class="clear-all-btn" id="clearAllBtn">🗑️</button>

// But JavaScript still had:
document.getElementById('clearAllBtn').onclick = () => { clearAll(); };
// This throws TypeError when overlay loads
// Error prevents rest of handlers from registering (closeBtn, etc.)
```

**Why This Broke Everything**:
- JavaScript executes top-to-bottom during page load
- Handler for `clearAllBtn` tries to run, element doesn't exist
- Throws error: "Cannot read property 'onclick' of null"
- Error bubbles up, prevents subsequent handler registration
- Result: closeBtn, micBtn, etc. never get handlers attached
- Symptom looks like "all buttons broken" but really it's cascading error

**The Fix**:
- Removed the orphan handler from JavaScript
- Verified all remaining handlers have corresponding HTML elements
- Added orphan detection to bug-checker.js

**Prevention for Future**:
1. **After HTML changes**: Search JavaScript for deleted element IDs
2. **Use defensive patterns**:
  ```javascript
  // Good: Check existence
  const btn = document.getElementById('clearAllBtn');
  if (btn) {
    btn.onclick = () => { clearAll(); };
  }
   
  // Better: Event delegation
  document.addEventListener('click', (e) => {
    if (e.target.id === 'clearAllBtn') { clearAll(); }
  });
  ```
3. **Before committing**: `npm run check` catches orphan handlers

**Lesson**: NEVER assume HTML elements exist. Always:
- ✅ Verify element in HTML matches JavaScript reference
- ✅ Use existence checks: `if (element) { ... }`
- ✅ Test after any HTML modifications
- ✅ Run bug checker to catch orphans

#### Issue 16: Cleanup Script Deleting Wrong Things (Feb 5, 2026 Night) 🚨 CRITICAL MISTAKE
**What Happened**: Cleanup script accidentally deleted fresh v4 backups
**Why This Was Bad**: Lost the latest working version just before a major refactor
**Root Cause**: Script was designed to delete backup files when it SHOULD delete dead code in source

**The Mistake**:
- Purpose: Remove old, unused code from active files
- Actual behavior: Deleted `.backup` files (which are recovery versions!)
- User should have been warned: "Don't touch backup files, only clean source code"

**Correct Philosophy**:
```
❌ WRONG: Delete backup files (lose recovery points)
✅ RIGHT: Clean up dead code IN SOURCE FILES (commented blocks, orphan handlers, etc.)
```

**The Fix**:
- Modified cleanup.js to NEVER ask about backup deletion
- Changed behavior: Only report backup existence (informational)
- Message: "Backup files are preserved. Only delete manually if you're sure."

**What Cleanup SHOULD Do**:
1. Find commented-out code blocks (>5 lines) in .js/.html
2. Detect orphan event handlers (getElementById without corresponding HTML)
3. Find unused CSS classes (defined but never used)
4. Report old TODO comments (>1 month old)
5. DO NOT touch .backup files - ever!

**Lesson for Future**:
- ✅ Backup files are PRECIOUS - always preserve them
- ✅ Cleanup dead code from source, not backups
- ✅ When in doubt, keep backups
- ✅ Never auto-delete or prompt-delete any files from `backups/`

#### Issue 14: History Popup - Fatal Design Flaw (Feb 5, 2026 Night) ⚠️ ABANDONED
**Symptom**: 
- Mouse clicks on popup passthrough to game
- Game freezes when popup receives focus (borderless windowed mode)
- Fullscreen games minimize to taskbar when popup appears

**Root Cause**: **FUNDAMENTAL INCOMPATIBILITY** between gaming overlays and focusable popups
- `alwaysOnTop: true` + `focusable: true` = **GAME LOSES FOCUS**
- Borderless/fullscreen games **cannot tolerate focus loss** without freezing/minimizing
- Transparent windows + click events = unreliable hit-testing in Electron

**Failed Attempts** (All architecturally flawed):
1. ❌ Independent BrowserWindow popup - Games freeze when popup gets focus
2. ❌ `pointer-events: auto` CSS - Click-through persists randomly
3. ❌ `focusable: true` - Game freezes
4. ❌ `focusable: false` - Buttons unclickable
5. ❌ `setIgnoreMouseEvents()` - API doesn't exist on webContents
6. ❌ `sandbox: true/false` - No effect on focus issues

**Why Popup Windows DON'T Work for Gaming**:
```javascript
// THIS ARCHITECTURE IS BROKEN FOR GAMES
historyPopupWin = new BrowserWindow({
  alwaysOnTop: true,  // Required to stay visible over game
  focusable: true,    // Required for buttons to work
  // ⚠️ PROBLEM: Game loses focus when user clicks popup
  // → Borderless games freeze
  // → Fullscreen games minimize
});
```

**The Real Problem**:
- Gaming overlays MUST be `focusable: false` (to not steal game focus)
- But interactive elements (buttons, inputs) REQUIRE focus to work
- **This is an unsolvable contradiction** in Electron's window model

**Correct Solution**: ✅ **INLINE EXPANSION** (not separate window)
```html
<!-- History list in main overlay -->
<div class="history-item" onclick="expandHistoryInline(index)">
  <div class="history-preview">Question preview...</div>
  <!-- Expanded content shows inline, no new window -->
  <div class="history-full" style="display: none">
   Full question and answer here...
  </div>
</div>
```

**Benefits of Inline Expansion**:
- ✅ No focus stealing (stays in non-focusable overlay)
- ✅ No game freezing
- ✅ Reliable click events (same window)
- ✅ Simple architecture (no IPC, no separate windows)
- ✅ Works with fullscreen/borderless games

**Lesson Learned**: 
**NEVER create focusable popup windows in gaming overlays.** The `alwaysOnTop + focusable` combination is fundamentally incompatible with gaming. All interactive UI must be inline within the non-focusable main overlay window.

**Pattern to Remember**:
```
❌ BAD: Main overlay (focusable: false) → Popup window (focusable: true)
✅ GOOD: Main overlay (focusable: false) → Inline expanded content
```

#### Priority 1: Visual Polish for Release
**Goal**: Customer-facing UI improvements
- Game name display in overlay (show detected game)
- Loading states & animations (better feedback)
- Error handling messages (user-friendly, translated)
- Settings validation (prevent invalid inputs)
- **Fix persistent click-through issues** if they resurface (test with multiple games)

#### Priority 2: Advanced Features
- Screenshot annotations (draw on screenshots before sending)
- Multi-monitor support (open overlay on active screen)
- Hotkey customization UI (not just Settings tab)
- Game profile presets (save specialized prompts per game)

#### Priority 3: Distribution Prep
- Installation wizard / setup guide
- First-run tutorial overlay
- API key setup wizard (user-friendly onboarding)
- Crash reporting & telemetry (opt-in, privacy-respecting)
- Update checker & auto-updater

**Backups**: Game context feature backups in backups/ folder
**Rollback Protocol**: If any rollback is required, restore directly from the freshest timestamped copies inside backups/ (generated via scripts/make-backup.ps1). Always pick the most recent backup for each file (main.js, overlay.html, index.html, etc.) before touching older versions.

---

#### Session Summary (Feb 5, 2026 Evening)

**Major Features Implemented**:
1. ✅ Whisper Audio STT (replaced broken Web Speech)
2. ✅ Early game detection (app start → detection)
3. ✅ Responsive game refresh (hotkey + overlay show)
4. ✅ Collapsible sections UI (compact layout)
5. ✅ History persistence (localStorage)
6. ✅ Specialized slider integration (audio + text)
7. ✅ File nesting in VS Code Explorer

**Bugs Fixed**:
- ✅ Orphan event handlers cascading failure
- ✅ Web Speech API network dependency
- ✅ Null game detection on startup
- ✅ Modal duplication (confirmModal appearing twice)
- ✅ Tab button references in removed UI
- ✅ History rendering not called on load

**Quality Improvements**:
- ✅ bug-checker.js with 10+ patterns
- ✅ cleanup.js (backup-safe)
- ✅ Debug logs cleaned up
- ✅ Game detection refactored
- ✅ Code logging strategy established

**Next Session TODO**:
- [x] Replace history popup with inline expansion (Feb 6, 2026)
- [ ] Fix 11 IPC listener duplications
- [ ] Add missing translation (1 occurrence)
- [ ] Add error handling to IPC calls
- [ ] Test in-game with Terraria full session
- [ ] Performance profiling (CPU/Memory)

---

#### Project Architecture Audit Summary (Feb 5, 2026)

Short summary (as of Feb 5):
- Electron overlay + OpenAI (Whisper + GPT + Vision) architecture is production-viable with the current safety and window-management patterns.
- Biggest engineering risks/backlog: keyboard accessibility, contextual error messages, and keeping IPC handlers non-duplicated and well-scoped.
- Deployment readiness was considered "code-ready" but tooling steps (installer/signing) were still pending.

---

### 2026-04-07 (Evening)

#### Summary
- What changed: Added an offline IGDB dataset builder and dataset-backed text game detection with fuzzy fallback; sanitized dataset output; trimmed dataset fields; loosened strict policy for ambiguous game questions.
- Why: Remove reliance on active window detection, avoid hardcoded term drift, reduce false refusals, and fix editor warnings from unusual Unicode characters.
- Impact: Game context can be inferred from text, fewer short-name false positives, and offline dataset remains safe to ship.

#### Details
- Implementation notes: Added `scripts/build-igdb-dataset.js` and `npm run build:games` to generate `data/games.json` (5000 games). Matching now scores name/aliases/keywords, uses fuzzy Levenshtein fallback, and blocks short-name substring matches unless a full token is present.
- Edge cases: Short titles like "Fe" and "Z" must match as full tokens; dataset output strips LS/PS, zero-width, bidi, and control characters; fallback to regex list if dataset is missing.

#### Files touched
- [scripts/build-igdb-dataset.js](scripts/build-igdb-dataset.js)
- [data/games.json](data/games.json)
- [src/main/services/game-detect.js](src/main/services/game-detect.js)
- [src/main/services/openai.js](src/main/services/openai.js)
- [package.json](package.json)

#### Backups
- Not created (dataset/script updates only).

#### Verification
- `npm run build:games` generated the offline dataset.
- Manual text prompts confirmed the short-name false-positive path and validated the token-only fix.

#### Follow-ups
- TODO: reduce dataset size further (minify/prune/gzip).
- Optional: add debug logging for top match scores during testing.

---

### 2026-02-06 (Daytime → Evening)

#### Pinned Windows, Overlay Bring-to-Front, Snap Resize, Click-Through, PowerShell Wildcard Fix (Detailed Development Log)

##### 1. Pinned History Panels → Separate Overlay Windows
- Original: Pinned boxes were DOM elements, limited to the overlay window bounds.
- New: Dragging out a history item immediately creates a new, always-on-top, transparent BrowserWindow (pinned-history.html) that can be moved and resized anywhere on any monitor, independent of the overlay.
- During drag-out, the pinned window is click-through (setIgnoreMouseEvents(true)) so it cannot steal pointer capture; interactivity is re-enabled at drag end.
- Drag math: absolute screenX/screenY + stable grab offset (PULL_OUT_GRAB_OFFSET_X=210, Y=18), so the cursor always “grabs” the panel at the center.
- Edge case: If you drag beyond the overlay, there is no clipping, since it is a real window, not a DOM ghost.
- Pinned windows are destroyed on overlay/app close (closeAllPinnedHistoryWindows), so no “zombie” windows remain after crash or exit.

##### 2. Drag/Resize/Snap Architecture
- All drag/resize operations are rAF-throttled, fire-and-forget IPC (pinned-history-move, pinned-history-set-bounds) to avoid lag/jitter.
- Resize: Each window has left/right/bottom/corner resize handles, pointer-capture, min/max size clamp, and snap sizing (preset width/height list, threshold: 16px).
- Snap sizing: On resize release, if the size is close to a predefined value, it snaps automatically (e.g., 420x300, 360x220, 320x180).
- Edge case: Left-edge resize preserves the right edge, so the panel does not “jump.”

##### 3. Overlay Bring-to-Front, Hotkey Logic
- Overlay “Overlay” button and hotkey (Ctrl+Shift+K) always bring the overlay to the front (showOverlayAndRaise: reassert topmost, moveTop, showInactive), even if already visible.
- Only a second hotkey press (within a short window) hides the overlay (OVERLAY_HIDE_WINDOW_MS=1400ms), so you never need a “double” shortcut if a game pushes the overlay behind.
- Overlay is always centered on the detected game’s monitor (tryGetDisplayForGameWindow), using PowerShell window bounds, or falls back to the cursor display.
- Edge case: In fullscreen games, the overlay does not steal focus (showInactive), so it never freezes the game.

##### 4. Click-Through, Pointer Capture, Interactivity
- setIgnoreMouseEvents(allowThrough, { forward: true }) is used for all overlay/pinned windows, so empty areas are always click-through.
- “Force interactive” counter: During drag/resize, the window never gets stuck in click-through mode; pointer-capture ensures reliability.
- Hover-based interactivity: Only real UI elements are interactive; empty overlay is always click-through.
- Edge case: If pointerleave does not trigger (e.g., overlay is hidden quickly), forceInteractiveCount is reset at every drag/resize end.

##### 5. PowerShell Wildcard-Free Window Search
- get-window-bounds.ps1: Uses $title.IndexOf($needle, OrdinalIgnoreCase) instead of -like, so TitleContains with special characters ([], *, ?) is robust and never matches as a wildcard.
- Fully PowerShell 5.1 compatible: no ??, $null comparison style fixed.
- Edge case: If no match, returns {}, never throws an error.

##### 6. Bug Checker, Backup Policy, Cleanup
- bug-checker.js: Detects 12+ architecture anti-patterns (focusable popup, duplicate hotkey, missing translation, native dialog, IPC duplication, etc.).
- cleanup.js: Lists backup files and dead code, but never deletes backups automatically (backups/ are sacred, only manual deletion allowed).
- All backups are timestamped; always restore the freshest before rollback.
- Edge case: When restoring from backup, never overwrite a working file unless you are sure it is the latest.

##### 7. Standards, Best Practices
- All user-facing text must be translated to 6 languages (uiText: hu, en, de, ru, fr, zh); new UI elements must follow this rule.
- Custom modal dialogs are mandatory; never use native confirm/alert/prompt.
- High-frequency IPC (move/resize) must be fire-and-forget, rAF-throttled.
- All window bounds are always clamped to the visible work area.
- Always create a backup before any new feature (scripts/make-backup.ps1).

---

#### Bugfixes (Table)

| Date        | Bug Summary                              | Cause/Edge Case                | Solution/Patch                                                                 |
|-------------|------------------------------------------|-------------------------------|--------------------------------------------------------------------------------|
| 2026-02-06  | Pinned window not movable outside overlay | DOM limit, overlay clipping   | Separate BrowserWindow, absolute screen drag, click-through drag-out           |
| 2026-02-06  | Drag jitter/lag                          | IPC roundtrip, no throttling  | rAF-throttled fire-and-forget IPC, absolute coordinate drag                    |
| 2026-02-06  | Empty overlay area blocks clicks         | No hover detection            | setIgnoreMouseEvents(allowThrough, {forward:true}), hover-based interactivity  |
| 2026-02-06  | Pinned windows not closed on app exit    | Orphan window, crash          | closeAllPinnedHistoryWindows() on all exit/close paths                         |
| 2026-02-06  | Drag-out “clips” the panel               | DOM ghost clipping            | Immediate new window, absolute drag                                            |
| 2026-02-06  | Drag-out “drops” on first grab           | Pointer capture, window focus | Drag-out is click-through, pointer capture, interactivity re-enabled at end    |
| 2026-02-06  | Text selection during drag-out           | Missing user-select: none     | body.pulling-history class, user-select: none during pointermove               |
| 2026-02-06  | Drag-out grab point misaligned           | Offset not centered           | PULL_OUT_GRAB_OFFSET_X=210, Y=18, absolute center                              |
| 2026-02-06  | Pinned resize not working                | DragOutMode not exiting       | dragOutMode → dragging:false IPC, click-through reset                          |
| 2026-02-06  | Content disappears after resize          | Partial update wipe           | applyPayload only overwrites existing properties                               |
| 2026-02-06  | No snap sizing on resize                 | Missing snap threshold        | Snap sizing: preset width/height, threshold 16px                               |
| 2026-02-06  | Overlay only shows via shortcut          | Missing showOverlayAndRaise   | open-overlay always calls showOverlayAndRaise, hotkey raise-first logic        |
| 2026-02-06  | PowerShell script “??” error             | PS 7 only nullish coalescing  | Replaced ?? with $null check, VS Code reload clears error                      |
| 2026-02-06  | TitleContains wildcard bug               | -like wildcard                | IndexOf(needle, OrdinalIgnoreCase), all characters stable                      |

---

#### Lessons Learned, “Why This Way”
- Anything that must move outside the overlay should be a separate window, not a DOM ghost.
- Drag/resize must be rAF-throttled, otherwise lag/jitter and IPC backlog occur.
- Click-through should be the default; only real UI elements should be interactive.
- Pointer capture and forceInteractiveCount are essential for reliable drag/resize.
- PowerShell window search must always avoid wildcards; use contains check only.
- Never auto-delete backups; always use the freshest for rollback.
- Before any new UI/feature: backup, translation, custom modal, clamp, fire-and-forget IPC.

---

#### Feb 6, 2026 Overlay Popup Rebuild

##### What Changed
- Overlay container now stays compact (≈80px) and only shows the header row by default; the previous full body background no longer expands when a panel opens.
- Each primary section (Ask, History, Settings) opens as a floating popup that is rendered inside `#floating-panels`, clamped to the viewport, and follows its anchor while resizing the overlay.
- Popup content uses flex layouts with dedicated bottom resize grips so users can drag each panel taller/shorter independently without affecting the other sections.
- RequestAnimationFrame batching replaced the old resize throttler, and per-frame bounds diffing prevents IPC spam/jitter during edge drags.
- Reload guard resets every popup to a clean state so stale floating panels do not linger after `Ctrl+R`.

##### Bugs Fixed by the Rebuild
1. **Jitter & backfire while resizing from the left edge** – solved by batching IPC updates, rounding all bounds to whole pixels, and decoupling layout from the container height.
2. **Full-body reflow when opening a section** – floating popups render outside the flex row, so expanding Ask no longer shoves History/Settings downward.
3. **Popup remnants after closing/reload** – cleanup logic now reattaches content to its home section, resets styles, and clears cached references so panels truly disappear.
4. **Bottom handle unreachable** – individual popup resize grips keep the grab area visible even at minimum overlay height, while the header no longer exposes an unused bottom drag.

##### Known Follow-Up Issues
- **Popup sizing persistence**: custom heights are session-only; decide whether to store per-section height and restore on reopen.
- **Keyboard accessibility**: the new floating popups rely on mouse/touch input; we still need focus traps and ESC-to-close handling.
- **Responsive limits**: `min-width: 240px` per header pill can overflow on sub-800px screens; evaluate a stacked/mobile layout before shipping.
- **Translation sweep**: new UI text (e.g., resize tooltip/help copy if added) must follow the 6-language policy when finalizing UX microcopy.

##### Feb 6, 2026 Popup Height Fixes
- **Context**: The Settings floating panel kept attaching to the top of the viewport unless the user manually dragged the bottom handle first.
- **Cause**: We only compared popup height to a blanket 500px max, so tall sections tried to render below their toggle even when there was not enough available space. The first measurement overshot the viewport and triggered an aggressive flip-to-top.
- **Fix**: On every `positionPopup()` call we now compute free space above and below the anchor, clamp `maxHeight` to that space, and only flip the panel when the upper area actually offers more room. We also reset `height`/`maxHeight` when floating a panel to avoid stale manual resize values.
- **Lesson**: Floating UIs must anchor relative to real-time viewport space, not static defaults. Always reclaim the natural height before re-measuring, and keep the default overlay size (1100×500) in sync with main-process bounds logic so drag limits, popup math, and "Reset layout" continue to agree.

### Feb 6, 2026 Resize Instability Post-Mortem
- **Instability introduced afterwards**: Pointer-based and "virtual bounds" experiments caused the overlay window to snap off-screen the moment a resize handle was grabbed; neither the screen guard nor reset logic could recover it. Additional clamp attempts made the window jump as soon as the user clicked, effectively bricking the UI.
- **Action**: Revert to the stable 18:14 backup and only tweak jitter with microscopic, isolated patches (e.g., rounding logic on the left edge) so regressions stay easy to rollback.
- **Lesson**: Any change that touches overlay size/position must ship in tiny, self-contained increments, and if the window ever disappears the workflow is: immediate rollback + document the failure before attempting another experiment.

### Feb 6, 2026 - IPC Handler Dedup + Renderer Safety

- `registerIpcHandlers()` centralizes every `ipcMain.handle` and is invoked exactly once during startup in [main.js](main.js#L29-L265), so IPC listeners no longer stack up after hot reloads or window recreation.
- Renderer processes now route all IPC calls through `invokeMain`/`fireAndForget` while DOM listeners go through the null-safe `on()` helper in [overlay.html](overlay.html#L1175-L1215), preventing unhandled promise rejections and "orphan handler" warnings.
- The localization table in [overlay.html](overlay.html#L1395-L1685) gained dedicated keys for status resets, screenshot progress, history export, and audio errors, ensuring `status.textContent` never hard-codes untranslated strings.
- `npm run check` (bug-checker) is green again, which keeps the architecture gate in place for future IPC or localization regressions.

---

#### Feb 6, 2026 - Overlay Drag Handle & Layout Polish

### What Was Fixed

1. **Drag Handle Non-Functional** ⭐
  - **Symptom**: Drag handle visible but unresponsive; overlay could not be moved
  - **Root Cause**: CSS `-webkit-app-region: drag` but no JS fallback; `pointer-events: none` blocking clicks
  - **Solution**: Added manual `pointerdown/move/up` listeners, enabled `pointer-events: auto`, set `touch-action: none`
  - **Result**: ✅ Drag works via JS fallback

2. **Click-Through Stuck "ON"**
  - **Symptom**: Overlay intercepted all clicks even when hidden
  - **Root Cause**: No hover detection; toggle was one-shot
  - **Solution**: Global pointer tracking, OFF on enter / ON on leave
  - **Result**: ✅ Clicks pass to background when mouse leaves

3. **Overlay Container Too Large**
  - **Symptom**: Huge empty space; container expanded to full window
  - **Root Cause**: `#overlay-container` with width/height: 100%
  - **Solution**: Changed to `width: auto; height: auto;` (shrink-wrap)
  - **Result**: ✅ Compact overlay

4. **Drag Handle Visual Prominence**
  - **Symptom**: 380px × 36px handle too large
  - **Solution**: Reduced to `min(380px, calc(100% - 48px))`
  - **Result**: ✅ Visually refined

5. **Polygon Header Attempt** 🔴
  - **Issue**: CSS context mismatch after wrapper restructure
  - **Lesson**: HTML refactoring invalidates CSS patch contexts (see below)

### ⚠️ Critical Learning: CSS Context Matching After Structural Changes

**The Problem**: HTML refactoring (adding wrappers) breaks CSS patch oldString matching.

**Root Cause Example**:
- Before: `<div id="overlay-container"><div class="sections-container">`
- After: `<div class="overlay-shell"><div id="overlay-container"><div class="sections-container">`
- CSS patch looking for `.sections-container { ... }` fails because context changed

**Solution Pattern**:
1. Plan HTML structural changes first
2. Execute all HTML refactoring together
3. Re-read CSS file to extract updated contexts
4. Patch CSS with new, context-matched oldString
5. Verify visually

**Key Insight**: Never assume CSS rules stay in same position after HTML restructure. Always re-read and re-match context before patching.

### Architecture Notes

- **Manual Drag**: `pointerdown/move/up` listeners send `resize-overlay` IPC
- **Click-Through Toggle**: One-way pattern (simpler, prevents oscillation)
- **Container Shrink-Wrap**: Content-driven sizing, floating panels independent
- **Localization**: Drag handle text in `data-label` attribute

### Current State (v6 Backup)

✅ Drag handle working
✅ Click-through stable  
✅ Layout compact
✅ All sections functional
✅ Localization complete

### Pending Polish

- [ ] Polygon header CSS (needs context-matched patch)
- [ ] Panel height persistence (localStorage)
- [ ] Keyboard accessibility (focus, ESC)
- [ ] Mobile layout (<800px stacking)

### Backups Created

- `backups/overlay.html.backup.v6` ✅
- `backups/main.js.backup.v6` ✅

---

#### Feb 6, 2026 - Inline History Expansion (Popup Retired)

### What was the problem?
- The history popup opened as a separate `BrowserWindow`, which froze fullscreen/borderless games because it stole focus from the game/overlay.
- It required two extra IPC channels (`open-history-popup`, `history-popup-pin-changed`) that existed only to support the broken UI.
- The user's state (pinned popup state) got stuck in `localStorage` keys, so the bad experience kept returning.

### Solution summary
1. **Inline details panel** — each history card now owns an expandable block. CSS (`.history-item.active`, `.history-full`, etc.) in [overlay.html](overlay.html#L478-L560) provides the animated details region.
2. **New rendering logic** — `renderHistory()` + `toggleHistoryItem()` in [overlay.html](overlay.html#L2064-L2115) handle open/close, tracking the active item by timestamp.
3. **Localization updates** — every language gained `historyShowDetails` / `historyHideDetails` keys so the toggle CTA stays fully translated.
4. **Legacy cleanup** — removed popup DOM, CSS, and `localStorage` keys (`historyPopupPinned`, `historyPopupLastIndex`). `main.js` no longer contains the `BrowserWindow` popup handling, and the hotkey logic is simpler ([main.js](main.js#L970-L1040)).

### Benefits
- **No more focus loss** — the game no longer experiences a separate focusable window; interactions stay inside the non-focusable overlay.
- **Less IPC surface** — two fewer channels and one fewer preload file worth of complexity.
- **Faster UX** — one-click inline details, and the newest item is visible right there.

### Follow-ups / risks
- Keyboard navigation (TAB/Enter) for inline details is still missing → accessibility backlog.
- Panel height still isn't persisted; if the user opens many long answers, they will need to scroll.

### Backups
- Backups are preserved in `backups/` and should be timestamped; never delete them automatically. ✅

---

### 2026-02-07 (Evening)

#### Left-edge resize jitter investigation (transparent Electron overlay) — unresolved, rolled back

#### Context

- App: transparent, frameless Electron overlay window on Windows.
- Resize is implemented manually in the renderer (pointer capture + screenX/screenY deltas), then sent to main via high-frequency IPC, where main applies bounds using `setContentBounds()`.

#### Symptom

- Resizing from the left edge produces visible jitter/jumps and occasional “right side clipping” feel.
- The jitter is most noticeable on floating/fixed-position UI elements (e.g., dropdown/floating panels).
- Later confirmed: “all small windows in the header jitter during resize”.

#### Initial hypotheses

- Bounds math instability (subpixel rounding, left-edge move+resize coupling).
- IPC round-trip / backlog (renderer waiting on main, or main applying stale values).
- DPI / coordinate space mismatch (renderer `screenX` vs Electron window bounds).
- OS/Electron post-correction of bounds (work-area clamp, min-size enforcement, rounding).
- Compositor/paint load on a transparent window (DWM/Chromium struggling while continuously resizing).

#### What we tried (and what happened)

1) UI behavior changes (not directly jitter-related, but part of resize stability work)
- Removed “accordion closes other sections” behavior so multiple overlay sections can be open simultaneously.
- Outcome: works as desired; unrelated to jitter root cause.

2) “Resize lets go / lag / loses drag” reliability fix
- Problem: sometimes resize/drag would “drop” mid-gesture (especially when click-through toggled / pointer left interactive region).
- Fix: force overlay to stay interactive during resize (push/pop “force interactive”) + ensure pointer capture stays active for the resize handles.
- Outcome: dragging/resizing no longer randomly drops. Jitter persists.

3) Reduce main-thread overhead & IPC latency
- Switched high-frequency resize updates to fire-and-forget IPC (`ipcMain.on`), and main-side coalescing (store only latest pending bounds and apply on a scheduled tick).
- Outcome: reduces overhead and avoids invoke round-trip stalls. Jitter persists.

4) Left-edge resize math stabilization
- Change: compute left-edge resize using a stable right edge:
  - round X first, then derive width from `rightEdge - x`
  - avoid subpixel oscillation and 1px “ping-pong”
- Outcome: math is cleaner and consistent; jitter persists.

5) DPI/coordinate alignment attempt
- On resize start, request an exact starting snapshot from main (`getContentBounds`) to seed resize math (DPI-safe baseline).
- Main uses content bounds (`getContentBounds`/`setContentBounds`) rather than window bounds to better match renderer’s expectations.
- Outcome: avoids obvious coordinate mismatches; jitter persists.

6) Disable native OS hit-test resize to avoid “tug-of-war”
- Ensured the overlay does not expose OS-driven edge resizing (`resizable: false`, `thickFrame: false`) so only the custom handles drive resizing.
- Outcome: eliminates one potential source of conflicting resize logic. Jitter persists.

7) Compositor/paint mitigation experiments during resize
- Goal: reduce the rendering cost during live resize on a transparent window.
- Disabled `backdrop-filter` and removed shadows during resize.
- Tried temporarily hiding/heavily simplifying content during resize in some iterations.
- Outcome:
  - Some variants caused content disappearing during resize (too disruptive).
  - After rollback/cleanup, we kept only non-disruptive simplifications.
  - Jitter still persisted.

8) Experimental modes (later removed)
- `NATIVE_RESIZE=1`: let OS handle resize.
- `RESIZE_SNAPSHOT=1`: show a static snapshot during resize.
- Outcome: did not solve jitter; snapshot/native experiments also contributed to “content disappears” reports. Both paths were fully removed.

#### Instrumentation added (to prove/disprove OS correction & sequencing issues)

##### Correlation metadata: session + sequence

- Renderer added `__session` and `__seq` fields to each resize update.
- Main logs include these meta values.
- Purpose: detect stale/out-of-order applies, duplicate starts, or backlogged updates.

##### Duplicate-start detection

- Main logs start-while-in-progress if a resize start arrives while already resizing.

##### Readback/correction detection (key signal)

- After `setContentBounds(next)`, main reads back `getContentBounds()` and logs readback-corrected if actual differs from requested (≥1px threshold).
- Result: in the provided test logs, no readback-corrected events appeared, strongly suggesting the OS/Electron is not clamping/correcting bounds in a way that explains the visible jitter.

##### Logging improvements (to avoid “missing apply” confusion)

- Normal logs were originally throttled globally, so frequent recv logs could suppress apply.
- Implemented per-tag throttling + a periodic summary ticker during active resize:
  - counts: recv/apply/schedule/scheduleSkip
  - last seen meta and pending meta
- Result: confirmed coalescing behavior is working; recv > apply is expected and not evidence of lost resizes.

#### Conclusion (why we stopped)

- After math fixes, IPC coalescing, DPI-safe start snapshot, disabling native resize conflict, and extensive instrumentation:
  - No evidence of OS/Electron bounds “bounce back” (no readback correction).
  - Jitter remains most consistent with compositor/paint instability on transparent window resizing, especially with multiple fixed/floating UI layers.
- Decision: stop the investigation for now and roll back to a stable point (keeping only non-controversial fixes if desired), because further changes were either ineffective or too disruptive.

#### Notes / future directions

- If revisiting: consider an approach that reduces live-paint complexity during resize (without hiding content), or a different window/rendering strategy for floating panels.
- Consider applying a controlled apply-rate limit (e.g., ~60Hz) in main as a targeted experiment, but only if it doesn’t worsen perceived input latency.

### 2026-02-07 (Night)

#### Summary
- What changed: Replaced OS-level overlay hide/show cycles with a “virtual hide” (opacity + click-through) to eliminate a long-standing Windows flicker/"double pop" on reopen.
- Why: After hide → show, Windows compositor / always-on-top z-order settling caused a brief faint first frame, then a second "settled" frame (visible as a fast double appearance).
- Impact: Overlay + note panel now re-open smoothly (single appearance), while keeping game-safe behavior (no focus steal, click-through preserved).

#### Details
- Symptom: No flicker on first show; flicker appears after at least one hide→show cycle. Most noticeable on the note panel (easy to catch in screenshots).
- Root cause (practical): Repeated `BrowserWindow.hide()`/`show()` combined with transparent always-on-top windows makes Windows re-evaluate composition and z-order; even when we reassert topmost/position, a brief intermediate presentation occurs.
- Fix: Introduced a virtual visibility state and a helper that does:
  - Hide: set window `opacity = 0` and `setIgnoreMouseEvents(true, { forward: true })` (so it is visually gone + click-through).
  - Show: force `show()`/`showInactive()`, set `opacity = 1`, restore ignoreMouseEvents policy, and reassert topmost/position.
  - Added a next-tick failsafe re-apply (opacity/topmost/bounds) to prevent the regression where the note panel showed but the main overlay stayed effectively invisible.
- Related stability: Hotkey semantics were updated earlier to be single-press toggle, and a periodic “topmost pulse” remains to resist fullscreen games pushing windows behind.

#### Files touched
- [main.js](main.js)

#### Backups
- Created via scripts/make-backup.ps1 before changes
- Never auto-delete or prompt-delete anything from backups/

#### Verification
- Manual: Repeated Ctrl+Shift+K hide/show cycles (overlay + note panel) while a fullscreen/borderless window is active.
- Confirmed: No “double pop” after reopen; both windows restore reliably.

#### Follow-ups
- Optional: Persist note panel bounds across app restarts (currently session-memory in main process).

---

### 2026-02-07 (Night)

#### Summary
- What changed: Major overlay UX refinements: detached panels (Ask/History/Settings) can be resized like standalone windows, the old Info modal was replaced with a movable Info panel window, and resize affordances were standardized and made visually subtle.
- Why: The overlay must behave like a “serious app” in a gaming context: no focus stealing, no harsh modal backdrops, predictable docking/undocking, and discoverable-but-not-distracting resize behavior.
- Impact: Detach + dock workflows are reliable on Windows; Info content is readable without dark modal overlay; resizing works consistently across windows; minimum sizes no longer feel “stuck”.

#### Details

##### New UX standard: prefer separate windows over heavy modals
- If content should feel “overlay-like” (movable, persistent, no backdrop), use a dedicated `BrowserWindow` (like Note) instead of a modal in the overlay DOM.
- This avoids a full-screen dark overlay and reduces focus/interaction hazards in fullscreen games.

##### Info UX refactor (modal → movable Info panel)
- The Info button now opens a singleton Info panel window (similar mechanics to the Note panel).
- The old modal-based Info UI was removed from the main overlay.
- The Info panel uses a “modal-like” internal layout (title + structured body + bottom Close button) but without a top-right X.
- Info content rendering was upgraded from raw text to structured HTML:
  - Bullet lines (`• ...`) become a `<ul>` list.
  - `Key: value` prefixes render the key in bold.
  - The renderer escapes HTML before inserting content to prevent injection.
- Scrollbar styling was made global within the Info window so the thin blue scrollbar is consistent no matter which element scrolls.

##### Detached panels: reliable dock/undock behavior
- Detached windows exist for Ask / History / Settings and can dock back into the header slot.
- Dock preview behavior was refined so the preview does not visually “flash” and only activates in a predictable zone.
- The “slot collapse” technique is used: detached header slots can collapse to zero height to keep the header compact, while docking still works via synthetic dock rectangles.

##### Resizing: functional + subtle (no ugly hover rectangles)
- Detached panel windows gained side + corner resize handles (matching the Note/Info approach) while keeping the bottom resize grip.
- Resize indicators were added everywhere resize is possible, but:
  - No bright hover backgrounds (these can appear as square blocks that spill beyond rounded corners).
  - Grips are the only cue; hover does not introduce a rectangular highlight.
  - Grip brightness was normalized so hover does not “flash” differently between windows.

##### Minimum size policy: lower hard clamps, rely on scrolling
- A key reason windows “couldn’t shrink” was explicit minimum-size clamps in main-process bounds enforcement.
- Min sizes were lowered and aligned between main-process clamps and renderer resize logic:
  - Overlay minimum width lowered to allow a smaller footprint.
  - Detached panels minimum size lowered.
  - Note / Info / pinned history minimum sizes lowered.
- Standard: pick a minimum that preserves basic usability, and allow internal scrolling for content overflow.

##### Bugfixes and polish included
- Fixed a detached-mode resize handle overlap issue by ensuring scrolling occurs in the inner content container and the handle occupies a stable footer area.
- Fixed a “thin until click” popup resize handle rendering issue by preventing flex-shrink and stabilizing height after initial measurement.

##### Backup tooling update
- Backup scripts were updated to include new/updated key UI files by default so backups reflect current architecture, not just the original three files.
- A fresh timestamped backup was created after the changes.

#### Files touched
- [main.js](main.js)
- [overlay.html](overlay.html)
- [info-panel.html](info-panel.html)
- [note-panel.html](note-panel.html)
- [pinned-history.html](pinned-history.html)
- [bug-checker.js](bug-checker.js)
- [scripts/make-backup.ps1](scripts/make-backup.ps1)
- [scripts/make-backup.js](scripts/make-backup.js)

#### Backups
- Created via scripts/make-backup.ps1 before changes
- Never auto-delete or prompt-delete anything from backups/
- Latest snapshot created: `20260207-201639`

#### Verification
- Manual:
  - Open/close overlay repeatedly while a game/fullscreen window is active.
  - Detach and resize Ask/History/Settings; verify docking still works.
  - Open Info panel; verify scrollbar and content formatting.
  - Resize Note/Info/Pinned windows; confirm no hover “brightness blocks” spill outside rounded corners.
- Tooling:
  - Fixed a false-positive in `bug-checker.js` (“IPC Listener Duplication”) so it now only warns when the same IPC channel is registered more than once.
  - `npm run check` now returns clean.

#### Follow-ups
- TODO: Convert remaining hardcoded UX constants (min sizes, thresholds) into user-configurable settings where it makes sense.
- TODO: Add a brief “How to dock/undock” hint (must be translated to 6 languages) if users struggle to discover docking.

---

### 2026-02-07 (Night)

#### Summary
- What changed: Fixed persistent cursor flicker (grab ↔ arrow) when detached panels overlap the main overlay.
- Why: On Windows, transparent always-on-top windows + `setIgnoreMouseEvents(true, { forward: true })` can still influence cursor state via forwarded mouse-move events.
- Impact: Detached panel headers remain stable; no more “vibrating cursor” when not all panels are undocked.

#### Details
- Symptom:
  - Cursor flickers across the detached window’s header/body when some panels are still docked.
  - Flicker disappears if the main overlay window is moved away (strong overlap signal).
- DevTools confusion clarified:
  - `html/body` are full-window by design.
  - `#floating-panels` is `position: fixed; inset: 0;` by design so popups can be positioned anywhere.
  - `#confirmModal.modal-overlay` is also full-window by design (modal backdrop) but is `display: none` unless `.active`.
- Attempted mitigation (reverted): Using `BrowserWindow.setShape()` to shrink the overlay hit-test region.
  - Lesson: `setShape` clips the *visible* window region as well, which can “break” the overlay visuals.
- Final fix:
  - Keep click-through behavior, but dynamically disable **mouse move forwarding** when the cursor is inside a child window (detached/pinned/note/info).
  - Implementation: when click-through is enabled, use `setIgnoreMouseEvents(true)` (no forward) while the cursor is over a child window; otherwise `setIgnoreMouseEvents(true, { forward: true })`.
  - This prevents the main overlay renderer from “competing” on cursor state under overlap.

#### Files touched
- [main.js](main.js)
- [overlay.html](overlay.html)

#### Verification
- Manual: Reproduced the overlap scenario (Ask detached, others docked) and confirmed the cursor no longer flickers.
- Tooling: `npm run check` clean.

---

### 2026-05-08 (Evening)

#### Summary
- What changed: Added game-detect validation suite and tightened dataset-backed matching; window title detection now prefers dataset matches with regex fallback.
- Why: Prevent short-name false positives ("Fe", "Z") and make detection resilient to generic text.
- Impact: More reliable game context inference and a repeatable validation check.

#### Details
- Implementation notes: Added `tests/game-detect-cases.json` and `scripts/validate-game-detect.js`, wired via `npm run validate:games`. Matching now uses whole-word checks, short stopword filtering, and token-length scoring. Window-title extraction calls dataset matching first.
- Edge cases: Short aliases are ignored if they are common stopwords; alias/name matching is case-insensitive through normalization.

#### Files touched
- [src/main/services/game-detect.js](src/main/services/game-detect.js)
- [tests/game-detect-cases.json](tests/game-detect-cases.json)
- [scripts/validate-game-detect.js](scripts/validate-game-detect.js)
- [package.json](package.json)

#### Backups
- Not created (logic/tests only).

#### Verification
- `npm run validate:games` → all cases passed.

#### Follow-ups
- TODO: Expand validation cases with real window-title variants.

---

### 2026-02-07 (Night)

#### Summary
- What changed: Tightened docking hit-areas, sped up detach/dock visual refresh, and prevented the virtual-hidden overlay from ever becoming interactive.
- Why: Windows transparent always-on-top windows + forwarded mouse events can leave “invisible but clickable” states and overly-forgiving dock targets that cause accidental undock/dock.
- Impact: Dock/undock feels snappier and more predictable; hidden overlay no longer captures pointer/drag.

#### Details
- Dock target area reduced:
  - Renderer synthetic dock-rect height reduced so docking only triggers near the header bar, not in the large empty gap.
  - Main-process header-zone heuristics reduced for dock-preview and fallback docking.
- Detach responsiveness:
  - Lowered detach gesture threshold (less movement to start detach).
  - Updated overlay state immediately when detach is confirmed (hide slot + close popup), before waiting on detached window paint.
- Dock responsiveness:
  - When docking back from header-only/dock-preview transitions, open the docked content immediately (with a short fallback), relying on resize/reposition to correct final sizing.
- Hidden overlay safety:
  - Guarded `set-click-through` so if the overlay is virtual-hidden (opacity 0), it is forced to remain click-through and cannot become interactive via renderer hover evaluation.

#### Files touched
- [main.js](main.js)
- [overlay.html](overlay.html)

#### Backups
- Created via scripts/make-backup.ps1 before changes
- Never auto-delete or prompt-delete anything from backups/
- Latest snapshot created: `20260207-230118`

#### Verification
- Manual: In-game (Terraria) detach/dock flows; verified docking only triggers near header and hidden overlay cannot be interacted with.
- Tooling: `npm run check` clean.

#### Follow-ups
- TODO: If dock target becomes too strict, tune synthetic dock zone height (keep it tight, but usable).

---

### 2026-02-07 (Night)

#### Summary
- What changed: Fixed multiple overlay UI desync/jitter edge cases: header-only restore height after renderer reload, layout mode switching while popups are open, and overlay width slider behavior (discrete steps + apply-on-release).
- Why: Transparent always-on-top overlays on Windows are sensitive to timing/state drift (Ctrl+R reloads, header-only sizing transitions, and resize feedback loops).
- Impact: No more clipped popup bottoms / “opens upward” surprises after Ctrl+R, layout changes immediately reflect in open dropdowns, and the width slider no longer causes window jitter.

#### Details
- Header-only restore safety:
  - Root cause: when the renderer reloads in header-only, the “previous height” capture could record the tiny header height; docking back would restore to that tiny size, clipping popups and forcing upward placement.
  - Fix: never record a restore height below a sane threshold; enforce a stronger minimum restore height; and add an extra “expand before open” safeguard on dock/open.
- Layout switch with open popups:
  - Root cause: `applyLayoutMode()` changed layout classes but open floating popups were never repositioned (no resize event fired), leaving dropdown geometry stuck in the previous layout.
  - Fix: schedule popup repositioning right after layout mode changes.
- Overlay width slider stability:
  - Root cause: live resizing + window-resize-driven slider sync created a feedback loop (“jumping”).
  - Fix: width slider is now discrete (10 segments), synced on real window resize, and only applies the resize on release/commit (pointerup/change) instead of during dragging.

#### Files touched
- [overlay.html](overlay.html)

#### Backups
- Created via scripts/make-backup.ps1 before changes
- Never auto-delete or prompt-delete anything from backups/
- Latest snapshot created: `20260207-233707`

#### Verification
- Manual: switched layout modes with all three dropdowns open; verified dropdowns reposition correctly.
- Manual: resized overlay via drag handles and via the width slider; verified slider stays stable and applies on release.
- Tooling: `npm run check` clean.

#### Follow-ups
- Optional: If desired, “snap” manual drag-handle resizing on release to the same 10-step grid (currently only the slider itself is quantized).

---

### 2026-02-08 (Afternoon)

#### Summary
- What changed: Improved detached panel undock perceived responsiveness (reduced blank/fade + removed the “gap” between docked slot disappearing and detached window becoming visible). Also reduced VS Code background load by excluding noisy folders/files from watcher/search.
- Why: On Windows transparent windows, there can be a short paint delay for a newly created BrowserWindow, which made undocking feel laggy. Separately, large workspaces (node_modules + backups) increase watcher churn and memory.
- Impact: Undocking feels more continuous (no “nothing happens” pause). VS Code should do less background indexing/work.

#### Details
- Undock render sequencing:
  - Detached BrowserWindow is now shown on `ready-to-show` (with a short failsafe timer), rather than immediately after creation.
  - The main overlay no longer hides the docked slot immediately on detach-drag start. Instead, it waits for main-process confirmation that the detached window is shown (`detached-panel-shown`) and only then applies `panel-detached`.
  - Disabled the tab content fade-in animation in detached windows (`body.panel-mode`) so the panel appears instantly.
- VS Code load reduction:
  - Added workspace-level `files.watcherExclude` + `search.exclude` for `**/node_modules/**`, `backups/**`, and `**/*.backup*`.

#### Files touched
- [main.js](main.js)
- [overlay.html](overlay.html)
- [.vscode/settings.json](.vscode/settings.json)

#### Backups
- Created via scripts/make-backup.ps1 before changes
- Latest snapshot created: `20260208-141000`

#### Verification
- Manual: detach Ask/History/Settings and observe that the docked slot remains visible until the detached window appears.
- Tooling: `npm run check` clean.

#### Follow-ups
- If undock still feels slow on some machines: consider the alternative baseline (renderer “I’m ready” IPC + create/show at opacity 0 → flip to opacity 1 when ready).

---

### 2026-02-08 (Evening)

#### Summary
- What changed: Docking a detached main panel (Ask/History/Settings) now **caches** the detached BrowserWindow (deactivate + hide) instead of destroying it.
- Why: Repeated undock was paying the full renderer startup cost again (often ~0.45–0.5s), even if the user just docked it a moment ago.
- Impact: Re-undocking can reuse the already-loaded window, improving repeat undock responsiveness and reducing race surface around window creation/show.

#### Details
- Docking behavior:
  - On dock, the detached window is marked inactive (`__detachedActive = false`) and hidden (opacity 0 + ignore mouse + `hide()`).
  - The window stays in `detachedPanelWindows` and does not count as “detached” for the overlay header because state reporting only includes active windows.
- Re-undock behavior:
  - A real undock request re-activates the cached window (`__detachedActive = true`), applies requested bounds, and reuses the existing renderer.
  - This complements the existing readiness handshake (`detached-panel-ready`) and the reconcile/self-heal safety net.

#### Files touched
- [main.js](main.js)

#### Backups
- Created via scripts/make-backup.ps1 before changes
- Latest snapshot created: `20260208-185830`

#### Verification
- Tooling: `npm run check` clean.
- Manual: dock → undock the same panel repeatedly and confirm the undock path reuses the existing window (no destroy/recreate).

#### Follow-ups
- Optional cleanup: legacy unused files from older history-popup experiments can be removed once confirmed unreferenced (see audit note in chat).

---

### 2026-02-08 (Night)

#### Summary
- What changed: Documented and implemented a broad refactor pass plus overlay/detached sync fixes (translations, shared constants, dock targeting, layout and bounds broadcasts).
- Why: Reduce drift across renderer/main windows, eliminate mixed-language UI, and improve detached/docked coordination.
- Impact: Shared constants now drive IPC/storage/panel IDs, language updates broadcast to all overlay windows, and layout toggles work from detached Settings. Overlay size slider sync is improved but still not fully stable when detached.

#### Details
- Shared panel IDs + normalization:
  - Added `src/shared/panels.js` and replaced hardcoded panel lists in main + renderer.
- Shared IPC channels + storage keys:
  - Added `src/shared/ipc-channels.js` and `src/shared/storage-keys.js`.
  - Replaced inline strings in main/renderer and auxiliary windows (note/info/pinned/detached) to reduce drift.
- Translation fixes:
  - Removed remaining hardcoded Hungarian text in overlay + main settings.
  - Added missing translation keys and wired `updateOverlayText()` / `updateLanguage()` to refresh labels/buttons.
  - `set-language` now broadcasts to detached overlay windows.
- Dock/undock targeting improvements:
  - Overlay dock rects include open content to better match user intent.
  - Dock target selection prefers smallest matching rect, with a header-band fallback to allow swaps.
- Detached settings layout + bounds sync:
  - Added layout mode IPC (`OVERLAY_LAYOUT_SET`, `OVERLAY_LAYOUT_UPDATED`) so detached Settings can change the main overlay layout.
  - Added overlay bounds broadcast (`OVERLAY_BOUNDS_UPDATED`) to keep detached settings slider in sync.
  - Added max/min width info from the main overlay display to tune discrete slider steps.
  - Known issue remains: slider can still stick to the first step in detached mode.

#### Files touched
- [overlay.html](overlay.html)
- [index.html](index.html)
- [src/shared/panels.js](src/shared/panels.js)
- [src/shared/ipc-channels.js](src/shared/ipc-channels.js)
- [src/shared/storage-keys.js](src/shared/storage-keys.js)
- [src/main/ipc/register.js](src/main/ipc/register.js)
- [src/main/windows/overlay.js](src/main/windows/overlay.js)
- [src/main/windows/detached.js](src/main/windows/detached.js)
- [note-panel.html](note-panel.html)
- [info-panel.html](info-panel.html)
- [pinned-history.html](pinned-history.html)

#### Backups
- Created via scripts/make-backup.ps1 before changes
- Never auto-delete or prompt-delete anything from backups/
- Latest snapshots: `20260208-213318`, `20260208-213326`, `20260208-214326`

#### Verification
- Manual: language switching in main + detached windows; layout toggle from detached Settings.
- Manual: dock/undock swap targeting improved; layout change repositions popups.
- Manual: detached overlay width slider sync still inconsistent (see Follow-ups).

#### Follow-ups
- None.

---

### 2026-05-08 (Evening)

#### Summary
- What changed: Extracted overlay CSS to `overlay.css` and split the inline overlay JS into renderer modules (translations, history, detach, ui, ipc).
- Why: Improve maintainability and isolate concerns while keeping the no-bundler setup.
- Impact: Behavior unchanged; overlay now loads external assets via script tags.

#### Details
- Implementation notes: Overlay remains the entry point; globals preserved with `var` where required; script order validated for dependencies.
- Edge cases: Ensured no inline script remains; CSS now loaded via a single `<link>`; fixed detached-panel blank content by loading `detach.js` after `ui.js`.

#### Files touched
- [overlay.html](overlay.html)
- [overlay.css](overlay.css)
- [src/renderer/overlay/translations.js](src/renderer/overlay/translations.js)
- [src/renderer/overlay/ipc.js](src/renderer/overlay/ipc.js)
- [src/renderer/overlay/history.js](src/renderer/overlay/history.js)
- [src/renderer/overlay/detach.js](src/renderer/overlay/detach.js)
- [src/renderer/overlay/ui.js](src/renderer/overlay/ui.js)

#### Backups
- Created via scripts/make-backup.ps1 before changes
- Never auto-delete or prompt-delete anything from backups/

#### Verification
- `npm run check`

#### Follow-ups
- TODO: None

---

### 2026-05-08 (Late)

#### Summary
- What changed: Moved the main entry logic into [src/main/index.js](src/main/index.js) and kept [main.js](main.js) as a thin delegate.
- Why: Keep the main process source under `src/main` without changing the Electron entry point.
- Impact: No runtime behavior change; entry file stays the same.

#### Details
- Implementation notes: Updated require paths to be relative to [src/main](src/main).
- Edge cases: None observed; [package.json](package.json) still points to [main.js](main.js).

#### Files touched
- [main.js](main.js)
- [src/main/index.js](src/main/index.js)

#### Backups
- Created via scripts/make-backup.ps1 before changes
- Never auto-delete or prompt-delete anything from backups/

#### Verification
- Not run (not requested)

#### Follow-ups
- TODO: None

---

### 2026-05-08 (Late)

#### Summary
- What changed: Centralized main-process language, speech rate, and game context state into [src/main/state/registry.js](src/main/state/registry.js).
- Why: Finish Phase 1 registry extraction and keep shared state in one place.
- Impact: No behavioral change; state now flows through the registry.

#### Details
- Implementation notes: Updated main entry wiring to read/write registry state.
- Edge cases: None observed.

#### Files touched
- [src/main/state/registry.js](src/main/state/registry.js)
- [src/main/index.js](src/main/index.js)

#### Backups
- Created via scripts/make-backup.ps1 before changes
- Never auto-delete or prompt-delete anything from backups/

#### Verification
- Not run (not requested)

#### Follow-ups
- TODO: None