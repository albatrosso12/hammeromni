import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow;

console.error = (...args) => console.log('[ERROR]', ...args);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0d0d0d',
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.cjs'),
      webSecurity: false,
      devTools: !app.isPackaged,
    },
  });

  // DevTools только в dev-режиме
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  const isDev = !app.isPackaged;

  let indexPath;
  indexPath = join(__dirname, '..', 'dist', 'index.html');

  console.log('Loading index from:', indexPath);
  console.log('File exists:', fs.existsSync(indexPath));
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
    console.log('[FAIL LOAD]', errorCode, errorDesc);
  });
  
  mainWindow.webContents.on('console-message', (event, level, msg) => {
    console.log('[CONSOLE]', msg);
  });
  
  mainWindow.loadFile(indexPath);

  let moveTick = 0;
  mainWindow.on('move', () => {
    if (mainWindow.isDestroyed()) return;
    const now = Date.now();
    if (now - moveTick < 32) return;
    moveTick = now;
    mainWindow.webContents.send('window-moved');
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('dialog:saveFile', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('app:getPath', (event, name) => {
  return app.getPath(name);
});

ipcMain.handle('win:minimize', () => mainWindow?.minimize());
ipcMain.handle('win:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('win:close', () => mainWindow?.close());

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
