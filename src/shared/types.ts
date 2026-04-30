export type Theme = 'dark' | 'light';

export type AmbientSound = 'none' | 'rain' | 'forest' | 'cafe';

export type MusicSortMode = 'shuffle' | 'alphabetical';

export interface TimerSettings {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  ambientSound: AmbientSound;
  ambientVolume: number;
}

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  soundEnabled: true,
  notificationsEnabled: true,
  ambientSound: 'none',
  ambientVolume: 0.4,
};

export interface MusicConfig {
  folderPath: string | null;
  sortMode: MusicSortMode;
  youtubeUrl: string | null;
  volume: number;
}

export const DEFAULT_MUSIC_CONFIG: MusicConfig = {
  folderPath: null,
  sortMode: 'shuffle',
  youtubeUrl: null,
  volume: 0.5,
};

export interface AudioFile {
  name: string;
  url: string; // localfile:// URL
}

export interface YoutubeStreamInfo {
  streamUrl: string;
  title: string;
  isLive: boolean;
}

export interface YoutubePlaylistItem {
  id: string;
  title: string;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  estimatedPomodoros: number;
  completedPomodoros: number;
  createdAt: number;
  completedAt?: number;
}

export const IPC_CHANNELS = {
  // App
  APP_GET_VERSION: 'app:get-version',
  APP_IS_ELECTRON: 'app:is-electron',
  // Window
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  // Store
  STORE_GET_THEME: 'store:get-theme',
  STORE_SET_THEME: 'store:set-theme',
  STORE_GET_SETTINGS: 'store:get-settings',
  STORE_SET_SETTINGS: 'store:set-settings',
  STORE_GET_TASKS: 'store:get-tasks',
  STORE_SET_TASKS: 'store:set-tasks',
  STORE_GET_ACTIVE_TASK_ID: 'store:get-active-task-id',
  STORE_SET_ACTIVE_TASK_ID: 'store:set-active-task-id',
  STORE_GET_MUSIC: 'store:get-music',
  STORE_SET_MUSIC: 'store:set-music',
  // Music - Folder
  MUSIC_PICK_FOLDER: 'music:pick-folder',
  MUSIC_LIST_FILES: 'music:list-files',
  // Music - YouTube
  MUSIC_YT_CHECK: 'music:yt-check',
  MUSIC_YT_GET_STREAM: 'music:yt-get-stream',
  MUSIC_YT_GET_PLAYLIST: 'music:yt-get-playlist',
  // Window - Music panel
  WINDOW_TOGGLE_MUSIC: 'window:toggle-music',
} as const;

export const MUSIC_PANEL_WIDTH = 360;
