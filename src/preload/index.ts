import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type AudioFile,
  type DailyStat,
  type MusicConfig,
  type Task,
  type Theme,
  type TimerSettings,
  type TrayTimerState,
  type UpdaterStatus,
  type YoutubePlaylistItem,
  type YoutubeStreamInfo,
} from '../shared/types';

contextBridge.exposeInMainWorld('electronApi', {
  isElectron: true as const,

  getVersion: (): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
  minimizeWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  closeWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
  maximizeWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
  toggleMusicPanel: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_TOGGLE_MUSIC),

  getTheme: (): Promise<Theme> =>
    ipcRenderer.invoke(IPC_CHANNELS.STORE_GET_THEME),
  setTheme: (theme: Theme): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.STORE_SET_THEME, theme),

  getSettings: (): Promise<TimerSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.STORE_GET_SETTINGS),
  setSettings: (settings: TimerSettings): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.STORE_SET_SETTINGS, settings),

  getTasks: (): Promise<Task[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.STORE_GET_TASKS),
  setTasks: (tasks: Task[]): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.STORE_SET_TASKS, tasks),

  getActiveTaskId: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.STORE_GET_ACTIVE_TASK_ID),
  setActiveTaskId: (id: string | null): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.STORE_SET_ACTIVE_TASK_ID, id),

  getMusic: (): Promise<MusicConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS.STORE_GET_MUSIC),
  setMusic: (config: MusicConfig): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.STORE_SET_MUSIC, config),

  pickMusicFolder: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.MUSIC_PICK_FOLDER),
  listMusicFiles: (folderPath: string): Promise<AudioFile[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.MUSIC_LIST_FILES, folderPath),

  ytCheck: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.MUSIC_YT_CHECK),
  ytGetStream: (url: string): Promise<YoutubeStreamInfo | { error: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.MUSIC_YT_GET_STREAM, url),
  ytGetPlaylist: (url: string): Promise<YoutubePlaylistItem[] | { error: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.MUSIC_YT_GET_PLAYLIST, url),

  checkForUpdates: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATER_CHECK),

  installUpdate: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATER_INSTALL),

  onUpdateStatus: (callback: (status: UpdaterStatus) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, status: UpdaterStatus) => callback(status);
    ipcRenderer.on(IPC_CHANNELS.UPDATER_STATUS, handler);
    return () => ipcRenderer.off(IPC_CHANNELS.UPDATER_STATUS, handler);
  },

  // Stats
  getStats: (): Promise<DailyStat[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.STATS_GET),
  setStats: (stats: DailyStat[]): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.STATS_SET, stats),

  // Tasks export/import
  exportTasks: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.TASKS_EXPORT),
  importTasks: (): Promise<Task[] | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.TASKS_IMPORT),

  // Settings: pick notification sound
  pickNotificationSound: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_PICK_SOUND),

  // Window: always on top
  setAlwaysOnTop: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SET_ALWAYS_ON_TOP, enabled),

  // Window: mini mode
  setMiniMode: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SET_MINI_MODE, enabled),

  onMiniModeChanged: (cb: (enabled: boolean) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, v: boolean) => cb(v);
    ipcRenderer.on('window:mini-mode-changed', handler);
    return () => ipcRenderer.off('window:mini-mode-changed', handler);
  },

  // Todoist import
  todoistImport: (): Promise<{ error: string } | { id: string; name: string; description: string; estimatedPomodoros: number; completedPomodoros: number; createdAt: number; priority: 'high' | 'medium' | 'low' | null; dueDate: number | null; subtasks: [] }[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.TODOIST_IMPORT),

  // Tray sync
  updateTrayState: (state: TrayTimerState): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.TRAY_UPDATE_STATE, state),
  onTrayToggle: (cb: () => void): (() => void) => {
    const handler = () => cb();
    ipcRenderer.on(IPC_CHANNELS.TRAY_TOGGLE_TIMER, handler);
    return () => ipcRenderer.off(IPC_CHANNELS.TRAY_TOGGLE_TIMER, handler);
  },
  onTraySkip: (cb: () => void): (() => void) => {
    const handler = () => cb();
    ipcRenderer.on(IPC_CHANNELS.TRAY_SKIP, handler);
    return () => ipcRenderer.off(IPC_CHANNELS.TRAY_SKIP, handler);
  },
  onTraySetMiniMode: (cb: (enabled: boolean) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, v: boolean) => cb(v);
    ipcRenderer.on(IPC_CHANNELS.TRAY_SET_MINI_MODE, handler);
    return () => ipcRenderer.off(IPC_CHANNELS.TRAY_SET_MINI_MODE, handler);
  },
});
