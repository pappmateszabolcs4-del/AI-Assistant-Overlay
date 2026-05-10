# Visual Summary

## System Snapshot

```
App
├─ Main process (Electron)
├─ Overlay UI (HTML/CSS/JS)
├─ IPC bridge
├─ Game detection (PowerShell)
└─ OpenAI services (Whisper + Vision)
```

## Key Capabilities
- Overlay assistance with block-based layout and detachable block windows.
- History, note, and info panels as separate movable windows.
- Game context detection via active window and dataset matching.
- Audio transcription via Whisper; image analysis via Vision.
- Dynamic notes (multiple entries, rename + pin).
- Multi-language UI (8 languages).

## Quality Snapshot
- Code quality: 8.35/10
- Security: audit passed, no critical findings
- Performance: stable in gameplay sessions

## Release Readiness
- Core features complete.
- Known issues documented.
- Installer and signing remain.
