# Phillip-OS Task Manager

A standalone Electron desktop app. Quick Note (daily notes, call log, and
today's to-dos) is now one tab among several:

- **Notes** — the original quick note, autosaved as you type
- **Calls** — call log with Outlook/Todoist quick actions
- **Today** — today's to-dos, plus reminders that fire a desktop
  notification at a set time (only while the app is open)
- **Calendar** — day/week/month views of events you create in the app.
  Not connected to Google/Outlook/Todoist calendars yet — that's a later
  phase.
- **Countdowns** — TickTick-style countdowns to any date

There's also a clock next to the date, and an adjustable Pomodoro timer
(work/break minutes) next to the Export/Import buttons.

## How saving works

Everything is written straight to a local JSON file on your machine:

- macOS: `~/Library/Application Support/quick-note/quick-note-data.json`
- Windows: `%APPDATA%\quick-note\quick-note-data.json`
- Linux: `~/.config/quick-note/quick-note-data.json`

(The on-disk folder/app-id is still `quick-note` for now so upgrading in
place doesn't move your existing data.)

Every save first copies the previous file to `quick-note-data.backup.json`
in the same folder, and writes the new data to a temp file before renaming
it into place — so a crash mid-write can't corrupt your data. Click
**(show file)** next to the save status to reveal the data file in
Finder/Explorer.

The data file went through one shape change: it used to be a flat
`{ "2026-07-16": { notes, calls, todos } }` map; it's now
`{ days: { "2026-07-16": {...} }, countdowns: [...], events: [...],
reminders: [...], pomodoro: {...} }` to make room for the new tabs. Old
files are migrated automatically the first time this version loads them —
nothing needs to be done manually, and your existing notes/calls/todos
carry over.

Use the **Export Backup** button any time to save a timestamped snapshot
(JSON) to a folder of your choosing — e.g. Dropbox, a USB drive, iCloud
Drive — for an off-machine copy. **Import Backup** restores from one of
those files (it also still reads the old single-day export format from
before the rebrand).

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

## Troubleshooting: "Electron failed to install correctly"

If `npm start` throws this on macOS, it means Electron's installer
downloaded its zip but the `extract-zip` library it uses failed to fully
extract it — specifically it can drop `Electron Framework.framework`
because that bundle is full of macOS-style symlinks, which that library
doesn't always handle correctly. Symptoms: `npm start` first complains
about a missing `path.txt`, and after that's fixed, launching crashes
with `dyld: Library not loaded: @rpath/Electron Framework.framework/...`.

Fix — re-extract the already-downloaded zip with macOS's own `ditto`
(which handles the symlinks correctly) instead of the JS extractor:

```bash
rm -rf node_modules/electron/dist
ditto -xk ~/Library/Caches/electron/*/electron-v*.zip node_modules/electron/dist
echo -n "Electron.app/Contents/MacOS/Electron" > node_modules/electron/path.txt
npm start
```

(Adjust the zip filename glob if you have more than one cached version.)
If `node_modules/electron/dist` and the cached zip under
`~/Library/Caches/electron/` don't already exist, run `npm install` once
first so the zip gets downloaded.
