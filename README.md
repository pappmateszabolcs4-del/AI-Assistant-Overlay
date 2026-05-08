# AI Assistant Overlay

Electron-based desktop overlay assistant for video games.  
It detects the active game window on Windows, provides in-game help, and supports text, voice (Whisper STT), and image-based analysis (Vision).

## ✨ Features

- **Game overlay UI** (non-intrusive, game-friendly)
- **Real-time game detection** (Windows + PowerShell)
- **OpenAI text assistant** for game-specific guidance
- **Vision analysis** for game screenshots
- **Whisper speech-to-text** for voice input
- **Collapsible panels** and compact layout
- **Conversation history** (localStorage, persisted)
- **Multi-language UI**: `hu`, `en`, `de`, `ru`, `fr`, `zh`
- **Hotkey support**: `Ctrl + Shift + K`

---

## 🧱 Tech Stack

- **Electron** (main + renderer processes)
- **Node.js**
- **OpenAI API** (`chat`, `vision`, `whisper-1`)
- **PowerShell scripts** for active window/game context detection
- **Keytar** for secure API key storage

---

## 📁 Project Structure

```text
src/
  main/
    app/
    ipc/
    services/
    state/
    utils/
    windows/
  renderer/
    overlay/
  shared/

data/
docs/
scripts/
main.js
overlay.html
package.json
```

---

## 🚀 Getting Started

### 1) Prerequisites

- Windows 10/11
- Node.js 18+ (recommended)
- npm

### 2) Install

```bash
npm install
```

### 3) Configure OpenAI API key

Use either:

- **Settings panel in app** (recommended; stored via keytar), or
- `.env` in project root:

```env
OPENAI_API_KEY=your_api_key_here
```

> Do not commit real secrets.

### 4) Run

```bash
npm start
```

---

## 🛠️ NPM Scripts

- `npm start` – start Electron app
- `npm run check` – project checks (patterns, IPC, translations, etc.)
- `npm run cleanup` – maintenance report (does not delete backups)
- `npm run make-backup` – create timestamped backup

---

## 🔒 Safety / Scope

This assistant is designed for **video game-related help only**.  
The prompt policy enforces refusal for non-gaming and unsafe topics.

---

## 🧪 Notes

- Build outputs in `out/` should be ignored in GitHub commits.
- Backups are preserved intentionally (`backups/`), deletion is manual.
- If game detection fails, the assistant still works with generic game guidance.

---

## 📚 Documentation

See `docs/` for:

- Architecture and audit reports
- Changelog and project status
- Deployment and reference guides

