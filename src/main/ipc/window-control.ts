import { IPC_CHANNELS, MUSIC_PANEL_WIDTH } from "@shared/types";
import { ipcMain } from "electron";
import { getAppStore } from "../store";

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

  // ── Always on top ─────────────────────────────────────────────────────────
  // 'screen-saver' = highest level on macOS; ignored on Win/Linux (harmless).
  // On macOS: setVisibleOnAllWorkspaces keeps the window across Spaces.
  // On Linux Wayland: compositors often reset stacking on blur, so we
  // re-apply setAlwaysOnTop on every blur event while the flag is enabled.
  let _alwaysOnTopEnabled = false;

  function onBlurReapply() {
    if (_alwaysOnTopEnabled) {
      window.setAlwaysOnTop(true, 'screen-saver');
    }
  }

  function applyAlwaysOnTop(enabled: boolean) {
    _alwaysOnTopEnabled = enabled;
    if (enabled) {
      window.setAlwaysOnTop(true, 'screen-saver');
      if (process.platform === 'darwin') {
        window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      }
      if (process.platform === 'linux') {
        window.on('blur', onBlurReapply);
      }
    } else {
      window.setAlwaysOnTop(false);
      if (process.platform === 'darwin') {
        window.setVisibleOnAllWorkspaces(false);
      }
      if (process.platform === 'linux') {
        window.off('blur', onBlurReapply);
      }
    }
  }

  ipcMain.handle(IPC_CHANNELS.WINDOW_SET_ALWAYS_ON_TOP, (_e, enabled: boolean) => {
    applyAlwaysOnTop(enabled);
  });

  // Restore alwaysOnTop from stored settings on startup (runs once, here so
  // applyAlwaysOnTop's blur listener is registered from the beginning)
  try {
    const store = getAppStore();
    const settings = store.get('settings');
    if (settings?.alwaysOnTop) {
      applyAlwaysOnTop(true);
    }
  } catch { /* ignore */ }

  // ── Mini mode ─────────────────────────────────────────────────────────────
  let _normalSize = { width: 600, height: 700 };
  let _normalMinSize = { width: 480, height: 500 };
  let _miniWasAlwaysOnTop = false;

  ipcMain.handle(IPC_CHANNELS.WINDOW_SET_MINI_MODE, (_e, enabled: boolean) => {
    if (enabled) {
      const [w, h] = window.getSize();
      const [minW, minH] = window.getMinimumSize();
      _normalSize = { width: w, height: h };
      _normalMinSize = { width: minW, height: minH };
      _miniWasAlwaysOnTop = window.isAlwaysOnTop();
      window.setMinimumSize(200, 54);
      window.setMaximumSize(800, 200);
      window.setSize(320, 72);
      window.setResizable(true);
      // Mini mode always floats above other windows
      applyAlwaysOnTop(true);
    } else {
      // Clear min first (to avoid impossible min > max while max is still 800x200),
      // then expand max to a large value — do NOT use setMaximumSize(0, 0) because
      // on Linux/KDE Wayland that can trigger the WM to expand the window unexpectedly.
      window.setMinimumSize(0, 0);
      window.setMaximumSize(9999, 9999);
      window.setMinimumSize(_normalMinSize.width, _normalMinSize.height);
      window.setSize(_normalSize.width, _normalSize.height);
      window.setResizable(true);
      // Restore previous always-on-top state
      applyAlwaysOnTop(_miniWasAlwaysOnTop);
    }
    window.webContents.send('window:mini-mode-changed', enabled);
  });
};
