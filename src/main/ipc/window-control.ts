import { IPC_CHANNELS } from "@shared/types";
import { ipcMain } from "electron";

export const windowControlIpc = (window: Electron.BrowserWindow) => {
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    console.log('minimize')
    window.minimize()
  });
  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
  });
  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => window.close());
}
