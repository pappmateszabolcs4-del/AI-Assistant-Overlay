# AI Assistant Overlay

Electron-based desktop overlay assistant for video games on Windows. It detects the active game window, provides in-game help, and supports text, voice (Whisper STT), and image-based analysis (Vision).

## ✨ Features

- **Game overlay UI** designed for non-intrusive use during gameplay.
- **Real-time game detection** via PowerShell window/title inspection.
- **OpenAI text assistant** for game-specific guidance.
- **Vision analysis** for screenshots.
- **Whisper speech-to-text** for voice input.
- **Block-based layout** with detachable block windows.
- **Pinned history** and **note/info panels** as separate windows.
- **Dynamic notes** with multiple named entries and pinned notes.
- **Conversation history** stored in localStorage.
- **Hotkey support**: `Ctrl + Shift + K`.

---

## 🌍 Languages

- **UI languages**: `hu`, `en`, `de`, `ru`, `fr`, `zh`, `it`, `pl`.
- **Runtime UI fallback**: missing labels auto-translate on demand.
- **AI response language** follows the selected UI language.

---

## ⚙️ How It Works

1) Detects the active game window title on Windows.
2) Uses that context to tailor prompts and responses.
3) Captures text, voice, or screenshots from the overlay UI.
4) Sends requests to OpenAI (chat, Whisper STT, Vision).
5) Renders results inside movable blocks or detached block windows.
6) Persists layout, history, and settings locally.
7) Notes are stored locally and can be switched/pinned.

---

## 🧱 Tech Stack

- **Electron** (main + renderer processes)
- **Node.js**
- **OpenAI API** (`chat`, `vision`, `whisper-1`)
- **PowerShell** for active window/game context detection
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

Set the key in the **Settings panel** inside the app (stored via keytar).

### 4) Run

```bash
npm start
```

---

## 🛠️ NPM Scripts

- `npm start` – start Electron app
- `npm test` – run Node test runner
- `npm run check` – project checks (patterns, IPC, translations, etc.)
- `npm run cleanup` – maintenance report (does not delete backups)
- `npm run make-backup` – create timestamped backup
- `npm run build:games` – build the offline game dataset
- `npm run validate:games` – validate game detection rules
- `npm run package` – package the app
- `npm run package:win` – package for Windows x64
- `npm run make` – create platform installers
- `npm run publish` – publish via Electron Forge

---

## 🔒 Safety / Scope

This assistant is designed for **video game-related help only**. The prompt policy enforces refusal for non-gaming and unsafe topics.

---

## 🧪 Notes

- Build outputs in `out/` should be ignored in GitHub commits.
- Backups are preserved intentionally (`backups/`); deletion is manual.
- If game detection fails, the assistant still works with generic game guidance.

---

## 📚 Documentation

See `docs/` for:

- Architecture and audit reports
- Changelog and project status
- Deployment and reference guides

