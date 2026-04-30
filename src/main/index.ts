import { config } from 'dotenv';
import { join } from 'path';
import { app, BrowserWindow, protocol, net } from 'electron';
import { createMainWindow } from './window';
import { registerAllIpcHandlers } from './ipc';

const envPath = app.isPackaged
  ? join(process.resourcesPath, '.env')
  : join(__dirname, '../../.env');

config({ path: envPath });

// Register custom scheme before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'localfile', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    // Serve local files via localfile:// protocol
    protocol.handle('localfile', (request) => {
      const pathname = new URL(request.url).pathname;
      const filePath = decodeURIComponent(pathname);
      return net.fetch(`file://${filePath}`);
    });

    const win = createMainWindow();
    registerAllIpcHandlers(win);
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
