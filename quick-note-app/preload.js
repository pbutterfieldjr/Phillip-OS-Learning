const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quickNote', {
  load: () => ipcRenderer.invoke('store:load'),
  getPath: () => ipcRenderer.invoke('store:path'),
  save: (store) => ipcRenderer.invoke('store:save', store),
  exportBackup: (store) => ipcRenderer.invoke('store:exportBackup', store),
  importBackup: () => ipcRenderer.invoke('store:importBackup'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  revealDataFile: () => ipcRenderer.invoke('shell:revealDataFile')
});
