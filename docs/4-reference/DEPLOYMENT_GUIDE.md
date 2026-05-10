# 🚀 DEPLOYMENT GUIDE

**Status**: Ready for release operations (installer + signing + distribution)  
**Last Updated**: May 10, 2026

---

## 📋 RELEASE CHECKLIST

### 1) Pre-flight (Code + Safety)

```bash
# Install deps
npm install

# Run automated checks
npm run check

# Optional safety nets
npm test
npm run validate:games  # only if game detection logic/dataset changed
```

**Debug tools:** Remove or guard any `openDevTools()` calls before release.  
Current location: [src/main/windows/overlay.js](src/main/windows/overlay.js)

### 2) Versioning + Docs

- Update version in [package.json](package.json) if this is a release.
- Update [docs/3-overview/CHANGELOG.md](docs/3-overview/CHANGELOG.md).
- Ensure [docs/3-overview/TODO.md](docs/3-overview/TODO.md) reflects current status.

### 3) Build Artifacts (Electron Forge)

```bash
# Unpacked build
npm run package

# Windows x64 unpacked build
npm run package:win

# Installers (default Forge makers)
npm run make
```

Outputs land under `out/` (including `out/make/` for installers).

### 4) Code Signing (Windows)

Use an EV certificate and Windows `signtool.exe` on the generated installer.  
Apply a timestamp and verify the signature before release.

### 5) Smoke Test (Clean VM)

- Install from the signed installer.
- Launch and verify hotkey (`Ctrl+Shift+K`).
- Test audio input (Whisper), Vision screenshot, and text prompts.
- Confirm history persists across restarts and search works in overlay + block windows.
- Check note panel multi-note flow (rename, pin, active preview).
- Switch languages to verify UI is translated.

### 6) Release

```bash
git tag v1.0.x
git push origin v1.0.x
```

- Create GitHub release and upload installers + checksums.
- Update any external download links.

---

## 🔑 CURRENT SOURCES OF TRUTH

- Release status: [docs/3-overview/PROJECT_STATUS.md](docs/3-overview/PROJECT_STATUS.md)
- Changelog: [docs/3-overview/CHANGELOG.md](docs/3-overview/CHANGELOG.md)
- Roadmap/TODO: [docs/3-overview/TODO.md](docs/3-overview/TODO.md)
- Learnings log: [docs/2-technical/LEARNINGS.md](docs/2-technical/LEARNINGS.md)

---

## ⚡ REQUIRED RULES

- Never auto-delete backup files.
- Always update the learnings log for non-trivial changes.
- Test in a real game scenario (Terraria preferred).
- Maintain 8-language translations for all user-facing text.
- Run `npm run check` before committing.

---

## 🧪 RELIABLE TEST SCENARIOS

- **Audio (Whisper):** Record a short HU/EN phrase and verify accurate transcription.
- **Vision:** Capture a screenshot and confirm a game-aware response.
- **Game Detection:** Startup + hotkey + after game close (context clears).
- **History:** Add entries, restart, search + pinned-only filter works.
- **Notes:** Create/rename/pin notes and confirm active preview sync.
- **Language:** Switch UI language and confirm all labels update.

---

## 💬 TROUBLESHOOTING

### App Won't Start

```bash
npm start
```

Common causes:
- Missing dependencies: run `npm install`.
- Native module build tools missing (keytar). Install VS C++ build tools.

### Whisper or Vision Fails

- Verify API key is set in the app Settings (stored via keytar).
- Check network access to OpenAI endpoints.

### Game Detection Failing

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command ". 'd:\AIGameAssistant_new\get-active-window.ps1'"
```

### UI Buttons Not Responding

- Run `npm run check` and review orphan handler warnings.
- Check DevTools only in development builds.

---

## 📦 ENVIRONMENT REQUIREMENTS

- Windows 10/11
- Node.js 18+ (20+ recommended)
- npm 9+
- OpenAI API key (set in-app)
- Visual Studio C++ build tools (for keytar)

---

## 📊 POST-RELEASE MONITORING

- Track crash reports and issue volume.
- Review performance in real-game scenarios.
- Triage feature requests and update [docs/3-overview/TODO.md](docs/3-overview/TODO.md).

