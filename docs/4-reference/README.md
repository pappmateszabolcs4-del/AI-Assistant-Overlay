# AI Game Assistant

Modern Electron-based desktop application for gaming assistance with voice recognition and AI integration.

## Features

- 🎮 **Always-on-top Overlay** - Floats above games
- 🎤 **Voice Recognition** - Record and process voice commands
- 📸 **Vision AI** - Screenshot capture with AI analysis (GPT-4o Vision)
- 💬 **Text + Image Questions** - Ask questions about game screenshots, maps, puzzles
- ⚙️ **Customizable Settings** - Multi-language support, themes, hotkeys
- 🪟 **Frameless Window** - Custom titlebar with drag/resize support
- 🔄 **Auto-start** - Windows startup integration
- 🌍 **Multi-language** - English, Magyar, Deutsch, Русский, Français, 中文, Italiano, Polski
- 🎯 **Game Specialization Levels** - 1-5 detail levels for AI responses
- 🧱 **Block Layout** - Movable blocks with detachable block windows
- 📝 **Dynamic Notes** - Multiple notes with rename + pin
- 🔎 **History Search** - Filter history with pinned-only toggle (overlay + block windows)

## How to run

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the app:
   ```bash
   npm start
   ```
3. **Run bug checker** (before committing changes):
   ```bash
   npm run check
   ```

## Fast Packaging (Windows)

Use this when you want a quick packaged build for testing without installers:

```bash
npm run package:win
```

Artifacts land in:
- `out/aigameassistant_new-win32-x64/`

## Development Tools

### Automated Bug Checker
Run `npm run check` to scan for common architectural mistakes:
- ✅ Focusable popup window detection (game-breaking)
- ✅ Duplicate hotkey registration
- ✅ Window destroy/recreate patterns (CPU spikes)
- ✅ Full-screen overlay detection
- ✅ Missing translations
- ✅ Native dialog usage
- ✅ IPC listener duplication
- ✅ Unsafe content filtering
- ✅ Missing error handling
- ✅ Dead code detection (abandoned features)
- ✅ Large commented code blocks
- ✅ TODO/FIXME comments

**Usage:**
```bash
# Run automated checks
npm run check

# Clean up backup files and dead code
npm run cleanup
```

The checker will:
- 🔴 Flag CRITICAL issues (must fix)
- 🟡 Flag HIGH issues (should fix)  
- 🔵 Flag MEDIUM issues (nice to fix)
- Exit code 1 if issues found (for CI/CD integration)

### Code Cleanup Script
Run `npm run cleanup` to:
- List any backup files (*.backup, *.v2, *.old) so you can verify they stay intact
- Identify dead code patterns
- Suggest manual cleanup tasks

