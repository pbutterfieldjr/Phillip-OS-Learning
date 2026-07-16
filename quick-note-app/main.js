const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const dataDir = app.getPath('userData');
const dataFile = path.join(dataDir, 'quick-note-data.json');
const backupFile = path.join(dataDir, 'quick-note-data.backup.json');

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// v1 of this file was a flat { [dateKey]: { notes, calls, todos } } map.
// v2 nests that under `days` and adds app-wide sections that aren't tied
// to a single day. Old files get migrated in place on first load.
function normalizeStore(raw) {
  raw = raw || {};
  let days = raw.days;
  if (!days) {
    days = {};
    for (const k of Object.keys(raw)) {
      if (DATE_KEY_PATTERN.test(k)) days[k] = raw[k];
    }
  }
  return {
    days,
    countdowns: Array.isArray(raw.countdowns) ? raw.countdowns : [],
    events: Array.isArray(raw.events) ? raw.events : [],
    reminders: Array.isArray(raw.reminders) ? raw.reminders : [],
    pomodoro: raw.pomodoro && typeof raw.pomodoro === 'object'
      ? {
          workMin: Number(raw.pomodoro.workMin) || 25,
          breakMin: Number(raw.pomodoro.breakMin) || 5
        }
      : { workMin: 25, breakMin: 5 }
  };
}

function loadStore() {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch (e) {
    raw = {};
  }
  return normalizeStore(raw);
}

function saveStore(store) {
  // Keep a rolling backup of the last good save before overwriting, and
  // write via a temp file + rename so a crash mid-write can't corrupt the
  // real data file.
  try {
    if (fs.existsSync(dataFile)) {
      fs.copyFileSync(dataFile, backupFile);
    }
  } catch (e) {
    console.error('Backup copy failed:', e);
  }
  const tmpFile = dataFile + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2));
  fs.renameSync(tmpFile, dataFile);
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 960,
    minWidth: 560,
    minHeight: 640,
    title: 'Phillip-OS Task Manager',
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('store:load', () => loadStore());

ipcMain.handle('store:path', () => dataFile);

ipcMain.handle('store:save', (event, store) => {
  saveStore(store);
  return { ok: true, path: dataFile };
});

ipcMain.handle('store:exportBackup', async (event, store) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Phillip-OS Task Manager Backup',
    defaultPath: `phillip-os-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { canceled: true };
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2));
  return { canceled: false, filePath };
});

ipcMain.handle('store:importBackup', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Backup',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths[0]) return { canceled: true };
  const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
  return { canceled: false, data };
});

ipcMain.handle('shell:openExternal', (event, url) => {
  return shell.openExternal(url);
});

ipcMain.handle('shell:revealDataFile', () => {
  shell.showItemInFolder(dataFile);
});
