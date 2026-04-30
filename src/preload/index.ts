import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type AudioFile,
  type MusicConfig,
  type Task,
  type Theme,
  type TimerSettings,
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
});
