import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { IPC_CHANNELS, type UpdaterStatus } from '../../shared/types';
import log from '../logger';

function send(win: BrowserWindow, status: UpdaterStatus): void {
  if (!win.isDestroyed()) {
    win.webContents.send(IPC_CHANNELS.UPDATER_STATUS, status);
  }
}

export function initAutoUpdater(win: BrowserWindow): void {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    log.info('Updater: checking for update');
    send(win, { type: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Updater: update available', info.version);
    send(win, { type: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    log.info('Updater: up to date');
    send(win, { type: 'not-available' });
  });

  autoUpdater.on('download-progress', (p) =>
    send(win, { type: 'downloading', percent: Math.round(p.percent) }));

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Updater: downloaded', info.version);
    send(win, { type: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    log.error('Updater error:', err);
    send(win, { type: 'error', message: err.message });
  });

  // 5s kechiktirish — UI to'liq yuklansin
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 5_000);
}

export function checkForUpdatesManually(): void {
  if (!app.isPackaged) return;
  autoUpdater.checkForUpdates().catch(() => {});
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall();
}
