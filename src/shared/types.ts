export type Theme = 'dark' | 'light';

export type AmbientSound = 'none' | 'rain' | 'forest' | 'cafe';

export type MusicSortMode = 'shuffle' | 'alphabetical';

export type Locale = 'uz' | 'en' | 'ru';

export interface TimerSettings {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  ambientSound: AmbientSound;
  ambientVolume: number;
  focusMode: boolean;
  notificationSoundPath: string | null;
  locale: Locale;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  alwaysOnTop: boolean;
  activePreset: string | null;
  dailyGoal: number;
  showBreakScreen: boolean;
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
  focusMode: false,
  notificationSoundPath: null,
  locale: 'uz',
  autoStartBreaks: false,
  autoStartFocus: false,
  alwaysOnTop: false,
  activePreset: null,
  dailyGoal: 0,
  showBreakScreen: true,
};

export interface TimerPreset {
  id: string;
  name: string;
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}

export const DEFAULT_PRESETS: TimerPreset[] = [
  { id: 'deep-work', name: 'Deep Work', focusDuration: 50, shortBreakDuration: 10, longBreakDuration: 25, sessionsBeforeLongBreak: 2 },
  { id: 'classic', name: 'Classic', focusDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, sessionsBeforeLongBreak: 4 },
  { id: 'quick', name: 'Quick', focusDuration: 15, shortBreakDuration: 3, longBreakDuration: 10, sessionsBeforeLongBreak: 4 },
];

export interface SavedYtPlaylist {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  itemCount: number; // 0 = single video/stream
  addedAt: number;
}

export interface SavedMusicFolder {
  id: string;
  path: string;
  name: string;
}

export interface RadioStation {
  id: string;
  name: string;
  url: string;
  genre: string;
  isBuiltIn: boolean;
}

export const BUILT_IN_STATIONS: RadioStation[] = [
  { id: 'soma-drone', name: 'SomaFM Drone Zone', url: 'https://ice1.somafm.com/dronezone-128-mp3', genre: 'Ambient', isBuiltIn: true },
  { id: 'soma-groovy', name: 'SomaFM Groove Salad', url: 'https://ice1.somafm.com/groovesalad-128-mp3', genre: 'Ambient', isBuiltIn: true },
  { id: 'soma-deepspace', name: 'SomaFM Deep Space One', url: 'https://ice1.somafm.com/deepspaceone-128-mp3', genre: 'Ambient', isBuiltIn: true },
  { id: 'chillhop', name: 'Chillhop Radio', url: 'https://streams.radiomast.io/chillhop', genre: 'Lofi', isBuiltIn: true },
];

export interface MusicConfig {
  folderPath: string | null;
  sortMode: MusicSortMode;
  youtubeUrl: string | null;
  volume: number;
  savedPlaylists: SavedYtPlaylist[];
  savedFolders: SavedMusicFolder[];
  savedRadioStations: RadioStation[];
}

export const DEFAULT_MUSIC_CONFIG: MusicConfig = {
  folderPath: null,
  sortMode: 'shuffle',
  youtubeUrl: null,
  volume: 0.5,
  savedPlaylists: [],
  savedFolders: [],
  savedRadioStations: [],
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

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  estimatedPomodoros: number;
  completedPomodoros: number;
  createdAt: number;
  completedAt?: number;
  priority: 'high' | 'medium' | 'low' | null;
  dueDate: number | null;
  subtasks: Subtask[];
}

export interface TrayTimerState {
  timeLeft: number;
  mode: 'focus' | 'short-break' | 'long-break';
  isRunning: boolean;
}

export const IPC_CHANNELS = {
  // App
  APP_GET_VERSION: 'app:get-version',
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
  // Auto-updater
  UPDATER_CHECK: 'updater:check',
  UPDATER_STATUS: 'updater:status',
  UPDATER_INSTALL: 'updater:install',
  // Tasks
  TASKS_EXPORT: 'tasks:export',
  TASKS_IMPORT: 'tasks:import',
  // Settings extras
  SETTINGS_PICK_SOUND: 'settings:pick-sound',
  // Stats
  STATS_GET: 'stats:get',
  STATS_SET: 'stats:set',
  // Window control
  WINDOW_SET_ALWAYS_ON_TOP: 'window:set-always-on-top',
  WINDOW_SET_MINI_MODE: 'window:set-mini-mode',
  // Tray
  TRAY_UPDATE_STATE: 'tray:update-state',
  TRAY_TOGGLE_TIMER: 'tray:toggle-timer',
  TRAY_SKIP: 'tray:skip',
  TRAY_SET_MINI_MODE: 'tray:set-mini-mode',
} as const;

export const MUSIC_PANEL_WIDTH = 360;

export type UpdaterStatus =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available' }
  | { type: 'downloading'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string };

export interface DailyStat {
  date: string; // 'YYYY-MM-DD'
  focusSessions: number;
  focusMinutes: number;
  tasksCompleted: number;
  skippedSessions?: number;
}
