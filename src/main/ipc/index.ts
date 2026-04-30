import { ipcMain, app } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import { windowControlIpc } from './window-control';
import { setupStoreIpc } from './store.ipc';
import { setupMusicIpc } from './music.ipc';

export function registerAllIpcHandlers(window: Electron.BrowserWindow): void {
  windowControlIpc(window);
  setupStoreIpc();
  setupMusicIpc();
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => app.getVersion());
  ipcMain.handle(IPC_CHANNELS.APP_IS_ELECTRON, () => true);
}
