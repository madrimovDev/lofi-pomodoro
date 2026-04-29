import { config } from 'dotenv';
config()
import { BrowserWindow, shell } from 'electron';
import { join } from 'path';

const isDev = process.env.NODE_ENV !== 'production';

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    frame: false,
    resizable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: !isDev,
    },
  });

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL!);
    // win.webContents.openDevTools();
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
    // win.loadURL(REMOTE_URL);
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}
