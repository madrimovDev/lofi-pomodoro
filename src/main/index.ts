import { config } from 'dotenv';
import { join } from 'path';
import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';
import { registerAllIpcHandlers } from './ipc';

// .env faylni yuklash
// Development: loyiha root dan
// Production (packaged): app resources papkasidan
const envPath = app.isPackaged
  ? join(process.resourcesPath, '.env')
  : join(__dirname, '../../.env');

config({ path: envPath });

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  const win = BrowserWindow.getAllWindows()[0];
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    const win = createMainWindow();
    registerAllIpcHandlers(win);
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
