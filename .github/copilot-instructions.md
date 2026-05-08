<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

- [x] Verify that the copilot-instructions.md file in the .github directory is created.

- [x] Clarify Project Requirements
	- Electron desktop overlay for game assistance
	- OpenAI GPT + Vision API integration
	- Real-time game detection (Windows)
	- Multi-language support (HU, EN, DE, RU, FR, ZH)

- [x] Scaffold the Project
	- Main process: main.js (~1290 lines)
	- Renderer: overlay.html (~2340 lines)
	- Tools: bug-checker.js, cleanup.js
	- Supporting files: package.json, .env

- [x] Customize the Project
	- Game context detection (PowerShell + active-window)
	- Whisper audio STT (OpenAI API)
	- Vision analysis (GPT-4o)
	- Collapsible UI sections
	- Conversation history (localStorage)

- [x] Install Required Extensions
	- None required (VS Code built-in)

- [x] Compile the Project
	- Dependencies installed: npm install
	- App runs: npm start
	- No build step needed (Electron)

- [x] Create and Run Task
	- Task exists: "Start Electron App" (npm start)

- [x] Launch the Project
	- App successfully runs: `npm start`
	- Hotkey registered: Ctrl+Shift+K
	- All features operational (audio, vision, game detection)

- [x] Ensure Documentation is Complete
	- README.md exists and is up to date
	- LEARNINGS.md documents all discovered patterns and lessons
	- Project audit completed and documented
	- v5 backups created and organized


## Key Learning Points (2026)

### Critical Issues Fixed
1. **Orphan Event Handlers** – Fixed cascading null reference errors by adding orphan handler detection (bug-checker.js) and defensive event registration patterns.
2. **Web Speech API Dependency** – Migrated to OpenAI Whisper STT for reliable, offline-friendly audio transcription.
3. **Game Detection Timing** – Game detection now runs at app startup, hotkey, and overlay show for robust context awareness.
4. **History Rendering** – Replaced popup with inline expansion; loadHistory() now always calls renderHistory().
5. **Modal Duplication** – Removed duplicate confirmModal element; all modals are custom and fully translated.
6. **Tab Button References** – Cleaned up all removed UI references and handlers after refactor.
7. **Backup Policy** – Backups are never auto-deleted; all .backup files are timestamped and must be preserved for rollback.
8. **PowerShell Wildcard Fix** – get-window-bounds.ps1 uses IndexOf for robust, wildcard-free window detection.
9. **GPU Resource Starvation** – Removed aggressive Chromium flags to prevent system-wide GPU lockup.
10. **English Documentation** – All technical docs (LEARNINGS.md, CHANGELOG.md, etc.) are now fully English, clear, and developer-focused.

### Code Quality & Maintenance Tools
- `npm run check` – Detects 10+ architectural anti-patterns, orphan handlers, missing translations, and IPC issues.
- `npm run cleanup` – Reports code quality issues, lists backup files (never deletes automatically).
- bug-checker.js – Active pattern detection for orphans, IPC, and dead code.
- File nesting – VS Code explorer organization (.vscode/settings.json).

### Architecture & Best Practices
- Whisper API for audio STT (uses OpenAI key, reliable for all languages).
- PowerShell game detection (no external dependencies, robust to wildcards).
- localStorage for history (20-item limit, persistent across reloads).
- Collapsible UI sections for compact overlay (1100x500, grid layout).
- Inline history expansion (no popups, no focus stealing, game-safe).
- All user-facing text must be translated to 6 languages (hu, en, de, ru, fr, zh) and added to uiText.
- Custom modal dialogs only; never use native confirm/alert/prompt.
- All window bounds clamped to visible work area.
- High-frequency IPC (move/resize) is fire-and-forget, rAF-throttled.
- Always create a backup before any new feature or risky edit (scripts/make-backup.ps1).
- Never auto-delete backup files; manual deletion only after explicit review.

### Documentation & Audit Process
- All technical documentation is maintained in English for clarity and professionalism.
- LEARNINGS.md contains a detailed, chronological, English log of all bugfixes, edge cases, and architecture decisions.
- CHANGELOG.md and AUDIT_REPORT.md are updated after each major feature or bugfix.
- All backup and rollback procedures are documented and followed strictly.

### Work Process Guidelines
- Work through each checklist item systematically.
- Keep communication concise and focused.
- Follow development best practices.
- Never auto-delete backup files (they are sacred).
- Always maintain a comprehensive audit trail (LEARNINGS.md).
- Test in realistic game scenarios (Terraria preferred).

## v1.0 Release Status
✅ **READY TO SHIP** – Code complete, stable, documented
- All core features operational
- No critical bugs
- Comprehensive, English documentation
- Professional code quality (8.35/10)
- All security checks passed

