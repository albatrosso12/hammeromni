'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  getPath: (name) => ipcRenderer.invoke('app:getPath', name),
  minimize: () => ipcRenderer.invoke('win:minimize'),
  maximize: () => ipcRenderer.invoke('win:maximize'),
  close: () => ipcRenderer.invoke('win:close'),
  onWindowMoved: (callback) => {
    ipcRenderer.removeAllListeners('window-moved');
    ipcRenderer.on('window-moved', () => callback());
  },
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-action', (event, action) => callback(action));
  },
  onFileOpen: (callback) => {
    ipcRenderer.on('file-open', (event, path) => callback(path));
  },
  removeMenuListener: () => {
    ipcRenderer.removeAllListeners('menu-action');
    ipcRenderer.removeAllListeners('file-open');
  },
});
