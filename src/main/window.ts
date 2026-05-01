import { BrowserWindow, shell, app } from 'electron';
import { join } from 'path';
import { createWindowState } from '@madrimov/electron-window-state';
import log from './logger';

const isDev = process.env.NODE_ENV !== 'production';

// Wayland: ilovalar global screen pozitsiyasini bila olmaydi,
// shuning uchun x/y berish oynani noto'g'ri monitorda ochadi.
const isWayland =
  process.platform === 'linux' &&
  (!!process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === 'wayland');

export function createMainWindow(): BrowserWindow {
  const state = createWindowState({ defaultWidth: 1280, defaultHeight: 800 });

  const win = new BrowserWindow({
    ...(isWayland ? {} : { x: state.x, y: state.y }),
    width: state.width,
    height: state.height,
    minWidth: 600,
    minHeight: 400,
    frame: false,
    resizable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: app.isPackaged || !isDev,
    },
  });

  state.manage(win);

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    win.loadFile(join(__dirname, '../index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Log renderer crashes so they appear in electron-log files
  win.webContents.on('render-process-gone', (_e, details) => {
    log.error('Renderer process gone:', details.reason, details.exitCode);
  });
  win.on('unresponsive', () => {
    log.warn('Window became unresponsive');
  });

  return win;
}
