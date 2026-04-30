import type {
  AudioFile,
  MusicConfig,
  Task,
  Theme,
  TimerSettings,
  YoutubePlaylistItem,
  YoutubeStreamInfo,
} from '../shared/types';

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
}

declare global {
  interface Window {
    electronApi?: ElectronAPI;
  }
}
