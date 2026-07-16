# Quick Note (desktop app)

A standalone Electron desktop app for daily notes, call logs, and a to-do
session log. Replaces the old browser/artifact version — no more relying on
`window.storage` or an external Google Doc webhook, both of which were
silently failing to save.

## How saving works now

Everything is written straight to a local JSON file on your machine:

- macOS: `~/Library/Application Support/quick-note/quick-note-data.json`
- Windows: `%APPDATA%\quick-note\quick-note-data.json`
- Linux: `~/.config/quick-note/quick-note-data.json`

Every save first copies the previous file to `quick-note-data.backup.json`
in the same folder, and writes the new data to a temp file before renaming
it into place — so a crash mid-write can't corrupt your data. The app also
shows the exact save path at the bottom of the window.

Use the **Export Backup** button any time to save a timestamped snapshot
(JSON) to a folder of your choosing — e.g. Dropbox, a USB drive, iCloud
Drive — for an off-machine copy. **Import Backup** restores from one of
those files.

## Running it

Requires [Node.js](https://nodejs.org) installed on your machine.

```bash
cd quick-note-app
npm install
npm start
```

## Building a standalone installer

```bash
npm run dist
```

This uses `electron-builder` to produce an installer/package for whichever
OS you run it on (`.exe`/NSIS installer on Windows, `.dmg` on macOS,
`.AppImage` on Linux) in `quick-note-app/dist/`.

Note: this was built and syntax-checked in a sandboxed container without
GUI access or unrestricted network access, so the Electron binary itself
could not be downloaded or the window launched there — test `npm start`
locally before relying on it.
