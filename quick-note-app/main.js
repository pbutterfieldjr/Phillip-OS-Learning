const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const dataDir = app.getPath('userData');
const dataFile = path.join(dataDir, 'quick-note-data.json');
const backupFile = path.join(dataDir, 'quick-note-data.backup.json');

function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch (e) {
    return {};
  }
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
    width: 820,
    height: 920,
    minWidth: 480,
    minHeight: 600,
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
    title: 'Export Quick Note Backup',
    defaultPath: `quicknote-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { canceled: true };
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2));
  return { canceled: false, filePath };
});

ipcMain.handle('store:importBackup', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Quick Note Backup',
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
