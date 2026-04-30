import { IPC_CHANNELS, MUSIC_PANEL_WIDTH } from "@shared/types";
import { ipcMain } from "electron";

export const windowControlIpc = (window: Electron.BrowserWindow) => {
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    window.minimize();
  });
  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });
  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => window.close());

  // Music panel: expand/collapse window width
  let baseWidth: number | null = null;

  ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_MUSIC, (): boolean => {
    const [w, h] = window.getSize();
    if (baseWidth === null) {
      baseWidth = w;
      window.setSize(w + MUSIC_PANEL_WIDTH, h, true);
      return true;
    } else {
      window.setSize(baseWidth, h, true);
      baseWidth = null;
      return false;
    }
  });
};
