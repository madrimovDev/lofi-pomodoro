import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { TrayTimerState } from '@shared/types';

const appWindow = getCurrentWindow();

/** Resize yo'nalishi — @tauri-apps/api `ResizeDirection` export qilmaydi, shuning uchun lokal. */
export type ResizeDir =
  | 'North' | 'South' | 'East' | 'West'
  | 'NorthEast' | 'NorthWest' | 'SouthEast' | 'SouthWest';

/** Oddiy oyna amallari — renderer'da to'g'ridan-to'g'ri. */
export const win = {
  minimize: () => appWindow.minimize(),
  toggleMaximize: () => appWindow.toggleMaximize(),
  close: () => appWindow.close(),
};

/** Murakkab oyna/tray amallari — Rust command. */
export const winApi = {
  setAlwaysOnTop: (enabled: boolean) => invoke<void>('set_always_on_top', { enabled }),
  setMiniMode: (enabled: boolean) => invoke<void>('set_mini_mode', { enabled }),
  setBreakOverlay: (active: boolean) => invoke<void>('set_break_overlay', { active }),
  updateTrayState: (state: TrayTimerState) => invoke<void>('update_tray_state', { state }),
  startResizeDragging: (direction: ResizeDir) =>
    appWindow.startResizeDragging(direction),
};

/** Tray/oyna hodisalariga obuna — Promise<UnlistenFn> qaytaradi (Tauri async). */
export const winEvents = {
  onMiniModeChanged: (cb: (enabled: boolean) => void): Promise<UnlistenFn> =>
    listen<boolean>('window:mini-mode-changed', (e) => cb(e.payload)),
  onTrayToggle: (cb: () => void): Promise<UnlistenFn> =>
    listen('tray:toggle-timer', () => cb()),
  onTraySkip: (cb: () => void): Promise<UnlistenFn> =>
    listen('tray:skip', () => cb()),
  onTraySetMiniMode: (cb: (enabled: boolean) => void): Promise<UnlistenFn> =>
    listen<boolean>('tray:set-mini-mode', (e) => cb(e.payload)),
};
