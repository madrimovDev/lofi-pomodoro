import { Store } from '@madrimov/electron-store-typed';
import { DEFAULT_MUSIC_CONFIG, DEFAULT_TIMER_SETTINGS, type MusicConfig, type Task, type TimerSettings } from '../shared/types';

export interface AppConfig {
  theme: 'dark' | 'light';
  settings: TimerSettings;
  tasks: Task[];
  activeTaskId: string | null;
  music: MusicConfig;
}

let _store: Store<AppConfig> | null = null;

export function getAppStore(): Store<AppConfig> {
  if (!_store) {
    _store = new Store<AppConfig>({
      name: 'config',
      defaults: {
        theme: 'dark',
        settings: DEFAULT_TIMER_SETTINGS,
        tasks: [],
        activeTaskId: null,
        music: DEFAULT_MUSIC_CONFIG,
      },
    });
  }
  return _store;
}
