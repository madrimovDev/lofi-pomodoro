import type {
  AudioFile,
  DailyStat,
  MusicConfig,
  Task,
  Theme,
  TimerSettings,
  TrayTimerState,
  UpdaterStatus,
  YoutubePlaylistItem,
  YoutubeStreamInfo,
} from '../shared/types';

type ImportedTask = Omit<Task, 'subtasks'> & { subtasks: [] };

export interface ElectronAPI {
  isElectron: true;
  getVersion(): Promise<string>;
  minimizeWindow(): void;
  closeWindow(): void;
  maximizeWindow(): void;
  toggleMusicPanel(): Promise<boolean>;

  getTheme(): Promise<Theme>;
  setTheme(theme: Theme): Promise<void>;

  getSettings(): Promise<TimerSettings>;
  setSettings(settings: TimerSettings): Promise<void>;

  getTasks(): Promise<Task[]>;
  setTasks(tasks: Task[]): Promise<void>;
  getActiveTaskId(): Promise<string | null>;
  setActiveTaskId(id: string | null): Promise<void>;

  getMusic(): Promise<MusicConfig>;
  setMusic(config: MusicConfig): Promise<void>;

  pickMusicFolder(): Promise<string | null>;
  listMusicFiles(folderPath: string): Promise<AudioFile[]>;

  ytCheck(): Promise<boolean>;
  ytGetStream(url: string): Promise<YoutubeStreamInfo | { error: string }>;
  ytGetPlaylist(url: string): Promise<YoutubePlaylistItem[] | { error: string }>;

  checkForUpdates(): Promise<void>;
  installUpdate(): Promise<void>;
  onUpdateStatus(callback: (status: UpdaterStatus) => void): () => void;

  getStats(): Promise<DailyStat[]>;
  setStats(stats: DailyStat[]): Promise<void>;

  exportTasks(): Promise<boolean>;
  importTasks(): Promise<Task[] | null>;

  pickNotificationSound(): Promise<string | null>;

  setAlwaysOnTop(enabled: boolean): Promise<void>;
  setMiniMode(enabled: boolean): Promise<void>;
  onMiniModeChanged(cb: (enabled: boolean) => void): () => void;

  todoistImport(): Promise<ImportedTask[] | { error: string }>;

  updateTrayState(state: TrayTimerState): Promise<void>;
  onTrayToggle(cb: () => void): () => void;
  onTraySkip(cb: () => void): () => void;
  onTraySetMiniMode(cb: (enabled: boolean) => void): () => void;
}

declare global {
  interface Window {
    electronApi?: ElectronAPI;
  }
}
