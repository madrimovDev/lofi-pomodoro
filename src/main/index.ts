import { config } from 'dotenv';
import { join } from 'path';
import { app, BrowserWindow, protocol, net } from 'electron';
import { createMainWindow } from './window';
import { registerAllIpcHandlers } from './ipc';
import { setupTray } from './tray';
import log from './logger';

process.on('uncaughtException', (err) => {
  log.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection:', reason);
});

// Load .env only in development — packaged builds don't need it
if (!app.isPackaged) {
  config({ path: join(__dirname, '../../.env') });
}

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

    log.info('App ready, creating main window');
    const win = createMainWindow();
    registerAllIpcHandlers(win);
    setupTray(win);


    // Yopish tugmasini bosish ilovani trayga yashiradi
    win.on('close', (e) => {
      if (!(app as typeof app & { isQuiting?: boolean }).isQuiting) {
        e.preventDefault();
        win.hide();
      }
    });
  });

  app.on('before-quit', () => {
    (app as typeof app & { isQuiting?: boolean }).isQuiting = true;
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
