import { ipcMain, app } from 'electron';
import { setupPrinterIPC } from '@madrimov/electron-pos-printer';
import { IPC_CHANNELS } from '../../shared/types';
import { windowControlIpc } from './window-control';


export function registerAllIpcHandlers(window: Electron.BrowserWindow): void {
  setupPrinterIPC();
  windowControlIpc(window);

  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => app.getVersion());
  ipcMain.handle(IPC_CHANNELS.APP_IS_ELECTRON, () => true);
}