**Workflow**:
1. Before coding: `npm run check` (ensure baseline is clean)
2. After feature: `npm run cleanup` (review suggestions, manually archive backups only if you've already created a fresher set)
3. Before commit: `npm run check` (verify no issues)

### Code Hygiene Rules
⚠️ **NEVER commit**:
- Backup files (.backup, .v2, .old) - use git instead
- Large commented code blocks - delete or commit separately
- Dead code from abandoned attempts - remove immediately
- Old TODO comments - implement or delete

✅ **ALWAYS**:
- Delete failed attempts same session
- Use git history for experiments (not commented code)
- Run `npm run check` before committing
 - Document abandoned approaches in the learnings log (with WHY it failed)

### Backup & Rollback Protocol
- Run `powershell -ExecutionPolicy Bypass -File scripts\make-backup.ps1` before risky edits to capture timestamped copies of `main.js`, `overlay.html`, `index.html`, etc.
- If rollback is required, restore directly from the freshest `.backup.<timestamp>` files under `backups/` and only fall back to older versions when the newest copy fails review.
- Never overwrite a working file without first confirming that the replacement came from the most recent backup set.
- Keep the backup archive intact—cleanup routines must not delete these recovery points unless you manually archive them elsewhere.

## Project Structure

- **main.js** - Electron main process entry point (bootstraps the app)
- **overlay.html** - Overlay renderer (Ask/History/Settings UI)
- **index.html** - Main settings renderer (OpenAI key, app settings)
- **src/main/** - Main-process modules (IPC, window managers, lifecycle)
- **src/shared/** - Shared constants (panel IDs, IPC channels, storage keys)
- **package.json** - Dependencies and scripts

## Tech Stack

- **GUI Engine**: Chromium (Blink) via Electron
- **Backend**: Node.js (Electron main process)
- **Frontend**: HTML + CSS + JavaScript
- **Communication**: IPC (Inter-Process Communication)

## ⚠️ Important Notes

### Overlay Window Architecture (Feb 6, 2026)

**Current Implementation:**
- **Compact regional window** (`overlay.html`) around 1100×500 px, created on startup and hidden until toggled.
- **Header-first layout** – the always-visible 80 px ribbon only shows section buttons; content renders inside floating popups anchored to that ribbon.
- **Floating panel system** – sections (`Kérdezz`, `Előzmények`, `Beállítások`) open inside `#floating-panels`, with independent resize grips, viewport clamping, and collision handling.
- **RequestAnimationFrame resize loop** – bounds updates are diffed per frame to prevent IPC spam and stop the overlay from jittering during drags.
- **No auto-focus, always-on-top** – the overlay is shown without forcing focus (so games are less likely to lose focus) while remaining interactive via custom hit regions.

**BrowserWindow pattern:**
```javascript
function createOverlayWindow() {
  overlayWin = new BrowserWindow({
    width: 1100,
    height: 500,
    minWidth: 960,
    minHeight: 420,
    frame: false,
    transparent: true,
    // Shown via showInactive() on hotkey to avoid stealing focus
    focusable: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#00000000'
  });

  overlayWin.once('ready-to-show', () => overlayWin.hide());
}
```

**Renderer pattern:**
```javascript
// Each section renders into a floating card when opened
function openSection(id) {
  const panel = ensurePanel(id);
  requestAnimationFrame(() => positionPanel(panel));
}

window.addEventListener('resize', () => {
  requestAnimationFrame(() => clampPanelsToViewport());
});
```

**Key behaviors:**
1. Overlay hotkey only toggles visibility; no re-creation happens after startup.
2. Before hiding, main process sends `cleanup-overlay` so voice capture, timers, and screenshot previews reset.
3. Collapsible popups collapse back into the header on reload to avoid stale DOM nodes.
4. Game context detection refreshes whenever the overlay becomes visible so AI answers stay relevant.

### Legacy Full-Screen Overlay (Feb 4, 2026) – Historical Reference Only
- The former full-window transparent overlay caused focus theft, double-layer artifacts, and blurry edge cases on some GPUs.
- Nested fixed containers plus pointer-events hacks produced flicker and orphan handlers.
- Keeping the notes here helps explain past bugs, but **do not** resurrect the full-screen pattern; the compact popup overlay fully replaces it.

### Window Lifecycle Management

**Proper Cleanup on Exit:**
```javascript
case 'close':
  // 1. Destroy overlay window
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.destroy();
  }
  overlayWin = null;
  
  // 2. Destroy main window
  if (win && !win.isDestroyed()) {
    win.destroy();
  }
  win = null;
  
  // 3. Quit application
  app.quit();
  break;
```

**Why this order matters:**
- Prevents zombie background processes in Task Manager
- Ensures all IPC listeners are cleaned up
- Releases global shortcuts properly

### GlobalShortcut API - USE WITH CAUTION
### GlobalShortcut API - USE WITH CAUTION

**UPDATE (Feb 4, 2026):** We ARE using `globalShortcut` for overlay toggle, but with proper cleanup.

**Safe Usage Pattern:**
```javascript
// Register on app ready
const hotkeyRegistered = globalShortcut.register('CommandOrControl+Shift+K', callback);

// CRITICAL: Cleanup on quit
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
```

**Hotkey Debounce Pattern:**
```javascript
// ✅ CORRECT: Flag-based debounce
let isHotkeyProcessing = false;

globalShortcut.register('CommandOrControl+Shift+K', () => {
  if (isHotkeyProcessing) return; // Immediate check
  
  isHotkeyProcessing = true;
  
  // Toggle logic here
  
  setTimeout(() => {
    isHotkeyProcessing = false;
  }, 300);
});

// ❌ WRONG: Timeout-based debounce
// Causes action to execute before debounce check
let timeout = null;
globalShortcut.register('...', () => {
  if (timeout) return;
  timeout = setTimeout(() => timeout = null, 500);
  // Action executes BEFORE timeout is set!
});
```

**Why Ctrl+Shift+K is safe:**
- Modifier keys (Ctrl+Shift) reduce accidental triggers
- Less likely to conflict with other applications
- Still properly unregistered on app quit

## Design System

### Color Variables
```css
--bg-primary: Main background
--bg-secondary: Panels/cards
--bg-tertiary: Sections/groups
--text-primary: Main text
--text-secondary: Helper text
--accent: Primary action color
--border-color: Borders/dividers
```

### Layout Conventions
- **Overlay shell**: 1100×500 transparent window; 80 px header stays visible while popups render inside `#floating-panels`.
- **Floating panels**: Independent cards with blur + drop shadow, each capped to the viewport and resizable via bottom grips.
- **Padding**: 32px for all content containers
- **Border Radius**: sm (6px), md (12px), lg (16px)
- **Z-index**: titlebar (9999) > modals (2100) > overlays (1000)

### Component Patterns
- **Buttons**: Primary (accent color) vs Secondary (tertiary bg)
- **Hover effects**: `translateY(-2px)` + shadow
- **Transitions**: `all 0.2s ease` for interactions
- **Animations**: slideDown/scaleIn for modals (0.3s ease-out)

## Key Learnings

### UI/UX Patterns
1. **Egységes szélesség**: `max-width: 520px` minden panelre
2. **Egységes padding**: 32px minden konténerre
3. **Floating popup pattern**: Header buttons spawn anchored cards with blur háttér és külön resize fogantyúk
4. **Custom dialógusok**: alert() és confirm() helyett saját modal-ok
5. **Z-index hierarchia**: Titlebar mindig legfelül (9999)
6. **Translations**: Komplett i18n system beépítve
7. **Responsiveness**: max-width és min-width használata width helyett rugalmasság miatt

### Electron Window Management
8. **Pre-initialize hidden windows** - Create overlay on startup, toggle visibility only
9. **Avoid ready-to-show auto-show** - Let user action trigger visibility, not load events
10. **Regional transparent overlays need tinted surfaces** - Keep the window compact but render a blurred/tinted container so transparency artifacts stay hidden
11. **Backdrop-filter needs transparency** - Works only with transparent parent
12. **Single instance lock** - Prevent multiple app instances with `requestSingleInstanceLock()`

### Performance & Architecture
13. **Separate overlay window > DOM overlay** - Better for games, no click-through issues
14. **Flag-based debounce > timeout-based** - Prevents race conditions in hotkey handlers
15. **Destroy > close for cleanup** - `destroy()` is more reliable than `close()` for forced cleanup
16. **IPC listeners registered once** - Use flag to prevent duplicate listener registration

### Common Pitfalls (Feb 4, 2026)
- ❌ Creating new window on every hotkey press → causes flicker
- ❌ Nested fixed positioning in CSS → creates "double window" effect
- ❌ Auto-showing overlay on ready-to-show → appears unwanted at startup
- ❌ Not destroying all windows on exit → zombie processes in Task Manager
- ❌ Timeout-based debounce that checks AFTER action → doesn't prevent duplicates
- ❌ Full-screen overlay window → freezes underlying games/videos (like Snipping Tool)
- ❌ `focusable: true` on overlay → steals focus from games
- ❌ `pointer-events: auto` on body → blocks input to underlying window
- ❌ Calling `win.focus()` on hotkey → brings app window to front unwanted

### Final Architecture (Feb 6, 2026 - STABLE)
**Popup Overlay Pattern (solution):**
```javascript
overlayWin = new BrowserWindow({
  width: 1100,
  height: 500,
  minWidth: 960,
  minHeight: 420,
  frame: false,
  transparent: true,
  backgroundColor: '#00000000',
  focusable: false,
  alwaysOnTop: true,
  show: false
});

// Keep overlay hidden until user toggles it
overlayWin.once('ready-to-show', () => overlayWin.hide());
```

**Key Benefits:**
- ✅ Games never lose focus thanks to `focusable: false` and header-only hit regions.
- ✅ Floating panels stay constrained to the screen and can be resized independently.
- ✅ RequestAnimationFrame batching eliminates jittery drags and IPC spam.
- ✅ Reload guard collapses panels back into the header, so stale DOM fragments disappear.

**Hotkey Handler (no win.focus()):**
```javascript
const toggleOverlay = () => {
  if (isHotkeyProcessing) return;
  isHotkeyProcessing = true;

  if (!overlayWin || overlayWin.isDestroyed()) {
    createOverlayWindow();
  }

  const visible = overlayWin.isVisible();
  if (visible) {
    overlayWin.webContents.send('cleanup-overlay');
    overlayWin.hide();
  } else {
    overlayWin.show();
    overlayWin.webContents.send('refresh-game-context');
  }

  setTimeout(() => { isHotkeyProcessing = false; }, 500);
};
```

**Overlay Cleanup (overlay.html):**
```javascript
ipcRenderer.on('cleanup-overlay', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
  }
  recording = false;
  micBtn.textContent = '🎤 Mikrofon';
  status.textContent = '';
  document.querySelectorAll('.floating-panel').forEach((panel) => panel.remove());
});
```

## Shortcuts

- **Ctrl+Shift+K** - Toggle overlay (global hotkey, works in games)
- **🎮 Overlay button** - Alternative way to open overlay from main window

## Vision AI Usage (NEW - Feb 5, 2026)

### How to use Vision AI for game assistance:

1. **Open the overlay** (Ctrl+Shift+K)
2. **Click "📸 Screenshot"** button - captures current screen (overlay hides temporarily)
3. **Preview appears** - screenshot attached, ready for analysis
4. **Ask a question** - either by:
   - Typing in the text box
   - Using voice (🎤 Mikrofon button)
5. **AI analyzes image + question** - GPT-4o Vision API processes both
6. **Get detailed answer** - AI responds with game-specific advice based on the screenshot

### Use cases:
- 🗺️ **Map sections** - "Where should I go next?"
- 🧩 **Puzzles** - "How do I solve this puzzle?"
- ⚔️ **Boss fights** - "What are the boss's weak points in this phase?"
- 🎒 **Inventory management** - "Which items should I keep?"
- 🏰 **Level design** - "Are there any secrets visible here?"
- 💎 **Item identification** - "What is this item and how do I use it?"

### Technical details:
- **Model**: GPT-4o (supports vision + text)
- **Screenshot**: Captured via Electron's desktopCapturer API
- **Resolution**: Up to 1920x1080 (automatically resized if larger)
- **Format**: Base64 PNG data URL
- **Fallback**: If no image attached, uses gpt-3.5-turbo-16k (text-only)

---

For more info, see the [Electron documentation](https://www.electronjs.org/docs/latest/).
